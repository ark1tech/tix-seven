"""Verify Supabase JWTs with JWKS (ES256, signature + claims)."""

from __future__ import annotations

from functools import lru_cache
from typing import Any

import jwt
from jwt import PyJWKClient, PyJWTError


def verify_supabase_access_token(
    token: str,
    *,
    jwks_url: str,
    expected_iss: str | None = None,
    expected_aud: str | list[str] | None = None,
) -> dict[str, Any]:
    if not token or not str(token).strip():
        raise ValueError("missing token")
    if not jwks_url or not str(jwks_url).strip():
        raise ValueError("missing jwks url")

    options: dict[str, Any] = {
        "verify_signature": True,
        "verify_exp": True,
        "verify_iss": expected_iss is not None,
        "verify_aud": expected_aud is not None,
        "require": ["sub", "exp"],
    }
    decode_kwargs: dict[str, Any] = {
        "algorithms": ["ES256"],
        "options": options,
    }
    if expected_iss is not None:
        decode_kwargs["issuer"] = expected_iss
    if expected_aud is not None:
        decode_kwargs["audience"] = expected_aud

    try:
        signing_key = _get_jwks_client(jwks_url).get_signing_key_from_jwt(token)
        payload = jwt.decode(token, signing_key.key, **decode_kwargs)
    except PyJWTError as e:
        raise ValueError("invalid token") from e

    sub = payload.get("sub")
    if sub is None or sub == "":
        raise ValueError("missing sub")

    return payload


@lru_cache(maxsize=8)
def _get_jwks_client(jwks_url: str) -> PyJWKClient:
    return PyJWKClient(jwks_url)
