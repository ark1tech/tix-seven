from __future__ import annotations

import logging
import uuid

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.trace import get_trace_id
from app.repositories.event import EventRepository
from app.repositories.log import LogRepository

from app.models.schemas import (
    GateFilterOption,
    LogEntry,
    LogFilters,
    LogListResponse,
    LogSummary,
)

logger = logging.getLogger(__name__)


class LogService:
    def __init__(
        self,
        db: Session,
        logs: LogRepository | None = None,
        events: EventRepository | None = None,
    ) -> None:
        self.db = db
        self.logs = logs or LogRepository(db)
        self.events = events or EventRepository(db)

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _assert_event_exists(self, event_id: uuid.UUID) -> None:
        if not self.events.get_by_id(event_id):
            logger.warning(
                "log service: event not found trace_id=%s event_id=%s",
                get_trace_id(),
                event_id,
            )

            raise HTTPException(status_code=404, detail="event_not_found")

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def get_logs(
        self,
        event_id: uuid.UUID,
        filters: LogFilters,
    ) -> LogListResponse:
        """
        Return the full entry log payload for the Entry Log View.
        """

        trace_id = get_trace_id()

        logger.info(
            "log list start: trace_id=%s event_id=%s",
            trace_id,
            event_id,
        )

        self._assert_event_exists(event_id)

        raw_summary = self.logs.get_summary(event_id)

        denial_breakdown = raw_summary.denial_breakdown

        summary = LogSummary(
            total=raw_summary.total,
            granted=raw_summary.granted,
            denied=raw_summary.denied,
            timeout_or_error=raw_summary.timeout_or_error,
            denial_breakdown=denial_breakdown,
        )

        rows = self.logs.get_all_logs_by_event(
            event_id,
            result=filters.result,
            gate_id=filters.gate_id,
            from_time=filters.from_time,
            to_time=filters.to_time,
        )

        logs = [
            LogEntry(
                log_id=log.log_id,
                timestamp=log.timestamp,
                gate_location_snapshot=log.gate_location_snapshot,
                raw_gate_id_snapshot=log.raw_gate_id_snapshot,
                result=log.result,
                denial_reason=log.denial_reason,
                ticket_id=log.ticket_id,
                ticket_status_snapshot=log.ticket_status_snapshot,
            )
            for log in rows
        ]

        logger.info(
            "log list succeeded: trace_id=%s event_id=%s count=%d",
            trace_id,
            event_id,
            len(logs),
        )

        return LogListResponse(summary=summary, logs=logs)

    def get_gate_filter_options(
        self,
        event_id: uuid.UUID,
    ) -> list[GateFilterOption]:
        """
        Return gates that have ever scanned for this event.
        """

        self._assert_event_exists(event_id)

        gates = self.logs.get_gate_filter_options(event_id)

        return [
            GateFilterOption(
                gate_id=gate.gate_id,
                location=gate.location,
            )
            for gate in gates
        ]
