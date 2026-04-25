from fastapi import APIRouter, HTTPException
from math import radians, sin, cos, sqrt, atan2
import httpx
from app.database import supabase
from app.schemas.hospital import HospitalCreate

router = APIRouter()


def haversine(lat1, lon1, lat2, lon2) -> float:
    R = 6371.0
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return R * 2 * atan2(sqrt(a), sqrt(1 - a))


@router.get("/")
async def list_hospitals():
    result = supabase.table("hospitals").select("*").order("name").execute()
    return result.data


@router.post("/", status_code=201)
async def create_hospital(data: HospitalCreate):
    result = supabase.table("hospitals").insert({"name": data.name}).execute()
    return result.data[0]


@router.delete("/{hospital_id}")
async def delete_hospital(hospital_id: str):
    result = supabase.table("hospitals").select("*").eq("id", hospital_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Hospital not found")
    supabase.table("hospitals").delete().eq("id", hospital_id).execute()
    return {"message": "Hospital deleted"}


OVERPASS_URL = "https://overpass-api.de/api/interpreter"


@router.get("/search")
async def search_hospitals(
    q: str,
    limit: int = 10,
):
    """Search hospitals by name using Nominatim — Mumbai area."""
    if not q.strip():
        return []

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(
            "https://nominatim.openstreetmap.org/search",
            params={
                "q": f"hospital {q}, Mumbai, Maharashtra, India",
                "format": "json",
                "addressdetails": 1,
                "limit": limit,
            },
            headers={"User-Agent": "Smart Ambulance Route with AI"},
        )
        data = response.json()

    results = []
    seen = set()
    for item in data:
        display_name = item.get("display_name", "")
        if item["lat"] + "," + item["lon"] in seen:
            continue
        seen.add(item["lat"] + "," + item["lon"])
        name = item.get("name", "")
        short_name = name or display_name.split(",")[0]
        results.append({
            "name": short_name,
            "latitude": float(item["lat"]),
            "longitude": float(item["lon"]),
            "display_name": display_name,
        })

    return results[:limit]


@router.get("/nearby")
async def nearby_hospitals(lat: float, lon: float, limit: int = 5):
    result = supabase.table("hospitals").select("*").not_.is_("latitude", "null").execute()
    results = []
    for h in result.data:
        if h["latitude"] is not None and h["longitude"] is not None:
            d = haversine(lat, lon, h["latitude"], h["longitude"])
            results.append({
                **h,
                "distance_km": round(d, 2),
            })
    results.sort(key=lambda x: x["distance_km"])
    return results[:limit]
