from fastapi import HTTPException, Security
from fastapi.security.api_key import APIKeyHeader

from app.core.config import settings

_api_key_header = APIKeyHeader(name="X-Gate-Api-Key", auto_error=False)


def require_api_key(api_key: str | None = Security(_api_key_header)) -> str:
    if api_key != settings.gate_api_key:
        raise HTTPException(status_code=403, detail="Invalid API key")

    return api_key
