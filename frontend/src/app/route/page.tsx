"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useRouteTask } from "@/hooks/useRouteTask";
import TaskProgress from "@/components/TaskProgress";

export default function RoutePage() {
  const searchParams = useSearchParams();
  const taskId = searchParams.get("task");
  const router = useRouter();
  const status = useRouteTask(taskId);

  if (!taskId) {
    return (
      <div className="mx-auto max-w-2xl p-6 text-center">
        <p className="text-gray-600">No route task found.</p>
        <button
          onClick={() => router.push("/")}
          className="mt-4 text-blue-600 hover:underline"
        >
          Go back home
        </button>
      </div>
    );
  }

  if (!status) {
    return <div className="mx-auto max-w-2xl p-6 text-center text-gray-600">Loading...</div>;
  }

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-4">
      <h1 className="text-2xl font-bold">Route Computation</h1>

      <TaskProgress
        progress={status.progress}
        processed_nodes={status.processed_nodes}
        total_nodes={status.total_nodes}
        status={status.status}
        error={status.error}
        distance_km={status.distance_km}
        duration_min={status.duration_min}
      />

      {status.status === "completed" && status.map_url && (
        <div className="rounded-lg border p-4">
          <a
            href={status.map_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            View Route Map
          </a>
        </div>
      )}

      {status.status === "completed" && (
        <button
          onClick={() => router.push(`/map?task=${taskId}`)}
          className="w-full rounded-md bg-green-600 px-4 py-2 text-white transition hover:bg-green-700"
        >
          View Map
        </button>
      )}
    </div>
  );
}
