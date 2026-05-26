"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Search, Filter, Pill, FileText, Utensils, X, Plus, Trash2, ChevronRight, User, Stethoscope, Clock, Loader2, Activity, ClipboardList, Printer, Edit3, CheckCircle2, Bot, FlaskConical, Brain, Sparkles, AlertTriangle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { fetchHospitalsList } from "@/lib/api";
import SymptomsAssessment from "./SymptomsAssessment";
import PrescriptionForm from "./PrescriptionForm";
import MedicineForm from "./MedicineForm";

const CASE_TYPES = [
  { value: "General OPD", label: "General OPD" },
  { value: "Child OPD", label: "Child OPD" },
  { value: "Heart & Emergency", label: "Heart & Emergency" },
  { value: "Accident & Trauma", label: "Accident & Trauma" },
  { value: "Neurology", label: "Neurology" },
  { value: "Diabetes & Kidney", label: "Diabetes & Kidney" },
  { value: "Women & Pregnancy", label: "Women & Pregnancy" },
  { value: "Orthopedic", label: "Orthopedic" },
  { value: "ENT / Eye", label: "ENT / Eye" },
  { value: "Mental Health", label: "Mental Health" },
  { value: "Senior Citizen", label: "Senior Citizen" },
];

interface Appointment {
  id: string;
  patient_name: string;
  patient_email: string;
  age: number;
  address: string;
  religion: string;
  appointment_date: string;
  case_type: string;
  hospital_name: string;
  status: string;
  created_at: string;
}

interface PatientMedicine {
  id: string;
  patient_email: string;
  patient_name?: string;
  medicine_name: string;
  dosage?: string;
  frequency?: string;
  timing?: string;
  duration?: string;
  instructions?: string;
  route?: string;
  is_prn?: boolean;
  quantity?: string;
  refills?: string;
  is_active: boolean;
  medicine_collected?: boolean;
  collected_at?: string;
  created_at: string;
  hospital_name?: string;
}

interface PatientTest {
  id: string;
  patient_email: string;
  patient_name?: string;
  test_type: string;
  status: string;
  report_url?: string;
  notes?: string;
  created_at: string;
  hospital_name?: string;
  appointment_id?: string;
}

interface PatientDiet {
  id: string;
  patient_email: string;
  diet_name: string;
  diet_type: string;
  calories: string;
  timing: string;
  foods: string;
  instructions: string;
  is_active: boolean;
  created_at: string;
}

const TEST_TYPES = ["MRI", "CT Scan", "Sonography", "Blood Test", "X-Ray", "ECG", "ECHO", "TMT", "Urine Test", "Stool Test", "Thyroid", "Sugar Test"];
const DIET_TYPES = ["Weight Loss", "Weight Gain", "Diabetic", "Heart", "Low Salt", "High Protein", "Vegetarian", "Liquid Diet", "Soft Diet", "General"];

function isToday(dateString: string): boolean {
  const appointmentDate = new Date(dateString);
  const today = new Date();
  return appointmentDate.toDateString() === today.toDateString();
}

interface Prescription {
  id: string;
  patient_email: string;
  patient_name?: string;
  doctor_name?: string;
  symptoms?: string;
  chief_complaint?: string;
  symptom_notes?: string;
  severity_level?: number;
  duration?: string;
  existing_diseases?: string;
  diagnosis?: string;
  emergency_indicators?: string[] | null;
  prescription_notes?: string;
  medicines?: string;
  follow_up_date?: string;
  hospital_name?: string;
  status?: string;
  bp_systolic?: number;
  bp_diastolic?: number;
  temperature?: number;
  pulse?: number;
  spo2?: number;
  created_at: string;
  ai_diagnosis?: string;
  ai_disease_predictions?: any;
  ai_suggested_tests?: any;
  ai_notes?: string;
  ai_processed?: boolean;
}

