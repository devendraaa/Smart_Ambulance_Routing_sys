from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

router = APIRouter()


class CoordinateBatch(BaseModel):
    coordinates: list[dict]
    topic: str = "coordinates"
    chunk_size: int = 6


class FixedCoordinate(BaseModel):
    latitude: float
    longitude: float


class SensorPublishRequest(BaseModel):
    sensors: list[dict]
    topic: str = "ambulance/sensors/active"


@router.post("/publish-coordinates")
async def publish_coordinates(data: CoordinateBatch):
    from app.services.mqtt_client import mqtt_client

    mqtt_client.publish_coordinates(data.coordinates, data.topic, data.chunk_size)
    return {"status": "published", "count": len(data.coordinates)}


@router.post("/publish-fixed")
async def publish_fixed(data: FixedCoordinate):
    from app.services.mqtt_client import mqtt_client

    mqtt_client.publish_fixed_coordinate(data.latitude, data.longitude)
    return {"status": "published"}


@router.post("/publish-sensors")
async def publish_sensors(data: SensorPublishRequest):
    """Publish active sensor data to IoT devices via MQTT."""
    from app.services.mqtt_client import mqtt_client

    count = mqtt_client.publish_sensor_data(data.sensors, data.topic)
    return {"status": "published", "count": count, "topic": data.topic}


@router.post("/publish-route-sensors/{task_id}")
async def publish_route_sensors(task_id: str, threshold_km: float = 0.002):
    """
    Fetch sensors near a route and publish them to MQTT for IoT devices.
    IoT devices can subscribe to 'ambulance/sensors/active' to receive this data.
    """
    from app.services.mqtt_client import mqtt_client
    from app.routers.sensors import get_sensors_near_route

    result = await get_sensors_near_route(task_id, threshold_km)
    sensors = result.get("sensors", [])

    if not sensors:
        return {"status": "no_sensors", "count": 0}

    count = mqtt_client.publish_sensor_data(sensors)
    return {"status": "published", "count": count, "topic": "ambulance/sensors/active"}


@router.post("/stop-sensors")
async def stop_sensors():
    """
    Send stop command to IoT devices to set their output pin LOW.
    Devices subscribe to 'ambulance/sensors/stop' topic.
    """
    from app.services.mqtt_client import mqtt_client

    mqtt_client.publish_stop_command()
    return {"status": "stop_command_sent", "topic": "ambulance/sensors/stop"}


class AmbLocationPublish(BaseModel):
    sensor_id: str
    latitude: float
    longitude: float
    road_name: str = ""
    distance_km: float = 0.0
    topic: str = "ambulance/amb-location"


@router.post("/publish-amb-location")
async def publish_amb_location(data: AmbLocationPublish):
    """
    Publish ambulance's current nearest sensor location to amb82mini device via MQTT.
    The amb82mini device subscribes to 'ambulance/amb-location' topic.
    Sends lat, lon, sensor_id (number), and distance for the nearest sensor.
    """
    from app.services.mqtt_client import mqtt_client

    mqtt_client.publish_amb_location(
        sensor_id=data.sensor_id,
        lat=data.latitude,
        lng=data.longitude,
        road_name=data.road_name,
        distance_km=data.distance_km,
        topic=data.topic,
    )

    return {
        "status": "published",
        "topic": data.topic,
        "sensor_id": data.sensor_id,
        "lat": data.latitude,
        "lng": data.longitude,
    }
