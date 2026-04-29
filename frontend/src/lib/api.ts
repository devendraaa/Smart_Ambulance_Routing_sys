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
