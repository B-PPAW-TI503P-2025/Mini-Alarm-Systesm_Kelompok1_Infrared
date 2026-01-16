#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// ================= OLED CONFIG =================
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 32
#define OLED_RESET -1
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// ================= PIN CONFIG =================
#define IR_PIN 17

// ================= WIFI CONFIG =================
const char* ssid = "wa i pa i";
const char* password = "goseEP24";

// ================= SERVER =================
// PENTING: Ganti IP ini dengan IP laptop/server Anda
const char* serverURL = "http://10.128.147.57:5000/api/sensor/data";

// ================= VARIABLES =================
bool objectDetected = false;
bool lastSentState = false;

unsigned long lastSendTime = 0;
const unsigned long sendInterval = 500; // 500ms = 0.5 detik (lebih cepat)
const unsigned long forceSendInterval = 5000; // Paksa kirim setiap 5 detik

// Connection tracking
bool wifiConnected = false;
int connectionAttempts = 0;
unsigned long lastForceSend = 0;

// ================= SETUP =================
void setup() {
  Serial.begin(115200);
  delay(1000);
  
  pinMode(IR_PIN, INPUT_PULLUP);

  // OLED Init
  if(!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println(F("OLED failed"));
  }
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.clearDisplay();
  display.setCursor(0, 0);
  display.println("IR SENSOR");
  display.println("Initializing...");
  display.display();

  // WiFi Connection
  Serial.println("Connecting to WiFi...");
  WiFi.begin(ssid, password);
  
  while (WiFi.status() != WL_CONNECTED && connectionAttempts < 20) {
    delay(500);
    Serial.print(".");
    connectionAttempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    wifiConnected = true;
    Serial.println("\nWiFi Connected!");
    Serial.print("IP: ");
    Serial.println(WiFi.localIP());
    
    display.clearDisplay();
    display.setCursor(0, 0);
    display.println("WiFi Connected");
    display.print("IP: ");
    display.println(WiFi.localIP());
    display.display();
    delay(2000);
  } else {
    Serial.println("\nWiFi Connection Failed!");
    display.clearDisplay();
    display.setCursor(0, 0);
    display.println("WiFi FAILED");
    display.println("Check credentials");
    display.display();
  }
}

// ================= LOOP =================
void loop() {
  // Read IR Sensor (LOW = Detected)
  objectDetected = (digitalRead(IR_PIN) == LOW);

  // Update OLED Display
  display.clearDisplay();
  display.setCursor(0, 0);
  display.println("IR SENSOR MONITOR");
  display.println("----------------");
  
  if (wifiConnected) {
    display.print("WiFi: OK");
  } else {
    display.print("WiFi: FAIL");
  }
  
  display.setCursor(0, 24);
  if (objectDetected) {
    display.setTextSize(1);
    display.print(">>> DETECTED <<<");
  } else {
    display.print("Status: IDLE");
  }
  display.display();

  // Send Data to Server (INSTANT ON CHANGE)
  unsigned long now = millis();
  
  // Send immediately if state changed, or force send every 5 seconds
  bool stateChanged = (objectDetected != lastSentState);
  bool timeForForceSend = (now - lastForceSend >= forceSendInterval);
  
  if (stateChanged || timeForForceSend) {
    if (WiFi.status() == WL_CONNECTED) {
      sendSensorData(objectDetected);
      lastSentState = objectDetected;
      lastForceSend = now;
    } else {
      Serial.println("WiFi Disconnected. Reconnecting...");
      WiFi.reconnect();
    }
  }

  delay(50); // Reduce delay for faster response
}

// ================= SEND DATA FUNCTION =================
void sendSensorData(bool detected) {
  HTTPClient http;
  
  Serial.println("=== Sending Data ===");
  Serial.print("Status: ");
  Serial.println(detected ? "DETECTED" : "CLEAR");
  
  http.begin(serverURL);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(3000); // Reduce timeout to 3 seconds for faster response

  // Create JSON payload
  StaticJsonDocument<200> doc;
  doc["sensor_id"] = "ESP32_IR_001";
  doc["detected"] = detected ? 1 : 0;

  String jsonPayload;
  serializeJson(doc, jsonPayload);

  // Send POST request (non-blocking as possible)
  int httpResponseCode = http.POST(jsonPayload);

  if (httpResponseCode > 0) {
    if (httpResponseCode == 201) {
      Serial.println("✓ Data sent successfully!");
    } else {
      Serial.print("Response Code: ");
      Serial.println(httpResponseCode);
    }
  } else {
    Serial.print("✗ Error: ");
    Serial.println(http.errorToString(httpResponseCode).c_str());
  }

  http.end();
  Serial.println("====================\n");
}