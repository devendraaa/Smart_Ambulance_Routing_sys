"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Search, User, Calendar, Pill, FileText, Loader2, Plus, X, Check,
  Stethoscope, Activity, Thermometer, Heart, Wind, AlertTriangle,
  Clock, Phone, Droplet, MapPin, Bed, Building2, ChevronRight,
  Bot, ClipboardList, Ambulance, TestTube, ArrowRight, AlertCircle,
  HeartPulse, History, Hospital
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { fetchAdmittedPatients, fetchHospitalsList } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const SIDEBAR_ITEMS = [
  { id: "patient-info", label: "Patient Info", icon: User },
  { id: "emergency", label: "Emergency", icon: Ambulance },
  { id: "diagnosis", label: "Diagnosis", icon: Stethoscope },
  { id: "treatment-timeline", label: "Treatment Timeline", icon: Clock },
  { id: "opd", label: "OPD", icon: Calendar },
  { id: "follow-up", label: "Follow-up", icon: History },
  { id: "doctor-notes", label: "Doctor Notes", icon: ClipboardList },
  { id: "all-tests", label: "All Tests", icon: TestTube },
  { id: "medicine", label: "Medicine", icon: Pill },
  { id: "hospital-transfer", label: "Hospital Transfer", icon: ArrowRight },
  { id: "doctor-assign", label: "Doctor/Nurse Assign", icon: User },
  { id: "ward-assign", label: "Ward Assign", icon: Bed },
  { id: "ai-insight", label: "AI Insight", icon: Bot },
];

const MEDICINE_FREQUENCIES = ["Once daily", "Twice daily", "Thrice daily", "Four times a day", "Every 8 hours", "As needed"];
const MEDICINE_TIMINGS = ["Morning", "Afternoon", "Evening", "Night", "Before food", "After food", "With food"];
const MEDICINE_DURATIONS = ["3 days", "5 days", "7 days", "10 days", "14 days", "21 days", "30 days"];

type PatientData = {
  email: string;
  task_id?: string;
  patient_name?: string;
  patient_age?: string;
  patient_sex?: string;
  patient_mobile?: string;
  patient_blood_group?: string;
  patient_case?: string;
  patient_bp_systolic?: number;
  patient_bp_diastolic?: number;
  patient_temperature?: number;
  patient_pulse?: number;
  patient_spo2?: number;
  ambulance_number?: string;
  driver_name?: string;
  distance_km?: number;
  duration_min?: number;
  triage_level?: string;
  ward_name?: string;
  consultant_name?: string;
  discharge_status?: string;
  admitted_at?: string;
  hospital_name?: string;
};

