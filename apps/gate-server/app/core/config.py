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
    database_url: str

    # Server-to-server key — Next.js sends as X-Internal-Api-Key on POST /dashboard/tickets/issue
    internal_api_key: str
    # Hardware pre-shared key — ESP8266 sends as X-Gate-Api-Key on POST /verify
    gate_hardware_api_key: str

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

    use_stub_mosip: bool = False

    # Live presentation: log full UIN/PSUT only when explicitly enabled (default masked).
    demo_log_identity_values: bool = False
    # Simulate missing MOSIP authenticator (no SDK calls; credential files not required).
    demo_disable_mosip_authenticator: bool = False

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
