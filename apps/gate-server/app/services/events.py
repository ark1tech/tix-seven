import logging
import uuid

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.trace import get_trace_id
from app.models.enums import EventStatusEnum
from app.models.event import Event
from app.models.schemas import (
    AssignedGate,
    EventCreateRequest,
    EventDetailResponse,
    EventResponse,
    EventStatusUpdateRequest,
    EventSummaryResponse,
    TicketSummary,
    EventUpdateRequest,
)
from app.repositories.event import EventRepository
from app.repositories.venue import VenueRepository
from app.repositories.ticket import TicketRepository


logger = logging.getLogger(__name__)

# Permitted forward-only status transitions
_VALID_TRANSITIONS: dict[EventStatusEnum, set[EventStatusEnum]] = {
    EventStatusEnum.SCHEDULED: {EventStatusEnum.ACTIVE, EventStatusEnum.CANCELLED},
    EventStatusEnum.ACTIVE: {EventStatusEnum.CONCLUDED, EventStatusEnum.CANCELLED},
}


class EventService:
    def __init__(
        self,
        db: Session,
        events: EventRepository | None = None,
        venues: VenueRepository | None = None,
        tickets: TicketRepository | None = None,
    ) -> None:
        self.db = db
        self.events = events or EventRepository(db)
        self.venues = venues or VenueRepository(db)
        self.tickets = tickets or TicketRepository(db)

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _get_or_404(self, event_id: uuid.UUID) -> Event:
        """
        Fetch an event with its venue.
        """

        event = self.events.get_by_id_with_venue(event_id)

        if event is None:
            logger.warning(
                "event not found: trace_id=%s event_id=%s",
                get_trace_id(),
                event_id,
            )

            raise HTTPException(status_code=404, detail="event_not_found")

        return event

    def _assert_venue_exists(self, venue_id: uuid.UUID) -> None:
        if not self.venues.exists(venue_id):
            logger.warning(
                "event operation failed: trace_id=%s venue_id=%s reason=VENUE_NOT_FOUND",
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
                "event update failed: trace_id=%s event_id=%s reason=EVENT_%s",
                get_trace_id(),
                event.event_id,
                event.status.value,
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

        if self.events.has_gate_assignments(event_id):
            logger.warning(
                "event update failed: trace_id=%s event_id=%s reason=EVENT_HAS_GATE_ASSIGNMENTS",
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
            name=event.name,
            status=event.status,
            venue_id=event.venue_id,
            venue_name=venue_name,
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
        return [self._to_response(event) for event in self.events.get_all_with_venue()]

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
                "event update failed: trace_id=%s event_id=%s reason=END_TIME_BEFORE_START_TIME",
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
                "event status transition failed: trace_id=%s event_id=%s "
                "reason=INVALID_STATUS_TRANSITION current_status=%s target_status=%s",
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
                "event delete failed: trace_id=%s event_id=%s reason=EVENT_%s",
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
                "event delete failed: trace_id=%s event_id=%s reason=EVENT_HAS_DEPENDENTS",
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

    # ------------------------------------------------------------------
    # Event List View
    # ------------------------------------------------------------------

    def get_events(self) -> list[EventSummaryResponse]:
        """
        Return all events with their admitted count.
        """

        trace_id = get_trace_id()

        logger.info(
            "event get_events start: trace_id=%s",
            trace_id,
        )

        events = self.events.get_all_with_venue()

        if not events:
            return []

        event_ids = [event.event_id for event in events]

        admitted_counts_in_bulk = self.events.get_admitted_counts_in_bulk(event_ids)

        result = [
            EventSummaryResponse(
                event_id=event.event_id,
                name=event.name,
                status=event.status,
                venue_name=event.venue.name,
                start_time=event.start_time,
                end_time=event.end_time,
                capacity=event.capacity,
                admitted_count=admitted_counts_in_bulk.get(event.event_id, 0),
            )
            for event in events
        ]

        logger.info(
            "event get_events succeeded: trace_id=%s count=%d",
            trace_id,
            len(result),
        )

        return result

    # ------------------------------------------------------------------
    # Event Detail View
    # ------------------------------------------------------------------

    def get_detail(self, event_id: uuid.UUID) -> EventDetailResponse:
        trace_id = get_trace_id()
        logger.info(
            "event get_detail start: trace_id=%s event_id=%s",
            trace_id,
            event_id,
        )

        event = self._get_or_404(event_id)

        admitted_count = self.events.get_admitted_count(event_id)

        gates = self.events.get_assigned_gates(event_id)

        assigned_gates = [
            AssignedGate(
                gate_id=gate.gate_id,
                location=gate.location,
                status=gate.status,
                assignment_id=assignment_id,
            )
            for gate, assignment_id in gates
        ]

        summary = self.tickets.get_summary(event_id)

        ticket_summary = TicketSummary(
            total=summary.total,
            used=summary.used,
            unused=summary.unused,
        )

        logger.info(
            "event get_detail succeeded: trace_id=%s event_id=%s",
            trace_id,
            event_id,
        )

        return EventDetailResponse(
            event_id=event.event_id,
            name=event.name,
            status=event.status,
            venue_id=event.venue_id,
            venue_name=event.venue.name,
            start_time=event.start_time,
            end_time=event.end_time,
            capacity=event.capacity,
            admitted_count=admitted_count,
            assigned_gates=assigned_gates,
            ticket_summary=ticket_summary,
        )
