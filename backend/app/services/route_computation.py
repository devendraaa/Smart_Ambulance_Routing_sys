from uuid import UUID
from app.database import supabase
from app.services.geocoding import geocode_location
from app.services.osm_client import fetch_route_coordinates_via_ors
from app.services.sensor_processor import process_sensor_coordinates
from app.services.turn_extractor import extract_turning_points


def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance in km between two coordinates."""
    import math
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


def _find_nearest_sensors(
    coordinates: list[tuple[float, float]],
    sensor_locations: list[dict],
    max_distance_km: float = 1.0,
) -> list[dict]:
    """
    For each route coordinate, find the nearest road intersection sensor.
    Returns list of unique sensors along the route.
    """
    route_sensors = []
    seen_ids = set()
    for lat, lon in coordinates:
        best = None
        best_dist = max_distance_km
        for s in sensor_locations:
            d = _haversine(lat, lon, s["latitude"], s["longitude"])
            if d < best_dist:
                best_dist = d
                best = {**s, "distance_km": round(d, 3)}
        if best and best["sensor_id"] not in seen_ids:
            seen_ids.add(best["sensor_id"])
            route_sensors.append(best)
    return route_sensors


# In‑memory cache for the most recent route coordinates (temporary storage)
_temp_route_cache: dict[str, list[dict[str, float]]] = {}

async def execute_route_computation(
    task_id: UUID,
    origin_lat: float,
    origin_lon: float,
    hospital_name: str,
    hospital_lat: float | None = None,
    hospital_lon: float | None = None,
    map_generator=None,
) -> dict:
    result = supabase.table("route_tasks").select("*").eq("id", str(task_id)).execute()
    if not result.data:
        raise ValueError(f"Task {task_id} not found")

    def update_task(**kwargs):
        supabase.table("route_tasks").update(kwargs).eq("id", str(task_id)).execute()

    # Mark as running
    update_task(status="running")

    # Step 1: Use provided hospital coords or geocode
    if hospital_lat is not None and hospital_lon is not None:
        dest = {"lat": hospital_lat, "lon": hospital_lon}
    else:
        dest = await geocode_location(hospital_name)
        if dest is None:
            update_task(status="failed", error_message=f"Could not geocode hospital: {hospital_name}")
            raise ValueError(f"Geocoding failed for {hospital_name}")

    update_task(destination_lat=dest["lat"], destination_lon=dest["lon"])

    # Step 2: Fetch route geometry (ORS → OSRM polyline6) — instant, no per-node calls
    coordinates, distance_m, duration_s = await fetch_route_coordinates_via_ors(
        origin_lat, origin_lon, dest["lat"], dest["lon"]
    )
    total = len(coordinates)

    # Step 3: Store raw coordinates in bulk
    if coordinates:
        coord_records = [
            {
                "task_id": str(task_id),
                "latitude": lat,
                "longitude": lon,
                "sequence_order": idx,
            }
            for idx, (lat, lon) in enumerate(coordinates)
        ]
        supabase.table("route_task_coordinates").insert(coord_records).execute()

    # Step 4: Extract and store turning points
    if coordinates:
        turning_points = extract_turning_points(coordinates)
        turn_records = [
            {
                "task_id": str(task_id),
                "latitude": lat,
                "longitude": lon,
                "sequence_order": idx,
            }
            for idx, (lat, lon) in enumerate(turning_points)
        ]
        supabase.table("route_turn_points").insert(turn_records).execute()

    # Step 5: Process sensor proximity matching (legacy + road intersection sensors)
    all_sensors = supabase.table("sensors").select("*").execute()
    sensor_list = [
        (s["latitude"], s["longitude"])
        for s in all_sensors.data
        if s.get("latitude") is not None
    ]
    processed = process_sensor_coordinates(
        route_coordinates=coordinates,
        stored_sensors=sensor_list,
    )

    # Step 5b: Match route coordinates to road intersection sensors
    road_sensor_result = supabase.table("sensor_locations").select(
        "sensor_id,latitude,longitude,road_name"
    ).execute()
    road_sensor_list = road_sensor_result.data if road_sensor_result.data else []
    route_road_sensors = []
    if road_sensor_list and coordinates:
        update_task(status="running", progress=0.95, processed_nodes=int(total * 0.95), total_nodes=total)
        route_road_sensors = _find_nearest_sensors(coordinates, road_sensor_list)

    # Step 6: Save result (distance, duration, sensors)
    result_data = {
        "distance_km": round(distance_m / 1000, 2),
        "duration_min": round(duration_s / 60, 1),
        "processed_sensors": processed,
    }
    if route_road_sensors:
        result_data["road_sensors_count"] = len(route_road_sensors)
        result_data["road_sensors"] = [
            {"sensor_id": s["sensor_id"], "distance_km": s["distance_km"]}
            for s in route_road_sensors
        ]

    update_task(
        status="completed",
        progress=1.0,
        processed_nodes=total,
        result_json=result_data,
    )

    return {
        "task_id": str(task_id),
        "coordinates_count": len(coordinates),
        "processed_sensors": processed,
    }
