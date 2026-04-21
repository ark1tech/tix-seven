import os
from dataclasses import dataclass
from typing import Optional, Protocol

from dynaconf import Dynaconf
from mosip_auth_sdk import MOSIPAuthenticator
from mosip_auth_sdk.models import DemographicsModel

from app.core.config import settings

# Credential files live next to this package, one level up from app/
_CREDS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "credentials")


def _make_authenticator() -> MOSIPAuthenticator:
    """Build a MOSIPAuthenticator from environment-backed settings."""
    cfg_dict = {
        "mosip_auth": {
            "timestamp_format": "%Y-%m-%dT%H:%M:%S",
            "ida_auth_version": "1.0",
            "ida_auth_request_demo_id": "mosip.identity.auth",
            "ida_auth_request_kyc_id": "mosip.identity.kyc",
            "ida_auth_request_otp_id": "mosip.identity.otp",
            "ida_auth_env": "Staging",
            "authorization_header_constant": "Authorization",
            "partner_misp_lk": settings.mosip_partner_misp_lk,
            "partner_id": settings.mosip_partner_id,
            "partner_apikey": settings.mosip_partner_apikey,
        },
        "mosip_auth_server": {
            "ida_auth_domain_uri": settings.mosip_ida_domain_uri,
            "ida_auth_url": settings.mosip_ida_url,
        },
        "crypto_encrypt": {
            "symmetric_key_size": 256,
            "symmetric_nonce_size": 128,
            "symmetric_gcm_tag_size": 128,
            "encrypt_cert_path": os.path.join(_CREDS_DIR, "pdec_ida_partner.pem"),
            "decrypt_p12_file_path": os.path.join(_CREDS_DIR, "keystore.p12"),
            "decrypt_p12_file_password": settings.mosip_keystore_password,
        },
        "crypto_signature": {
            "algorithm": "RS256",
            "sign_p12_file_path": os.path.join(_CREDS_DIR, "keystore-signed.p12"),
            "sign_p12_file_password": settings.mosip_keystore_password,
        },
        "logging": {
            "log_file_path": "authenticator.log",
            "log_format": "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
            "loglevel": "INFO",
        },
    }
    config = Dynaconf(settings_file=None)
    config.update(cfg_dict)
    return MOSIPAuthenticator(config=config)


@dataclass
class VerificationResult:
    verified: bool
    uin: Optional[str]


class MOSIPAdapter(Protocol):
    """
    Verify a PhilSys QR payload and extract the UIN.

    The real implementation must:
      1. Parse the PhilSys QR payload (UIN + demographic data)
      2. Verify via MOSIP yes/no auth (demographic match)
      3. Return the verified UIN on success, or verified=False on failure
    """

    def verify(self, qr_payload: str) -> VerificationResult: ...


class RealMOSIPAdapter:
    """
    Calls the MOSIP IDA yes/no auth endpoint using the mosip-auth-sdk.
    Adjust the parser below to match whatever the GM861S scanner outputs.
    """

    def __init__(self):
        self._authenticator = _make_authenticator()

    def verify(self, qr_payload: str) -> VerificationResult:
        if not qr_payload or not qr_payload.strip():
            return VerificationResult(verified=False, uin=None)

        # splits "UIN and the demographical content of the QR payload"
        uin, demographics = self._parse_qr(qr_payload)
        if uin is None or demographics is None:
            return VerificationResult(verified=False, uin=None)

        ## Calls upon the MOSIP sdk
        response = self._authenticator.auth(
            individual_id=uin,
            individual_id_type="UIN",
            demographic_data=demographics,
            consent=True,
        )
        body = response.json()
        auth_status: bool = body.get("response", {}).get("authStatus", False)
        return VerificationResult(verified=auth_status, uin=uin if auth_status else None)

    def _parse_qr(self, qr_payload: str) -> tuple[Optional[str], Optional[DemographicsModel]]:
        """
        Parse the raw QR string into a UIN + DemographicsModel.

        Update this method to adhere to the QR format 
        """
        parts = qr_payload.strip().split("|")
        if len(parts) < 2:
            return None, None
        uin, dob = parts[0].strip(), parts[1].strip()
        return uin, DemographicsModel(dob=dob)


class StubMOSIPAdapter:
    """Used in tests and local dev without WireGuard access."""

    def verify(self, qr_payload: str) -> VerificationResult:
        if not qr_payload or not qr_payload.strip():
            return VerificationResult(verified=False, uin=None)
        mock_uin = qr_payload.strip()[:16]
        return VerificationResult(verified=True, uin=mock_uin)
