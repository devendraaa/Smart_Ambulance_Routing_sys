"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import { Map, Layers, AlertCircle, RefreshCw } from "lucide-react";

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
    if (!document.querySelector('link[href*="leaflet"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    loadRoadNetwork();
  }, []);

  const loadRoadNetwork = async () => {
    setLoading(true);
    setError(null);

    try {
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

  const center: [number, number] = bounds
    ? [(bounds.south + bounds.north) / 2, (bounds.west + bounds.east) / 2]
    : [19.0458, 72.8484];

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50"
      >
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full mx-auto mb-4"
          />
          <p className="text-gray-600">Loading Mumbai road network...</p>
        </div>
      </motion.div>
    );
  }

  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50"
      >
        <div className="text-center text-red-600 max-w-md mx-auto p-6">
          <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-400" />
          <p className="text-xl font-semibold mb-2">Error Loading Road Network</p>
          <p className="text-gray-600 mb-6">{error}</p>
          <motion.button
            onClick={loadRoadNetwork}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-6 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-2 mx-auto"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </motion.button>
        </div>
      </motion.div>
    );
  }

  if (nodes.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50"
      >
        <div className="text-center max-w-md mx-auto p-6">
          <Layers className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p className="text-xl font-semibold text-gray-800 mb-2">No Road Network Data</p>
          <p className="text-gray-500 mb-6">
            No road network data available. You may need to extract the road network first.
          </p>
          <motion.button
            onClick={() => {
              alert(
                "To extract the road network, please run:\n" +
                "POST /api/sensors/extract-full-network\n" +
                "This process may take several hours to complete."
              );
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-6 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors"
          >
            Learn How to Extract Network
          </motion.button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Hero Header */}
      <motion.section
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-hero text-white"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
                className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-4"
              >
                <Map className="w-8 h-8" />
              </motion.div>
              <h1 className="text-3xl sm:text-4xl font-bold mb-2">
                Mumbai Road Network
              </h1>
              <p className="text-blue-100">
                Displaying {nodes.toLocaleString()} road intersection nodes from OpenStreetMap
              </p>
            </div>
            <motion.button
              onClick={loadRoadNetwork}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-6 py-3 bg-white/20 backdrop-blur-sm text-white font-medium rounded-xl hover:bg-white/30 transition-colors flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </motion.button>
          </div>
        </div>
      </motion.section>

      {/* Stats Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 -mt-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          {[
            { label: "Total Nodes", value: nodes.toLocaleString(), icon: Layers },
            { label: "Mumbai Coverage", value: "100%", icon: Map },
            { label: "Major Intersections", value: nodes.filter(n => n.intersection_type === "major_intersection").length.toLocaleString(), icon: AlertCircle },
            { label: "Data Source", value: "OSM", icon: "🌐" },
          ].map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              className="bg-white rounded-2xl p-4 sm:p-6 text-center shadow-sm hover:shadow-md transition-shadow border border-gray-100"
            >
              <div className="text-3xl mb-2">
                {typeof stat.icon === "string" ? stat.icon : <stat.icon className="w-8 h-8 text-blue-600 mx-auto" />}
              </div>
              <div className="text-xl sm:text-2xl font-bold text-blue-700">{stat.value}</div>
              <div className="text-xs sm:text-sm text-gray-500 mt-1">{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Map Container */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="bg-white rounded-3xl shadow-xl overflow-hidden"
        >
          <div className="h-[70vh]">
            <MapContainer
              center={center}
              zoom={12}
              className="h-full w-full"
              scrollWheelZoom={true}
            >
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
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="p-6 bg-gray-50 border-t border-gray-100"
          >
            <h3 className="font-semibold mb-4">Legend</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {[
                { color: "bg-red-500", label: "Major Intersection (Motorway/Trunk/Primary)" },
                { color: "bg-orange-500", label: "Minor Intersection (Secondary/Tertiary)" },
                { color: "bg-emerald-500", label: "Local Intersection (Residential/Unclassified)" },
                { color: "bg-gray-500", label: "Other Road Nodes" },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.7 + i * 0.1 }}
                  className="flex items-center gap-2"
                >
                  <span className={`w-3 h-3 rounded ${item.color}`} />
                  <span className="text-gray-600">{item.label}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🚑</span>
              <div>
                <p className="font-semibold text-sm text-gray-800">
                  Smart Ambulance Route
                </p>
                <p className="text-xs text-gray-500">
                  Emergency Response System
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-400">
              <span>Data Source: OpenStreetMap via Overpass API</span>
              <span>•</span>
              <span>Last updated: {new Date().toLocaleDateString()}</span>
            </div>
          </div>
        </div>
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
