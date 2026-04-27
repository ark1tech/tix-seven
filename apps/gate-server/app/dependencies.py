from __future__ import annotations

from typing import Any

from fastapi import HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.security.api_key import APIKeyHeader

from app.core.config import settings
from app.core.supabase_jwt import verify_supabase_access_token

_x_gate_api_key_header = APIKeyHeader(name="X-Gate-Api-Key", auto_error=False)
_x_internal_api_key_header = APIKeyHeader(name="X-Internal-Api-Key", auto_error=False)
_http_bearer = HTTPBearer(auto_error=False)


def _unauthorized(detail: str = "not authenticated") -> HTTPException:
    return HTTPException(status_code=401, detail=detail)


def require_gate_hardware_api_key(
    api_key: str | None = Security(_x_gate_api_key_header),
) -> str:
    """POST /verify: X-Gate-Api-Key must match GATE_HARDWARE_API_KEY."""
    if api_key is None or api_key != settings.gate_hardware_api_key:
        raise _unauthorized()
    return api_key


def require_internal_api_key(
    internal_key: str | None = Security(_x_internal_api_key_header),
) -> str:
    """Dashboard command routes: X-Internal-Api-Key must match INTERNAL_API_KEY."""
    if internal_key is None or internal_key != settings.internal_api_key:
        raise _unauthorized()
    return internal_key


def require_supabase_jwt(
    creds: HTTPAuthorizationCredentials | None = Security(_http_bearer),
) -> dict[str, Any]:
    """Authorization: Bearer <JWT> validated with Supabase JWKS (ES256).

    Signature, ``exp``, and non-empty ``sub`` are always enforced. ``iss`` and
    ``aud`` are checked only when ``SUPABASE_JWT_EXPECTED_ISS`` / ``SUPABASE_JWT_EXPECTED_AUD`` are set.
    """
    if creds is None or creds.scheme.lower() != "bearer":
        raise _unauthorized()
    try:
        return verify_supabase_access_token(
            creds.credentials,
            jwks_url=settings.effective_supabase_jwks_url,
            expected_iss=settings.supabase_jwt_expected_iss,
            expected_aud=settings.supabase_jwt_expected_aud,
        )
    except ValueError:
        raise _unauthorized() from None
