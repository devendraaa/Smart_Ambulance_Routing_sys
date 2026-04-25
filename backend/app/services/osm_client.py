import httpx
import xml.etree.ElementTree as ET
from typing import Optional

from app.config import settings

OSRM_ROUTING_API = "http://router.project-osrm.org/route/v1/driving/"
OSM_NODE_API = "https://api.openstreetmap.org/api/0.6/node/"
ORS_API = "https://api.openrouteservice.org/v2/directions/driving-car/geojson"


# ---------- openrouteservice (ORS) — primary routing API ----------


async def _get_ors_api_key() -> str:
    """Use configured ORS API key from env, or raise."""
    if not settings.ORS_API_KEY:
        raise ValueError(
            "ORS_API_KEY not set. Get a free key at https://openrouteservice.org/sign-up "
            "and add ORS_API_KEY to your .env file, or use OSRM fallback."
        )
    return settings.ORS_API_KEY


async def fetch_route_coordinates_via_ors(
    origin_lat: float, origin_lon: float, dest_lat: float, dest_lon: float
) -> tuple[list[tuple[float, float]], float, float]:
    """Fetch complete route geometry from openrouteservice.
    Returns (coordinates, distance_m, duration_s).
    Falls back to OSRM if ORS key is missing, invalid, or rate-limited.
    """
    try:
        api_key = await _get_ors_api_key()
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(ORS_API, json={
                "coordinates": [[origin_lon, origin_lat], [dest_lon, dest_lat]],
            }, headers={
                "Authorization": api_key,
                "Content-Type": "application/json",
            })
            response.raise_for_status()
            data = response.json()

        if not data.get("features"):
            raise ValueError(f"ORS returned no route features: {data}")

        geometry = data["features"][0]["geometry"]
        coords = [(coord[1], coord[0]) for coord in geometry["coordinates"]]
        dist = data["features"][0]["properties"]["segments"][0]["distance"]
        dur = data["features"][0]["properties"]["segments"][0]["duration"]
        return coords, dist, dur
    except (ValueError, httpx.HTTPStatusError):
        pass

    return await _fetch_route_coordinates_osrm(origin_lat, origin_lon, dest_lat, dest_lon)


# ---------- OSRM routing engine (fallback / default) ----------


async def _fetch_route_coordinates_osrm(
    origin_lat: float, origin_lon: float, dest_lat: float, dest_lon: float
) -> tuple[list[tuple[float, float]], float, float]:
    """Fetch route coordinates via OSRM geometry. Returns (coords, distance_m, duration_s)."""
    url = f"{OSRM_ROUTING_API}{origin_lon},{origin_lat};{dest_lon},{dest_lat}?alternatives=false&overview=full&geometries=polyline6"
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(url)
        response.raise_for_status()
        data = response.json()

    if data.get("code") != "Ok":
        raise ValueError(f"OSRM routing failed: {data}")

    geometry = data["routes"][0]["geometry"]
    dist = data["routes"][0]["distance"]
    dur = data["routes"][0]["duration"]
    return _decode_polyline6(geometry), dist, dur


def _decode_polyline6(encoded: str, is3d: bool = False) -> list[tuple[float, float]]:
    """Decode Google-style polyline (precision 6)."""
    index = 0
    lat, lng = 0, 0
    coordinates = []
    length = len(encoded)
    if length == 0:
        return []
    while index < length:
        b, shift, result = 0, 0, 0
        while True:
            b = ord(encoded[index]) - 63
            index += 1
            result |= (b & 0x1F) << shift
            shift += 5
            if b < 0x20:
                break
        dlat = ~(result >> 1) if result & 1 else (result >> 1)
        lat += dlat
        shift, result = 0, 0
        while True:
            b = ord(encoded[index]) - 63
            index += 1
            result |= (b & 0x1F) << shift
            shift += 5
            if b < 0x20:
                break
        dlng = ~(result >> 1) if result & 1 else (result >> 1)
        lng += dlng
        coordinates.append((lat / 1e6, lng / 1e6))
    return coordinates


async def fetch_osrm_route_nodes(
    origin_lat: float, origin_lon: float, dest_lat: float, dest_lon: float
) -> list[int]:
    """Fetch route node IDs from OSRM routing engine (legacy fallback)."""
    url = f"{OSRM_ROUTING_API}{origin_lon},{origin_lat};{dest_lon},{dest_lat}?alternatives=false&annotations=nodes"
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(url)
        response.raise_for_status()
        data = response.json()

    if data.get("code") != "Ok":
        raise ValueError(f"OSRM routing failed: {data}")

    return data["routes"][0]["legs"][0]["annotation"]["nodes"]


async def fetch_single_osm_node(node_id: int) -> tuple[float | None, float | None]:
    """Fetch a single OSM node's lat/lon (legacy fallback)."""
    url = f"{OSM_NODE_API}{node_id}"
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(url)
        if response.status_code != 200:
            return None, None
        root = ET.fromstring(response.text)
        for child in root:
            try:
                lat = float(child.attrib["lat"])
                lon = float(child.attrib["lon"])
                return lat, lon
            except (KeyError, ValueError):
                continue
    return None, None
