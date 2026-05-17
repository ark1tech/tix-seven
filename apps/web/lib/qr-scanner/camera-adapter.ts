"use client";

import type { QRScanner } from "./types";

// Uses @zxing/browser for browser-native camera QR scanning.
// To swap to a GM861S or other hardware scanner, implement the QRScanner
// interface in a new file and inject it into IssueTicketDialog.
export class CameraAdapter implements QRScanner {
  private reader: import("@zxing/browser").BrowserQRCodeReader | null = null;
  private controls: { stop: () => void } | null = null;
  private stream: MediaStream | null = null;
  private startGeneration = 0;

  async start(onDecode: (payload: string) => void): Promise<void> {
    const generation = this.startGeneration + 1;
    this.startGeneration = generation;

    const { BrowserQRCodeReader } = await import("@zxing/browser");
    if (generation !== this.startGeneration) {
      return;
    }

    this.reader = new BrowserQRCodeReader();

    const videoElement = document.getElementById(
      "qr-scanner-video",
    ) as HTMLVideoElement | null;

    if (!videoElement) {
      throw new Error(
        'QR scanner requires a <video id="qr-scanner-video" /> element in the DOM',
      );
    }

    this.controls = await this.reader.decodeFromVideoDevice(
      undefined,
      videoElement,
      (result) => {
        if (result) onDecode(result.getText());
      },
    );

    if (generation !== this.startGeneration) {
      this.controls.stop();
      this.controls = null;
      this.reader = null;
      return;
    }

    if (videoElement.srcObject instanceof MediaStream) {
      this.stream = videoElement.srcObject;
    }
  }

  stop(): void {
    this.startGeneration += 1;
    this.controls?.stop();
    this.controls = null;
    this.reader = null;

    const videoElement = document.getElementById(
      "qr-scanner-video",
    ) as HTMLVideoElement | null;

    const stream =
      this.stream ??
      (videoElement?.srcObject instanceof MediaStream
        ? videoElement.srcObject
        : null);

    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    this.stream = null;

    if (videoElement) {
      videoElement.srcObject = null;
      videoElement.removeAttribute("src");
      videoElement.load();
    }
  }
}
