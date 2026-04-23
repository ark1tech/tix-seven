import hmac
import hashlib

from app.core.config import settings


def hash_psut(psut: str, event_id: str) -> str:
    """
    Compute HMAC-SHA256(pepper, "psut:event_id").

    The shared pepper is read from settings (HMAC_PEPPER env var) and must match the value used by the TypeScript client (hmac.ts).
    The message format "psut:event_id" is the contract between both sides; do not change one format without changing the other one.

    This hash is stored as the link_hash in EventTicketLink during ticket
    purchase (Phase 0) and recomputed at gate scan time (Phase 2) to look
    up the binding without ever persisting the PSUT itself.
    """

    return hmac.new(
        settings.hmac_pepper.encode(),
        (psut + ":" + event_id).encode(),
        hashlib.sha256,
    ).hexdigest()
