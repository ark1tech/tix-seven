from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.db.get_db import get_db
from app.dependencies import require_api_key
from app.models.schemas import IssueRequest, IssueResponse
from app.services.issuance import IssuanceService

router = APIRouter()


def get_issuance_service(db: Session = Depends(get_db)) -> IssuanceService:
    return IssuanceService(db=db)


@router.post(
    "/tickets/issue",
    response_model=IssueResponse,
    status_code=status.HTTP_201_CREATED,
)
def issue_tickets(
    body: IssueRequest,
    _: str = Depends(require_api_key),
    service: IssuanceService = Depends(get_issuance_service),
) -> IssueResponse:
    return service.issue(body.qr_payload, body.event_id)
