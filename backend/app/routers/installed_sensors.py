import asyncio
import httpx
from fastapi import APIRouter, HTTPException
from app.database import supabase
from app.schemas.sensor import SensorCreate

router = APIRouter()

NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse"
USER_AGENT = "Smart Ambulance Route with AI"

# In-memory cache
_geocode_cache: dict[str, str] = {}


async def geocode_location(lat: float, lon: float) -> str:
    """Geocode coordinates to a human-readable address via Nominatim."""
    cache_key = f"{lat:.5f},{lon:.5f}"
    if cache_key in _geocode_cache:
        print(f"[GEOCODE] Cache hit for {cache_key}: {_geocode_cache[cache_key][:50]}...")
        return _geocode_cache[cache_key]

    print(f"[GEOCODE] Geocoding {lat}, {lon}...")
    await asyncio.sleep(1)

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
            print(f"[GEOCODE] Response status: {response.status_code}")
            response.raise_for_status()
            data = response.json()
            name = data.get("display_name", f"{lat:.5f}, {lon:.5f}")
            print(f"[GEOCODE] Got name: {name[:50]}...")
            _geocode_cache[cache_key] = name
            return name
    except Exception as e:
        print(f"[GEOCODE] Failed for {lat},{lon}: {type(e).__name__}: {e}")
        return f"{lat:.5f}, {lon:.5f}"


@router.get("/")
async def list_installed_sensors(limit: int = 1000):
    """List all installed sensors from the installed_sensors table."""
    try:
        result = supabase.table("installed_sensors").select("*").order("created_at", desc=True).limit(limit).execute()
        return result.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch installed sensors: {str(e)}")


@router.post("/", status_code=201)
async def create_installed_sensor(data: SensorCreate):
    """Add a new installed sensor and resolve its location name."""
    try:
        print(f"[INSTALLED] Adding sensor: lat={data.latitude}, lon={data.longitude}")
        location_name = await geocode_location(data.latitude, data.longitude)
        print(f"[INSTALLED] Geocoded name: {location_name[:50] if location_name else 'None'}...")
        payload = {
            "latitude": data.latitude,
            "longitude": data.longitude,
            "location_name": location_name,
        }
        if data.degree is not None:
            payload["degree"] = data.degree
        print(f"[INSTALLED] Inserting payload: {payload}")
        result = supabase.table("installed_sensors").insert(payload).execute()
        print(f"[INSTALLED] Insert result: {result.data[0] if result.data else 'No data'}")
        return result.data[0]
    except Exception as e:
        print(f"[INSTALLED] Error: {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to add installed sensor: {str(e)}")


@router.delete("/{sensor_id}", status_code=204)
async def delete_installed_sensor(sensor_id: str):
    """Delete an installed sensor by ID."""
    try:
        result = supabase.table("installed_sensors").delete().eq("id", sensor_id).execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Sensor not found")
        return
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete sensor: {str(e)}")


@router.post("/{sensor_id}/refresh-location", status_code=200)
async def refresh_sensor_location(sensor_id: str):
    """Re-geocode and update the location_name for a sensor."""
    try:
        # Fetch the sensor
        result = supabase.table("installed_sensors").select("latitude,longitude").eq("id", sensor_id).single().execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Sensor not found")

        lat = result.data["latitude"]
        lon = result.data["longitude"]
        print(f"[INSTALLED] Refreshing location for sensor {sensor_id}: lat={lat}, lon={lon}")

        # Geocode
        location_name = await geocode_location(lat, lon)
        print(f"[INSTALLED] New location_name: {location_name[:50]}...")

        # Update
        update_result = supabase.table("installed_sensors").update({"location_name": location_name}).eq("id", sensor_id).execute()
        return update_result.data[0]
    except HTTPException:
        raise
    except Exception as e:
        print(f"[INSTALLED] Error refreshing location: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to refresh location: {str(e)}")
