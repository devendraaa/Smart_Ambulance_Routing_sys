from pydantic import BaseModel
from typing import Optional


class RouteComputeRequest(BaseModel):
    origin_lat: float
    origin_lon: float
    hospital_name: str
    hospital_lat: Optional[float] = None
    hospital_lon: Optional[float] = None
    patient_name: Optional[str] = None
    patient_age: Optional[str] = None
    patient_sex: Optional[str] = None
    patient_mobile: Optional[str] = None
    patient_case: Optional[str] = None
    patient_blood_group: Optional[str] = None
    patient_date: Optional[str] = None
    ambulance_number: Optional[str] = None
    driver_name: Optional[str] = None
    driver_mobile: Optional[str] = None
    # Physiological conditions
    patient_bp_systolic: Optional[int] = None
    patient_bp_diastolic: Optional[int] = None
    patient_temperature: Optional[float] = None
    patient_pulse: Optional[int] = None
    patient_spo2: Optional[int] = None


class RouteTaskStartResponse(BaseModel):
    task_id: str
    status: str
    patient_uhid: Optional[str] = None


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
    patient_uhid: Optional[str] = None
    patient_name: Optional[str] = None
    patient_age: Optional[str] = None
    patient_sex: Optional[str] = None
    patient_mobile: Optional[str] = None
    patient_case: Optional[str] = None
    patient_blood_group: Optional[str] = None
    patient_date: Optional[str] = None
    ambulance_number: Optional[str] = None
    driver_name: Optional[str] = None
    driver_mobile: Optional[str] = None
    # Physiological conditions
    patient_bp_systolic: Optional[int] = None
    patient_bp_diastolic: Optional[int] = None
    patient_temperature: Optional[float] = None
    patient_pulse: Optional[int] = None
    patient_spo2: Optional[int] = None


class CoordinateEntry(BaseModel):
    lat: float
    lon: float
    sequence: int


class CoordinateResponse(BaseModel):
    coordinates: list[CoordinateEntry]


class EmergencyCaseResponse(BaseModel):
    task_id: str
    hospital_name: str
    origin_lat: float
    origin_lon: float
    patient_uhid: Optional[str] = None
    patient_name: Optional[str] = None
    patient_age: Optional[str] = None
    patient_sex: Optional[str] = None
    patient_mobile: Optional[str] = None
    patient_case: Optional[str] = None
    patient_blood_group: Optional[str] = None
    patient_date: Optional[str] = None
    status: str
    created_at: str
    distance_km: Optional[float] = None
    duration_min: Optional[float] = None
    ambulance_number: Optional[str] = None
    driver_name: Optional[str] = None
    driver_mobile: Optional[str] = None
    # Physiological conditions
    patient_bp_systolic: Optional[int] = None
    patient_bp_diastolic: Optional[int] = None
    patient_temperature: Optional[float] = None
    patient_pulse: Optional[int] = None
    patient_spo2: Optional[int] = None