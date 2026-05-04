import logging
from typing import Any
import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.trace import get_trace_id
from app.db.get_db import get_db
from app.dependencies import require_internal_api_key, require_supabase_jwt
from app.models.schemas import EventCreateRequest, EventResponse, EventUpdateRequest
from app.services.events import EventService

router = APIRouter()
logger = logging.getLogger(__name__)


def get_event_service(db: Session = Depends(get_db)) -> EventService:
    return EventService(db=db)


@router.post(
    "/dashboard/events",
    response_model=EventResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_event(
    body: EventCreateRequest,
    _: str = Depends(require_internal_api_key),
    __: dict[str, Any] = Depends(require_supabase_jwt),
    service: EventService = Depends(get_event_service),
) -> EventResponse:
    logger.info(
        "event create command accepted: trace_id=%s route=/dashboard/events name=%s",
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
    _: str = Depends(require_internal_api_key),
    __: dict[str, Any] = Depends(require_supabase_jwt),
    service: EventService = Depends(get_event_service),
) -> EventResponse:
    logger.info(
        "event update command accepted: trace_id=%s route=/dashboard/events/{event_id} event_id=%s",
        get_trace_id(),
        event_id,
    )
    return service.update(event_id, body)
