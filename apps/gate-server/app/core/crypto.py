import hmac
import hashlib

from app.core.config import settings


def hash_uin(uin: str) -> str:
    """HMAC-SHA256 the UIN with the shared pepper. Must match the TS implementation."""
    return hmac.new(
        settings.hmac_pepper.encode(),
        uin.encode(),
        hashlib.sha256,
    ).hexdigest()
