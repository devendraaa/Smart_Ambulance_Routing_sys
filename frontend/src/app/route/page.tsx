"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useRouteTask } from "@/hooks/useRouteTask";
import TaskProgress from "@/components/TaskProgress";
import RoutePlanner from "@/components/RoutePlanner";
import { motion } from "framer-motion";
import { ArrowLeft, Map, Layers, Navigation,Waypoints, MapPin, Radio, Send, AlertCircle, CheckCircle, StopCircle } from "lucide-react";
import Link from "next/link";
import { getFullRoute, getTaskRoadSensors, fetchTrafficSignals, publishAmbLocation, stopSensors } from "@/lib/api";
import { useEffect, useRef, useState, useCallback } from "react";

type ViewMode = 'main' | 'nodes' | 'active-sensors' | 'traffic-signals' | 'amb-location';

type RoadSensor = {
  sensor_id: string;
  latitude: number;
  longitude: number;
  road_name: string;
  distance_km: number;
};

type TrafficSignal = {
  lat: number;
  lon: number;
  signal_id: string;
  distance_km: number;
  road_name: string;
  junction: string;
};

type NearestSensor = {
  sensor: RoadSensor;
  distance_from_amb: number;
  index: number;
};

const GEO_INTERVAL = 4000; // 4 seconds

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371.0;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function RoutePageContent() {
  const searchParams = useSearchParams();
  const taskId = searchParams.get("task");
  const viewParam = searchParams.get("view");
  const router = useRouter();
  const status = useRouteTask(taskId);

  const [coordinates, setCoordinates] = useState<{ lat: number; lon: number }[]>([]);
  const [turnPoints, setTurnPoints] = useState<{ lat: number; lon: number }[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (viewParam === 'amb-location' || viewParam === 'main' || viewParam === 'nodes' || viewParam === 'active-sensors' || viewParam === 'traffic-signals') {
      return viewParam;
    }
    return 'main';
  });
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const leafletLoaded = useRef(false);

  // Amb Location state
  const [roadSensors, setRoadSensors] = useState<RoadSensor[]>([]);
  const [ambActive, setAmbActive] = useState(false);
  const [currentLat, setCurrentLat] = useState<number | null>(null);
  const [currentLon, setCurrentLon] = useState<number | null>(null);
  const [nearest, setNearest] = useState<NearestSensor | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [publishStatus, setPublishStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [lastPublishTime, setLastPublishTime] = useState<string | null>(null);
  const [trafficSignals, setTrafficSignals] = useState<TrafficSignal[]>([]);

  const watchIdRef = useRef<number | null>(null);

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

  // Fetch road sensors for Amb Location when task is completed
  useEffect(() => {
    if (!taskId || !status || status.status !== "completed") return;

    const fetchSensors = async () => {
      try {
        const data = await getTaskRoadSensors(taskId);
        setRoadSensors(data.road_sensors || []);
        console.log("[Amb Location] Loaded", data.road_sensors?.length || 0, "active sensors");
      } catch (err) {
        console.error("Failed to load road sensors:", err);
      }
    };
    fetchSensors();
  }, [taskId, status]);

  // Fetch traffic signals when task is completed
  useEffect(() => {
    if (!taskId || !status || status.status !== "completed") return;

    const fetchSignals = async () => {
      try {
        const data = await fetchTrafficSignals(taskId);
        setTrafficSignals(data.signals || []);
        console.log("[Traffic Signals] Loaded", data.signals?.length || 0, "signals");
      } catch (err) {
        console.error("Failed to load traffic signals:", err);
      }
    };
    if (viewMode === 'traffic-signals') {
      fetchSignals();
    }
  }, [taskId, status, viewMode]);

  // Find nearest sensor to current location
  const findNearest = useCallback(
    (lat: number, lon: number): NearestSensor | null => {
      if (roadSensors.length === 0) return null;

      let best: NearestSensor | null = null;

      roadSensors.forEach((sensor, idx) => {
        const d = haversine(lat, lon, sensor.latitude, sensor.longitude);
        if (!best || d < best.distance_from_amb) {
          best = { sensor, distance_from_amb: d, index: idx };
        }
      });

      return best;
    },
    [roadSensors]
  );

  // Publish nearest sensor to amb82mini
  const publishToDevice = useCallback(async (nearestData: NearestSensor) => {
    setPublishStatus("sending");
    try {
      await publishAmbLocation({
        sensor_id: nearestData.sensor.sensor_id,
        latitude: nearestData.sensor.latitude,
        longitude: nearestData.sensor.longitude,
        road_name: nearestData.sensor.road_name,
        distance_km: nearestData.distance_from_amb,
        topic: "ambulance/amb-location",
      });
      setPublishStatus("sent");
      setLastPublishTime(new Date().toLocaleTimeString());
      setTimeout(() => setPublishStatus("idle"), 3000);
    } catch (err) {
      console.error("Failed to publish to amb82mini:", err);
      setPublishStatus("error");
      setTimeout(() => setPublishStatus("idle"), 3000);
    }
  }, []);

  // Start Amb Location tracking (every 4 seconds)
  const startAmbTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoError("Geolocation is not supported by your browser.");
      return;
    }

    setAmbActive(true);
    setGeoError(null);

    // Clear any existing interval
    if (watchIdRef.current !== null) {
      clearInterval(watchIdRef.current);
    }

    // Get initial position immediately
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        setCurrentLat(lat);
        setCurrentLon(lon);

        const nearestData = findNearest(lat, lon);
        if (nearestData) {
          setNearest(nearestData);
          publishToDevice(nearestData);
        }
      },
      (err) => {
        console.error("Geolocation error:", err);
        setGeoError(`Location error: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );

    // Set up 4-second interval for continuous tracking
    watchIdRef.current = window.setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          setCurrentLat(lat);
          setCurrentLon(lon);

          const nearestData = findNearest(lat, lon);
          if (nearestData) {
            setNearest(nearestData);
            publishToDevice(nearestData);
          }
        },
        (err) => {
          console.error("Geolocation error:", err);
          setGeoError(`Location error: ${err.message}`);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }, GEO_INTERVAL);
  }, [findNearest, publishToDevice]);

  // Stop Amb Location tracking
  const stopAmbTracking = useCallback(() => {
    setAmbActive(false);
    if (watchIdRef.current !== null) {
      clearInterval(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAmbTracking();
    };
  }, [stopAmbTracking]);

  // Update URL when viewMode changes (preserve task parameter)
  useEffect(() => {
    if (viewMode === 'main') {
      // Don't add view=main to URL (default)
      if (searchParams.has('view')) {
        const newParams = new URLSearchParams(searchParams.toString());
        newParams.delete('view');
        const newUrl = taskId ? `/route?task=${taskId}` : '/route';
        router.replace(newUrl, { scroll: false });
      }
    } else {
      const newUrl = taskId
        ? `/route?task=${taskId}&view=${viewMode}`
        : `/route?view=${viewMode}`;
      router.replace(newUrl, { scroll: false });
    }
    // Don't run on initial mount (viewMode set from URL)
    // Only run when viewMode changes after mount
  }, [viewMode, taskId]);

  // Auto-start amb tracking when viewMode becomes 'amb-location'
  useEffect(() => {
    if (viewMode === 'amb-location' && !ambActive && status?.status === 'completed') {
      startAmbTracking();
    } else if (viewMode !== 'amb-location' && ambActive) {
      stopAmbTracking();
    }
    return () => {
      // Don't stop on view mode change - only stop on unmount
    };
  }, [viewMode, status?.status]);

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

        else if (viewMode === 'active-sensors') {
          // Show active sensors on map as green/blue markers
          if (roadSensors.length > 0) {
            roadSensors.forEach((s: RoadSensor, i: number) => {
              const isNearest = nearest?.sensor.sensor_id === s.sensor_id;
              L.circleMarker([s.latitude, s.longitude], {
                radius: isNearest ? 10 : 6,
                color: isNearest ? '#10b981' : '#22c55e',
                fillColor: isNearest ? '#10b981' : '#22c55e',
                fillOpacity: isNearest ? 1.0 : 0.7,
                weight: isNearest ? 3 : 1,
              }).addTo(map).bindPopup(
                `<div style="font-family:sans-serif;min-width:200px">
                  <b style="color:${isNearest ? '#10b981' : '#22c55e'}">
                    ${isNearest ? '★ Nearest' : 'Sensor'} #${i + 1}
                  </b><br/>
                  ID: ${s.sensor_id.slice(-8).toUpperCase()}<br/>
                  Lat: ${s.latitude.toFixed(6)}<br/>
                  Lon: ${s.longitude.toFixed(6)}<br/>
                  Road: ${s.road_name || 'N/A'}<br/>
                  Dist on route: ${s.distance_km.toFixed(3)} km
                </div>`
              );
              allLatLngs.push([s.latitude, s.longitude]);
            });
          }
        } else if (viewMode === 'traffic-signals') {
          // Show traffic signals on map as purple markers
          if (trafficSignals.length > 0) {
            trafficSignals.forEach((s: TrafficSignal, i: number) => {
              L.circleMarker([s.lat, s.lon], {
                radius: 8,
                color: '#8b5cf6',
                fillColor: '#a78bfa',
                fillOpacity: 0.9,
                weight: 2,
              }).addTo(map).bindPopup(
                `<div style="font-family:sans-serif;min-width:200px">
                  <b style="color:#8b5cf6">Traffic Signal #${i + 1}</b><br/>
                  Lat: ${s.lat.toFixed(6)}<br/>
                  Lon: ${s.lon.toFixed(6)}<br/>
                  ${s.road_name ? `Road: ${s.road_name}<br/>` : ''}
                  ${s.junction ? `Junction: ${s.junction}<br/>` : ''}
                  Dist: ${s.distance_km.toFixed(3)} km
                </div>`
              );
              allLatLngs.push([s.lat, s.lon]);
            });
          }
        } else if (viewMode === 'amb-location') {
          // AMB LOCATION VIEW: Show current location, all sensors, nearest sensor
          if (roadSensors.length > 0) {
            // Show all active sensors as gray dots
            roadSensors.forEach((s: RoadSensor, i: number) => {
              const isNearest = nearest?.sensor.sensor_id === s.sensor_id;
              L.circleMarker([s.latitude, s.longitude], {
                radius: isNearest ? 10 : 5,
                color: isNearest ? '#10b981' : '#9ca3af',
                fillColor: isNearest ? '#10b981' : '#d1d5db',
                fillOpacity: isNearest ? 1.0 : 0.5,
                weight: isNearest ? 3 : 1,
              }).addTo(map).bindPopup(
                `<div style="font-family:sans-serif;min-width:200px">
                  <b style="color:${isNearest ? '#10b981' : '#6b7280'}">
                    ${isNearest ? '★ NEAREST SENSOR' : 'Sensor'} #${i + 1}
                  </b><br/>
                  ID: ${s.sensor_id.slice(-8).toUpperCase()}<br/>
                  Lat: ${s.latitude.toFixed(6)}<br/>
                  Lon: ${s.longitude.toFixed(6)}<br/>
                  Road: ${s.road_name || 'N/A'}<br/>
                  ${isNearest ? `<b style="color:#10b981">Dist from amb: ${nearest?.distance_from_amb.toFixed(3)} km</b>` : `Dist on route: ${s.distance_km.toFixed(3)} km`}
                </div>`
              );
              allLatLngs.push([s.latitude, s.longitude]);
            });

            // Show current ambulance location if available
            if (currentLat !== null && currentLon !== null) {
              // Current location marker (blue pulse)
              const ambIcon = L.divIcon({
                html: `<div style="position:relative;">
                  <div style="background:#3b82f6;width:20px;height:20px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;color:white;font-size:10px;font-weight:bold;z-index:1000;">A</div>
                  <div style="position:absolute;top:-5px;left:-5px;width:30px;height:30px;border-radius:50%;background:rgba(59,130,246,0.3);animation:pulse 2s infinite;"></div>
                  <style>@keyframes pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.5);opacity:0}}</style>
                </div>`,
                iconSize: [20, 20],
                iconAnchor: [10, 10],
              });
              L.marker([currentLat, currentLon], { icon: ambIcon }).addTo(map).bindPopup(
                `<div style="font-family:sans-serif;min-width:180px">
                  <b style="color:#3b82f6">🚑 Ambulance Location</b><br/>
                  Lat: ${currentLat.toFixed(6)}<br/>
                  Lon: ${currentLon.toFixed(6)}<br/>
                  ${nearest ? `Nearest sensor: #${formatSensorNumber(nearest.sensor.sensor_id)}<br/>Dist: ${nearest.distance_from_amb.toFixed(3)} km` : 'Finding nearest sensor...'}
                </div>`
              );
              allLatLngs.push([currentLat, currentLon]);

              // Draw line from current location to nearest sensor
              if (nearest) {
                L.polyline([[currentLat, currentLon], [nearest.sensor.latitude, nearest.sensor.longitude]], {
                  color: '#ef4444',
                  weight: 3,
                  opacity: 0.7,
                  dashArray: '10, 10',
                  lineCap: 'round',
                }).addTo(map).bindPopup(
                  `<div style="font-family:sans-serif;">
                    <b style="color:#ef4444">Distance to nearest sensor</b><br/>
                    ${nearest.distance_from_amb.toFixed(3)} km
                  </div>`
                );
              }
            }
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
          } else if (viewMode === 'amb-location') {
            div.innerHTML = `
              <div class="font-bold text-gray-700 mb-2 flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
                Legend
              </div>
              <div class="space-y-1.5">
                <div class="flex items-center gap-2"><div class="w-5 h-5 rounded-full" style="background:#3b82f6;border:2px solid white;display:flex;align-items:center;justify-content:center;color:white;font-size:8px;font-weight:bold;">A</div><span class="text-gray-600">Ambulance (A)</span></div>
                <div class="flex items-center gap-2"><div class="w-2 h-2 rounded-full" style="background:#9ca3af"></div><span class="text-gray-600">Active Sensors (${roadSensors.length})</span></div>
                <div class="flex items-center gap-2"><div class="w-3 h-3 rounded-full" style="background:#10b981;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3)"></div><span class="text-gray-600">Nearest Sensor</span></div>
                <div class="flex items-center gap-2"><div class="w-8 h-1.5 rounded-full" style="background:#ef4444;border-style:dashed"></div><span class="text-gray-600">Distance Line</span></div>
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

  // Format sensor number (short ID)
  const formatSensorNumber = (sensorId: string) => {
    return sensorId.slice(-8).toUpperCase();
  };

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

      {/* Patient Details Card - Shown when completed */}
      {status.status === "completed" && (status.patient_name || status.patient_mobile) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="mt-4 bg-gradient-to-br from-rose-50 to-orange-50 rounded-2xl border border-orange-100 p-5"
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 bg-gradient-to-br from-rose-500 to-orange-500 rounded-lg flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-800">Patient Information</h3>
              <p className="text-xs text-gray-500">Emergency case details</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
            {status.patient_date && (
              <div className="bg-white/60 rounded-xl p-3">
                <p className="text-xs text-gray-500 font-medium">Date</p>
                <p className="text-sm font-bold text-gray-900">{status.patient_date}</p>
              </div>
            )}
            {status.patient_case && (
              <div className="bg-red-50 rounded-xl p-3 border border-red-200">
                <p className="text-xs text-red-600 font-medium">Case Type</p>
                <p className="text-sm font-bold text-red-800">{status.patient_case}</p>
              </div>
            )}
            {status.patient_name && (
              <div className="bg-white/60 rounded-xl p-3">
                <p className="text-xs text-gray-500 font-medium">Patient Name</p>
                <p className="text-sm font-bold text-gray-900 truncate">{status.patient_name}</p>
              </div>
            )}
            {status.patient_age && (
              <div className="bg-white/60 rounded-xl p-3">
                <p className="text-xs text-gray-500 font-medium">Age</p>
                <p className="text-sm font-bold text-gray-900">{status.patient_age} years</p>
              </div>
            )}
            {status.patient_sex && (
              <div className="bg-white/60 rounded-xl p-3">
                <p className="text-xs text-gray-500 font-medium">Sex</p>
                <p className="text-sm font-bold text-gray-900">{status.patient_sex}</p>
              </div>
            )}
            {status.patient_blood_group && (
              <div className="bg-red-50 rounded-xl p-3 border border-red-200">
                <p className="text-xs text-red-600 font-medium">Blood Group</p>
                <p className="text-sm font-bold text-red-800">{status.patient_blood_group}</p>
              </div>
            )}
            {status.patient_mobile && (
              <div className="bg-white/60 rounded-xl p-3">
                <p className="text-xs text-gray-500 font-medium">Mobile</p>
                <p className="text-sm font-bold text-gray-900">{status.patient_mobile}</p>
              </div>
            )}
          </div>
        </motion.div>
      )}

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
                  <span className="text-sm text-gray-500 ml-2">-
                    {viewMode === 'main' ? 'Main route with start/end points' :
                     viewMode === 'nodes' ? 'All route nodes with turn points' :
                     viewMode === 'active-sensors' ? 'Active sensors near route' :
                     viewMode === 'traffic-signals' ? 'Traffic signals along route' :
                     'Amb location tracking'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
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
                  <button
                    onClick={() => setViewMode('active-sensors')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      viewMode === 'active-sensors'
                        ? "bg-green-600 text-white shadow-lg shadow-green-200"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    <Radio className="w-4 h-4" />
                    Active Sensor
                  </button>
                  <button
                    onClick={() => setViewMode('traffic-signals')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      viewMode === 'traffic-signals'
                        ? "bg-purple-600 text-white shadow-lg shadow-purple-200"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    <Waypoints className="w-4 h-4" />
                    Traffic Signal
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        await stopSensors();
                        alert("Stop signal sent to sensors!");
                      } catch (e) {
                        console.error("Failed to send stop signal:", e);
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-all"
                  >
                    <StopCircle className="w-4 h-4" />
                    Stop Sensor
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
        </motion.div>
      )}

      {/* ====== AMB LOCATION SECTION ====== */}
      {status.status === "completed" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-6"
        >
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            {/* Amb Location Header */}
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Radio className={`w-5 h-5 ${ambActive ? "text-green-500 animate-pulse" : "text-blue-600"}`} />
                  <h2 className="text-lg font-semibold text-gray-900">Amb Location</h2>
                  <span className="text-sm text-gray-500 ml-2">
                    - {roadSensors.length} active sensors near route
                  </span>
                </div>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={ambActive ? stopAmbTracking : startAmbTracking}
                  className={`px-5 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                    ambActive
                      ? "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
                      : "bg-green-600 text-white shadow-lg shadow-green-200 hover:bg-green-700"
                  }`}
                >
                  {ambActive ? (
                    <>
                      <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                      Stop Tracking
                    </>
                  ) : (
                    <>
                      <MapPin className="w-4 h-4" />
                      Start Amb Location
                    </>
                  )}
                </motion.button>
              </div>
            </div>

            {/* Geolocation Error */}
            {geoError && (
              <div className="mx-6 mt-4 bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                <p className="text-sm text-red-700">{geoError}</p>
              </div>
            )}

            {/* Amb Location Content */}
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {/* Current Location Card */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5" />
                    Current Location
                  </h3>
                  {currentLat !== null && currentLon !== null ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs text-gray-500 font-medium">Latitude</p>
                          <p className="text-base font-bold text-gray-900">{currentLat.toFixed(6)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 font-medium">Longitude</p>
                          <p className="text-base font-bold text-gray-900">{currentLon.toFixed(6)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <div className={`w-2 h-2 rounded-full ${ambActive ? "bg-green-500 animate-pulse" : "bg-gray-300"}`} />
                        {ambActive ? "Live tracking - every 4s" : "Tracking stopped"}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <MapPin className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">
                        {ambActive ? "Acquiring location..." : "Click 'Start Amb Location' to begin"}
                      </p>
                    </div>
                  )}
                </div>

                {/* Nearest Sensor Card */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Radio className="w-3.5 h-3.5" />
                    Nearest Active Sensor
                  </h3>
                  {nearest ? (
                    <div className="space-y-3">
                      <div className="bg-green-50 rounded-lg p-3">
                        <div className="mb-2">
                          <p className="text-xs text-green-600 font-medium">Sensor Number</p>
                          <p className="text-2xl font-bold text-green-900">
                            #{formatSensorNumber(nearest.sensor.sensor_id)}
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-xs text-green-600 font-medium">Distance</p>
                            <p className="text-base font-bold text-green-900">
                              {nearest.distance_from_amb.toFixed(3)} km
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-green-600 font-medium">Position</p>
                            <p className="text-base font-bold text-green-900">
                              {nearest.index + 1} of {roadSensors.length}
                            </p>
                          </div>
                        </div>
                      </div>
                      {nearest.sensor.road_name && (
                        <p className="text-xs text-gray-600">
                          <span className="font-medium">Road:</span> {nearest.sensor.road_name}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <Radio className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">
                        {ambActive ? "Calculating nearest sensor..." : "Waiting for location data"}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Publish Status */}
              {publishStatus !== "idle" && (
                <div className={`rounded-xl p-3 flex items-center gap-3 mb-4 ${
                  publishStatus === "sending"
                    ? "bg-blue-50 border border-blue-200"
                    : publishStatus === "sent"
                    ? "bg-green-50 border border-green-200"
                    : "bg-red-50 border border-red-200"
                }`}>
                  {publishStatus === "sending" && (
                    <>
                      <div className="w-5 h-5 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
                      <p className="text-sm text-blue-700">Sending to amb82mini device...</p>
                    </>
                  )}
                  {publishStatus === "sent" && (
                    <>
                      <CheckCircle className="w-5 h-5 text-green-500" />
                      <div>
                        <p className="text-sm text-green-700 font-medium">Data sent to amb82mini</p>
                        {lastPublishTime && (
                          <p className="text-xs text-green-600">Last sent at {lastPublishTime}</p>
                        )}
                      </div>
                    </>
                  )}
                  {publishStatus === "error" && (
                    <>
                      <AlertCircle className="w-5 h-5 text-red-500" />
                      <p className="text-sm text-red-700">Failed to send data to device</p>
                    </>
                  )}
                </div>
              )}

              {/* Active Sensors List */}
              {roadSensors.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Send className="w-4 h-4 text-blue-600" />
                    Active Sensors Near Route
                    <span className="ml-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                      {roadSensors.length}
                    </span>
                  </h3>
                  <div className="max-h-48 overflow-y-auto border border-gray-100 rounded-xl">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">#</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Sensor ID</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Coordinates</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Road</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Dist (km)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {roadSensors.map((sensor, idx) => (
                          <tr
                            key={sensor.sensor_id}
                            className={`hover:bg-blue-50/50 transition-colors ${
                              nearest?.sensor.sensor_id === sensor.sensor_id ? "bg-green-50" : ""
                            }`}
                          >
                            <td className="px-4 py-2">
                              <span className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-xs font-bold ${
                                nearest?.sensor.sensor_id === sensor.sensor_id
                                  ? "bg-green-500 text-white"
                                  : "bg-gray-100 text-gray-600"
                              }`}>
                                {idx + 1}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-xs font-mono text-gray-700">
                              #{formatSensorNumber(sensor.sensor_id)}
                            </td>
                            <td className="px-4 py-2 text-xs font-mono text-gray-500">
                              {sensor.latitude.toFixed(4)}, {sensor.longitude.toFixed(4)}
                            </td>
                            <td className="px-4 py-2 text-xs text-gray-600">
                              {sensor.road_name || "-"}
                            </td>
                            <td className="px-4 py-2 text-xs text-gray-600">
                              {sensor.distance_km.toFixed(3)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Plan New Route Button */}
      {status.status === "completed" && (
        <motion.button
          onClick={() => {
            setCoordinates([]);
            setTurnPoints([]);
            setRoadSensors([]);
            setNearest(null);
            setCurrentLat(null);
            setCurrentLon(null);
            stopAmbTracking();
            router.push('/route');
          }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="mt-4 w-full rounded-xl border-2 border-blue-200 bg-blue-50 px-6 py-3 text-blue-700 font-medium hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
        >
          <Navigation className="w-4 h-4" />
          Plan New Route
        </motion.button>
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