export default function DoctorPatientInfo() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState<"email" | "name">("email");
  const [loading, setLoading] = useState(false);
  const [patient, setPatient] = useState<PatientData | null>(null);
  const [searchResults, setSearchResults] = useState<PatientData[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [activeSidebar, setActiveSidebar] = useState("patient-info");
  const [todayPatients, setTodayPatients] = useState<any[]>([]);
  const [loadingToday, setLoadingToday] = useState(true);
  const [hospitals, setHospitals] = useState<{ id: string; name: string }[]>([]);
  const [selectedHospital, setSelectedHospital] = useState("");

  // Data states
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [medicines, setMedicines] = useState<any[]>([]);
  const [tests, setTests] = useState<any[]>([]);
  const [doctorNotes, setDoctorNotes] = useState<any[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [currentAppointmentId, setCurrentAppointmentId] = useState<string | null>(null);

  // Doctor note form
  const [noteText, setNoteText] = useState("");
  const [noteType, setNoteType] = useState("clinical");
  const [savingNote, setSavingNote] = useState(false);

  // Medicine form
  const [showMedicineForm, setShowMedicineForm] = useState(false);
  const [medicineForm, setMedicineForm] = useState({ medicine_name: "", dosage: "", frequency: "", timing: "", duration: "" });
  const [savingMedicine, setSavingMedicine] = useState(false);

  // Test form
  const [showTestForm, setShowTestForm] = useState(false);
  const [testForm, setTestForm] = useState({ test_type: "" });
  const [savingTest, setSavingTest] = useState(false);

  const triageColor = patient?.triage_level === "red" ? "bg-red-500" :
    patient?.triage_level === "yellow" ? "bg-amber-500" :
    patient?.triage_level === "green" ? "bg-emerald-500" : "bg-gray-300";

  // Auto-load today's admitted patients and hospitals list
  useEffect(() => {
    (async () => {
      try {
        const hResult = await fetchHospitalsList();
        if (hResult?.hospitals) {
          setHospitals(hResult.hospitals.map((h: any) => ({ id: String(h.id), name: h.name })));
        }
      } catch { /* ignore */ }
    })();
  }, []);

  // Fetch patients whenever selected hospital changes
  useEffect(() => {
    (async () => {
      setLoadingToday(true);
      try {
        const result = await fetchAdmittedPatients(selectedHospital || undefined);
        if (result?.patients) {
          setTodayPatients(result.patients);
        }
      } catch (err) {
        console.error("Failed to load today's patients:", err);
      } finally {
        setLoadingToday(false);
      }
    })();
  }, [selectedHospital]);

  const selectPatientByTaskId = useCallback(async (taskId: string) => {
    setLoadingData(true);
    try {
      const { data: routeData } = await supabase
        .from("route_tasks")
        .select("id, patient_name, patient_age, patient_sex, patient_mobile, patient_blood_group, patient_case, patient_bp_systolic, patient_bp_diastolic, patient_temperature, patient_pulse, patient_spo2, ambulance_number, driver_name, triage_level, ward_name, discharge_status, admitted_at, hospital_name")
        .eq("id", taskId)
        .maybeSingle();

      if (!routeData) {
        setLoadingData(false);
        return;
      }

      const email = routeData.patient_mobile || taskId;
      const patientData: PatientData = {
        email,
        task_id: routeData.id,
        patient_name: routeData.patient_name,
        patient_age: routeData.patient_age,
        patient_sex: routeData.patient_sex,
        patient_mobile: routeData.patient_mobile,
        patient_blood_group: routeData.patient_blood_group,
        patient_case: routeData.patient_case,
        patient_bp_systolic: routeData.patient_bp_systolic,
        patient_bp_diastolic: routeData.patient_bp_diastolic,
        patient_temperature: routeData.patient_temperature,
        patient_pulse: routeData.patient_pulse,
        patient_spo2: routeData.patient_spo2,
        ambulance_number: routeData.ambulance_number,
        driver_name: routeData.driver_name,
        triage_level: routeData.triage_level,
        ward_name: routeData.ward_name,
        discharge_status: routeData.discharge_status,
        admitted_at: routeData.admitted_at,
        hospital_name: routeData.hospital_name,
      };

      // Fetch appointments
      const { data: aptData } = await supabase
        .from("patient_appointments")
        .select("*")
        .eq("patient_email", email)
        .order("created_at", { ascending: false });
      setAppointments(aptData || []);
      if (!patientData.patient_name && aptData?.length) {
        patientData.patient_name = aptData[0].patient_name;
      }

      // Use the most recent appointment to scope encounter-specific data
      const aptId = aptData?.[0]?.id || null;
      setCurrentAppointmentId(aptId);

      // Fetch prescriptions (scoped to appointment if available)
      let prescQuery = supabase
        .from("doctor_prescriptions")
        .select("*")
        .eq("patient_email", email)
        .order("created_at", { ascending: false })
        .limit(20);
      if (aptId) prescQuery = prescQuery.eq("appointment_id", aptId);
      const { data: prescData } = await prescQuery;
      setPrescriptions(prescData || []);

      // Fetch medicines (scoped to appointment if available)
      let medQuery = supabase
        .from("patient_medicines")
        .select("*")
        .eq("patient_email", email)
        .order("created_at", { ascending: false });
      if (aptId) medQuery = medQuery.eq("appointment_id", aptId);
      const { data: medData } = await medQuery;
      setMedicines(medData || []);

      // Fetch tests (scoped to appointment if available)
      let testQuery = supabase
        .from("patient_tests")
        .select("*")
        .eq("patient_email", email)
        .order("created_at", { ascending: false });
      if (aptId) testQuery = testQuery.eq("appointment_id", aptId);
      const { data: testData } = await testQuery;
      setTests(testData || []);

      // Fetch doctor notes from API
      try {
        const notesResp = await fetch(`${API_URL}/api/healthcare/doctor-notes/${taskId}`);
        if (notesResp.ok) {
          const notesJson = await notesResp.json();
          setDoctorNotes(notesJson.notes || []);
        }
      } catch { /* ignore */}

      setPatient(patientData);
      setActiveSidebar("patient-info");
    } catch (err) {
      console.error("Error loading patient:", err);
    } finally {
      setLoadingData(false);
    }
  }, []);

  const searchPatient = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setShowResults(true);
    try {
      if (searchType === "email") {
        const { data: aptData } = await supabase
          .from("patient_appointments")
          .select("*")
          .eq("patient_email", searchQuery.trim())
          .limit(20);
        if (aptData && aptData.length > 0) {
          const mapped = aptData.map((a: any) => ({ email: a.patient_email, patient_name: a.patient_name }));
          setSearchResults(mapped);
          return;
        }
      } else {
        const { data: aptData } = await supabase
          .from("patient_appointments")
          .select("*")
          .ilike("patient_name", `%${searchQuery.trim()}%`)
          .limit(20);
        if (aptData && aptData.length > 0) {
          const mapped = aptData.map((a: any) => ({ email: a.patient_email, patient_name: a.patient_name }));
          setSearchResults(mapped);
          return;
        }
      }
      setSearchResults([]);
    } catch (err) {
      console.error("Search error:", err);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, searchType]);

  const selectPatient = useCallback(async (email: string) => {
    setShowResults(false);
    setLoadingData(true);
    try {
      let patientData: PatientData = { email };

      // Fetch from route_tasks
      const { data: routeData } = await supabase
        .from("route_tasks")
        .select("patient_name, patient_age, patient_sex, patient_mobile, patient_blood_group, patient_case, patient_bp_systolic, patient_bp_diastolic, patient_temperature, patient_pulse, patient_spo2, ambulance_number, driver_name, triage_level, ward_name, discharge_status, admitted_at, hospital_name")
        .eq("patient_mobile", email)
        .or(`patient_name.ilike.%${email.split("@")[0]}%`)
        .limit(1)
        .maybeSingle();

      if (routeData) {
        patientData = { ...patientData, ...routeData };
      }

      // Fetch from patient_appointments
      const { data: aptData } = await supabase
        .from("patient_appointments")
        .select("*")
        .eq("patient_email", email)
        .order("created_at", { ascending: false });
      setAppointments(aptData || []);

      // Fetch patient name from appointments if not found in route_tasks
      if (!patientData.patient_name && aptData && aptData.length > 0) {
        patientData.patient_name = aptData[0].patient_name;
      }

      // Use the most recent appointment to scope encounter-specific data
      const aptId = aptData?.[0]?.id || null;
      setCurrentAppointmentId(aptId);

      // Fetch prescriptions (scoped to appointment if available)
      let prescQuery = supabase
        .from("doctor_prescriptions")
        .select("*")
        .eq("patient_email", email)
        .order("created_at", { ascending: false })
        .limit(20);
      if (aptId) prescQuery = prescQuery.eq("appointment_id", aptId);
      const { data: prescData } = await prescQuery;
      setPrescriptions(prescData || []);

      // Fetch medicines (scoped to appointment if available)
      let medQuery = supabase
        .from("patient_medicines")
        .select("*")
        .eq("patient_email", email)
        .order("created_at", { ascending: false });
      if (aptId) medQuery = medQuery.eq("appointment_id", aptId);
      const { data: medData } = await medQuery;
      setMedicines(medData || []);

      // Fetch tests (scoped to appointment if available)
      let testQuery = supabase
        .from("patient_tests")
        .select("*")
        .eq("patient_email", email)
        .order("created_at", { ascending: false });
      if (aptId) testQuery = testQuery.eq("appointment_id", aptId);
      const { data: testData } = await testQuery;
      setTests(testData || []);

      // Fetch doctor notes from API
      try {
        const { data: taskData } = await supabase
          .from("route_tasks")
          .select("id")
          .eq("patient_mobile", email)
          .limit(1)
          .maybeSingle();
        if (taskData?.id) {
          const notesResp = await fetch(`${API_URL}/api/healthcare/doctor-notes/${taskData.id}`);
          if (notesResp.ok) {
            const notesJson = await notesResp.json();
            setDoctorNotes(notesJson.notes || []);
          }
        }
      } catch { /* ignore */}

      // Set triage level from route_tasks or calculate
      if (!patientData.triage_level && routeData) {
        const bpSys = routeData.patient_bp_systolic;
        const bpDia = routeData.patient_bp_diastolic;
        const temp = routeData.patient_temperature;
        const pulse = routeData.patient_pulse;
        const spo2 = routeData.patient_spo2;
        const c = routeData.patient_case;
        if (spo2 !== undefined && spo2 < 90) patientData.triage_level = "red";
        else if (bpSys !== undefined && (bpSys < 90 || bpSys > 180)) patientData.triage_level = "red";
        else if (c === "Heart Attack" || c === "Stroke") patientData.triage_level = "red";
        else if (spo2 !== undefined && spo2 < 95) patientData.triage_level = "yellow";
        else if (bpSys !== undefined && bpSys > 140) patientData.triage_level = "yellow";
        else if (temp !== undefined && temp > 38) patientData.triage_level = "yellow";
        else if (pulse !== undefined && (pulse > 100 || pulse < 60)) patientData.triage_level = "yellow";
        else if (c === "Accident" || c === "Burn") patientData.triage_level = "yellow";
        else patientData.triage_level = "green";
      }

      setPatient(patientData);
      setActiveSidebar("patient-info");
    } catch (err) {
      console.error("Error loading patient data:", err);
    } finally {
      setLoadingData(false);
    }
  }, []);

  const addNote = async () => {
    if (!noteText.trim() || !patient) return;
    setSavingNote(true);
    try {
      const resp = await fetch(`${API_URL}/api/healthcare/doctor-notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task_id: patient.task_id || patient.email,
          doctor_name: "Dr. Attending",
          note_type: noteType,
          note_text: noteText,
        }),
      });
      if (resp.ok) {
        const result = await resp.json();
        setDoctorNotes(prev => [{
          id: result.id,
          note_text: noteText,
          note_type: noteType,
          doctor_name: "Dr. Attending",
          created_at: new Date().toISOString(),
        }, ...prev]);
        setNoteText("");
      }
    } catch (err) {
      console.error("Error saving note:", err);
    } finally {
      setSavingNote(false);
    }
  };

  const addMedicine = async () => {
    if (!patient || !medicineForm.medicine_name) return;
    setSavingMedicine(true);
    try {
      const { error } = await supabase.from("patient_medicines").insert({
        patient_email: patient.email,
        appointment_id: currentAppointmentId,
        medicine_name: medicineForm.medicine_name,
        dosage: medicineForm.dosage,
        frequency: medicineForm.frequency,
        timing: medicineForm.timing,
        duration: medicineForm.duration,
        is_active: true,
      });
      if (error) throw error;
      setMedicineForm({ medicine_name: "", dosage: "", frequency: "", timing: "", duration: "" });
      setShowMedicineForm(false);
      let medQuery = supabase.from("patient_medicines").select("*").eq("patient_email", patient.email).order("created_at", { ascending: false });
      if (currentAppointmentId) medQuery = medQuery.eq("appointment_id", currentAppointmentId);
      const { data } = await medQuery;
      setMedicines(data || []);
    } catch (err) {
      console.error("Error adding medicine:", err);
    } finally {
      setSavingMedicine(false);
    }
  };

  const addTest = async () => {
    if (!patient || !testForm.test_type) return;
    setSavingTest(true);
    try {
      const { error } = await supabase.from("patient_tests").insert({
        patient_email: patient.email,
        appointment_id: currentAppointmentId,
        test_type: testForm.test_type,
        status: "pending",
        payment_status: "unpaid",
      });
      if (error) throw error;
      setTestForm({ test_type: "" });
      setShowTestForm(false);
      let testQuery = supabase.from("patient_tests").select("*").eq("patient_email", patient.email).order("created_at", { ascending: false });
      if (currentAppointmentId) testQuery = testQuery.eq("appointment_id", currentAppointmentId);
      const { data } = await testQuery;
      setTests(data || []);
    } catch (err) {
      console.error("Error adding test:", err);
    } finally {
      setSavingTest(false);
    }
  };

  const clearPatient = () => {
    setPatient(null);
    setSearchResults([]);
    setShowResults(false);
    setSearchQuery("");
    setPrescriptions([]);
    setAppointments([]);
    setMedicines([]);
    setTests([]);
    setDoctorNotes([]);
    setTransfers([]);
    setCurrentAppointmentId(null);
    setActiveSidebar("patient-info");
  };

  const renderSidebarIcon = (icon: any) => {
    const Icon = icon;
    return <Icon className="w-4 h-4" />;
  };

  const renderCenterContent = () => {
    if (!patient) return null;

    switch (activeSidebar) {
      case "patient-info":
        return (
          <div className="space-y-4">
            <h3 className="font-bold text-gray-900 text-lg">Patient Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <InfoCard label="Full Name" value={patient.patient_name} />
              <InfoCard label="Age" value={patient.patient_age} />
              <InfoCard label="Sex" value={patient.patient_sex} />
              <InfoCard label="Blood Group" value={patient.patient_blood_group} icon={<Droplet className="w-4 h-4 text-red-500" />} />
              <InfoCard label="Hospital" value={patient.hospital_name} icon={<Building2 className="w-4 h-4 text-blue-500" />} />
              <InfoCard label="Contact" value={patient.patient_mobile} />
              <InfoCard label="Case Type" value={patient.patient_case} />
              <InfoCard label="Discharge Status" value={patient.discharge_status || "—"} />
              {patient.admitted_at && (
                <InfoCard label="Admitted At" value={new Date(patient.admitted_at).toLocaleDateString("en-IN")} />
              )}
            </div>
          </div>
        );

      case "emergency":
        return (
          <div className="space-y-4">
            <h3 className="font-bold text-gray-900 text-lg">Emergency Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <InfoCard label="Case Type" value={patient.patient_case} />
              <InfoCard label="Ambulance" value={patient.ambulance_number} />
              <InfoCard label="Driver" value={patient.driver_name} />
              <InfoCard label="Distance" value={patient.distance_km ? `${patient.distance_km.toFixed(1)} km` : "—"} />
              <InfoCard label="Duration" value={patient.duration_min ? `${patient.duration_min.toFixed(0)} min` : "—"} />
            </div>
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <p className="text-sm font-semibold text-gray-700 mb-3">Vitals</p>
              <div className="grid grid-cols-4 gap-3">
                {patient.patient_bp_systolic && (
                  <VitalBox label="BP" value={`${patient.patient_bp_systolic}/${patient.patient_bp_diastolic || "—"}`} />
                )}
                {patient.patient_temperature && (
                  <VitalBox label="Temp" value={`${patient.patient_temperature}°`} />
                )}
                {patient.patient_pulse && (
                  <VitalBox label="Pulse" value={`${patient.patient_pulse}`} />
                )}
                {patient.patient_spo2 && (
                  <VitalBox label="SpO2" value={`${patient.patient_spo2}%`} />
                )}
              </div>
            </div>
          </div>
        );

      case "diagnosis":
        const diagnosisEntries = prescriptions.filter(p => p.diagnosis || p.ai_diagnosis);
        return (
          <div className="space-y-4">
            <h3 className="font-bold text-gray-900 text-lg">Diagnosis</h3>
            {diagnosisEntries.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No diagnosis records found</p>
            ) : (
              diagnosisEntries.map((p, i) => (
                <motion.div key={p.id || i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs text-gray-500">{new Date(p.created_at).toLocaleDateString("en-IN")}</span>
                    <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{p.doctor_name}</span>
                  </div>
                  <p className="text-sm font-semibold text-gray-800 mb-1">Chief Complaint</p>
                  <p className="text-sm text-gray-600 mb-3">{p.chief_complaint || p.symptoms || "—"}</p>
                  {p.diagnosis && (
                    <>
                      <p className="text-sm font-semibold text-gray-800 mb-1">Diagnosis</p>
                      <p className="text-sm text-gray-600">{p.diagnosis}</p>
                    </>
                  )}
                  {p.ai_diagnosis && (
                    <div className="mt-3 pt-3 border-t border-blue-100">
                      <p className="text-xs font-semibold text-blue-600 flex items-center gap-1">
                        <Bot className="w-3 h-3" /> AI Diagnosis
                      </p>
                      <p className="text-sm text-gray-600 mt-1">{p.ai_diagnosis}</p>
                    </div>
                  )}
                </motion.div>
              ))
            )}
          </div>
        );

      case "treatment-timeline":
        return (
          <div className="space-y-4">
            <h3 className="font-bold text-gray-900 text-lg">Treatment Timeline</h3>
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
              {prescriptions.length === 0 && doctorNotes.length === 0 ? (
                <p className="text-gray-400 text-center py-8 pl-10">No treatment records found</p>
              ) : (
                [...prescriptions.map((p: any) => ({ ...p, type: "prescription" as const })),
                 ...doctorNotes.map((n: any) => ({ ...n, type: "note" as const }))]
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .map((item, i) => (
                    <div key={i} className="relative pl-10 pb-6">
                      <div className={`absolute left-2.5 w-3 h-3 rounded-full border-2 border-white ${item.type === "prescription" ? "bg-blue-500" : "bg-amber-500"}`} />
                      <div className="bg-white rounded-xl border border-gray-200 p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{item.type}</span>
                          <span className="text-[10px] text-gray-400">{new Date(item.created_at).toLocaleString("en-IN")}</span>
                        </div>
                        {item.type === "prescription" ? (
                          <p className="text-sm text-gray-700">
                            <span className="font-medium">{item.doctor_name}</span>: {item.diagnosis || item.symptoms || "—"}
                          </p>
                        ) : (
                          <p className="text-sm text-gray-700">{item.note_text}</p>
                        )}
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        );

      case "opd":
        const currentHospital = (patient.hospital_name || "").trim().toLowerCase();
        const opdAppointments = appointments.filter(a =>
          a.case_type !== "Emergency" &&
          (a.hospital_name || "").trim().toLowerCase() === currentHospital
        );
        return (
          <div className="space-y-4">
            <h3 className="font-bold text-gray-900 text-lg">OPD Appointments</h3>
            {opdAppointments.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No OPD appointments found at {patient.hospital_name || "this hospital"}</p>
            ) : (
              opdAppointments.map((apt) => (
                <div key={apt.id} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-gray-900">{apt.hospital_name}</p>
                      <p className="text-sm text-gray-600">{apt.case_type}</p>
                      <p className="text-sm text-gray-500">{new Date(apt.appointment_date).toLocaleDateString("en-IN")}</p>
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      apt.status === "completed" ? "bg-green-100 text-green-700" :
                      apt.status === "scheduled" ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"
                    }`}>{apt.status}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        );

      case "follow-up":
        const prescriptionFollowUps = prescriptions.filter(p => p.follow_up_date);
        const scheduledAppointments = appointments.filter(a => a.status === "scheduled");
        const noFollowUps = prescriptionFollowUps.length === 0 && scheduledAppointments.length === 0;
        return (
          <div className="space-y-4">
            <h3 className="font-bold text-gray-900 text-lg">Follow-up Appointments</h3>
            {noFollowUps ? (
              <p className="text-gray-400 text-center py-8">No follow-ups found</p>
            ) : (
              <>
                {prescriptionFollowUps.map((p, i) => (
                  <div key={p.id || i} className="bg-white rounded-xl border border-emerald-200 p-4">
                    <div className="flex items-center gap-3">
                      <Calendar className="w-5 h-5 text-emerald-500" />
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">Follow-up from Prescription</p>
                        <p className="text-sm text-emerald-600 font-medium">{new Date(p.follow_up_date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", year: "numeric", month: "short", day: "numeric" })}</p>
                        <p className="text-xs text-gray-500 mt-1">{p.doctor_name && `Dr. ${p.doctor_name}${p.hospital_name ? ` | ${p.hospital_name}` : ""}`}</p>
                        {p.diagnosis && <p className="text-xs text-gray-400 mt-0.5">{p.diagnosis}</p>}
                      </div>
                    </div>
                  </div>
                ))}
                {scheduledAppointments.map((apt) => (
                  <div key={apt.id} className="bg-white rounded-xl border border-blue-200 p-4">
                    <div className="flex items-center gap-3">
                      <Calendar className="w-5 h-5 text-blue-500" />
                      <div>
                        <p className="font-semibold text-gray-900">{apt.hospital_name}</p>
                        <p className="text-sm text-gray-500">{apt.case_type}</p>
                        <p className="text-xs text-gray-400">{new Date(apt.appointment_date).toLocaleDateString("en-IN")}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        );

      case "doctor-notes":
        return (
          <div className="space-y-4">
            <h3 className="font-bold text-gray-900 text-lg">Doctor Notes</h3>
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <div className="flex gap-2 mb-3">
                <select value={noteType} onChange={(e) => setNoteType(e.target.value)}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white">
                  <option value="clinical">Clinical</option>
                  <option value="progress">Progress</option>
                  <option value="discharge">Discharge</option>
                  <option value="consultation">Consultation</option>
                </select>
              </div>
              <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)}
                placeholder="Add a clinical note..."
                rows={3} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none resize-none" />
              <button onClick={addNote} disabled={savingNote || !noteText.trim()}
                className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2">
                {savingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Add Note
              </button>
            </div>
            <div className="space-y-2">
              {doctorNotes.length === 0 ? (
                <p className="text-gray-400 text-center py-4">No notes yet</p>
              ) : (
                doctorNotes.map((note, i) => (
                  <div key={note.id || i} className="bg-white rounded-xl border border-gray-200 p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-semibold uppercase text-gray-500">{note.note_type}</span>
                      <span className="text-[10px] text-gray-400">{new Date(note.created_at).toLocaleString("en-IN")}</span>
                    </div>
                    <p className="text-sm text-gray-700">{note.note_text}</p>
                    <p className="text-[10px] text-gray-400 mt-1">— {note.doctor_name}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        );

      case "all-tests":
        return (
          <div className="space-y-4">
            <h3 className="font-bold text-gray-900 text-lg">All Tests</h3>
            {showTestForm ? (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                className="bg-purple-50 rounded-xl p-4 border border-purple-200">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-semibold text-gray-900">Order New Test</h4>
                  <button onClick={() => setShowTestForm(false)} className="p-1 hover:bg-purple-100 rounded-lg"><X className="w-4 h-4 text-gray-500" /></button>
                </div>
                <select value={testForm.test_type} onChange={(e) => setTestForm({ test_type: e.target.value })}
                  className="w-full rounded-lg border border-purple-200 px-3 py-2 text-sm bg-white mb-3">
                  <option value="">Select test type</option>
                  {["Blood Test", "Urine Test", "X-Ray", "MRI", "CT Scan", "ECG", "Sonography", "Echo Cardiography"].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <button onClick={addTest} disabled={savingTest || !testForm.test_type}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                  {savingTest ? "Saving..." : "Order Test"}
                </button>
              </motion.div>
            ) : (
              <button onClick={() => setShowTestForm(true)}
                className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-purple-400 hover:text-purple-600 transition flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" /> Order New Test
              </button>
            )}
            <div className="space-y-2">
              {tests.length === 0 ? (
                <p className="text-gray-400 text-center py-4">No tests ordered</p>
              ) : (
                tests.map((test) => (
                  <div key={test.id} className="bg-white rounded-xl border border-gray-200 p-3 flex justify-between items-start">
                    <div>
                      <p className="font-medium text-gray-900">{test.test_type}</p>
                      <p className="text-xs text-gray-500">{new Date(test.created_at).toLocaleDateString("en-IN")}</p>
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      test.status === "completed" ? "bg-green-100 text-green-700" :
                      test.status === "confirmed" ? "bg-blue-100 text-blue-700" : "bg-yellow-100 text-yellow-700"
                    }`}>{test.status}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        );

      case "medicine":
        return (
          <div className="space-y-4">
            <h3 className="font-bold text-gray-900 text-lg">Medicine</h3>
            {showMedicineForm ? (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-semibold text-gray-900">Add Prescription</h4>
                  <button onClick={() => setShowMedicineForm(false)} className="p-1 hover:bg-blue-100 rounded-lg"><X className="w-4 h-4 text-gray-500" /></button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Medicine *</label>
                    <input type="text" value={medicineForm.medicine_name}
                      onChange={(e) => setMedicineForm({ ...medicineForm, medicine_name: e.target.value })}
                      placeholder="Paracetamol" className="w-full rounded-lg border border-blue-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none bg-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Dosage</label>
                    <input type="text" value={medicineForm.dosage}
                      onChange={(e) => setMedicineForm({ ...medicineForm, dosage: e.target.value })}
                      placeholder="500mg" className="w-full rounded-lg border border-blue-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none bg-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Frequency</label>
                    <select value={medicineForm.frequency} onChange={(e) => setMedicineForm({ ...medicineForm, frequency: e.target.value })}
                      className="w-full rounded-lg border border-blue-200 px-3 py-2 text-sm bg-white">
                      <option value="">Select</option>
                      {MEDICINE_FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Timing</label>
                    <select value={medicineForm.timing} onChange={(e) => setMedicineForm({ ...medicineForm, timing: e.target.value })}
                      className="w-full rounded-lg border border-blue-200 px-3 py-2 text-sm bg-white">
                      <option value="">Select</option>
                      {MEDICINE_TIMINGS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Duration</label>
                    <select value={medicineForm.duration} onChange={(e) => setMedicineForm({ ...medicineForm, duration: e.target.value })}
                      className="w-full rounded-lg border border-blue-200 px-3 py-2 text-sm bg-white">
                      <option value="">Select</option>
                      {MEDICINE_DURATIONS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>
                <button onClick={addMedicine} disabled={savingMedicine || !medicineForm.medicine_name}
                  className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                  {savingMedicine ? "Saving..." : "Add Medicine"}
                </button>
              </motion.div>
            ) : (
              <button onClick={() => setShowMedicineForm(true)}
                className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-blue-400 hover:text-blue-600 transition flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" /> Add Medicine
              </button>
            )}
            <div className="space-y-2">
              {medicines.length === 0 ? (
                <p className="text-gray-400 text-center py-4">No medicines prescribed</p>
              ) : (
                medicines.map((med) => (
                  <div key={med.id} className="bg-white rounded-xl border border-gray-200 p-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-gray-900">{med.medicine_name}</p>
                        <p className="text-xs text-gray-600">{med.dosage && `${med.dosage}`}{med.frequency && ` | ${med.frequency}`}</p>
                        <p className="text-xs text-gray-500">{med.timing && `${med.timing}`}{med.duration && ` | ${med.duration}`}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${med.is_active ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}`}>
                        {med.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );

      case "hospital-transfer":
        return (
          <div className="space-y-4">
            <h3 className="font-bold text-gray-900 text-lg">Hospital Transfer</h3>
            <p className="text-sm text-gray-500">Transfer history will appear here</p>
            {transfers.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No transfers recorded</p>
            ) : (
              transfers.map((t, i) => (
                <div key={t.id || i} className="bg-white rounded-xl border border-gray-200 p-3">
                  <p className="text-sm font-medium">{t.from_ward} → {t.to_ward}</p>
                  <p className="text-xs text-gray-500">{t.reason}</p>
                </div>
              ))
            )}
          </div>
        );

      case "doctor-assign":
        return (
          <div className="space-y-4">
            <h3 className="font-bold text-gray-900 text-lg">Doctor / Nurse Assignment</h3>
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <p className="text-sm font-semibold text-gray-700 mb-3">Current Assignments</p>
              <InfoCard label="Consultant" value={patient.consultant_name} />
            </div>
          </div>
        );

      case "ward-assign":
        return (
          <div className="space-y-4">
            <h3 className="font-bold text-gray-900 text-lg">Ward Assignment</h3>
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <InfoCard label="Ward" value={patient.ward_name} />
            </div>
          </div>
        );

      case "ai-insight":
        return (
          <div className="space-y-4">
            <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
              <Bot className="w-5 h-5 text-blue-600" /> AI Insight
            </h3>
            {prescriptions.filter(p => p.ai_diagnosis || p.ai_disease_predictions).length === 0 ? (
              <div className="text-center py-12">
                <Bot className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No AI diagnosis data available</p>
              </div>
            ) : (
              prescriptions.filter(p => p.ai_diagnosis).map((p, i) => (
                <div key={i} className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-4">
                  <p className="text-sm font-semibold text-blue-800 mb-2">{p.ai_diagnosis}</p>
                  {p.ai_disease_predictions && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {JSON.parse(typeof p.ai_disease_predictions === "string" ? p.ai_disease_predictions : JSON.stringify(p.ai_disease_predictions))?.map((d: any, di: number) => (
                        <span key={di} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">{typeof d === "string" ? d : d.disease || d.name || JSON.stringify(d)}</span>
                      ))}
                    </div>
                  )}
                  {p.ai_suggested_tests && (
                    <div className="mt-2">
                      <p className="text-xs font-semibold text-gray-600 mb-1">Suggested Tests:</p>
                      <div className="flex flex-wrap gap-1">
                        {JSON.parse(typeof p.ai_suggested_tests === "string" ? p.ai_suggested_tests : JSON.stringify(p.ai_suggested_tests))?.map((t: string, ti: number) => (
                          <span key={ti} className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs">{t}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        );

      default:
        return <p className="text-gray-400 text-center py-8">Select a section</p>;
    }
  };

  if (!patient) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 sm:p-8 shadow-xl">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Find Patient</h2>
            <p className="text-blue-100 text-sm">Search by patient email or name</p>
          </div>
          <div className="max-w-2xl mx-auto">
            {/* Hospital Filter - Top */}
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="w-4 h-4 text-blue-200" />
                <h3 className="text-sm font-semibold text-blue-100">Filter by Hospital</h3>
              </div>
              <select
                value={selectedHospital}
                onChange={(e) => setSelectedHospital(e.target.value)}
                className="w-full rounded-xl border-2 border-white/30 bg-white/20 px-4 py-3 text-white text-sm"
                style={{ colorScheme: 'dark' }}
              >
                <option value="" style={{ color: '#1f2937' }}>All Hospitals</option>
                {hospitals.map((h) => (
                  <option key={h.id} value={h.name} style={{ color: '#1f2937' }}>{h.name}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <select value={searchType} onChange={(e) => setSearchType(e.target.value as "email" | "name")}
                className="rounded-xl border-2 border-white/30 bg-white/20 px-4 py-3 text-white text-sm"
                style={{ colorScheme: 'dark' }}>
                <option value="email" style={{ color: '#1f2937' }}>Search by Email</option>
                <option value="name" style={{ color: '#1f2937' }}>Search by Name</option>
              </select>
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={searchType === "email" ? "Enter patient email" : "Enter patient name"}
                className="flex-1 rounded-xl border-2 border-white/30 bg-white/20 px-4 py-3 text-white placeholder-white/70 text-sm"
                style={{ colorScheme: 'dark' }}
                onKeyDown={(e) => e.key === "Enter" && searchPatient()} />
              <button onClick={searchPatient} disabled={loading}
                className="px-8 py-3 bg-white text-blue-600 hover:bg-blue-50 rounded-xl font-semibold transition disabled:opacity-50 text-sm shadow-lg">
                {loading ? <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Searching...</span> : "Search"}
              </button>
            </div>

            {showResults && (
              <div className="mt-4 bg-white rounded-xl shadow-xl border border-gray-200 max-h-60 overflow-y-auto">
                {loading ? (
                  <div className="p-4 text-center text-gray-500"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
                ) : searchResults.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">No patients found</div>
                ) : (
                  searchResults.map((r, i) => (
                    <button key={i} onClick={() => selectPatient(r.email)}
                      className="w-full px-4 py-3 text-left hover:bg-blue-50 transition border-b border-gray-100 last:border-0 flex items-center gap-3">
                      <User className="w-5 h-5 text-blue-500 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{r.patient_name || "Unknown"}</p>
                        <p className="text-xs text-gray-500">{r.email}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}

            {/* Today's Admitted Patients */}
            <div className="mt-2">
              <div className="flex items-center gap-2 mb-3">
                <Hospital className="w-4 h-4 text-blue-200" />
                <h3 className="text-sm font-semibold text-blue-100">Today's Admitted Patients</h3>
                {selectedHospital && (
                  <span className="text-xs text-blue-200 bg-white/10 px-2 py-0.5 rounded-full truncate max-w-[200px]">
                    {selectedHospital}
                  </span>
                )}
              </div>
              {loadingToday ? (
                <div className="bg-white/10 rounded-xl p-4 text-center">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-200 mx-auto" />
                </div>
              ) : todayPatients.length === 0 ? (
                <div className="bg-white/10 rounded-xl p-4 text-center">
                  <p className="text-blue-200 text-sm">No patients admitted today</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {todayPatients.map((p) => (
                    <button key={p.id} onClick={() => selectPatientByTaskId(p.id)}
                      className="w-full bg-white/10 hover:bg-white/20 rounded-xl p-3 transition flex items-center gap-3 text-left">
                      <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-white truncate">{p.patient_name || "Unknown"}</p>
                        <p className="text-xs text-blue-200">{p.patient_case || "—"} {p.ward_name ? `• ${p.ward_name}` : ""}</p>
                      </div>
                      {p.triage_level && (
                        <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-bold text-white ${
                          p.triage_level === "red" ? "bg-red-500" : p.triage_level === "yellow" ? "bg-amber-500" : "bg-emerald-500"
                        }`}>{p.triage_level.toUpperCase()}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Patient Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-4 sm:p-5 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
              <User className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-white">{patient.patient_name || "Patient"}</h3>
                {patient.triage_level && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold text-white ${triageColor}`}>
                    {patient.triage_level.toUpperCase()}
                  </span>
                )}
              </div>
              <p className="text-blue-100 text-sm">{patient.email}</p>
            </div>
          </div>
          <button onClick={clearPatient}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg font-medium text-sm transition flex items-center gap-2 w-fit">
            <Search className="w-4 h-4" /> Search Another
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Sidebar */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm sticky top-20">
            <div className="p-3 bg-gray-50 border-b border-gray-200">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Navigation</p>
            </div>
            <nav className="p-2 space-y-0.5 max-h-[70vh] overflow-y-auto">
              {SIDEBAR_ITEMS.map(item => {
                const Icon = item.icon;
                return (
                  <button key={item.id} onClick={() => setActiveSidebar(item.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${
                      activeSidebar === item.id
                        ? "bg-blue-600 text-white shadow-md"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}>
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                    {activeSidebar === item.id && <ChevronRight className="w-3.5 h-3.5 ml-auto shrink-0" />}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Center Content */}
        <div className="lg:col-span-6">
          {loadingData ? (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
              <p className="text-sm text-gray-500 mt-2">Loading patient data...</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 shadow-sm min-h-[400px]">
              {renderCenterContent()}
            </div>
          )}
        </div>

        {/* Right Summary Panel */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm sticky top-20">
            <div className="p-3 bg-gradient-to-r from-blue-600 to-indigo-600">
              <p className="text-xs font-bold text-white/80 uppercase tracking-wide">Patient Summary</p>
            </div>
            <div className="p-4 space-y-3">
              {patient.triage_level && (
                <div className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${triageColor}`} />
                  <span className="text-xs font-bold uppercase">{patient.triage_level} Triage</span>
                </div>
              )}

              <div className="border-t border-gray-100 pt-3">
                <p className="text-[10px] font-semibold text-gray-500 uppercase mb-2">Current Symptoms</p>
                {prescriptions.length > 0 ? (
                  <p className="text-xs text-gray-700 line-clamp-3">{prescriptions[0]?.chief_complaint || prescriptions[0]?.symptoms || "—"}</p>
                ) : (
                  <p className="text-xs text-gray-400">No symptoms recorded</p>
                )}
              </div>

              <div className="border-t border-gray-100 pt-3">
                <p className="text-[10px] font-semibold text-gray-500 uppercase mb-2">Diagnosis</p>
                <p className="text-xs text-gray-700 line-clamp-2">{prescriptions[0]?.diagnosis || "—"}</p>
              </div>

              <div className="border-t border-gray-100 pt-3">
                <p className="text-[10px] font-semibold text-gray-500 uppercase mb-2">Hospital</p>
                <p className="text-xs text-gray-700">{patient.hospital_name || "—"}</p>
              </div>

              <div className="border-t border-gray-100 pt-3">
                <p className="text-[10px] font-semibold text-gray-500 uppercase mb-2">Doctor Assigned</p>
                <p className="text-xs text-gray-700">{patient.consultant_name || "Not assigned"}</p>
              </div>

              <div className="border-t border-gray-100 pt-3">
                <p className="text-[10px] font-semibold text-gray-500 uppercase mb-2">Ward</p>
                <p className="text-xs text-gray-700">{patient.ward_name || "Not assigned"}</p>
              </div>

              {(patient.patient_bp_systolic || patient.patient_temperature || patient.patient_pulse || patient.patient_spo2) && (
                <div className="border-t border-gray-100 pt-3">
                  <p className="text-[10px] font-semibold text-gray-500 uppercase mb-2">Vitals</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {patient.patient_bp_systolic && <SummaryVital label="BP" value={`${patient.patient_bp_systolic}/${patient.patient_bp_diastolic || ""}`} />}
                    {patient.patient_temperature && <SummaryVital label="Temp" value={`${patient.patient_temperature}°`} />}
                    {patient.patient_pulse && <SummaryVital label="Pulse" value={`${patient.patient_pulse}`} />}
                    {patient.patient_spo2 && <SummaryVital label="SpO2" value={`${patient.patient_spo2}%`} />}
                  </div>
                </div>
              )}

              <div className="border-t border-gray-100 pt-3">
                <p className="text-[10px] font-semibold text-gray-500 uppercase mb-2">Test Names</p>
                {tests.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {tests.slice(0, 3).map((t, i) => (
                      <span key={i} className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px]">{t.test_type}</span>
                    ))}
                    {tests.length > 3 && <span className="text-[10px] text-gray-400">+{tests.length - 3} more</span>}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">No tests</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ label, value, icon }: { label: string; value?: string | null; icon?: React.ReactNode }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1 flex items-center gap-1">
        {icon}{label}
      </p>
      <p className="text-sm font-medium text-gray-900">{value || "—"}</p>
    </div>
  );
}

function VitalBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-lg p-3 text-center border border-gray-200">
      <p className="text-[10px] font-semibold text-gray-500">{label}</p>
      <p className="text-sm font-bold text-gray-800">{value}</p>
    </div>
  );
}

function SummaryVital({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-2">
      <p className="text-[10px] text-gray-500">{label}</p>
      <p className="text-xs font-bold text-gray-800">{value}</p>
    </div>
  );
}
