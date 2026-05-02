from fastapi import APIRouter, Query
from math import radians, cos, sin, asin, sqrt
from app.data.hospitals import GOVERNMENT_HOSPITALS
from typing import Optional

router = APIRouter()


def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> dict:
    """Fallback: straight-line distance via Haversine formula."""
    dist = 6371.0 * 2 * asin(sqrt(
        sin(radians(lat2 - lat1) / 2) ** 2
        + cos(radians(lat1)) * cos(radians(lat2)) * sin(radians(lon2 - lon1) / 2) ** 2
    ))
    avg_speed = 25.0
    return {
        "distance_km": round(dist, 2),
        "estimated_time_min": round(dist / avg_speed * 60, 1) if dist > 0 else 0,
    }


@router.get("/list")
async def get_hospitals_list(
    origin_lat: Optional[float] = Query(None),
    origin_lon: Optional[float] = Query(None),
):
    """List all government hospitals with road distance from origin (via OSRM table),
    falling back to Haversine straight-line distance if routing fails.
    """
    hospitals = []
    use_road_distance = origin_lat is not None and origin_lon is not None

    if use_road_distance:
        destinations = [(h["lat"], h["lon"]) for h in GOVERNMENT_HOSPITALS]
        try:
            from app.services.osm_client import fetch_road_distances_osrm
            results = await fetch_road_distances_osrm(origin_lat, origin_lon, destinations)
            for i, h in enumerate(GOVERNMENT_HOSPITALS):
                dist_m, dur_s = results[i]
                entry = {**h}
                entry["distance_km"] = round(dist_m / 1000, 2)
                entry["estimated_time_min"] = round(dur_s / 60, 1)
                hospitals.append(entry)
        except Exception as e:
            print(f"[HOSPITALS] OSRM table failed, falling back to Haversine: {e}")
            for h in GOVERNMENT_HOSPITALS:
                entry = {**h}
                travel = _haversine(origin_lat, origin_lon, h["lat"], h["lon"])
                entry["distance_km"] = travel["distance_km"]
                entry["estimated_time_min"] = travel["estimated_time_min"]
                hospitals.append(entry)
    else:
        for h in GOVERNMENT_HOSPITALS:
            entry = {**h}
            entry["distance_km"] = None
            entry["estimated_time_min"] = None
            hospitals.append(entry)

    hospitals.sort(key=lambda x: x["distance_km"] if x["distance_km"] is not None else float("inf"))
    return {"hospitals": hospitals, "total": len(hospitals)}
