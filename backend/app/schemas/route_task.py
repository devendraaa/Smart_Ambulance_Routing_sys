from pydantic import BaseModel
from typing import Optional


class RouteComputeRequest(BaseModel):
    origin_lat: float
    origin_lon: float
    hospital_name: str
    hospital_lat: Optional[float] = None
    hospital_lon: Optional[float] = None


class RouteTaskStartResponse(BaseModel):
    task_id: str
    status: str


class RouteTaskStatusResponse(BaseModel):
    task_id: str
    status: str
    progress: float
    processed_nodes: int
    total_nodes: int
    distance_km: Optional[float] = None
    duration_min: Optional[float] = None
    error: Optional[str] = None
    result: Optional[dict] = None
    map_url: Optional[str] = None


class CoordinateEntry(BaseModel):
    lat: float
    lon: float
    sequence: int


class CoordinateResponse(BaseModel):
    coordinates: list[CoordinateEntry]
