import datetime
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.enums import AssignmentStatusEnum
from app.models.gate import Gate
from app.models.gate_assignment import GateAssignment


class GateRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_id(self, gate_id: uuid.UUID) -> Gate | None:
        """
        Look up a gate by ID.
        """

        return self.db.scalar(select(Gate).where(Gate.gate_id == gate_id))

    def get_all(self) -> list[Gate]:
        """
        Retrieve all gates.
        """

        return list(self.db.scalars(select(Gate).order_by(Gate.location)).all())  # Arbitrary order

    def get_active_assignment(self, gate_id: uuid.UUID) -> GateAssignment | None:
        """
        Look up the active assignment for a gate if it exists.
        """

        return self.db.scalar(
            select(GateAssignment).where(
                GateAssignment.gate_id == gate_id,
                GateAssignment.status == AssignmentStatusEnum.ACTIVE,
            )
        )

    def get_active_event_id(self, gate_id: uuid.UUID) -> uuid.UUID | None:
        """
        Look up the event_id for the gate's active assignment if it exists.
        """
        
        return self.db.scalar(
            select(GateAssignment.event_id).where(
                GateAssignment.gate_id == gate_id,
                GateAssignment.status == AssignmentStatusEnum.ACTIVE,
            )
        )

    def get_active_assignment_and_event_ids(
        self, gate_id: uuid.UUID
    ) -> tuple[uuid.UUID, uuid.UUID] | None:
        """
        Return (assignment_id, event_id) for the gate's current active assignment, or None if no such assignment exists.
        """

        stmt = select(
            GateAssignment.assignment_id,
            GateAssignment.event_id,
        ).where(
            GateAssignment.gate_id == gate_id,
            GateAssignment.status == AssignmentStatusEnum.ACTIVE,
        )

        result = self.db.execute(stmt).first()

        return tuple(result) if result is not None else None

    def create_assignment(
        self,
        gate_id: uuid.UUID,
        event_id: uuid.UUID,
        now: datetime.datetime,
    ) -> None:
        """
        Create a new ACTIVE assignment between the gate and event.

        Caller is responsible for ensuring that the gate is not assigned to an ongoing event.
        """

        self.db.add(
            GateAssignment(
                gate_id=gate_id,
                event_id=event_id,
                status=AssignmentStatusEnum.ACTIVE,
                assigned_at=now,
            )
        )

    def deactivate_assignment(
        self, assignment: GateAssignment, now: datetime.datetime
    ) -> None:
        """
        Mark an ACTIVE assignment as INACTIVE.

        Caller is responsible for ensuring that the gate is not assigned to an ongoing event.
        """

        assignment.status = AssignmentStatusEnum.INACTIVE
        assignment.unassigned_at = now
