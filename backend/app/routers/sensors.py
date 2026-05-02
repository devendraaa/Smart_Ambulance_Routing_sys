import csv
import httpx
import math
from fastapi import APIRouter, HTTPException, BackgroundTasks
from app.database import supabase
from app.schemas.sensor import SensorCreate
from app.services.road_network_extractor import extract_and_store_mumbai_roads

router = APIRouter()

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# Mumbai bounding box (approx)
MUMBAI_BOUNDS = {
    "south": 18.8900,
    "north": 19.2700,
    "west": 72.7700,
    "east": 72.9800,
}


@router.get("/")
async def list_sensors(limit: int = 1000):
    """List manually added sensors. Capped at 1000 by default to avoid lag."""
    result = supabase.table("sensors").select("*").order("created_at").limit(limit).execute()
    print(f"[DEBUG] list_sensors: returning {len(result.data)} sensors (limit={limit})")
    return result.data


@router.post("/", status_code=201)
async def create_sensor(data: SensorCreate):
    """Add a single sensor."""
    payload = {
        "latitude": data.latitude,
        "longitude": data.longitude,
    }
    if data.degree is not None:
        payload["degree"] = data.degree
    result = supabase.table("sensors").insert(payload).execute()
    return result.data[0]


@router.post("/upload-csv")
async def upload_sensors_csv(data: dict):
    """
    Upload sensors from CSV data.
    Expected format: { "csv_data": "lat,lon,degree\\n19.0760,72.8777,45\\n..." }
    Degree is optional - if not provided, it will be saved as NULL.
    """
    from io import StringIO

    csv_text = data.get("csv_data", "")
    if not csv_text:
        raise HTTPException(status_code=400, detail="No CSV data provided")

    try:
        csv_file = StringIO(csv_text)
        reader = csv.reader(csv_file)
        locations = []

        for row in reader:
            if len(row) >= 2:
                try:
                    lat_val = float(row[0].strip())
                    lon_val = float(row[1].strip())
                    sensor_data = {
                        "latitude": lat_val,
                        "longitude": lon_val,
                    }
                    # Degree is optional (column 3)
                    if len(row) >= 3 and row[2].strip():
                        try:
                            sensor_data["degree"] = float(row[2].strip())
                        except ValueError:
                            pass  # Skip invalid degree, leave it NULL
                    locations.append(sensor_data)
                except ValueError:
                    continue  # Skip invalid rows

        if not locations:
            raise HTTPException(status_code=400, detail="No valid sensor data found in CSV")

        # Bulk insert in chunks
        chunk_size = 100
        total_inserted = 0
        for i in range(0, len(locations), chunk_size):
            chunk = locations[i:i + chunk_size]
            supabase.table("sensors").insert(chunk).execute()
            total_inserted += len(chunk)

        return {
            "inserted": total_inserted,
            "message": f"Successfully inserted {total_inserted} sensors from CSV",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process CSV: {str(e)}")


@router.post("/load-overpass")
async def load_sensors_from_overpass(city: str = "Mumbai", radius_km: int = 20):
    """Download all hospitals/clinics from Mumbai via Overpass API and bulk load into sensors."""
    lat = 19.0760
    lon = 72.8777
    radius = radius_km * 1000

    overpass_query = f"""
    [out:csv(::lat,::lon)][timeout:120];
    (
      node["amenity"="hospital"](around:{radius},{lat},{lon});
      way["amenity"="hospital"](around:{radius},{lat},{lon});
      node["amenity"="clinic"](around:{radius},{lat},{lon});
      way["amenity"="clinic"](around:{radius},{lat},{lon});
    );
    out center;
    """

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            OVERPASS_URL,
            data={"data": overpass_query},
            headers={"User-Agent": "Smart Ambulance Route with AI"},
        )
        response.raise_for_status()

    lines = response.text.strip().splitlines()
    locations = []
    for line in lines[1:]:
        parts = line.strip().split("\t")
        if len(parts) >= 2:
            try:
                lat_val = float(parts[0])
                lon_val = float(parts[1])
                locations.append({"latitude": lat_val, "longitude": lon_val})
            except ValueError:
                continue

    seen = set()
    unique_locations = []
    for loc in locations:
        key = f"{loc['latitude']:.5f},{loc['longitude']:.5f}"
        if key not in seen:
            seen.add(key)
            unique_locations.append(loc)

    chunk_size = 100
    for i in range(0, len(unique_locations), chunk_size):
        chunk = unique_locations[i:i + chunk_size]
        supabase.table("sensors").insert(chunk).execute()

    return {"loaded": len(unique_locations), "message": f"Loaded {len(unique_locations)} sensors from Overpass"}


