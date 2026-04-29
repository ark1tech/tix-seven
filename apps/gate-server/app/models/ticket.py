from sqlalchemy import CheckConstraint, DateTime, Enum, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

import uuid, datetime

from app.db.base import Base
from app.db.time import pht_now_server_default
from app.models.enums import TicketStatusEnum

from typing import TYPE_CHECKING, List, Optional

if TYPE_CHECKING:
    from app.models.event import Event
    from app.models.event_ticket_link import EventTicketLink
    from app.models.log import Log


class Ticket(Base):
    __tablename__ = "ticket"

    ticket_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    link_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("event_ticket_link.link_id", ondelete="SET NULL"), unique=True, nullable=True
    )

    event_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("event.event_id"), nullable=False
    )

    # Non-ID Fields
    status: Mapped[TicketStatusEnum] = mapped_column(
        Enum(TicketStatusEnum, name="ticket_status"), nullable=False, server_default=TicketStatusEnum.UNUSED
    )

    created_at: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=pht_now_server_default(), nullable=False)
    
    used_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime, nullable=True)

    # Relationships
    event: Mapped["Event"] = relationship(
        "Event", back_populates="tickets"
    )

    ticket_link: Mapped[Optional["EventTicketLink"]] = relationship(
        "EventTicketLink", back_populates="ticket"
    )

    logs: Mapped[List["Log"]] = relationship(
        "Log", back_populates="ticket"
    )

    __table_args__ = (
        CheckConstraint(
            "(status = 'USED'::ticket_status) = (used_at IS NOT NULL)",
            name="check_used_at_consistency",
        ),
        Index("ix_ticket_link_id", "link_id"),
        Index("ix_ticket_event_id", "event_id"),
        Index("ix_ticket_status", "status"),
        Index("ix_ticket_used_at", "used_at"),
    )
