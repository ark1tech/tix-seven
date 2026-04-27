from pathlib import Path
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


# `config.py` is at apps/gate-server/app/core/config.py → parents[2] is apps/gate-server
_GATE_SERVER_DIR = Path(__file__).resolve().parents[2]
_ROOT_ENV_FILE = _GATE_SERVER_DIR / ".env"


class Settings(BaseSettings):
    supabase_url: str
    supabase_service_role_key: str
    hmac_pepper: str
    """Legacy single key; used as fallback for hardware and internal during migration."""
    gate_api_key: Optional[str] = None
    database_url: str

    # Split keys (optional; fall back to gate_api_key when unset)
    internal_api_key: Optional[str] = None
    gate_hardware_api_key: Optional[str] = None

    # Supabase JWT verification (JWKS / ES256). Optional iss/aud enforcement.
    supabase_jwks_url: Optional[str] = None
    """Override JWKS URL; default is ``{supabase_url}/auth/v1/.well-known/jwks.json``."""
    supabase_jwt_expected_iss: Optional[str] = None
    """When set, the JWT ``iss`` claim must match (e.g. ``{supabase_url}/auth/v1``)."""
    supabase_jwt_expected_aud: Optional[str] = None
    """When set, the JWT ``aud`` claim must match (e.g. ``authenticated``)."""

    # MOSIP credentials must come from environment variables / .env
    mosip_partner_id: Optional[str] = None
    mosip_partner_apikey: Optional[str] = None
    mosip_partner_misp_lk: Optional[str] = None
    mosip_keystore_password: Optional[str] = None
    mosip_ida_domain_uri: str = "https://api-internal.pdec.mosip.net"
    mosip_ida_url: str = "https://api-internal.pdec.mosip.net/idauthentication/v1"

    @staticmethod
    def _resolve_api_key(*candidates: Optional[str]) -> str:
        for candidate in candidates:
            if candidate and candidate.strip():
                return candidate.strip()
        raise ValueError(
            "Missing API key configuration. Set INTERNAL_API_KEY/GATE_HARDWARE_API_KEY "
            "or temporary fallback GATE_API_KEY."
        )

    @property
    def effective_hardware_api_key(self) -> str:
        return self._resolve_api_key(self.gate_hardware_api_key, self.gate_api_key)

    @property
    def effective_internal_api_key(self) -> str:
        return self._resolve_api_key(self.internal_api_key, self.gate_api_key)

    @property
    def supabase_auth_issuer(self) -> str:
        return f"{self.supabase_url.rstrip('/')}/auth/v1"

    @property
    def effective_supabase_jwks_url(self) -> str:
        if self.supabase_jwks_url and self.supabase_jwks_url.strip():
            return self.supabase_jwks_url.strip()
        return f"{self.supabase_auth_issuer}/.well-known/jwks.json"

    model_config = SettingsConfigDict(env_file=str(_ROOT_ENV_FILE), extra="ignore")


settings = Settings()  # type: ignore[call-arg]
