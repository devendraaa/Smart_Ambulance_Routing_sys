"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

// Dynamically import Leaflet components to avoid SSR issues
const MapContainer = dynamic(
  () => import("react-leaflet").then((m) => m.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((m) => m.TileLayer),
  { ssr: false }
);
const CircleMarker = dynamic(
  () => import("react-leaflet").then((m) => m.CircleMarker),
  { ssr: false }
);
const Tooltip = dynamic(
  () => import("react-leaflet").then((m) => m.Tooltip),
  { ssr: false }
);

type RoadNode = {
  lat: number;
  lon: number;
  road_name: string;
  intersection_type: string;
};

export default function RoadNetworkPage() {
  const [nodes, setNodes] = useState<RoadNode[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [bounds, setBounds] = useState<{
    south: number;
    north: number;
    west: number;
    east: number;
  } | null>(null);

  // Mumbai approximate bounds
  const MUMBAI_BOUNDS = {
    south: 18.8500,
    north: 19.3200,
    west: 72.7500,
    east: 73.0200,
  };

  useEffect(() => {
    // Load Leaflet CSS
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);

    return () => {
      document.head.removeChild(link);
    };
  }, []);

  useEffect(() => {
    loadRoadNetwork();
  }, []);

  const loadRoadNetwork = async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch road network data for Mumbai bounds
      const response = await fetch(
        `/api/sensors/network?south=${MUMBAI_BOUNDS.south}&north=${MUMBAI_BOUNDS.north}&west=${MUMBAI_BOUNDS.west}&east=${MUMBAI_BOUNDS.east}&limit=100000`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.type === "FeatureCollection" && Array.isArray(data.features)) {
        const roadNodes: RoadNode[] = data.features.map((feature: any) => ({
          lat: feature.geometry.coordinates[1],
          lon: feature.geometry.coordinates[0],
          road_name: feature.properties.road_name || "Unknown Road",
          intersection_type: feature.properties.intersection_type || "road_node",
        }));

        setNodes(roadNodes);
        setBounds(MUMBAI_BOUNDS);
      } else {
        throw new Error("Invalid response format");
      }
    } catch (err) {
      console.error("Failed to load road network:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load road network data"
      );
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading Mumbai road network...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center text-red-600">
          <p>Error loading road network:</p>
          <p className="mt-2 font-medium">{error}</p>
          <button
            onClick={loadRoadNetwork}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600">
            No road network data available. You may need to extract the road network first.
          </p>
          <button
            onClick={() => {
              // Trigger extraction via API (would need backend implementation)
              alert(
                "To extract the road network, please run:\n" +
                "POST /api/sensors/extract-full-network\n" +
                "This process may take several hours to complete."
              );
            }}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Learn How to Extract Network
          </button>
        </div>
      </div>
    );
  }

  // Calculate center point from bounds or nodes
  const center: [number, number] = bounds
    ? [(bounds.south + bounds.north) / 2, (bounds.west + bounds.east) / 2]
    : [19.0458, 72.8484]; // Default Mumbai center

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-blue-600 text-white py-4">
        <div className="container mx-auto px-4">
          <h1 className="text-2xl font-bold">Mumbai Road Network</h1>
          <p className="text-sm">
            Displaying {nodes.toLocaleString()} road intersection nodes from OpenStreetMap
          </p>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <div className="space-y-4">
          <div className="flex justify-between items-center flex-wrap">
            <div>
              <span className="font-medium">Road Network Statistics:</span>
              <span className="ml-2 text-blue-600">
                {nodes.toLocaleString()} nodes
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  // In a real app, this would filter or style differently
                  alert("Filtering options would be implemented here");
                }}
                className="px-3 py-1 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 text-sm"
              >
                Filters
              </button>
              <button
                onClick={() => {
                  // Trigger refresh
                  loadRoadNetwork();
                }}
                className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
              >
                Refresh
              </button>
            </div>
          </div>

          {/* Map Container */}
          <div className="h-[70vh] rounded-lg shadow-lg overflow-hidden">
            <MapContainer
              center={center}
              zoom={12}
              className="h-full w-full"
              scrollWheelZoom={true}
            >
              {/* Tile Layer */}
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* Road Network Nodes */}
              {nodes.map((node, index) => (
                <CircleMarker
                  key={`road-node-${index}-${node.lat}-${node.lon}`}
                  center={[node.lat, node.lon]}
                  radius={2}
                  color={getNodeColor(node.intersection_type)}
                  fillColor={getNodeColor(node.intersection_type)}
                  fillOpacity={0.7}
                >
                  <Tooltip
                    direction="top"
                    offset={[0, -8]}
                    opacity={0.9}
                    permanent={false}
                  >
                    <div className="text-xs">
                      <strong>{node.road_name}</strong><br />
                      Type: {node.intersection_type}<br />
                      Lat: {node.lat.toFixed(6)}, Lon: {node.lon.toFixed(6)}
                    </div>
                  </Tooltip>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>

          {/* Legend */}
          <div className="mt-6 bg-white p-4 rounded-lg shadow">
            <h3 className="font-semibold mb-2">Legend</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-red-500"></span>
                <span>Major Intersection (Motorway/Trunk/Primary)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-orange-500"></span>
                <span>Minor Intersection (Secondary/Tertiary)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-green-500"></span>
                <span>Local Intersection (Residential/Unclassified)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-gray-500"></span>
                <span>Other Road Nodes</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="bg-gray-100 text-center py-4 text-sm text-gray-600">
        <p>
          Data Source: OpenStreetMap via Overpass API • Last updated:{" "}
          {new Date().toLocaleDateString()}
        </p>
        <p className="mt-1">
          Note: For performance, only a subset of nodes may be displayed. Full dataset{" "}
          available in database for routing algorithms.
        </p>
      </footer>
    </div>
  );
}

// Helper function to get color based on intersection type
function getNodeColor(intersectionType: string): string {
  const colorMap: Record<string, string> = {
    major_intersection: "#ef4444", // red-500
    minor_intersection: "#f97316", // orange-500
    local_intersection: "#10b981", // emerald-500
    road_node: "#6b7280", // gray-500
  };

  return colorMap[intersectionType] || "#6b7280";
}