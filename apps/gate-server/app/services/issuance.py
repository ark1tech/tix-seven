import logging
import re
import uuid

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.adapters.mosip import MOSIPUnavailableError
from app.core.trace import get_trace_id
from app.models.enums import TicketStatusEnum
from app.models.event import Event
from app.models.event_ticket_link import EventTicketLink
from app.models.schemas import IssueContext, IssueResponse
from app.models.ticket import Ticket
from app.services.identity import IdentityService


logger = logging.getLogger(__name__)

_CONSTRAINT_NAME_RE = re.compile(r'constraint "([^"]+)"', re.IGNORECASE)


def _short_error_message(exc: BaseException, limit: int = 400) -> str:
    text = str(exc).replace("\n", " ").strip()
    if len(text) > limit:
        return f"{text[: limit - 3]}..."
    return text


def _integrity_constraint_label(exc: IntegrityError) -> str | None:
    """Best-effort Postgres constraint name without logging parameters or hashes."""
    orig = getattr(exc, "orig", None)
    if orig is not None:
        diag = getattr(orig, "diag", None)
        if diag is not None:
            name = getattr(diag, "constraint_name", None)
            if name:
                return str(name)
    match = _CONSTRAINT_NAME_RE.search(str(exc))
    if match:
        return match.group(1)
    return None


class IssuanceService:
    def __init__(self, db: Session, identity: IdentityService | None = None):
        self.db = db
        self.identity = identity or IdentityService()

    def issue(self, qr_payload: str, event_id: uuid.UUID) -> IssueResponse:
        """
        Entry point.
        Runs the server-side issuance pipeline.
        """

        trace_id = get_trace_id()
        logger.info(
            "issue pipeline start: trace_id=%s event_id=%s qr_payload_bytes=%s",
            trace_id,
            event_id,
            len(qr_payload.encode("utf-8")),
        )
        context = self._init_context(qr_payload, event_id)

        logger.info("issue stage: trace_id=%s step=resolve_event", trace_id)
        context = self._resolve_event(context)  # Pipeline Phase 0, Extra Step
        logger.info("issue stage: trace_id=%s step=verify_identity", trace_id)
        context = self._verify_identity(context)  # Pipeline Phase 0, Step 3-4
        logger.info("issue stage: trace_id=%s step=create_ticket_transaction", trace_id)
        context = self._create_ticket_transaction(context)  # Pipeline Phase 0, Step 5

        assert context.ticket_id is not None
        assert context.link_id is not None
        assert context.created_at is not None

        return IssueResponse(
            ticket_id=context.ticket_id,
            link_id=context.link_id,
            status="UNUSED",
            created_at=context.created_at,
        )

    # Context initialisation
    def _init_context(self, qr_payload: str, event_id: uuid.UUID) -> IssueContext:
        return IssueContext(
            qr_payload=qr_payload,
            event_id=event_id,
        )

    def _resolve_event(self, ctx: IssueContext) -> IssueContext:
        stmt = select(Event).where(Event.event_id == ctx.event_id)

        if self.db.scalar(stmt) is None:
            logger.warning(
                "issue failed: reason=event_not_found status_code=404 trace_id=%s event_id=%s",
                get_trace_id(),
                ctx.event_id,
            )
            raise HTTPException(status_code=404, detail="event_not_found")

        return ctx

    def _verify_identity(self, ctx: IssueContext) -> IssueContext:
        try:
            verified = self.identity.verify(ctx.qr_payload)
        except MOSIPUnavailableError as exc:
            logger.error(
                "issue failed: reason=mosip_unavailable status_code=503 trace_id=%s event_id=%s",
                get_trace_id(),
                ctx.event_id,
            )
            raise HTTPException(
                status_code=503, detail="mosip_unavailable"
            ) from exc

        if verified is None:
            logger.warning(
                "issue failed: reason=identity_not_verified status_code=400 trace_id=%s event_id=%s",
                get_trace_id(),
                ctx.event_id,
            )
            raise HTTPException(status_code=400, detail="identity_not_verified")

        ctx.psut = verified.psut

        return ctx

    def _create_ticket_transaction(self, ctx: IssueContext) -> IssueContext:
        assert ctx.psut is not None

        ctx.link_hash = self.identity.compute_link_hash(ctx.psut, ctx.event_id)

        link = EventTicketLink(event_id=ctx.event_id, link_hash=ctx.link_hash)
        ticket = Ticket(
            link_id=None,
            event_id=ctx.event_id,
            status=TicketStatusEnum.UNUSED,
        )

        stage = "link"
        try:
            self.db.add(link)
            self.db.flush()

            ticket.link_id = link.link_id
            stage = "ticket"
            self.db.add(ticket)
            self.db.commit()

        except IntegrityError as exc:
            self.db.rollback()
            if stage == "link":
                constraint = _integrity_constraint_label(exc)
                if constraint:
                    logger.warning(
                        "issue failed: reason=ticket_already_issued "
                        "status_code=409 trace_id=%s event_id=%s constraint=%s",
                        get_trace_id(),
                        ctx.event_id,
                        constraint,
                    )
                else:
                    logger.warning(
                        "issue failed: reason=ticket_already_issued "
                        "status_code=409 trace_id=%s event_id=%s",
                        get_trace_id(),
                        ctx.event_id,
                    )
                raise HTTPException(
                    status_code=409, detail="ticket_already_issued"
                ) from None

            logger.error(
                "issue failed: reason=persistence_failed status_code=500 "
                "trace_id=%s event_id=%s stage=%s error_type=%s error=%s",
                get_trace_id(),
                ctx.event_id,
                stage,
                type(exc).__name__,
                _short_error_message(exc),
            )
            raise HTTPException(
                status_code=500, detail="internal_server_error"
            ) from exc

        except SQLAlchemyError as exc:
            self.db.rollback()
            logger.error(
                "issue failed: reason=persistence_failed status_code=500 "
                "trace_id=%s event_id=%s stage=%s error_type=%s error=%s",
                get_trace_id(),
                ctx.event_id,
                stage,
                type(exc).__name__,
                _short_error_message(exc),
            )
            raise HTTPException(
                status_code=500, detail="internal_server_error"
            ) from exc

        logger.info(
            "issue succeeded: trace_id=%s event_id=%s ticket_id=%s link_id=%s status_code=201",
            get_trace_id(),
            ctx.event_id,
            ticket.ticket_id,
            link.link_id,
        )

        ctx.link_id = link.link_id
        ctx.ticket_id = ticket.ticket_id
        ctx.created_at = ticket.created_at

        return ctx
