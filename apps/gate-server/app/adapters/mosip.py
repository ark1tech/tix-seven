import os
import logging
import time
from dataclasses import dataclass
from typing import Callable, Optional, Protocol

import threading
import requests as _requests
from dynaconf import Dynaconf
from mosip_auth_sdk._authenticator.utils import restutil as mosip_restutil
from mosip_auth_sdk._authenticator.utils.cryptoutil import CryptoUtility
from mosip_auth_sdk import MOSIPAuthenticator
from mosip_auth_sdk.models import DemographicsModel
from cryptography.hazmat.primitives import serialization
from jwcrypto import jwk
from requests import RequestException
from requests.exceptions import Timeout

from app.core.config import settings
from app.core.demo_identity_log import format_psut_for_demo, format_uin_for_demo
from app.core.trace import get_trace_id

# Credential files live under apps/gate-server/credentials/ (sibling to app/)
_CREDS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "credentials")
_MOSIP_CREDENTIAL_FILES = (
    "pdec_ida_partner.pem",
    "keystore.p12",
    "keystore-signed.p12",
)
_auth_log = logging.getLogger("authenticator.log")
def _read_timeout_seconds() -> int:
    raw = os.getenv("MOSIP_REQUEST_TIMEOUT_SECONDS", "120")
    try:
        return max(1, int(raw))
    except ValueError:
        return 120


def _read_retry_attempts() -> int:
    raw = os.getenv("MOSIP_REQUEST_RETRY_ATTEMPTS", "2")
    try:
        return max(1, int(raw))
    except ValueError:
        return 2


def _read_retry_delay_seconds() -> float:
    raw = os.getenv("MOSIP_REQUEST_RETRY_DELAY_SECONDS", "1.5")
    try:
        return max(0.0, float(raw))
    except ValueError:
        return 1.5


_MOSIP_REQUEST_TIMEOUT_SECONDS = _read_timeout_seconds()
_MOSIP_REQUEST_RETRY_ATTEMPTS = _read_retry_attempts()
_MOSIP_REQUEST_RETRY_DELAY_SECONDS = _read_retry_delay_seconds()
_MOSIP_MOCK_SERVER_URL = os.getenv(
    "MOSIP_MOCK_SERVER_URL",
    "https://cs145-iot-cup-1745973870.ap-southeast-1.elb.amazonaws.com",
)


def _with_default_timeout(
    request_func: Callable[..., object], timeout_seconds: int
) -> Callable[..., object]:
    def _wrapped(*args, **kwargs):
        kwargs.setdefault("timeout", timeout_seconds)
        return request_func(*args, **kwargs)

    return _wrapped


def _try_mock_server(
    uin: str,
    demographics: "DemographicsModel",
) -> Optional["VerificationResult"]:
    """
    Fallback: send a plain HTTP request to the mock MOSIP server after all
    SDK retries are exhausted. Returns a VerificationResult or None on failure.
    """
    body: dict = {"individual_id": uin, "consent": True}

    # Map DemographicsModel fields to the flat mock-server request body.
    # IdentityInfo list fields carry [{"language": "eng", "value": "..."}].
    list_fields = (
        "name", "address_line1", "address_line2", "address_line3",
        "location1", "location3", "zone",
    )
    for field in list_fields:
        val = getattr(demographics, field, None)
        if val and isinstance(val, list) and val:
            body[field] = val[0].get("value") if isinstance(val[0], dict) else str(val[0])

    scalar_fields = ("dob", "postal_code", "gender", "phone_number", "email_id", "age")
    for field in scalar_fields:
        val = getattr(demographics, field, None)
        if val is not None:
            body[field] = val

    url = f"{_MOSIP_MOCK_SERVER_URL}/api/v1/auth/yes-no"
    _auth_log.info(
        "mock_server fallback: trace_id=%s url=%s uin_suffix=%s",
        get_trace_id(),
        url,
        uin[-4:],
    )
    resp = None
    try:
        resp = _requests.post(url, json=body, verify=False, timeout=30)
        _auth_log.info(
            "mock_server raw response: trace_id=%s status=%s body_prefix=%.300s",
            get_trace_id(),
            resp.status_code,
            resp.text[:300],
        )
        data = resp.json()
        inner = data.get("response", {})
        errors = data.get("errors")
        if errors:
            _auth_log.warning(
                "mock_server response errors: trace_id=%s errors=%s",
                get_trace_id(),
                errors,
            )
        auth_status: bool = inner.get("authStatus", False)
        psut: Optional[str] = inner.get("authToken") if auth_status else None
        _auth_log.info(
            "mock_server response: trace_id=%s auth_status=%s",
            get_trace_id(),
            auth_status,
        )
        return VerificationResult(
            verified=auth_status,
            uin=uin if auth_status else None,
            psut=psut,
        )
    except Exception as exc:
        _auth_log.error(
            "mock_server failed: trace_id=%s status=%s body_prefix=%.300s error=%s",
            get_trace_id(),
            resp.status_code if resp is not None else "N/A",
            (resp.text[:300] if resp is not None else ""),
            repr(exc),
        )
        return None


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


