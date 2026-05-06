import json
import paho.mqtt.client as mqtt
from app.config import settings


class MQTTClient:
    def __init__(self):
        self.client = mqtt.Client()
        self.client.connect(settings.MQTT_BROKER_HOST, settings.MQTT_PORT, 60)
        self.client.loop_start()

    def publish_coordinates(
        self,
        coordinates: list[dict],
        topic: str = "coordinates",
        chunk_size: int = 6,
    ):
        for i in range(0, len(coordinates), chunk_size):
            chunk = coordinates[i : i + chunk_size]
            payload = {
                "lat": [f"{c['lat']:.4f}" for c in chunk],
                "lon": [f"{c['lon']:.4f}" for c in chunk],
            }
            self.client.publish(topic, json.dumps(payload))

    def publish_fixed_coordinate(
        self, lat: float, lon: float, topic: str = "fixed_coordinates"
    ):
        payload = json.dumps({"latitude": lat, "longitude": lon})
        self.client.publish(topic, payload)

    def publish_sensor_data(
        self,
        sensors: list[dict],
        topic: str = "ambulance/sensors/active",
    ):
        """Publish active sensor data to IoT devices via MQTT.

        Sends all sensors as a JSON array. Retained so late-connecting
        devices receive the data.
        """
        if not self.client.is_connected():
            print("[MQTT] Not connected, attempting reconnect...")
            self.client.reconnect()

        payload = json.dumps([
            {
                "sensor_id": s.get("sensor_id"),
                "lat": s.get("latitude"),
                "lng": s.get("longitude"),
                "road_name": s.get("road_name", ""),
                "distance_km": s.get("distance_km"),
            }
            for s in sensors
        ])
        print(f"[MQTT] Payload ({len(payload)} bytes) to {topic}")
        result = self.client.publish(topic, payload, retain=True)
        print(f"[MQTT] Publish result: rc={result.rc}, mid={result.mid}, retained=True")
        return len(sensors)

    def publish_stop_command(
        self,
        topic: str = "ambulance/sensors/stop",
    ):
        """Publish a stop command to set IoT device pin LOW.
        Not retained - device should only respond when explicitly triggered.
        """
        if not self.client.is_connected():
            print("[MQTT] Not connected, attempting reconnect...")
            self.client.reconnect()
        payload = json.dumps({"command": "stop", "pin": "low"})
        result = self.client.publish(topic, payload, retain=False)
        print(f"[MQTT] Stop command sent (not retained): rc={result.rc}, mid={result.mid}")

        # Clear any previously retained message on this topic
        self.client.publish(topic, "", retain=True)
        print(f"[MQTT] Cleared retained message on {topic}")
        return True

    def publish_amb_location(
        self,
        sensor_id: str,
        lat: float,
        lng: float,
        road_name: str = "",
        distance_km: float = 0.0,
        topic: str = "ambulance/amb-location",
    ):
        """Publish ambulance's nearest sensor location to amb82mini device.

        Sends the sensor number (sensor_id), coordinates, and distance.
        Retained so late-connecting devices receive the data.
        """
        if not self.client.is_connected():
            print("[MQTT] Not connected, attempting reconnect...")
            self.client.reconnect()

        payload = json.dumps({
            "sensor_id": sensor_id,
            "lat": lat,
            "lng": lng,
            "road_name": road_name,
            "distance_km": distance_km,
            "timestamp": __import__("time").time(),
        })

        print(f"[MQTT] Publishing amb location to {topic}: sensor={sensor_id}, lat={lat}, lng={lng}")
        result = self.client.publish(topic, payload, retain=True)
        print(f"[MQTT] Publish result: rc={result.rc}, mid={result.mid}, retained=True")
        return True


mqtt_client = MQTTClient()
