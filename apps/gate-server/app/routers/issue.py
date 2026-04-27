import logging

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db.get_db import get_db
from app.dependencies import (
    require_internal_api_key,
    require_legacy_gate_api_key,
    require_supabase_jwt,
)
from app.models.schemas import IssueRequest, IssueResponse
from app.services.issuance import IssuanceService

router = APIRouter()
logger = logging.getLogger(__name__)


def get_issuance_service(db: Session = Depends(get_db)) -> IssuanceService:
    return IssuanceService(db=db)


@router.post(
    "/tickets/issue",
    response_model=IssueResponse,
    status_code=status.HTTP_201_CREATED,
)
def issue_tickets(
    body: IssueRequest,
    _: str = Depends(require_legacy_gate_api_key),
    service: IssuanceService = Depends(get_issuance_service),
) -> IssueResponse:
    logger.info(
        "issue command accepted: lane=legacy route=/tickets/issue event_id=%s",
        body.event_id,
    )
    return service.issue(body.qr_payload, body.event_id)


@router.post(
    "/dashboard/tickets/issue",
    response_model=IssueResponse,
    status_code=status.HTTP_201_CREATED,
)
def issue_tickets_dashboard(
    body: IssueRequest,
    _: str = Depends(require_internal_api_key),
    __: dict = Depends(require_supabase_jwt),
    service: IssuanceService = Depends(get_issuance_service),
) -> IssueResponse:
    logger.info(
        "issue command accepted: lane=dashboard route=/dashboard/tickets/issue event_id=%s",
        body.event_id,
    )
    return service.issue(body.qr_payload, body.event_id)
