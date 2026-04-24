from pathlib import Path
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


# `config.py` is at apps/gate-server/app/core/config.py → parents[2] is apps/gate-server
_GATE_SERVER_DIR = Path(__file__).resolve().parents[2]
_ROOT_ENV_FILE = _GATE_SERVER_DIR / ".env"


class Settings(BaseSettings):
    supabase_url: str
    supabase_service_role_key: str
    hmac_pepper: str
    gate_api_key: str
    database_url: str

    # MOSIP credentials must come from environment variables / .env
    mosip_partner_id: Optional[str] = None
    mosip_partner_apikey: Optional[str] = None
    mosip_partner_misp_lk: Optional[str] = None
    mosip_keystore_password: Optional[str] = None
    mosip_ida_domain_uri: str = "https://api-internal.pdec.mosip.net"
    mosip_ida_url: str = "https://api-internal.pdec.mosip.net/idauthentication/v1"

    model_config = SettingsConfigDict(env_file=str(_ROOT_ENV_FILE), extra="ignore")


settings = Settings()  # type: ignore[call-arg]
