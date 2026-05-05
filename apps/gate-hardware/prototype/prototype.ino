  #include <ESP8266WiFi.h>
  #include <ESP8266HTTPClient.h>
  #include <WiFiClient.h>
  #include <ArduinoJson.h>
  #include <SoftwareSerial.h>
  #include <Servo.h>

  // --- Configuration ---
  const char* ssid = "s3wifi";
  const char* password = "Com9L3x!";

  // Server Details
  const char* serverUrl = "http://65.1.42.4:8000/verify"; // Replace with server's IP
  const char* apiKey = "64ca232bb34d5786219670dcb032dc8def1096de71b7c12c85fba03a02a7377e";                      // Must match GATE_API_KEY
  const String gateId = "04adee71-453f-4fff-b5ba-e2b7c4046ced";

  // --- Hardware Pins ---
  #define GREEN_LED_PIN D8
  #define RED_LED_PIN D7
  #define GATE_SERVO_PIN D9 // Connect to the Servo's signal (usually yellow/orange) wire
  #define SCANNER_RX_PIN D5 // Connected to Scanner TXD (Pin 5)
  #define SCANNER_TX_PIN D6 // Connected to Scanner RXD (Pin 4)
  SoftwareSerial scannerSerial(SCANNER_RX_PIN, SCANNER_TX_PIN);

  // Variables to prevent spamming the server
  unsigned long lastScanTime = 0;
  const unsigned long scanCooldown = 3000; // Wait 3 seconds before accepting the NEXT scan

  // Define Servo Angles
  const int GATE_CLOSED_ANGLE = 180;  // Adjust this to match your closed physical position
  const int GATE_OPEN_ANGLE = 0;   // Adjust this to match your open physical position
  Servo gateServo;                  // Create the servo object

  void setup() {
    Serial.begin(115200); // For USB debugging
    delay(5000);
    Serial.println("\n\n---- System Stabilized ----\n");
    delay(1000);

    // 3. Initialize the Radio in Station Mode
    // WiFi.setOutputPower(15.0);
    pinMode(GREEN_LED_PIN, OUTPUT);
    pinMode(RED_LED_PIN, OUTPUT);
    digitalWrite(GREEN_LED_PIN, LOW);
    digitalWrite(RED_LED_PIN, LOW);

    // Initialize the Servo
    gateServo.attach(GATE_SERVO_PIN);
    gateServo.write(GATE_CLOSED_ANGLE); // Ensure gate is closed on startup
    delay(500);
    // Initialize Scanner Serial (GM861S default is 9600 baud)
    scannerSerial.begin(9600);
    delay(500);
    // Connect to Wi-Fi
    Serial.print("test");
    WiFi.begin(ssid, password);
    Serial.print("Connecting to WiFi");
    while (WiFi.status() != WL_CONNECTED) {
      delay(500);
      Serial.print(".");
    }
    Serial.println("\nConnected to WiFi!");
    Serial.println("System Ready. Waiting for QR codes in Continuous Mode...");
  }

  void loop() {
    // Constantly check if scanner sent data
    if (scannerSerial.available()) {

      // Check if enough time has passed since the last scan (cooldown)
      if (millis() - lastScanTime >= scanCooldown) {
        String scannedQR = getScannedQR();
        if (scannedQR != "") {
          Serial.println("Accepted QR: " + scannedQR);
          verifyTicket(scannedQR);
          lastScanTime = millis(); // Reset cooldown timer
          Serial.println("Scanner ready. Waiting for next QR code...");
        }
      } else {
        // If we are still in the cooldown period, read and discard the data
        // so it doesn't pile up in the serial buffer.
        while(scannerSerial.available()){
          scannerSerial.read();
        }
      }
    }
  }

  // Read from the GM861S Scanner
  String getScannedQR() {
    // The GM861S manual notes data is terminated by 0x0D (carriage return '\r')
    String qrCode = scannerSerial.readStringUntil('\r');
    qrCode.trim(); // Clean up any lingering whitespace or \n

    if (qrCode.length() > 0) {
      return qrCode;
    }
    return "";
  }

  // Send the HTTP Request to the Gate Server
  void verifyTicket(String qrPayload) {
    // --- LAYER 1: WiFi status ---
    wl_status_t wifiStatus = WiFi.status();
    Serial.print("[DEBUG L1] WiFi status: ");
    Serial.println(wifiStatus); // 3 = WL_CONNECTED
    if (wifiStatus != WL_CONNECTED) {
      Serial.println("[ERROR L1] WiFi not connected. Aborting.");
      return;
    }
    Serial.print("[DEBUG L1] Local IP: ");
    Serial.println(WiFi.localIP());
    Serial.print("[DEBUG L1] RSSI: ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");

    // --- LAYER 2: TCP connection probe ---
    WiFiClient tcpProbe;
    tcpProbe.setTimeout(5000);
    Serial.println("[DEBUG L2] Attempting raw TCP connect to 65.1.42.4:8000 ...");
    unsigned long tcpStart = millis();
    bool tcpOk = tcpProbe.connect("65.1.42.4", 8000);
    unsigned long tcpElapsed = millis() - tcpStart;
    if (!tcpOk) {
      Serial.print("[ERROR L2] TCP connect FAILED after ");
      Serial.print(tcpElapsed);
      Serial.println(" ms. Check EC2 security group / server process.");
      return;
    }
    Serial.print("[DEBUG L2] TCP connect OK in ");
    Serial.print(tcpElapsed);
    Serial.println(" ms. Closing probe.");
    tcpProbe.stop();

    // --- LAYER 3: HTTP request ---
    WiFiClient client;
    HTTPClient http;
    Serial.println("[DEBUG L3] Initialising HTTPClient...");
    if (!http.begin(client, serverUrl)) {
      Serial.println("[ERROR L3] http.begin() returned false. Check URL format.");
      return;
    }
    http.setTimeout(10000);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-Gate-Api-Key", apiKey);

    StaticJsonDocument<200> doc;
    doc["qr_payload"] = qrPayload;
    doc["gate_id"] = gateId;
    String requestBody;
    serializeJson(doc, requestBody);
    Serial.println("[DEBUG L3] POST body: " + requestBody);

    unsigned long httpStart = millis();
    int httpResponseCode = http.POST(requestBody);
    unsigned long httpElapsed = millis() - httpStart;
    Serial.print("[DEBUG L3] POST completed in ");
    Serial.print(httpElapsed);
    Serial.println(" ms");

    if (httpResponseCode > 0) {
      Serial.print("[DEBUG L3] HTTP status: ");
      Serial.println(httpResponseCode);
      String response = http.getString();
      Serial.println("[DEBUG L3] Raw response: " + response);

      // --- LAYER 4: JSON parse ---
      StaticJsonDocument<256> responseDoc;
      DeserializationError error = deserializeJson(responseDoc, response);
      if (error) {
        Serial.print("[ERROR L4] JSON parse failed: ");
        Serial.println(error.c_str());
      } else {
        String result = responseDoc["result"].as<String>();
        Serial.println("[DEBUG L4] result field: " + result);

        if (result == "grant") {
          Serial.println("ACCESS GRANTED! (Opening gate...)");
          digitalWrite(GREEN_LED_PIN, HIGH);
          delay(3000);
          gateServo.write(GATE_OPEN_ANGLE);
          delay(3000);
          gateServo.write(GATE_CLOSED_ANGLE);
          digitalWrite(GREEN_LED_PIN, LOW);
        } else if (result == "deny") {
          String reason = responseDoc["reason"].as<String>();
          Serial.println("ACCESS DENIED! Reason: " + reason);
          digitalWrite(RED_LED_PIN, HIGH);
          delay(2000);
          digitalWrite(RED_LED_PIN, LOW);
        } else {
          Serial.println("[WARN L4] Unknown result value: " + result);
        }
      }
    } else {
      Serial.print("[ERROR L3] HTTP POST failed, code: ");
      Serial.println(httpResponseCode);
      // Negative codes map to ESP8266 HTTPC_ERROR_* enum values
      // -1 = HTTPC_ERROR_CONNECTION_REFUSED
      // -3 = HTTPC_ERROR_SEND_HEADER_FAILED
      // -4 = HTTPC_ERROR_SEND_PAYLOAD_FAILED
      // -11 = HTTPC_ERROR_READ_TIMEOUT
    }
    http.end();
  }