def _make_authenticator() -> MOSIPAuthenticator | None:
    """Build a MOSIPAuthenticator from environment-backed settings, or None when demo-disabled."""
    if settings.demo_disable_mosip_authenticator:
        return None
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

    # Monkey-patch CryptoUtility to bypass redundant and potentially hanging KDF
    # during JWK creation. We use NoEncryption for the temporary PEM string.
    def patched_get_jwk_private_key(priv_key_obj, key_password, logger):
        priv_key_pem = priv_key_obj.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        )
        logger.info(
            "Creating JWK key for JWS signing (using patched NoEncryption path to bypass KDF)."
        )
        return jwk.JWK.from_pem(priv_key_pem)

    CryptoUtility._get_jwk_private_key = staticmethod(patched_get_jwk_private_key)

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


_global_authenticator: MOSIPAuthenticator | None = None
_init_lock = threading.Lock()


class RealMOSIPAdapter:
    """
    Calls the MOSIP IDA yes/no auth endpoint using the mosip-auth-sdk.
    Adjust the parser below to match whatever the GM861S scanner outputs.
    """

    def __init__(self):
        global _global_authenticator
        if _global_authenticator is None:
            with _init_lock:
                if _global_authenticator is None:
                    _auth_log.info(
                        "MOSIP Authenticator singleton not found. Starting initialization..."
                    )
                    _global_authenticator = _make_authenticator()
                    if _global_authenticator is None:
                        _auth_log.info(
                            "MOSIP Authenticator disabled for demo (DEMO_DISABLE_MOSIP_AUTHENTICATOR)."
                        )
                    else:
                        _auth_log.info("MOSIP Authenticator initialized successfully.")

        self._authenticator = _global_authenticator

    def verify(self, qr_payload: str) -> VerificationResult:
        if not qr_payload or not qr_payload.strip():
            _auth_log.info(
                "verify skipped: trace_id=%s reason=empty_qr_payload", get_trace_id()
            )
            return VerificationResult(verified=False, uin=None, psut=None)

        # splits "UIN and the demographical content of the QR payload"
        uin, demographics = self._parse_qr(qr_payload)
        if uin is None or demographics is None:
            _auth_log.info(
                "verify skipped: trace_id=%s reason=invalid_qr_payload", get_trace_id()
            )
            return VerificationResult(verified=False, uin=None, psut=None)

        if self._authenticator is None:
            _log_full = settings.demo_log_identity_values
            _auth_log.info(
                "[DEMO] CRYPTOGRAPHIC AUTHENTICATION FAILED | %s trace_id=%s reason=demo_mosip_authenticator_disabled",
                format_uin_for_demo(uin, _log_full),
                get_trace_id(),
            )
            return VerificationResult(verified=False, uin=None, psut=None)

        ## Calls upon the MOSIP sdk (retry on timeout)
        response = None
        for attempt in range(1, _MOSIP_REQUEST_RETRY_ATTEMPTS + 1):
            try:
                _auth_log.info(
                    "verify start: trace_id=%s calling_mosip_auth host=%s uin_suffix=%s attempt=%s/%s",
                    get_trace_id(),
                    settings.mosip_ida_domain_uri,
                    uin[-4:],
                    attempt,
                    _MOSIP_REQUEST_RETRY_ATTEMPTS,
                )
                response = self._authenticator.auth(
                    individual_id=uin,
                    individual_id_type="UIN",
                    demographic_data=demographics,
                    consent=True,
                )
                _auth_log.info(
                    "verify request completed: trace_id=%s status_code=%s",
                    get_trace_id(),
                    response.status_code,
                )
                break
            except Timeout as exc:
                if attempt < _MOSIP_REQUEST_RETRY_ATTEMPTS:
                    _auth_log.warning(
                        "verify timeout: trace_id=%s attempt=%s/%s timeout_seconds=%s retrying_after_seconds=%s",
                        get_trace_id(),
                        attempt,
                        _MOSIP_REQUEST_RETRY_ATTEMPTS,
                        _MOSIP_REQUEST_TIMEOUT_SECONDS,
                        _MOSIP_REQUEST_RETRY_DELAY_SECONDS,
                    )
                    if _MOSIP_REQUEST_RETRY_DELAY_SECONDS:
                        time.sleep(_MOSIP_REQUEST_RETRY_DELAY_SECONDS)
                    continue
                _auth_log.warning(
                    "verify all retries exhausted: trace_id=%s reason=mosip_timeout error=%s — falling back to mock server",
                    get_trace_id(),
                    repr(exc),
                )
                mock_result = _try_mock_server(uin, demographics)
                if mock_result is not None:
                    _log_full = settings.demo_log_identity_values
                    if mock_result.verified:
                        _auth_log.info(
                            "[DEMO] UIN VERIFIED (mock server) | %s | %s trace_id=%s",
                            format_uin_for_demo(uin, _log_full),
                            format_psut_for_demo(mock_result.psut, _log_full),
                            get_trace_id(),
                        )
                    else:
                        _auth_log.info(
                            "[DEMO] SIGNATURE VERIFICATION FAILED (mock server) | %s trace_id=%s",
                            format_uin_for_demo(uin, _log_full),
                            get_trace_id(),
                        )
                    return mock_result
                raise MOSIPUnavailableError("MOSIP auth request timed out and mock server also failed") from exc
            except RequestException as exc:
                _auth_log.error(
                    "verify failed: trace_id=%s reason=mosip_or_network_fault error=%s",
                    get_trace_id(),
                    repr(exc),
                )
                raise MOSIPUnavailableError("MOSIP auth request failed") from exc
            except Exception as exc:
                _auth_log.exception(
                    "verify failed: trace_id=%s reason=gate_server_fault unexpected_error=%s",
                    get_trace_id(),
                    type(exc).__name__,
                )
                raise

        if response is None:
            raise MOSIPUnavailableError("MOSIP auth request failed")

        """
        Given a UIN and some demographic data, MOSIP returns:
        - authStatus: true  -> "YES, this person is who they claim to be"
        - authStatus: false -> "NO, the data does not match"

        - authToken: PSUT

        """

        # TODO: VERIFY. From my understanding, kahit sa yes / no API call may PSUT token?

        raw_body = response.text
        if not raw_body or not raw_body.strip():
            _auth_log.error(
                "verify failed: trace_id=%s reason=empty_mosip_response status_code=%s",
                get_trace_id(),
                response.status_code,
            )
            raise MOSIPUnavailableError(
                f"MOSIP returned empty body (status {response.status_code})"
            )

        try:
            decrypted = response.json()
        except ValueError as exc:
            _auth_log.error(
                "verify failed: trace_id=%s reason=mosip_invalid_json status_code=%s body_prefix=%.120s",
                get_trace_id(),
                response.status_code,
                raw_body[:120],
            )
            raise MOSIPUnavailableError("MOSIP returned non-JSON response") from exc

        inner = decrypted.get("response", {})

        auth_status: bool = inner.get("authStatus", False)
        psut: Optional[str] = inner.get("authToken") if auth_status else None
        _auth_log.info(
            "verify response parsed: trace_id=%s auth_status=%s",
            get_trace_id(),
            auth_status,
        )

        _log_full = settings.demo_log_identity_values
        if auth_status:
            _auth_log.info(
                "[DEMO] UIN VERIFIED | %s | %s trace_id=%s",
                format_uin_for_demo(uin, _log_full),
                format_psut_for_demo(psut, _log_full),
                get_trace_id(),
            )
        else:
            _auth_log.info(
                "[DEMO] SIGNATURE VERIFICATION FAILED | %s trace_id=%s",
                format_uin_for_demo(uin, _log_full),
                get_trace_id(),
            )

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
            _auth_log.warning(
                "parse_qr failed: trace_id=%s reason=json_decode_error",
                get_trace_id(),
            )
            return None, None


