from fastapi import APIRouter, Query
from math import radians, cos, sin, asin, sqrt
from app.data.hospitals import GOVERNMENT_HOSPITALS
from typing import Optional

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


@router.get("/list")
def get_hospitals_list(
    origin_lat: Optional[float] = Query(None),
    origin_lon: Optional[float] = Query(None),
):
    hospitals = []
    for h in GOVERNMENT_HOSPITALS:
        entry = {**h}
        if origin_lat is not None and origin_lon is not None:
            travel = _haversine(origin_lat, origin_lon, h["lat"], h["lon"])
            entry["distance_km"] = travel["distance_km"]
            entry["estimated_time_min"] = travel["estimated_time_min"]
        else:
            entry["distance_km"] = None
            entry["estimated_time_min"] = None
        hospitals.append(entry)
    return {"hospitals": hospitals, "total": len(hospitals)}
