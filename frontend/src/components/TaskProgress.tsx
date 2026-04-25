"use client";

interface TaskProgressProps {
  progress: number;
  processed_nodes?: number;
  total_nodes?: number;
  status: string;
  error?: string;
  distance_km?: number;
  duration_min?: number;
}

export default function TaskProgress({
  progress,
  processed_nodes,
  total_nodes,
  status,
  error,
  distance_km,
  duration_min,
}: TaskProgressProps) {
  if (status === "completed") {
    return (
      <div className="space-y-3 rounded-lg border border-green-200 bg-green-50 p-4">
        <p className="font-medium text-green-800">Route computation complete!</p>
        <div className="grid grid-cols-2 gap-4 text-sm text-green-700">
          {distance_km != null && (
            <div>
              <span className="font-semibold text-green-900">Distance</span>
              <p>{distance_km.toFixed(2)} km</p>
            </div>
          )}
          {duration_min != null && (
            <div>
              <span className="font-semibold text-green-900">ETA</span>
              <p>{formatDuration(duration_min)}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
        Error: {error}
      </div>
    );
  }

  const pct = Math.round(progress * 100);
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm text-gray-600">
        <span>
          Processing route nodes: {processed_nodes ?? 0} / {total_nodes ?? 0}
        </span>
        <span>{pct}%</span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
        <div
          className="h-full rounded-full bg-blue-600 transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function formatDuration(minutes: number): string {
  if (minutes < 1) return `${Math.round(minutes * 60)} sec`;
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hrs > 0) return `${hrs} hr ${mins} min`;
  return `${mins} min`;
}
