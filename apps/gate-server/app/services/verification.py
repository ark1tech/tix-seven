import logging

from sqlalchemy.orm import Session

from app.adapters.mosip import MOSIPUnavailableError
from app.core.utils import parse_uuid
from app.models.enums import (
    DenialReasonEnum,
    EventStatusEnum,
    GateStatusEnum,
    ResultEnum,
    TicketStatusEnum,
)
from app.models.log import Log
from app.models.schemas import VerifyContext, VerifyResponse
from app.repositories.event import EventRepository
from app.repositories.gate import GateRepository
from app.repositories.ticket import TicketRepository
from app.services.identity import IdentityService

logger = logging.getLogger(__name__)


class _DenySignal(Exception):
    """
    Internal sentinel raised by _deny() to unwind the pipeline.

    Using a dedicated type instead of bare Exception lets the outer handler distinguish a controlled denial from a genuine unhandled error, so each is logged at the appropriate level.
    """


class VerificationService:
    def __init__(
        self,
        db: Session,
        identity: IdentityService | None = None,
        gates: GateRepository | None = None,
        events: EventRepository | None = None,
        tickets: TicketRepository | None = None,
    ) -> None:
        self.db = db
        self.identity = identity or IdentityService()
        self.gates = gates or GateRepository(db)
        self.events = events or EventRepository(db)
        self.tickets = tickets or TicketRepository(db)

    def verify(self, qr_payload: str, gate_id: str, stub_mosip: bool = False) -> VerifyResponse:
        """
        Entry point. Runs the server-side validation pipeline (Phase 2) and writes a log row before returning.
        """

        context = self._init_context(qr_payload, gate_id, stub_mosip)

        try:
            context = self._resolve_gate_and_event(context)  # Phase 2, Step 1
            context = self._verify_identity(context)         # Phase 2, Steps 2-3
            context = self._resolve_ticket(context)          # Phase 2, Steps 4-5
            context = self._grant(context)                   # Phase 2, Step 6

            self._write_log(context)
            self.db.commit()

        except _DenySignal:
            # Controlled Denial: result and denial_reason are already set
            self.db.rollback()

        except Exception:
            # Unhandled Error: log at ERROR level and return a safe denial
            logger.exception(
                "verify unhandled error: gate_id=%s",
                context.gate_id,
            )

            context.result = ResultEnum.ERROR
            context.denial_reason = DenialReasonEnum.INTERNAL_SERVER_ERROR
            context.response = VerifyResponse(
                result="deny",
                reason=DenialReasonEnum.INTERNAL_SERVER_ERROR,
            )

            # Satisfy check_ticket_absent_on_system_failure: if result is ERROR, ticket_id must be NULL
            context.ticket_id = None
            context.ticket_status_snapshot = None

            self.db.rollback()

        self._write_log(context)
        self.db.commit()

        assert context.response is not None

        return context.response

    # Context initialization
    def _init_context(self, qr_payload: str, gate_id: str, stub_mosip: bool) -> VerifyContext:
        return VerifyContext(
            qr_payload=qr_payload,
            gate_id=gate_id,
            stub_mosip=stub_mosip,
        )

    # ------------------------------------------------------------------
    # Pipeline Phase 2, Step 1
    # ------------------------------------------------------------------

    def _resolve_gate_and_event(self, ctx: VerifyContext) -> VerifyContext:
        """
        Validate the gate_id, confirm the gate is ONLINE, and resolve the currently active GateAssignment to obtain event_id.
        """

        gate_uuid = parse_uuid(ctx.gate_id)

        if gate_uuid is None:
            # Malformed gate_id is a system or a configuration fault
            return self._deny(ctx, DenialReasonEnum.INVALID_GATE_ID)

        ctx.gate_uuid = gate_uuid
    
        gate = self.gates.get_by_id(gate_uuid)

        if gate is None:
            return self._deny(ctx, DenialReasonEnum.INVALID_GATE_ID)

        if gate.status == GateStatusEnum.OFFLINE:
            # Gate exists but is not accepting scans (Paul: trivial)
            return self._deny(ctx, DenialReasonEnum.GATE_OFFLINE)

        assignment = self.gates.get_active_assignment_and_event_ids(gate_uuid)

        if assignment is None:
            return self._deny(ctx, DenialReasonEnum.INVALID_GATE_ASSIGNMENT)

        assignment_id, event_id = assignment

        event = self.events.get_by_id(event_id)

        if event is None:
            # Data integrity issue wherein an active assignment references a non-existent event
            return self._deny(ctx, DenialReasonEnum.EVENT_NOT_FOUND)

        if event.status not in (EventStatusEnum.SCHEDULED, EventStatusEnum.ACTIVE):
            # Only ACTIVE and SCHEDULED events accept scans

            # A.K.A. you cannot go to an event that is done
            if event.status == EventStatusEnum.CONCLUDED:
                return self._deny(ctx, DenialReasonEnum.EVENT_CONCLUDED)

            else:
                return self._deny(ctx, DenialReasonEnum.EVENT_CANCELLED)

        ctx.assignment_id = assignment_id
        ctx.event_id = event_id

        ctx.gate_location_snapshot = gate.location
        ctx.event_name_snapshot = event.name

        return ctx

    # ------------------------------------------------------------------
    # Pipeline Phase 2, Steps 2-4
    # ------------------------------------------------------------------

    def _verify_identity(self, ctx: VerifyContext) -> VerifyContext:
        """
        Forward the QR payload to MOSIP. On success, store the PSUT and compute the link_hash that will be used to look up the ticket.
        """

        identity_svc = self.identity

        if ctx.stub_mosip:
            from app.adapters.mosip import StubMOSIPAdapter
            from app.services.identity import IdentityService
            from app.core.trace import get_trace_id
            
            logger.info("stubbing mosip verification for trace_id=%s", get_trace_id())
            identity_svc = IdentityService(mosip=StubMOSIPAdapter())

        try:
            verified = identity_svc.verify(ctx.qr_payload)

        except MOSIPUnavailableError:
            return self._deny(ctx, DenialReasonEnum.SERVER_TIMEOUT)

        if verified is None:
            return self._deny(ctx, DenialReasonEnum.IDENTITY_NOT_VERIFIED)

        ctx.uin = verified.uin
        ctx.psut = verified.psut

        # Compute the link hash now that both PSUT and event_id are known
        # link_hash = HMAC-SHA256(pepper, "{psut}:{event_id}")

        assert ctx.event_id is not None

        ctx.link_hash = identity_svc.compute_link_hash(ctx.psut, ctx.event_id)

        return ctx

    # ------------------------------------------------------------------
    # Pipeline Phase 2, Steps 5-6
    # ------------------------------------------------------------------

    def _resolve_ticket(self, ctx: VerifyContext) -> VerifyContext:
        """
        Look up the EventTicketLink by the recomputed hash, then validate the associated ticket.
        """

        assert ctx.event_id is not None
        assert ctx.link_hash is not None

        link = self.tickets.find_link(ctx.event_id, ctx.link_hash)

        if link is None:
            # No purchase record found for this identity and event
            return self._deny(ctx, DenialReasonEnum.LINK_NOT_FOUND)

        ctx.link_id = link.link_id

        ticket = self.tickets.find_ticket_by_link(ctx.link_id)

        if ticket is None:
            # Data integrity issue wherein a link exists but no ticket is associated
            return self._deny(ctx, DenialReasonEnum.TICKET_NOT_FOUND)

        ctx.ticket_id = ticket.ticket_id
        ctx.ticket_status_snapshot = ticket.status.value

        if ticket.status == TicketStatusEnum.USED:
            return self._deny(ctx, DenialReasonEnum.TICKET_ALREADY_USED)

        return ctx

    # ------------------------------------------------------------------
    # Pipeline Phase 2, Step 7
    # ------------------------------------------------------------------

    def _grant(self, ctx: VerifyContext) -> VerifyContext:
        """
        Mark the ticket as used.

        The UPDATE is conditional on status = UNUSED so that a race between two concurrent scans of the same ticket can only succeed once.
        """

        assert ctx.ticket_id is not None

        updated = self.tickets.mark_used(ctx.ticket_id)

        if not updated:
            # Another request won the race between our read and this write
            ctx.ticket_status_snapshot = TicketStatusEnum.USED.value

            # Paul: Technically, this could also be TICKET_NOT_FOUND if the ticket was deleted after we read it, but that should never happen in a sane system so treat it as already used
            return self._deny(ctx, DenialReasonEnum.TICKET_ALREADY_USED)

        ctx.result = ResultEnum.GRANTED
        ctx.response = VerifyResponse(
            result="grant",
            ticket_id=ctx.ticket_id,
        )

        return ctx

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _deny(self, ctx: VerifyContext, reason: DenialReasonEnum) -> VerifyContext:
        """
        Record a denied result on the context and raise _DenySignal to unwind the pipeline.
        """

        ctx.result = ResultEnum.DENIED
        ctx.denial_reason = reason
        ctx.response = VerifyResponse(result="deny", reason=reason)

        logger.warning(
            "verify denied: gate_id=%s event_id=%s reason=%s",
            ctx.gate_id,
            ctx.event_id,
            reason.value,
        )

        raise _DenySignal(reason)

    def _write_log(self, ctx: VerifyContext) -> None:
        """
        Write a log for this scan attempt. Always called regardless of outcome.

        gate_uuid may be None if the raw gate_id failed to parse.
        """

        assert ctx.result is not None

        self.db.add(
            Log(
                raw_gate_id_snapshot=ctx.gate_id,
                gate_id=ctx.gate_uuid,
                gate_location_snapshot=ctx.gate_location_snapshot,
                event_id=ctx.event_id,
                event_name_snapshot=ctx.event_name_snapshot,
                assignment_id=ctx.assignment_id,
                ticket_id=ctx.ticket_id,
                ticket_status_snapshot=ctx.ticket_status_snapshot,
                result=ctx.result,
                denial_reason=ctx.denial_reason,
            )
        )
