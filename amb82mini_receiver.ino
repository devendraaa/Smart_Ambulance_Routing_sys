#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <math.h>

// WiFi
char ssid[] = "Devendra-4G";
char password[] = "Devendra@25";

// MQTT
const char* mqtt_server = "broker.hivemq.com";
const int mqtt_port = 1883;
const char* topic_sensors = "ambulance/sensors/active";
const char* topic_stop = "ambulance/sensors/stop";

// Board location (SET THIS to match your device's actual location)
float myLat = 19.045842;
float myLng = 72.848380;

// Trigger distance (meters)
float threshold = 1.0;

// GPIO pin
int outputPin = 5;

WiFiClient espClient;
PubSubClient client(espClient);

// Track stop state to avoid re-triggering
bool stopped = false;

// Distance calculation (Haversine)
float getDistance(float lat1, float lon1, float lat2, float lon2) {
  float dLat = radians(lat2 - lat1);
  float dLon = radians(lon2 - lon1);
  float a = sin(dLat/2) * sin(dLat/2) +
            cos(radians(lat1)) * cos(radians(lat2)) *
            sin(dLon/2) * sin(dLon/2);
  float c = 2 * atan2(sqrt(a), sqrt(1-a));
  return 6371000 * c; // meters
}

// MQTT callback - handles both sensor data and stop commands
void callback(char* topic, byte* payload, unsigned int length) {
  String topicStr = String(topic);

  // === HANDLE STOP COMMAND ===
  if (topicStr == topic_stop) {
    if (stopped) {
      Serial.println("\nStop command received but device already stopped, ignoring");
      return;
    }
    Serial.println("\nReceived STOP command");
    DynamicJsonDocument doc(200);
    DeserializationError error = deserializeJson(doc, (const char*)payload, length);
    if (!error && doc["command"] == "stop") {
      digitalWrite(outputPin, LOW);
      stopped = true;
      Serial.println("PIN set to LOW (STOP) - device stopped until new sensor data arrives");
    }
    return;
  }

  // === HANDLE SENSOR DATA ===
  if (topicStr == topic_sensors) {
    Serial.println("\nReceived sensor data");
    Serial.print("  Length: "); Serial.print(length); Serial.println(" bytes");

    if (length > 20000) {
      Serial.println("Payload too large, skipping");
      return;
    }

    DynamicJsonDocument doc(20000);
    DeserializationError error = deserializeJson(doc, (const char*)payload, length);

    if (error) {
      Serial.print("JSON parse failed: ");
      Serial.println(error.c_str());
      return;
    }

    Serial.println("JSON parsed successfully");

    // RE-ARM: new sensor data = new route computed, clear stopped flag
    if (stopped) {
      stopped = false;
      digitalWrite(outputPin, LOW);  // Ensure pin starts LOW for new route
      Serial.println(">> Device RE-ARMED (new sensor data received)");
    }

    bool anyWithinRange = false;
    int sensorCount = 0;

    // Handle array format: [{lat, lng}, ...]
    if (doc.is<JsonArray>()) {
      JsonArray arr = doc.as<JsonArray>();
      sensorCount = arr.size();
      Serial.print("  Array with "); Serial.print(sensorCount); Serial.println(" sensors");

      int idx = 0;
      for (JsonObject s : arr) {
        float lat = s["lat"] | s["latitude"] | 0.0;
        float lng = s["lng"] | s["longitude"] | 0.0;
        if (lat == 0.0 && lng == 0.0) { idx++; continue; }

        float d = getDistance(myLat, myLng, lat, lng);
        Serial.print("  ["); Serial.print(idx); Serial.print("] dist=");
        Serial.print(d); Serial.println("m");

        if (d <= threshold) anyWithinRange = true;
        idx++;
      }
    }
    // Handle wrapped format: {sensors: [{...}, ...]}
    else if (doc.containsKey("sensors")) {
      JsonArray arr = doc["sensors"];
      sensorCount = arr.size();
      Serial.print("  Wrapped format with "); Serial.print(sensorCount); Serial.println(" sensors");

      int idx = 0;
      for (JsonObject s : arr) {
        float lat = s["latitude"] | s["lat"] | 0.0;
        float lng = s["longitude"] | s["lng"] | 0.0;
        if (lat == 0.0 && lng == 0.0) { idx++; continue; }

        float d = getDistance(myLat, myLng, lat, lng);
        Serial.print("  ["); Serial.print(idx); Serial.print("] dist=");
        Serial.print(d); Serial.println("m");

        if (d <= threshold) anyWithinRange = true;
        idx++;
      }
    }
    // Single sensor format: {lat, lng}
    else {
      float lat = doc["lat"] | doc["latitude"] | 0.0;
      float lng = doc["lng"] | doc["longitude"] | 0.0;
      sensorCount = 1;
      if (lat != 0.0 || lng != 0.0) {
        float d = getDistance(myLat, myLng, lat, lng);
        Serial.print("  Single sensor: dist="); Serial.print(d); Serial.println("m");
        if (d <= threshold) anyWithinRange = true;
      }
    }

    Serial.print("Checked "); Serial.print(sensorCount);
    Serial.print(" sensors, any within "); Serial.print(threshold);
    Serial.print("m? "); Serial.println(anyWithinRange ? "YES -> PIN HIGH" : "NO -> PIN LOW");

    // Set pin state (device is NOT stopped at this point)
    digitalWrite(outputPin, anyWithinRange ? HIGH : LOW);
  }
}

// MQTT reconnect
void reconnect() {
  while (!client.connected()) {
    Serial.print("Connecting MQTT...");
    String clientId = "AMB82-" + String(random(10000));
    if (client.connect(clientId.c_str())) {
      Serial.println("connected");
      boolean ok1 = client.subscribe(topic_sensors, 1);
      Serial.print("Subscribed to sensors: "); Serial.println(ok1 ? "yes" : "no");
      boolean ok2 = client.subscribe(topic_stop, 1);
      Serial.print("Subscribed to stop: "); Serial.println(ok2 ? "yes" : "no");
    } else {
      Serial.print("failed, rc=");
      Serial.println(client.state());
      delay(2000);
    }
  }
}

// Setup
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n=== AMB82-Mini Sensor Receiver ===");

  pinMode(outputPin, OUTPUT);
  digitalWrite(outputPin, LOW);
  stopped = false;
  Serial.println("GPIO pin initialized to LOW");

  // Increase MQTT buffer size to handle large payloads (12KB+)
  // If this fails to compile, edit PubSubClient.h and change
  // MQTT_MAX_PACKET_SIZE to 20000 (near line 28)
  client.setBufferSize(20000);
  Serial.println("MQTT buffer size set to 20000");

  // WiFi
  Serial.print("Connecting WiFi...");
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected");
  Serial.println(WiFi.localIP());

  // MQTT
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);
  Serial.println("MQTT server configured");
}

// Loop
void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected, reconnecting...");
    WiFi.begin(ssid, password);
    delay(2000);
    return;
  }
  if (!client.connected()) {
    reconnect();
  }
  client.loop();
}