@router.post("/load-csv")
async def load_sensors_from_csv():
    """Load sensors from static/output.csv (existing Mumbai coordinate data)."""
    import os
    csv_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "..", "static", "output.csv")
    if not os.path.exists(csv_path):
        csv_path = "static/output.csv"
    if not os.path.exists(csv_path):
        return {"error": "output.csv not found"}

    locations = []
    with open(csv_path, "r") as f:
        reader = csv.reader(f)
        for row in reader:
            if len(row) >= 2:
                try:
                    lat_val = float(row[0])
                    lon_val = float(row[1])
                    locations.append({"latitude": lat_val, "longitude": lon_val})
                except ValueError:
                    continue

    chunk_size = 100
    for i in range(0, len(locations), chunk_size):
        chunk = locations[i:i + chunk_size]
        supabase.table("sensors").insert(chunk).execute()

    return {"loaded": len(locations), "message": f"Loaded {len(locations)} sensors from CSV"}


@router.post("/load-road-sensors")
async def load_road_sensors():
    """
    Fetch Mumbai road intersections via Overpass and bulk load into sensor_locations.
    Fetches in bounding-box to stay under Overpass timeout limits.
    Returns intersection points with road names and auto-generated UUIDs.
    """
    bounds = MUMBAI_BOUNDS

    overpass_query = f"""
    [out:csv(::lat,::lon,"::id","name","highway")][timeout:180];
    (
      node["highway"](around:0,{bounds["west"]},{bounds["south"]},{bounds["east"]},{bounds["north"]});
      way["highway"](bbox:{bounds["south"]},{bounds["west"]},{bounds["north"]},{bounds["east"]});
      // Get nodes that appear in multiple ways (intersections)
    );
    out center qt;
    """

    # Simpler approach: query all highway nodes in the bbox
    overpass_query = f"""
    [out:csv(::lat,::lon,"::id","name",::count)][timeout:180];
    area["place"="city"]["name"~"Mumbai"]->.mumbai;
    (
      node["highway"](area.mumbai);
    );
    out;
    """

    async with httpx.AsyncClient(timeout=180.0) as client:
        response = await client.post(
            OVERPASS_URL,
            data={"data": overpass_query},
            headers={"User-Agent": "Smart Ambulance Route with AI"},
        )
        response.raise_for_status()

    body = response.text.strip()
    lines = body.splitlines()

    # Check how many total roads nodes exist
    locations = []
    for line in lines[1:]:  # skip header
        parts = line.strip().split("\t")
        if len(parts) >= 2:
            try:
                lat_val = float(parts[0])
                lon_val = float(parts[1])
                road_name = parts[2].strip('"') if len(parts) > 2 else ""
                # Filter to highways only (road, primary, secondary, tertiary, etc.)
                highway_type = parts[3].strip('"') if len(parts) > 3 else ""
                valid_roads = [
                    "motorway", "trunk", "primary", "secondary", "tertiary",
                    "motorway_link", "trunk_link", "primary_link",
                    "secondary_link", "tertiary_link", "residential", "unclassified",
                ]
                if highway_type not in valid_roads:
                    continue
                locations.append({
                    "latitude": lat_val,
                    "longitude": lon_val,
                    "road_name": road_name,
                })
            except ValueError:
                continue

    # Deduplicate
    seen = set()
    unique_locations = []
    for loc in locations:
        key = f"{loc['latitude']:.5f},{loc['longitude']:.5f}"
        if key not in seen:
            seen.add(key)
            unique_locations.append(loc)
            if len(unique_locations) >= 900:
                break

    # Bulk insert in chunks
    chunk_size = 200
    for i in range(0, len(unique_locations), chunk_size):
        chunk = unique_locations[i:i + chunk_size]
        supabase.table("sensor_locations").insert(chunk).execute()

    return {
        "loaded": len(unique_locations),
        "message": f"Loaded {len(unique_locations)} road sensors from Overpass",
    }


