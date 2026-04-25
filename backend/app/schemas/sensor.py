from pydantic import BaseModel
from uuid import UUID
from datetime import datetime


class SensorCreate(BaseModel):
    latitude: float
    longitude: float


class SensorResponse(BaseModel):
    id: UUID | str
    latitude: float
    longitude: float
    created_at: datetime | None = None

    model_config = {"from_attributes": True}
