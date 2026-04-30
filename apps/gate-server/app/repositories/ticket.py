import uuid

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.models.enums import TicketStatusEnum
from app.models.event_ticket_link import EventTicketLink
from app.models.ticket import Ticket


class TicketRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def find_link(self, event_id: uuid.UUID, link_hash: str) -> EventTicketLink | None:
        """
        Look up an EventTicketLink by event and recomputed hash.
        """

        return self.db.scalar(
            select(EventTicketLink)
            .where(
                EventTicketLink.event_id == event_id,
                EventTicketLink.link_hash == link_hash,
            )
            .limit(1)
        )

    def find_ticket_by_link(self, link_id: uuid.UUID) -> Ticket | None:
        """
        Retrieve the ticket associated with a given EventTicketLink.
        """

        return self.db.scalar(
            select(Ticket).where(Ticket.link_id == link_id).limit(1)
        )

    def create_link(self, event_id: uuid.UUID, link_hash: str) -> EventTicketLink:
        link = EventTicketLink(
            event_id=event_id, 
            link_hash=link_hash
        )

        self.db.add(link)
        self.db.flush()

        return link

    def create_ticket(self, event_id: uuid.UUID, link_id: uuid.UUID) -> Ticket:
        """
        Persist a new UNUSED Ticket associated with the given link.
        """

        ticket = Ticket(
            event_id=event_id,
            link_id=link_id,
            status=TicketStatusEnum.UNUSED,
        )

        self.db.add(ticket)

        return ticket

    def mark_used(self, ticket_id: uuid.UUID) -> bool:
        """
        Mark a ticket as used.

        Returns True if the row was updated or False if the ticket was already used.
        """

        result = self.db.execute(
            update(Ticket)
            .where(
                Ticket.ticket_id == ticket_id,
                Ticket.status == TicketStatusEnum.UNUSED,
            )
            .values(
                status=TicketStatusEnum.USED, 
                used_at=func.now()
            )
        )

        return result.rowcount > 0
