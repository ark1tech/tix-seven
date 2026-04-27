import datetime
import logging
import uuid

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.trace import get_trace_id
from app.models.enums import AssignmentStatusEnum, EventStatusEnum, GateStatusEnum
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

    def _get_active_event_id_for_gate(self, gate_id: uuid.UUID) -> uuid.UUID | None:
        """
        Return active event_id for a gate if it exists.
        """

        stmt = (
            select(GateAssignment.event_id)
            .where(
                GateAssignment.gate_id == gate_id,
                GateAssignment.status == AssignmentStatusEnum.ACTIVE,
            )
            .limit(1)
        )

        return self.db.scalar(stmt)

    def _get_event_venue_id(self, event_id: uuid.UUID) -> uuid.UUID:
        """
        Resolve venue_id from event, ensuring the event exists.
        """

        stmt = select(Event).where(Event.event_id == event_id)

        event = self.db.scalar(stmt)

        if event is None:
            raise HTTPException(status_code=404, detail="event_not_found")

        return event.venue_id

    def _ensure_event_is_active(self, event_id: uuid.UUID) -> None:
        """
        Ensure event is in ACTIVE state before any assignment.
        """

        stmt = select(Event).where(Event.event_id == event_id)

        event = self.db.scalar(stmt)

        if event is None:
            raise HTTPException(status_code=404, detail="event_not_found")

        if event.status != EventStatusEnum.ACTIVE:
            raise HTTPException(status_code=409, detail="event_not_active")

    def _create_gate_assignment(
        self,
        gate_id: uuid.UUID,
        event_id: uuid.UUID,
        now: datetime.datetime,
    ) -> None:
        """
        Create a new ACTIVE gate assignment.
        """

        assignment = GateAssignment(
            gate_id=gate_id,
            event_id=event_id,
            status=AssignmentStatusEnum.ACTIVE,
            assigned_at=now,
        )

        self.db.add(assignment)

    def _deactivate_gate_assignment(
        self, gate_id: uuid.UUID, now: datetime.datetime
    ) -> None:
        """
        Deactivate the current ACTIVE assignment of a gate if it exists.
        """

        stmt = select(GateAssignment).where(
            GateAssignment.gate_id == gate_id,
            GateAssignment.status == AssignmentStatusEnum.ACTIVE,
        )

        assignment = self.db.scalar(stmt)

        if assignment is not None:
            assignment.status = AssignmentStatusEnum.INACTIVE
            assignment.unassigned_at = now

    def _now(self) -> datetime.datetime:
        return self._now()

    def _map_event_to_response(self, gate: Gate) -> GateResponse:
        event_id = self._get_active_event_id_for_gate(gate.gate_id)

        return GateResponse(
            gate_id=gate.gate_id,
            venue_id=gate.venue_id,
            location=gate.location,
            status=gate.status.value,
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
            self._ensure_event_is_active(body.event_id)

            venue_id = self._get_event_venue_id(body.event_id)

        else:
            # Fall back to any existing venue
            # Paul: Uhhhhh do we really ba,,,

            stmt = select(Event.venue_id).limit(1)

            venue_id = self.db.scalar(stmt)

            if venue_id is None:
                raise HTTPException(status_code=422, detail="no_venue_found")

        gate = Gate(
            location=body.location,
            venue_id=venue_id,
            status=GateStatusEnum.OFFLINE,
        )

        self.db.add(gate)
        self.db.flush()

        if body.event_id is not None:
            now = self._now()

            self._create_gate_assignment(
                gate.gate_id,
                body.event_id,
                now,
            )

        self.db.commit()
        self.db.refresh(gate)

        logger.info(
            "gate create succeeded: trace_id=%s gate_id=%s status_code=201",
            trace_id,
            gate.gate_id,
        )

        return self._map_event_to_response(gate)

    def update(self, gate_id: uuid.UUID, body: GateUpdateRequest) -> GateResponse:
        trace_id = get_trace_id()
        logger.info(
            "gate update start: trace_id=%s gate_id=%s",
            trace_id,
            gate_id,
        )

        stmt = select(Gate).where(Gate.gate_id == gate_id)

        gate = self.db.scalar(stmt)

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
            new_event_id = body.event_id  # May be None for explicit unassign
            current_event_id = self._get_active_event_id_for_gate(gate_id)

            if new_event_id != current_event_id:
                now = self._now()

                # Remove any existing active assignment
                self._deactivate_gate_assignment(gate_id, now)

                # Validate and attach if assigning a new event
                if new_event_id is not None:
                    self._ensure_event_is_active(new_event_id)

                    venue_id = self._get_event_venue_id(new_event_id)
                    gate.venue_id = venue_id

                    self._create_gate_assignment(gate_id, new_event_id, now)

        self.db.commit()
        self.db.refresh(gate)

        logger.info(
            "gate update succeeded: trace_id=%s gate_id=%s status_code=200",
            trace_id,
            gate_id,
        )

        return self._map_event_to_response(gate)

    def delete(self, gate_id: uuid.UUID) -> None:
        trace_id = get_trace_id()
        logger.info(
            "gate delete start: trace_id=%s gate_id=%s",
            trace_id,
            gate_id,
        )

        stmt = select(Gate).where(Gate.gate_id == gate_id)

        gate = self.db.scalar(stmt)

        if gate is None:
            logger.warning(
                "gate delete failed: reason=gate_not_found status_code=404 trace_id=%s gate_id=%s",
                trace_id,
                gate_id,
            )
            raise HTTPException(status_code=404, detail="gate_not_found")

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
