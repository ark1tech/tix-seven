"use client";

import type { QRScanner } from "./types";

// Uses @zxing/browser for browser-native camera QR scanning.
// To swap to a GM861S or other hardware scanner, implement the QRScanner
// interface in a new file and inject it into IssueTicketDialog.
export class CameraAdapter implements QRScanner {
  private reader: import("@zxing/browser").BrowserQRCodeReader | null = null;
  private controls: { stop: () => void } | null = null;

  async start(onDecode: (payload: string) => void): Promise<void> {
    const { BrowserQRCodeReader } = await import("@zxing/browser");
    this.reader = new BrowserQRCodeReader();

    const videoElement = document.getElementById(
      "qr-scanner-video"
    ) as HTMLVideoElement | null;

    if (!videoElement) {
      throw new Error(
        'QR scanner requires a <video id="qr-scanner-video" /> element in the DOM'
      );
    }

    this.controls = await this.reader.decodeFromVideoDevice(
      undefined,
      videoElement,
      (result) => {
        if (result) onDecode(result.getText());
      }
    );
  }

  stop(): void {
    this.controls?.stop();
    this.controls = null;
    this.reader = null;
  }
}