function PatientDetailPanel({
  appointment,
  onClose
}: {
  appointment: Appointment;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"symptoms" | "ai-diagnosis" | "prescriptions" | "medicines" | "reports" | "diet">("symptoms");
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [medicines, setMedicines] = useState<PatientMedicine[]>([]);
  const [tests, setTests] = useState<PatientTest[]>([]);
  const [diets, setDiets] = useState<PatientDiet[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddPrescription, setShowAddPrescription] = useState(false);
  const [editPrescriptionId, setEditPrescriptionId] = useState<string | null>(null);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [visitNote, setVisitNote] = useState("");
  const [aiPreFillData, setAiPreFillData] = useState<{ diagnosis: string; suggestedTests: string[] } | null>(null);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [aiDiagnosisData, setAiDiagnosisData] = useState<{
    ai_diagnosis: string;
    ai_disease_predictions: any[];
    ai_suggested_tests: string[];
    ai_notes?: string;
    prescription_id: string;
  } | null>(null);

  const isCurrentAppointment = isToday(appointment.appointment_date);
  const isCompleted = appointment.status === "completed";
  const isCancelled = appointment.status === "cancelled";
  const canEdit = isCurrentAppointment && !isCompleted && !isCancelled;

  useEffect(() => {
    loadPatientData();
  }, [appointment.id]);

  useEffect(() => {
    const storedPreFill = localStorage.getItem("aiPreFillData");
    const storedPatientEmail = localStorage.getItem("aiPrescriptionPatientEmail");
    if (storedPreFill && storedPatientEmail === appointment.patient_email) {
      try {
        const parsed = JSON.parse(storedPreFill);
        setAiPreFillData(parsed);
        setShowAddPrescription(true);
        setActiveTab("prescriptions");
      } catch (e) { /* ignore */ }
      localStorage.removeItem("aiPreFillData");
      localStorage.removeItem("aiPrescriptionId");
      localStorage.removeItem("aiPrescriptionPatientEmail");
      localStorage.removeItem("aiPrescriptionPatientName");
    }
  }, [appointment.id]);

  useEffect(() => {
    if (appointment.status === "scheduled" && isCurrentAppointment) {
      fetch(`http://127.0.0.1:8000/api/healthcare/appointments/${appointment.id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "in-consultation" })
      }).then(() => {
        appointment.status = "in-consultation";
      }).catch(console.error);
    }
  }, [appointment.id]);

  const loadPatientData = async (silent = false) => {
    if (!silent) setLoading(true);
    const appointmentId = appointment.id;
    try {
      const [prescData, medsData, testsData, dietsData] = await Promise.all([
        supabase.from("doctor_prescriptions").select("*").eq("patient_email", appointment.patient_email).order("created_at", { ascending: false }),
        supabase.from("patient_medicines").select("*").eq("appointment_id", appointmentId).order("created_at", { ascending: false }),
        supabase.from("patient_tests").select("*").eq("appointment_id", appointmentId).order("created_at", { ascending: false }),
        supabase.from("patient_diets").select("*").eq("appointment_id", appointmentId).order("created_at", { ascending: false })
      ]);
      setPrescriptions(prescData.data || []);
      setMedicines(medsData.data || []);
      setTests(testsData.data || []);
      setDiets(dietsData.data || []);
    } catch (err) {
      console.error("Error loading patient data:", err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const deletePrescription = async (id: string) => {
    if (!confirm("Delete this prescription?")) return;
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/healthcare/doctor/prescriptions/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      loadPatientData();
    } catch (err) {
      console.error("Error deleting prescription:", err);
      alert("Failed to delete prescription");
    }
  };

  const handleCompleteVisit = async () => {
    if (!confirmed) return;
    setCompleting(true);
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/healthcare/appointments/${appointment.id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" })
      });
      if (!res.ok) throw new Error("Failed to complete visit");

      for (const p of prescriptions) {
        if (p.status === "Active") {
          try {
            await fetch(`http://127.0.0.1:8000/api/healthcare/doctor/prescriptions/${p.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "Completed" })
            });
          } catch (e) { console.error("Failed to update prescription status:", e); }
        }
      }

      appointment.status = "completed";
      setShowCompleteModal(false);
      loadPatientData();
    } catch (err) {
      console.error("Error completing visit:", err);
      alert("Failed to complete visit");
    } finally {
      setCompleting(false);
    }
  };

  const printPrescription = (p: Prescription) => {
    const win = window.open("", "_blank");
    if (!win) return;
    let medsList: { name: string; dosage?: string; frequency?: string; timing?: string; duration?: string; route?: string; instructions?: string; is_prn?: boolean }[] = [];
    try { const parsed = JSON.parse(p.medicines || "[]"); medsList = Array.isArray(parsed) ? parsed : []; } catch {}
    win.document.write(`
      <html><head><title>Prescription</title>
      <style>
        body { font-family: 'Courier New', monospace; padding: 40px; max-width: 700px; margin: 0 auto; color: #222; }
        h1 { font-size: 18px; text-align: center; margin-bottom: 4px; }
        .sub { text-align: center; color: #666; font-size: 12px; margin-bottom: 24px; }
        .line { border-top: 2px solid #333; margin: 12px 0; }
        .row { display: flex; justify-content: space-between; font-size: 13px; margin: 4px 0; }
        .label { font-weight: bold; }
        table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 12px; }
        th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
        th { background: #f0f0f0; }
        .footer { margin-top: 32px; font-size: 11px; color: #888; text-align: center; border-top: 1px solid #ccc; padding-top: 12px; }
        .stamp { margin-top: 24px; font-size: 13px; }
        .stamp div { margin: 2px 0; }
      </style></head><body>
      <h1>MEDICAL PRESCRIPTION</h1>
      <div class="sub">Smart Ambulance Healthcare</div>
      <div class="line"></div>
      <div class="row"><span class="label">Patient:</span><span>${p.patient_name || "N/A"}</span></div>
      <div class="row"><span class="label">Date:</span><span>${new Date(p.created_at).toLocaleDateString("en-IN", { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>
      ${p.follow_up_date ? `<div class="row"><span class="label">Follow-up:</span><span>${new Date(p.follow_up_date).toLocaleDateString("en-IN")}</span></div>` : ""}
      <div class="line"></div>
      ${p.symptoms ? `<div class="row"><span class="label">Symptoms:</span><span>${p.symptoms}</span></div>` : ""}
      ${p.diagnosis ? `<div class="row"><span class="label">Diagnosis:</span><span>${p.diagnosis}</span></div>` : ""}
      <div class="line"></div>
      ${medsList.length > 0 ? `
      <table><tr><th>#</th><th>Medicine</th><th>Dosage</th><th>Route</th><th>Frequency</th><th>Timing</th><th>Duration</th><th>Instructions</th></tr>
      ${medsList.map((m, i) => `<tr>
        <td>${i + 1}</td>
        <td>${m.name}${m.is_prn ? " (PRN)" : ""}</td>
        <td>${m.dosage || "-"}</td>
        <td>${m.route || "Oral"}</td>
        <td>${m.frequency || "-"}</td>
        <td>${m.timing || "-"}</td>
        <td>${m.duration || "-"}</td>
        <td>${m.instructions || "-"}</td>
      </tr>`).join("")}
      </table>` : ""}
      ${p.prescription_notes ? `<div class="row"><span class="label">Notes:</span><span>${p.prescription_notes}</span></div>` : ""}
      <div class="stamp">
        <div><strong>Dr. ${p.doctor_name || "N/A"}</strong></div>
        <div>${p.hospital_name || ""}</div>
        <div style="margin-top:8px;"><em>Digital Prescription</em></div>
      </div>
      <div class="footer">This is a computer-generated prescription. Signature not required.</div>
    </body></html>`);
    win.document.close();
    win.print();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] overflow-y-auto">
      {/* Backdrop click to close */}
      <div className="min-h-screen flex items-start justify-center p-3 sm:p-4 pt-16 sm:pt-20">
        <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden">
          {/* Header with Gradient */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-4 sm:px-6 sm:py-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <User className="w-5 h-5 text-white" />
                  <h2 className="text-lg sm:text-xl font-bold text-white truncate">{appointment.patient_name}</h2>
                  {isCurrentAppointment && !isCompleted && (
                    <span className="px-2 py-0.5 bg-white/20 text-white text-xs rounded-full">Today</span>
                  )}
                  {isCompleted && (
                    <span className="px-2 py-0.5 bg-emerald-500/30 text-emerald-100 text-xs rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Completed
                    </span>
                  )}
                </div>
                <p className="text-blue-100 text-xs sm:text-sm truncate">{appointment.patient_email}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-blue-100 text-xs flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(appointment.appointment_date).toLocaleDateString("en-IN", { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  {appointment.hospital_name && (
                    <span className="text-blue-100 text-xs">• {appointment.hospital_name}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {canEdit && !showAddPrescription && !editPrescriptionId && (
                  <button
                    onClick={() => setShowCompleteModal(true)}
                    className="p-2 bg-emerald-500/30 hover:bg-emerald-500/50 text-emerald-100 rounded-lg transition flex items-center gap-1.5 text-xs whitespace-nowrap"
                    title="Complete Visit"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="hidden sm:inline">Complete</span>
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="p-1.5 sm:p-2 bg-white/20 hover:bg-white/30 rounded-lg transition"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>
          </div>

          {/* Completed Banner */}
          {isCompleted && (
            <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-3 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <p className="text-sm text-emerald-800 font-medium">Visit completed — all records are in view-only mode.</p>
            </div>
          )}

          {/* Tabs */}
          <div className="flex border-b border-gray-200 bg-gray-50 overflow-x-auto">
            <button
              onClick={() => setActiveTab("symptoms")}
              className={`flex-1 px-1 sm:px-2 py-3 font-medium text-[11px] sm:text-sm flex items-center justify-center gap-1 transition whitespace-nowrap ${activeTab === "symptoms" ? "bg-white text-rose-600 border-b-2 border-rose-600" : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"}`}
            >
              <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span>Symptoms</span>
            </button>
            <button
              onClick={() => setActiveTab("ai-diagnosis")}
              className={`flex-1 px-1 sm:px-2 py-3 font-medium text-[11px] sm:text-sm flex items-center justify-center gap-1 transition whitespace-nowrap ${activeTab === "ai-diagnosis" ? "bg-white text-indigo-600 border-b-2 border-indigo-600" : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"}`}
            >
              <Brain className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span>AI</span>
            </button>
            <button
              onClick={() => setActiveTab("prescriptions")}
              className={`flex-1 px-1 sm:px-2 py-3 font-medium text-[11px] sm:text-sm flex items-center justify-center gap-1 transition whitespace-nowrap ${activeTab === "prescriptions" ? "bg-white text-emerald-600 border-b-2 border-emerald-600" : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"}`}
            >
              <ClipboardList className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span>Prescriptions</span>
              <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full text-[10px]">{prescriptions.length}</span>
            </button>
            <button
              onClick={() => setActiveTab("medicines")}
              className={`flex-1 px-1 sm:px-2 py-3 font-medium text-[11px] sm:text-sm flex items-center justify-center gap-1 transition whitespace-nowrap ${activeTab === "medicines" ? "bg-white text-blue-600 border-b-2 border-blue-600" : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"}`}
            >
              <Pill className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span>Meds</span>
              <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full text-[10px]">{medicines.length}</span>
            </button>
            <button
              onClick={() => setActiveTab("reports")}
              className={`flex-1 px-1 sm:px-2 py-3 font-medium text-[11px] sm:text-sm flex items-center justify-center gap-1 transition whitespace-nowrap ${activeTab === "reports" ? "bg-white text-purple-600 border-b-2 border-purple-600" : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"}`}
            >
              <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span>Tests</span>
              <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full text-[10px]">{tests.length}</span>
            </button>
            <button
              onClick={() => setActiveTab("diet")}
              className={`flex-1 px-1 sm:px-2 py-3 font-medium text-[11px] sm:text-sm flex items-center justify-center gap-1 transition whitespace-nowrap ${activeTab === "diet" ? "bg-white text-green-600 border-b-2 border-green-600" : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"}`}
            >
              <Utensils className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span>Diet</span>
              <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full text-[10px]">{diets.length}</span>
            </button>
          </div>

          {/* Content */}
          <div className="p-3 sm:p-4 max-h-[60vh] overflow-y-auto">
            {loading ? (
              <div className="text-center py-8 text-gray-500">Loading...</div>
            ) : (
              <>
                {activeTab === "symptoms" && (
                  <div className="space-y-4">
                    {canEdit && (
                      <SymptomsAssessment
                        patientEmail={appointment.patient_email}
                        patientName={appointment.patient_name}
                        hospitalName={appointment.hospital_name}
                        appointmentId={appointment.id}
                        onSaved={() => { setAiProcessing(true); loadPatientData(true); }}
                        onSwitchToPrescriptions={(data) => {
                          setActiveTab("prescriptions");
                          setEditPrescriptionId(data.prescriptionId);
                          loadPatientData();
                        }}
                        disableAiRedirect
                        onAiComplete={(aiResult) => {
                          setAiProcessing(false);
                          setAiDiagnosisData(aiResult);
                          setPrescriptions(prev => prev.map(p =>
                            p.id === aiResult.prescription_id
                              ? { ...p, ai_processed: true, ai_diagnosis: aiResult.ai_diagnosis, ai_disease_predictions: aiResult.ai_disease_predictions, ai_suggested_tests: aiResult.ai_suggested_tests, ai_notes: aiResult.ai_notes || "" }
                              : p
                          ));
                          setActiveTab("ai-diagnosis");
                        }}
                      />
                    )}
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Recent Symptoms</h4>
                      {prescriptions.length === 0 ? (
                        <div className="text-center py-6 text-gray-400 text-sm">
                          <Activity className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                          <p>No symptoms recorded yet</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {prescriptions.slice(0, 5).map((p) => (
                            <div key={p.id} className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                              <div className="flex items-start gap-2">
                                <div className="w-6 h-6 rounded-full bg-rose-100 flex items-center justify-center shrink-0 mt-0.5">
                                  <Activity className="w-3 h-3 text-rose-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs text-gray-400">{new Date(p.created_at).toLocaleDateString("en-IN", { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                                  {p.symptoms && <p className="text-sm text-gray-800 mt-1"><span className="font-medium text-rose-600">Symptoms:</span> {p.symptoms}</p>}
                                  {p.diagnosis && <p className="text-sm text-gray-800 mt-0.5"><span className="font-medium text-rose-600">Diagnosis:</span> {p.diagnosis}</p>}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {activeTab === "ai-diagnosis" && (
                  <div className="space-y-4">
                    {(() => {
                      const aiData = aiDiagnosisData || (() => {
                        const aiPresc = [...prescriptions].find(p => p.ai_processed);
                        if (!aiPresc) return null;
                        return {
                          ai_diagnosis: aiPresc.ai_diagnosis || "",
                          ai_disease_predictions: Array.isArray(aiPresc.ai_disease_predictions) ? aiPresc.ai_disease_predictions : [],
                          ai_suggested_tests: Array.isArray(aiPresc.ai_suggested_tests) ? aiPresc.ai_suggested_tests : [],
                          ai_notes: aiPresc.ai_notes || "",
                          prescription_id: aiPresc.id,
                        };
                      })();
                      if (!aiData && !aiProcessing) {
                        return (
                          <div className="text-center py-6">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center mx-auto mb-3">
                              <Brain className="w-6 h-6 text-indigo-600" />
                            </div>
                            <h4 className="text-sm font-bold text-gray-800 mb-1">AI Diagnosis</h4>
                            <p className="text-xs text-gray-500">Complete the Symptoms Assessment to generate an AI-powered diagnosis.</p>
                          </div>
                        );
                      }
                      if (aiProcessing && !aiData) {
                        return (
                          <div className="text-center py-6">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center mx-auto mb-3">
                              <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
                            </div>
                            <h4 className="text-sm font-bold text-gray-800 mb-1">AI Analysis in Progress</h4>
                            <p className="text-xs text-gray-500">The DxGPT AI is analyzing symptoms and vitals...</p>
                          </div>
                        );
                      }
                      if (!aiData) return null;
                      const isError = aiData.ai_diagnosis?.includes("unavailable") || aiData.ai_diagnosis?.includes("failed") || aiData.ai_diagnosis?.includes("error");
                      if (isError) {
                        return (
                          <div className="p-4 bg-gradient-to-br from-red-50 to-orange-50 rounded-xl border border-red-200">
                            <div className="flex items-center gap-2 mb-2">
                              <AlertTriangle className="w-5 h-5 text-red-600" />
                              <h4 className="text-sm font-bold text-red-800">AI Diagnosis Unavailable</h4>
                            </div>
                            <p className="text-xs text-red-600">{aiData.ai_diagnosis}</p>
                          </div>
                        );
                      }
                      return (
                        <div className="space-y-4">
                          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-5 text-white">
                            <div className="flex items-center gap-2 mb-2">
                              <Sparkles className="w-4 h-4" />
                              <span className="text-[10px] font-medium text-indigo-200 uppercase tracking-wider">Primary Diagnosis</span>
                            </div>
                            <h3 className="text-xl font-bold">{aiData.ai_diagnosis}</h3>
                          </div>
                          {aiData.ai_disease_predictions?.length > 0 && (
                            <div className="bg-white rounded-2xl border border-indigo-100 p-4">
                              <div className="flex items-center gap-2 mb-3">
                                <Brain className="w-4 h-4 text-indigo-600" />
                                <h4 className="text-xs font-bold text-gray-800">Predicted Diseases</h4>
                                <span className="text-[10px] px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full">{aiData.ai_disease_predictions.length} conditions</span>
                              </div>
                              <div className="space-y-2">
                                {aiData.ai_disease_predictions.map((pred: any, i: number) => {
                                  const disease = pred.disease || "";
                                  const prob = pred.probability || 0;
                                  const pct = typeof prob === "number" ? prob : parseInt(prob) || 0;
                                  const barColor = pct >= 70 ? "bg-red-500" : pct >= 40 ? "bg-amber-500" : "bg-blue-500";
                                  return (
                                    <div key={i} className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                                      <div className="flex items-center gap-3 mb-1.5">
                                        <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                                        <span className="text-sm font-semibold text-gray-800 flex-1">{disease}</span>
                                        <span className="text-xs font-bold text-gray-600 w-10 text-right">{pct}%</span>
                                      </div>
                                      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
                                        <div className={`h-full rounded-full ${barColor} transition-all duration-500`} style={{ width: `${Math.min(pct, 100)}%` }} />
                                      </div>
                                      {pred.description && (
                                        <p className="text-xs text-gray-500 mt-1 leading-relaxed">{pred.description}</p>
                                      )}
                                      {pred.symptoms_in_common?.length > 0 && (
                                        <div className="mt-1.5 flex flex-wrap gap-1">
                                          <span className="text-[10px] text-emerald-600 font-medium">Matches:</span>
                                          {pred.symptoms_in_common.map((s: string, j: number) => (
                                            <span key={j} className="text-[10px] px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">{s}</span>
                                          ))}
                                        </div>
                                      )}
                                      {pred.symptoms_not_in_common?.length > 0 && (
                                        <div className="mt-1 flex flex-wrap gap-1">
                                          <span className="text-[10px] text-amber-600 font-medium">Non-matching:</span>
                                          {pred.symptoms_not_in_common.map((s: string, j: number) => (
                                            <span key={j} className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded-full border border-amber-200">{s}</span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          {aiData.ai_suggested_tests?.length > 0 && (
                            <div className="bg-white rounded-2xl border border-purple-100 p-4">
                              <div className="flex items-center gap-2 mb-3">
                                <FlaskConical className="w-4 h-4 text-purple-600" />
                                <h4 className="text-xs font-bold text-gray-800">Suggested Investigations</h4>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {aiData.ai_suggested_tests.map((test: string, i: number) => (
                                  <span key={i} className="text-xs px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg border border-purple-200">{test}</span>
                                ))}
                              </div>
                            </div>
                          )}
                          {aiData.ai_notes && (
                            <div className="bg-white rounded-2xl border border-gray-100 p-4">
                              <h4 className="text-xs font-bold text-gray-800 mb-2">AI Notes</h4>
                              <p className="text-sm text-gray-600 leading-relaxed">{aiData.ai_notes}</p>
                            </div>
                          )}
                          {canEdit && (
                            <button
                              onClick={() => {
                                setShowAddPrescription(true);
                                setAiPreFillData({
                                  diagnosis: aiData.ai_diagnosis || "",
                                  suggestedTests: aiData.ai_suggested_tests || [],
                                });
                                setAiDiagnosisData(null);
                                setActiveTab("prescriptions");
                              }}
                              className="w-full px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-semibold text-sm shadow-lg flex items-center justify-center gap-2 transition"
                            >
                              <Sparkles className="w-5 h-5" /> Accept AI & Create Prescription
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
                {activeTab === "prescriptions" && (
                  <div className="space-y-4">
                    {canEdit && !showAddPrescription && !editPrescriptionId && (
                      <button onClick={() => setShowAddPrescription(true)} className="w-full sm:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition">
                        <ClipboardList className="w-4 h-4" /> New Prescription
                      </button>
                    )}
                    {showAddPrescription && (
                      <PrescriptionForm
                        patientEmail={appointment.patient_email}
                        patientName={appointment.patient_name}
                        hospitalName={appointment.hospital_name}
                        appointmentId={appointment.id}
                        aiPreFill={aiPreFillData}
                        onSaved={() => { setShowAddPrescription(false); setAiPreFillData(null); loadPatientData(); }}
                        onCancel={() => { setShowAddPrescription(false); setAiPreFillData(null); }}
                        onCompleteVisitSuggested={() => {
                          loadPatientData();
                          setShowCompleteModal(true);
                          setConfirmed(false);
                        }}
                      />
                    )}
                    {editPrescriptionId && (() => {
                      const p = prescriptions.find(pr => pr.id === editPrescriptionId);
                      if (!p) return null;
                      return (
                        <PrescriptionForm
                          patientEmail={appointment.patient_email}
                          patientName={appointment.patient_name}
                          hospitalName={appointment.hospital_name}
                          appointmentId={appointment.id}
                          onSaved={() => { setEditPrescriptionId(null); loadPatientData(); }}
                          onCancel={() => setEditPrescriptionId(null)}
                          initialData={{ id: p.id, symptoms: p.symptoms, diagnosis: p.diagnosis, prescription_notes: p.prescription_notes, medicines: p.medicines, follow_up_date: p.follow_up_date }}
                        />
                      );
                    })()}

                    {/* AI Processing Indicator */}
                    {aiProcessing && (
                      <div className="p-4 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-200 animate-pulse">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                            <Bot className="w-5 h-5 text-indigo-600" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-indigo-800">AI Diagnosis in Progress</h4>
                            <p className="text-xs text-indigo-500">Analyzing symptoms and vitals...</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* AI Diagnosis Card */}
                    {(() => {
                      const aiPrescription = [...prescriptions].find(p => p.ai_processed);
                      if (!aiPrescription) return null;
                      const isError = aiPrescription.ai_diagnosis?.includes("unavailable") || aiPrescription.ai_diagnosis?.includes("failed") || aiPrescription.ai_diagnosis?.includes("error");
                      const predictions = Array.isArray(aiPrescription.ai_disease_predictions) ? aiPrescription.ai_disease_predictions : [];
                      const suggestedTests = Array.isArray(aiPrescription.ai_suggested_tests) ? aiPrescription.ai_suggested_tests : [];
                      if (isError) {
                        return (
                          <div className="p-4 bg-gradient-to-br from-red-50 to-orange-50 rounded-xl border border-red-200 shadow-sm">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                                <AlertTriangle className="w-4 h-4 text-red-600" />
                              </div>
                              <div>
                                <h4 className="text-sm font-bold text-red-800">AI Diagnosis Unavailable</h4>
                                <p className="text-[10px] text-red-500">{aiPrescription.ai_diagnosis}</p>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div className="p-4 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-200 shadow-sm">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                              <Bot className="w-4 h-4 text-indigo-600" />
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-indigo-800">AI Diagnosis</h4>
                              <p className="text-[10px] text-indigo-500">Powered by DxGPT</p>
                            </div>
                          </div>
                          {aiPrescription.ai_diagnosis && (
                            <div className="bg-white rounded-xl p-3 border border-indigo-100 mb-3">
                              <p className="text-xs text-indigo-500 font-medium mb-1">Primary Diagnosis</p>
                              <p className="text-sm font-semibold text-gray-900">{aiPrescription.ai_diagnosis}</p>
                            </div>
                          )}
                          {predictions.length > 0 && (
                            <div className="mb-3">
                              <p className="text-xs font-medium text-indigo-600 mb-2 flex items-center gap-1">
                                <Brain className="w-3 h-3" /> Predicted Diseases
                              </p>
                              <div className="space-y-1.5">
                                {predictions.slice(0, 5).map((pred: any, i: number) => {
                                  const disease = pred.disease || pred.disease_name || "";
                                  const prob = pred.probability || pred.confidence || 0;
                                  const pct = typeof prob === "number" ? prob : parseInt(prob) || 0;
                                  const barColor = pct >= 70 ? "bg-red-500" : pct >= 40 ? "bg-amber-500" : "bg-blue-500";
                                  return (
                                    <div key={i} className="flex items-center gap-2">
                                      <span className="text-xs text-gray-700 w-24 sm:w-32 truncate">{disease}</span>
                                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                                      </div>
                                      <span className="text-[10px] font-medium text-gray-500 w-8 text-right">{pct}%</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          {suggestedTests.length > 0 && (
                            <div className="mb-3">
                              <p className="text-xs font-medium text-indigo-600 mb-1.5 flex items-center gap-1">
                                <FlaskConical className="w-3 h-3" /> Suggested Tests
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {suggestedTests.map((test: string, i: number) => (
                                  <span key={i} className="text-[10px] px-2 py-1 bg-purple-100 text-purple-700 rounded-full border border-purple-200">
                                    {test}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {canEdit && (
                            <button
                              onClick={() => {
                                setShowAddPrescription(true);
                                setAiPreFillData({
                                  diagnosis: aiPrescription.ai_diagnosis || "",
                                  suggestedTests: suggestedTests,
                                });
                              }}
                              className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition"
                            >
                              <Sparkles className="w-4 h-4" /> Accept AI & Create Prescription
                            </button>
                          )}
                        </div>
                      );
                    })()}

                    {prescriptions.length === 0 ? (
                      <div className="text-center py-8">
                        <ClipboardList className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                        <p className="text-gray-500 text-sm">No prescriptions yet</p>
                        <p className="text-gray-400 text-xs mt-1">Click "New Prescription" to create one</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {prescriptions.map((p) => {
                          let medsList: { name: string; dosage?: string; frequency?: string; timing?: string; duration?: string; route?: string; instructions?: string; is_prn?: boolean; quantity?: string; refills?: string }[] = [];
                          try { const parsed = JSON.parse(p.medicines || "[]"); medsList = Array.isArray(parsed) ? parsed : []; } catch {}
                          return (
                            <div key={p.id} className="p-3 sm:p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-[11px] text-gray-400">{new Date(p.created_at).toLocaleDateString("en-IN", { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                    p.status === "Active" ? "bg-green-100 text-green-700" :
                                    p.status === "Completed" ? "bg-blue-100 text-blue-700" :
                                    "bg-gray-100 text-gray-600"
                                  }`}>{p.status || "Active"}</span>
                                  {p.ai_processed && (
                                    <span className="text-[10px] px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full flex items-center gap-0.5">
                                      <Bot className="w-2.5 h-2.5" /> AI
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 flex-wrap justify-end">
                                  {p.follow_up_date && <span className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">Follow-up: {new Date(p.follow_up_date).toLocaleDateString("en-IN")}</span>}
                                  {canEdit && (
                                    <>
                                      <button onClick={() => setEditPrescriptionId(p.id)} className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="Edit">
                                        <Edit3 className="w-3.5 h-3.5" />
                                      </button>
                                      <button onClick={() => deletePrescription(p.id)} className="p-1 text-red-500 hover:bg-red-50 rounded" title="Delete">
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </>
                                  )}
                                  <button onClick={() => printPrescription(p)} className="p-1 text-gray-500 hover:bg-gray-100 rounded" title="Print">
                                    <Printer className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                              {p.symptoms && <p className="text-sm text-gray-800"><span className="font-semibold text-rose-500">Symptoms:</span> {p.symptoms}</p>}
                              {p.diagnosis && <p className="text-sm text-gray-800 mt-0.5"><span className="font-semibold text-emerald-600">Diagnosis:</span> {p.diagnosis}</p>}
                              {(p.bp_systolic != null || p.bp_diastolic != null || p.temperature != null || p.pulse != null || p.spo2 != null) && (
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                  {p.bp_systolic != null && p.bp_diastolic != null && <span className="text-[10px] px-2 py-0.5 bg-red-50 text-red-700 rounded-full border border-red-200">BP {p.bp_systolic}/{p.bp_diastolic}</span>}
                                  {p.pulse != null && <span className="text-[10px] px-2 py-0.5 bg-orange-50 text-orange-700 rounded-full border border-orange-200">Pulse {p.pulse}</span>}
                                  {p.temperature != null && <span className="text-[10px] px-2 py-0.5 bg-yellow-50 text-yellow-700 rounded-full border border-yellow-200">Temp {p.temperature}\u00b0C</span>}
                                  {p.spo2 != null && <span className="text-[10px] px-2 py-0.5 bg-teal-50 text-teal-700 rounded-full border border-teal-200">SpO\u2082 {p.spo2}%</span>}
                                </div>
                              )}
                              {medsList.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {medsList.map((m, i) => (
                                    <span key={i} className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full border border-blue-200" title={m.instructions || ""}>
                                      {m.name}{m.dosage ? ` (${m.dosage})` : ""}{m.route && m.route !== "Oral" ? ` [${m.route}]` : ""}{m.is_prn ? " PRN" : ""}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {p.prescription_notes && <p className="text-xs text-gray-500 mt-1.5 italic">Note: {p.prescription_notes}</p>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
                {activeTab === "medicines" && (
                  <MedicinesSection patientEmail={appointment.patient_email} patientName={appointment.patient_name} appointmentId={appointment.id} hospitalName={appointment.hospital_name} medicines={medicines} isEditable={canEdit} onRefresh={loadPatientData} />
                )}
                {activeTab === "reports" && (
                  <ReportsSection patientEmail={appointment.patient_email} patientName={appointment.patient_name} appointmentId={appointment.id} hospitalName={appointment.hospital_name} tests={tests} isEditable={canEdit} onRefresh={loadPatientData} />
                )}
                {activeTab === "diet" && (
                  <DietSection patientEmail={appointment.patient_email} appointmentId={appointment.id} diets={diets} isEditable={canEdit} onRefresh={loadPatientData} />
                )}
              </>
            )}
          </div>

          {/* Complete Visit Modal */}
          {showCompleteModal && (
            <div className="fixed inset-0 bg-black/50 flex items-start justify-center p-3 sm:p-4 z-[60] overflow-y-auto">
              <div className="bg-white rounded-2xl w-full max-w-lg my-8 mx-1 sm:mx-0 p-4 sm:p-6 shadow-2xl">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Complete Visit</h3>
                    <p className="text-sm text-gray-500">{appointment.patient_name}</p>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-4 mb-4 space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Visit Summary</p>
                  <div className="flex items-center gap-2 text-sm">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${prescriptions.length > 0 ? "bg-emerald-100 text-emerald-600" : "bg-gray-200 text-gray-400"}`}>
                      {prescriptions.length > 0 ? <CheckCircle2 className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                    </div>
                    <span className="text-gray-700">Prescriptions: <strong>{prescriptions.length}</strong></span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${medicines.length > 0 ? "bg-emerald-100 text-emerald-600" : "bg-gray-200 text-gray-400"}`}>
                      {medicines.length > 0 ? <CheckCircle2 className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                    </div>
                    <span className="text-gray-700">Medicines: <strong>{medicines.length}</strong></span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${tests.length > 0 ? "bg-emerald-100 text-emerald-600" : "bg-gray-200 text-gray-400"}`}>
                      {tests.length > 0 ? <CheckCircle2 className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                    </div>
                    <span className="text-gray-700">Tests Ordered: <strong>{tests.length}</strong></span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center ${diets.length > 0 ? "bg-emerald-100 text-emerald-600" : "bg-gray-200 text-gray-400"}`}>
                      {diets.length > 0 ? <CheckCircle2 className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                    </div>
                    <span className="text-gray-700">Diet Plans: <strong>{diets.length}</strong></span>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={confirmed}
                      onChange={(e) => setConfirmed(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-sm text-gray-600">I confirm the consultation is complete and all records are final.</span>
                  </label>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Visit Notes (optional)</label>
                    <textarea
                      value={visitNote}
                      onChange={(e) => setVisitNote(e.target.value)}
                      placeholder="Any closing notes for this visit..."
                      rows={2}
                      className="w-full rounded-lg border-2 border-gray-200 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none resize-none"
                    />
                  </div>
                </div>

                <div className="flex gap-2 mt-5">
                  <button
                    onClick={() => { setShowCompleteModal(false); setConfirmed(false); setVisitNote(""); }}
                    className="flex-1 px-4 py-2.5 border-2 border-gray-200 text-gray-700 rounded-xl font-medium text-sm hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCompleteVisit}
                    disabled={!confirmed || completing}
                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl font-semibold text-sm shadow-lg hover:from-emerald-600 hover:to-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {completing ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Completing...</>
                    ) : (
                      <><CheckCircle2 className="w-4 h-4" /> Complete Visit</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

function MedicinesSection({
  patientEmail,
  patientName,
  appointmentId,
  hospitalName,
  medicines,
  isEditable,
  onRefresh
}: {
  patientEmail: string;
  patientName: string;
  appointmentId?: string;
  hospitalName?: string;
  medicines: PatientMedicine[];
  isEditable: boolean;
  onRefresh: () => void;
}) {
  const [showAddModal, setShowAddModal] = useState(false);

  const handleSaveMedicine = async (formData: any) => {
    const { error } = await supabase.from("patient_medicines").insert([{
      patient_email: patientEmail,
      patient_name: patientName,
      appointment_id: appointmentId || null,
      hospital_name: hospitalName || null,
      medicine_name: formData.medicine_name,
      dosage: formData.dosage,
      frequency: formData.frequency,
      timing: formData.timing,
      duration: formData.duration,
      instructions: formData.instructions,
      route: formData.route,
      is_prn: formData.is_prn,
      quantity: formData.quantity,
      refills: formData.refills,
      is_active: true,
    }]);
    if (error) throw new Error(error.message || JSON.stringify(error));
    onRefresh();
  };

  const deleteMedicine = async (medId: string) => {
    if (!confirm("Delete this medicine?")) return;
    await supabase.from("patient_medicines").delete().eq("id", medId);
    onRefresh();
  };

  const toggleCollected = async (medId: string, currentlyCollected: boolean) => {
    await supabase.from("patient_medicines").update({
      medicine_collected: !currentlyCollected,
      collected_at: !currentlyCollected ? new Date().toISOString() : null,
    }).eq("id", medId);
    onRefresh();
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      {isEditable && (
        <button
          onClick={() => setShowAddModal(true)}
          className="w-full sm:w-auto px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" /> Add Medicine
        </button>
      )}

      <MedicineForm
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleSaveMedicine}
        existingMedicineNames={medicines.map(m => m.medicine_name)}
      />

      {medicines.length === 0 ? (
        <div className="text-center py-8">
          <Pill className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500 text-sm">No medicines for this patient</p>
        </div>
      ) : (
        <div className="space-y-2">
          {medicines.map((med) => (
            <div key={med.id} className="p-3 sm:p-4 bg-gray-50 rounded-xl border border-gray-200">
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-semibold text-gray-900 text-sm">{med.medicine_name}</h4>
                    {med.is_prn && <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded font-medium">PRN</span>}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${med.is_active ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}`}>
                      {med.is_active ? "Active" : "Inactive"}
                    </span>
                    {med.medicine_collected ? (
                      <button onClick={() => toggleCollected(med.id, true)} className="text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded flex items-center gap-0.5 hover:bg-emerald-200">
                        <CheckCircle2 className="w-2.5 h-2.5" /> Collected
                      </button>
                    ) : isEditable && (
                      <button onClick={() => toggleCollected(med.id, false)} className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded hover:bg-gray-200">
                        Mark Collected
                      </button>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-gray-600 mt-1.5 leading-relaxed">
                    <span className="font-medium">D:</span> {med.dosage || "N/A"}
                    {med.route && <span> &bull; <span className="font-medium">Route:</span> {med.route}</span>}
                    <span> &bull; <span className="font-medium">F:</span> {med.frequency}</span>
                    <span> &bull; <span className="font-medium">T:</span> {med.timing}</span>
                    <span> &bull; <span className="font-medium">Dur:</span> {med.duration}</span>
                    {med.quantity && <span> &bull; <span className="font-medium">Qty:</span> {med.quantity}</span>}
                    {med.refills && med.refills !== "0" && <span> &bull; <span className="font-medium">Refill:</span> {med.refills}</span>}
                  </p>
                  {med.instructions && <p className="text-[10px] sm:text-xs text-gray-500 mt-1.5">Note: {med.instructions}</p>}
                </div>
                {isEditable && (
                  <button onClick={() => deleteMedicine(med.id)} className="p-1.5 sm:p-2 text-red-600 hover:bg-red-50 rounded-lg flex-shrink-0">
                    <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReportsSection({
  patientEmail,
  patientName,
  appointmentId,
  hospitalName,
  tests,
  isEditable,
  onRefresh
}: {
  patientEmail: string;
  patientName: string;
  appointmentId?: string;
  hospitalName?: string;
  tests: PatientTest[];
  isEditable: boolean;
  onRefresh: () => void;
}) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTest, setNewTest] = useState({ test_type: "Blood Test", notes: "" });

  const handleAddTest = async () => {
    try {
      console.log("Adding test:", { patientEmail, patientName, hospitalName, test_type: newTest.test_type });
      
      const { data, error } = await supabase.from("patient_tests").insert([{
        patient_email: patientEmail,
        patient_name: patientName,
        appointment_id: appointmentId || null,
        hospital_name: hospitalName || null,
        test_type: newTest.test_type,
        notes: newTest.notes,
        status: "ordered",
        payment_status: "pending",
        created_at: new Date().toISOString(),
      }]).select();
      
      console.log("Test insert result:", { data, error });
      
      if (error) {
        console.error("Supabase error:", JSON.stringify(error));
        throw new Error(error.message || JSON.stringify(error));
      }
      setShowAddModal(false);
      setNewTest({ test_type: "Blood Test", notes: "" });
      onRefresh();
    } catch (err) {
      console.error("Error adding test:", err);
      alert("Failed to add test");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed": return <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">Completed</span>;
      case "confirmed": return <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-700">Confirmed</span>;
      case "ordered": return <span className="px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-700">Ordered</span>;
      default: return <span className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700">{status}</span>;
    }
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      {isEditable && (
        <button onClick={() => setShowAddModal(true)} className="w-full sm:w-auto px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium flex items-center justify-center gap-2">
          <Plus className="w-4 h-4" /> Add Test
        </button>
      )}

      {tests.length === 0 ? (
        <div className="text-center py-8">
          <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500 text-sm">No test reports for this patient</p>
          <p className="text-gray-400 text-xs mt-1">Click "Add Test" to order one</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tests.map((test) => (
            <div key={test.id} className="p-3 sm:p-4 bg-gray-50 rounded-xl border border-gray-200">
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-gray-900 text-sm">{test.test_type}</h4>
                  <p className="text-xs text-gray-500 mt-1">{new Date(test.created_at).toLocaleDateString("en-IN")}</p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${test.status === "completed" ? "bg-green-100 text-green-700" : test.status === "confirmed" ? "bg-blue-100 text-blue-700" : "bg-yellow-100 text-yellow-700"}`}>
                    {test.status}
                  </span>
                  {test.report_url ? (
                    <a href={test.report_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-600 hover:underline">View Report</a>
                  ) : (
                    <span className="text-[10px] text-gray-400">No report</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center p-3 sm:p-4 z-[60] overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-md my-4 mx-1 sm:mx-0 p-4 sm:p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base sm:text-lg font-semibold">Book Test</h3>
              <button onClick={() => setShowAddModal(false)} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Test Type</label>
                <select value={newTest.test_type} onChange={(e) => setNewTest({ ...newTest, test_type: e.target.value })} className="w-full rounded-lg border-2 border-gray-200 px-3 sm:px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none bg-white">
                  {TEST_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={newTest.notes} onChange={(e) => setNewTest({ ...newTest, notes: e.target.value })} placeholder="Any instructions..." rows={2} className="w-full rounded-lg border-2 border-gray-200 px-3 sm:px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none resize-none" />
              </div>
              <button onClick={handleAddTest} className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm">Book Test</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DietSection({
  patientEmail,
  appointmentId,
  diets,
  isEditable,
  onRefresh
}: {
  patientEmail: string;
  appointmentId?: string;
  diets: PatientDiet[];
  isEditable: boolean;
  onRefresh: () => void;
}) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDiet, setNewDiet] = useState({
    diet_name: "",
    diet_type: "General",
    calories: "",
    timing: "Lunch (1 PM)",
    foods: "",
    instructions: "",
  });

  const handleAddDiet = async () => {
    if (!newDiet.diet_name) {
      alert("Diet name is required");
      return;
    }

    try {
      const { error } = await supabase.from("patient_diets").insert([{
        patient_email: patientEmail,
        appointment_id: appointmentId || null,
        diet_name: newDiet.diet_name,
        diet_type: newDiet.diet_type,
        calories: newDiet.calories,
        timing: newDiet.timing,
        foods: newDiet.foods,
        instructions: newDiet.instructions,
        is_active: true,
      }]);

      if (error) throw error;
      setShowAddModal(false);
      setNewDiet({ diet_name: "", diet_type: "General", calories: "", timing: "Lunch (1 PM)", foods: "", instructions: "" });
      onRefresh();
    } catch (err) {
      console.error("Error adding diet:", err);
      alert("Failed to add diet plan");
    }
  };

  const deleteDiet = async (dietId: string) => {
    if (!confirm("Delete this diet plan?")) return;
    try {
      await supabase.from("patient_diets").delete().eq("id", dietId);
      onRefresh();
    } catch (err) {
      console.error("Error deleting:", err);
    }
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      {isEditable && (
        <button onClick={() => setShowAddModal(true)} className="w-full sm:w-auto px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium flex items-center justify-center gap-2">
          <Plus className="w-4 h-4" /> Add Diet Plan
        </button>
      )}

      {diets.length === 0 ? (
        <div className="text-center py-8">
          <Utensils className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500 text-sm">No diet plans for this patient</p>
          <p className="text-gray-400 text-xs mt-1">Click "Add Diet Plan" to create one</p>
        </div>
      ) : (
        <div className="space-y-2">
          {diets.map((diet) => (
            <div key={diet.id} className="p-3 sm:p-4 bg-gray-50 rounded-xl border border-gray-200">
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-semibold text-gray-900 text-sm">{diet.diet_name}</h4>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700">{diet.diet_type}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${diet.is_active ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}`}>
                      {diet.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-600 mt-1.5 leading-relaxed">
                    {diet.calories && <span className="font-medium">Cal:</span>}{diet.calories && ` ${diet.calories}`}{diet.calories && diet.timing && " • "}{diet.timing && <><span className="font-medium">Time:</span> {diet.timing}</>}
                  </p>
                  {diet.foods && <p className="text-[10px] sm:text-xs text-gray-500 mt-1.5 truncate"><span className="font-medium">Foods:</span> {diet.foods}</p>}
                  {diet.instructions && <p className="text-[10px] text-gray-400 mt-1">Note: {diet.instructions}</p>}
                </div>
                {isEditable && (
                  <button onClick={() => deleteDiet(diet.id)} className="p-1.5 sm:p-2 text-red-600 hover:bg-red-50 rounded-lg flex-shrink-0">
                    <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center p-3 sm:p-4 z-[60] overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-md my-4 mx-1 sm:mx-0 p-4 sm:p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base sm:text-lg font-semibold">Add Diet Plan</h3>
              <button onClick={() => setShowAddModal(false)} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Diet Name *</label>
                <input type="text" value={newDiet.diet_name} onChange={(e) => setNewDiet({ ...newDiet, diet_name: e.target.value })} placeholder="e.g., Morning Diet Plan" className="w-full rounded-lg border-2 border-gray-200 px-3 sm:px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Diet Type</label>
                  <select value={newDiet.diet_type} onChange={(e) => setNewDiet({ ...newDiet, diet_type: e.target.value })} className="w-full rounded-lg border-2 border-gray-200 px-3 sm:px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none bg-white">
                    {DIET_TYPES.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Calories</label>
                  <input type="text" value={newDiet.calories} onChange={(e) => setNewDiet({ ...newDiet, calories: e.target.value })} placeholder="e.g., 2000 kcal" className="w-full rounded-lg border-2 border-gray-200 px-3 sm:px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Timing</label>
                <select value={newDiet.timing} onChange={(e) => setNewDiet({ ...newDiet, timing: e.target.value })} className="w-full rounded-lg border-2 border-gray-200 px-3 sm:px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none bg-white">
                  <option value="Morning (8 AM)">Morning (8 AM)</option>
                  <option value="Mid-morning (11 AM)">Mid-morning (11 AM)</option>
                  <option value="Lunch (1 PM)">Lunch (1 PM)</option>
                  <option value="Afternoon (4 PM)">Afternoon (4 PM)</option>
                  <option value="Dinner (8 PM)">Dinner (8 PM)</option>
                  <option value="Bedtime">Bedtime</option>
                </select>
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Foods (comma separated)</label>
                <textarea
                  value={newDiet.foods}
                  onChange={(e) => setNewDiet({ ...newDiet, foods: e.target.value })}
                  placeholder="Milk, Oats, Banana"
                  rows={2}
                  className="w-full rounded-lg border-2 border-gray-200 px-3 sm:px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none resize-none"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Instructions</label>
                <textarea
                  value={newDiet.instructions}
                  onChange={(e) => setNewDiet({ ...newDiet, instructions: e.target.value })}
                  placeholder="Any special instructions..."
                  rows={2}
                  className="w-full rounded-lg border-2 border-gray-200 px-3 sm:px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none resize-none"
                />
              </div>
              <button onClick={handleAddDiet} className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm">
                Add Diet Plan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DoctorAppointmentsTab() {
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("scheduled");
  const [filterHospital, setFilterHospital] = useState<string>("all");
  const [filterCaseType, setFilterCaseType] = useState<string>("all");
  const [hospitals, setHospitals] = useState<{ name: string; count: number }[]>([]);

  useEffect(() => {
    loadAppointments();
    loadHospitals();
  }, []);

  const loadHospitals = async () => {
    try {
      const data = await fetchHospitalsList();
      const uniqueNames = [...new Set(data.hospitals.map(h => h.name).filter(Boolean))];
      const today = new Date().toISOString().split("T")[0];
      const { data: appointmentsData } = await supabase
        .from("patient_appointments")
        .select("hospital_name")
        .gte("appointment_date", `${today}T00:00:00`)
        .lte("appointment_date", `${today}T23:59:59`);
      const countMap: Record<string, number> = {};
      appointmentsData?.forEach(apt => { if (apt.hospital_name) countMap[apt.hospital_name] = (countMap[apt.hospital_name] || 0) + 1; });
      setHospitals(uniqueNames.map(name => ({ name, count: countMap[name] || 0 })));
    } catch (err) { console.error("Error loading hospitals:", err); }
  };

  const loadAppointments = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("patient_appointments")
        .select("*")
        .gte("appointment_date", `${today}T00:00:00`)
        .lte("appointment_date", `${today}T23:59:59`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setAppointments(data || []);
    } catch (err) { console.error("Error loading appointments:", err); }
    finally { if (!silent) setLoading(false); }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadAppointments(true), loadHospitals()]);
    setRefreshing(false);
  };

  const handleRefreshRef = useRef(handleRefresh);
  useEffect(() => {
    handleRefreshRef.current = handleRefresh;
  });

  useEffect(() => {
    const interval = setInterval(() => {
      handleRefreshRef.current();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const filteredAppointments = appointments.filter((apt) => {
    const matchesSearch = apt.patient_name.toLowerCase().includes(searchQuery.toLowerCase()) || apt.patient_email.toLowerCase().includes(searchQuery.toLowerCase()) || apt.hospital_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === "all" || apt.status === filterStatus;
    const matchesHospital = filterHospital === "all" || apt.hospital_name === filterHospital;
    const matchesCaseType = filterCaseType === "all" || apt.case_type === filterCaseType;
    return matchesSearch && matchesStatus && matchesHospital && matchesCaseType;
  });

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-center justify-between">
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-600" />
          <span className="hidden xs:inline">Today's Appointments</span>
          <span className="xs:hidden">Appointments</span>
        </h2>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition border border-blue-200"
        >
          <Loader2 className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Filters - Stack on mobile */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search patient..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border-2 border-gray-200 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <select
          value={filterHospital}
          onChange={(e) => setFilterHospital(e.target.value)}
          className="w-full sm:w-auto px-3 py-2.5 rounded-xl border-2 border-gray-200 text-sm focus:border-blue-500 focus:outline-none bg-white sm:min-w-[140px]"
        >
          <option value="all">All Hospitals</option>
          {hospitals.map((h) => (<option key={h.name} value={h.name}>{h.name}</option>))}
        </select>
        <select
          value={filterCaseType}
          onChange={(e) => setFilterCaseType(e.target.value)}
          className="w-full sm:w-auto px-3 py-2.5 rounded-xl border-2 border-gray-200 text-sm focus:border-blue-500 focus:outline-none bg-white sm:min-w-[140px]"
        >
          <option value="all">All Case Types</option>
          {CASE_TYPES.map((ct) => (<option key={ct.value} value={ct.value}>{ct.label}</option>))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="w-full sm:w-auto px-3 py-2.5 rounded-xl border-2 border-gray-200 text-sm focus:border-blue-500 focus:outline-none bg-white sm:min-w-[120px]"
        >
          <option value="all">Status</option>
          <option value="scheduled">Waiting</option>
          <option value="in-consultation">Consulting</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : filteredAppointments.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No appointments found</div>
      ) : (
        /* Cards instead of table for mobile */
        <div className="space-y-3">
          {filteredAppointments.map((apt) => {
            const isCompleted = apt.status === "completed";
            const isConsulting = apt.status === "in-consultation";
            return (
            <div
              key={apt.id}
              onClick={async () => {
                if (isCompleted) return;
                if (apt.status === "scheduled") {
                  try {
                    await fetch(`http://127.0.0.1:8000/api/healthcare/appointments/${apt.id}/status`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ status: "in-consultation" }),
                    });
                  } catch (e) { console.error("Failed to set in-consultation:", e); }
                }
                router.push(`/doctor/patient?id=${apt.id}`);
              }}
              className={`bg-white rounded-xl border border-gray-200 p-4 transition ${
                isCompleted
                  ? "opacity-60 cursor-default border-gray-100"
                  : "hover:border-blue-300 cursor-pointer"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className={`font-semibold truncate ${isCompleted ? "text-gray-500" : "text-gray-900"}`}>{apt.patient_name}</h3>
                    {isToday(apt.appointment_date) && !isCompleted && (
                      <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[10px] font-medium">Today</span>
                    )}
                    {isConsulting && (
                      <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-medium flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" /> Consulting
                      </span>
                    )}
                  </div>
                  <p className={`text-xs truncate ${isCompleted ? "text-gray-400" : "text-gray-500"}`}>{apt.patient_email}</p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className={`text-xs flex items-center gap-1 truncate max-w-[100px] sm:max-w-[200px] ${isCompleted ? "text-gray-400" : "text-gray-600"}`}>
                      <Stethoscope className="w-3 h-3 shrink-0" />
                      <span className="truncate">{apt.case_type || "General"}</span>
                    </span>
                    <span className="text-xs text-gray-400">|</span>
                    <span className={`text-xs flex items-center gap-1 ${isCompleted ? "text-gray-400" : "text-gray-600"}`}>
                      <Calendar className="w-3 h-3" />
                      {new Date(apt.appointment_date).toLocaleDateString("en-IN", { day: 'numeric', month: 'short' })}
                    </span>
                    {apt.hospital_name && (
                      <>
                        <span className="text-xs text-gray-400">|</span>
                        <span className={`text-xs truncate max-w-[120px] sm:max-w-[200px] ${isCompleted ? "text-gray-400" : "text-gray-500"}`}>{apt.hospital_name}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`text-[10px] px-2 py-1 rounded-full font-medium ${
                    apt.status === "scheduled" ? "bg-blue-100 text-blue-700" :
                    apt.status === "in-consultation" ? "bg-amber-100 text-amber-700" :
                    apt.status === "completed" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                  }`}>
                    {apt.status === "scheduled" ? "Waiting" :
                     apt.status === "in-consultation" ? "Consulting" :
                     apt.status === "completed" ? "Completed" : apt.status}
                  </span>
                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                </div>
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}