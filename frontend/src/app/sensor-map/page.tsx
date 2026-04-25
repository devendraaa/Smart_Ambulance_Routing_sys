"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { fetchRoadSensors, getRoadSensorCount } from "@/lib/api";

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

type Sensor = { sensor_id: string; latitude: number; longitude: number; road_name?: string; intersection_type?: string };

export default function SensorMapPage() {
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cssLink = document.createElement("link");
    cssLink.rel = "stylesheet";
    cssLink.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(cssLink);

    fetchRoadSensors()
      .then((data) => {
        setSensors(data);
        setCount(data.length);
      })
      .catch(() => {});
    getRoadSensorCount()
      .then((c) => setCount(c.count))
      .catch(() => {});
    setLoading(false);
  }, []);

  const center: [number, number] =
    sensors.length > 0
      ? [sensors[0].latitude, sensors[0].longitude]
      : [19.076, 72.8777];

  if (loading)
    return <div className="h-96 w-full animate-pulse rounded-lg bg-gray-200" />;

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-4 text-2xl font-bold">Road Intersection Sensors Map</h1>
      <p className="mb-4 text-sm text-gray-600">
        {count} road intersection sensor(s) — {sensors.length} shown
      </p>
      <MapContainer
        center={center}
        zoom={11}
        className="h-96 w-full rounded-lg"
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {sensors.map((s) => (
          <CircleMarker
            key={s.sensor_id}
            center={[s.latitude, s.longitude]}
            radius={4}
            color="#10b981"
            fillColor="#10b981"
            fillOpacity={0.7}
          >
            <Popup>
              {s.latitude.toFixed(5)}, {s.longitude.toFixed(5)}
              {s.road_name && <br />}
              {s.road_name}
              {s.intersection_type && <span className="text-xs text-gray-400"> — {s.intersection_type}</span>}
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}
