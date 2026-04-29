from sqlalchemy import CheckConstraint, DateTime, Enum, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

import uuid, datetime

from app.db.base import Base
from app.models.enums import AssignmentStatusEnum

from typing import TYPE_CHECKING, List, Optional

if TYPE_CHECKING:
    from app.models.gate import Gate
    from app.models.event import Event
    from app.models.log import Log


class GateAssignment(Base):
    __tablename__ = "gate_assignment"

    assignment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    gate_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("gate.gate_id", ondelete="CASCADE"), nullable=False
    )

    event_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("event.event_id", ondelete="CASCADE"), nullable=False
    )

    # Non-ID Fields
    status: Mapped[AssignmentStatusEnum] = mapped_column(
        Enum(AssignmentStatusEnum, name="assignment_status"), nullable=False, server_default=AssignmentStatusEnum.ACTIVE
    )

    assigned_at: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False)

    unassigned_at: Mapped[Optional[datetime.datetime]] = mapped_column(DateTime, nullable=True)

    # Relationships
    gate: Mapped["Gate"] = relationship(
        "Gate", back_populates="assignments"
    )

    event: Mapped["Event"] = relationship(
        "Event", back_populates="assignments"
    )

    logs: Mapped[List["Log"]] = relationship(
        "Log", back_populates="assignment"
    )

    __table_args__ = (
        CheckConstraint(
            "(status = 'INACTIVE'::assignment_status) = (unassigned_at IS NOT NULL)",
            name="check_unassigned_at_consistency",
        ),

        Index(
            "uq_gate_assignment_active_gate",
            "gate_id",
            unique=True,
            postgresql_where="status = 'ACTIVE'",
        ),
        Index("ix_gate_assignment_gate_id", "gate_id"),
        Index("ix_gate_assignment_event_id", "event_id"),
        Index("ix_gate_assignment_status", "status"),
    )
