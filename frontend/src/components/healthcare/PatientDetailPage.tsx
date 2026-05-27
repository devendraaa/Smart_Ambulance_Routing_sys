"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Calendar, User, Mail, Phone, MapPin, Building2, Pill, FileText, Utensils, ArrowLeft, X, Plus, Trash2, CheckCircle2, Activity, ClipboardList, Loader2, Printer, Edit3, Sparkles, Bot, Brain, FlaskConical, Thermometer, Heart, Wind } from "lucide-react";
import { supabase } from "@/lib/supabase";
import SymptomsAssessment from "./SymptomsAssessment";
import PrescriptionForm from "./PrescriptionForm";
import MedicineForm from "./MedicineForm";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

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
  hospital_name?: string;
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
}

interface PatientTest {
  id: string;
  patient_email: string;
  test_type: string;
  status: string;
  notes?: string;
  created_at: string;
}

interface PatientDiet {
  id: string;
  patient_email: string;
  diet_name: string;
  diet_type: string;
  timing: string;
  foods: string;
  instructions: string;
  is_active: boolean;
  created_at: string;
}

interface Prescription {
  id: string;
  patient_email: string;
  patient_name?: string;
  doctor_name?: string;
  symptoms?: string;
  diagnosis?: string;
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
}

const TEST_TYPES = ["MRI", "CT Scan", "Sonography", "Blood Test", "X-Ray", "ECG", "ECHO", "TMT", "Urine Test", "Stool Test", "Thyroid", "Sugar Test"];
const DIET_TYPES = ["Weight Loss", "Weight Gain", "Diabetic", "Heart", "Low Salt", "High Protein", "Vegetarian", "Liquid Diet", "Soft Diet", "General"];

function isToday(dateString: string): boolean {
  const appointmentDate = new Date(dateString);
  const today = new Date();
  return appointmentDate.toDateString() === today.toDateString();
}

