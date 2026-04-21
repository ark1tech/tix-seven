from sqlalchemy import DateTime, Enum, ForeignKey, func, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

import uuid, datetime

from app.db.base import Base
from app.models.enums import TicketStatusEnum

from typing import TYPE_CHECKING, List, Optional

if TYPE_CHECKING:
    from app.models.eventticketlink import EventTicketLink
    from app.models.log import Log


class Ticket(Base):
    __tablename__ = "ticket"

    ticket_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    link_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("event_ticket_link.link_id"),
        unique=True,
        nullable=False
    )

    status: Mapped[TicketStatusEnum] = mapped_column(
        Enum(TicketStatusEnum, name="ticket_status"),
        nullable=False,
        default=TicketStatusEnum.UNUSED
    )

    created_at: Mapped[datetime.datetime] = mapped_column(
        DateTime,
        server_default=func.now(),
        nullable=False
    )

    used_at: Mapped[Optional[datetime.datetime]] = mapped_column(
        DateTime,
        nullable=True,
        default=None
    )

    # Relationships
    ticket_link: Mapped["EventTicketLink"] = relationship(
        "EventTicketLink",
        back_populates="ticket"
    )

    logs: Mapped[List["Log"]] = relationship(
        "Log",
        back_populates="ticket"
    )

    __table_args__ = (
        Index("ix_ticket_link_id", "link_id"),
        Index("ix_ticket_status", "status"),
        Index("ix_ticket_used_at", "used_at"),
    )