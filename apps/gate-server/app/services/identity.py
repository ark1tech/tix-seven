import uuid

from app.adapters.mosip import MOSIPAdapter, RealMOSIPAdapter
from app.core.crypto import hash_psut
from app.models.schemas import VerifiedIdentity


class IdentityService:
    def __init__(self, mosip: MOSIPAdapter | None = None):
        self.mosip = mosip or RealMOSIPAdapter()

    def verify(self, qr_payload: str) -> VerifiedIdentity | None:
        """
        Forward the QR payload to the MOSIP Testbed.

        Returns a VerifiedIdentity on success, or None if the identity could
        not be verified (unrecognised UIN, attribute mismatch, missing PSUT).
        """

        result = self.mosip.verify(qr_payload)

        if not result.verified or not result.uin or result.psut is None:
            return None

        return VerifiedIdentity(uin=result.uin, psut=result.psut)

    def compute_link_hash(self, psut: str, event_id: uuid.UUID) -> str:
        """
        Derive the deterministic per-identity-per-event hash.

        link_hash = HMAC-SHA256(pepper, "{psut}:{event_id}")
        """

        return hash_psut(psut, str(event_id))