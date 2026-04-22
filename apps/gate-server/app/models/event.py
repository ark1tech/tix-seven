from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Index,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

import uuid, datetime

from app.db.base import Base
from app.models.enums import EventStatusEnum

from typing import TYPE_CHECKING, List

if TYPE_CHECKING:
    from app.models.venue import Venue
    from app.models.gate_assignment import GateAssignment
    from app.models.event_ticket_link import EventTicketLink
    from app.models.ticket import Ticket
    from app.models.log import Log


class Event(Base):
    __tablename__ = "event"

    event_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    venue_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("venue.venue_id"), nullable=False
    )

    name: Mapped[str] = mapped_column(String, nullable=False)

    status: Mapped[EventStatusEnum] = mapped_column(
        Enum(EventStatusEnum, name="event_status"),
        nullable=False,
        server_default=EventStatusEnum.SCHEDULED,
    )

    start_time: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False)
    end_time: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False)
    capacity: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Relationships
    venue: Mapped["Venue"] = relationship("Venue", back_populates="events")
    assignments: Mapped[List["GateAssignment"]] = relationship(
        "GateAssignment", back_populates="event"
    )
    ticket_links: Mapped[List["EventTicketLink"]] = relationship(
        "EventTicketLink", back_populates="event"
    )
    tickets: Mapped[List["Ticket"]] = relationship("Ticket", back_populates="event")
    logs: Mapped[List["Log"]] = relationship("Log", back_populates="event")

    __table_args__ = (
        CheckConstraint("end_time > start_time", name="check_if_event_time_valid"),
        Index("ix_event_venue_id", "venue_id"),
        Index("ix_event_status", "status"),
        Index("ix_event_time_range", "start_time", "end_time"),
    )