@router.post("/load-road-sensors-bbox")
async def load_road_sensors_bbox(
    south: float = 18.890,
    north: float = 19.270,
    west: float = 72.770,
    east: float = 72.980,
):
    """
    Fetch road intersections in a specific bounding box.
    Safer than whole city — use multiple smaller calls.
    """
    # Query highway nodes in the box
    overpass_query = f"""
    [out:json][timeout:60];
    (
      node["highway"~"primary|secondary|tertiary|residential|trunk|motorway|unclassified"]
        ({south},{west},{north},{east});
    );
    out:ids;
    """

    async with httpx.AsyncClient(timeout=90.0) as client:
        response = await client.post(
            OVERPASS_URL,
            data={"data": overpass_query},
            headers={"User-Agent": "Smart Ambulance Route with AI"},
        )
        response.raise_for_status()

    data = response.json()
    nodes = []
    seen = set()
    for elem in data.get("elements", []):
        if elem.get("type") != "node":
            continue
        lat = elem.get("lat")
        lon = elem.get("lon")
        if lat is None or lon is None:
            continue
        key = f"{lat:.5f},{lon:.5f}"
        if key in seen:
            continue
        seen.add(key)
        road_name = elem.get("tags", {}).get("name", elem.get("tags", {}).get("highway", ""))
        nodes.append({
            "latitude": lat,
            "longitude": lon,
            "road_name": road_name,
        })

    # Bulk insert in chunks
    chunk_size = 200
    total = 0
    for i in range(0, len(nodes), chunk_size):
        chunk = nodes[i:i + chunk_size]
        supabase.table("sensor_locations").insert(chunk).execute()
        total += len(chunk)

    return {
        "loaded": total,
        "message": f"Loaded {total} road intersection sensors into sensor_locations",
    }


@router.post("/load-road-sensors-full")
async def load_road_sensors_full():
    """
    Fetch ALL Mumbai road intersections via Overpass and store in sensor_locations.
    Uses grid tiling with retries for reliability.
    """
    bounds = MUMBAI_BOUNDS
    tile_size = 0.15  # ~16km tiles — fewer requests = higher reliability

    all_nodes = []
    seen = set()
    skipped = 0

    b = bounds
    lat_start = b["south"]
    while lat_start < b["north"]:
        lat_end = min(lat_start + tile_size, b["north"])
        lon_start = b["west"]
        while lon_start < b["east"]:
            lon_end = min(lon_start + tile_size, b["east"])
            nodes = await _fetch_tile_highways(lat_start, lon_start, lat_end, lon_end, seen)
            all_nodes.extend(nodes)
            lon_start += tile_size
        lat_start += tile_size

    # Bulk insert in chunks
    chunk_size = 500
    for i in range(0, len(all_nodes), chunk_size):
        chunk = all_nodes[i:i + chunk_size]
        supabase.table("sensor_locations").insert(chunk).execute()

    return {
        "loaded": len(all_nodes),
        "skipped_tiles": skipped,
        "message": f"Loaded {len(all_nodes)} road intersection sensors",
    }


async def _fetch_tile_highways(
    lat0: float, lon0: float, lat1: float, lon1: float,
    seen: set | None = None,
) -> list[dict]:
    """Fetch highway nodes in a single tile using CSV format. Retries once on failure."""
    if seen is None:
        seen = set()
    results = []
    query = f"""
[out:csv(::id,::lat,::lon,"name","highway")][timeout:60];
node["highway"]({lat0},{lon0},{lat1},{lon1});
out;
"""
    async with httpx.AsyncClient(timeout=90.0) as client:
        try:
            resp = await client.post(
                OVERPASS_URL,
                data={"data": query},
                headers={"User-Agent": "Smart Ambulance Route with AI"},
            )
            resp.raise_for_status()
        except (httpx.HTTPError, ValueError):
            try:
                import asyncio
                await asyncio.sleep(2)
                resp = await client.post(
                    OVERPASS_URL,
                    data={"data": query},
                    headers={"User-Agent": "Smart Ambulance Route with AI"},
                )
                resp.raise_for_status()
            except (httpx.HTTPError, ValueError):
                return results

    lines = resp.text.strip().splitlines()
    for line in lines[1:]:
        parts = line.strip().split("\t")
        if len(parts) >= 3:
            try:
                lat = float(parts[1])
                lon = float(parts[2])
                name = parts[3].strip() if len(parts) > 3 else ""
                highway = parts[4].strip() if len(parts) > 4 else ""
                key = f"{lat:.6f},{lon:.6f}"
                if key not in seen:
                    seen.add(key)
                    results.append({
                        "latitude": lat,
                        "longitude": lon,
                        "road_name": name if name else highway,
                        "intersection_type": highway if highway else "unknown",
                        "source": "osm_overpass",
                    })
            except ValueError:
                continue
    return results


