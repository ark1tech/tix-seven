import logging
import uuid
from typing import Any, cast
import json

from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.adapters.mosip import MOSIPUnavailableError
from app.core.demo_identity_log import DemoLogger
from app.core.trace import get_trace_id
from app.core.utils import integrity_constraint_label, short_error_message
from app.models.enums import EventStatusEnum, TicketStatusEnum
from app.models.schemas import IssueContext, IssueResponse
from app.repositories.event import EventRepository
from app.repositories.ticket import TicketRepository
from app.services.identity import IdentityService


logger = logging.getLogger(__name__)


class IssueError(Exception):
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

    def issue(self, qr_payload: str, event_id: uuid.UUID, stub_mosip: bool = False) -> IssueResponse:
        """
        Entry point. Runs the server-side issuance pipeline (Phase 0) and returns a confirmation on success.
        """

        trace_id = get_trace_id()

        logger.info(
            "issue pipeline start: trace_id=%s event_id=%s qr_payload_bytes=%d",
            trace_id,
            event_id,
            len(qr_payload.encode("utf-8")),
        )

        context = self._init_context(qr_payload, event_id, stub_mosip)

        context = self._resolve_event(context)    # Phase 0, Extra
        context = self._verify_identity(context)  # Phase 0, Steps 3-4
        context = self._create_ticket(context)    # Phase 0, Step 5

        assert context.ticket_id is not None
        assert context.link_id is not None
        assert context.created_at is not None

        return IssueResponse(
            ticket_id=context.ticket_id,
            link_id=context.link_id,
            status=TicketStatusEnum.UNUSED,
            created_at=context.created_at,
        )

    # ------------------------------------------------------------------
    # Context initialization
    # ------------------------------------------------------------------

    def _init_context(self, qr_payload: str, event_id: uuid.UUID, stub_mosip: bool = False) -> IssueContext:
        return IssueContext(
            qr_payload=qr_payload,
            event_id=event_id,
            stub_mosip=stub_mosip,
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
                "issue denied: trace_id=%s event_id=%s reason=EVENT_NOT_FOUND",
                get_trace_id(),
                ctx.event_id,
            )

            return self._abort(404, "event_not_found")

        if event.status not in (EventStatusEnum.SCHEDULED, EventStatusEnum.ACTIVE):
            logger.warning(
                "issue denied: trace_id=%s event_id=%s reason=EVENT_NOT_ACCEPTING_TICKETS event_status=%s",
                get_trace_id(),
                ctx.event_id,
                event.status.value,
            )

            return self._abort(409, "event_not_accepting_tickets")

        return ctx

    # ------------------------------------------------------------------
    # Pipeline Phase 0, Steps 3-4
    # ------------------------------------------------------------------

    def _verify_identity(self, ctx: IssueContext) -> IssueContext:
        """
        Forward the QR payload to MOSIP. On success, store the PSUT and compute the link_hash that will bind this identity to the event.
        """
    
        demo = DemoLogger(event_id=ctx.event_id)

        identity_svc = IdentityService.for_context(stub=ctx.stub_mosip)

        if ctx.stub_mosip:
            logger.info("stubbing mosip verification for trace_id=%s", get_trace_id())

        try:
            verified = identity_svc.verify(ctx.qr_payload)

        except MOSIPUnavailableError:
            logger.error(
                "issue error: trace_id=%s event_id=%s reason=MOSIP_UNAVAILABLE",
                get_trace_id(),
                ctx.event_id,
            )

            return self._abort(503, "mosip_unavailable")

        if verified is None:
            demo.sig_failed(uin=_extract_uin_for_demo(ctx.qr_payload))

            logger.warning(
                "issue denied: trace_id=%s event_id=%s reason=IDENTITY_NOT_VERIFIED",
                get_trace_id(),
                ctx.event_id,
            )

            return self._abort(400, "identity_not_verified")

        ctx.uin = verified.uin
        ctx.psut = verified.psut
        ctx.link_hash = identity_svc.compute_link_hash(ctx.uin, ctx.event_id) # PAUL: TEMPORARY: REPLACE WITH UIN BECAUSE THE SERVER IS SHIT

        demo.uin_verified_psut_issued(ctx.uin, ctx.psut)

        return ctx

    # ------------------------------------------------------------------
    # Pipeline Phase 0, Step 5
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

            if constraint and "link_hash" in constraint:
                logger.warning(
                    "issue denied: trace_id=%s event_id=%s reason=TICKET_ALREADY_ISSUED constraint=%s",
                    get_trace_id(),
                    ctx.event_id,
                    constraint,
                )

                return self._abort(409, "ticket_already_issued")

            logger.error(
                "issue error: trace_id=%s event_id=%s reason=PERSISTENCE_FAILED "
                "error_type=%s constraint=%s error=%s",
                get_trace_id(),
                ctx.event_id,
                type(exc).__name__,
                constraint,
                short_error_message(exc),
            )

            return self._abort(500, "internal_server_error")

        except SQLAlchemyError as exc:
            self.db.rollback()

            logger.error(
                "issue error: trace_id=%s event_id=%s reason=PERSISTENCE_FAILED "
                "error_type=%s error=%s",
                get_trace_id(),
                ctx.event_id,
                type(exc).__name__,
                short_error_message(exc),
            )

            return self._abort(500, "internal_server_error")

        logger.info(
            "issue succeeded: trace_id=%s event_id=%s ticket_id=%s link_id=%s stubbed=%s",
            get_trace_id(),
            ctx.event_id,
            ticket.ticket_id,
            link.link_id,
            ctx.stub_mosip,
        )

        DemoLogger(event_id=ctx.event_id).ticket_issued(ctx.uin, ctx.psut, ticket.ticket_id)

        ctx.link_id = link.link_id
        ctx.ticket_id = ticket.ticket_id
        ctx.created_at = ticket.created_at

        return ctx

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _abort(self, status_code: int, detail: str) -> IssueContext:
        raise IssueError(status_code=status_code, detail=detail)


def _extract_uin_for_demo(qr_payload: str) -> str | None:
    """
    UIN extraction from the raw QR payload for demo logging.

    Only used on the failure path where MOSIP returned None, so the payload has not been validated; we catch all parse errors silently.
    """

    try:
        parsed = json.loads(qr_payload)
        if isinstance(parsed, dict) and "uin" in parsed:
            return str(cast(dict[str, Any], parsed)["uin"])

    except (json.JSONDecodeError, TypeError):
        pass

    return None