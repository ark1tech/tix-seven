import logging
import uuid

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.core.trace import get_trace_id
from app.models.enums import EventStatusEnum
from app.models.event import Event
from app.models.gate_assignment import GateAssignment
from app.models.schemas import (
    EventCreateRequest,
    EventResponse,
    EventStatusUpdateRequest,
    EventUpdateRequest,
)
from app.models.venue import Venue

logger = logging.getLogger(__name__)

# Permitted forward-only status transitions
_VALID_TRANSITIONS: dict[EventStatusEnum, set[EventStatusEnum]] = {
    EventStatusEnum.SCHEDULED: {EventStatusEnum.ACTIVE, EventStatusEnum.CANCELLED},
    EventStatusEnum.ACTIVE: {EventStatusEnum.CONCLUDED, EventStatusEnum.CANCELLED},
}


class EventService:
    def __init__(self, db: Session) -> None:
        self.db = db

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _get_or_404(self, event_id: uuid.UUID) -> Event:
        """
        Fetch an event with its venue.
        """

        event = self.db.scalar(
            select(Event)
            .options(joinedload(Event.venue))
            .where(Event.event_id == event_id)
        )

        if event is None:
            logger.warning(
                "event not found: trace_id=%s event_id=%s",
                get_trace_id(),
                event_id,
            )

            raise HTTPException(status_code=404, detail="event_not_found")

        return event

    def _assert_venue_exists(self, venue_id: uuid.UUID) -> None:
        venue = self.db.scalar(select(Venue).where(Venue.venue_id == venue_id))

        if venue is None:
            logger.warning(
                "event operation failed: reason=venue_not_found status_code=404 "
                "trace_id=%s venue_id=%s",
                get_trace_id(),
                venue_id,
            )

            raise HTTPException(status_code=404, detail="venue_not_found")

    def _assert_mutable(self, event: Event) -> None:
        """
        Reject field mutations on CONCLUDED events.
        
        Note that ACTIVE events are mutable for capacity adjustments but time-window shifts are dangerous mid-scan.
        """

        if event.status in (EventStatusEnum.CONCLUDED, EventStatusEnum.CANCELLED):
            logger.warning(
                "event operation failed: reason=event_%s status_code=409 "
                "trace_id=%s event_id=%s",
                event.status.value.lower(),
                get_trace_id(),
                event.event_id,
            )

            raise HTTPException(
                status_code=409,
                detail=f"event_{event.status.value.lower()}",
            )

    # Paul: Arbitrary choice to block venue changes if any gate assignments exist even if they are all inactive.

    # The presence of any assignment indicates that gates from the original venue were historically linked to this event and moving the event would make those assignments' venue_id inconsistent with the event's new venue.
    def _assert_no_gate_assignments(self, event_id: uuid.UUID) -> None:
        """
        Block venue reassignment if any GateAssignment already exists for this event.

        Even inactive assignments indicate that gates from the original venue were historically linked to this event.
        """

        has_assignments = self.db.scalar(
            select(GateAssignment.assignment_id)
            .where(GateAssignment.event_id == event_id)
            .limit(1)
        )

        if has_assignments is not None:
            logger.warning(
                "event venue update failed: reason=event_has_gate_assignments "
                "status_code=409 trace_id=%s event_id=%s",
                get_trace_id(),
                event_id,
            )

            raise HTTPException(
                status_code=409,
                detail="event_has_gate_assignments",
            )

    def _to_response(self, event: Event) -> EventResponse:
        venue_name = event.venue.name if event.venue else ""

        return EventResponse(
            event_id=event.event_id,
            venue_id=event.venue_id,
            venue_name=venue_name,
            name=event.name,
            status=event.status,
            start_time=event.start_time,
            end_time=event.end_time,
            capacity=event.capacity,
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def create(self, body: EventCreateRequest) -> EventResponse:
        trace_id = get_trace_id()
        logger.info(
            "event create start: trace_id=%s venue_id=%s name=%s",
            trace_id,
            body.venue_id,
            body.name,
        )

        self._assert_venue_exists(body.venue_id)

        event = Event(
            venue_id=body.venue_id,
            name=body.name,
            start_time=body.start_time,
            end_time=body.end_time,
            capacity=body.capacity,
        )

        self.db.add(event)
        self.db.commit()

        event = self._get_or_404(event.event_id)

        logger.info(
            "event create succeeded: trace_id=%s event_id=%s",
            trace_id,
            event.event_id,
        )

        return self._to_response(event)

    def get(self, event_id: uuid.UUID) -> EventResponse:
        return self._to_response(self._get_or_404(event_id))

    def get_all(self) -> list[EventResponse]:
        events = self.db.scalars(
            select(Event)
            .options(joinedload(Event.venue))
            .order_by(Event.start_time)
        ).all()

        return [self._to_response(event) for event in events]

    def update(self, event_id: uuid.UUID, body: EventUpdateRequest) -> EventResponse:
        trace_id = get_trace_id()

        logger.info(
            "event update start: trace_id=%s event_id=%s",
            trace_id,
            event_id,
        )

        event = self._get_or_404(event_id)
        self._assert_mutable(event)

        fields = body.model_fields_set

        if "venue_id" in fields and body.venue_id is not None:
            self._assert_no_gate_assignments(event_id)

            self._assert_venue_exists(body.venue_id)

            event.venue_id = body.venue_id

        if "name" in fields and body.name is not None:
            event.name = body.name

        if "start_time" in fields and body.start_time is not None:
            event.start_time = body.start_time

        if "end_time" in fields and body.end_time is not None:
            event.end_time = body.end_time

        if "capacity" in fields and body.capacity is not None:
            event.capacity = body.capacity

        try:
            self.db.commit()

        except IntegrityError:
            self.db.rollback()

            logger.warning(
                "event update failed: reason=invalid_time_range status_code=422 "
                "trace_id=%s event_id=%s",
                trace_id,
                event_id,
            )

            raise HTTPException(
                status_code=422,
                detail="end_time_must_be_after_start_time",
            )

        event = self._get_or_404(event_id)

        logger.info(
            "event update succeeded: trace_id=%s event_id=%s",
            trace_id,
            event_id,
        )

        return self._to_response(event)

    def transition_status(
        self, event_id: uuid.UUID, body: EventStatusUpdateRequest
    ) -> EventResponse:
        """
        Advance the event through its SCHEDULED to ACTIVE to CONCLUDED lifecycle.

        Reverse transitions and skipping steps are rejected.
        """

        # Paul: There are cron jobs to transition the status but we have this for fun

        trace_id = get_trace_id()

        logger.info(
            "event status transition start: trace_id=%s event_id=%s target_status=%s",
            trace_id,
            event_id,
            body.status.value,
        )
 
        event = self._get_or_404(event_id)
 
        allowed = _VALID_TRANSITIONS.get(event.status, set())
 
        if body.status not in allowed:
            logger.warning(
                "event status transition failed: reason=invalid_transition "
                "status_code=409 trace_id=%s event_id=%s "
                "current_status=%s target_status=%s",
                trace_id,
                event_id,
                event.status.value,
                body.status.value,
            )
            raise HTTPException(
                status_code=409,
                detail="invalid_status_transition",
            )
 
        event.status = body.status
        self.db.commit()
 
        event = self._get_or_404(event_id)
 
        logger.info(
            "event status transition succeeded: trace_id=%s event_id=%s new_status=%s",
            trace_id,
            event_id,
            event.status.value,
        )
 
        return self._to_response(event)

    def delete(self, event_id: uuid.UUID) -> None:
        """
        Hard-delete an event.
 
        SCHEDULED events that were never activated can be freely removed. 
        
        CANCELLED events may also be deleted once operators have confirmed there is no further need to retain the record.
        """

        trace_id = get_trace_id()

        logger.info(
            "event delete start: trace_id=%s event_id=%s",
            trace_id,
            event_id,
        )
 
        event = self._get_or_404(event_id)
 
        if event.status not in (EventStatusEnum.SCHEDULED, EventStatusEnum.CANCELLED):
            logger.warning(
                "event delete failed: reason=event_not_deletable status_code=409 "
                "trace_id=%s event_id=%s status=%s",
                trace_id,
                event_id,
                event.status.value,
            )

            raise HTTPException(
                status_code=409,
                detail="only_scheduled_or_cancelled_events_can_be_deleted",
            )
 
        try:
            self.db.delete(event)
            self.db.commit()

        except IntegrityError:
            self.db.rollback()

            logger.warning(
                "event delete failed: reason=event_has_dependents status_code=409 "
                "trace_id=%s event_id=%s",
                trace_id,
                event_id,
            )

            raise HTTPException(
                status_code=409,
                detail="event_has_dependents",
            )
 
        logger.info(
            "event delete succeeded: trace_id=%s event_id=%s",
            trace_id,
            event_id,
        )