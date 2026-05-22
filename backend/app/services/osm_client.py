import httpx
import math
import xml.etree.ElementTree as ET
from typing import Optional

from app.config import settings

OSRM_ROUTING_API = "http://router.project-osrm.org/route/v1/driving/"
OSM_NODE_API = "https://api.openstreetmap.org/api/0.6/node/"
ORS_API = "https://api.openrouteservice.org/v2/directions/driving-car/geojson"


# ---------- OSRM routing engine — primary ----------


async def fetch_route_coordinates_via_ors(
    origin_lat: float, origin_lon: float, dest_lat: float, dest_lon: float
) -> tuple[list[tuple[float, float]], float, float]:
    """Fetch route coordinates trying OSRM first, falling back to ORS.
    Returns (coordinates, distance_m, duration_s).
    """
    try:
        return await _fetch_route_coordinates_osrm(origin_lat, origin_lon, dest_lat, dest_lon)
    except Exception:
        pass

    return await _fetch_route_coordinates_ors(origin_lat, origin_lon, dest_lat, dest_lon)


# ---------- ORS fallback ----------


async def _get_ors_api_key() -> str:
    """Use configured ORS API key from env, or raise."""
    if not settings.ORS_API_KEY:
        raise ValueError(
            "ORS_API_KEY not set. Get a free key at https://openrouteservice.org/sign-up "
            "and add ORS_API_KEY to your .env file."
        )
    return settings.ORS_API_KEY


async def _fetch_route_coordinates_ors(
    origin_lat: float, origin_lon: float, dest_lat: float, dest_lon: float
) -> tuple[list[tuple[float, float]], float, float]:
    """Fetch route geometry from openrouteservice (fallback)."""
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


# ---------- OSRM routing engine ----------


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


async def fetch_road_distances_osrm(
    origin_lat: float, origin_lon: float,
    destinations: list[tuple[float, float]],
) -> list[tuple[float, float]]:
    """Fetch road distances (meters) and durations (seconds) from one origin to N destinations.

    Uses OSRM table service for a single efficient call.
    Returns list of (distance_m, duration_s) tuples matching destinations order.
    Raises on failure so caller can fall back to Haversine.
    """
    if not destinations:
        return []
    coords = f"{origin_lon},{origin_lat}" + "".join(
        f";{lon},{lat}" for lat, lon in destinations
    )
    url = f"{OSRM_ROUTING_API.replace('/route/', '/table/')}{coords}?annotations=duration,distance"
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(url)
        response.raise_for_status()
        data = response.json()
    if data.get("code") != "Ok":
        raise ValueError(f"OSRM table failed: {data}")
    # Row 0 = origin; column 0 = origin-to-origin (skip it), columns 1..N = destinations
    origin_dists = data["distances"][0]
    origin_durs = data["durations"][0]
    return list(zip(origin_dists[1:], origin_durs[1:]))


OVERPASS_URL = "https://overpass-api.de/api/interpreter"


async def fetch_traffic_signals_along_route(
    coordinates: list[tuple[float, float]],
    buffer_km: float = 0.05,
) -> list[dict]:
    """Find real traffic signals along a route using Overpass API.

    Queries OSM for nodes with highway=traffic_signals within a bounding box
    around the route, then matches them to the nearest route coordinate.
    Returns list of {lat, lon, signal_id, road_name, junction}.
    """
    if not coordinates:
        return []

    # Build bounding box from ALL route coordinates with margin
    lats = [c[0] for c in coordinates]
    lons = [c[1] for c in coordinates]
    # buffer_km to degrees (~111km per degree latitude)
    lat_margin = buffer_km / 111.0
    # Longitude margin adjusted for latitude (Mumbai ~19°N)
    avg_lat = sum(lats) / len(lats)
    lon_margin = buffer_km / (111.0 * math.cos(math.radians(avg_lat)))

    south = min(lats) - lat_margin
    north = max(lats) + lat_margin
    west = min(lons) - lon_margin
    east = max(lons) + lon_margin

    print(f"[TRAFFIC] Querying Overpass for traffic signals in bbox: S={south:.4f}, W={west:.4f}, N={north:.4f}, E={east:.4f}")

    # Overpass QL: query traffic signal nodes in bounding box
    # Format: south,west,north,east
    query = f"""
[out:json][timeout:30];
(
  node["highway"="traffic_signals"]({south:.5f},{west:.5f},{north:.5f},{east:.5f});
);
out body;
"""
    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            resp = await client.post(OVERPASS_URL, data={"data": query})
            resp.raise_for_status()
            data = resp.json()
        except Exception as e:
            print(f"[TRAFFIC] Overpass query failed: {e}")
            return []

    elements = data.get("elements", [])
    print(f"[TRAFFIC] Overpass returned {len(elements)} traffic signal nodes")

    if not elements:
        return []

    # For each traffic signal, find the nearest route coordinate
    sig_list = []
    for el in elements:
        slat = el.get("lat")
        slon = el.get("lon")
        if slat is None or slon is None:
            continue

        best_dist = float("inf")
        for rlat, rlon in coordinates:
            d = _haversine_fast(slat, slon, rlat, rlon)
            if d < best_dist:
                best_dist = d

        if best_dist <= buffer_km:
            tags = el.get("tags", {})
            sig_list.append({
                "lat": slat,
                "lon": slon,
                "signal_id": str(el["id"]),
                "distance_km": round(best_dist, 4),
                "road_name": tags.get("name", ""),
                "junction": tags.get("junction", ""),
            })

    print(f"[TRAFFIC] Found {len(sig_list)} traffic signals within {buffer_km*1000:.0f}m of route")

    # Sort by distance along route (index of nearest coordinate)
    def _sort_key(s):
        slat, slon = s["lat"], s["lon"]
        min_idx = 0
        min_d = float("inf")
        for i, (rlat, rlon) in enumerate(coordinates):
            d = _haversine_fast(slat, slon, rlat, rlon)
            if d < min_d:
                min_d = d
                min_idx = i
        return min_idx

    sig_list.sort(key=_sort_key)

    # Add sequence numbers (1-based)
    for idx, s in enumerate(sig_list):
        s["sequence"] = idx + 1

    return sig_list


def _haversine_fast(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Fast Haversine distance in km."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


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
