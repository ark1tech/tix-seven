from __future__ import annotations

import datetime
import uuid
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.enums import ResultEnum
from app.models.gate import Gate
from app.models.log import Log
from app.models.schemas import DenialReasonCount, LogSummary


class LogRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_summary(self, event_id: uuid.UUID) -> LogSummary:
        """
        Return aggregate log counts.
        """

        result_stmt = (
            select(Log.result, func.count(Log.log_id))
            .where(Log.event_id == event_id)
            .group_by(Log.result)
        )

        result_rows = self.db.execute(result_stmt).all()

        counts_by_result: dict[ResultEnum, int] = {
            result: count for result, count in result_rows
        }

        granted = counts_by_result.get(ResultEnum.GRANTED, 0)
        denied = counts_by_result.get(ResultEnum.DENIED, 0)
        timeout_or_error = counts_by_result.get(ResultEnum.TIMEOUT, 0) + counts_by_result.get(ResultEnum.ERROR, 0)
        total = granted + denied + timeout_or_error

        denial_stmt = (
            select(Log.denial_reason, func.count(Log.log_id))
            .where(
                Log.event_id == event_id,
                Log.denial_reason.isnot(None),
            )
            .group_by(Log.denial_reason)
            .order_by(func.count(Log.log_id).desc())
        )

        denial_rows = self.db.execute(denial_stmt).all()

        denial_breakdown = [
            DenialReasonCount(reason=reason, count=count)
            for reason, count in denial_rows
        ]

        return LogSummary(
            total=total,
            granted=granted,
            denied=denied,
            timeout_or_error=timeout_or_error,
            denial_breakdown=denial_breakdown,
        )

    def get_all_logs_by_event(
        self,
        event_id: uuid.UUID,
        *,
        result: Optional[ResultEnum] = None,
        gate_id: Optional[uuid.UUID] = None,
        from_time: Optional[datetime.datetime] = None,
        to_time: Optional[datetime.datetime] = None,
    ) -> list[Log]:
        """
        Return Log rows for an event, newest-first, with optional filters.
        """

        stmt = select(Log).where(Log.event_id == event_id)

        if result is not None:
            stmt = stmt.where(Log.result == result)

        if gate_id is not None:
            stmt = stmt.where(Log.gate_id == gate_id)

        if from_time is not None:
            stmt = stmt.where(Log.timestamp >= from_time)

        if to_time is not None:
            stmt = stmt.where(Log.timestamp <= to_time)

        stmt = stmt.order_by(Log.timestamp.desc())

        return list(self.db.scalars(stmt).all())

    def get_gate_filter_options(self, event_id: uuid.UUID) -> list[Gate]:
        """
        Return all distinct Gate records that have ever scanned for this event.
        """

        gate_ids_stmt = (
            select(Log.gate_id)
            .where(
                Log.event_id == event_id,
                Log.gate_id.isnot(None),
            )
            .distinct()
        )

        stmt = (
            select(Gate).where(Gate.gate_id.in_(gate_ids_stmt)).order_by(Gate.location)
        )

        return list(self.db.scalars(stmt).all())
