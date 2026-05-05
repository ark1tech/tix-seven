import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.trace import get_trace_id
from app.db.get_db import get_db
from app.dependencies import (
    require_internal_api_key,
    require_supabase_jwt,
)
from app.models.schemas import IssueRequest, IssueResponse
from app.services.issuance import IssuanceService, IssueError

router = APIRouter()
logger = logging.getLogger(__name__)


def get_issuance_service(db: Session = Depends(get_db)) -> IssuanceService:
    return IssuanceService(db=db)


@router.post(
    "/dashboard/tickets/issue",
    response_model=IssueResponse,
    status_code=status.HTTP_201_CREATED,
)
def issue_tickets_dashboard(
    body: IssueRequest,
    _: str = Depends(require_internal_api_key),
    __: dict[str, Any] = Depends(require_supabase_jwt),
    service: IssuanceService = Depends(get_issuance_service),
) -> IssueResponse:
    logger.info(
        "issue command accepted: trace_id=%s lane=dashboard route=/dashboard/tickets/issue event_id=%s",
        get_trace_id(),
        body.event_id,
    )

    try:
        return service.issue(body.qr_payload, body.event_id, body.stub_mosip)
    except IssueError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc
