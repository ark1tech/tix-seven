from app.adapters.mosip import MOSIPAdapter, RealMOSIPAdapter
from app.adapters.supabase_client import get_supabase_client
from app.core.crypto import hash_uin
from app.models.schemas import DenialReason, VerifyResponse


class VerificationService:
    def __init__(self, mosip: MOSIPAdapter | None = None):
        self.mosip = mosip or RealMOSIPAdapter()
        self.db = get_supabase_client()

    def verify(self, qr_payload: str, gate_id: str) -> VerifyResponse:
        # Step 1: Verify PhilSys QR signature via MOSIP
        result = self.mosip.verify(qr_payload)
        if not result.verified or not result.uin:
            self._log(gate_id, None, "deny", DenialReason.invalid_id)
            return VerifyResponse(result="deny", reason=DenialReason.invalid_id)

        uin_hash = hash_uin(result.uin)

        # Step 2: Resolve which event this gate is assigned to
        # TODO: implement gate → event lookup
        event_id = self._get_event_id_for_gate(gate_id)
        if event_id is None:
            # Gate is not assigned — deny conservatively
            self._log(gate_id, uin_hash, "deny", DenialReason.wrong_event)
            return VerifyResponse(result="deny", reason=DenialReason.wrong_event)

        # Step 3: Look up ticket
        # TODO: implement ticket lookup, status check, and mark-used
        ticket = self._find_ticket(event_id, uin_hash)
        if ticket is None:
            self._log(gate_id, uin_hash, "deny", DenialReason.no_ticket, event_id)
            return VerifyResponse(result="deny", reason=DenialReason.no_ticket)

        if ticket["status"] == "used":
            self._log(gate_id, uin_hash, "deny", DenialReason.already_used, event_id)
            return VerifyResponse(result="deny", reason=DenialReason.already_used)

        # Step 4: Mark ticket as used and log the grant
        # TODO: implement atomic mark-used + log in a single DB transaction
        self._mark_used(ticket["id"])
        self._log(gate_id, uin_hash, "grant", None, event_id, ticket["id"])
        return VerifyResponse(result="grant", ticket_id=ticket["id"])

    # ── Private helpers (TODO: implement each) ─────────────────────────────

    def _get_event_id_for_gate(self, gate_id: str) -> str | None:
        # TODO: query gates table for event_id
        return None

    def _find_ticket(self, event_id: str, uin_hash: str) -> dict | None:
        # TODO: query tickets table for matching event_id + uin_hash
        return None

    def _mark_used(self, ticket_id: str) -> None:
        # TODO: update tickets set status = 'used' where id = ticket_id
        pass

    def _log(
        self,
        gate_id: str,
        uin_hash: str | None,
        result: str,
        denial_reason: DenialReason | None,
        event_id: str | None = None,
        ticket_id: str | None = None,
    ) -> None:
        # TODO: insert row into entry_logs
        pass
