"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Trash2,
  Locate,
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { addInstalledSensor, fetchInstalledSensors, deleteInstalledSensor, refreshSensorLocation } from "@/lib/api";

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
const Popup = dynamic(
  () => import("react-leaflet").then((m) => m.Popup),
  { ssr: false }
);

type InstalledSensor = {
  id: string;
  latitude: number;
  longitude: number;
  location_name?: string;
  degree?: number;
  created_at?: string;
};

export default function InstalledSensorsPage() {
  const { t } = useLanguage();
  const [sensors, setSensors] = useState<InstalledSensor[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<Record<string, boolean>>({});
  const [refreshing, setRefreshing] = useState<Record<string, boolean>>({});
  const mapRef = useRef<any>(null);

  // Form state
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [formMsg, setFormMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const loadSensors = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchInstalledSensors();
      console.log("[InstalledSensors] fetchInstalledSensors returned:", data);
      setSensors(data.map((s) => ({ ...s })));
    } catch (err) {
      console.error("[InstalledSensors] Failed to fetch sensors:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Load Leaflet CSS
    if (!document.querySelector('link[href*="leaflet"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
    loadSensors();
  }, [loadSensors]);

  const handleAddSensor = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormMsg(null);

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);

    if (isNaN(latitude) || isNaN(longitude)) {
      setFormMsg({
        type: "error",
        text: "Please enter valid latitude and longitude",
      });
      return;
    }

    if (
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      setFormMsg({
        type: "error",
        text: "Latitude must be between -90 and 90, Longitude between -180 and 180",
      });
      return;
    }

    setFormLoading(true);
    try {
      console.log("[InstalledSensors] Adding sensor:", { latitude, longitude });
      const result = await addInstalledSensor({ latitude, longitude });
      console.log("[InstalledSensors] Sensor added:", result);
      setFormMsg({ type: "success", text: "Sensor installed successfully!" });
      setLat("");
      setLon("");
      loadSensors();
    } catch (err: any) {
      console.error("[InstalledSensors] Failed to add sensor:", err);
      setFormMsg({
        type: "error",
        text: err?.message || "Failed to install sensor. Please try again.",
      });
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteSensor = async (sensorId: string) => {
    if (!confirm("Are you sure you want to delete this sensor?")) return;

    setDeleting((prev) => ({ ...prev, [sensorId]: true }));
    try {
      await deleteInstalledSensor(sensorId);
      console.log("[InstalledSensors] Sensor deleted:", sensorId);
      loadSensors();
    } catch (err: any) {
      console.error("[InstalledSensors] Failed to delete sensor:", err);
      alert("Failed to delete sensor. Please try again.");
    } finally {
      setDeleting((prev) => ({ ...prev, [sensorId]: false }));
    }
  };

  const handleRefreshLocation = async (sensor: InstalledSensor) => {
    const key = sensor.id;
    setRefreshing((prev) => ({ ...prev, [key]: true }));
    try {
      const result = await refreshSensorLocation(sensor.id);
      console.log("[InstalledSensors] Location refreshed:", result);
      loadSensors();
    } catch (err: any) {
      console.error("[InstalledSensors] Failed to refresh location:", err);
      alert("Failed to refresh location. Please try again.");
    } finally {
      setRefreshing((prev) => ({ ...prev, [key]: false }));
    }
  };

  const displayLocation = (s: InstalledSensor) => {
    if (s.location_name && s.location_name !== `${s.latitude.toFixed(5)}, ${s.longitude.toFixed(5)}`) {
      return s.location_name;
    }
    return `${s.latitude.toFixed(5)}, ${s.longitude.toFixed(5)}`;
  };

  // Map center & bounds
  const validSensors = sensors.filter((s) => s.latitude && s.longitude);
  const center: [number, number] =
    validSensors.length > 0
      ? [validSensors[0].latitude, validSensors[0].longitude]
      : [19.0760, 72.8777];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-5xl mx-auto p-6 py-8"
    >
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {t("installed.heading")}
        </h1>
        <p className="text-gray-500">
          {t("installed.desc")}
        </p>
      </motion.div>

      {/* Add Sensor Form */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
            <MapPin className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{t("installed.installNew")}</h3>
            <p className="text-sm text-gray-500">
              {t("installed.installDesc")}
            </p>
          </div>
        </div>

        <form onSubmit={handleAddSensor}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {t("installed.latitude")}
              </label>
              <input
                type="number"
                step="any"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                placeholder={t("installed.latPlaceholder")}
                className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 transition"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                {t("installed.longitude")}
              </label>
              <input
                type="number"
                step="any"
                value={lon}
                onChange={(e) => setLon(e.target.value)}
                placeholder={t("installed.lonPlaceholder")}
                className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 transition"
                required
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-1 flex items-end">
              <motion.button
                type="submit"
                disabled={formLoading}
                whileHover={{ scale: formLoading ? 1 : 1.02 }}
                whileTap={{ scale: formLoading ? 1 : 0.98 }}
                className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-6 py-3 text-white font-medium shadow-lg shadow-emerald-200 hover:shadow-xl transition-shadow disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {formLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {t("installed.installingBtn")}
                  </>
                ) : (
                  <>
                    <MapPin className="w-5 h-5" />
                    {t("installed.installBtn")}
                  </>
                )}
              </motion.button>
            </div>
          </div>

          <AnimatePresence>
            {formMsg && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className={`p-3 rounded-xl text-sm flex items-center gap-2 ${
                  formMsg.type === "error"
                    ? "bg-red-50 text-red-700 border border-red-200"
                    : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                }`}
              >
                {formMsg.type === "error" ? (
                  <AlertCircle className="w-4 h-4" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                {formMsg.text}
              </motion.div>
            )}
          </AnimatePresence>
        </form>
      </motion.div>

      {/* Sensors Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6"
      >
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">
            Installed Sensors
            <span className="ml-2 text-sm font-normal text-gray-500">
              ({sensors.length} sensors)
            </span>
          </h3>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={loadSensors}
            className="p-2 rounded-lg hover:bg-gray-50 text-gray-500 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </motion.button>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-500">Loading sensors...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Latitude
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Longitude
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sensors.map((s, i) => (
                  <motion.tr
                    key={s.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="hover:bg-emerald-50/30 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <span className="text-sm font-mono text-gray-400">
                        {i + 1}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-mono text-gray-800">
                        {s.latitude.toFixed(5)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-mono text-gray-800">
                        {s.longitude.toFixed(5)}
                      </span>
                    </td>
                    <td className="px-6 py-4 max-w-md">
                      <div className="flex items-start gap-2">
                        <span className="text-sm text-gray-600 line-clamp-2 flex-1">
                          {s.location_name && s.location_name !== `${s.latitude.toFixed(5)}, ${s.longitude.toFixed(5)}`
                            ? s.location_name
                            : `${s.latitude.toFixed(5)}, ${s.longitude.toFixed(5)}`}
                        </span>
                        {(!s.location_name || s.location_name === `${s.latitude.toFixed(5)}, ${s.longitude.toFixed(5)}`) && (
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleRefreshLocation(s)}
                            disabled={refreshing[s.id]}
                            className="p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors disabled:opacity-50 shrink-0"
                            title="Refresh location"
                          >
                            {refreshing[s.id] ? (
                              <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Locate className="w-3 h-3" />
                            )}
                          </motion.button>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <span className="text-xs text-gray-400 font-mono">
                          {s.id.slice(0, 8)}
                        </span>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleDeleteSensor(s.id)}
                          disabled={deleting[s.id]}
                          className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                          title="Delete sensor"
                        >
                          {deleting[s.id] ? (
                            <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </motion.button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
                {sensors.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-400">
                      <MapPin className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                      <p>No sensors installed yet.</p>
                      <p className="text-xs mt-1">
                        Use the form above to install your first sensor.
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* Map Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
      >
        <div className="p-6 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">
            Sensor Locations Map
            <span className="ml-2 text-sm font-normal text-gray-500">
              ({validSensors.length} markers)
            </span>
          </h3>
        </div>

        {loading ? (
          <div className="h-96 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
          </div>
        ) : validSensors.length === 0 ? (
          <div className="h-96 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <MapPin className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>No sensors to display on map</p>
            </div>
          </div>
        ) : (
          <MapContainer
            center={center}
            zoom={11}
            className="h-96 w-full rounded-b-2xl"
            ref={mapRef}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {validSensors.map((s) => (
              <CircleMarker
                key={s.id}
                center={[s.latitude, s.longitude]}
                radius={8}
                pathOptions={{
                  color: "#059669",
                  fillColor: "#34d399",
                  fillOpacity: 0.8,
                  weight: 2,
                }}
              >
                <Popup>
                  <div className="text-sm font-sans min-w-[200px]">
                    <div className="font-bold text-emerald-700 mb-1">Installed Sensor</div>
                    <div className="text-gray-700">
                      <span className="font-mono">{s.latitude.toFixed(5)}</span>,{' '}
                      <span className="font-mono">{s.longitude.toFixed(5)}</span>
                    </div>
                    {s.location_name && s.location_name !== `${s.latitude.toFixed(5)}, ${s.longitude.toFixed(5)}` && (
                      <div className="text-gray-600 mt-1 text-xs line-clamp-3">
                        {s.location_name}
                      </div>
                    )}
                    <div className="text-xs text-gray-400 mt-1 font-mono">
                      ID: {s.id.slice(0, 8)}
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            ))}

            {/* Fit map to show all sensors */}
            <FitBounds sensors={validSensors} />
          </MapContainer>
        )}

        {/* Legend */}
        {!loading && validSensors.length > 0 && (
          <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center gap-4 text-xs text-gray-600">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              Installed Sensors ({validSensors.length})
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

// Helper component to fit map bounds
function FitBounds({ sensors }: { sensors: InstalledSensor[] }) {
  useEffect(() => {
    if (sensors.length === 0) return;
    try {
      const L = (window as any).L;
      if (!L) return;

      setTimeout(() => {
        const mapEl = document.querySelector('.leaflet-container');
        if (mapEl && (mapEl as any)._leaflet_map) {
          const L2 = (window as any).L;
          const latlngs: [number, number][] = sensors.map((s) => [s.latitude, s.longitude]);
          const bounds = L2.latLngBounds(latlngs);
          (mapEl as any)._leaflet_map.fitBounds(bounds, { padding: [50, 50] });
        }
      }, 100);
    } catch (e) {
      console.error("FitBounds error:", e);
    }
  }, [sensors]);
  return null;
}
