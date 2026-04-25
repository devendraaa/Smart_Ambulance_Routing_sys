from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime


class HospitalCreate(BaseModel):
    name: str


class HospitalResponse(BaseModel):
    id: UUID | str
    name: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class NearbyHospitalResponse(BaseModel):
    id: UUID | str
    name: str
    latitude: float
    longitude: float
    distance_km: float
