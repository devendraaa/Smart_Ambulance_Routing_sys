"use client";

import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { getTaskCoordinates, getTaskTurnPoints, getFullRoute } from "@/lib/api";

const MapContainer = dynamic(
  () => import("react-leaflet").then((m) => m.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((m) => m.TileLayer),
  { ssr: false }
);
const Polyline = dynamic(
  () => import("react-leaflet").then((m) => m.Polyline),
  { ssr: false }
);
const Marker = dynamic(
  () => import("react-leaflet").then((m) => m.Marker),
  { ssr: false }
);

type Coord = { lat: number; lon: number };

const CircleMarker = dynamic(
    () => import("react-leaflet").then((m) => m.CircleMarker),
    { ssr: false }
  );
  const Tooltip = dynamic(
    () => import("react-leaflet").then((m) => m.Tooltip),
    { ssr: false }
  );

  // Orange turn-point icons via divIcon
function createTurnIcon() {
  return {
    // We'll create this via dynamic import
    html: `<div style="background:#f97316;width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3)"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
    className: "",
  };
}

export default function MapPage() {
  const [viewMode, setViewMode] = useState<'full' | 'turns'>('full');
  const searchParams = useSearchParams();
  const taskId = searchParams.get("task");
  const [coordinates, setCoordinates] = useState<Coord[]>([]);
  const [turnPoints, setTurnPoints] = useState<Coord[]>([]);
  const [loading, setLoading] = useState(true);
  const leafletLoadedRef = useRef(false);

  useEffect(() => {
    if (leafletLoadedRef.current) return;
    leafletLoadedRef.current = true;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
  }, []);

  useEffect(() => {
    if (!taskId) {
      setLoading(false);
      return;
    }

    const loadData = async () => {
      setLoading(true);
      try {
        if (viewMode === 'full') {
          // Fetch both coordinates and turning points in one call
          const fullData = await getFullRoute(taskId);
          setCoordinates(fullData.coordinates.map((c) => ({ lat: c.lat, lon: c.lon })));
          setTurnPoints(fullData.turn_points.map((t) => ({ lat: t.lat, lon: t.lon })));
        } else {
          // Only need turning points
          const turnData = await getTaskTurnPoints(taskId);
          setTurnPoints(turnData.turn_points.map((t) => ({ lat: t.lat, lon: t.lon })));
          setCoordinates([]); // clear full coordinates
        }
      } catch {
        setCoordinates([]);
        setTurnPoints([]);
      }
      setLoading(false);
    };
    loadData();
  }, [taskId, viewMode]);

  const center: [number, number] =
    coordinates.length > 0
      ? [coordinates[0].lat, coordinates[0].lon]
      : [19.0458, 72.8484];

  if (loading)
    return <div className="h-96 w-full animate-pulse rounded-lg bg-gray-200" />;
  if (!taskId)
    return (
      <div className="mx-auto max-w-4xl p-6 text-center text-gray-600">
        No task ID. Compute a route first.
      </div>
    );

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="mb-4 text-2xl font-bold">Route Map</h1>
      <MapContainer
        center={center}
        zoom={13}
        className="h-96 w-full rounded-lg"
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {/* View mode toggle */}
        <div className="flex gap-2 mb-2">
          <button
            className={`px-3 py-1 rounded ${viewMode === 'full' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
            onClick={() => setViewMode('full')}
          >
            Full Path
          </button>
          <button
            className={`px-3 py-1 rounded ${viewMode === 'turns' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
            onClick={() => setViewMode('turns')}
          >
            Turn Points
          </button>
        </div>
        {viewMode === 'full' && (
          <>
            {/* Full polyline */}
            <Polyline
              positions={coordinates.map((c) => [c.lat, c.lon] as [number, number])}
              color="blue"
              weight={4}
              opacity={0.8}
            />
            {/* Each node as a CircleMarker with index tooltip */}
            {coordinates.map((c, idx) => (
              <CircleMarker
                key={`node-${idx}-${c.lat}-${c.lon}`}
                center={[c.lat, c.lon]}
                radius={4}
                color="green"
                fillColor="lime"
                fillOpacity={0.9}
              >
                <Tooltip direction="top" offset={[0, -6]} opacity={0.9} permanent>
                  {idx}: {c.lat.toFixed(5)}, {c.lon.toFixed(5)}
                </Tooltip>
              </CircleMarker>
            ))}
            {/* Start / end markers */}
            <Marker position={[coordinates[0].lat, coordinates[0].lon]} />
            <Marker position={[coordinates[coordinates.length - 1].lat, coordinates[coordinates.length - 1].lon]} />
          </>
        )}
        {viewMode === 'turns' && (
          <>
            {/* Turning points only */}
            {turnPoints.map((t, i) => (
              <Marker key={`turn-${i}-${t.lat}-${t.lon}`} position={[t.lat, t.lon]} />
            ))}
          </>
        )}
      </MapContainer>
      {turnPoints.length > 0 && (
        <p className="mt-2 text-sm text-gray-500">
          {turnPoints.length} route turning points shown — also visible on the sensor page.
        </p>
      )}
    </div>
  );
}
