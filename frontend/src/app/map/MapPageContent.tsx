"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { getFullRoute, getTaskStatus, fetchSensorsNearRoute, stopSensors, fetchTrafficSignals } from "@/lib/api";
import { motion } from "framer-motion";
import { Map, Layers, Navigation, Loader2, CheckCircle2, AlertCircle, Radio, StopCircle, TrafficCone } from "lucide-react";

type Coord = { lat: number; lon: number };

type ViewMode = 'main' | 'nodes' | 'active' | 'stop' | 'traffic';

const POLL_INTERVAL = 1000;

type NearbySensor = {
  id: string;
  latitude: number;
  longitude: number;
  degree?: number;
  distance_km: number;
};

interface MapPageContentProps {
  taskId: string | null;
}

export default function MapPageContent({ taskId }: MapPageContentProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('main');
  const [coordinates, setCoordinates] = useState<Coord[]>([]);
  const [turnPoints, setTurnPoints] = useState<Coord[]>([]);
  const [loading, setLoading] = useState(true);
  const [taskStatus, setTaskStatus] = useState<"pending" | "running" | "completed" | "failed" | null>(null);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [durationMin, setDurationMin] = useState<number | null>(null);
  const [nearbySensors, setNearbySensors] = useState<NearbySensor[]>([]);
  type TrafficSignal = {
	  lat: number;
	  lon: number;
	  signal_id: string;
	  distance_km: number;
	  road_name: string;
	  junction: string;
  };
  const [trafficSignals, setTrafficSignals] = useState<TrafficSignal[]>([]);
  const [stopLoading, setStopLoading] = useState(false);
  const [stopError, setStopError] = useState<string | null>(null);
  const [stopSuccess, setStopSuccess] = useState(false);

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const leafletLoaded = useRef(false);

  const loadLeaflet = useCallback(async () => {
    if (leafletLoaded.current && window.L) return window.L;

    if (!document.querySelector('link[href*="leaflet"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    const LModule = await import("leaflet");
    const L = LModule.default || LModule;
    window.L = L;
    leafletLoaded.current = true;
    return L;
  }, []);

  // Poll task status until completed or failed
  useEffect(() => {
    if (!taskId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const pollStatus = async () => {
      try {
        const status = await getTaskStatus(taskId);
        if (cancelled) return;
        setTaskStatus(status.status);
        setTaskError(status.error || null);
        setDistanceKm(status.distance_km || null);
        setDurationMin(status.duration_min || null);

        if (status.status === "completed") {
          setLoading(true);
          try {
            const fullData = await getFullRoute(taskId);
            setCoordinates(fullData.coordinates.map(c => ({ lat: c.lat, lon: c.lon })));
            setTurnPoints(fullData.turn_points.map(t => ({ lat: t.lat, lon: t.lon })));

            try {
              const nearbyData = await fetchSensorsNearRoute(taskId, 0.002);
              setNearbySensors(nearbyData.sensors || []);
            } catch (err) {
              console.error("Failed to fetch nearby sensors:", err);
              setNearbySensors([]);
            }
            try {
              const trafficData = await fetchTrafficSignals(taskId);
              setTrafficSignals(trafficData.signals || []);
            } catch (err) {
              console.error("Failed to fetch traffic signals:", err);
              setTrafficSignals([]);
            }
          } catch (err) {
            console.error("Failed to fetch route coordinates:", err);
            setCoordinates([]);
            setTurnPoints([]);
            setNearbySensors([]);
          }
          setLoading(false);
          return;
        }

        if (status.status === "failed") {
          setLoading(false);
          return;
        }

        setTimeout(pollStatus, POLL_INTERVAL);
      } catch (err) {
        console.error("Failed to fetch task status:", err);
        if (!cancelled) {
          setTaskStatus("failed");
          setTaskError("Failed to fetch task status");
          setLoading(false);
        }
      }
    };

    pollStatus();

    return () => { cancelled = true; };
  }, [taskId]);

  // Initialize map when data is loaded
  useEffect(() => {
    if (loading || !mapRef.current || coordinates.length === 0 || !taskId) return;

    let cancelled = false;

    const initMap = async () => {
      try {
        const L = await loadLeaflet();
        if (cancelled || !L || !mapRef.current) return;

        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }

        mapRef.current!.innerHTML = '';

        const map = L.map(mapRef.current);
        mapInstanceRef.current = map;

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);

        const allLatLngs: [number, number][] = [];

        if (viewMode === 'main') {
          const latlngs: [number, number][] = coordinates.map((c: Coord) => [c.lat, c.lon]);
          L.polyline(latlngs, { color: '#2563eb', weight: 5, opacity: 0.8, lineCap: 'round', lineJoin: 'round' }).addTo(map);

          L.marker([coordinates[0].lat, coordinates[0].lon], {
            icon: L.divIcon({
              html: `<div style="background:#10b981;width:22px;height:22px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;color:white;font-size:11px;font-weight:bold;">S</div>`,
              iconSize: [22, 22],
              iconAnchor: [11, 11],
            })
          }).addTo(map).bindPopup(`<b>Start</b><br/>Lat: ${coordinates[0].lat.toFixed(6)}<br/>Lon: ${coordinates[0].lon.toFixed(6)}`);

          const last = coordinates[coordinates.length - 1];
          L.marker([last.lat, last.lon], {
            icon: L.divIcon({
              html: `<div style="background:#ef4444;width:22px;height:22px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;color:white;font-size:11px;font-weight:bold;">E</div>`,
              iconSize: [22, 22],
              iconAnchor: [11, 11],
            })
          }).addTo(map).bindPopup(`<b>Destination</b><br/>Lat: ${last.lat.toFixed(6)}<br/>Lon: ${last.lon.toFixed(6)}`);

          latlngs.forEach((ll: [number, number]) => allLatLngs.push(ll));
        } else if (viewMode === 'nodes') {
          if (coordinates.length > 0) {
            coordinates.forEach((c: Coord, i: number) => {
              L.circleMarker([c.lat, c.lon], {
                radius: 3,
                color: '#2563eb',
                fillColor: '#3b82f6',
                fillOpacity: 0.6,
                weight: 1,
              }).addTo(map);
              allLatLngs.push([c.lat, c.lon]);
            });
          }

          if (turnPoints.length > 0) {
            turnPoints.forEach((t: Coord, i: number) => {
              L.circleMarker([t.lat, t.lon], {
                radius: 8,
                color: '#ea580c',
                fillColor: '#f97316',
                fillOpacity: 0.9,
                weight: 2,
              }).addTo(map).bindPopup(
                `<div style="font-family:sans-serif;min-width:180px"><b style="color:#ea580c">Turn Point #${i + 1}</b><br/>Lat: ${t.lat.toFixed(6)}<br/>Lon: ${t.lon.toFixed(6)}</div>`
              );
              allLatLngs.push([t.lat, t.lon]);
            });
          }
        } else if (viewMode === 'active') {
          const latlngs: [number, number][] = coordinates.map((c: Coord) => [c.lat, c.lon]);
          L.polyline(latlngs, { color: '#93c5fd', weight: 3, opacity: 0.5, lineCap: 'round', lineJoin: 'round' }).addTo(map);
          latlngs.forEach((ll: [number, number]) => allLatLngs.push(ll));

          if (nearbySensors.length > 0) {
            nearbySensors.forEach((s: NearbySensor, i: number) => {
              L.circleMarker([s.latitude, s.longitude], {
                radius: 10,
                color: '#dc2626',
                fillColor: '#ef4444',
                fillOpacity: 0.8,
                weight: 3,
              }).addTo(map).bindPopup(
                `<div style="font-family:sans-serif;min-width:200px">
                  <b style="color:#dc2626">Active Sensor #${i + 1}</b><br/>
                  Lat: ${s.latitude.toFixed(6)}<br/>
                  Lon: ${s.longitude.toFixed(6)}<br/>
                  ${s.degree !== undefined ? `Degree: ${s.degree}°<br/>` : ''}
                  <span style="color:#dc2626;font-weight:bold;">Distance: ${(s.distance_km * 1000).toFixed(0)}m</span>
                </div>`
              );
              allLatLngs.push([s.latitude, s.longitude]);
            });
          }
        } else if (viewMode === 'traffic') {
          // Show route path as faded background
          const latlngs: [number, number][] = coordinates.map((c: Coord) => [c.lat, c.lon]);
          L.polyline(latlngs, { color: '#93c5fd', weight: 3, opacity: 0.4, lineCap: 'round', lineJoin: 'round' }).addTo(map);
          latlngs.forEach((ll: [number, number]) => allLatLngs.push(ll));

          if (trafficSignals.length > 0) {
            trafficSignals.forEach((s: TrafficSignal, i: number) => {
              // Traffic light icon - yellow/amber circle
              L.circleMarker([s.lat, s.lon], {
                radius: 10,
                color: '#ca8a04',
                fillColor: '#facc15',
                fillOpacity: 0.9,
                weight: 3,
              }).addTo(map).bindPopup(
                `<div style="font-family:sans-serif;min-width:220px">
                  <b style="color:#ca8a04">Traffic Signal #${i + 1}</b><br/>
                  Lat: ${s.lat.toFixed(6)}<br/>
                  Lon: ${s.lon.toFixed(6)}<br/>
                  ${s.road_name ? `Road: ${s.road_name}<br/>` : ''}
                  ${s.junction ? `Type: ${s.junction}<br/>` : ''}
                  <span style="color:#ca8a04;font-weight:bold;">Distance along route: ${(s.distance_km * 1000).toFixed(0)}m</span>
                </div>`
              );
              allLatLngs.push([s.lat, s.lon]);
            });
          }
        }

        if (allLatLngs.length > 0) {
          map.fitBounds(L.latLngBounds(allLatLngs), { padding: [50, 50] });
        } else {
          map.setView([19.0760, 72.8777], 13);
        }

        const legend = (window.L as any).control({ position: 'topright' });
        legend.onAdd = function () {
          const div = document.createElement('div');
          div.className = 'bg-white rounded-xl shadow-lg border border-gray-200 p-3 text-xs';

          if (viewMode === 'main') {
            div.innerHTML = `
              <div class="font-bold text-gray-700 mb-2 flex items-center gap-1">Legend</div>
              <div class="space-y-1.5">
                <div class="flex items-center gap-2"><div class="w-8 h-1.5 rounded-full" style="background:#2563eb"></div><span class="text-gray-600">Route Path</span></div>
                <div class="flex items-center gap-2"><div class="w-3 h-3 rounded-full" style="background:#10b981;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3)"></div><span class="text-gray-600">Start (S)</span></div>
                <div class="flex items-center gap-2"><div class="w-3 h-3 rounded-full" style="background:#ef4444;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3)"></div><span class="text-gray-600">End (E)</span></div>
              </div>
            `;
          } else if (viewMode === 'nodes') {
            div.innerHTML = `
              <div class="font-bold text-gray-700 mb-2 flex items-center gap-1">Legend</div>
              <div class="space-y-1.5">
                <div class="flex items-center gap-2"><div class="w-2 h-2 rounded-full" style="background:#3b82f6"></div><span class="text-gray-600">Route Nodes (${coordinates.length})</span></div>
                <div class="flex items-center gap-2"><div class="w-3 h-3 rounded-full" style="background:#f97316;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3)"></div><span class="text-gray-600">Turns (${turnPoints.length})</span></div>
              </div>
            `;
          } else if (viewMode === 'active') {
            div.innerHTML = `
              <div class="font-bold text-gray-700 mb-2 flex items-center gap-1">Legend</div>
              <div class="space-y-1.5">
                <div class="flex items-center gap-2"><div class="w-8 h-1.5 rounded-full" style="background:#93c5fd"></div><span class="text-gray-600">Route Path</span></div>
                <div class="flex items-center gap-2"><div class="w-3 h-3 rounded-full" style="background:#ef4444;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3)"></div><span class="text-gray-600">Active Sensors (${nearbySensors.length})</span></div>
                <div class="text-xs text-gray-500 mt-1">Sensors within 2m of route</div>
              </div>
            `;
          } else if (viewMode === 'traffic') {
            div.innerHTML = `
              <div class="font-bold text-gray-700 mb-2 flex items-center gap-1">Legend</div>
              <div class="space-y-1.5">
                <div class="flex items-center gap-2"><div class="w-8 h-1.5 rounded-full" style="background:#93c5fd"></div><span class="text-gray-600">Route Path</span></div>
                <div class="flex items-center gap-2"><div class="w-3 h-3 rounded-full" style="background:#facc15;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3)"></div><span class="text-gray-600">Traffic Signals (${trafficSignals.length})</span></div>
                <div class="text-xs text-gray-500 mt-1">Amber markers = traffic lights along route</div>
              </div>
            `;
          }
          return div;
        };
        legend.addTo(map);

      } catch (err) {
        console.error("Map init error:", err);
      }
    };

    initMap();

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [loading, coordinates, turnPoints, viewMode, loadLeaflet, taskId, nearbySensors, trafficSignals]);

  // Loading state - polling task status
  if (loading && taskStatus !== "failed")
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-6xl mx-auto p-6 py-12"
      >
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="h-96 flex items-center justify-center">
            <div className="text-center">
              {taskStatus === "pending" || taskStatus === "running" ? (
                <>
                  <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-gray-600 font-medium">Computing optimal route...</p>
                  <p className="text-sm text-gray-400 mt-2">
                    Task status: {taskStatus}
                  </p>
                </>
              ) : (
                <>
                  <Loader2 className="w-16 h-16 text-blue-600 animate-spin mx-auto mb-4" />
                  <p className="text-gray-600">Loading route map...</p>
                </>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    );

  // Task failed state
  if (taskStatus === "failed")
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto p-6 py-20 text-center"
      >
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-12">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Route Computation Failed</h2>
          <p className="text-red-500 mb-4">{taskError || "An unknown error occurred"}</p>
          <button
            onClick={() => window.location.href = '/route'}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </motion.div>
    );

  if (!taskId)
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto p-6 py-20 text-center"
      >
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-12">
          <Map className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">No Task ID</h2>
          <p className="text-gray-500">Compute a route first to view the map.</p>
        </div>
      </motion.div>
    );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-6xl mx-auto p-6 py-8"
    >
      {/* Header with Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Route Analysis</h1>
          <p className="text-gray-500 mt-1 text-sm">Task: {taskId?.slice(0, 8)}...</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 w-full">
          {distanceKm != null && (
            <div className="bg-green-50 border border-green-200 rounded-xl px-2 sm:px-3 py-2 text-center">
              <div className="text-base sm:text-xl font-bold text-green-700">{distanceKm} km</div>
              <div className="text-[10px] sm:text-xs text-green-600">Distance</div>
            </div>
          )}
          {durationMin != null && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl px-2 sm:px-3 py-2 text-center">
              <div className="text-base sm:text-xl font-bold text-purple-700">{durationMin} min</div>
              <div className="text-[10px] sm:text-xs text-purple-600">ETA</div>
            </div>
          )}
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-2 sm:px-3 py-2 text-center">
            <div className="text-base sm:text-xl font-bold text-blue-700">{coordinates.length}</div>
            <div className="text-[10px] sm:text-xs text-blue-600">Route Nodes</div>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-xl px-2 sm:px-3 py-2 text-center">
            <div className="text-base sm:text-xl font-bold text-orange-600">{turnPoints.length}</div>
            <div className="text-[10px] sm:text-xs text-orange-600">Turns</div>
          </div>
          {nearbySensors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-2 sm:px-3 py-2 text-center">
              <div className="text-base sm:text-xl font-bold text-red-700">{nearbySensors.length}</div>
              <div className="text-[10px] sm:text-xs text-red-600">Active Sensors</div>
            </div>
          )}
          {trafficSignals.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-2 sm:px-3 py-2 text-center">
              <div className="text-base sm:text-xl font-bold text-amber-700">{trafficSignals.length}</div>
              <div className="text-[10px] sm:text-xs text-amber-600">Traffic Signals</div>
            </div>
          )}
        </div>
      </div>

      {/* Horizontal View Toggle */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6"
      >
        <div className="flex gap-3 items-center flex-wrap">
          <button
            onClick={() => setViewMode('main')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-sm transition-all ${
              viewMode === 'main'
                ? "bg-blue-600 text-white shadow-lg shadow-blue-200"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            <Navigation className="w-4 h-4" />
            Main Route
            <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
              viewMode === 'main' ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-600"
            }`}>
              {coordinates.length} pts
            </span>
          </button>
          <button
            onClick={() => setViewMode('nodes')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-sm transition-all ${
              viewMode === 'nodes'
                ? "bg-orange-500 text-white shadow-lg shadow-orange-200"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            <Layers className="w-4 h-4" />
            All Nodes
            <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
              viewMode === 'nodes' ? "bg-orange-400 text-white" : "bg-gray-200 text-gray-600"
            }`}>
              {coordinates.length + turnPoints.length} nodes
            </span>
          </button>
          <button
            onClick={() => setViewMode('active')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-sm transition-all ${
              viewMode === 'active'
                ? "bg-red-500 text-white shadow-lg shadow-red-200"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            <Radio className="w-4 h-4" />
            Active Sensor
            <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
              viewMode === 'active' ? "bg-red-400 text-white" : "bg-gray-200 text-gray-600"
            }`}>
              {nearbySensors.length} found
            </span>
          </button>
          <button
            onClick={() => setViewMode('traffic')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-sm transition-all ${
              viewMode === 'traffic'
                ? "bg-amber-500 text-white shadow-lg shadow-amber-200"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            <TrafficCone className="w-4 h-4" />
            Traffic Signal
            <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
              viewMode === 'traffic' ? "bg-amber-400 text-white" : "bg-gray-200 text-gray-600"
            }`}>
              {trafficSignals.length} found
            </span>
          </button>
          <button
            onClick={async () => {
              setViewMode('stop');
              try {
                setStopLoading(true);
                setStopError(null);
                const res = await stopSensors();
                setStopSuccess(true);
                console.log("Stop command sent:", res);
              } catch (err) {
                setStopError("Failed to send stop command");
                console.error("Stop sensor error:", err);
              } finally {
                setStopLoading(false);
              }
            }}
            disabled={stopLoading}
            className={
              `flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-sm transition-all ${
                viewMode === 'stop'
                  ? "bg-gray-800 text-white shadow-lg shadow-gray-300"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              } ${stopLoading ? "opacity-50 cursor-not-allowed" : ""}`
            }
          >
            <StopCircle className="w-4 h-4" />
            Stop Sensor
            {stopLoading && <span className="ml-1 animate-spin">⟳</span>}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-3">
          {viewMode === 'main'
            ? "Shows the optimized route path with start and end points"
            : viewMode === 'nodes'
            ? "Shows all route coordinates as blue dots and turn points as orange circles"
            : viewMode === 'active'
            ? "Shows sensors within 2 meters of the route in red"
            : viewMode === 'traffic'
            ? "Shows traffic signals along the route in amber/yellow"
            : "Send stop command to set AMB82-Mini output pin LOW"
          }
        </p>
      </motion.div>

      {/* Map Container */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden"
      >
        <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex items-center gap-2 flex-wrap">
          {viewMode === 'main' ? (
            <>
              <Navigation className="w-5 h-5 text-blue-600 flex-shrink-0" />
              <h2 className="text-lg font-semibold text-gray-900 truncate">Main Route</h2>
              <span className="text-sm text-gray-500 ml-2 hidden sm:inline">- Optimized path with start and end points</span>
            </>
          ) : viewMode === 'nodes' ? (
            <>
              <Layers className="w-5 h-5 text-orange-600 flex-shrink-0" />
              <h2 className="text-lg font-semibold text-gray-900 truncate">All Nodes</h2>
              <span className="text-sm text-gray-500 ml-2 hidden sm:inline">- Every coordinate and turn point</span>
            </>
          ) : viewMode === 'active' ? (
            <>
              <Radio className="w-5 h-5 text-red-600 flex-shrink-0" />
              <h2 className="text-lg font-semibold text-gray-900 truncate">Active Sensors</h2>
              <span className="text-sm text-gray-500 ml-2 hidden sm:inline">- Sensors within 2m of route ({nearbySensors.length} found)</span>
            </>
          ) : viewMode === 'traffic' ? (
            <>
              <TrafficCone className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <h2 className="text-lg font-semibold text-gray-900 truncate">Traffic Signals</h2>
              <span className="text-sm text-gray-500 ml-2 hidden sm:inline">- Traffic signals along route ({trafficSignals.length} found)</span>
            </>
          ) : (
            <>
              <StopCircle className="w-5 h-5 text-gray-800 flex-shrink-0" />
              <h2 className="text-lg font-semibold text-gray-900 truncate">Stop Sensor</h2>
              <span className="text-sm text-gray-500 ml-2 hidden sm:inline">- Send stop command to AMB82-Mini</span>
            </>
          )}
        </div>
        <div ref={mapRef} className="h-[400px] sm:h-[550px] w-full relative z-0" />
        {/* Info bar */}
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex items-center gap-4 text-xs text-gray-600">
          <div className="flex items-center gap-1">
            {viewMode === 'active'
              ? `Showing ${nearbySensors.length} sensor(s) within 2 meters of the route`
              : viewMode === 'traffic'
              ? `Showing ${trafficSignals.length} traffic signal(s) along the route`
              : viewMode === 'stop'
              ? "Stop command status"
              : "Click on any node to see exact lat/lon coordinates"
            }
          </div>
        </div>
      </motion.div>

      {/* Stop Result Display */}
      {viewMode === 'stop' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-6 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
        >
          <div className="p-6 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">
              Stop Command Status
            </h3>
          </div>
          <div className="p-6">
            {stopSuccess && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-green-800">Stop command sent successfully!</p>
                  <p className="text-xs text-green-600">AMB82-Mini output pin has been set to LOW</p>
                </div>
              </div>
            )}
            {stopError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <div>
                  <p className="text-sm font-medium text-red-800">Failed to send stop command</p>
                  <p className="text-xs text-red-600">{stopError}</p>
                </div>
              </div>
            )}
            {!stopSuccess && !stopError && !stopLoading && (
              <div className="text-center py-4">
                <StopCircle className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Click "Stop Sensor" button above to send stop command</p>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Active Sensor List (shown below map when in active mode) */}
      {viewMode === 'active' && nearbySensors.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-6 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
        >
          <div className="p-6 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">
              Active Sensors Near Route
              <span className="ml-2 text-sm font-normal text-red-500">
                ({nearbySensors.length} sensors within 2m)
              </span>
            </h3>
          </div>
          <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
            {nearbySensors.map((s, i) => (
              <div
                key={s.id}
                className="p-4 hover:bg-red-50/50 transition-colors flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                  </div>
                  <div>
                    <div className="font-mono text-sm text-gray-800">
                      {s.latitude.toFixed(5)}, {s.longitude.toFixed(5)}
                    </div>
                    <div className="text-xs text-gray-500">
                      Distance: {(s.distance_km * 1000).toFixed(0)}m
                      {s.degree !== undefined && ` | Degree: ${s.degree}°`}
                    </div>
                  </div>
                </div>
                <span className="text-xs text-gray-400 font-mono">#{i + 1}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Traffic Signal List (shown below map when in traffic mode) */}
      {viewMode === 'traffic' && trafficSignals.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-6 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
        >
          <div className="p-6 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">
              Traffic Signals Along Route
              <span className="ml-2 text-sm font-normal text-amber-500">
                ({trafficSignals.length} signals found)
              </span>
            </h3>
          </div>
          <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
            {trafficSignals.map((s, i) => (
              <div
                key={s.signal_id}
                className="p-4 hover:bg-amber-50/50 transition-colors flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
                    <div className="w-3 h-3 rounded-full bg-amber-500" />
                  </div>
                  <div>
                    <div className="font-mono text-sm text-gray-800">
                      {s.lat.toFixed(5)}, {s.lon.toFixed(5)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {s.road_name && `Road: ${s.road_name} `}
                      {s.junction && `| Type: ${s.junction} `}
                      | Distance: {(s.distance_km * 1000).toFixed(0)}m
                    </div>
                  </div>
                </div>
                <span className="text-xs text-gray-400 font-mono">#{i + 1}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

    </motion.div>
  );
}