class StubMOSIPAdapter:
    """Used in tests and local dev without WireGuard access."""

    _MOCK_DATA_FILE = os.path.join(_CREDS_DIR, "mock_identities.json")

    def __init__(self):
        self._valid: list[dict] = []
        self._invalid: list[dict] = []
        self._load_mock_data()

    def _load_mock_data(self) -> None:
        import json as _json

        if not os.path.isfile(self._MOCK_DATA_FILE):
            return
        with open(self._MOCK_DATA_FILE, "r") as f:
            data = _json.load(f)
            self._valid = data.get("valid", [])
            self._invalid = data.get("invalid", [])

    def _canonical(self, data: dict) -> frozenset[tuple[str, str]]:
        return frozenset((k, str(v)) for k, v in data.items())

    def verify(self, qr_payload: str) -> VerificationResult:
        import json as _json

        if not qr_payload or not qr_payload.strip():
            return VerificationResult(verified=False, uin=None, psut=None)

        try:
            payload = _json.loads(qr_payload)
        except _json.JSONDecodeError:
            return VerificationResult(verified=False, uin=None, psut=None)

        if not isinstance(payload, dict):
            return VerificationResult(verified=False, uin=None, psut=None)

        payloadCanonical = self._canonical(payload)

        for valid in self._valid:
            if self._canonical(valid) == payloadCanonical:
                uin = payload.get("uin")
                psut = f"DEV_PSUT_{uin}"
                return VerificationResult(verified=True, uin=uin, psut=psut)

        for invalid in self._invalid:
            if self._canonical(invalid) == payloadCanonical:
                return VerificationResult(verified=False, uin=None, psut=None)

        return VerificationResult(verified=False, uin=None, psut=None)
