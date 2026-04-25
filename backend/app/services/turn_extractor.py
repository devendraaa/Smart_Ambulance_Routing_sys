import math


def extract_turning_points(
    coordinates: list[tuple[float, float]],
    angle_threshold_deg: float = 25.0,
) -> list[tuple[float, float]]:
    """
    Detect turning points in a route by computing heading angle changes
    between consecutive segments. Always includes first, last, and
    points where the heading changes by more than the threshold.
    """
    if len(coordinates) < 3:
        return coordinates[:]

    turning_points: list[tuple[float, float]] = [coordinates[0]]

    for i in range(1, len(coordinates) - 1):
        prev = coordinates[i - 1]
        curr = coordinates[i]
        nxt = coordinates[i + 1]

        angle = _angle_change(prev, curr, nxt)
        if angle > angle_threshold_deg:
            turning_points.append(coordinates[i])

    turning_points.append(coordinates[-1])
    return turning_points


def _angle_change(
    a: tuple[float, float],
    b: tuple[float, float],
    c: tuple[float, float],
) -> float:
    """Heading change (degrees) between segments A->B and B->C."""
    bearing1 = _bearing(a, b)
    bearing2 = _bearing(b, c)
    diff = abs(bearing2 - bearing1) % 360
    return min(diff, 360 - diff)


def _bearing(p1: tuple[float, float], p2: tuple[float, float]) -> float:
    """Initial bearing from p1 to p2 in degrees."""
    lat1, lon1 = math.radians(p1[0]), math.radians(p1[1])
    lat2, lon2 = math.radians(p2[0]), math.radians(p2[1])
    dlon = lon2 - lon1
    x = math.sin(dlon) * math.cos(lat2)
    y = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
    return (math.degrees(math.atan2(x, y)) + 360) % 360
