import datetime
from typing import Optional
import uuid

from sqlalchemy import case, func, select, update
from sqlalchemy.orm import InstrumentedAttribute, Session

from app.models.enums import TicketStatusEnum
from app.models.event_ticket_link import EventTicketLink
from app.models.ticket import Ticket
from app.models.schemas import TicketSummary


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

        return self.db.scalar(select(Ticket).where(Ticket.link_id == link_id).limit(1))

    def create_link(self, event_id: uuid.UUID, link_hash: str) -> EventTicketLink:
        link = EventTicketLink(event_id=event_id, link_hash=link_hash)

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
            .values(status=TicketStatusEnum.USED, used_at=func.now())
        )

        return result.rowcount > 0  # type: ignore

    def get_summary(self, event_id: uuid.UUID) -> TicketSummary:
        """
        Return ticket summary counts for an event in one query.
        """

        stmt = select(
            func.count(Ticket.ticket_id).label("total"),
            func.sum(case((Ticket.status == TicketStatusEnum.USED, 1), else_=0)).label(
                "used"
            ),
            func.sum(
                case((Ticket.status == TicketStatusEnum.UNUSED, 1), else_=0)
            ).label("unused"),
        ).where(Ticket.event_id == event_id)

        row = self.db.execute(stmt).one()

        return TicketSummary(
            total=row.total or 0,
            used=row.used or 0,
            unused=row.unused or 0,
        )

    def get_all_tickets_by_event(
        self,
        event_id: uuid.UUID,
        *,
        status: Optional[TicketStatusEnum] = None,
        sort_by: str = "created_at",
        sort_direction: str = "desc",
    ) -> list[Ticket]:
        """
        Return tickets for an event, with optional status filter and sort.
        """

        sort_columns: dict[str, InstrumentedAttribute[datetime.datetime | None]] = {
            "created_at": Ticket.created_at,
            "used_at": Ticket.used_at,
        }

        column = sort_columns.get(sort_by, Ticket.created_at)
        order = column.asc() if sort_direction == "asc" else column.desc()

        stmt = select(Ticket).where(Ticket.event_id == event_id)

        if status is not None:
            stmt = stmt.where(Ticket.status == status)

        stmt = stmt.order_by(order)

        return list(self.db.scalars(stmt).all())
