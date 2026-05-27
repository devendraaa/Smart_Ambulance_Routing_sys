import hashlib
from fastapi import APIRouter, Query
from typing import Optional
from math import radians, cos, sin, asin, sqrt
from app.data.blood_banks import BLOOD_BANKS, BLOOD_TYPES

router = APIRouter()

BASE_AVAILABILITY: dict[str, float] = {
    "A+": 5.5, "A-": 2.0, "B+": 6.0, "B-": 1.5,
    "AB+": 3.0, "AB-": 1.0, "O+": 8.0, "O-": 2.5,
}

SEASONAL_ADJUSTMENT: dict[str, float] = {
    "A+": 1.0, "A-": -0.3, "B+": 0.5, "B-": -0.2,
    "AB+": -0.5, "AB-": -0.1, "O+": 1.5, "O-": -0.5,
}


def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> dict:
    avg_speed = 25.0
    dist = 6371.0 * 2 * asin(sqrt(
        sin(radians(lat2 - lat1) / 2) ** 2
        + cos(radians(lat1)) * cos(radians(lat2)) * sin(radians(lon2 - lon1) / 2) ** 2
    ))
    return {
        "distance_km": round(dist, 2),
        "estimated_time_min": round(dist / avg_speed * 60, 1) if dist > 0 else 0,
    }


def _stable_liters(bank_name: str, blood_type: str) -> float:
    base = BASE_AVAILABILITY.get(blood_type, 3.0)
    adj = SEASONAL_ADJUSTMENT.get(blood_type, 0.0)
    seed = hashlib.md5(f"{bank_name}:{blood_type}".encode()).hexdigest()
    variation = (int(seed[:8], 16) % 200 - 100) / 100.0
    return round(max(0.1, base + adj + variation), 1)


@router.get("/")
def get_blood_banks(
    origin_lat: Optional[float] = Query(None),
    origin_lon: Optional[float] = Query(None),
):
    banks = []
    for b in BLOOD_BANKS:
        entry = {**b, "blood_availability": []}
        for bt in BLOOD_TYPES:
            entry["blood_availability"].append({
                "blood_type": bt,
                "available_liters": _stable_liters(b["name"], bt),
            })
        if origin_lat is not None and origin_lon is not None:
            travel = _haversine(origin_lat, origin_lon, b["lat"], b["lon"])
            entry["distance_km"] = travel["distance_km"]
            entry["estimated_time_min"] = travel["estimated_time_min"]
        else:
            entry["distance_km"] = None
            entry["estimated_time_min"] = None
        banks.append(entry)
    return {"banks": banks, "total": len(banks), "blood_types": BLOOD_TYPES}
