import os
import logging
from dataclasses import dataclass
from typing import Callable, Optional, Protocol

from dynaconf import Dynaconf
from mosip_auth_sdk._authenticator.utils import restutil as mosip_restutil
from mosip_auth_sdk import MOSIPAuthenticator
from mosip_auth_sdk.models import DemographicsModel
from requests import RequestException

from app.core.config import settings

# Credential files live under apps/gate-server/credentials/ (sibling to app/)
_CREDS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "credentials")
_MOSIP_CREDENTIAL_FILES = (
    "pdec_ida_partner.pem",
    "keystore.p12",
    "keystore-signed.p12",
)
_auth_log = logging.getLogger("authenticator.log")
_MOSIP_REQUEST_TIMEOUT_SECONDS = 60


def _with_default_timeout(
    request_func: Callable[..., object], timeout_seconds: int
) -> Callable[..., object]:
    def _wrapped(*args, **kwargs):
        kwargs.setdefault("timeout", timeout_seconds)

        # Inject proxy if running via userspace wireproxy
        if os.environ.get("MOSIP_USE_SOCKS5_PROXY") == "true":
            kwargs["proxies"] = {
                "http": "socks5h://127.0.0.1:1080",
                "https": "socks5h://127.0.0.1:1080",
            }

        return request_func(*args, **kwargs)

    return _wrapped


def _require_mosip_credential_files() -> None:
    """
    Fail fast with a clear message before mosip_auth_sdk opens missing PEM/P12s.
    """
    missing = [
        f
        for f in _MOSIP_CREDENTIAL_FILES
        if not os.path.isfile(os.path.join(_CREDS_DIR, f))
    ]
    if not missing:
        return
    dir_abs = os.path.abspath(_CREDS_DIR)
    names = ", ".join(missing)
    raise FileNotFoundError(
        f"MOSIP credential file(s) missing: {names}. "
        f"Copy the partner/testbed bundle into: {dir_abs} "
        f"(see credentials/README.md in that folder)."
    )


def _make_authenticator() -> MOSIPAuthenticator:
    """Build a MOSIPAuthenticator from environment-backed settings."""
    _require_mosip_credential_files()
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
    mosip_restutil.requests.post = _with_default_timeout(
        mosip_restutil.requests.post,
        timeout_seconds=_MOSIP_REQUEST_TIMEOUT_SECONDS,
    )
    return MOSIPAuthenticator(config=config)


@dataclass
class VerificationResult:
    verified: bool
    uin: Optional[str]
    psut: Optional[str]  # returned as "authToken"


class MOSIPUnavailableError(Exception):
    """Raised when MOSIP cannot be reached or returns a transport-level error."""

class MOSIPAdapter(Protocol):
    """
    Verify a PhilSys QR payload and extract the UIN.

    The real implementation must:
      1. Parse the PhilSys QR payload (UIN + demographic data)
      2. Verify via MOSIP yes/no auth (demographic match)
      3. Return the verified UIN on success, or verified=False on failure
    """

    def verify(self, qr_payload: str) -> VerificationResult: ...


_global_authenticator = None


class RealMOSIPAdapter:
    """
    Calls the MOSIP IDA yes/no auth endpoint using the mosip-auth-sdk.
    Adjust the parser below to match whatever the GM861S scanner outputs.
    """

    def __init__(self):
        global _global_authenticator
        if _global_authenticator is None:
            _global_authenticator = _make_authenticator()

        self._authenticator = _global_authenticator

    def verify(self, qr_payload: str) -> VerificationResult:
        if not qr_payload or not qr_payload.strip():
            _auth_log.info("verify skipped: empty_qr_payload")
            return VerificationResult(verified=False, uin=None, psut=None)

        # splits "UIN and the demographical content of the QR payload"
        uin, demographics = self._parse_qr(qr_payload)
        if uin is None or demographics is None:
            _auth_log.info("verify skipped: invalid_qr_payload")
            return VerificationResult(verified=False, uin=None, psut=None)

        ## Calls upon the MOSIP sdk
        try:
            _auth_log.info(
                "verify start: calling mosip auth endpoint host=%s uin_suffix=%s",
                settings.mosip_ida_domain_uri,
                uin[-4:],
            )
            response = self._authenticator.auth(
                individual_id=uin,
                individual_id_type="UIN",
                demographic_data=demographics,
                consent=True,
            )
            _auth_log.info(
                "verify request completed: status_code=%s",
                response.status_code,
            )
        except RequestException as exc:
            _auth_log.error(
                "verify failed: mosip_or_network_fault error=%s",
                repr(exc),
            )
            raise MOSIPUnavailableError("MOSIP auth request failed") from exc
        except Exception as exc:
            _auth_log.exception(
                "verify failed: gate_server_fault unexpected_error=%s",
                type(exc).__name__,
            )
            raise

        """
        Given a UIN and some demographic data, MOSIP returns:
        - authStatus: true  -> "YES, this person is who they claim to be"
        - authStatus: false -> "NO, the data does not match"

        - authToken: PSUT
    
        """

        # TODO: VERIFY. From my understanding, kahit sa yes / no API call may PSUT token?
    
        decrypted = response.json()
        inner = decrypted.get("response", {})

        auth_status: bool = inner.get("authStatus", False)
        psut: Optional[str] = inner.get("authToken") if auth_status else None
        _auth_log.info("verify response parsed: auth_status=%s", auth_status)

        return VerificationResult(
            verified=auth_status,
            uin=uin if auth_status else None,
            psut=psut,
        )

    def _parse_qr(
        self, qr_payload: str
    ) -> tuple[Optional[str], Optional[DemographicsModel]]:
        """
        Parses the JSON payload from the ESP8266 containing UIN and demographics.
        Only includes fields that are present in the payload.
        """
        if not qr_payload or not qr_payload.strip():
            return None, None

        try:
            import json

            data = json.loads(qr_payload)

            uin = data.get("uin")
            if not uin:
                return None, None

            demo_kwargs = {}

            # Simple string fields
            if data.get("dob"):
                demo_kwargs["dob"] = data["dob"]
            if data.get("postal_code"):
                demo_kwargs["postal_code"] = data["postal_code"]

            # Fields that require the IdentityInfo list structure: [{"language": "eng", "value": "..."}]
            list_fields = {
                "name": "name",
                "address_line1": "address_line1",
                "address_line2": "address_line2",
                "address_line3": "address_line3",
                "location1": "location1",
                "location3": "location3",
                "zone": "zone",
            }

            for demo_key, json_key in list_fields.items():
                val = data.get(json_key)
                if val and str(val).strip():
                    # 'eng' is the default language code for MOSIP testbed
                    # Adjust if your testbed requires 'fil' or similar
                    demo_kwargs[demo_key] = [{"language": "eng", "value": str(val)}]

            demographics = DemographicsModel(**demo_kwargs)
            return str(uin), demographics

        except json.JSONDecodeError:
            _auth_log.warning("parse_qr failed: json_decode_error")
            return None, None


class StubMOSIPAdapter:
    """Used in tests and local dev without WireGuard access."""
 
    # Hardcoded PSUT that matches the DEV_PSUT constant in verification.py.

    _STUB_PSUT = "DEV_PSUT"
 
    def verify(self, qr_payload: str) -> VerificationResult:
        if not qr_payload or not qr_payload.strip():
            return VerificationResult(verified=False, uin=None, psut=None)
        mock_uin = qr_payload.strip()[:16]
        return VerificationResult(verified=True, uin=mock_uin, psut=self._STUB_PSUT)