import random
from fastapi import APIRouter, Query
from typing import Optional
from math import radians, cos, sin, asin, sqrt
from app.data.blood_banks import BLOOD_BANKS, BLOOD_TYPES

router = APIRouter()


def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    avg_speed = 25.0
    dist = 6371.0 * 2 * asin(sqrt(
        sin(radians(lat2 - lat1) / 2) ** 2
        + cos(radians(lat1)) * cos(radians(lat2)) * sin(radians(lon2 - lon1) / 2) ** 2
    ))
    return {
        "distance_km": round(dist, 2),
        "estimated_time_min": round(dist / avg_speed * 60, 1) if dist > 0 else 0,
    }


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
                "available_liters": round(random.uniform(1.0, 10.0), 1),
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
