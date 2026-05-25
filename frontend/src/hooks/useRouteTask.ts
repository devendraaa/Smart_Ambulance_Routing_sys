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
    patient_uhid?: string;
    patient_name?: string;
    patient_age?: string;
    patient_sex?: string;
    patient_mobile?: string;
    patient_case?: string;
    patient_blood_group?: string;
    patient_date?: string;
    // Physiological vitals
    patient_bp_systolic?: number;
    patient_bp_diastolic?: number;
    patient_temperature?: number;
    patient_pulse?: number;
    patient_spo2?: number;
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
