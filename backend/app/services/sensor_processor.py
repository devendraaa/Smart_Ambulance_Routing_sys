from math import radians, sin, cos, sqrt, atan2


def _haversine_m(lat1, lon1, lat2, lon2) -> float:
    R = 6371000
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return R * 2 * atan2(sqrt(a), sqrt(1 - a))


def process_sensor_coordinates(
    route_coordinates: list[tuple[float, float]],
    stored_sensors: list[tuple[float, float]],
    proximity_threshold_meters: float = 6.0,
    chunk_step: int = 3,
) -> dict:
    """
    Consolidates new_lat_lon() + col_name() + lat_lon() + rout_list()
    from the original Django views.py.
    """
    # Find nearby sensors
    nearby_sensors = []
    for rc_lat, rc_lon in route_coordinates:
        for s_lat, s_lon in stored_sensors:
            d = _haversine_m(rc_lat, rc_lon, s_lat, s_lon)
            if d < proximity_threshold_meters:
                nearby_sensors.append((s_lat, s_lon))

    # Remove duplicates while preserving order
    seen = set()
    unique_sensors = []
    for s in nearby_sensors:
        if s not in seen:
            seen.add(s)
            unique_sensors.append(s)

    # Sample route (every 3rd, offset by 1 — matches original rout_list)
    route_list = [
        route_coordinates[i]
        for i in range(0, len(route_coordinates), chunk_step)
        if i % 3 == 1
    ][:]

    # Truncate to 5 decimal places
    truncated = [(round(lat, 5), round(lon, 5)) for lat, lon in unique_sensors]

    return {
        "route_coordinates": route_coordinates,
        "nearby_sensors": truncated,
        "route_list_sampled": route_list,
    }
