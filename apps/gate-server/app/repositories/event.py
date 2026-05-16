import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.models.event import Event
from app.models.gate import Gate
from app.models.gate_assignment import GateAssignment
from app.models.ticket import Ticket
from app.models.enums import AssignmentStatusEnum, TicketStatusEnum


class EventRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_id(self, event_id: uuid.UUID) -> Event | None:
        return self.db.scalar(select(Event).where(Event.event_id == event_id))

    def get_by_id_with_venue(self, event_id: uuid.UUID) -> Event | None:
        """
        Fetch an event with its venue eagerly loaded.
        """

        return self.db.scalar(
            select(Event)
            .options(joinedload(Event.venue))
            .where(Event.event_id == event_id)
        )

    def get_all_with_venue(self) -> list[Event]:
        return list(
            self.db.scalars(
                select(Event)
                .options(joinedload(Event.venue))
                .order_by(Event.start_time)  # Arbitrary order
            ).all()
        )

    def has_gate_assignments(self, event_id: uuid.UUID) -> bool:
        """
        Returns True if the event has any gates assigned to it, False otherwise.
        """

        stmt = select(GateAssignment.assignment_id).where(
            GateAssignment.event_id == event_id
        )

        return self.db.scalar(stmt.limit(1)) is not None

    def get_admitted_count(self, event_id: uuid.UUID) -> int:
        """
        Count of tickets with status = USED for this event.
        """

        stmt = (
            select(func.count(Ticket.ticket_id))
            .where(
                Ticket.event_id == event_id,
                Ticket.status == TicketStatusEnum.USED,
            )
        )

        return self.db.scalar(stmt) or 0

    def get_admitted_counts_in_bulk(
        self,
        event_ids: list[uuid.UUID],
    ) -> dict[uuid.UUID, int]:
        """
        Single query for admitted counts across multiple events.
        """

        if not event_ids:
            return {}

        stmt = (
            select(Ticket.event_id, func.count(Ticket.ticket_id))
            .where(
                Ticket.event_id.in_(event_ids),
                Ticket.status == TicketStatusEnum.USED,
            )
            .group_by(Ticket.event_id)
        )

        rows = self.db.execute(stmt).all()

        return {
            event_id: count
            for event_id, count in rows
        }

    def get_assigned_gates(self, event_id: uuid.UUID) -> list[tuple[Gate, uuid.UUID]]:
        """
        Return (Gate, assignment_id) pairs for all ACTIVE assignments on this event.
        """

        stmt = (
            select(Gate, GateAssignment.assignment_id)
            .join(GateAssignment, GateAssignment.gate_id == Gate.gate_id)
            .where(
                GateAssignment.event_id == event_id,
                GateAssignment.status == AssignmentStatusEnum.ACTIVE,
            )
        )

        rows = self.db.execute(stmt).all()

        return [
            (gate, assignment_id)
            for gate, assignment_id in rows
        ]