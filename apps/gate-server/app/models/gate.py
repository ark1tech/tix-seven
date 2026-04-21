from sqlalchemy import Enum, ForeignKey, String, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

import uuid

from app.db.base import Base
from app.models.enums import GateStatusEnum

from typing import TYPE_CHECKING, List, Optional

if TYPE_CHECKING:
    from app.models.venue import Venue
    from app.models.event import Event
    from app.models.log import Log


class Gate(Base):
    __tablename__ = "gate"

    gate_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    venue_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("venue.venue_id"), nullable=True
    )

    event_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("event.event_id"), nullable=True
    )

    location: Mapped[str] = mapped_column(String, nullable=False)

    status: Mapped[GateStatusEnum] = mapped_column(
        Enum(GateStatusEnum, name="gate_status"), nullable=False
    )

    # Relationships
    venue: Mapped["Venue"] = relationship("Venue", back_populates="gates")
    event: Mapped[Optional["Event"]] = relationship("Event", back_populates="gates")
    logs: Mapped[List["Log"]] = relationship("Log", back_populates="gate")

    __table_args__ = (
        Index("ix_gate_venue_id", "venue_id"),
        Index("ix_gate_event_id", "event_id"),
        Index("ix_gate_status", "status"),
    )
