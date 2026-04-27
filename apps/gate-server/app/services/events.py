import logging
import uuid

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.core.trace import get_trace_id
from app.models.event import Event
from app.models.schemas import EventCreateRequest, EventResponse, EventUpdateRequest
from app.models.venue import Venue

logger = logging.getLogger(__name__)


class EventService:
    def __init__(self, db: Session) -> None:
        self.db = db

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _upsert_venue(self, name: str) -> uuid.UUID:
        """Insert venue by name if it doesn't exist, return its venue_id."""
        stmt = (
            pg_insert(Venue)
            .values(name=name)
            .on_conflict_do_update(index_elements=["name"], set_={"name": name})
            .returning(Venue.venue_id)
        )
        venue_id: uuid.UUID = self.db.execute(stmt).scalar_one()
        return venue_id

    def _to_response(self, event: Event) -> EventResponse:
        venue_name = event.venue.name if event.venue else ""
        return EventResponse(
            event_id=event.event_id,
            venue_id=event.venue_id,
            venue_name=venue_name,
            name=event.name,
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
            "event create start: trace_id=%s name=%s venue_name=%s",
            trace_id,
            body.name,
            body.venue_name,
        )

        venue_id = self._upsert_venue(body.venue_name)

        event = Event(
            venue_id=venue_id,
            name=body.name,
            start_time=body.start_time,
            end_time=body.end_time,
            capacity=body.capacity,
        )
        self.db.add(event)
        self.db.commit()
        self.db.refresh(event)

        logger.info(
            "event create succeeded: trace_id=%s event_id=%s status_code=201",
            trace_id,
            event.event_id,
        )
        return self._to_response(event)

    def update(self, event_id: uuid.UUID, body: EventUpdateRequest) -> EventResponse:
        trace_id = get_trace_id()
        logger.info(
            "event update start: trace_id=%s event_id=%s",
            trace_id,
            event_id,
        )

        event = self.db.scalar(select(Event).where(Event.event_id == event_id))
        if event is None:
            logger.warning(
                "event update failed: reason=event_not_found status_code=404 trace_id=%s event_id=%s",
                trace_id,
                event_id,
            )
            raise HTTPException(status_code=404, detail="event_not_found")

        fields = body.model_fields_set
        if "venue_name" in fields and body.venue_name is not None:
            event.venue_id = self._upsert_venue(body.venue_name)
        if "name" in fields and body.name is not None:
            event.name = body.name
        if "start_time" in fields and body.start_time is not None:
            event.start_time = body.start_time
        if "end_time" in fields and body.end_time is not None:
            event.end_time = body.end_time
        if "capacity" in fields and body.capacity is not None:
            event.capacity = body.capacity

        self.db.commit()
        self.db.refresh(event)

        logger.info(
            "event update succeeded: trace_id=%s event_id=%s status_code=200",
            trace_id,
            event_id,
        )
        return self._to_response(event)
