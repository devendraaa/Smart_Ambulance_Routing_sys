import asyncio
import httpx
from fastapi import APIRouter, HTTPException

router = APIRouter()

NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse"
USER_AGENT = "Smart Ambulance Route with AI"

# Simple in-memory cache
_geocode_cache: dict[str, str] = {}


@router.get("/reverse")
async def reverse_geocode(lat: float, lon: float):
    """Reverse geocode coordinates to a human-readable address via Nominatim."""
    cache_key = f"{lat:.5f},{lon:.5f}"
    if cache_key in _geocode_cache:
        return {"display_name": _geocode_cache[cache_key]}

    await asyncio.sleep(1)  # Respect Nominatim rate limit: 1 req/sec

    params = {
        "format": "json",
        "lat": str(lat),
        "lon": str(lon),
        "zoom": "18",
        "addressdetails": "1",
    }
    headers = {"User-Agent": USER_AGENT}

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(NOMINATIM_URL, params=params, headers=headers)
            if response.status_code == 429:
                raise HTTPException(
                    status_code=429,
                    detail="Rate limited by geocoding service. Please wait a moment and try again."
                )
            response.raise_for_status()
            data = response.json()
            name = data.get("display_name", f"{lat:.5f}, {lon:.5f}")
            _geocode_cache[cache_key] = name
            return {"display_name": name}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Geocoding failed: {str(e)}"
        )
