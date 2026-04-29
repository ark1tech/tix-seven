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
from app.models.venue import Venue
from app.models.schemas import GateCreateRequest, GateResponse, GateUpdateRequest

logger = logging.getLogger(__name__)


class GateService:
    def __init__(self, db: Session) -> None:
        self.db = db

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _get_or_404(self, gate_id: uuid.UUID) -> Gate:
        gate = self.db.scalar(select(Gate).where(Gate.gate_id == gate_id))

        if gate is None:
            logger.warning(
                "gate not found: trace_id=%s gate_id=%s",
                get_trace_id(),
                gate_id,
            )

            raise HTTPException(status_code=404, detail="gate_not_found")

        return gate

    def _assert_venue_exists(self, venue_id: uuid.UUID) -> None:
        if self.db.scalar(select(Venue).where(Venue.venue_id == venue_id)) is None:
            logger.warning(
                "gate operation failed: reason=venue_not_found status_code=404 "
                "trace_id=%s venue_id=%s",
                get_trace_id(),
                venue_id,
            )

            raise HTTPException(status_code=404, detail="venue_not_found")

    def _resolve_assignable_event(self, event_id: uuid.UUID) -> Event:
        """
        Fetch the event and verify it is in an assignable state.
        
        Raises a 404 if missing and a 409 if not assignable.
        """

        event = self.db.scalar(select(Event).where(Event.event_id == event_id))

        if event is None:
            logger.warning(
                "gate operation failed: reason=event_not_found status_code=404 "
                "trace_id=%s event_id=%s",
                get_trace_id(),
                event_id,
            )

            raise HTTPException(status_code=404, detail="event_not_found")

        if event.status not in (EventStatusEnum.SCHEDULED, EventStatusEnum.ACTIVE):
            logger.warning(
                "gate operation failed: reason=event_not_assignable status_code=409 "
                "trace_id=%s event_id=%s event_status=%s",
                get_trace_id(),
                event_id,
                event.status.value,
            )

            raise HTTPException(status_code=409, detail="event_not_assignable")

        return event

    def _assert_gate_offline(self, gate: Gate, operation: str) -> None:
        """
        Block assignment changes while the gate is ONLINE.
        """

        if gate.status == GateStatusEnum.ONLINE:
            logger.warning(
                "gate operation failed: reason=gate_online operation=%s "
                "status_code=409 trace_id=%s gate_id=%s",
                operation,
                get_trace_id(),
                gate.gate_id,
            )

            raise HTTPException(status_code=409, detail="gate_must_be_offline")

    def _get_active_assignment(self, gate_id: uuid.UUID) -> GateAssignment | None:
        return self.db.scalar(
            select(GateAssignment).where(
                GateAssignment.gate_id == gate_id,
                GateAssignment.status == AssignmentStatusEnum.ACTIVE,
            )
        )

    def _get_active_event_id(self, gate_id: uuid.UUID) -> uuid.UUID | None:
        """
        Return the event_id of the gate's current active assignment, or None.
        """

        return self.db.scalar(
            select(GateAssignment.event_id).where(
                GateAssignment.gate_id == gate_id,
                GateAssignment.status == AssignmentStatusEnum.ACTIVE,
            )
        )

    def _deactivate_assignment(
        self, assignment: GateAssignment, now: datetime.datetime
    ) -> None:
        """
        Mark an existing ACTIVE assignment as INACTIVE.
        
        Caller is responsible for ensuring the gate is OFFLINE first.
        """

        assignment.status = AssignmentStatusEnum.INACTIVE
        assignment.unassigned_at = now

    def _create_assignment(
        self,
        gate_id: uuid.UUID,
        event_id: uuid.UUID,
        now: datetime.datetime,
    ) -> None:
        self.db.add(
            GateAssignment(
                gate_id=gate_id,
                event_id=event_id,
                status=AssignmentStatusEnum.ACTIVE,
                assigned_at=now,
            )
        )

    def _now(self) -> datetime.datetime:
        return datetime.datetime.now(datetime.timezone.utc)

    def _to_response(self, gate: Gate) -> GateResponse:
        return GateResponse(
            gate_id=gate.gate_id,
            venue_id=gate.venue_id,
            location=gate.location,
            status=gate.status,
            event_id=self._get_active_event_id(gate.gate_id),
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def create(self, body: GateCreateRequest) -> GateResponse:
        trace_id = get_trace_id()

        logger.info(
            "gate create start: trace_id=%s venue_id=%s location=%s event_id=%s",
            trace_id,
            body.venue_id,
            body.location,
            body.event_id,
        )

        self._assert_venue_exists(body.venue_id)

        if body.event_id is not None:
            event = self._resolve_assignable_event(body.event_id)

            # The gate must belong to the same venue as the event it is assigned to
            if event.venue_id != body.venue_id:
                logger.warning(
                    "gate create failed: reason=venue_mismatch status_code=409 "
                    "trace_id=%s gate_venue_id=%s event_venue_id=%s",
                    trace_id,
                    body.venue_id,
                    event.venue_id,
                )
    
                raise HTTPException(status_code=409, detail="venue_mismatch")

        gate = Gate(
            venue_id=body.venue_id,
            location=body.location,
            status=GateStatusEnum.OFFLINE,  # All gates begin as OFFLINE
        )

        self.db.add(gate)
        self.db.flush()  # Materialize gate_id before creating assignment

        if body.event_id is not None:
            self._create_assignment(gate.gate_id, body.event_id, self._now())

        self.db.commit()
        self.db.refresh(gate)

        logger.info(
            "gate create succeeded: trace_id=%s gate_id=%s",
            trace_id,
            gate.gate_id,
        )

        return self._to_response(gate)

    def get(self, gate_id: uuid.UUID) -> GateResponse:
        return self._to_response(self._get_or_404(gate_id))

    def get_all(self) -> list[GateResponse]:
        gates = self.db.scalars(select(Gate).order_by(Gate.location)).all()  # Order by location is arbitrary

        return [self._to_response(gate) for gate in gates]

    def update(self, gate_id: uuid.UUID, body: GateUpdateRequest) -> GateResponse:
        trace_id = get_trace_id()

        logger.info(
            "gate update start: trace_id=%s gate_id=%s",
            trace_id,
            gate_id,
        )

        gate = self._get_or_404(gate_id)

        fields = body.model_fields_set

        if "location" in fields and body.location is not None:
            gate.location = body.location

        if "event_id" in fields:
            # body.event_id may be None, which means explicit unassign
    
            new_event_id = body.event_id
    
            current_assignment = self._get_active_assignment(gate_id)

            current_event_id = (
                current_assignment.event_id if current_assignment else None
            )

            if new_event_id != current_event_id:
                # Any change to assignment requires the gate to be OFFLINE.
                self._assert_gate_offline(gate, "reassign")

                now = self._now()

                if current_assignment is not None:
                    self._deactivate_assignment(current_assignment, now)

                if new_event_id is not None:
                    event = self._resolve_assignable_event(new_event_id)

                    if event.venue_id != gate.venue_id:
                        logger.warning(
                            "gate update failed: reason=venue_mismatch status_code=409 "
                            "trace_id=%s gate_id=%s gate_venue_id=%s event_venue_id=%s",
                            trace_id,
                            gate_id,
                            gate.venue_id,
                            event.venue_id,
                        )
                        raise HTTPException(status_code=409, detail="venue_mismatch")

                    self._create_assignment(gate_id, new_event_id, now)

        self.db.commit()
        self.db.refresh(gate)

        logger.info(
            "gate update succeeded: trace_id=%s gate_id=%s",
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

        gate = self._get_or_404(gate_id)

        # Block deletion of ONLINE gates because they may be mid-scan
        if gate.status == GateStatusEnum.ONLINE:
            logger.warning(
                "gate delete failed: reason=gate_online status_code=409 "
                "trace_id=%s gate_id=%s",
                trace_id,
                gate_id,
            )

            raise HTTPException(status_code=409, detail="gate_must_be_offline")

        # Block deletion if an active assignment exists. The gate should be explicitly unassigned before deletion
        if self._get_active_assignment(gate_id) is not None:
            logger.warning(
                "gate delete failed: reason=gate_has_active_assignment status_code=409 "
                "trace_id=%s gate_id=%s",
                trace_id,
                gate_id,
            )

            raise HTTPException(status_code=409, detail="gate_has_active_assignment")

        try:
            self.db.delete(gate)
            self.db.commit()

        except IntegrityError:
            self.db.rollback()

            logger.warning(
                "gate delete failed: reason=gate_has_dependents status_code=409 "
                "trace_id=%s gate_id=%s",
                trace_id,
                gate_id,
            )
            raise HTTPException(status_code=409, detail="gate_has_dependents")

        logger.info(
            "gate delete succeeded: trace_id=%s gate_id=%s",
            trace_id,
            gate_id,
        )
