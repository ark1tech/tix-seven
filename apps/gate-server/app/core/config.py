from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    supabase_url: str
    supabase_service_role_key: str
    hmac_pepper: str
    gate_api_key: str
    database_url: str

    # MOSIP
    mosip_partner_id: str
    mosip_partner_apikey: str
    mosip_partner_misp_lk: str
    mosip_keystore_password: str
    mosip_ida_domain_uri: str = "https://api-internal.pdec.mosip.net"
    mosip_ida_url: str = "https://api-internal.pdec.mosip.net/idauthentication/v1"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()  # type: ignore[call-arg]
