import type { MOSIPAdapter, VerificationResult } from "./types";

// TODO: Replace StubMOSIPAdapter with a real implementation that calls the
// MOSIP Python SDK or MOSIP Testbed REST API. The real adapter must:
//   1. Parse the PhilSys QR payload (demographic string + digital signature)
//   2. Verify the cryptographic signature against PSA trust anchors
//   3. Extract and return the UIN on success
// See plans/0418-prd.md § MOSIP Integration for context.
export class StubMOSIPAdapter implements MOSIPAdapter {
  async verify(qrPayload: string): Promise<VerificationResult> {
    if (!qrPayload || qrPayload.trim() === "") {
      return { verified: false, uin: null };
    }

    // Stub: treat the payload itself as the UIN for development purposes
    const mockUIN = qrPayload.trim().slice(0, 16);
    return { verified: true, uin: mockUIN };
  }
}
