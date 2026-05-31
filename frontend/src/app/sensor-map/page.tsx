"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/LanguageContext";
import { fetchRoadSensors, fetchManualSensors } from "@/lib/api";

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

type RoadSensor = {
  sensor_id: string;
  latitude: number;
  longitude: number;
  road_name?: string;
  intersection_type?: string;
};

type ManualSensor = {
  id: string;
  latitude: number;
  longitude: number;
  degree?: number;
  created_at?: string;
};

export default function SensorMapPage() {
  const { t } = useLanguage();
  const [roadSensors, setRoadSensors] = useState<RoadSensor[]>([]);
  const [manualSensors, setManualSensors] = useState<ManualSensor[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<"all" | "manual" | "road">("all");

  useEffect(() => {
    const cssLink = document.createElement("link");
    cssLink.rel = "stylesheet";
    cssLink.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(cssLink);

    const loadData = async () => {
      try {
        const [road, manual] = await Promise.all([
          fetchRoadSensors(),
          fetchManualSensors(),
        ]);
        setRoadSensors(road);
        setManualSensors(manual);
      } catch (err) {
        console.error("Failed to fetch sensors:", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const allSensors = [
    ...(activeFilter === "all" || activeFilter === "manual" ? manualSensors : []),
    ...(activeFilter === "all" || activeFilter === "road" ? roadSensors : []),
  ];

  const center: [number, number] =
    allSensors.length > 0
      ? [allSensors[0].latitude, allSensors[0].longitude]
      : [19.076, 72.8777];

  const manualCount = manualSensors.length;
  const roadCount = roadSensors.length;

  if (loading)
    return <div className="h-96 w-full animate-pulse rounded-lg bg-gray-200" />;

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-4 text-2xl font-bold">{t("sensormap.heading")}</h1>

      {/* Stats and Filters */}
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-2 text-center">
          <div className="text-xl font-bold text-blue-700">{manualCount}</div>
          <div className="text-xs text-blue-600">{t("sensormap.manual")}</div>
        </div>
        <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-2 text-center">
          <div className="text-xl font-bold text-green-700">{roadCount}</div>
          <div className="text-xs text-green-600">{t("sensormap.road")}</div>
        </div>
        <div className="rounded-xl bg-purple-50 border border-purple-200 px-4 py-2 text-center">
          <div className="text-xl font-bold text-purple-700">{manualCount + roadCount}</div>
          <div className="text-xs text-purple-600">{t("sensormap.total")}</div>
        </div>
      </div>

      {/* Filter Buttons */}
      <div className="mb-4 flex gap-2">
        {[
          { key: "all" as const, labelKey: "sensormap.all", color: "bg-purple-600" },
          { key: "manual" as const, labelKey: "sensormap.manualOnly", color: "bg-blue-600" },
          { key: "road" as const, labelKey: "sensormap.roadOnly", color: "bg-green-600" },
        ].map((filter) => (
          <button
            key={filter.key}
            onClick={() => setActiveFilter(filter.key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeFilter === filter.key
                ? `${filter.color} text-white shadow-lg`
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {t(filter.labelKey)}
          </button>
        ))}
      </div>

      <MapContainer
        center={center}
        zoom={11}
        className="h-96 w-full rounded-lg"
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Manual Sensors - Blue */}
        {(activeFilter === "all" || activeFilter === "manual") && manualSensors.map((s) => (
          <CircleMarker
            key={`manual-${s.id}`}
            center={[s.latitude, s.longitude]}
            radius={6}
            color="#2563eb"
            fillColor="#3b82f6"
            fillOpacity={0.8}
          >
            <Popup>
              <div className="text-sm">
                <strong>{t("sensormap.popupManual")}</strong><br />
                {s.latitude.toFixed(5)}, {s.longitude.toFixed(5)}
                {s.degree !== undefined && (
                  <>
                    <br />
                    Degree: {s.degree}°
                  </>
                )}
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {/* Road Sensors - Green */}
        {(activeFilter === "all" || activeFilter === "road") && roadSensors.map((s) => (
          <CircleMarker
            key={`road-${s.sensor_id}`}
            center={[s.latitude, s.longitude]}
            radius={4}
            color="#10b981"
            fillColor="#10b981"
            fillOpacity={0.7}
          >
            <Popup>
              <div className="text-sm">
                <strong>{t("sensormap.popupRoad")}</strong><br />
                {s.latitude.toFixed(5)}, {s.longitude.toFixed(5)}
                {s.road_name && (
                  <>
                    <br />
                    {s.road_name}
                  </>
                )}
                {s.intersection_type && (
                  <span className="text-xs text-gray-400"> — {s.intersection_type}</span>
                )}
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>

      {/* Legend */}
      <div className="mt-4 flex gap-4 text-xs text-gray-600">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          {t("sensormap.manual")} ({manualCount})
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          {t("sensormap.road")} ({roadCount})
        </div>
      </div>
    </div>
  );
}
