from typing import Optional
from pydantic import BaseModel
from uuid import UUID
from datetime import datetime


class SensorCreate(BaseModel):
    latitude: float
    longitude: float
    degree: Optional[float] = None


class SensorResponse(BaseModel):
    id: UUID | str
    latitude: float
    longitude: float
    degree: Optional[float] = None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}
