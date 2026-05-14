from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.get_db import get_db
from app.dependencies import require_gate_hardware_api_key
from app.models.schemas import VerifyRequest, VerifyResponse
from app.services.verification import VerificationService

router = APIRouter()


def get_verification_service(db: Session = Depends(get_db)) -> VerificationService:
    return VerificationService(db=db)


@router.post("/verify", response_model=VerifyResponse)
def verify(
    body: VerifyRequest,
    _: str = Depends(require_gate_hardware_api_key),
    service: VerificationService = Depends(get_verification_service),
) -> VerifyResponse:
    return service.verify(body.qr_payload, body.gate_id, body.stub_mosip or False)
