from sqlalchemy import CheckConstraint, DateTime, Enum, ForeignKey, func, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

import uuid, datetime

from app.db.base import Base
from app.models.enums import DenialReasonEnum, ResultEnum

from typing import TYPE_CHECKING, Optional

if TYPE_CHECKING:
    from app.models.event import Event
    from app.models.gate import Gate
    from app.models.gate_assignment import GateAssignment
    from app.models.ticket import Ticket


class Log(Base):
    __tablename__ = "log"

    log_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    event_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("event.event_id"), nullable=False
    )

    gate_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("gate.gate_id"), nullable=False
    )

    # Snapshot of the operative GateAssignment at the time of scan
    assignment_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("gate_assignment.assignment_id"), nullable=False
    )

    ticket_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("ticket.ticket_id"), nullable=True
    )

    result: Mapped[ResultEnum] = mapped_column(
        Enum(ResultEnum, name="log_result"), nullable=False
    )

    # Populated only when result = DENIED
    # Null for all other types of results
    denial_reason: Mapped[Optional[DenialReasonEnum]] = mapped_column(
        Enum(DenialReasonEnum, name="denial_reason"), nullable=True
    )

    timestamp: Mapped[datetime.datetime] = mapped_column(
        DateTime, server_default=func.now(), nullable=False
    )

    # Relationships
    event: Mapped["Event"] = relationship("Event", back_populates="logs")
    gate: Mapped["Gate"] = relationship("Gate", back_populates="logs")
    assignment: Mapped["GateAssignment"] = relationship(
        "GateAssignment", back_populates="logs"
    )
    ticket: Mapped[Optional["Ticket"]] = relationship("Ticket", back_populates="logs")

    __table_args__ = (
        CheckConstraint(
            "(result = 'GRANTED') = (denial_reason IS NULL)",
            name="check_denial_reason_consistency",
        ),
        Index("ix_log_event_id", "event_id"),
        Index("ix_log_gate_id", "gate_id"),
        Index("ix_log_assignment_id", "assignment_id"),
        Index("ix_log_ticket_id", "ticket_id"),
        Index("ix_log_timestamp", "timestamp"),
        Index("ix_log_event_gate_time", "event_id", "gate_id", "timestamp"),
    )
