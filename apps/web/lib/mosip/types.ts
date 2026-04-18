export interface VerificationResult {
  verified: boolean;
  uin: string | null;
}

export interface MOSIPAdapter {
  verify(qrPayload: string): Promise<VerificationResult>;
}
