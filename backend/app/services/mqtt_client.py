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


mqtt_client = MQTTClient()
