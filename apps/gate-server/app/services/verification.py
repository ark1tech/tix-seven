from app.adapters.mosip import MOSIPAdapter, RealMOSIPAdapter
from app.core.crypto import hash_uin
from app.models.enums import ResultEnum, TicketStatusEnum
from app.models.eventticketlink import EventTicketLink
from app.models.gate import Gate
from app.models.log import Log
from app.models.schemas import DenialReason, VerifyResponse
from app.models.ticket import Ticket
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session
import uuid


class VerificationService:
    def __init__(self, db: Session, mosip: MOSIPAdapter | None = None):
        self.db = db
        self.mosip = mosip or RealMOSIPAdapter()

    def verify(self, qr_payload: str, gate_id: str) -> VerifyResponse:
        try:
            result = self.mosip.verify(qr_payload)
            if not result.verified or not result.uin:
                self._log(gate_id, None, ResultEnum.DENY, DenialReason.invalid_id)
                self.db.commit()
                return VerifyResponse(result="deny", reason=DenialReason.invalid_id)

            uin_hash = hash_uin(result.uin)
            event_id = self._get_event_id_for_gate(gate_id)
            if event_id is None:
                self._log(gate_id, uin_hash, ResultEnum.DENY, DenialReason.wrong_event)
                self.db.commit()
                return VerifyResponse(result="deny", reason=DenialReason.wrong_event)

            ticket = self._find_ticket(event_id, uin_hash)
            if ticket is None:
                self._log(gate_id, uin_hash, ResultEnum.DENY, DenialReason.no_ticket, event_id)
                self.db.commit()
                return VerifyResponse(result="deny", reason=DenialReason.no_ticket)

            if ticket.status == TicketStatusEnum.USED:
                self._log(
                    gate_id,
                    uin_hash,
                    ResultEnum.DENY,
                    DenialReason.already_used,
                    event_id,
                    ticket.ticket_id,
                )
                self.db.commit()
                return VerifyResponse(result="deny", reason=DenialReason.already_used)

            was_updated = self._mark_used(ticket.ticket_id)
            if not was_updated:
                self._log(
                    gate_id,
                    uin_hash,
                    ResultEnum.DENY,
                    DenialReason.already_used,
                    event_id,
                    ticket.ticket_id,
                )
                self.db.commit()
                return VerifyResponse(result="deny", reason=DenialReason.already_used)

            self._log(gate_id, uin_hash, ResultEnum.GRANT, None, event_id, ticket.ticket_id)
            self.db.commit()
            return VerifyResponse(result="grant", ticket_id=str(ticket.ticket_id))
        except Exception:
            self.db.rollback()
            raise

    def _get_event_id_for_gate(self, gate_id: str) -> uuid.UUID | None:
        gate_uuid = self._to_uuid(gate_id)
        if gate_uuid is None:
            return None
        stmt = select(Gate.event_id).where(Gate.gate_id == gate_uuid)
        return self.db.scalar(stmt)

    def _find_ticket(self, event_id: uuid.UUID, uin_hash: str) -> Ticket | None:
        stmt = (
            select(Ticket)
            .join(EventTicketLink, Ticket.link_id == EventTicketLink.link_id)
            .where(
                EventTicketLink.event_id == event_id,
                EventTicketLink.link_hash == uin_hash,
            )
            .limit(1)
        )
        return self.db.scalar(stmt)

    def _mark_used(self, ticket_id: uuid.UUID) -> bool:
        stmt = (
            update(Ticket)
            .where(Ticket.ticket_id == ticket_id, Ticket.status == TicketStatusEnum.UNUSED)
            .values(status=TicketStatusEnum.USED, used_at=func.now())
        )
        result = self.db.execute(stmt)
        return result.rowcount == 1

    def _log(
        self,
        gate_id: str,
        uin_hash: str | None,
        result: ResultEnum,
        denial_reason: DenialReason | None,
        event_id: uuid.UUID | None = None,
        ticket_id: uuid.UUID | None = None,
    ) -> None:
        gate_uuid = self._to_uuid(gate_id)
        if gate_uuid is None:
            return
        self.db.add(
            Log(
                gate_id=gate_uuid,
                event_id=event_id,
                ticket_id=ticket_id,
                result=result,
                reason=denial_reason.value if denial_reason else None,
                uin_hash=uin_hash,
            )
        )

    def _to_uuid(self, raw_value: str) -> uuid.UUID | None:
        try:
            return uuid.UUID(raw_value)
        except (TypeError, ValueError):
            return None
