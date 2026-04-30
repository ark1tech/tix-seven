#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClient.h>
#include <ArduinoJson.h>
#include <SoftwareSerial.h>
#include <Servo.h>

// --- Configuration ---
const char* ssid = "5PLDT";
const char* password = "Straw1berry!";

// Server Details
const char* serverUrl = "http://192.168.50.143:8000/verify"; // Replace with server's IP
const char* apiKey = "64ca232bb34d5786219670dcb032dc8def1096de71b7c12c85fba03a02a7377e";                      // Must match GATE_API_KEY
const String gateId = "04adee71-453f-4fff-b5ba-e2b7c4046ced";

// --- Hardware Pins ---
#define GREEN_LED_PIN D8
#define RED_LED_PIN D7
#define GATE_SERVO_PIN D3 // Connect to the Servo's signal (usually yellow/orange) wire
#define SCANNER_RX_PIN D5 // Connected to Scanner TXD (Pin 5)
#define SCANNER_TX_PIN D6 // Connected to Scanner RXD (Pin 4)
SoftwareSerial scannerSerial(SCANNER_RX_PIN, SCANNER_TX_PIN);

// Variables to prevent spamming the server
unsigned long lastScanTime = 0;
const unsigned long scanCooldown = 3000; // Wait 3 seconds before accepting the NEXT scan

// Define Servo Angles
const int GATE_CLOSED_ANGLE = 0;  // Adjust this to match your closed physical position
const int GATE_OPEN_ANGLE = 90;   // Adjust this to match your open physical position
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
  // gateServo.attach(GATE_SERVO_PIN);
  // gateServo.write(GATE_CLOSED_ANGLE); // Ensure gate is closed on startup
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
  if (WiFi.status() == WL_CONNECTED) {
    WiFiClient client;
    HTTPClient http;
    Serial.println("Connecting to server...");
    http.begin(client, serverUrl);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-Gate-Api-Key", apiKey);
    // Create the JSON payload
    StaticJsonDocument<200> doc;
    doc["qr_payload"] = qrPayload;
    doc["gate_id"] = gateId;

    String requestBody;
    serializeJson(doc, requestBody);
    int httpResponseCode = http.POST(requestBody);
    if (httpResponseCode > 0) {
      String response = http.getString();
      Serial.println("Server Response: " + response);
      // Parse the JSON Response
      StaticJsonDocument<256> responseDoc;
      DeserializationError error = deserializeJson(responseDoc, response);
      if (!error) {
        String result = responseDoc["result"].as<String>();

        if (result == "grant") {
          Serial.println("ACCESS GRANTED! (Opening gate...)");
          digitalWrite(GREEN_LED_PIN, HIGH);
          delay(3000);                       // Keep it open for 3 seconds
          // --- OPEN THE SERVO GATE ---
          gateServo.write(GATE_OPEN_ANGLE);  // Tell servo to move to OPEN position
          delay(3000);                       // Keep it open for 3 seconds
          // --- CLOSE THE SERVO GATE ---
          gateServo.write(GATE_CLOSED_ANGLE); // Tell servo to move back to CLOSED position

          digitalWrite(GREEN_LED_PIN, LOW);
        } else if (result == "deny") {
          String reason = responseDoc["reason"].as<String>();
          Serial.println("ACCESS DENIED! Reason: " + reason);
          // --- DENY ACTION ---
          digitalWrite(RED_LED_PIN, HIGH);   // Turn ON Red LED
          // Notice we do NOT touch GATE_PIN here, so it remains closed.
          delay(2000);                       // Keep red light on for 2 seconds
          digitalWrite(RED_LED_PIN, LOW);    // Turn OFF Red LED
        }
      } else {
        Serial.println("Failed to parse server JSON response.");
      }
    } else {
      Serial.print("HTTP Error code: ");
      Serial.println(httpResponseCode);
    }
    http.end();
  } else {
    Serial.println("Error: WiFi Disconnected");
  }
}
