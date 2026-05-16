import logging
from typing import Any
import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.trace import get_trace_id
from app.db.get_db import get_db
from app.dependencies import require_internal_api_key, require_supabase_jwt
from app.models.schemas import GateCreateRequest, GateResponse, GateUpdateRequest
from app.services.gates import GateService

router = APIRouter()
logger = logging.getLogger(__name__)


def get_gate_service(db: Session = Depends(get_db)) -> GateService:
    return GateService(db=db)


_INTERNAL = Depends(require_internal_api_key)
_JWT = Depends(require_supabase_jwt)


@router.post(
    "/dashboard/gates",
    response_model=GateResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_gate(
    body: GateCreateRequest,
    _: str = _INTERNAL,
    __: dict[str, Any] = _JWT,
    service: GateService = Depends(get_gate_service),
) -> GateResponse:
    logger.info(
        "gate create command accepted: trace_id=%s route=POST /dashboard/gates location=%s",
        get_trace_id(),
        body.location,
    )

    return service.create(body)


@router.patch(
    "/dashboard/gates/{gate_id}",
    response_model=GateResponse,
    status_code=status.HTTP_200_OK,
)
def update_gate(
    gate_id: uuid.UUID,
    body: GateUpdateRequest,
    _: str = _INTERNAL,
    __: dict[str, Any] = _JWT,
    service: GateService = Depends(get_gate_service),
) -> GateResponse:
    logger.info(
        "gate update command accepted: trace_id=%s route=PATCH /dashboard/gates/{gate_id} gate_id=%s",
        get_trace_id(),
        gate_id,
    )

    return service.update(gate_id, body)


@router.delete(
    "/dashboard/gates/{gate_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_gate(
    gate_id: uuid.UUID,
    _: str = _INTERNAL,
    __: dict[str, Any] = _JWT,
    service: GateService = Depends(get_gate_service),
) -> None:
    logger.info(
        "gate delete command accepted: trace_id=%s route=DELETE /dashboard/gates/{gate_id} gate_id=%s",
        get_trace_id(),
        gate_id,
    )

    service.delete(gate_id)