@router.get("/nearest/{lat}/{lon}")
async def find_nearest_sensor(lat: float, lon: float, count: int = 1):
    """
    Find nearest sensor(s) to a given coordinate.
    Brute-force within 1000m radius.
    """
    result = supabase.table("sensor_locations").select("*").execute()
    candidates = []
    for s in result.data:
        distance = haversine(lat, lon, s["latitude"], s["longitude"])
        if distance <= 1.0:  # within 1 km
            candidates.append({
                "sensor_id": s["sensor_id"],
                "latitude": s["latitude"],
                "longitude": s["longitude"],
                "road_name": s.get("road_name", ""),
                "distance_km": round(distance, 3),
            })

    candidates.sort(key=lambda x: x["distance_km"])
    return candidates[:count]


@router.get("/location-count")
async def sensor_location_count():
    """Get count of road sensors loaded."""
    result = supabase.table("sensor_locations").select("sensor_id", count="exact").execute()
    return {"count": result.count}


@router.get("/road")
async def list_road_sensors(limit: int = 1000):
    """List road intersection sensors. Capped at 1000 by default to avoid lag."""
    result = supabase.table("sensor_locations").select(
        "sensor_id,latitude,longitude,road_name,intersection_type"
    ).limit(limit).execute()
    print(f"[DEBUG] list_road_sensors: returning {len(result.data)} sensors (limit={limit})")
    return result.data


@router.post("/extract-full-network")
async def extract_full_road_network(background_tasks: BackgroundTasks):
    """
    Extract and store the complete Mumbai road network.
    This is a long-running operation that processes all roads in the Mumbai area.
    Runs in background to avoid timeout.
    """
    background_tasks.add_task(extract_and_store_mumbai_roads)
    return {
        "message": "Mumbai road network extraction started in background",
        "note": "This process may take several hours. Check /sensor-location-count for progress."
    }


@router.get("/network")
async def get_road_network(
    south: float = MUMBAI_BOUNDS["south"],
    north: float = MUMBAI_BOUNDS["north"],
    west: float = MUMBAI_BOUNDS["west"],
    east: float = MUMBAI_BOUNDS["east"],
# <<<<<<< HEAD
    limit: int = 50000
# =======
    # limit: int = 1000
# >>>>>>> f616973 (mqqt added)
    ):
    """
    Get road network nodes for map display within a bounding box.
    Returns simplified data for efficient mapping.
    """
    result = supabase.table("sensor_locations").select(
        "sensor_id,latitude,longitude,road_name,intersection_type"
    ).gte("latitude", south).lte("latitude", north).gte("longitude", west).lte("longitude", east).limit(limit).execute()

    # Transform to GeoJSON-like format for easy consumption by mapping libraries
    features = []
    for node in result.data:
        features.append({
            "type": "Feature",
            "properties": {
                "sensor_id": node["sensor_id"],
                "road_name": node["road_name"],
                "intersection_type": node["intersection_type"]
            },
            "geometry": {
                "type": "Point",
                "coordinates": [node["longitude"], node["latitude"]]
            }
        })

    return {
        "type": "FeatureCollection",
        "features": features,
        "count": len(features)
    }


