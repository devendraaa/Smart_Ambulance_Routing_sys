import httpx
from typing import Optional

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "Smart Ambulance Route with AI"


async def geocode_location(place: str) -> Optional[dict]:
    params = {"q": place, "format": "json"}
    headers = {"User-Agent": USER_AGENT}

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(NOMINATIM_URL, params=params, headers=headers)
        data = response.json()

    if data:
        return {
            "lat": float(data[0]["lat"]),
            "lon": float(data[0]["lon"]),
            "display_name": data[0].get("display_name", place),
        }
    return None
