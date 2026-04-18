from dataclasses import dataclass
from typing import Optional, Protocol


@dataclass
class VerificationResult:
    verified: bool
    uin: Optional[str]


class MOSIPAdapter(Protocol):
    """
    Verify a PhilSys QR payload and extract the UIN.

    The real implementation must:
      1. Parse the PhilSys QR payload (demographic string + digital signature)
      2. Verify the cryptographic signature against PSA trust anchors via MOSIP SDK
      3. Return the verified UIN on success, or verified=False on failure
    """

    def verify(self, qr_payload: str) -> VerificationResult: ...


class StubMOSIPAdapter:
    """
    TODO: Replace with a real MOSIPAdapter once the MOSIP endpoint and trust anchors
    are confirmed. See plans/0418-prd.md § MOSIP Integration.

    The real adapter should invoke the MOSIP Python SDK:
      from mosip_sdk import MosipClient
      client = MosipClient(base_url=settings.mosip_url, ...)
      result = client.verify_qr(qr_payload)
    """

    def verify(self, qr_payload: str) -> VerificationResult:
        if not qr_payload or not qr_payload.strip():
            return VerificationResult(verified=False, uin=None)

        # Stub: treat the first 16 chars of the payload as the UIN
        mock_uin = qr_payload.strip()[:16]
        return VerificationResult(verified=True, uin=mock_uin)
