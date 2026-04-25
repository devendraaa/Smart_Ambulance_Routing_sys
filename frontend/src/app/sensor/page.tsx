"use client";

import { getTaskStatus, getTaskTurnPoints, loadRoadSensorsFull, getRoadSensorCount, fetchRoadSensors } from "@/lib/api";
import { useEffect, useState } from "react";

type RoadSensor = { sensor_id: string; latitude: number; longitude: number; road_name?: string; intersection_type?: string };
type TurnPoint = { lat: number; lon: number; sequence: number };

async function fetchRecentCompletedTaskId(): Promise<string | null> {
  const lastTaskId = localStorage.getItem("lastTaskId");
  if (!lastTaskId) return null;
  try {
    const status = await getTaskStatus(lastTaskId);
    if (status.status === "completed") return lastTaskId;
  } catch {}
  return null;
}

export default function SensorPage() {
  const [roadSensors, setRoadSensors] = useState<RoadSensor[]>([]);
  const [roadSensorCount, setRoadSensorCount] = useState(0);
  const [turnPoints, setTurnPoints] = useState<TurnPoint[]>([]);
  const [loadingRoad, setLoadingRoad] = useState(false);
  const [loadMsg, setLoadMsg] = useState("");

  const handleLoadRoadSensors = async () => {
    setLoadingRoad(true);
    setLoadMsg("");
    try {
      const res = await loadRoadSensorsFull();
      setLoadMsg(res.message);
      fetchRoadSensors().then(setRoadSensors).catch(() => {});
      const countRes = await getRoadSensorCount();
      setRoadSensorCount(countRes.count);
      setLoadingRoad(false);
    } catch {
      setLoadingRoad(false);
    }
  };

  const loadTurnPoints = async () => {
    try {
      const taskId = await fetchRecentCompletedTaskId();
      if (!taskId) {
        setTurnPoints([]);
        return;
      }
      const data = await getTaskTurnPoints(taskId);
      setTurnPoints(data.turn_points);
    } catch {
      setTurnPoints([]);
    }
  };

  useEffect(() => {
    fetchRoadSensors().then(setRoadSensors).catch(() => {});
    getRoadSensorCount().then((c) => setRoadSensorCount(c.count)).catch(() => {});
    loadTurnPoints();
  }, []);

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-6 text-2xl font-bold">Road Intersection Sensors</h1>

      {/* Load road intersection sensors */}
      <div className="mb-4 flex items-center gap-2">
        <button
          type="button"
          onClick={handleLoadRoadSensors}
          disabled={loadingRoad}
          className="rounded-md bg-emerald-600 px-4 py-2 text-white transition hover:bg-emerald-700 disabled:opacity-50"
        >
          {loadingRoad ? "Fetching intersections..." : `Load Road Sensors (${roadSensorCount} loaded)`}
        </button>
      </div>

      {loadMsg && <p className="mb-4 text-sm text-green-600">{loadMsg}</p>}

      {/* Road sensor list */}
      <h2 className="mb-2 text-lg font-semibold">Loaded Road Sensors</h2>
      <ul className="space-y-2 mb-8">
        {roadSensors.map((s) => (
          <li key={s.sensor_id} className="rounded-lg border p-3 font-mono text-sm">
            {s.latitude.toFixed(5)}, {s.longitude.toFixed(5)}
            {s.road_name && <span className="text-gray-500"> — {s.road_name}</span>}
            {s.intersection_type && <span className="text-gray-400 text-xs"> ({s.intersection_type})</span>}
          </li>
        ))}
        {roadSensors.length === 0 && (
          <li className="text-gray-400">No road sensors loaded yet.</li>
        )}
      </ul>

      {/* Route turning points */}
      <div className="flex items-center justify-between">
        <h2 className="mb-2 text-lg font-semibold">
          Route Turning Points
          {turnPoints.length > 0 && (
            <span className="ml-2 text-sm font-normal text-orange-500">
              ({turnPoints.length} points)
            </span>
          )}
        </h2>
        {turnPoints.length > 0 && (
          <button
            onClick={() => setTurnPoints([])}
            className="text-sm text-red-500 hover:underline"
          >
            Clear
          </button>
        )}
      </div>

      <ul className="space-y-2">
        {turnPoints.map((t) => (
          <li key={t.sequence} className="rounded-lg border border-orange-200 bg-orange-50 p-3 font-mono text-sm flex items-center justify-between">
            <span>
              <span className="inline-block w-2 h-2 rounded-full bg-orange-500 mr-2"></span>
              {t.lat.toFixed(5)}, {t.lon.toFixed(5)}
            </span>
            <span className="text-xs text-gray-500">#{t.sequence}</span>
          </li>
        ))}
        {turnPoints.length === 0 && (
          <li className="text-gray-400">No route turning points yet. Compute a route first.</li>
        )}
      </ul>
    </div>
  );
}
