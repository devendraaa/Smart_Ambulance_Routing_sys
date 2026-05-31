"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, MapPin, Radio, Send, AlertCircle, CheckCircle, StopCircle, RefreshCw } from "lucide-react";
import Link from "next/link";
import { getTaskRoadSensors, publishAmbLocation, getTaskStatus } from "@/lib/api";
import { useEffect, useRef, useState, useCallback } from "react";
import { useLanguage } from "@/lib/LanguageContext";

const GEO_INTERVAL = 4000; // 4 seconds

type RoadSensor = {
  sensor_id: string;
  latitude: number;
  longitude: number;
  road_name: string;
  distance_km: number;
};

type NearestSensor = {
  sensor: RoadSensor;
  distance_from_amb: number;
  index: number;
};

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371.0;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  // Clamp a to [0, 1] to avoid floating-point errors
  const clampedA = Math.max(0, Math.min(1, a));
  const distance = R * 2 * Math.atan2(Math.sqrt(clampedA), Math.sqrt(1 - clampedA));
  return isNaN(distance) ? 0 : distance;
}

function formatSensorNumber(sensorId: string) {
  return sensorId.slice(-8).toUpperCase();
}

function AmbLocationContent() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [taskId, setTaskId] = useState<string | null>(null);

  // Read task ID from URL or localStorage
  useEffect(() => {
    const fromUrl = searchParams.get("task");
    if (fromUrl) {
      setTaskId(fromUrl);
    } else {
      const stored = localStorage.getItem("lastTaskId");
      if (stored) {
        setTaskId(stored);
      }
    }
  }, [searchParams]);

  // Poll for lastTaskId if not yet available (handles race condition)
  useEffect(() => {
    if (taskId) return;
    const interval = setInterval(() => {
      const stored = localStorage.getItem("lastTaskId");
      if (stored) {
        setTaskId(stored);
        clearInterval(interval);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [taskId]);

  const [roadSensors, setRoadSensors] = useState<RoadSensor[]>([]);
  const [ambActive, setAmbActive] = useState(false);
  const [currentLat, setCurrentLat] = useState<number | null>(null);
  const [currentLon, setCurrentLon] = useState<number | null>(null);
  const [nearest, setNearest] = useState<NearestSensor | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [publishStatus, setPublishStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [lastPublishTime, setLastPublishTime] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [taskStatus, setTaskStatus] = useState<string>("");

  const intervalRef = useRef<number | null>(null);

  // Load road sensors when task ID is available
  useEffect(() => {
    if (!taskId) return;

    const loadSensors = async () => {
      setLoading(true);
      try {
        // Check task status first
        const status = await getTaskStatus(taskId);
        setTaskStatus(status.status);

        if (status.status === "completed") {
          const data = await getTaskRoadSensors(taskId);
          setRoadSensors(data.road_sensors || []);
          console.log("[Amb Location] Loaded", data.road_sensors?.length || 0, "active sensors");
        }
      } catch (err) {
        console.error("Failed to load road sensors:", err);
      } finally {
        setLoading(false);
      }
    };

    loadSensors();
  }, [taskId]);

  // Find nearest sensor to current location
  const findNearest = useCallback(
    (lat: number, lon: number): NearestSensor | null => {
      if (roadSensors.length === 0) {
        console.log("[Amb Location] No road sensors loaded yet");
        return null;
      }

      console.log(`[Amb Location] Finding nearest sensor to (${lat}, ${lon}) among ${roadSensors.length} sensors`);

      const best = roadSensors.reduce<NearestSensor | null>((acc, sensor, idx) => {
        const d = haversine(lat, lon, sensor.latitude, sensor.longitude);
        console.log(`[Amb Location] Sensor #${idx + 1} (${sensor.latitude}, ${sensor.longitude}) dist: ${d.toFixed(4)} km`);
        if (!acc || d < acc.distance_from_amb) {
          return { sensor, distance_from_amb: d, index: idx };
        }
        return acc;
      }, null);

      if (best) {
        console.log(`[Amb Location] Nearest sensor: #${best.index + 1}, dist: ${best.distance_from_amb.toFixed(4)} km`);
      }
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
      setGeoError(t("amblocation.noGeolocation"));
      return;
    }

    if (roadSensors.length === 0) {
      setGeoError(t("amblocation.noSensors"));
      return;
    }

    setAmbActive(true);
    setGeoError(null);

    // Clear any existing interval
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
    }

    console.log(`[Amb Location] Starting tracking with ${roadSensors.length} sensors loaded`);

    // Get initial position immediately
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        console.log(`[Amb Location] Got position: (${lat}, ${lon})`);
        setCurrentLat(lat);
        setCurrentLon(lon);

        const nearestData = findNearest(lat, lon);
        if (nearestData) {
          setNearest(nearestData);
          publishToDevice(nearestData);
        } else {
          console.warn("[Amb Location] findNearest returned null even though sensors are loaded");
        }
      },
      (err) => {
        console.error("Geolocation error:", err);
        setGeoError(t("amblocation.locationError") + " " + err.message);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );

    // Set up 4-second interval for continuous tracking
    intervalRef.current = window.setInterval(() => {
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
          setGeoError(t("amblocation.locationError") + " " + err.message);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }, GEO_INTERVAL);
  }, [findNearest, publishToDevice]);

  // Stop Amb Location tracking
  const stopAmbTracking = useCallback(() => {
    setAmbActive(false);
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAmbTracking();
    };
  }, [stopAmbTracking]);

  // Load Leaflet map
  useEffect(() => {
    if (!taskId || roadSensors.length === 0) return;

    let cancelled = false;

    const initMap = async () => {
      if (cancelled) return;

      try {
        // Load Leaflet CSS
        if (!document.querySelector('link[href*="leaflet"]')) {
          const link = document.createElement("link");
          link.rel = "stylesheet";
          link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
          document.head.appendChild(link);
        }

        // Load Leaflet JS
        const LModule = await import("leaflet");
        const L = LModule.default || LModule;

        if (cancelled) return;

        const mapContainer = document.getElementById("amb-location-map");
        if (!mapContainer) return;

        // Clean up existing map
        if ((mapContainer as any)._leaflet_id) {
          mapContainer.innerHTML = '';
        }

        const map = L.map(mapContainer);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);

        const allLatLngs: [number, number][] = [];

        // Show all active sensors
        roadSensors.forEach((s, i) => {
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
              ID: ${formatSensorNumber(s.sensor_id)}<br/>
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
          const ambIcon = L.divIcon({
            html: `<div style="position:relative;">
              <div style="background:#3b82f6;width:20px;height:20px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;color:white;font-size:10px;font-weight:bold;">A</div>
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

        // Fit map to show all elements
        if (allLatLngs.length > 0) {
          map.fitBounds(L.latLngBounds(allLatLngs), { padding: [50, 50] });
        } else {
          map.setView([19.0760, 72.8777], 13);
        }

      } catch (err) {
        console.error("Map init error:", err);
      }
    };

    initMap();

    return () => {
      cancelled = true;
    };
  }, [taskId, roadSensors, currentLat, currentLon, nearest]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="max-w-6xl mx-auto p-6 py-8"
    >
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-8"
      >
        <div className="flex items-center gap-3 mb-2">
          <Link href="/route">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </motion.button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t("amblocation.heading")}</h1>
            <p className="text-sm text-gray-500">
              {taskId ? `Task ID: ${taskId.slice(0, 8)}...` : 'No route task selected'}
            </p>
          </div>
        </div>
      </motion.div>

      {/* No Task ID */}
      {!taskId && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-yellow-50 border border-yellow-200 rounded-2xl p-8 text-center"
        >
          <Radio className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-yellow-800 mb-2">{t("amblocation.noTask")}</h2>
          <p className="text-sm text-yellow-700 mb-4">
            {t("amblocation.noTaskDesc")}
          </p>
          <Link href="/route">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="px-6 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              {t("amblocation.goRoute")}
            </motion.button>
          </Link>
        </motion.div>
      )}

      {/* Task Not Completed */}
      {taskId && taskStatus && taskStatus !== "completed" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-blue-50 border border-blue-200 rounded-2xl p-8 text-center"
        >
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-blue-800 mb-2">{t("amblocation.waiting")}</h2>
          <p className="text-sm text-blue-700">
            {t("amblocation.status")} <span className="font-bold">{taskStatus}</span>
          </p>
        </motion.div>
      )}

      {/* Main Content - Only show when task is completed */}
      {taskId && taskStatus === "completed" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {/* Control Panel */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden mb-6">
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Radio className={`w-5 h-5 ${ambActive ? "text-green-500 animate-pulse" : "text-blue-600"}`} />
                  <h2 className="text-lg font-semibold text-gray-900">{t("amblocation.tracking")}</h2>
                  <span className="text-sm text-gray-500 ml-2">
                    - {roadSensors.length} active sensors near route
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {!ambActive ? (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={startAmbTracking}
                      className="px-5 py-2 rounded-xl text-sm font-medium bg-green-600 text-white shadow-lg shadow-green-200 hover:bg-green-700 transition-all flex items-center gap-2"
                    >
                      <Radio className="w-4 h-4" />
                      {t("amblocation.start")}
                    </motion.button>
                  ) : (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={stopAmbTracking}
                      className="px-5 py-2 rounded-xl text-sm font-medium bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-all flex items-center gap-2"
                    >
                      <StopCircle className="w-4 h-4" />
                      {t("amblocation.stop")}
                    </motion.button>
                  )}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      if (taskId) {
                        const loadSensors = async () => {
                          setLoading(true);
                          try {
                            const data = await getTaskRoadSensors(taskId);
                            setRoadSensors(data.road_sensors || []);
                          } catch (err) {
                            console.error("Failed to reload:", err);
                          } finally {
                            setLoading(false);
                          }
                        };
                        loadSensors();
                      }
                    }}
                    className="px-4 py-2 rounded-xl text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all flex items-center gap-2"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                    {t("amblocation.reload")}
                  </motion.button>
                </div>
              </div>
            </div>

            {/* Geolocation Error */}
            {geoError && (
              <div className="mx-6 mt-4 bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                <p className="text-sm text-red-700">{geoError}</p>
              </div>
            )}

            {/* Tracking Status & Sensor Info */}
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {/* Current Location Card */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5" />
                    {t("amblocation.currentLocation")}
                  </h3>
                  {currentLat !== null && currentLon !== null ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs text-gray-500 font-medium">{t("amblocation.latitude")}</p>
                          <p className="text-base font-bold text-gray-900">{currentLat.toFixed(6)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 font-medium">{t("amblocation.longitude")}</p>
                          <p className="text-base font-bold text-gray-900">{currentLon.toFixed(6)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <div className={`w-2 h-2 rounded-full ${ambActive ? "bg-green-500 animate-pulse" : "bg-gray-300"}`} />
                        {ambActive ? t("amblocation.liveTracking") : t("amblocation.trackingStopped")}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <MapPin className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">
                        {ambActive ? t("amblocation.acquiring") : t("amblocation.clickStart")}
                      </p>
                    </div>
                  )}
                </div>

                {/* Nearest Sensor Card */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Radio className="w-3.5 h-3.5" />
                    {t("amblocation.nearestSensor")}
                  </h3>
                  {nearest ? (
                    <div className="space-y-3">
                      <div className="bg-green-50 rounded-lg p-3">
                        <div className="mb-2">
                          <p className="text-xs text-green-600 font-medium">{t("amblocation.sensorNumber")}</p>
                          <p className="text-2xl font-bold text-green-900">
                            #{formatSensorNumber(nearest.sensor.sensor_id)}
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-xs text-green-600 font-medium">{t("amblocation.distance")}</p>
                            <p className="text-base font-bold text-green-900">
                              {nearest.distance_from_amb.toFixed(3)} km
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-green-600 font-medium">{t("amblocation.position")}</p>
                            <p className="text-base font-bold text-green-900">
                              {nearest.index + 1} of {roadSensors.length}
                            </p>
                          </div>
                        </div>
                      </div>
                      {nearest.sensor.road_name && (
                        <p className="text-xs text-gray-600">
                          <span className="font-medium">{t("amblocation.road")}</span> {nearest.sensor.road_name}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <Radio className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">
                        {ambActive ? t("amblocation.calculating") : t("amblocation.waitingLocation")}
                      </p>
                    </div>
                  )}
                </div>

                {/* Publish Status Card */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Send className="w-3.5 h-3.5" />
                    {t("amblocation.deviceStatus")}
                  </h3>
                  {publishStatus !== "idle" ? (
                    <div className="space-y-3">
                      {publishStatus === "sending" && (
                        <div className="flex items-center gap-3">
                          <div className="w-5 h-5 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
                          <p className="text-sm text-blue-700">{t("amblocation.sending")}</p>
                        </div>
                      )}
                      {publishStatus === "sent" && (
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <CheckCircle className="w-5 h-5 text-green-500" />
                            <p className="text-sm text-green-700 font-medium">{t("amblocation.sent")}</p>
                          </div>
                          {lastPublishTime && (
                            <p className="text-xs text-green-600">{t("amblocation.last")} {lastPublishTime}</p>
                          )}
                        </div>
                      )}
                      {publishStatus === "error" && (
                        <div className="flex items-center gap-3">
                          <AlertCircle className="w-5 h-5 text-red-500" />
                          <p className="text-sm text-red-700">{t("amblocation.failed")}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <Send className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">
                        {ambActive ? t("amblocation.autoSending") : t("amblocation.notSending")}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Active Sensors Table */}
              {roadSensors.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Radio className="w-4 h-4 text-blue-600" />
                    {t("amblocation.activeSensors")}
                    <span className="ml-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                      {roadSensors.length}
                    </span>
                  </h3>
                  <div className="max-h-48 overflow-y-auto border border-gray-100 rounded-xl">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{t("amblocation.tableNum")}</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{t("amblocation.tableSensorId")}</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{t("amblocation.tableLat")}</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{t("amblocation.tableLon")}</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{t("amblocation.tableRoad")}</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{t("amblocation.tableDist")}</th>
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
                              {sensor.latitude.toFixed(4)}
                            </td>
                            <td className="px-4 py-2 text-xs font-mono text-gray-500">
                              {sensor.longitude.toFixed(4)}
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

          {/* Map */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">{t("amblocation.liveMap")}</h2>
                {ambActive && (
                  <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                    {t("amblocation.live")}
                  </span>
                )}
              </div>
            </div>
            <div id="amb-location-map" className="h-[500px] w-full" />
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

export default function AmbLocationPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <AmbLocationContent />
    </Suspense>
  );
}