export function PatientDetailContent({ appointmentId, onBack }: { appointmentId: string; onBack?: () => void }) {
  const router = useRouter();

  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [medicines, setMedicines] = useState<PatientMedicine[]>([]);
  const [tests, setTests] = useState<PatientTest[]>([]);
  const [diets, setDiets] = useState<PatientDiet[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"symptoms" | "ai-diagnosis" | "prescriptions" | "medicines" | "reports" | "diet">("symptoms");

  const [showAddMedicine, setShowAddMedicine] = useState(false);
  const [showAddTest, setShowAddTest] = useState(false);
  const [showAddDiet, setShowAddDiet] = useState(false);
  const [editPrescriptionId, setEditPrescriptionId] = useState<string | null>(null);

  const [newTest, setNewTest] = useState({ test_type: "Blood Test", notes: "" });

  const [newDiet, setNewDiet] = useState({
    diet_name: "",
    diet_type: "General",
    timing: "Lunch (1 PM)",
    foods: "",
    instructions: "",
  });

  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [visitNote, setVisitNote] = useState("");

  const [aiPreFill, setAiPreFill] = useState<{ diagnosis: string; suggestedTests: string[]; symptoms?: string } | null>(null);
  const [savedSymptoms, setSavedSymptoms] = useState("");
  const aiPreFillApplied = useRef(false);

  const [aiDiagnosisData, setAiDiagnosisData] = useState<{
    ai_diagnosis: string;
    ai_disease_predictions: any[];
    ai_suggested_tests: string[];
    ai_notes?: string;
    prescription_id: string;
  } | null>(null);
  const [isAiProcessing, setIsAiProcessing] = useState(false);

  useEffect(() => {
    if (appointment && !aiPreFillApplied.current) {
      const raw = localStorage.getItem("aiPreFillData");
      if (raw) {
        try {
          const data = JSON.parse(raw);
          const patientEmail = localStorage.getItem("aiPrescriptionPatientEmail");
          if (patientEmail === appointment.patient_email) {
            setAiPreFill({ diagnosis: data.diagnosis || "", suggestedTests: Array.isArray(data.suggestedTests) ? data.suggestedTests : [] });
            setActiveTab("prescriptions");
            aiPreFillApplied.current = true;
            localStorage.removeItem("aiPreFillData");
            localStorage.removeItem("aiPrescriptionId");
            localStorage.removeItem("aiPrescriptionPatientEmail");
            localStorage.removeItem("aiPrescriptionPatientName");
          }
        } catch {}
      }
    }
  }, [appointment]);

  const isCurrentAppointment = appointment ? isToday(appointment.appointment_date) : false;
  const isCompleted = appointment?.status === "completed";
  const isCancelled = appointment?.status === "cancelled";
  const canEdit = isCurrentAppointment && !isCompleted && !isCancelled;

  useEffect(() => {
    if (appointmentId) {
      loadData();
    }
  }, [appointmentId]);

  useEffect(() => {
    if (appointment?.status === "scheduled" && isCurrentAppointment) {
      fetch(`${API_URL}/api/healthcare/appointments/${appointment.id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "in-consultation" })
      }).then(() => {
        setAppointment(prev => prev ? { ...prev, status: "in-consultation" } : prev);
      }).catch(console.error);
    }
  }, [appointment?.id]);

  const loadData = async (silent = false) => {
    if (!appointmentId) return;
    if (!silent) setLoading(true);
    try {
      const { data: aptData } = await supabase
        .from("patient_appointments")
        .select("*")
        .eq("id", appointmentId)
        .single();
      
      if (aptData) setAppointment(aptData);

      const [prescData, medsData, testsData, dietsData] = await Promise.all([
        supabase.from("doctor_prescriptions").select("*").eq("patient_email", aptData?.patient_email || "").order("created_at", { ascending: false }),
        supabase.from("patient_medicines").select("*").eq("appointment_id", appointmentId).order("created_at", { ascending: false }),
        supabase.from("patient_tests").select("*").eq("appointment_id", appointmentId).order("created_at", { ascending: false }),
        supabase.from("patient_diets").select("*").eq("appointment_id", appointmentId).order("created_at", { ascending: false })
      ]);

      setPrescriptions(prescData.data || []);
      setMedicines(medsData.data || []);
      setTests(testsData.data || []);
      setDiets(dietsData.data || []);
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const deletePrescription = async (id: string) => {
    if (!confirm("Delete this prescription?")) return;
    try {
      const res = await fetch(`${API_URL}/api/healthcare/doctor/prescriptions/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      loadData();
    } catch (err) {
      console.error("Error deleting prescription:", err);
      alert("Failed to delete prescription");
    }
  };

  const printPrescription = (p: Prescription) => {
    const win = window.open("", "_blank");
    if (!win) return;
    let medsList: any[] = [];
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
      ${medsList.map((m: any, i: number) => `<tr>
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

  const handleSaveMedicine = async (formData: any) => {
    if (!appointment) return;
    const { error } = await supabase.from("patient_medicines").insert([{
      patient_email: appointment.patient_email,
      patient_name: appointment.patient_name,
      appointment_id: appointment.id,
      hospital_name: appointment.hospital_name,
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
    if (error) throw error;
    loadData();
  };

  const handleAddTest = async () => {
    if (!appointment) return;
    try {
      const { error } = await supabase.from("patient_tests").insert([{
        patient_email: appointment.patient_email,
        patient_name: appointment.patient_name,
        appointment_id: appointment.id,
        hospital_name: appointment.hospital_name,
        test_type: newTest.test_type,
        notes: newTest.notes,
        status: "ordered",
        payment_status: "pending",
        created_at: new Date().toISOString(),
      }]);
      if (error) throw error;
      setShowAddTest(false);
      setNewTest({ test_type: "Blood Test", notes: "" });
      loadData();
    } catch (err) {
      console.error("Error adding test:", err);
      alert("Failed to add test");
    }
  };

  const handleAddDiet = async () => {
    if (!newDiet.diet_name || !appointment) return;
    try {
      const { error } = await supabase.from("patient_diets").insert([{
        patient_email: appointment.patient_email,
        appointment_id: appointment.id,
        diet_name: newDiet.diet_name,
        diet_type: newDiet.diet_type,
        timing: newDiet.timing,
        foods: newDiet.foods,
        instructions: newDiet.instructions,
        is_active: true,
      }]);
      if (error) throw error;
      setShowAddDiet(false);
      setNewDiet({ diet_name: "", diet_type: "General", timing: "Lunch (1 PM)", foods: "", instructions: "" });
      loadData();
    } catch (err) {
      console.error("Error adding diet:", err);
      alert("Failed to add diet plan");
    }
  };

  const handleCompleteVisit = async () => {
    if (!appointment || !confirmed) return;
    setCompleting(true);
    try {
      const res = await fetch(`${API_URL}/api/healthcare/appointments/${appointment.id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" })
      });
      if (!res.ok) throw new Error("Failed to complete visit");

      for (const p of prescriptions) {
        if (p.status === "Active") {
          try {
            await fetch(`${API_URL}/api/healthcare/doctor/prescriptions/${p.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "Completed" })
            });
          } catch (e) { console.error("Failed to update prescription status:", e); }
        }
      }

      setAppointment({ ...appointment, status: "completed" });
      setShowCompleteModal(false);
      loadData();
      onBack ? onBack() : router.push("/doctor?tab=appointments");
    } catch (err) {
      console.error("Error completing visit:", err);
      alert("Failed to complete visit");
    } finally {
      setCompleting(false);
    }
  };

  const deleteMedicine = async (medId: string) => {
    if (!confirm("Delete this medicine?")) return;
    await supabase.from("patient_medicines").delete().eq("id", medId);
    loadData();
  };

  const toggleCollected = async (medId: string, currentlyCollected: boolean) => {
    await supabase.from("patient_medicines").update({
      medicine_collected: !currentlyCollected,
      collected_at: !currentlyCollected ? new Date().toISOString() : null,
    }).eq("id", medId);
    loadData();
  };

  const deleteTest = async (testId: string) => {
    if (!confirm("Delete this test?")) return;
    await supabase.from("patient_tests").delete().eq("id", testId);
    loadData();
  };

  const deleteDiet = async (dietId: string) => {
    if (!confirm("Delete this diet plan?")) return;
    await supabase.from("patient_diets").delete().eq("id", dietId);
    loadData();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">Appointment not found</p>
          <button onClick={() => onBack ? onBack() : router.push("/doctor?tab=appointments")} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg">
            Back to Appointments
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => onBack ? onBack() : router.push("/doctor?tab=appointments")} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Patient Details</h1>
        </div>

        {/* Patient Info Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                <User className="w-8 h-8 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">{appointment.patient_name}</h2>
                  <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-gray-600">
                    <span className="flex items-center gap-1 min-w-0"><Mail className="w-4 h-4 shrink-0" /><span className="truncate">{appointment.patient_email}</span></span>
                  <span className="flex items-center gap-1"><Calendar className="w-4 h-4" />{new Date(appointment.appointment_date).toLocaleDateString()}</span>
                  <span className="flex items-center gap-1"><Building2 className="w-4 h-4" />{appointment.hospital_name}</span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  {isCurrentAppointment && !isCompleted && (
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">Today</span>
                  )}
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    appointment.status === "scheduled" ? "bg-blue-100 text-blue-700" :
                    appointment.status === "in-consultation" ? "bg-amber-100 text-amber-700" :
                    appointment.status === "completed" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                  }`}>
                    {appointment.status === "scheduled" ? "Waiting" :
                     appointment.status === "in-consultation" ? "Consulting" :
                     appointment.status === "completed" ? "Completed" : appointment.status}
                  </span>
                  <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">{appointment.case_type}</span>
                </div>
              </div>
            </div>
            {canEdit && (
              <button
                onClick={() => setShowCompleteModal(true)}
                className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-xl font-semibold text-sm shadow-lg hover:from-emerald-600 hover:to-green-700 transition-all shrink-0"
              >
                <CheckCircle2 className="w-5 h-5" />
                Complete Visit
              </button>
            )}
          </div>
        </div>

        {/* Completed Banner */}
        {isCompleted && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <p className="font-semibold text-emerald-800 text-sm">Visit Completed</p>
              <p className="text-xs text-emerald-600">This consultation is finalized. All records are in view-only mode.</p>
            </div>
          </div>
        )}

          {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-white rounded-t-2xl overflow-x-auto">
          <button
            onClick={() => setActiveTab("symptoms")}
            className={`flex-1 px-1 sm:px-3 py-4 font-medium text-[11px] sm:text-sm flex items-center justify-center gap-1 sm:gap-2 transition whitespace-nowrap ${activeTab === "symptoms" ? "bg-rose-50 text-rose-600 border-b-2 border-rose-600" : "text-gray-500 hover:text-gray-700"}`}
          >
            <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" /> <span>Symptoms</span>
          </button>
          <button
            onClick={() => setActiveTab("ai-diagnosis")}
            className={`flex-1 px-1 sm:px-3 py-4 font-medium text-[11px] sm:text-sm flex items-center justify-center gap-1 sm:gap-2 transition whitespace-nowrap ${activeTab === "ai-diagnosis" ? "bg-indigo-50 text-indigo-600 border-b-2 border-indigo-600" : "text-gray-500 hover:text-gray-700"}`}
          >
            <Brain className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" /> <span>AI</span>
          </button>
          <button
            onClick={() => setActiveTab("prescriptions")}
            className={`flex-1 px-1 sm:px-3 py-4 font-medium text-[11px] sm:text-sm flex items-center justify-center gap-1 sm:gap-2 transition whitespace-nowrap ${activeTab === "prescriptions" ? "bg-emerald-50 text-emerald-600 border-b-2 border-emerald-600" : "text-gray-500 hover:text-gray-700"}`}
          >
            <ClipboardList className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" /> <span>Prescriptions</span>
            <span className="bg-emerald-100 text-emerald-700 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px]">{prescriptions.length}</span>
          </button>
          <button
            onClick={() => setActiveTab("medicines")}
            className={`flex-1 px-1 sm:px-3 py-4 font-medium text-[11px] sm:text-sm flex items-center justify-center gap-1 sm:gap-2 transition whitespace-nowrap ${activeTab === "medicines" ? "bg-blue-50 text-blue-600 border-b-2 border-blue-600" : "text-gray-500 hover:text-gray-700"}`}
          >
            <Pill className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" /> <span>Medicines</span>
            <span className="bg-blue-100 text-blue-700 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px]">{medicines.length}</span>
          </button>
          <button
            onClick={() => setActiveTab("reports")}
            className={`flex-1 px-1 sm:px-3 py-4 font-medium text-[11px] sm:text-sm flex items-center justify-center gap-1 sm:gap-2 transition whitespace-nowrap ${activeTab === "reports" ? "bg-purple-50 text-purple-600 border-b-2 border-purple-600" : "text-gray-500 hover:text-gray-700"}`}
          >
            <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" /> <span>Tests</span>
            <span className="bg-purple-100 text-purple-700 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px]">{tests.length}</span>
          </button>
          <button
            onClick={() => setActiveTab("diet")}
            className={`flex-1 px-1 sm:px-3 py-4 font-medium text-[11px] sm:text-sm flex items-center justify-center gap-1 sm:gap-2 transition whitespace-nowrap ${activeTab === "diet" ? "bg-green-50 text-green-600 border-b-2 border-green-600" : "text-gray-500 hover:text-gray-700"}`}
          >
            <Utensils className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" /> <span>Diet</span>
            <span className="bg-green-100 text-green-700 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px]">{diets.length}</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-b-2xl shadow-lg border border-t-0 p-4 sm:p-6">
          {activeTab === "symptoms" && (
            <div className="space-y-4">
              {canEdit && (
                <SymptomsAssessment
                  patientEmail={appointment.patient_email}
                  patientName={appointment.patient_name}
                  hospitalName={appointment.hospital_name}
                  appointmentId={appointment.id}
                  disableAiRedirect
                  onAiComplete={(result) => {
                    setIsAiProcessing(false);
                    setAiDiagnosisData(result);
                    setActiveTab("ai-diagnosis");
                    if (result.symptoms) setSavedSymptoms(result.symptoms);
                  }}
                  onSaved={() => { setIsAiProcessing(true); loadData(true); }}
                  onSwitchToPrescriptions={(data) => {
                    setSavedSymptoms(data.symptoms || "");
                    setActiveTab("prescriptions");
                    setEditPrescriptionId(data.prescriptionId);
                    loadData();
                  }}
                />
              )}
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Recent Symptoms</h4>
                {prescriptions.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <Activity className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">No symptoms recorded yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {prescriptions.slice(0, 5).map(p => {
                      const hasVitals = p.bp_systolic != null || p.bp_diastolic != null || p.temperature != null || p.pulse != null || p.spo2 != null;
                      return (
                      <div key={p.id} className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                        <div className="flex items-start gap-2">
                          <div className="w-6 h-6 rounded-full bg-rose-100 flex items-center justify-center shrink-0 mt-0.5">
                            <Activity className="w-3 h-3 text-rose-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-gray-400">{new Date(p.created_at).toLocaleDateString("en-IN", { day: 'numeric', month: 'short' })}</p>
                            {p.symptoms && <p className="text-sm text-gray-800 mt-1"><span className="font-medium text-rose-600">Symptoms:</span> {p.symptoms}</p>}
                            {p.diagnosis && <p className="text-sm text-gray-800 mt-0.5"><span className="font-medium text-rose-600">Diagnosis:</span> {p.diagnosis}</p>}
                            {hasVitals && (
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {p.bp_systolic != null && p.bp_diastolic != null && <span className="text-[10px] px-2 py-0.5 bg-red-50 text-red-700 rounded-full border border-red-200">BP {p.bp_systolic}/{p.bp_diastolic}</span>}
                                {p.pulse != null && <span className="text-[10px] px-2 py-0.5 bg-orange-50 text-orange-700 rounded-full border border-orange-200">Pulse {p.pulse}</span>}
                                {p.temperature != null && <span className="text-[10px] px-2 py-0.5 bg-yellow-50 text-yellow-700 rounded-full border border-yellow-200">Temp {p.temperature}°C</span>}
                                {p.spo2 != null && <span className="text-[10px] px-2 py-0.5 bg-teal-50 text-teal-700 rounded-full border border-teal-200">SpO₂ {p.spo2}%</span>}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "ai-diagnosis" && (
            <div className="space-y-4">
              {!aiDiagnosisData && !isAiProcessing && (
                <div className="text-center py-10">
                  <div className="w-16 h-16 rounded-2xl bg-indigo-100 flex items-center justify-center mx-auto mb-4">
                    <Brain className="w-8 h-8 text-indigo-600" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-800 mb-2">AI Diagnosis</h3>
                  <p className="text-sm text-gray-500 mb-2">Complete the Symptoms Assessment to generate an AI-powered diagnosis.</p>
                  <button onClick={() => setActiveTab("symptoms")} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium">
                    Go to Symptoms
                  </button>
                </div>
              )}
              {isAiProcessing && !aiDiagnosisData && (
                <div className="text-center py-10">
                  <div className="w-16 h-16 rounded-2xl bg-indigo-100 flex items-center justify-center mx-auto mb-4">
                    <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-800 mb-2">AI Analysis in Progress</h3>
                  <p className="text-sm text-gray-500">The DxGPT AI is analyzing symptoms and vitals...</p>
                </div>
              )}
              {aiDiagnosisData && (
                <div className="space-y-4">
                  {/* Primary Diagnosis */}
                  <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 text-white">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-5 h-5" />
                      <span className="text-xs font-medium text-indigo-200 uppercase tracking-wider">Primary Diagnosis</span>
                    </div>
                    <h2 className="text-2xl font-bold">{aiDiagnosisData.ai_diagnosis}</h2>
                  </div>

                  {/* Predictions */}
                  {aiDiagnosisData.ai_disease_predictions?.length > 0 && (
                    <div className="bg-white rounded-2xl border border-indigo-100 p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <Brain className="w-5 h-5 text-indigo-600" />
                        <h3 className="text-sm font-bold text-gray-800">Predicted Diseases</h3>
                        <span className="text-[10px] px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full">{aiDiagnosisData.ai_disease_predictions.length} conditions</span>
                      </div>
                      <div className="space-y-2.5">
                        {aiDiagnosisData.ai_disease_predictions.map((pred: any, i: number) => {
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

                  {/* Suggested Tests */}
                  {aiDiagnosisData.ai_suggested_tests?.length > 0 && (
                    <div className="bg-white rounded-2xl border border-purple-100 p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <FlaskConical className="w-5 h-5 text-purple-600" />
                        <h3 className="text-sm font-bold text-gray-800">Suggested Investigations</h3>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {aiDiagnosisData.ai_suggested_tests.map((test: string, i: number) => (
                          <span key={i} className="text-xs px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg border border-purple-200">{test}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* AI Notes */}
                  {aiDiagnosisData.ai_notes && (
                    <div className="bg-white rounded-2xl border border-gray-100 p-5">
                      <h3 className="text-sm font-bold text-gray-800 mb-2">AI Notes</h3>
                      <p className="text-sm text-gray-600 leading-relaxed">{aiDiagnosisData.ai_notes}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => {
                        const preFill = {
                          diagnosis: aiDiagnosisData.ai_diagnosis,
                          suggestedTests: aiDiagnosisData.ai_suggested_tests || [],
                          symptoms: savedSymptoms || undefined,
                        };
                        setAiPreFill(preFill);
                        setAiDiagnosisData(null);
                        setActiveTab("prescriptions");
                      }}
                      className="flex-1 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-semibold text-sm shadow-lg flex items-center justify-center gap-2 transition"
                    >
                      <Sparkles className="w-5 h-5" /> Accept AI & Create Prescription
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "prescriptions" && (
            <div className="space-y-4">
              {canEdit && !editPrescriptionId && (
                <PrescriptionForm patientEmail={appointment.patient_email} patientName={appointment.patient_name} hospitalName={appointment.hospital_name} appointmentId={appointment.id} aiPreFill={aiPreFill} onSaved={() => { setAiPreFill(null); loadData(); }} onCompleteVisitSuggested={async () => { await fetch(`${API_URL}/api/healthcare/appointments/${appointment.id}/status`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "completed" }) }).catch(() => {}); setAiPreFill(null); loadData(); onBack ? onBack() : router.push("/doctor?tab=appointments"); }} />
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
                    onSaved={() => { setEditPrescriptionId(null); loadData(); }}
                    onCancel={() => setEditPrescriptionId(null)}
                    initialData={{ id: p.id, symptoms: p.symptoms, diagnosis: p.diagnosis, prescription_notes: p.prescription_notes, medicines: p.medicines, follow_up_date: p.follow_up_date }}
                  />
                );
              })()}
              {prescriptions.length === 0 ? (
                <div className="text-center py-8">
                  <ClipboardList className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">No prescriptions yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {prescriptions.map(p => {
                    let medsList: { name: string; dosage?: string; route?: string; instructions?: string; is_prn?: boolean }[] = [];
                    try { const parsed = JSON.parse(p.medicines || "[]"); medsList = Array.isArray(parsed) ? parsed : []; } catch {}
                    return (
                      <div key={p.id} className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-[11px] text-gray-400">{new Date(p.created_at).toLocaleDateString("en-IN", { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                              p.status === "Active" ? "bg-green-100 text-green-700" :
                              p.status === "Completed" ? "bg-blue-100 text-blue-700" :
                              "bg-gray-100 text-gray-600"
                            }`}>{p.status || "Active"}</span>
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
                            {p.temperature != null && <span className="text-[10px] px-2 py-0.5 bg-yellow-50 text-yellow-700 rounded-full border border-yellow-200">Temp {p.temperature}°C</span>}
                            {p.spo2 != null && <span className="text-[10px] px-2 py-0.5 bg-teal-50 text-teal-700 rounded-full border border-teal-200">SpO₂ {p.spo2}%</span>}
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
            <div className="space-y-4">
              {canEdit && (
                <button onClick={() => setShowAddMedicine(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium flex items-center gap-2 w-fit">
                  <Plus className="w-4 h-4" /> Add Medicine
                </button>
              )}
              <MedicineForm
                open={showAddMedicine}
                onClose={() => setShowAddMedicine(false)}
                onSave={handleSaveMedicine}
                existingMedicineNames={medicines.map(m => m.medicine_name)}
              />
              {medicines.length === 0 ? (
                <div className="text-center py-12 text-gray-500">No medicines prescribed</div>
              ) : (
                <div className="space-y-3">
                  {medicines.map(med => (
                    <div key={med.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-gray-900">{med.medicine_name}</span>
                            {med.is_prn && <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px] font-medium">PRN</span>}
                            <span className={`px-2 py-0.5 rounded text-xs ${med.is_active ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}`}>{med.is_active ? "Active" : "Inactive"}</span>
                            {med.medicine_collected ? (
                              <button onClick={() => toggleCollected(med.id, true)} className="px-2 py-0.5 rounded text-xs bg-emerald-100 text-emerald-700 flex items-center gap-0.5 hover:bg-emerald-200">
                                <CheckCircle2 className="w-3 h-3" /> Collected
                              </button>
                            ) : canEdit && (
                              <button onClick={() => toggleCollected(med.id, false)} className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600 flex items-center gap-0.5 hover:bg-gray-200">
                                Mark Collected
                              </button>
                            )}
                          </div>
                          <div className="text-sm text-gray-600 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                            {med.dosage && <span>💊 {med.dosage}</span>}
                            {med.route && <span>💉 {med.route}</span>}
                            {med.frequency && <span>📅 {med.frequency}</span>}
                            {med.timing && <span>⏰ {med.timing}</span>}
                            {med.duration && <span>📆 {med.duration}</span>}
                            {med.quantity && <span>📦 {med.quantity}</span>}
                            {med.refills && med.refills !== "0" && <span>🔄 Refill: {med.refills}</span>}
                          </div>
                          {med.instructions && <div className="text-xs text-gray-500 mt-1">Note: {med.instructions}</div>}
                        </div>
                        {canEdit && (
                          <button onClick={() => deleteMedicine(med.id)} className="p-2 text-red-600 hover:bg-red-50 rounded shrink-0">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "reports" && (
            <div className="space-y-4">
              {canEdit && (
                <button onClick={() => setShowAddTest(true)} className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium flex items-center gap-2 w-fit">
                  <Plus className="w-4 h-4" /> Add Test
                </button>
              )}
              {tests.length === 0 ? (
                <div className="text-center py-12 text-gray-500">No tests ordered</div>
              ) : (
                <div className="space-y-3">
                  {tests.map(test => (
                    <div key={test.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200 flex justify-between items-start">
                      <div>
                        <span className="font-medium text-gray-900">{test.test_type}</span>
                        <span className={`ml-2 px-2 py-0.5 rounded text-xs ${
                          test.status === "completed" ? "bg-green-100 text-green-700" :
                          test.status === "confirmed" ? "bg-blue-100 text-blue-700" : "bg-yellow-100 text-yellow-700"
                        }`}>{test.status}</span>
                        {test.notes && <div className="text-xs text-gray-500 mt-1">Note: {test.notes}</div>}
                      </div>
                      {canEdit && <button onClick={() => deleteTest(test.id)} className="p-2 text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "diet" && (
            <div className="space-y-4">
              {canEdit && (
                <button onClick={() => setShowAddDiet(true)} className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium flex items-center gap-2 w-fit">
                  <Plus className="w-4 h-4" /> Add Diet Plan
                </button>
              )}
              {diets.length === 0 ? (
                <div className="text-center py-12 text-gray-500">No diet plans added</div>
              ) : (
                <div className="space-y-3">
                  {diets.map(diet => (
                    <div key={diet.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200 flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{diet.diet_name}</span>
                          <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">{diet.diet_type}</span>
                          <span className={`px-2 py-0.5 rounded text-xs ${diet.is_active ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}`}>{diet.is_active ? "Active" : "Inactive"}</span>
                        </div>
                        {diet.timing && <div className="text-sm text-gray-600 mt-1">Time: {diet.timing}</div>}
                        {diet.foods && <div className="text-xs text-gray-500 mt-1">Foods: {diet.foods}</div>}
                      </div>
                      {canEdit && <button onClick={() => deleteDiet(diet.id)} className="p-2 text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add Test Modal */}
      {showAddTest && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center p-3 sm:p-4 pt-16 sm:pt-20 z-[9999] overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-md my-4 mx-1 sm:mx-0 p-4 sm:p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base sm:text-lg font-semibold">Add Test</h3>
              <button onClick={() => setShowAddTest(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Test Type</label>
                <select value={newTest.test_type} onChange={(e) => setNewTest({ ...newTest, test_type: e.target.value })} className="w-full rounded-lg border-2 border-gray-200 px-3 sm:px-4 py-2.5 text-sm focus:border-purple-500 focus:outline-none bg-white">
                  {TEST_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={newTest.notes} onChange={(e) => setNewTest({ ...newTest, notes: e.target.value })} rows={2} className="w-full rounded-lg border-2 border-gray-200 px-3 sm:px-4 py-2.5 text-sm focus:border-purple-500 focus:outline-none resize-none" />
              </div>
              <button onClick={handleAddTest} className="w-full px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium text-sm">Add Test</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Diet Modal */}
      {showAddDiet && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center p-3 sm:p-4 pt-16 sm:pt-20 z-[9999] overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-md my-4 mx-1 sm:mx-0 p-4 sm:p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base sm:text-lg font-semibold">Add Diet Plan</h3>
              <button onClick={() => setShowAddDiet(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Diet Name *</label>
                <input type="text" value={newDiet.diet_name} onChange={(e) => setNewDiet({ ...newDiet, diet_name: e.target.value })} className="w-full rounded-lg border-2 border-gray-200 px-3 sm:px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Diet Type</label>
                  <select value={newDiet.diet_type} onChange={(e) => setNewDiet({ ...newDiet, diet_type: e.target.value })} className="w-full rounded-lg border-2 border-gray-200 px-3 sm:px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none bg-white">
                    {DIET_TYPES.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Timing</label>
                  <select value={newDiet.timing} onChange={(e) => setNewDiet({ ...newDiet, timing: e.target.value })} className="w-full rounded-lg border-2 border-gray-200 px-3 sm:px-4 py-2.5 text-sm focus:border-green-500 focus:outline-none bg-white">
                    <option value="Morning (8 AM)">Morning (8 AM)</option>
                    <option value="Mid-morning (11 AM)">Mid-morning (11 AM)</option>
                    <option value="Lunch (1 PM)">Lunch (1 PM)</option>
                    <option value="Afternoon (4 PM)">Afternoon (4 PM)</option>
                    <option value="Dinner (8 PM)">Dinner (8 PM)</option>
                    <option value="Bedtime">Bedtime</option>
                  </select>
                </div>
              </div>
              <button onClick={handleAddDiet} className="w-full px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium text-sm">Add Diet Plan</button>
            </div>
          </div>
        </div>
      )}

      {/* Complete Visit Modal */}
      {showCompleteModal && appointment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-2 sm:p-4 z-[9999] overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] mx-auto shadow-2xl flex flex-col">
            <div className="p-4 sm:p-6 overflow-y-auto">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-bold text-gray-900">Complete Visit</h3>
                <p className="text-xs sm:text-sm text-gray-500 truncate">{appointment.patient_name}</p>
              </div>
            </div>

            {/* Summary */}
            <div className="bg-gray-50 rounded-xl p-3 sm:p-4 mb-4 space-y-2">
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
      </div>
      )}
    </div>
  );
}

export default function PatientDetailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const appointmentId = searchParams.get("id");
  return <PatientDetailContent appointmentId={appointmentId || ""} onBack={() => router.push("/doctor?tab=appointments")} />;
}