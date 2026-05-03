"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useRouteTask } from "@/hooks/useRouteTask";
import TaskProgress from "@/components/TaskProgress";
import RoutePlanner from "@/components/RoutePlanner";
import { motion } from "framer-motion";
import { ArrowLeft, Map, Layers, Navigation, Waypoints } from "lucide-react";
import Link from "next/link";
import { getFullRoute } from "@/lib/api";
import { useEffect, useRef, useState, useCallback } from "react";

type ViewMode = 'main' | 'nodes';

function RoutePageContent() {
  const searchParams = useSearchParams();
  const taskId = searchParams.get("task");
  const router = useRouter();
  const status = useRouteTask(taskId);

  const [coordinates, setCoordinates] = useState<{ lat: number; lon: number }[]>([]);
  const [turnPoints, setTurnPoints] = useState<{ lat: number; lon: number }[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('main');
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

  // Fetch route coordinates when task is completed
  useEffect(() => {
    if (!taskId || !status || status.status !== "completed") return;

    const fetchCoords = async () => {
      try {
        const fullData = await getFullRoute(taskId);
        setCoordinates(fullData.coordinates.map(c => ({ lat: c.lat, lon: c.lon })));
        setTurnPoints(fullData.turn_points.map(t => ({ lat: t.lat, lon: t.lon })));
      } catch (err) {
        console.error("Failed to fetch route coordinates:", err);
      }
    };
    fetchCoords();
  }, [taskId, status]);

  // Initialize map when coordinates are available
  useEffect(() => {
    if (!taskId || status?.status !== "completed" || coordinates.length === 0 || !mapRef.current) return;

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
          // MAIN ROUTE: Blue line with start/end markers
          const latlngs: [number, number][] = coordinates.map((c: { lat: number; lon: number }) => [c.lat, c.lon]);
          L.polyline(latlngs, { color: '#2563eb', weight: 5, opacity: 0.8, lineCap: 'round', lineJoin: 'round' }).addTo(map);

          // Start marker (green)
          L.marker([coordinates[0].lat, coordinates[0].lon], {
            icon: L.divIcon({
              html: `<div style="background:#10b981;width:22px;height:22px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;color:white;font-size:11px;font-weight:bold;">S</div>`,
              iconSize: [22, 22],
              iconAnchor: [11, 11],
            })
          }).addTo(map).bindPopup(`<b>Start</b><br/>Lat: ${coordinates[0].lat.toFixed(6)}<br/>Lon: ${coordinates[0].lon.toFixed(6)}`);

          // End marker (red)
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
          // ALL NODES: Show every coordinate as blue dots + turn points as orange
          if (coordinates.length > 0) {
            coordinates.forEach((c: { lat: number; lon: number }, i: number) => {
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

          // Turn points (orange, larger)
          if (turnPoints.length > 0) {
            turnPoints.forEach((t: { lat: number; lon: number }, i: number) => {
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
        }

        // Fit map to show all elements
        if (allLatLngs.length > 0) {
          map.fitBounds(L.latLngBounds(allLatLngs), { padding: [50, 50] });
        } else {
          map.setView([19.0760, 72.8777], 13);
        }

        // Add legend overlay
        const legend = (window.L as any).control({ position: 'topright' });
        legend.onAdd = function () {
          const div = document.createElement('div');
          div.className = 'bg-white rounded-xl shadow-lg border border-gray-200 p-3 text-xs';
          if (viewMode === 'main') {
            div.innerHTML = `
              <div class="font-bold text-gray-700 mb-2 flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                Legend
              </div>
              <div class="space-y-1.5">
                <div class="flex items-center gap-2"><div class="w-8 h-1.5 rounded-full" style="background:#2563eb"></div><span class="text-gray-600">Route Path</span></div>
                <div class="flex items-center gap-2"><div class="w-3 h-3 rounded-full" style="background:#10b981;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3)"></div><span class="text-gray-600">Start (S)</span></div>
                <div class="flex items-center gap-2"><div class="w-3 h-3 rounded-full" style="background:#ef4444;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3)"></div><span class="text-gray-600">End (E)</span></div>
              </div>
            `;
          } else {
            div.innerHTML = `
              <div class="font-bold text-gray-700 mb-2 flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
                Legend
              </div>
              <div class="space-y-1.5">
                <div class="flex items-center gap-2"><div class="w-2 h-2 rounded-full" style="background:#3b82f6"></div><span class="text-gray-600">Route Nodes (${coordinates.length})</span></div>
                <div class="flex items-center gap-2"><div class="w-3 h-3 rounded-full" style="background:#f97316;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3)"></div><span class="text-gray-600">Turns (${turnPoints.length})</span></div>
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
  }, [taskId, status, coordinates, turnPoints, viewMode, loadLeaflet]);

  if (!taskId) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl mx-auto p-6 py-12"
      >
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Link href="/">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </motion.button>
          </Link>
        </motion.div>
        <RoutePlanner />
      </motion.div>
    );
  }

  if (!status) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-2xl mx-auto p-6 text-center py-20"
      >
        <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-600">Loading task status...</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="max-w-4xl mx-auto p-6 py-8"
    >
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-8"
      >
        <div className="flex items-center gap-3 mb-2">
          <Link href="/">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </motion.button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Route Computation</h1>
            <p className="text-sm text-gray-500">Task ID: {taskId.slice(0, 8)}...</p>
          </div>
        </div>
      </motion.div>

      {/* Task Progress */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <TaskProgress
          progress={status.progress}
          processed_nodes={status.processed_nodes}
          total_nodes={status.total_nodes}
          status={status.status}
          error={status.error}
          distance_km={status.distance_km}
          duration_min={status.duration_min}
        />
      </motion.div>

      {/* Map Section - Shown when completed */}
      {status.status === "completed" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-6"
        >
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            {/* Map Header with Toggle */}
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Map className="w-5 h-5 text-blue-600" />
                  <h2 className="text-lg font-semibold text-gray-900">Route Map</h2>
                  <span className="text-sm text-gray-500 ml-2">- {viewMode === 'main' ? 'Main route with start/end points' : 'All nodes with turn points'}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setViewMode('main')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      viewMode === 'main'
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-200"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    <Navigation className="w-4 h-4" />
                    Main Route
                  </button>
                  <button
                    onClick={() => setViewMode('nodes')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      viewMode === 'nodes'
                        ? "bg-orange-500 text-white shadow-lg shadow-orange-200"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    <Layers className="w-4 h-4" />
                    All Nodes
                  </button>
                </div>
              </div>
            </div>

            {/* Map Container */}
            <div ref={mapRef} className="h-[400px] sm:h-[500px] w-full relative z-0" />
          </div>

          {/* Stats */}
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-center">
              <div className="text-xl font-bold text-blue-700">{coordinates.length}</div>
              <div className="text-xs text-blue-600">Route Nodes</div>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-center">
              <div className="text-xl font-bold text-orange-600">{turnPoints.length}</div>
              <div className="text-xs text-orange-600">Turn Points</div>
            </div>
          </div>

          {/* Plan New Route Button */}
          <motion.button
            onClick={() => {
              setCoordinates([]);
              setTurnPoints([]);
              router.push('/route');
            }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="mt-4 w-full rounded-xl border-2 border-blue-200 bg-blue-50 px-6 py-3 text-blue-700 font-medium hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
          >
            <Navigation className="w-4 h-4" />
            Plan New Route
          </motion.button>
        </motion.div>
      )}
    </motion.div>
  );
}

export default function RoutePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <RoutePageContent />
    </Suspense>
  );
}
