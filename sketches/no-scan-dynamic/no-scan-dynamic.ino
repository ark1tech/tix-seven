#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClient.h>
#include <ArduinoJson.h>

// --- Configuration ---
const char* ssid = "TP-Link_BFEA";
const char* password = "Twd090702_";

// Server Details
const char* serverUrl = "http://192.168.0.107:8000/verify"; // Server's IP
const char* apiKey = "64ca232bb34d5786219670dcb032dc8def1096de71b7c12c85fba03a02a7377e";  // Shared GATE_API_KEY
const String gateId = "1a1137d5-e36a-400e-96c2-2d4e6019268e";

void setup() {
  Serial.begin(115200); // For USB debugging
  delay(1000);

  // Connect to Wi-Fi
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConnected to WiFi!");
  Serial.println("System Ready. Please paste a JSON payload into the Serial Monitor and press Enter.");
}

void loop() {
  // Check if data is available on the Serial port
  if (Serial.available() > 0) {
    // Read the incoming string until a newline character is received
    String incomingPayload = Serial.readStringUntil('\n');
    
    // Clean up any stray carriage returns (\r) or whitespace
    incomingPayload.trim();

    if (incomingPayload.length() > 0) {
      Serial.println("\n--- Manual Triggering Test ---");
      Serial.println("Sending Payload: " + incomingPayload);

      // Pass the manually inputted JSON to the verification function
      verifyTicket(incomingPayload);
      
      Serial.println("\nReady for next payload. Paste JSON and press Enter:");
    }
  }
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

    http.setTimeout(60000); // Wait up to 60 seconds for MOSIP processing
    int httpResponseCode = http.POST(requestBody);

    if (httpResponseCode > 0) {
      String response = http.getString();
      Serial.println("Server Raw Response: " + response);

      // Parse the JSON Response
      StaticJsonDocument<256> responseDoc;
      DeserializationError error = deserializeJson(responseDoc, response);

      if (!error) {
        String result = responseDoc["result"].as<String>();

        if (result == "grant") {
          Serial.println("[SUCCESS] ACCESS GRANTED!");
        } else if (result == "deny") {
          String reason = responseDoc["reason"].as<String>();
          Serial.println("[DENIED] ACCESS DENIED! Reason: " + reason);
        } else {
          Serial.println("[WARNING] Unknown result status received.");
        }
      } else {
        Serial.println("[ERROR] Failed to parse server JSON response.");
      }
    } else {
      Serial.print("[ERROR] HTTP Error code: ");
      Serial.println(httpResponseCode);
    }
    http.end();
  } else {
    Serial.println("[ERROR] WiFi Disconnected");
  }
}
