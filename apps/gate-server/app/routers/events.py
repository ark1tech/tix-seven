import logging
from typing import Any
import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.trace import get_trace_id
from app.db.get_db import get_db
from app.dependencies import require_internal_api_key, require_supabase_jwt
from app.models.enums import TicketStatusEnum
from app.models.schemas import (
    EventCreateRequest,
    EventDetailResponse,
    EventResponse,
    EventStatusUpdateRequest,
    EventSummaryResponse,
    EventUpdateRequest,
    GateFilterOption,
    LogFilters,
    LogListResponse,
    TicketFilters,
    TicketListResponse,
)
from app.services.events import EventService
from app.services.logs import LogService
from app.services.tickets import TicketService

router = APIRouter()
logger = logging.getLogger(__name__)


def get_event_service(db: Session = Depends(get_db)) -> EventService:
    return EventService(db=db)


def get_ticket_service(db: Session = Depends(get_db)) -> TicketService:
    return TicketService(db=db)


def get_log_service(db: Session = Depends(get_db)) -> LogService:
    return LogService(db=db)


_INTERNAL = Depends(require_internal_api_key)
_JWT = Depends(require_supabase_jwt)


@router.get(
    "/dashboard/events",
    response_model=list[EventSummaryResponse],
    status_code=status.HTTP_200_OK,
)
def list_events(
    _: str = _INTERNAL,
    __: dict[str, Any] = _JWT,
    service: EventService = Depends(get_event_service),
) -> list[EventSummaryResponse]:
    logger.info(
        "event list command accepted: trace_id=%s route=GET /dashboard/events",
        get_trace_id(),
    )

    return service.get_events()


@router.get(
    "/dashboard/events/{event_id}/detail",
    response_model=EventDetailResponse,
    status_code=status.HTTP_200_OK,
)
def get_event_detail(
    event_id: uuid.UUID,
    _: str = _INTERNAL,
    __: dict[str, Any] = _JWT,
    service: EventService = Depends(get_event_service),
) -> EventDetailResponse:
    logger.info(
        "event detail command accepted: trace_id=%s route=GET /dashboard/events/{event_id} event_id=%s",
        get_trace_id(),
        event_id,
    )

    return service.get_detail(event_id)


@router.post(
    "/dashboard/events",
    response_model=EventResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_event(
    body: EventCreateRequest,
    _: str = _INTERNAL,
    __: dict[str, Any] = _JWT,
    service: EventService = Depends(get_event_service),
) -> EventResponse:
    logger.info(
        "event create command accepted: trace_id=%s route=POST /dashboard/events name=%s",
        get_trace_id(),
        body.name,
    )

    return service.create(body)


@router.patch(
    "/dashboard/events/{event_id}",
    response_model=EventResponse,
    status_code=status.HTTP_200_OK,
)
def update_event(
    event_id: uuid.UUID,
    body: EventUpdateRequest,
    _: str = _INTERNAL,
    __: dict[str, Any] = _JWT,
    service: EventService = Depends(get_event_service),
) -> EventResponse:
    logger.info(
        "event update command accepted: trace_id=%s route=PATCH /dashboard/events/{event_id} event_id=%s",
        get_trace_id(),
        event_id,
    )

    return service.update(event_id, body)


@router.patch(
    "/dashboard/events/{event_id}/status",
    response_model=EventResponse,
    status_code=status.HTTP_200_OK,
)
def transition_event_status(
    event_id: uuid.UUID,
    body: EventStatusUpdateRequest,
    _: str = _INTERNAL,
    __: dict[str, Any] = _JWT,
    service: EventService = Depends(get_event_service),
) -> EventResponse:
    logger.info(
        "event status transition command accepted: trace_id=%s route=PATCH /dashboard/events/{event_id}/status event_id=%s target=%s",
        get_trace_id(),
        event_id,
        body.status.value,
    )
    return service.transition_status(event_id, body)


@router.delete(
    "/dashboard/events/{event_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_event(
    event_id: uuid.UUID,
    _: str = _INTERNAL,
    __: dict[str, Any] = _JWT,
    service: EventService = Depends(get_event_service),
) -> None:
    logger.info(
        "event delete command accepted: trace_id=%s route=DELETE /dashboard/events/{event_id} event_id=%s",
        get_trace_id(),
        event_id,
    )

    service.delete(event_id)


# ---------------------------------------------------------------------------
# Tickets scoped to event
# ---------------------------------------------------------------------------


@router.get(
    "/dashboard/events/{event_id}/tickets",
    response_model=TicketListResponse,
    status_code=status.HTTP_200_OK,
)
def get_tickets(
    event_id: uuid.UUID,
    status_filter: TicketStatusEnum | None = Query(default=None, alias="status"),
    sort_by: str = Query(default="created_at", pattern="^(created_at|used_at)$"),
    sort_direction: str = Query(default="desc", pattern="^(asc|desc)$"),
    _: str = _INTERNAL,
    __: dict[str, Any] = _JWT,
    service: TicketService = Depends(get_ticket_service),
) -> TicketListResponse:
    logger.info(
        "ticket list command accepted: trace_id=%s route=GET /dashboard/events/{event_id}/tickets event_id=%s",
        get_trace_id(),
        event_id,
    )

    filters = TicketFilters(
        status=status_filter, sort_by=sort_by, sort_direction=sort_direction
    )

    return service.get_tickets(event_id, filters)


# ---------------------------------------------------------------------------
# Entry logs scoped to event
# ---------------------------------------------------------------------------

from datetime import datetime, timezone
from app.models.enums import ResultEnum


def parse_dt(raw: str | None):
    if raw is None:
        return None

    dt = datetime.fromisoformat(raw)

    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


@router.get(
    "/dashboard/events/{event_id}/logs",
    response_model=LogListResponse,
    status_code=status.HTTP_200_OK,
)
def get_logs(
    event_id: uuid.UUID,
    result: str | None = Query(default=None),
    gate_id: uuid.UUID | None = Query(default=None),
    from_time: str | None = Query(
        default=None, description="ISO 8601 datetime, inclusive"
    ),
    to_time: str | None = Query(
        default=None, description="ISO 8601 datetime, inclusive"
    ),
    _: str = _INTERNAL,
    __: dict[str, Any] = _JWT,
    service: LogService = Depends(get_log_service),
) -> LogListResponse:
    logger.info(
        "log list command accepted: trace_id=%s route=GET /dashboard/events/{event_id}/logs event_id=%s",
        get_trace_id(),
        event_id,
    )

    filters = LogFilters(
        result=ResultEnum(result) if result else None,
        gate_id=gate_id,
        from_time=parse_dt(from_time),
        to_time=parse_dt(to_time),
    )

    return service.get_logs(event_id, filters)


@router.get(
    "/dashboard/events/{event_id}/logs/gate-options",
    status_code=status.HTTP_200_OK,
)
def get_log_gate_options(
    event_id: uuid.UUID,
    _: str = _INTERNAL,
    __: dict[str, Any] = _JWT,
    service: LogService = Depends(get_log_service),
) -> list[GateFilterOption]:
    logger.info(
        "log gate-options command accepted: trace_id=%s route=GET /dashboard/events/{event_id}/logs/gate-options event_id=%s",
        get_trace_id(),
        event_id,
    )

    return service.get_gate_filter_options(event_id)
