from sqlalchemy import ForeignKey, String, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

import uuid

from app.db.base import Base

from typing import TYPE_CHECKING, Optional

if TYPE_CHECKING:
    from app.models.event import Event
    from app.models.ticket import Ticket


class EventTicketLink(Base):
    __tablename__ = "event_ticket_link"

    link_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    event_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("event.event_id"), nullable=False
    )

    link_hash: Mapped[str] = mapped_column(String, unique=True, nullable=False)

    # Relationships
    event: Mapped["Event"] = relationship("Event", back_populates="ticket_links")
    ticket: Mapped[Optional["Ticket"]] = relationship(
        "Ticket", back_populates="ticket_link", uselist=False
    )

    __table_args__ = (
        Index("ix_link_event_id", "event_id"),
        Index("ix_link_hash", "link_hash"),
    )
