from sqlalchemy import CheckConstraint, DateTime, Enum, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

import uuid, datetime

from app.db.base import Base
from app.db.time import pht_now_server_default
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

    event_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("event.event_id", ondelete="SET NULL"), nullable=True
    )

    gate_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("gate.gate_id", ondelete="SET NULL"), nullable=True
    )

    # Operative GateAssignment at the time of scan
    assignment_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("gate_assignment.assignment_id", ondelete="SET NULL"), nullable=True
    )

    ticket_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("ticket.ticket_id", ondelete="SET NULL"), nullable=True
    )

    # Non-null Fields
    result: Mapped[ResultEnum] = mapped_column(Enum(ResultEnum, name="log_result"), nullable=False)

    denial_reason: Mapped[Optional[DenialReasonEnum]] = mapped_column(Enum(DenialReasonEnum, name="denial_reason"), nullable=True)

    timestamp: Mapped[datetime.datetime] = mapped_column(DateTime, server_default=pht_now_server_default(), nullable=False)

    # Snapshots
    event_name_snapshot: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    raw_gate_id_snapshot: Mapped[str] = mapped_column(String, nullable=False)

    gate_location_snapshot: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # String rather than a TicketStatusEnum as it should reflect the value as it was, and 
    # if the enum ever gains new members or the ticket model changes, old log rows should
    # not be affected by the type evolution
    ticket_status_snapshot: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # Relationships
    event: Mapped[Optional["Event"]] = relationship(
        "Event", back_populates="logs"
    )

    gate: Mapped[Optional["Gate"]] = relationship(
        "Gate", back_populates="logs"
    )

    assignment: Mapped[Optional["GateAssignment"]] = relationship(
        "GateAssignment", back_populates="logs"
    )

    ticket: Mapped[Optional["Ticket"]] = relationship(
        "Ticket", back_populates="logs"
    )

    __table_args__ = (
        # denial_reason must be null when result is GRANTED and non-null otherwise
        CheckConstraint(
            "(result = 'GRANTED') = (denial_reason IS NULL)",
            name="check_denial_reason_consistency",
        ),

        # TIMEOUT and ERROR results imply no ticket decision was reached
        CheckConstraint(
            "result NOT IN ('TIMEOUT', 'ERROR') OR ticket_id IS NULL",
            name="check_ticket_absent_on_system_failure",
        ),

        CheckConstraint(
            "(gate_id IS NULL) = (gate_location_snapshot IS NULL)",
            name="check_gate_snapshot_consistency",
        ),
        CheckConstraint(
            "(event_id IS NULL) = (event_name_snapshot IS NULL)",
            name="check_event_snapshot_consistency",
        ),
        CheckConstraint(
            "(ticket_id IS NULL) = (ticket_status_snapshot IS NULL)",
            name="check_ticket_snapshot_consistency",
        ),

        Index("ix_log_event_id", "event_id"),
        Index("ix_log_gate_id", "gate_id"),
        Index("ix_log_assignment_id", "assignment_id"),
        Index("ix_log_ticket_id", "ticket_id"),
        Index("ix_log_timestamp", "timestamp"),
        Index("ix_log_event_gate_time", "event_id", "gate_id", "timestamp"),
    )
