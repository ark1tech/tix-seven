from sqlalchemy import String, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

import uuid
from app.db.base import Base

from typing import TYPE_CHECKING, List

if TYPE_CHECKING:
    from app.models.event import Event
    from app.models.gate import Gate


class Venue(Base):
    __tablename__ = "venue"

    venue_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # Non-ID Fields
    name: Mapped[str] = mapped_column(String, nullable=False)

    # Relationships
    events: Mapped[List["Event"]] = relationship(
        "Event", back_populates="venue"
    )

    gates: Mapped[List["Gate"]] = relationship(
        "Gate", back_populates="venue", cascade="all, delete-orphan", passive_deletes=True
    )

    __table_args__ = (Index("ix_venue_name", "name"),)
