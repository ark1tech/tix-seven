import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.event import Event


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
