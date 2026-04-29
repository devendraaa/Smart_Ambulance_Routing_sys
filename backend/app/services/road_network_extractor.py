"""
Professional road network node extraction for Mumbai area.
Extracts all road intersections and stores them efficiently for mapping and routing.
"""

import asyncio
import hashlib
import logging
from typing import List, Dict, Set, Optional, Tuple
import httpx
from app.database import supabase

logger = logging.getLogger(__name__)

# Mumbai bounding box with buffer
MUMBAI_BOUNDS = {
    "south": 18.8500,  # Extended south
    "north": 19.3200,  # Extended north
    "west": 72.7500,   # Extended west
    "east": 73.0200,   # Extended east
}

# Valid highway types for road network
VALID_HIGHWAYS = {
    "motorway", "trunk", "primary", "secondary", "tertiary",
    "motorway_link", "trunk_link", "primary_link",
    "secondary_link", "tertiary_link", "residential", "unclassified",
    "living_street", "service", "track"
}

class RoadNetworkExtractor:
    """Professional road network extraction and storage service."""

    def __init__(self, batch_size: int = 500, max_concurrent_tiles: int = 3):
        self.batch_size = batch_size
        self.max_concurrent_tiles = max_concurrent_tiles
        self.seen_nodes: Set[str] = set()
        self.processed_count = 0
        self.skipped_tiles = 0

    def _generate_node_key(self, lat: float, lon: float, precision: int = 6) -> str:
        """Generate unique key for deduplication."""
        return f"{lat:.{precision}f},{lon:.{precision}f}"

    async def extract_mumbai_road_network(self) -> Dict[str, int]:
        """
        Extract all road network nodes from Mumbai using grid tiling approach.

        Returns:
            Dict with statistics about extraction process
        """
        logger.info("Starting Mumbai road network extraction...")

        # Calculate grid tiles
        tile_size = 0.1  # ~11km tiles for good balance
        tiles = self._calculate_tiles(MUMBAI_BOUNDS, tile_size)

        logger.info(f"Processing {len(tiles)} tiles of size {tile_size}°")

        # Process tiles with controlled concurrency
        semaphore = asyncio.Semaphore(self.max_concurrent_tiles)

        async def process_tile_with_semaphore(tile_bounds):
            async with semaphore:
                return await self._process_tile(tile_bounds)

        # Execute all tile processing
        tasks = [process_tile_with_semaphore(tile) for tile in tiles]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Process results
        all_nodes = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error(f"Tile {i} failed: {result}")
                self.skipped_tiles += 1
                continue
            all_nodes.extend(result)

        # Bulk insert all nodes
        if all_nodes:
            await self._bulk_insert_nodes(all_nodes)

        stats = {
            "total_nodes_extracted": len(all_nodes),
            "unique_nodes_stored": self.processed_count,
            "tiles_processed": len(tiles) - self.skipped_tiles,
            "tiles_skipped": self.skipped_tiles,
            "duplicates_filtered": len(all_nodes) - self.processed_count
        }

        logger.info(f"Road network extraction completed: {stats}")
        return stats

    def _calculate_tiles(self, bounds: Dict[str, float], tile_size: float) -> List[Dict[str, float]]:
        """Calculate grid tiles covering the bounding box."""
        tiles = []
        lat_start = bounds["south"]

        while lat_start < bounds["north"]:
            lat_end = min(lat_start + tile_size, bounds["north"])
            lon_start = bounds["west"]

            while lon_start < bounds["east"]:
                lon_end = min(lon_start + tile_size, bounds["east"])

                tiles.append({
                    "south": lat_start,
                    "north": lat_end,
                    "west": lon_start,
                    "east": lon_end
                })

                lon_start += tile_size
            lat_start += tile_size

        return tiles

    async def _process_tile(self, tile_bounds: Dict[str, float]) -> List[Dict]:
        """Process a single tile to extract highway nodes."""
        query = self._build_overpass_query(tile_bounds)

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(
                    "https://overpass-api.de/api/interpreter",
                    data={"data": query},
                    headers={"User-Agent": "Smart Ambulance Route/1.0 (+https://smart-ambulance.onrender.com)"}
                )
                response.raise_for_status()

                return self._parse_overpass_response(response.text, tile_bounds)

        except Exception as e:
            logger.warning(f"Failed to process tile {tile_bounds}: {e}")
            # Retry once with exponential backoff
            await asyncio.sleep(2)
            try:
                async with httpx.AsyncClient(timeout=120.0) as client:
                    response = await client.post(
                        "https://overpass-api.de/api/interpreter",
                        data={"data": query},
                        headers={"User-Agent": "Smart Ambulance Route/1.0 (+https://smart-ambulance.onrender.com)"}
                    )
                    response.raise_for_status()
                    return self._parse_overpass_response(response.text, tile_bounds)
            except Exception as retry_e:
                logger.error(f"Tile {tile_bounds} failed after retry: {retry_e}")
                return []

    def _build_overpass_query(self, bounds: Dict[str, float]) -> str:
        """Build Overpass QL query for highway nodes in bounds."""
        return f"""
        [out:csv(::id,::lat,::lon,"name","highway","::count")][timeout:90];
        (
          node["highway"]({bounds["south"]},{bounds["west"]},{bounds["north"]},{bounds["east"]});
          way["highway"]({bounds["south"]},{bounds["west"]},{bounds["north"]},{bounds["east"]});
          >;
        );
        out skel qt;
        """

    def _parse_overpass_response(self, text: str, tile_bounds: Dict[str, float]) -> List[Dict]:
        """Parse Overpass CSV response and extract valid highway nodes."""
        nodes = []
        lines = text.strip().splitlines()

        if len(lines) < 2:  # Only header or empty
            return nodes

        # Skip header line
        for line in lines[1:]:
            parts = line.strip().split("\t")
            if len(parts) < 5:  # Need at least id,lat,lon,name,highway
                continue

            try:
                # Parse basic fields
                node_id = parts[0]
                lat = float(parts[1])
                lon = float(parts[2])
                name = parts[3].strip('"') if len(parts) > 3 else ""
                highway = parts[4].strip('"') if len(parts) > 4 else ""

                # Validate coordinates are within tile bounds (with small buffer)
                if not (tile_bounds["south"] - 0.001 <= lat <= tile_bounds["north"] + 0.001 and
                        tile_bounds["west"] - 0.001 <= lon <= tile_bounds["east"] + 0.001):
                    continue

                # Validate highway type
                if highway not in VALID_HIGHWAYS:
                    continue

                # Check for duplicates
                node_key = self._generate_node_key(lat, lon)
                if node_key in self.seen_nodes:
                    continue

                self.seen_nodes.add(node_key)

                # Determine intersection type based on connectivity
                intersection_type = self._determine_intersection_type(highway, name)

                nodes.append({
                    "sensor_id": self._generate_uuid_from_id(node_id),
                    "latitude": lat,
                    "longitude": lon,
                    "road_name": name if name else highway,
                    "intersection_type": intersection_type,
                    "source": "osm_overpass",
                    "highway_type": highway
                })

            except (ValueError, IndexError) as e:
                logger.debug(f"Skipping invalid node data: {e}")
                continue

        return nodes

    def _determine_intersection_type(self, highway: str, name: str) -> str:
        """Determine intersection type based on highway classification."""
        if highway in ["motorway", "trunk", "primary"]:
            return "major_intersection"
        elif highway in ["secondary", "tertiary"]:
            return "minor_intersection"
        elif highway in ["residential", "unclassified", "living_street"]:
            return "local_intersection"
        else:
            return "road_node"

    def _generate_uuid_from_id(self, node_id: str) -> str:
        """Generate consistent UUID from OSM node ID."""
        # Use MD5 hash of the node ID to generate deterministic UUID
        hash_object = hashlib.md5(node_id.encode())
        hex_digest = hash_object.hexdigest()
        # Format as UUID: 8-4-4-4-12
        return f"{hex_digest[0:8]}-{hex_digest[8:12]}-{hex_digest[12:16]}-{hex_digest[16:20]}-{hex_digest[20:32]}"

    async def _bulk_insert_nodes(self, nodes: List[Dict]):
        """Insert nodes into database in batches."""
        for i in range(0, len(nodes), self.batch_size):
            batch = nodes[i:i + self.batch_size]

            # Prepare data for insertion (only required fields)
            insert_data = []
            for node in batch:
                insert_data.append({
                    "sensor_id": node["sensor_id"],
                    "latitude": node["latitude"],
                    "longitude": node["longitude"],
                    "road_name": node["road_name"],
                    "intersection_type": node["intersection_type"],
                    "source": node["source"]
                })

            try:
                supabase.table("sensor_locations").insert(insert_data).execute()
                self.processed_count += len(insert_data)
                logger.debug(f"Inserted batch {i//self.batch_size + 1}: {len(insert_data)} nodes")
            except Exception as e:
                logger.error(f"Failed to insert batch {i//self.batch_size + 1}: {e}")
                # Try inserting individually to skip problematic records
                for j, node in enumerate(batch):
                    try:
                        supabase.table("sensor_locations").insert({
                            "sensor_id": node["sensor_id"],
                            "latitude": node["latitude"],
                            "longitude": node["longitude"],
                            "road_name": node["road_name"],
                            "intersection_type": node["intersection_type"],
                            "source": node["source"]
                        }).execute()
                        self.processed_count += 1
                    except Exception as single_e:
                        logger.error(f"Failed to insert single node {node.get('sensor_id')}: {single_e}")

# Convenience function for external use
async def extract_and_store_mumbai_roads() -> Dict[str, int]:
    """
    Extract Mumbai road network and store in database.

    Returns:
        Dictionary with extraction statistics
    """
    extractor = RoadNetworkExtractor()
    return await extractor.extract_mumbai_road_network()