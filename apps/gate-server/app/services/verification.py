from app.adapters.mosip import MOSIPAdapter, MOSIPUnavailableError, RealMOSIPAdapter
from app.core.crypto import hash_psut
from app.models.enums import (
    AssignmentStatusEnum,
    DenialReasonEnum,
    ResultEnum,
    TicketStatusEnum,
)
from app.models.event_ticket_link import EventTicketLink
from app.models.gate_assignment import GateAssignment
from app.models.log import Log
from app.models.schemas import VerifyContext, VerifyResponse
from app.models.ticket import Ticket
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session
import uuid

# Hardcoded PSUT used in place of a real MOSIP-issued token during development.
# DEV_PSUT = "DEV_PSUT"


class VerificationService:
    def __init__(self, db: Session, mosip: MOSIPAdapter | None = None):
        self.db = db
        self.mosip = mosip or RealMOSIPAdapter()

    def verify(self, qr_payload: str, gate_id: str) -> VerifyResponse:
        """
        Entry point.
        Runs the server-side validation pipeline and always concludes with a log write before returning.

        On any exception, the transaction is rolled back, a log entry is committed on its own, and a "deny" is returned to the ESP8266.
        """

        context = self._init_context(qr_payload, gate_id)

        try:
            context = self._resolve_gate(context)     # Pipeline Phase 2, Step 1
            context = self._verify_identity(context)  # Pipeline Phase 2, Steps 2-4
            context = self._resolve_ticket(context)   # Pipeline Phase 2, Steps 5-6
            context = self._grant(context)            # Pipeline Phase 2, Step 7

        except Exception:
            # Catch both controlled denials raised by _deny and unexpected errors.

            if context.result is None:
                # Unhandled exception before result was assigned: log as ERROR with reason.
                context.result = ResultEnum.ERROR
                context.denial_reason = DenialReasonEnum.INTERNAL_SERVER_ERROR
                context.response = VerifyResponse(
                    result="deny",
                    reason=context.denial_reason,
                )

            self.db.rollback()
            self._write_log(context)
            self.db.commit()

            return context.response

        # Happy path: log the granted result alongside the committed ticket update.
        self._write_log(context)
        self.db.commit()

        return context.response

    # Context initialisation
    def _init_context(self, qr_payload: str, gate_id: str) -> VerifyContext:
        return VerifyContext(
            qr_payload=qr_payload,
            gate_id=gate_id,
        )

    # ------------------------------------------------------------------
    # Pipeline Phase 2, Step 1

    # The intermediary server identifies which event_id is currently assigned to the gate that submitted the scan.
    # ------------------------------------------------------------------

    def _resolve_gate(self, ctx: VerifyContext) -> VerifyContext:
        gate_uuid = self._to_uuid(ctx.gate_id)

        if gate_uuid is None:
            # Malformed gate_id is a system/configuration fault, not a wrong event.
            return self._deny(
                ctx, DenialReasonEnum.INVALID_GATE_ID, "DENY_INVALID_GATE_ID"
            )

        assignment = self._get_active_assignment(gate_uuid)

        if assignment is None:
            # No active GateAssignment found for this gate. The gate may be offline or not yet assigned to an event.
            return self._deny(ctx, DenialReasonEnum.INVALID_GATE_ASSIGNMENT, "DENY_INVALID_GATE_ASSIGNMENT")

        ctx.assignment_id, ctx.event_id = assignment

        return ctx

    # ------------------------------------------------------------------
    # Pipeline Phase 2, Steps 2-4

    # The server forwards the UIN to the MOSIP Testbed for validation.

    # If verification succeeds, MOSIP returns the PSUT for the identity, and then the system computes the link_hash.
    # ------------------------------------------------------------------

    def _verify_identity(self, ctx: VerifyContext) -> VerifyContext:
        try:
            mosip_result = self.mosip.verify(ctx.qr_payload)
        except MOSIPUnavailableError:
            return self._deny(ctx, DenialReasonEnum.SERVER_TIMEOUT, "DENY_MOSIP_UNAVAILABLE")

        # Otherwise, the server commits a denied result in the Log table and issues a “DENY” command to the ESP8266.
        if not mosip_result.verified or not mosip_result.uin:
            return self._deny(
                ctx, DenialReasonEnum.IDENTITY_NOT_VERIFIED, "DENY_IDENTITY"
            )

        ctx.uin = mosip_result.uin

        # ctx.psut = DEV_PSUT
        ctx.psut = mosip_result.psut

        # Compute the link hash now that both PSUT and event_id are known.
        # link_hash = HMAC-SHA256(pepper, "{psut}:{event_id}")
        ctx.link_hash = hash_psut(ctx.psut, str(ctx.event_id))

        return ctx

    # ------------------------------------------------------------------
    # Pipeline Phase 2, Steps 5-6

    # The server queries the EventTicketLink table for a record matching the recomputed link_hash, then validates the associated ticket.
    # ------------------------------------------------------------------

    def _resolve_ticket(self, ctx: VerifyContext) -> VerifyContext:
        link = self._find_link(ctx.event_id, ctx.link_hash)

        if link is None:
            return self._deny(
                ctx, DenialReasonEnum.LINK_NOT_FOUND, "DENY_LINK_NOT_FOUND"
            )

        ctx.link_id = link.link_id

        ticket = self._find_ticket(ctx.link_id)

        if ticket is None:
            return self._deny(
                ctx, DenialReasonEnum.TICKET_NOT_FOUND, "DENY_TICKET_NOT_FOUND"
            )

        if ticket.status == TicketStatusEnum.USED:
            return self._deny(
                ctx, DenialReasonEnum.TICKET_ALREADY_USED, "DENY_TICKET_ALREADY_USED"
            )

        ctx.ticket_id = ticket.ticket_id

        return ctx

    # ------------------------------------------------------------------
    # Pipeline Phase 2, Step 7
    #
    # The UPDATE is conditional on status = UNUSED so that a race between two concurrent scans of the same ticket can only succeed once.
    # ------------------------------------------------------------------

    def _grant(self, ctx: VerifyContext) -> VerifyContext:
        updated = self._mark_used(ctx.ticket_id)

        if not updated:
            # Another request marked the ticket used between our read and this write.
            return self._deny(ctx, DenialReasonEnum.TICKET_ALREADY_USED, "DENY_RACE")

        ctx.result = ResultEnum.GRANTED

        ctx.response = VerifyResponse(
            result="grant",
            ticket_id=str(ctx.ticket_id),
        )

        return ctx

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _write_log(self, ctx: VerifyContext) -> None:
        gate_uuid = self._to_uuid(ctx.gate_id)

        if gate_uuid is None:
            # Cannot write a meaningful log without a valid gate_id.
            return  # MAYBE TODO: Handle better?

        if ctx.event_id is None:
            # Cannot log if gate resolution failed before event_id was populated.
            return  # MAYBE TODO: Handle better?

        self.db.add(
            Log(
                event_id=ctx.event_id,
                gate_id=gate_uuid,
                assignment_id=ctx.assignment_id,
                ticket_id=ctx.ticket_id,  # Null for pre-ticket failures
                result=ctx.result,
                denial_reason=ctx.denial_reason,
                timestamp=func.now(),
            )
        )

    def _deny(
        self,
        ctx: VerifyContext,
        reason: DenialReasonEnum,
        error: str,
    ) -> VerifyContext:
        """
        Set a denied result on the context and raise to unwind the pipeline.
        """

        ctx.result = ResultEnum.DENIED
        ctx.denial_reason = reason
        ctx.response = VerifyResponse(result="deny", reason=reason)

        raise Exception(error)

    def _get_active_assignment(
        self, gate_id: uuid.UUID
    ) -> tuple[uuid.UUID, uuid.UUID] | None:
        """
        Return (assignment_id, event_id) for the gate's current active assignment, or None.
        """

        stmt = select(
            GateAssignment.assignment_id,
            GateAssignment.event_id,
        ).where(
            GateAssignment.gate_id == gate_id,
            GateAssignment.status == AssignmentStatusEnum.ACTIVE,
        )

        return self.db.execute(stmt).first()

    def _find_link(self, event_id: uuid.UUID, link_hash: str) -> EventTicketLink | None:
        """
        Look up the EventTicketLink by event and hash.
        """

        stmt = (
            select(EventTicketLink)
            .where(
                EventTicketLink.event_id == event_id,
                EventTicketLink.link_hash == link_hash,
            )
            .limit(1)
        )

        return self.db.scalar(stmt)

    def _find_ticket(self, link_id: uuid.UUID) -> Ticket | None:
        """
        Retrieve the ticket associated with a given link.
        """

        stmt = select(Ticket).where(Ticket.link_id == link_id).limit(1)

        return self.db.scalar(stmt)

    def _mark_used(self, ticket_id: uuid.UUID) -> bool:
        """
        Atomically mark a ticket as used. The WHERE clause on status = UNUSED ensures only one concurrent request can succeed even under a race condition.

        Returns True if a row was updated, False if the ticket was already used.
        """

        stmt = (
            update(Ticket)
            .where(
                Ticket.ticket_id == ticket_id,
                Ticket.status == TicketStatusEnum.UNUSED,
            )
            .values(status=TicketStatusEnum.USED, used_at=func.now())
        )
        result = self.db.execute(stmt)

        return result.rowcount == 1

    def _to_uuid(self, raw_value: str) -> uuid.UUID | None:
        """
        Parse a UUID string, returning None on failure instead of raising.
        """

        try:
            return uuid.UUID(raw_value)
        except (TypeError, ValueError):
            return None
