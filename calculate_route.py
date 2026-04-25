import httpx
import math

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# Mumbai Bounding Box
south = 18.85
west = 72.75
north = 19.35
east = 72.98


def haversine(lat1, lon1, lat2, lon2):
    """Calculate distance between two lat/lon points (KM)"""
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)

    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )

    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


async def fetch_mumbai_main_roads():

    print("Fetching Mumbai main roads...")

    query = f"""
    [out:json][timeout:25];
    (
      way["highway"~"motorway|trunk|primary|secondary"]
      ({south},{west},{north},{east});
    );
    (._;>;);
    out body;
    """

    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(OVERPASS_URL, data=query)
        data = response.json()

    nodes = {}
    ways = []

    for element in data["elements"]:
        if element["type"] == "node":
            nodes[element["id"]] = (element["lat"], element["lon"])
        elif element["type"] == "way":
            ways.append(element["nodes"])

    total_km = 0

    print("Calculating total road length...")

    for way in ways:
        for i in range(len(way) - 1):
            if way[i] in nodes and way[i + 1] in nodes:
                lat1, lon1 = nodes[way[i]]
                lat2, lon2 = nodes[way[i + 1]]

                total_km += haversine(lat1, lon1, lat2, lon2)

    print("Total Main Road KM in Mumbai:", round(total_km, 2))


if __name__ == "__main__":
    import asyncio

    asyncio.run(fetch_mumbai_main_roads())