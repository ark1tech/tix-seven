import uuid

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.enums import TicketStatusEnum
from app.models.event import Event
from app.models.event_ticket_link import EventTicketLink
from app.models.schemas import IssueContext, IssueResponse
from app.models.ticket import Ticket
from app.services.identity import IdentityService


class IssuanceService:
    def __init__(self, db: Session, identity: IdentityService | None = None):
        self.db = db
        self.identity = identity or IdentityService()

    def issue(self, qr_payload: str, event_id: uuid.UUID) -> IssueResponse:
        """
        Entry point.
        Runs the server-side issuance pipeline.
        """

        context = self._init_context(qr_payload, event_id)

        context = self._resolve_event(context)    # Pipeline Phase 0, Extra Step
        context = self._verify_identity(context)  # Pipeline Phase 0, Step 3-4
        context = self._create_link(context)      # Pipeline Phase 0, Step 5.1
        context = self._create_ticket(context)    # Pipeline Phase 0, Step 5.2

        assert context.ticket_id is not None
        assert context.link_id is not None
        assert context.created_at is not None

        return IssueResponse(
            ticket_id=context.ticket_id,
            link_id=context.link_id,
            status=TicketStatusEnum.UNUSED.value,
            created_at=context.created_at,
        )

    # Context initialisation
    def _init_context(self, qr_payload: str, event_id: uuid.UUID) -> IssueContext:
        return IssueContext(
            qr_payload=qr_payload,
            event_id=event_id,
        )

    # ------------------------------------------------------------------
    # Pipeline Phase 0, Extra Step

    # Confirm the target event exists before issuing any ticket against it.
    # ------------------------------------------------------------------

    def _resolve_event(self, ctx: IssueContext) -> IssueContext:
        stmt = select(Event).where(Event.event_id == ctx.event_id)

        if self.db.scalar(stmt) is None:
            raise HTTPException(status_code=404, detail="event_not_found")

        return ctx

    # ------------------------------------------------------------------
    # Pipeline Phase 0, Step 3-4

    # Forward the QR payload to the MOSIP Testbed and confirm the identity is valid and active.
    # Both a verified flag and a non-null PSUT are needed to continue.
    # ------------------------------------------------------------------

    def _verify_identity(self, ctx: IssueContext) -> IssueContext:
        verified = self.identity.verify(ctx.qr_payload)

        if verified is None:
            raise HTTPException(status_code=400, detail="identity_not_verified")

        ctx.psut = verified.psut

        return ctx

    # ------------------------------------------------------------------
    # Pipeline Phase 0, Step 5.1

    # Compute link_hash = HMAC-SHA256(pepper, "{psut}:{event_id}") and persist a new EventTicketLink row.
    # The UNIQUE constraint on link_hash prevents a second ticket being issued for the same identity + event.
    # ------------------------------------------------------------------

    def _create_link(self, ctx: IssueContext) -> IssueContext:
        assert ctx.psut is not None

        ctx.link_hash = self.identity.compute_link_hash(ctx.psut, ctx.event_id)

        link = EventTicketLink(event_id=ctx.event_id, link_hash=ctx.link_hash)

        self.db.add(link)

        try:
            self.db.flush()

        except IntegrityError:
            raise HTTPException(status_code=409, detail="ticket_already_issued") from None

        ctx.link_id = link.link_id

        return ctx

    # ------------------------------------------------------------------
    # Pipeline Phase 0, Step 5.2

    # Create the Ticket row then commit the transaction afterward.
    # ------------------------------------------------------------------

    def _create_ticket(self, ctx: IssueContext) -> IssueContext:
        ticket = Ticket(
            link_id=ctx.link_id,
            event_id=ctx.event_id,
            status=TicketStatusEnum.UNUSED,
        )

        self.db.add(ticket)
        self.db.commit()

        ctx.ticket_id = ticket.ticket_id
        ctx.created_at = ticket.created_at

        return ctx