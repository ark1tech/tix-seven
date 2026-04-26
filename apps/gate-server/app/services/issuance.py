import uuid

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.adapters.mosip import (
    MOSIPAdapter,
    MOSIPUnavailableError,
    RealMOSIPAdapter,
)
from app.core.crypto import hash_psut
from app.models.enums import TicketStatusEnum
from app.models.event import Event
from app.models.event_ticket_link import EventTicketLink
from app.models.schemas import IssueResponse
from app.models.ticket import Ticket


class IssuanceService:
    def __init__(self, db: Session, mosip: MOSIPAdapter | None = None):
        self.db = db
        self.mosip = mosip or RealMOSIPAdapter()

    def issue(self, qr_payload: str, event_id: uuid.UUID) -> IssueResponse:
        try:
            result = self.mosip.verify(qr_payload)
        except MOSIPUnavailableError as exc:
            raise HTTPException(
                status_code=503, detail="mosip_unavailable"
            ) from exc

        if not result.verified or result.psut is None:
            raise HTTPException(
                status_code=400, detail="identity_not_verified"
            )

        stmt = select(Event).where(Event.event_id == event_id)
        if self.db.scalar(stmt) is None:
            raise HTTPException(status_code=404, detail="event_not_found")

        link_hash = hash_psut(result.psut, str(event_id))
        link = EventTicketLink(event_id=event_id, link_hash=link_hash)
        self.db.add(link)

        try:
            self.db.flush()
        except IntegrityError:
            self.db.rollback()
            raise HTTPException(
                status_code=409, detail="already_issued"
            ) from None

        ticket = Ticket(
            link_id=link.link_id,
            event_id=event_id,
            status=TicketStatusEnum.UNUSED,
        )
        self.db.add(ticket)
        self.db.flush()
        self.db.commit()
        self.db.refresh(ticket)

        return IssueResponse(
            ticket_id=ticket.ticket_id,
            link_id=link.link_id,
            status="UNUSED",
            created_at=ticket.created_at,
        )
