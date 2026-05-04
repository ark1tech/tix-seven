import uuid

from sqlalchemy import select, exists
from sqlalchemy.orm import Session, joinedload

from app.models.event import Event
from app.models.gate_assignment import GateAssignment

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
                .order_by(Event.start_time)  # Arbitrary
            ).all()
        )
    
    def has_gate_assignments(self, event_id: uuid.UUID) -> bool:
        """
        Returns True if the event has any gates assigned to it, False otherwise.
        """

        return bool(self.db.scalar(select(
            exists().where(GateAssignment.event_id == event_id)
        )))