from __future__ import annotations

import datetime
import uuid
from typing import Optional

from sqlalchemy import CheckConstraint, DateTime, Enum, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.time import pht_now_server_default
from app.models.enums import DenialReasonEnum, ResultEnum


class ScanAttemptLog(Base):
    """
    Audit row for every /verify request (including pre-resolution failures).

    Unlike ``Log``, this table may omit ``event_id`` / ``gate_id`` when the
    request cannot be tied to a known event or gate record.
    """

    __tablename__ = "scan_attempt_log"

    attempt_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    timestamp: Mapped[datetime.datetime] = mapped_column(
        DateTime, server_default=pht_now_server_default(), nullable=False
    )

    gate_id_raw: Mapped[str] = mapped_column(String(), nullable=False)
    gate_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("gate.gate_id"), nullable=True
    )
    event_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("event.event_id"), nullable=True
    )
    assignment_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("gate_assignment.assignment_id"), nullable=True
    )
    ticket_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        ForeignKey("ticket.ticket_id"), nullable=True
    )

    result: Mapped[ResultEnum] = mapped_column(
        Enum(ResultEnum, name="log_result"), nullable=False
    )
    denial_reason: Mapped[Optional[DenialReasonEnum]] = mapped_column(
        Enum(DenialReasonEnum, name="denial_reason"), nullable=True
    )
    error_code: Mapped[Optional[str]] = mapped_column(String(), nullable=True)

    __table_args__ = (
        CheckConstraint(
            "(result = 'GRANTED') = (denial_reason IS NULL)",
            name="check_scan_attempt_denial_reason_consistency",
        ),
        Index("ix_scan_attempt_log_timestamp", "timestamp"),
        Index("ix_scan_attempt_log_gate_id", "gate_id"),
        Index("ix_scan_attempt_log_event_id", "event_id"),
        Index(
            "ix_scan_attempt_log_event_gate_time",
            "event_id",
            "gate_id",
            "timestamp",
        ),
    )
