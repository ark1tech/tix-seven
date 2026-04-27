#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>

// ==========================================
// ENVIRONMENT TOGGLE
// Comment out the next line for PRODUCTION
#define LOCAL_DEV_MODE 
// ==========================================

// --- Configuration ---
const char* ssid = "TP-Link_BFEA";
const char* password = "Twd090702_";

// Server Details
#ifdef LOCAL_DEV_MODE
  const char* serverUrl = "http://192.168.0.107:8000/verify"; // Local Server's IP
#else
  // TODO: REPLACE THIS WITH YOUR REAL RAILWAY URL
  const char* serverUrl = "https://your-app-name.up.railway.app/verify"; 
#endif

const char* apiKey = "64ca232bb34d5786219670dcb032dc8def1096de71b7c12c85fba03a02a7377e";  // Shared GATE_API_KEY
const String gateId = "1a1137d5-e36a-400e-96c2-2d4e6019268e";

// --- Let's Encrypt Root CA (ISRG Root X1) ---
// Valid until 2035. Used by Railway to secure the connection.
const char* rootCACertificate = \
"-----BEGIN CERTIFICATE-----\n" \
"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\n" \
"-----END CERTIFICATE-----\n";

X509List cert(rootCACertificate);

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
    HTTPClient http;

#ifdef LOCAL_DEV_MODE
    Serial.println("Connecting to local server (HTTP)...");
    WiFiClient client;
    http.begin(client, serverUrl);
#else
    Serial.println("Connecting to secure server (HTTPS - Verified)...");
    WiFiClientSecure client;
    
    // Set the Root CA for strict verification
    client.setTrustAnchors(&cert);
    
    http.begin(client, serverUrl);
#endif

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
#ifdef LOCAL_DEV_MODE
      Serial.print("[ERROR] HTTP Error code: ");
      Serial.println(httpResponseCode);
#else
      Serial.print("[ERROR] HTTPS Error code: ");
      Serial.println(httpResponseCode);
      if (httpResponseCode < 0) {
        Serial.println("  Note: A negative error code might indicate a TLS/Certificate verification failure.");
      }
#endif
    }
    http.end();
  } else {
    Serial.println("[ERROR] WiFi Disconnected");
  }
}
