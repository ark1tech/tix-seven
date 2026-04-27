import datetime
import logging
import uuid

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.trace import get_trace_id
from app.models.enums import AssignmentStatusEnum, GateStatusEnum
from app.models.event import Event
from app.models.gate import Gate
from app.models.gate_assignment import GateAssignment
from app.models.schemas import GateCreateRequest, GateResponse, GateUpdateRequest

logger = logging.getLogger(__name__)


class GateService:
    def __init__(self, db: Session) -> None:
        self.db = db

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _active_event_id(self, gate_id: uuid.UUID) -> uuid.UUID | None:
        """Return the event_id of the ACTIVE assignment for gate, or None."""
        stmt = (
            select(GateAssignment.event_id)
            .where(
                GateAssignment.gate_id == gate_id,
                GateAssignment.status == AssignmentStatusEnum.ACTIVE,
            )
            .limit(1)
        )
        return self.db.scalar(stmt)

    def _resolve_venue_id_from_event(self, event_id: uuid.UUID) -> uuid.UUID:
        event = self.db.scalar(select(Event).where(Event.event_id == event_id))
        if event is None:
            raise HTTPException(status_code=404, detail="event_not_found")
        return event.venue_id

    def _deactivate_active_assignments(self, gate_id: uuid.UUID, now: datetime.datetime) -> None:
        actives = self.db.scalars(
            select(GateAssignment).where(
                GateAssignment.gate_id == gate_id,
                GateAssignment.status == AssignmentStatusEnum.ACTIVE,
            )
        ).all()
        for assignment in actives:
            assignment.status = AssignmentStatusEnum.INACTIVE
            assignment.unassigned_at = now

    def _insert_active_assignment(self, gate_id: uuid.UUID, event_id: uuid.UUID, now: datetime.datetime) -> None:
        assignment = GateAssignment(
            gate_id=gate_id,
            event_id=event_id,
            status=AssignmentStatusEnum.ACTIVE,
            assigned_at=now,
        )
        self.db.add(assignment)

    def _to_response(self, gate: Gate) -> GateResponse:
        event_id = self._active_event_id(gate.gate_id)
        return GateResponse(
            gate_id=gate.gate_id,
            venue_id=gate.venue_id,
            location=gate.location,
            status=gate.status.value if isinstance(gate.status, GateStatusEnum) else gate.status,
            event_id=event_id,
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def create(self, body: GateCreateRequest) -> GateResponse:
        trace_id = get_trace_id()
        logger.info(
            "gate create start: trace_id=%s location=%s event_id=%s",
            trace_id,
            body.location,
            body.event_id,
        )

        if body.event_id is not None:
            venue_id = self._resolve_venue_id_from_event(body.event_id)
        else:
            # Fall back to any existing venue
            venue_id = self.db.scalar(select(Event.venue_id).limit(1))
            if venue_id is None:
                raise HTTPException(
                    status_code=422,
                    detail="no_venue_found",
                )

        gate = Gate(
            location=body.location,
            venue_id=venue_id,
            status=GateStatusEnum.OFFLINE,
        )
        self.db.add(gate)
        self.db.flush()

        if body.event_id is not None:
            now = datetime.datetime.now(datetime.timezone.utc)
            self._insert_active_assignment(gate.gate_id, body.event_id, now)

        self.db.commit()
        self.db.refresh(gate)

        logger.info(
            "gate create succeeded: trace_id=%s gate_id=%s status_code=201",
            trace_id,
            gate.gate_id,
        )
        return self._to_response(gate)

    def update(self, gate_id: uuid.UUID, body: GateUpdateRequest) -> GateResponse:
        trace_id = get_trace_id()
        logger.info(
            "gate update start: trace_id=%s gate_id=%s",
            trace_id,
            gate_id,
        )

        gate = self.db.scalar(select(Gate).where(Gate.gate_id == gate_id))
        if gate is None:
            logger.warning(
                "gate update failed: reason=gate_not_found status_code=404 trace_id=%s gate_id=%s",
                trace_id,
                gate_id,
            )
            raise HTTPException(status_code=404, detail="gate_not_found")

        fields = body.model_fields_set

        if "location" in fields and body.location is not None:
            gate.location = body.location

        if "event_id" in fields:
            new_event_id = body.event_id  # may be None (explicit unassign)
            current_event_id = self._active_event_id(gate_id)

            if new_event_id != current_event_id:
                now = datetime.datetime.now(datetime.timezone.utc)
                self._deactivate_active_assignments(gate_id, now)
                if new_event_id is not None:
                    venue_id = self._resolve_venue_id_from_event(new_event_id)
                    gate.venue_id = venue_id
                    self._insert_active_assignment(gate_id, new_event_id, now)

        self.db.commit()
        self.db.refresh(gate)

        logger.info(
            "gate update succeeded: trace_id=%s gate_id=%s status_code=200",
            trace_id,
            gate_id,
        )
        return self._to_response(gate)

    def delete(self, gate_id: uuid.UUID) -> None:
        trace_id = get_trace_id()
        logger.info(
            "gate delete start: trace_id=%s gate_id=%s",
            trace_id,
            gate_id,
        )

        gate = self.db.scalar(select(Gate).where(Gate.gate_id == gate_id))
        if gate is None:
            logger.warning(
                "gate delete failed: reason=gate_not_found status_code=404 trace_id=%s gate_id=%s",
                trace_id,
                gate_id,
            )
            raise HTTPException(status_code=404, detail="gate_not_found")

        # Remove assignments first (FK constraint)
        assignments = self.db.scalars(
            select(GateAssignment).where(GateAssignment.gate_id == gate_id)
        ).all()
        for a in assignments:
            self.db.delete(a)
        self.db.flush()

        try:
            self.db.delete(gate)
            self.db.commit()
        except IntegrityError:
            self.db.rollback()
            logger.warning(
                "gate delete failed: reason=gate_in_use status_code=409 trace_id=%s gate_id=%s",
                trace_id,
                gate_id,
            )
            raise HTTPException(status_code=409, detail="gate_in_use")

        logger.info(
            "gate delete succeeded: trace_id=%s gate_id=%s status_code=204",
            trace_id,
            gate_id,
        )
