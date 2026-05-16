from __future__ import annotations
 
import logging
import uuid
 
from fastapi import HTTPException
from sqlalchemy.orm import Session
 
from app.core.trace import get_trace_id
from app.repositories.event import EventRepository
from app.repositories.ticket import TicketRepository
 
from app.models.schemas import (
    TicketEntry,
    TicketFilters,
    TicketListResponse,
)


logger = logging.getLogger(__name__)


class TicketService:
    def __init__(
        self,
        db: Session,
        tickets: TicketRepository | None = None,
        events: EventRepository | None = None,
    ) -> None:
        self.db = db
        self.tickets = tickets or TicketRepository(db)
        self.events = events or EventRepository(db)

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _assert_event_exists(self, event_id: uuid.UUID) -> None:
        if not self.events.get_by_id(event_id):
            logger.warning(
                "ticket service: event not found trace_id=%s event_id=%s",
                get_trace_id(),
                event_id,
            )

            raise HTTPException(status_code=404, detail="event_not_found")

    def _validated_sort(self, sort_by: str, sort_direction: str) -> tuple[str, str]:
        if sort_by not in {"created_at", "used_at"}:
            sort_by = "created_at"

        if sort_direction not in {"asc", "desc"}:
            sort_direction = "desc"

        return sort_by, sort_direction

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def get_tickets(
        self,
        event_id: uuid.UUID,
        filters: TicketFilters,
    ) -> TicketListResponse:
        """
        Return the full ticket table payload for the Ticket Issuance View.
        """

        trace_id = get_trace_id()
        logger.info(
            "ticket list start: trace_id=%s event_id=%s",
            trace_id,
            event_id,
        )

        self._assert_event_exists(event_id)

        sort_by, sort_direction = self._validated_sort(
            filters.sort_by or "created_at",
            filters.sort_direction or "desc",
        )

        # Summary is always unfiltered
        summary = self.tickets.get_summary(event_id)

        # Rows respect filter and sort
        rows = self.tickets.get_all_tickets_by_event(
            event_id,
            status=filters.status,
            sort_by=sort_by,
            sort_direction=sort_direction,
        )

        tickets = [
            TicketEntry(
                ticket_id=ticket.ticket_id,
                status=ticket.status,
                created_at=ticket.created_at,
                used_at=ticket.used_at,
                link_id=ticket.link_id,
            )
            for ticket in rows
        ]

        logger.info(
            "ticket list succeeded: trace_id=%s event_id=%s count=%d",
            trace_id,
            event_id,
            len(tickets),
        )

        return TicketListResponse(summary=summary, tickets=tickets)