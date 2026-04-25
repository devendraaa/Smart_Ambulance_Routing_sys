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
