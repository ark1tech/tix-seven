  #include <ESP8266WiFi.h>
  #include <ESP8266HTTPClient.h>
  #include <WiFiClientSecure.h>
  #include <ArduinoJson.h>
  #include <SoftwareSerial.h>
  #include <Servo.h>
  #include <time.h>

  // --- Configuration ---
  const char* ssid = "s3wifi";
  const char* password = "Com9L3x!";
  // const bool STUB_MODE = true; 

  // Server Details — raw IP is valid for self-signed certs with SAN
  const char* serverUrl = "https://65.1.42.4/verify";
  const char* apiKey = "64ca232bb34d5786219670dcb032dc8def1096de71b7c12c85fba03a02a7377e";                      // Must match GATE_API_KEY
  const String gateId = "04adee71-453f-4fff-b5ba-e2b7c4046ced";

  // Self-signed certificate for 65.1.42.4 (generated on EC2 with SAN IP).
  // To get this: run the openssl command on EC2, then `cat server.crt` and paste here.
  // Expires in ~2 years from generation — reflash all devices before expiry.
  // BearSSL (ESP8266) requires X509List — setCACert() is ESP32 only.
  const char* rootCACert = \
"-----BEGIN CERTIFICATE-----\n" \
"MIIDGjCCAgKgAwIBAgIUCXH7O/XZ1hq/RN/6K72FMP7HHrwwDQYJKoZIhvcNAQEL\n" \
"BQAwFDESMBAGA1UEAwwJNjUuMS40Mi40MB4XDTI2MDUwNTA4Mzg0NFoXDTI4MDgw\n" \
"NzA4Mzg0NFowFDESMBAGA1UEAwwJNjUuMS40Mi40MIIBIjANBgkqhkiG9w0BAQEF\n" \
"AAOCAQ8AMIIBCgKCAQEApswtwS5OpWjEQZ3mK1KSjvJUvnmBdlaNKh2iKbfACKAk\n" \
"rJrrRl4DQE+CtKOjDdef7leIJ4qYoIA8QTvr7CDz1GA8UYj0GE7SJyvIwWvu8g5r\n" \
"ULclUOhu4qgtPsfP+m/85BYjBUp5a0rgyQQi08EiHCO1SbyBPi/P3SWVUboRTSoA\n" \
"TaTNLCBInpS2ZkfiWDJmkYGB+iGFfLf2jsp8i6fckfpVLlwtYIt2vZbovPJpdBzu\n" \
"bBRIqno/9c6ce9zwHHEv1gdHwpzW0eNSu0zW1gs5/+HGsf9TckgY01I0vyFzSSXR\n" \
"FOUN6+EmrqVwxZcU3owjbwtaJ7H6KGKsAy1pEfVXsQIDAQABo2QwYjAdBgNVHQ4E\n" \
"FgQU7To/ofJBqdORaIvuHWUyySDP8EEwHwYDVR0jBBgwFoAU7To/ofJBqdORaIvu\n" \
"HWUyySDP8EEwDwYDVR0TAQH/BAUwAwEB/zAPBgNVHREECDAGhwRBASoEMA0GCSqG\n" \
"SIb3DQEBCwUAA4IBAQAjI+6htkrAiDwUg2Iorc/vny4fjmiy+LZ8o6ISHwGktZOn\n" \
"BfUDbP4JTIwB4xYp2DmtI8pE2+kJLA/TfKwH0WnJvqE6x9EC7mb9BTd+0AEbw9cs\n" \
"SWxj271SC2SIvmdzALzY6UMp+sttm6RfGuw/0DhOE7zpgKrmZ3E05q7ea5akaDfc\n" \
"E+M+qP5h1jse96k1n0Rg5M/lVCHE8YyLd1YCs9iIN0oZ9+j3RTcbvOUS65mQ1s5N\n" \
"8A6x2SSIPoH8bGoX7Fr+D2+TtqnKUwr+pkZ0hvbq6XJsZXQ8xXpgKcua9iHwKqN/\n" \
"dluCHKh+IaIQdabpJ8uxg1i8wDu1UNl9pSsT2b1q\n" \
"-----END CERTIFICATE-----\n";

  // --- Hardware Pins ---
  #define GREEN_LED_PIN D8
  #define RED_LED_PIN D4
  #define GATE_SERVO_PIN D9 // Connect to the Servo's signal (usually yellow/orange) wire
  #define SCANNER_RX_PIN D5 // Connected to Scanner TXD (Pin 5)
  #define SCANNER_TX_PIN D6 // Connected to Scanner RXD (Pin 4)
  #define LDR_PIN A0
  SoftwareSerial scannerSerial(SCANNER_RX_PIN, SCANNER_TX_PIN);

  // Variables to prevent spamming the server
  unsigned long lastScanTime = 0;
  const unsigned long scanCooldown = 3000; // Wait 3 seconds before accepting the NEXT scan

  // Define Servo Angles
  const int GATE_CLOSED_ANGLE = 180;
  const int GATE_OPEN_ANGLE = 0;
  Servo gateServo;
  void setup() {
    Serial.begin(115200);
    delay(5000);
    Serial.println("\n\n---- System Stabilized ----\n");
    delay(1000);

    pinMode(GREEN_LED_PIN, OUTPUT);
    pinMode(RED_LED_PIN, OUTPUT);
    digitalWrite(GREEN_LED_PIN, LOW);
    digitalWrite(RED_LED_PIN, LOW);

    gateServo.attach(GATE_SERVO_PIN);
    gateServo.write(GATE_CLOSED_ANGLE);
    delay(500);

    scannerSerial.begin(9600);
    delay(500);

    WiFi.begin(ssid, password);
    Serial.print("Connecting to WiFi");
    while (WiFi.status() != WL_CONNECTED) {
      delay(500);
      Serial.print(".");
    }
    Serial.println("\nConnected to WiFi!");

    // BearSSL validates cert dates — sync clock via NTP before any TLS connection
    configTime(0, 0, "pool.ntp.org", "time.nist.gov");
    Serial.print("Syncing time");
    while (time(nullptr) < 1000000000UL) {
      delay(500);
      Serial.print(".");
    }
    Serial.println(" OK");

    Serial.println("System Ready. Waiting for QR codes in Continuous Mode...");
  }

  void loop() {
    if (scannerSerial.available()) {
      if (millis() - lastScanTime >= scanCooldown) {
        String scannedQR = getScannedQR();
        if (scannedQR != "") {
          Serial.println("Accepted QR: " + scannedQR);
          verifyTicket(scannedQR);
          lastScanTime = millis();
          Serial.println("Scanner ready. Waiting for next QR code...");
        }
      } else {
        while(scannerSerial.available()){
          scannerSerial.read();
        }
      }
    }
  }

  String getScannedQR() {
    String qrCode = scannerSerial.readStringUntil('\r');
    qrCode.trim();
    if (qrCode.length() > 0) {
      return qrCode;
    }
    return "";
  }

  void verifyTicket(String qrPayload) {
    // --- LAYER 1: WiFi status ---
    wl_status_t wifiStatus = WiFi.status();
    Serial.print("[DEBUG L1] WiFi status: ");
    Serial.println(wifiStatus);
    if (wifiStatus != WL_CONNECTED) {
      Serial.println("[ERROR L1] WiFi not connected. Aborting.");
      return;
    }
    Serial.print("[DEBUG L1] Local IP: ");
    Serial.println(WiFi.localIP());
    Serial.print("[DEBUG L1] RSSI: ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");

    // BearSSL requires X509List for cert pinning
    BearSSL::X509List trustedCert(rootCACert);

    // --- LAYER 2: TLS TCP connection probe ---
    BearSSL::WiFiClientSecure tcpProbe;
    tcpProbe.setInsecure(); // TEMP: skip cert validation to isolate connectivity vs cert issue
    tcpProbe.setTimeout(5000);
    Serial.println("[DEBUG L2] Attempting TLS TCP connect to 65.1.42.4:443 ...");
    unsigned long tcpStart = millis();
    bool tcpOk = tcpProbe.connect("65.1.42.4", 443);
    unsigned long tcpElapsed = millis() - tcpStart;
    if (!tcpOk) {
      Serial.print("[ERROR L2] TLS TCP connect FAILED after ");
      Serial.print(tcpElapsed);
      Serial.println(" ms. Check EC2 security group port 443, nginx, and self-signed cert.");
      return;
    }
    Serial.print("[DEBUG L2] TLS TCP connect OK in ");
    Serial.print(tcpElapsed);
    Serial.println(" ms. Closing probe.");
    tcpProbe.stop();

    // --- LAYER 3: HTTPS request ---
    BearSSL::WiFiClientSecure client;
    client.setInsecure(); // TEMP: skip cert validation to isolate connectivity vs cert issue
    HTTPClient http;
    Serial.println("[DEBUG L3] Initialising HTTPClient (HTTPS)...");
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
    // doc["stub_mosip"] = STUB_MODE;
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
          delay(200);

          gateServo.write(GATE_OPEN_ANGLE);
          Serial.println(analogRead(LDR_PIN));
          while(analogRead(LDR_PIN) >= 900){
            Serial.println(analogRead(LDR_PIN));
            delay(100);
          }
          while(analogRead(LDR_PIN) <= 800){
            Serial.println(analogRead(LDR_PIN));
            delay(100);
          }
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
      Serial.print("[ERROR L3] HTTPS POST failed, code: ");
      Serial.println(httpResponseCode);
      // -1 = HTTPC_ERROR_CONNECTION_REFUSED
      // -3 = HTTPC_ERROR_SEND_HEADER_FAILED
      // -4 = HTTPC_ERROR_SEND_PAYLOAD_FAILED
      // -11 = HTTPC_ERROR_READ_TIMEOUT
    }
    http.end();
  }
