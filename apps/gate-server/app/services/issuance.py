import logging
import uuid

from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.adapters.mosip import MOSIPUnavailableError
from app.core.trace import get_trace_id
from app.core.utils import integrity_constraint_label, short_error_message
from app.models.enums import EventStatusEnum, TicketStatusEnum
from app.models.schemas import IssueContext, IssueResponse
from app.repositories.event import EventRepository
from app.repositories.ticket import TicketRepository
from app.services.identity import IdentityService


logger = logging.getLogger(__name__)


class _IssueError(Exception):
    """
    Internal sentinel raised by _abort() to unwind the issuance pipeline.

    Carries an HTTP status code and a machine-readable detail string so the entry point can re-raise as an HTTPException without each step importing FastAPI directly.
    """

    def __init__(self, status_code: int, detail: str) -> None:
        super().__init__(detail)

        self.status_code = status_code
        self.detail = detail


class IssuanceService:
    def __init__(
        self,
        db: Session,
        identity: IdentityService | None = None,
        events: EventRepository | None = None,
        tickets: TicketRepository | None = None,
    ) -> None:
        self.db = db
        self.identity = identity or IdentityService()
        self.events = events or EventRepository(db)
        self.tickets = tickets or TicketRepository(db)

    def issue(self, qr_payload: str, event_id: uuid.UUID) -> IssueResponse:
        """
        Entry point. Runs the server-side issuance pipeline (Phase 0) and returns a confirmation on success.
        """

        from fastapi import HTTPException  # A local import to keep layer clean

        trace_id = get_trace_id()

        logger.info(
            "issue pipeline start: trace_id=%s event_id=%s qr_payload_bytes=%d",
            trace_id,
            event_id,
            len(qr_payload.encode("utf-8")),
        )

        context = self._init_context(qr_payload, event_id)

        try:
            context = self._resolve_event(context)    # Phase 0, Extra
            context = self._verify_identity(context)  # Phase 0, Steps 3-4
            context = self._create_ticket(context)    # Phase 0, Step 5

        except _IssueError as exc:
            raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc

        assert context.ticket_id is not None
        assert context.link_id is not None
        assert context.created_at is not None

        return IssueResponse(
            ticket_id=context.ticket_id,
            link_id=context.link_id,
            status=TicketStatusEnum.UNUSED,
            created_at=context.created_at,
        )

    # Context initialization
    def _init_context(self, qr_payload: str, event_id: uuid.UUID) -> IssueContext:
        return IssueContext(
            qr_payload=qr_payload,
            event_id=event_id,
        )

    # ------------------------------------------------------------------
    # Pipeline Phase 0, Step 1
    # ------------------------------------------------------------------

    def _resolve_event(self, ctx: IssueContext) -> IssueContext:
        """
        Confirm the target event exists and is in a state that allows ticket issuance.

        Issuing tickets for a CONCLUDED or CANCELLED event is not permitted.
        """

        event = self.events.get_by_id(ctx.event_id)

        if event is None:
            logger.warning(
                "issue failed: reason=event_not_found status_code=404 "
                "trace_id=%s event_id=%s",
                get_trace_id(),
                ctx.event_id,
            )

            return self._abort(404, "event_not_found")

        if event.status not in (EventStatusEnum.SCHEDULED, EventStatusEnum.ACTIVE):
            logger.warning(
                "issue failed: reason=event_not_accepting_tickets status_code=409 "
                "trace_id=%s event_id=%s event_status=%s",
                get_trace_id(),
                ctx.event_id,
                event.status.value,
            )

            return self._abort(409, "event_not_accepting_tickets")

        return ctx

    # ------------------------------------------------------------------
    # Pipeline Phase 2, Steps 3-4
    # ------------------------------------------------------------------

    def _verify_identity(self, ctx: IssueContext) -> IssueContext:
        """
        Forward the QR payload to MOSIP. On success, store the PSUT and compute the link_hash that will bind this identity to the event.
        """

        try:
            verified = self.identity.verify(ctx.qr_payload)

        except MOSIPUnavailableError:
            logger.error(
                "issue failed: reason=mosip_unavailable status_code=503 "
                "trace_id=%s event_id=%s",
                get_trace_id(),
                ctx.event_id,
            )

            return self._abort(503, "mosip_unavailable")

        if verified is None:
            logger.warning(
                "issue failed: reason=identity_not_verified status_code=400 "
                "trace_id=%s event_id=%s",
                get_trace_id(),
                ctx.event_id,
            )

            return self._abort(400, "identity_not_verified")

        ctx.uin = verified.uin
        ctx.psut = verified.psut

        ctx.link_hash = self.identity.compute_link_hash(ctx.psut, ctx.event_id)

        return ctx

    # ------------------------------------------------------------------
    # Pipeline Phase 2, Step 5
    # ------------------------------------------------------------------

    def _create_ticket(self, ctx: IssueContext) -> IssueContext:
        """
        Persist the EventTicketLink and Ticket to the database.

        The unique constraint on link_hash means that if the same identity attempts to purchase a second ticket for the same event, the INSERT on EventTicketLink will raise an IntegrityError.
        """

        assert ctx.psut is not None
        assert ctx.link_hash is not None

        try:
            link = self.tickets.create_link(ctx.event_id, ctx.link_hash)
            ticket = self.tickets.create_ticket(ctx.event_id, link.link_id)

            self.db.commit()
            self.db.refresh(ticket)

        except IntegrityError as exc:
            self.db.rollback()

            constraint = integrity_constraint_label(exc)

            # The expected IntegrityError at the link stage is a duplicate link_hash
            if constraint and "link_hash" in constraint:
                logger.warning(
                    "issue failed: reason=ticket_already_issued status_code=409 "
                    "trace_id=%s event_id=%s constraint=%s",
                    get_trace_id(),
                    ctx.event_id,
                    constraint,
                )

                return self._abort(409, "ticket_already_issued")

            # Any other IntegrityError is unexpected and treated as a server error
            logger.error(
                "issue failed: reason=persistence_failed status_code=500 "
                "trace_id=%s event_id=%s constraint=%s error_type=%s error=%s",
                get_trace_id(),
                ctx.event_id,
                constraint,
                type(exc).__name__,
                short_error_message(exc),
            )

            return self._abort(500, "internal_server_error")

        except SQLAlchemyError as exc:
            self.db.rollback()

            logger.error(
                "issue failed: reason=persistence_failed status_code=500 "
                "trace_id=%s event_id=%s error_type=%s error=%s",
                get_trace_id(),
                ctx.event_id,
                type(exc).__name__,
                short_error_message(exc),
            )

            return self._abort(500, "internal_server_error")

        logger.info(
            "issue succeeded: trace_id=%s event_id=%s ticket_id=%s link_id=%s",
            get_trace_id(),
            ctx.event_id,
            ticket.ticket_id,
            link.link_id,
        )

        ctx.link_id = link.link_id
        ctx.ticket_id = ticket.ticket_id
        ctx.created_at = ticket.created_at

        return ctx

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _abort(self, status_code: int, detail: str) -> IssueContext:
        """
        Raise _IssueError to unwind the pipeline.
        """

        raise _IssueError(status_code=status_code, detail=detail)
