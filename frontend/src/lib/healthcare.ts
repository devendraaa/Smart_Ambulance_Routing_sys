const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

async function fetchAPI<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${API_URL}${path}`;
  const res = await fetch(url, {
    method: init?.method || "GET",
    headers: { "Content-Type": "application/json", ...init?.headers },
    body: init?.body,
    mode: "cors",
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status}: ${body}`);
  }
  return res.json();
}

// --- Prescriptions ---
export interface Prescription {
  id: string;
  patient_email: string;
  appointment_id?: string;
  doctor_name?: string;
  symptoms?: string;
  diagnosis?: string;
  medicines?: string; // JSON string
  treatment?: string;
  notes?: string;
  suggested_tests?: string;
  created_at: string;
}

export async function createPrescription(data: {
  patient_email: string;
  appointment_id?: string;
  doctor_name?: string;
  symptoms?: string;
  diagnosis?: string;
  medicines?: string;
  treatment?: string;
  notes?: string;
  suggested_tests?: string;
}) {
  return fetchAPI<{ id: string; message: string }>("/api/healthcare/prescriptions", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getPrescriptions(patientEmail: string) {
  return fetchAPI<{ prescriptions: Prescription[] }>(`/api/healthcare/prescriptions/${encodeURIComponent(patientEmail)}`);
}

export async function updatePrescription(prescriptionId: string, data: Partial<Prescription>) {
  return fetchAPI<{ message: string; id: string }>(`/api/healthcare/prescriptions/${prescriptionId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

// --- Tests ---
export interface TestBooking {
  id: string;
  patient_email: string;
  test_type: string;
  appointment_id?: string;
  appointment_slot?: string;
  status: string;
  payment_status: string;
  payment_amount?: number;
  payment_reference?: string;
  report_url?: string;
  notes?: string;
  created_at: string;
}

export const TEST_TYPES = [
  { value: "MRI", label: "MRI", fee: 2500 },
  { value: "CT Scan", label: "CT Scan", fee: 2000 },
  { value: "Sonography", label: "Sonography", fee: 800 },
  { value: "Blood Test", label: "Blood Test", fee: 300 },
  { value: "X-Ray", label: "X-Ray", fee: 500 },
  { value: "ECG", label: "ECG", fee: 400 },
];

export async function bookTest(data: {
  patient_email: string;
  test_type: string;
  appointment_id?: string;
  appointment_slot?: string;
  payment_amount?: number;
}) {
  return fetchAPI<{ id: string; message: string }>("/api/healthcare/tests", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getPatientTests(patientEmail: string, patientName?: string) {
  let url = `/api/healthcare/tests/${encodeURIComponent(patientEmail)}`;
  if (patientName) {
    url += `?patient_name=${encodeURIComponent(patientName)}`;
  }
  return fetchAPI<{ tests: TestBooking[] }>(url);
}

export async function confirmTestPayment(testId: string, paymentReference: string = "") {
  return fetchAPI<{ message: string; id: string }>(`/api/healthcare/tests/${testId}/pay`, {
    method: "POST",
    body: JSON.stringify({ payment_reference: paymentReference }),
  });
}

export async function uploadTestReport(testId: string, reportUrl: string) {
  return fetchAPI<{ message: string; id: string }>(`/api/healthcare/tests/${testId}/report`, {
    method: "PUT",
    body: JSON.stringify({ report_url: reportUrl }),
  });
}

export async function uploadTestReportFile(testId: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const url = `${API_URL}/api/healthcare/tests/${testId}/upload-file`;
  const res = await fetch(url, { method: "POST", body: formData });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Upload failed: ${res.status} - ${body}`);
  }
  return res.json() as Promise<{ message: string; report_url: string; id: string }>;
}

// --- AI Symptom Checker ---
export interface AIMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AISessionResponse {
  session_id: string;
  department_hint: string;
  recommended_tests: string[];
}

export async function createAISession(patientEmail: string, messages: AIMessage[], symptoms: string) {
  return fetchAPI<AISessionResponse>("/api/healthcare/ai/session", {
    method: "POST",
    body: JSON.stringify({ patient_email: patientEmail, messages, symptoms }),
  });
}

// --- Doctors ---
export interface Doctor {
  id: string;
  name: string;
  specialty: string;
  qualification?: string;
  experience_years?: number;
  department: string;
  consultation_fee?: number;
  languages?: string;
  rating?: number;
  total_reviews?: number;
  image_url?: string;
  is_available: boolean;
}

export async function getDoctors(specialty?: string) {
  const url = specialty ? `/api/healthcare/doctors?specialty=${encodeURIComponent(specialty)}` : "/api/healthcare/doctors";
  return fetchAPI<{ doctors: Doctor[] }>(url);
}

export async function getDoctor(doctorId: string) {
  return fetchAPI<{ doctor: Doctor }>(`/api/healthcare/doctors/${doctorId}`);
}

// --- Video Consultations ---
export interface VideoConsultation {
  id: string;
  patient_email: string;
  doctor_id: string;
  appointment_date: string;
  status: string;
  meeting_link?: string;
  notes?: string;
  consultation_fee?: number;
  payment_status: string;
  doctors?: Doctor;
}

export async function bookVideoConsultation(data: {
  patient_email: string;
  doctor_id: string;
  appointment_date: string;
  notes?: string;
  consultation_fee?: number;
}) {
  return fetchAPI<{ id: string; message: string }>("/api/healthcare/video-consultations", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getVideoConsultations(patientEmail: string) {
  return fetchAPI<{ consultations: VideoConsultation[] }>(`/api/healthcare/video-consultations/${encodeURIComponent(patientEmail)}`);
}

// --- Medicines ---
export interface Medicine {
  id: string;
  patient_email: string;
  patient_name?: string;
  hospital_name?: string;
  prescription_id?: string;
  medicine_name: string;
  dosage?: string;
  frequency?: string;
  timing?: string;
  duration?: string;
  instructions?: string;
  is_active: boolean;
  start_date?: string;
  end_date?: string;
  created_at: string;
  medicine_collected?: boolean;
  collected_at?: string;
}

export async function addMedicine(data: {
  patient_email: string;
  prescription_id?: string;
  medicine_name: string;
  dosage?: string;
  frequency?: string;
  timing?: string;
  duration?: string;
  instructions?: string;
  start_date?: string;
  end_date?: string;
}) {
  return fetchAPI<{ id: string; message: string }>("/api/healthcare/medicines", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getPatientMedicines(patientEmail: string, activeOnly = true, patientName?: string) {
  let url = `/api/healthcare/medicines/${encodeURIComponent(patientEmail)}${activeOnly ? "?active_only=true" : "?active_only=false"}`;
  if (patientName) {
    url += `&patient_name=${encodeURIComponent(patientName)}`;
  }
  return fetchAPI<{ medicines: Medicine[] }>(url);
}

export async function updateMedicine(medicineId: string, isActive?: boolean) {
  return fetchAPI<{ message: string; id: string }>(`/api/healthcare/medicines/${medicineId}`, {
    method: "PUT",
    body: JSON.stringify({ is_active: isActive }),
  });
}

// --- Diet Plans ---
export interface Diet {
  id: string;
  patient_email: string;
  diet_name: string;
  diet_type?: string;
  calories?: string;
  timing?: string;
  foods?: string;
  instructions?: string;
  is_active: boolean;
  created_at: string;
}

export async function addDiet(data: {
  patient_email: string;
  diet_name: string;
  diet_type?: string;
  calories?: string;
  timing?: string;
  foods?: string;
  instructions?: string;
}) {
  return fetchAPI<{ id: string; message: string }>("/api/healthcare/diets", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getPatientDiets(patientEmail: string, activeOnly = true) {
  const url = `/api/healthcare/diets/${encodeURIComponent(patientEmail)}${activeOnly ? "?active_only=true" : "?active_only=false"}`;
  return fetchAPI<{ diets: Diet[] }>(url);
}

export async function updateDiet(dietId: string, isActive?: boolean) {
  return fetchAPI<{ message: string; id: string }>(`/api/healthcare/diets/${dietId}`, {
    method: "PUT",
    body: JSON.stringify({ is_active: isActive }),
  });
}
