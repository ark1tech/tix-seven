from sqlalchemy import DateTime, Enum, ForeignKey, String, func, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

import uuid, datetime

from app.db.base import Base
from app.models.enums import ResultEnum

from typing import TYPE_CHECKING, Optional

if TYPE_CHECKING:
    from app.models.event import Event
    from app.models.gate import Gate
    from app.models.ticket import Ticket


class Log(Base):
    __tablename__ = "log"

    log_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    event_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("event.event_id"),
        nullable=False
    )

    gate_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("gate.gate_id"),
        nullable=False
    )

    ticket_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("ticket.ticket_id"),
        nullable=True
    )

    result: Mapped[ResultEnum] = mapped_column(
        Enum(ResultEnum, name="log_result"),
        nullable=False
    )

    reason: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    timestamp: Mapped[datetime.datetime] = mapped_column(
        DateTime,
        server_default=func.now(),
        nullable=False
    )

    # Relationships
    event: Mapped["Event"] = relationship("Event", back_populates="logs")
    gate: Mapped["Gate"] = relationship("Gate", back_populates="logs")
    ticket: Mapped[Optional["Ticket"]] = relationship("Ticket", back_populates="logs")

    __table_args__ = (
        Index("ix_log_event_id", "event_id"),
        Index("ix_log_gate_id", "gate_id"),
        Index("ix_log_ticket_id", "ticket_id"),
        Index("ix_log_timestamp", "timestamp"),
        Index("ix_log_event_gate_time", "event_id", "gate_id", "timestamp"),
    )