# <<<<<<< HEAD
# =======
@router.get("/near-route/{task_id}")
async def get_sensors_near_route(
    task_id: str,
    threshold_km: float = 0.002,
):
    """
    Find manually added sensors within threshold_km of the computed route.
    Default threshold is 0.002 km (2 meters).
    Uses bounding box pre-filtering for performance with large sensor datasets.
    """
    # Fetch route coordinates
    route_result = (
        supabase.table("route_task_coordinates")
        .select("latitude,longitude")
        .eq("task_id", task_id)
        .order("sequence_order")
        .execute()
    )

    if not route_result.data:
        return {"sensors": [], "count": 0}

    route_coords = [(c["latitude"], c["longitude"]) for c in route_result.data]

    # Calculate bounding box from route + threshold (convert km to degrees approx)
    # 1 deg lat ≈ 111 km, 1 deg lon ≈ 111 km at equator (approx for Mumbai)
    lat_threshold_deg = threshold_km / 111.0
    # For longitude, adjust by latitude (Mumbai is ~19° N)
    avg_lat = sum(c[0] for c in route_coords) / len(route_coords)
    lon_threshold_deg = threshold_km / (111.0 * math.cos(math.radians(avg_lat)))

    min_lat = min(c[0] for c in route_coords) - lat_threshold_deg
    max_lat = max(c[0] for c in route_coords) + lat_threshold_deg
    min_lon = min(c[1] for c in route_coords) - lon_threshold_deg
    max_lon = max(c[1] for c in route_coords) + lon_threshold_deg

    # Fetch sensors within bounding box, capped at 1000 (avoid lag with 13K dataset)
    all_sensors = (
        supabase.table("sensors")
        .select("*")
        .gte("latitude", min_lat)
        .lte("latitude", max_lat)
        .gte("longitude", min_lon)
        .lte("longitude", max_lon)
        .limit(1000)
        .execute()
    ).data

    print(f"[DEBUG] get_sensors_near_route: {len(all_sensors)} sensors within bounding box (capped at 1000)")

    if not all_sensors:
        return {"sensors": [], "count": 0}

    # Find sensors within threshold distance of any route coordinate
    nearby_sensors = []
    for s in all_sensors:
        min_dist = float("inf")
        s_lat = s["latitude"]
        s_lon = s["longitude"]
        for r_lat, r_lon in route_coords:
            d = haversine(s_lat, s_lon, r_lat, r_lon)
            if d < min_dist:
                min_dist = d
                if d <= threshold_km:  # Early exit if we found a match
                    break
        if min_dist <= threshold_km:
            nearby_sensors.append({
                "id": str(s["id"]) if not isinstance(s["id"], str) else s["id"],
                "latitude": s_lat,
                "longitude": s_lon,
                "degree": s.get("degree"),
                "distance_km": round(min_dist, 6),
            })

    return {"sensors": nearby_sensors, "count": len(nearby_sensors)}


# >>>>>>> f616973 (mqqt added)
def haversine(lat1, lon1, lat2, lon2) -> float:
    """Calculate distance in km between two coordinates."""
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


def get_sensors_near_route_standalone(task_id: str, threshold_km: float = 0.002) -> list[dict]:
    """
    Standalone sync function to find sensors near a route.
    Can be called from worker threads (unlike the async FastAPI endpoint).
    Returns a list of nearby sensor dicts (not a JSON response).
    """
    from app.database import supabase

    # Fetch route coordinates
    route_result = (
        supabase.table("route_task_coordinates")
        .select("latitude,longitude")
        .eq("task_id", task_id)
        .order("sequence_order")
        .execute()
    )

    if not route_result.data:
        return []

    route_coords = [(c["latitude"], c["longitude"]) for c in route_result.data]

    # Calculate bounding box from route + threshold
    lat_threshold_deg = threshold_km / 111.0
    avg_lat = sum(c[0] for c in route_coords) / len(route_coords)
    lon_threshold_deg = threshold_km / (111.0 * math.cos(math.radians(avg_lat)))

    min_lat = min(c[0] for c in route_coords) - lat_threshold_deg
    max_lat = max(c[0] for c in route_coords) + lat_threshold_deg
    min_lon = min(c[1] for c in route_coords) - lon_threshold_deg
    max_lon = max(c[1] for c in route_coords) + lon_threshold_deg

    # Fetch sensors within bounding box, capped at 1000
    all_sensors = (
        supabase.table("sensors")
        .select("*")
        .gte("latitude", min_lat)
        .lte("latitude", max_lat)
        .gte("longitude", min_lon)
        .lte("longitude", max_lon)
        .limit(1000)
        .execute()
    ).data

    if not all_sensors:
        return []

    # Find sensors within threshold distance
    nearby = []
    for s in all_sensors:
        min_dist = float("inf")
        s_lat = s["latitude"]
        s_lon = s["longitude"]
        for r_lat, r_lon in route_coords:
            d = haversine(s_lat, s_lon, r_lat, r_lon)
            if d < min_dist:
                min_dist = d
                if d <= threshold_km:
                    break
        if min_dist <= threshold_km:
            nearby.append({
                "id": str(s["id"]) if not isinstance(s["id"], str) else s["id"],
                "latitude": s_lat,
                "longitude": s_lon,
                "degree": s.get("degree"),
                "distance_km": round(min_dist, 6),
            })

    return nearby


