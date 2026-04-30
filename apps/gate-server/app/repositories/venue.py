import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.venue import Venue


class VenueRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_id(self, venue_id: uuid.UUID) -> Venue | None:
        return self.db.scalar(select(Venue).where(Venue.venue_id == venue_id))

    def get_all(self) -> list[Venue]:
        return list(self.db.scalars(select(Venue).order_by(Venue.name)).all())

    def exists(self, venue_id: uuid.UUID) -> bool:
        return self.get_by_id(venue_id) is not None
