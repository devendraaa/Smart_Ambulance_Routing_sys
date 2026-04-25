import { useState, useEffect, useCallback } from "react";
import { getTaskStatus } from "@/lib/api";

const POLL_INTERVAL = 1000;

export function useRouteTask(taskId: string | null) {
  const [status, setStatus] = useState<{
    task_id: string;
    status: "pending" | "running" | "completed" | "failed";
    progress: number;
    processed_nodes: number;
    total_nodes: number;
    distance_km?: number;
    duration_min?: number;
    error?: string;
    result?: Record<string, unknown>;
    map_url?: string;
  } | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!taskId) return;
    try {
      const data = await getTaskStatus(taskId);
      setStatus(data);
    } catch {
      setStatus(null);
    }
  }, [taskId]);

  useEffect(() => {
    if (!taskId) return;
    fetchStatus();
    const interval = setInterval(fetchStatus, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [taskId, fetchStatus]);

  return status;
}
