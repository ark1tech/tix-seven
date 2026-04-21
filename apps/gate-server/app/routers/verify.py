from fastapi import APIRouter, Depends, HTTPException, Security
from fastapi.security.api_key import APIKeyHeader

from app.core.config import settings
from app.models.schemas import VerifyRequest, VerifyResponse
from app.services.verification import VerificationService

router = APIRouter()

_api_key_header = APIKeyHeader(name="X-Gate-Api-Key", auto_error=False)


def require_api_key(api_key: str | None = Security(_api_key_header)) -> str:
    if api_key != settings.gate_api_key:
        raise HTTPException(status_code=403, detail="Invalid API key")
    return api_key


def get_verification_service() -> VerificationService:
    return VerificationService()


@router.post("/verify", response_model=VerifyResponse)
def verify(
    body: VerifyRequest,
    _: str = Depends(require_api_key),
    service: VerificationService = Depends(get_verification_service),
) -> VerifyResponse:
    return service.verify(body.qr_payload, body.gate_id)
