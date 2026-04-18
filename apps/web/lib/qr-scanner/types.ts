export interface QRScanner {
  /**
   * Start scanning. Calls onDecode each time a QR code is successfully decoded.
   * Call stop() to clean up.
   */
  start(onDecode: (payload: string) => void): Promise<void>;

  /**
   * Stop scanning and release resources (camera stream, serial port, etc.).
   */
  stop(): void;
}

// To add a GM861S hardware adapter:
//   1. Create `gm861s-adapter.ts` implementing this interface
//   2. In HID mode: focus a hidden <input>, listen for the decoded string as keyboard input
//   3. In Web Serial mode: open the port, read decoded strings from the serial stream
//   4. Inject the adapter into IssueTicketDialog instead of CameraAdapter
