import logging
import uuid

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.trace import get_trace_id
from app.models.event import Event
from app.models.venue import Venue
from app.models.schemas import VenueCreateRequest, VenueResponse, VenueUpdateRequest

logger = logging.getLogger(__name__)


class VenueService:
    def __init__(self, db: Session) -> None:
        self.db = db

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _get_or_404(self, venue_id: uuid.UUID) -> Venue:
        venue = self.db.scalar(select(Venue).where(Venue.venue_id == venue_id))

        if venue is None:
            logger.warning(
                "venue not found: trace_id=%s venue_id=%s",
                get_trace_id(),
                venue_id,
            )

            raise HTTPException(status_code=404, detail="venue_not_found")

        return venue

    def _to_response(self, venue: Venue) -> VenueResponse:
        return VenueResponse(
            venue_id=venue.venue_id,
            name=venue.name,
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def create(self, body: VenueCreateRequest) -> VenueResponse:
        trace_id = get_trace_id()

        logger.info(
            "venue create start: trace_id=%s name=%s",
            trace_id,
            body.name,
        )

        venue = Venue(name=body.name)

        self.db.add(venue)
        self.db.commit()
        self.db.refresh(venue)

        logger.info(
            "venue create succeeded: trace_id=%s venue_id=%s",
            trace_id,
            venue.venue_id,
        )

        return self._to_response(venue)

    def get(self, venue_id: uuid.UUID) -> VenueResponse:
        return self._to_response(self._get_or_404(venue_id))

    def get_all(self) -> list[VenueResponse]:
        venues = self.db.scalars(select(Venue).order_by(Venue.name)).all()

        return [self._to_response(venue) for venue in venues]

    def update(self, venue_id: uuid.UUID, body: VenueUpdateRequest) -> VenueResponse:
        trace_id = get_trace_id()

        logger.info(
            "venue update start: trace_id=%s venue_id=%s",
            trace_id,
            venue_id,
        )

        venue = self._get_or_404(venue_id)
        venue.name = body.name

        self.db.commit()
        self.db.refresh(venue)

        logger.info(
            "venue update succeeded: trace_id=%s venue_id=%s",
            trace_id,
            venue_id,
        )

        return self._to_response(venue)

    def delete(self, venue_id: uuid.UUID) -> None:
        """
        Hard-delete a venue.
        """

        trace_id = get_trace_id()
        logger.info(
            "venue delete start: trace_id=%s venue_id=%s",
            trace_id,
            venue_id,
        )

        venue = self._get_or_404(venue_id)

        has_events = self.db.scalar(
            select(Event.event_id).where(Event.venue_id == venue_id).limit(1)
        )

        # Blocked if any events still reference this venue; the operator must reassign or delete those events first
        if has_events is not None:
            logger.warning(
                "venue delete failed: reason=venue_has_events status_code=409 "
                "trace_id=%s venue_id=%s",
                trace_id,
                venue_id,
            )

            raise HTTPException(status_code=409, detail="venue_has_events")

        self.db.delete(venue)
        self.db.commit()

        logger.info(
            "venue delete succeeded: trace_id=%s venue_id=%s",
            trace_id,
            venue_id,
        )