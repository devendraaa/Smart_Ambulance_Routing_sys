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
    Find sensors near the route and sort them by their position along the route.
    Returns list of sensors in sequence from route start to end.
    """
    print(f"[DEBUG] _find_nearest_sensors: {len(coordinates)} coords, {len(sensor_locations)} sensors, max_dist={max_distance_km}km")

    # For each sensor, find the closest route coordinate and its index
    sensor_with_position = []

    for s in sensor_locations:
        min_dist = float("inf")
        closest_coord_idx = -1
        s_lat = s["latitude"]
        s_lon = s["longitude"]

        # Find closest point on route to this sensor
        for idx, (lat, lon) in enumerate(coordinates):
            d = _haversine(lat, lon, s_lat, s_lon)
            if d < min_dist:
                min_dist = d
                closest_coord_idx = idx
                if d < 0.001:  # Within 1 meter, close enough
                    break

        # Only include sensors within max_distance_km of the route
        if min_dist <= max_distance_km:
            sensor_with_position.append({
                **s,
                "distance_km": round(min_dist, 3),
                "route_position_idx": closest_coord_idx,  # Position along route
            })

    # Sort sensors by their position along the route (from start to end)
    sensor_with_position.sort(key=lambda x: x["route_position_idx"])

    # Remove duplicates (same sensor_id) keeping the first occurrence (closest to start)
    seen_ids = set()
    route_sensors = []
    for s in sensor_with_position:
        sid = s.get("sensor_id")
        if sid not in seen_ids:
            seen_ids.add(sid)
            # Remove internal tracking field before returning
            result = {k: v for k, v in s.items() if k != "route_position_idx"}
            route_sensors.append(result)

    print(f"[DEBUG] _find_nearest_sensors: found {len(route_sensors)} unique sensors in route sequence")
    if route_sensors:
        print(f"[DEBUG] First sensor: {route_sensors[0].get('sensor_id')} at position {sensor_with_position[0]['route_position_idx'] if sensor_with_position else 'N/A'}")
        print(f"[DEBUG] Last sensor: {route_sensors[-1].get('sensor_id')} at position {sensor_with_position[-1]['route_position_idx'] if sensor_with_position else 'N/A'}")

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
    print(f"[DEBUG] sensor_locations query returned {len(road_sensor_list)} rows")
    if road_sensor_list:
        print(f"[DEBUG] Sample sensor: {road_sensor_list[0]}")
    if road_sensor_list and coordinates:
        update_task(status="running", progress=0.95, processed_nodes=int(total * 0.95), total_nodes=total)
        route_road_sensors = _find_nearest_sensors(coordinates, road_sensor_list)
        print(f"[DEBUG] _find_nearest_sensors returned {len(route_road_sensors)} sensors")
        if route_road_sensors:
            print(f"[DEBUG] Sample result: {route_road_sensors[0]}")

    # Step 6: Save result (distance, duration, sensors)
    result_data = {
        "distance_km": round(distance_m / 1000, 2),
        "duration_min": round(duration_s / 60, 1),
        "processed_sensors": processed,
    }
    if route_road_sensors:
        result_data["road_sensors_count"] = len(route_road_sensors)
        result_data["road_sensors"] = [
            {
                "sensor_id": s["sensor_id"],
                "latitude": s["latitude"],
                "longitude": s["longitude"],
                "road_name": s.get("road_name", ""),
                "distance_km": s["distance_km"],
            }
            for s in route_road_sensors
        ]

    update_task(
        status="completed",
        progress=1.0,
        processed_nodes=total,
        result_json=result_data,
    )

    # Publish active route sensors to MQTT for IoT devices
    if route_road_sensors:
        from app.services.mqtt_client import mqtt_client

        print(f"[MQTT] Publishing {len(route_road_sensors)} sensors to ambulance/sensors/active")
        for s in route_road_sensors:
            print(f"[MQTT]   sensor {s['sensor_id']} @ ({s['latitude']}, {s['longitude']}) dist={s['distance_km']}km")
        try:
            mqtt_client.publish_sensor_data(route_road_sensors)
            print("[MQTT] Publish succeeded")
        except Exception as e:
            print(f"[MQTT] Publish FAILED: {e}")
    else:
        print("[MQTT] No route sensors to publish — check sensor_locations table and route path")

    return {
        "task_id": str(task_id),
        "coordinates_count": len(coordinates),
        "processed_sensors": processed,
    }
