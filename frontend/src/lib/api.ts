const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

async function fetchAPI<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${API_URL}${path}`;

  console.log("👉 API CALL:", url); // debug

  const res = await fetch(url, {
    method: init?.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
    body: init?.body,

    // ✅ IMPORTANT FIX
    mode: "cors",
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status}: ${body}`);
  }

  return res.json();
}
// --- Route tasks ---
export async function startRouteCompute(data: {
  origin_lat: number;
  origin_lon: number;
  hospital_name: string;
  hospital_lat?: number;
  hospital_lon?: number;
  patient_name?: string;
  patient_age?: string;
  patient_sex?: string;
  patient_mobile?: string;
  patient_case?: string;
  patient_blood_group?: string;
  patient_date?: string;
  ambulance_number?: string;
  driver_name?: string;
  driver_mobile?: string;
}) {
  return fetchAPI<{ task_id: string; status: string }>("/api/route/compute", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getTaskStatus(taskId: string) {
  return fetchAPI<{
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
  }>(`/api/route/${taskId}`);
}

export async function getTaskCoordinates(taskId: string) {
  return fetchAPI<{
    coordinates: { lat: number; lon: number; sequence: number }[];
  }>(`/api/route/${taskId}/coordinates`);
}

export async function getFullRoute(taskId: string) {
  return fetchAPI<{
    coordinates: { lat: number; lon: number; sequence: number }[];
    turn_points: { lat: number; lon: number; sequence: number }[];
  }>(`/api/route/${taskId}/full`);
}

export async function fetchTrafficSignals(taskId: string) {
  return fetchAPI<{
    signals: {
      lat: number;
      lon: number;
      signal_id: string;
      distance_km: number;
      road_name: string;
      junction: string;
    }[];
    count: number;
  }>(`/api/route/${taskId}/traffic-signals`);
}

export async function getTaskRoadSensors(taskId: string) {
  return fetchAPI<{
    road_sensors: {
      sensor_id: string;
      latitude: number;
      longitude: number;
      road_name: string;
      distance_km: number;
    }[];
    count: number;
  }>(`/api/route/${taskId}/road-sensors`);
}

export async function getTaskTurnPoints(taskId: string) {
  return fetchAPI<{
    turn_points: { lat: number; lon: number; sequence: number }[];
  }>(`/api/route/${taskId}/turns`);
}

// --- Hospitals list ---
export async function searchHospitals(q: string, limit = 10) {
  return fetchAPI<{
    name: string;
    display_name: string;
    latitude?: number;
    longitude?: number;
  }[]>(`/api/hospitals/search?q=${encodeURIComponent(q)}&limit=${limit}`);
}

export async function fetchHospitalsList(
  originLat?: number,
  originLon?: number
) {
  let url = "/api/hospitals/list";
  if (originLat != null && originLon != null) {
    url += `?origin_lat=${originLat}&origin_lon=${originLon}`;
  }
  return fetchAPI<{
    hospitals: {
      id: number;
      name: string;
      address: string;
      contact: string;
      lat: number;
      lon: number;
      total_beds: number;
      available_beds: number;
      emergency_beds: number;
      total_doctors_vacant: number;
      specialist: string;
      distance_km: number | null;
      estimated_time_min: number | null;
    }[];
    total: number;
  }>(url);
}

// --- Blood banks ---
export async function fetchBloodBanks(
  originLat?: number,
  originLon?: number
) {
  let url = "/api/blood-banks/";
  if (originLat != null && originLon != null) {
    url += `?origin_lat=${originLat}&origin_lon=${originLon}`;
  }
  return fetchAPI<{
    banks: {
      id: number;
      name: string;
      address: string;
      contact: string;
      lat: number;
      lon: number;
      blood_availability: { blood_type: string; available_liters: number }[];
      distance_km: number | null;
      estimated_time_min: number | null;
    }[];
    total: number;
    blood_types: string[];
  }>(url);
}
export async function loadRoadSensorsFull() {
  return fetchAPI<{ loaded: number; message: string }>(
    "/api/sensors/load-road-sensors-full",
    { method: "POST" }
  );
}

export async function loadRoadSensorsBbox(params: {
  south: number; north: number; west: number; east: number;
}) {
  return fetchAPI<{ loaded: number; message: string }>(
    `/api/sensors/load-road-sensors-bbox?south=${params.south}&north=${params.north}&west=${params.west}&east=${params.east}`,
    { method: "POST" }
  );
}

export async function getRoadSensorCount() {
  return fetchAPI<{ count: number }>("/api/sensors/location-count");
}

export async function findNearestRoadSensor(
  lat: number, lon: number, count = 1
) {
  return fetchAPI<
    { sensor_id: string; latitude: number; longitude: number; road_name: string; distance_km: number }[]
  >(`/api/sensors/nearest/${lat}/${lon}?count=${count}`);
}

export async function fetchRoadSensors() {
  return fetchAPI<
    { sensor_id: string; latitude: number; longitude: number; road_name?: string; intersection_type?: string }[]
  >("/api/sensors/road");
}

// --- Sensors (manual + CSV upload) ---
export async function addSensor(data: { latitude: number; longitude: number; degree?: number }) {
  return fetchAPI<{
    id: string;
    latitude: number;
    longitude: number;
    degree?: number;
  }>("/api/sensors/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function uploadSensorsCSV(csvText: string) {
  return fetchAPI<{ inserted: number; message: string }>("/api/sensors/upload-csv", {
    method: "POST",
    body: JSON.stringify({ csv_data: csvText }),
  });
}

export async function fetchManualSensors() {
  return fetchAPI<{
    id: string;
    latitude: number;
    longitude: number;
    degree?: number;
    created_at?: string;
  }[]>("/api/sensors/");
}

// --- Installed Sensors (separate table) ---
export async function fetchInstalledSensors() {
  return fetchAPI<{
    id: string;
    latitude: number;
    longitude: number;
    location_name?: string;
    degree?: number;
    created_at?: string;
  }[]>("/api/installed-sensors/");
}

export async function addInstalledSensor(data: { latitude: number; longitude: number; degree?: number }) {
  return fetchAPI<{
    id: string;
    latitude: number;
    longitude: number;
    degree?: number;
  }>("/api/installed-sensors/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteInstalledSensor(sensorId: string) {
  const res = await fetch(
    `${API_URL}/api/installed-sensors/${sensorId}`,
    { method: "DELETE", headers: { "Content-Type": "application/json" } }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Delete failed: ${body || res.statusText}`);
  }
}

export async function refreshSensorLocation(sensorId: string) {
  const res = await fetch(
    `${API_URL}/api/installed-sensors/${sensorId}/refresh-location`,
    { method: "POST", headers: { "Content-Type": "application/json" } }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Refresh failed: ${body || res.statusText}`);
  }
  return res.json();
}

export async function fetchSensorsNearRoute(taskId: string, thresholdKm: number = 0.002) {
  return fetchAPI<{
    sensors: {
      id: string;
      latitude: number;
      longitude: number;
      degree?: number;
      distance_km: number;
    }[];
    count: number;
  }>(`/api/sensors/near-route/${taskId}?threshold_km=${thresholdKm}`);
}

// --- Road Network API ---
export async function fetchRoadNetwork(
  south: number = 18.85,
  north: number = 19.32,
  west: number = 72.75,
  east: number = 73.02,
  limit: number = 100000
) {
  return fetchAPI<{
    type: string;
    features: Array<{
      type: string;
      properties: {
        sensor_id: string;
        road_name: string;
        intersection_type: string;
      };
      geometry: {
        type: string;
        coordinates: [number, number];
      };
    }>;
    count: number;
  }>(`/api/sensors/network?south=${south}&north=${north}&west=${west}&east=${east}&limit=${limit}`);
}

export async function extractFullRoadNetwork() {
  return fetchAPI<{
    message: string;
    note: string;
  }>("/api/sensors/extract-full-network", { method: "POST" });
}

// --- Reverse Geocoding (via backend proxy to Nominatim) ---
export async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const data = await fetchAPI<{ display_name: string }>(
      `/api/geocode/reverse?lat=${lat}&lon=${lon}`
    );
    return data.display_name || `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  } catch {
    return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  }
}

// --- MQTT Stop Sensor ---
export async function stopSensors() {
  return fetchAPI<{ status: string; topic: string }>("/api/mqtt/stop-sensors", {
    method: "POST",
  });
}

// --- Amb Location (publish nearest sensor to amb82mini) ---
export async function publishAmbLocation(data: {
  sensor_id: string;
  latitude: number;
  longitude: number;
  road_name?: string;
  distance_km?: number;
  topic?: string;
}) {
  return fetchAPI<{
    status: string;
    topic: string;
    sensor_id: string;
    lat: number;
    lng: number;
  }>("/api/mqtt/publish-amb-location", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// Emergency cases API
export type EmergencyCase = {
  task_id: string;
  hospital_name: string;
  origin_lat: number;
  origin_lon: number;
  patient_uhid?: string;
  patient_name?: string;
  patient_age?: string;
  patient_sex?: string;
  patient_mobile?: string;
  patient_case?: string;
  patient_blood_group?: string;
  patient_date?: string;
  status: string;
  created_at: string;
  distance_km?: number;
  duration_min?: number;
  ambulance_number?: string;
  driver_name?: string;
  driver_mobile?: string;
};

export async function fetchEmergencyCases(hospitalName?: string, startDate?: string, endDate?: string) {
  let url = "/api/route/emergency/cases?";
  const params = new URLSearchParams();
  if (hospitalName) params.append("hospital_name", hospitalName);
  if (startDate) params.append("start_date", startDate);
  if (endDate) params.append("end_date", endDate);
  url += params.toString();

  return fetchAPI<EmergencyCase[]>(url);
}

export async function fetchEmergencyHospitals() {
  return fetchAPI<{ hospitals: string[] }>("/api/route/emergency/hospitals");
}

export async function fetchHospitalInfo(hospitalName?: string, caseType?: string) {
  let url = "/api/hospital-info/";
  const params = new URLSearchParams();
  if (hospitalName) params.append("hospital_name", hospitalName);
  if (caseType) params.append("case_type", caseType);
  if (params.toString()) url += "?" + params.toString();
  return fetchAPI<HospitalInfo[]>(url);
}

export async function createHospitalInfo(data: Omit<HospitalInfo, "id" | "created_at" | "updated_at">) {
  return fetchAPI<HospitalInfo>("/api/hospital-info/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateHospitalInfo(id: string, data: Partial<HospitalInfo>) {
  return fetchAPI<HospitalInfo>(`/api/hospital-info/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteHospitalInfo(id: string) {
  return fetchAPI<{ message: string }>(`/api/hospital-info/${id}`, {
    method: "DELETE",
  });
}

export type HospitalInfo = {
  id: string;
  hospital_name: string;
  case_type: string;
  doctor_name: string;
  ward_no: string;
  floor_no: string;
  bed_no: string | null;
  created_at: string;
  updated_at: string;
};

// --- Patient Admission / Discharge / Notes / Transfers ---
export async function admitPatient(data: {
  task_id: string;
  triage_level: string;
  triage_notes?: string;
  ward_name?: string;
  consultant_name?: string;
}) {
  return fetchAPI<{ message: string; task_id: string; admitted_at: string }>("/api/healthcare/admit-patient", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function fetchAdmittedPatients(hospitalName?: string) {
  let url = "/api/healthcare/admitted-patients";
  if (hospitalName) url += `?hospital_name=${encodeURIComponent(hospitalName)}`;
  return fetchAPI<{ patients: EmergencyCase[] }>(url);
}

export async function fetchAllPatients(hospitalName?: string) {
  let url = "/api/healthcare/admitted-patients/all";
  if (hospitalName) url += `?hospital_name=${encodeURIComponent(hospitalName)}`;
  return fetchAPI<{ patients: EmergencyCase[] }>(url);
}

export async function dischargePatient(taskId: string) {
  return fetchAPI<{ message: string; task_id: string }>(`/api/healthcare/discharge-patient/${taskId}`, {
    method: "PUT",
  });
}

export type DoctorNote = {
  id: string;
  task_id: string;
  doctor_name: string;
  note_type: string;
  note_text: string;
  created_at: string;
};

export async function addDoctorNote(data: {
  task_id: string;
  doctor_name: string;
  note_type?: string;
  note_text: string;
}) {
  return fetchAPI<{ id: string; message: string }>("/api/healthcare/doctor-notes", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function fetchDoctorNotes(taskId: string) {
  return fetchAPI<{ notes: DoctorNote[] }>(`/api/healthcare/doctor-notes/${taskId}`);
}

export async function deleteDoctorNote(noteId: string) {
  return fetchAPI<{ message: string }>(`/api/healthcare/doctor-notes/${noteId}`, {
    method: "DELETE",
  });
}

export type PatientTransfer = {
  id: string;
  task_id: string;
  from_ward: string | null;
  from_bed: string | null;
  to_ward: string;
  to_bed: string | null;
  reason: string | null;
  transferred_by: string;
  transferred_at: string;
};

export async function createPatientTransfer(data: {
  task_id: string;
  to_ward: string;
  to_bed?: string;
  reason?: string;
  transferred_by: string;
}) {
  return fetchAPI<{ id: string; message: string }>("/api/healthcare/patient-transfers", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function fetchPatientTransfers(taskId: string) {
  return fetchAPI<{ transfers: PatientTransfer[] }>(`/api/healthcare/patient-transfers/${taskId}`);
}