# ===== Traffic Signals =====

@router.post("/load-traffic-signals")
async def load_traffic_signals(background_tasks: BackgroundTasks):
    """
    Pre-load traffic signals from Overpass into traffic_signals table.
    Queries Mumbai for highway=traffic_signals nodes.
    Runs in background to avoid timeout.
    """
    background_tasks.add_task(_load_traffic_signals_task)
    return {
        "message": "Traffic signal loading started in background",
        "note": "Check traffic signal count endpoint for progress"
    }


@router.get("/traffic-signal-count")
async def traffic_signal_count():
    """Get count of pre-loaded traffic signals."""
    result = supabase.table("traffic_signals").select("signal_id", count="exact").execute()
    return {"count": result.count}


async def _load_traffic_signals_task():
    """Background task to load traffic signals from Overpass."""
    bounds = MUMBAI_BOUNDS
    tile_size = 0.1  # ~11km tiles

    all_signals = []
    seen = set()
    skipped = 0

    lat_start = bounds["south"]
    while lat_start < bounds["north"]:
        lat_end = min(lat_start + tile_size, bounds["north"])
        lon_start = bounds["west"]
        while lon_start < bounds["east"]:
            lon_end = min(lon_start + tile_size, bounds["east"])
            signals = await _fetch_tile_traffic_signals(lat_start, lon_start, lat_end, lon_end, seen)
            all_signals.extend(signals)
            lon_start += tile_size
        lat_start += tile_size

    # Bulk insert in chunks
    chunk_size = 500
    for i in range(0, len(all_signals), chunk_size):
        chunk = all_signals[i:i + chunk_size]
        supabase.table("traffic_signals").insert(chunk).execute()

    print(f"[TRAFFIC] Loaded {len(all_signals)} traffic signals (skipped {skipped} duplicates)")


async def _fetch_tile_traffic_signals(
    lat0: float, lon0: float, lat1: float, lon1: float,
    seen: set | None = None,
) -> list[dict]:
    """Fetch traffic signal nodes in a single tile from Overpass."""
    if seen is None:
        seen = set()
    results = []
    query = f"""
[out:json][timeout:60];
node["highway"="traffic_signals"]({lat0},{lon0},{lat1},{lon1});
out body;
"""
    async with httpx.AsyncClient(timeout=90.0) as client:
        try:
            resp = await client.post(
                OVERPASS_URL,
                data={"data": query},
                headers={"User-Agent": "Smart Ambulance Route with AI"},
            )
            resp.raise_for_status()
        except (httpx.HTTPError, ValueError):
            try:
                import asyncio
                await asyncio.sleep(2)
                resp = await client.post(
                    OVERPASS_URL,
                    data={"data": query},
                    headers={"User-Agent": "Smart Ambulance Route with AI"},
                )
                resp.raise_for_status()
            except (httpx.HTTPError, ValueError):
                return results

    data = resp.json()
    for elem in data.get("elements", []):
        if elem.get("type") != "node":
            continue
        lat = elem.get("lat")
        lon = elem.get("lon")
        if lat is None or lon is None:
            continue
        key = f"{lat:.6f},{lon:.6f}"
        if key not in seen:
            seen.add(key)
            tags = elem.get("tags", {})
            results.append({
                "latitude": lat,
                "longitude": lon,
                "road_name": tags.get("name", tags.get("junction:ref", "")),
                "junction_type": tags.get("junction", "traffic_signals"),
                "source": "osm_overpass",
            })
    return results
