const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export interface DispatchCase {
  task_id: string;
  status: string;
  dispatch_status: string;
  progress: number;
  patient_uhid?: string;
  patient_name?: string;
  patient_age?: string;
  patient_sex?: string;
  patient_mobile?: string;
  patient_case?: string;
  patient_blood_group?: string;
  patient_date?: string;
  hospital_name: string;
  origin_lat: number;
  origin_lon: number;
  hospital_lat?: number;
  hospital_lon?: number;
  ambulance_number?: string;
  driver_name?: string;
  driver_mobile?: string;
  patient_bp_systolic?: number;
  patient_bp_diastolic?: number;
  patient_temperature?: number;
  patient_pulse?: number;
  patient_spo2?: number;
  distance_km?: number;
  duration_min?: number;
  created_at: string;
  current_lat?: number;
  current_lon?: number;
  last_location_update?: string;
}

export interface DispatchStats {
  [status: string]: number;
}

export async function fetchActiveCases(): Promise<{ cases: DispatchCase[]; count: number }> {
  const res = await fetch(`${API_URL}/api/route/dispatch/active`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch active cases: ${res.status}`);
  return res.json();
}

export async function fetchDispatchStats(): Promise<{ stats: DispatchStats }> {
  const res = await fetch(`${API_URL}/api/route/dispatch/stats`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch dispatch stats: ${res.status}`);
  return res.json();
}

export async function assignAmbulance(
  taskId: string,
  data: { ambulance_number: string; driver_name: string; driver_mobile: string }
) {
  const res = await fetch(`${API_URL}/api/route/dispatch/${taskId}/assign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to assign ambulance: ${res.status}`);
  return res.json();
}

export async function updateTaskStatus(taskId: string, status: string) {
  const res = await fetch(`${API_URL}/api/route/dispatch/${taskId}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(`Failed to update status: ${res.status}`);
  return res.json();
}
