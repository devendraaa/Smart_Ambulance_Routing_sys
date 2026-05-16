"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, User, Calendar, Pill, FileText, Utensils, Plus, X, Check, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface PatientInfo {
  id: string;
  email: string;
  name?: string;
  age?: number;
  address?: string;
  phone?: string;
}

interface PatientAppointment {
  id: string;
  patient_name: string;
  appointment_date: string;
  case_type: string;
  hospital_name: string;
  status: string;
}

interface PatientMedicine {
  id: string;
  medicine_name: string;
  dosage: string;
  frequency: string;
  timing: string;
  duration: string;
  is_active: boolean;
  created_at: string;
}

interface PatientTest {
  id: string;
  test_type: string;
  status: string;
  created_at: string;
  report_url?: string;
}

interface PatientDiet {
  id: string;
  diet_name: string;
  diet_type: string;
  calories: string;
  timing: string;
  foods: string;
  instructions: string;
  created_at: string;
  is_active: boolean;
}

const MEDICINE_FREQUENCIES = ["Once daily", "Twice daily", "Thrice daily", "Four times a day", "Every 8 hours", "As needed"];
const MEDICINE_TIMINGS = ["Morning", "Afternoon", "Evening", "Night", "Before food", "After food", "With food"];
const MEDICINE_DURATIONS = ["3 days", "5 days", "7 days", "10 days", "14 days", "21 days", "30 days", "45 days", "60 days"];

const TEST_TYPES = [
  "Blood Test", "Urine Test", "X-Ray", "MRI", "CT Scan", "ECG",
  "Sonography", "Echo Cardiography", "Endoscopy", "Biopsy",
  "Lipid Profile", "Thyroid Test", "Diabetes Test", "CBC"
];

const DIET_TYPES = ["Weight Loss", "Weight Gain", "Diabetic", "Heart Care", "Low Sodium", "High Protein", "General"];
const DIET_TIMINGS = ["Before Breakfast", "Breakfast", "Mid-Morning", "Lunch", "Evening Snack", "Dinner", "Bedtime"];

export default function DoctorPatientInfo() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState<"email" | "name">("email");
  const [loading, setLoading] = useState(false);
  const [patient, setPatient] = useState<PatientInfo | null>(null);
  const [appointments, setAppointments] = useState<PatientAppointment[]>([]);
  const [medicines, setMedicines] = useState<PatientMedicine[]>([]);
  const [tests, setTests] = useState<PatientTest[]>([]);
  const [diets, setDiets] = useState<PatientDiet[]>([]);
  const [activeSection, setActiveSection] = useState<"appointments" | "medicines" | "reports" | "diet">("appointments");
  const [clearSearch, setClearSearch] = useState(false);

  // Add Medicine form state
  const [showMedicineForm, setShowMedicineForm] = useState(false);
  const [medicineForm, setMedicineForm] = useState({
    medicine_name: "", dosage: "", frequency: "", timing: "", duration: ""
  });
  const [savingMedicine, setSavingMedicine] = useState(false);

  // Add Test form state
  const [showTestForm, setShowTestForm] = useState(false);
  const [testForm, setTestForm] = useState({ test_type: "" });
  const [savingTest, setSavingTest] = useState(false);

  // Add Diet form state
  const [showDietForm, setShowDietForm] = useState(false);
  const [dietForm, setDietForm] = useState({
    diet_name: "", diet_type: "", calories: "", timing: "", foods: "", instructions: ""
  });
  const [savingDiet, setSavingDiet] = useState(false);

  const searchPatient = async () => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    try {
      if (searchType === "email") {
        const { data: aptData } = await supabase
          .from("patient_appointments")
          .select("*")
          .eq("patient_email", searchQuery.trim())
          .limit(1)
          .single();

        if (aptData) {
          setPatient({ id: aptData.id, email: aptData.patient_email, name: aptData.patient_name });
          setClearSearch(true);
          await loadPatientData(aptData.patient_email);
        } else {
          const { data: medData } = await supabase
            .from("patient_medicines")
            .select("id, patient_email")
            .eq("patient_email", searchQuery.trim())
            .limit(1)
            .single();

          if (medData) {
            setPatient({ id: medData.id, email: medData.patient_email });
            setClearSearch(true);
            await loadPatientData(medData.patient_email);
          } else {
            alert("Patient not found");
          }
        }
      } else {
        const { data: aptData } = await supabase
          .from("patient_appointments")
          .select("*")
          .ilike("patient_name", `%${searchQuery.trim()}%`)
          .limit(1)
          .single();

        if (aptData) {
          setPatient({ id: aptData.id, email: aptData.patient_email, name: aptData.patient_name });
          setClearSearch(true);
          await loadPatientData(aptData.patient_email);
        } else {
          alert("Patient not found");
        }
      }
    } catch (err) {
      console.error("Search error:", err);
      alert("Error searching patient");
    } finally {
      setLoading(false);
    }
  };

  const loadPatientData = async (email: string) => {
    try {
      const { data: aptData } = await supabase
        .from("patient_appointments")
        .select("*")
        .eq("patient_email", email)
        .order("created_at", { ascending: false });
      setAppointments(aptData || []);

      const { data: medData } = await supabase
        .from("patient_medicines")
        .select("*")
        .eq("patient_email", email)
        .order("created_at", { ascending: false });
      setMedicines(medData || []);

      const { data: testData } = await supabase
        .from("patient_tests")
        .select("*")
        .eq("patient_email", email)
        .order("created_at", { ascending: false });
      setTests(testData || []);

      const { data: dietData } = await supabase
        .from("patient_diets")
        .select("*")
        .eq("patient_email", email)
        .order("created_at", { ascending: false });
      setDiets(dietData || []);
    } catch (err) {
      console.error("Error loading patient data:", err);
    }
  };

  const addMedicine = async () => {
    if (!patient || !medicineForm.medicine_name) return;
    setSavingMedicine(true);
    try {
      const { error } = await supabase.from("patient_medicines").insert({
        patient_email: patient.email,
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
      await loadPatientData(patient.email);
    } catch (err) {
      console.error("Error adding medicine:", err);
      alert("Failed to add medicine");
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
        test_type: testForm.test_type,
        status: "pending",
        payment_status: "unpaid",
      });
      if (error) throw error;
      setTestForm({ test_type: "" });
      setShowTestForm(false);
      await loadPatientData(patient.email);
    } catch (err) {
      console.error("Error adding test:", err);
      alert("Failed to add test");
    } finally {
      setSavingTest(false);
    }
  };

  const addDiet = async () => {
    if (!patient || !dietForm.diet_name) return;
    setSavingDiet(true);
    try {
      const { error } = await supabase.from("patient_diets").insert({
        patient_email: patient.email,
        diet_name: dietForm.diet_name,
        diet_type: dietForm.diet_type,
        calories: dietForm.calories,
        timing: dietForm.timing,
        foods: dietForm.foods,
        instructions: dietForm.instructions,
        is_active: true,
      });
      if (error) throw error;
      setDietForm({ diet_name: "", diet_type: "", calories: "", timing: "", foods: "", instructions: "" });
      setShowDietForm(false);
      await loadPatientData(patient.email);
    } catch (err) {
      console.error("Error adding diet:", err);
      alert("Failed to add diet plan");
    } finally {
      setSavingDiet(false);
    }
  };

  const toggleMedicineStatus = async (medicineId: string, currentStatus: boolean) => {
    try {
      await supabase.from("patient_medicines").update({ is_active: !currentStatus }).eq("id", medicineId);
      if (patient) await loadPatientData(patient.email);
    } catch (err) {
      console.error("Error updating medicine:", err);
    }
  };

  const clearPatient = () => {
    setPatient(null);
    setAppointments([]);
    setMedicines([]);
    setTests([]);
    setDiets([]);
    setSearchQuery("");
    setClearSearch(false);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Search Section - Only show when no patient selected */}
      {!patient && (
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 sm:p-8 shadow-xl">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Find Patient</h2>
            <p className="text-blue-100 text-sm">Search by patient email or name to view records</p>
          </div>
          <div className="max-w-2xl mx-auto">
            <div className="flex flex-col sm:flex-row gap-3">
              <select
                value={searchType}
                onChange={(e) => setSearchType(e.target.value as "email" | "name")}
                className="rounded-xl border-2 border-white/30 bg-white/20 px-4 py-3 focus:border-white focus:outline-none text-white placeholder-white/70 text-sm backdropdrop backdrop-blur-sm"
                style={{ colorScheme: 'dark' }}
              >
                <option value="email" style={{color: '#1f2937'}}>Search by Email</option>
                <option value="name" style={{color: '#1f2937'}}>Search by Name</option>
              </select>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={searchType === "email" ? "Enter patient email" : "Enter patient name"}
                className="flex-1 rounded-xl border-2 border-white/30 bg-white/20 px-4 py-3 focus:border-white focus:outline-none text-white placeholder-white/70 text-sm backdrop-blur"
                style={{ colorScheme: 'dark' }}
                onKeyDown={(e) => e.key === "Enter" && searchPatient()}
              />
              <button
                onClick={searchPatient}
                disabled={loading}
                className="px-8 py-3 bg-white text-blue-600 hover:bg-blue-50 rounded-xl font-semibold transition disabled:opacity-50 text-sm shadow-lg"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Searching...
                  </span>
                ) : (
                  "Search"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Patient Info & Data Sections */}
      {patient && (
        <>
          {/* Patient Header Card */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-5 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
                  <User className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{patient.name || "Patient"}</h3>
                  <p className="text-blue-100 text-sm">{patient.email}</p>
                </div>
              </div>
              <button
                onClick={clearPatient}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg font-medium text-sm transition flex items-center gap-2"
              >
                <Search className="w-4 h-4" />
                Search Another
              </button>
            </div>
          </div>

          {/* Sub-section Tabs */}
          <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => setActiveSection("appointments")}
              className={`px-4 sm:px-5 py-2.5 rounded-lg font-medium text-xs sm:text-sm whitespace-nowrap transition flex items-center gap-2 ${
                activeSection === "appointments"
                  ? "bg-blue-600 text-white shadow-md"
                  : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
              }`}
            >
              <Calendar className="w-4 h-4" />
              Appointments
              <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${activeSection === "appointments" ? "bg-white/20" : "bg-gray-100"}`}>
                {appointments.length}
              </span>
            </button>
            <button
              onClick={() => setActiveSection("medicines")}
              className={`px-4 sm:px-5 py-2.5 rounded-lg font-medium text-xs sm:text-sm whitespace-nowrap transition flex items-center gap-2 ${
                activeSection === "medicines"
                  ? "bg-blue-600 text-white shadow-md"
                  : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
              }`}
            >
              <Pill className="w-4 h-4" />
              Medicines
              <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${activeSection === "medicines" ? "bg-white/20" : "bg-gray-100"}`}>
                {medicines.length}
              </span>
            </button>
            <button
              onClick={() => setActiveSection("reports")}
              className={`px-4 sm:px-5 py-2.5 rounded-lg font-medium text-xs sm:text-sm whitespace-nowrap transition flex items-center gap-2 ${
                activeSection === "reports"
                  ? "bg-blue-600 text-white shadow-md"
                  : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
              }`}
            >
              <FileText className="w-4 h-4" />
              Reports
              <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${activeSection === "reports" ? "bg-white/20" : "bg-gray-100"}`}>
                {tests.length}
              </span>
            </button>
            <button
              onClick={() => setActiveSection("diet")}
              className={`px-4 sm:px-5 py-2.5 rounded-lg font-medium text-xs sm:text-sm whitespace-nowrap transition flex items-center gap-2 ${
                activeSection === "diet"
                  ? "bg-blue-600 text-white shadow-md"
                  : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
              }`}
            >
              <Utensils className="w-4 h-4" />
              Diet Plans
              <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${activeSection === "diet" ? "bg-white/20" : "bg-gray-100"}`}>
                {diets.length}
              </span>
            </button>
          </div>

          {/* Section Tabs */}
          <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => setActiveSection("appointments")}
              className={`px-3 sm:px-4 py-2 rounded-lg font-medium text-xs sm:text-sm whitespace-nowrap transition ${
                activeSection === "appointments" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 inline mr-1" />
              <span className="hidden xs:inline">Appointments</span>
              <span className="xs:hidden">Apt</span>
              <span className="ml-1">({appointments.length})</span>
            </button>
            <button
              onClick={() => setActiveSection("medicines")}
              className={`px-3 sm:px-4 py-2 rounded-lg font-medium text-xs sm:text-sm whitespace-nowrap transition ${
                activeSection === "medicines" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <Pill className="w-3.5 h-3.5 sm:w-4 sm:h-4 inline mr-1" />
              <span className="hidden xs:inline">Medicines</span>
              <span className="xs:hidden">Meds</span>
              <span className="ml-1">({medicines.length})</span>
            </button>
            <button
              onClick={() => setActiveSection("reports")}
              className={`px-3 sm:px-4 py-2 rounded-lg font-medium text-xs sm:text-sm whitespace-nowrap transition ${
                activeSection === "reports" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 inline mr-1" />
              <span className="hidden xs:inline">Reports</span>
              <span className="xs:hidden">Rpts</span>
              <span className="ml-1">({tests.length})</span>
            </button>
            <button
              onClick={() => setActiveSection("diet")}
              className={`px-3 sm:px-4 py-2 rounded-lg font-medium text-xs sm:text-sm whitespace-nowrap transition ${
                activeSection === "diet" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <Utensils className="w-3.5 h-3.5 sm:w-4 sm:h-4 inline mr-1" />
              <span className="hidden xs:inline">Diet</span>
              <span className="xs:hidden">Diet</span>
              <span className="ml-1">({diets.length})</span>
            </button>
          </div>

          {/* Section Content */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
            {/* APPOINTMENTS */}
            {activeSection === "appointments" && (
              <div className="space-y-3">
                <p className="text-sm text-gray-500">Patient appointment history</p>
                {appointments.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No appointments found</p>
                ) : (
                  appointments.map((apt) => (
                    <div key={apt.id} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-gray-900">{apt.patient_name}</p>
                          <p className="text-sm text-gray-600">{apt.hospital_name}</p>
                          <p className="text-sm text-gray-500">{apt.case_type}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-600">{new Date(apt.appointment_date).toLocaleDateString("en-IN")}</p>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            apt.status === "scheduled" ? "bg-blue-100 text-blue-700" :
                            apt.status === "completed" ? "bg-green-100 text-green-700" :
                            "bg-red-100 text-red-700"
                          }`}>
                            {apt.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* MEDICINES */}
            {activeSection === "medicines" && (
              <div className="space-y-4">
                {/* Add Medicine Button/Form */}
                {showMedicineForm ? (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-semibold text-gray-900">Add Prescription</h3>
                      <button onClick={() => setShowMedicineForm(false)} className="p-1 hover:bg-blue-100 rounded-lg">
                        <X className="w-5 h-5 text-gray-500" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Medicine Name *</label>
                        <input
                          type="text"
                          value={medicineForm.medicine_name}
                          onChange={(e) => setMedicineForm({ ...medicineForm, medicine_name: e.target.value })}
                          placeholder="e.g., Paracetamol"
                          className="w-full rounded-lg border border-blue-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Dosage</label>
                        <input
                          type="text"
                          value={medicineForm.dosage}
                          onChange={(e) => setMedicineForm({ ...medicineForm, dosage: e.target.value })}
                          placeholder="e.g., 500mg"
                          className="w-full rounded-lg border border-blue-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Frequency</label>
                        <select
                          value={medicineForm.frequency}
                          onChange={(e) => setMedicineForm({ ...medicineForm, frequency: e.target.value })}
                          className="w-full rounded-lg border border-blue-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none bg-white"
                        >
                          <option value="">Select frequency</option>
                          {MEDICINE_FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Timing</label>
                        <select
                          value={medicineForm.timing}
                          onChange={(e) => setMedicineForm({ ...medicineForm, timing: e.target.value })}
                          className="w-full rounded-lg border border-blue-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none bg-white"
                        >
                          <option value="">Select timing</option>
                          {MEDICINE_TIMINGS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Duration</label>
                        <select
                          value={medicineForm.duration}
                          onChange={(e) => setMedicineForm({ ...medicineForm, duration: e.target.value })}
                          className="w-full rounded-lg border border-blue-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none bg-white"
                        >
                          <option value="">Select duration</option>
                          {MEDICINE_DURATIONS.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>
                    </div>
                    <button
                      onClick={addMedicine}
                      disabled={savingMedicine || !medicineForm.medicine_name}
                      className="mt-4 w-full sm:w-auto px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {savingMedicine ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      Save Prescription
                    </button>
                  </motion.div>
                ) : (
                  <button
                    onClick={() => setShowMedicineForm(true)}
                    className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-blue-400 hover:text-blue-600 transition flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Add New Prescription
                  </button>
                )}

                {/* Medicines List */}
                <div className="space-y-3">
                  {medicines.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No prescriptions found</p>
                  ) : (
                    medicines.map((med) => (
                      <div key={med.id} className="p-3 bg-gray-50 rounded-lg flex justify-between items-start">
                        <div>
                          <p className="font-medium text-gray-900">{med.medicine_name}</p>
                          <p className="text-sm text-gray-600">
                            {med.dosage && `Dosage: ${med.dosage}`}
                            {med.frequency && ` | ${med.frequency}`}
                          </p>
                          <p className="text-sm text-gray-500">
                            {med.timing && `${med.timing}`}
                            {med.duration && ` | ${med.duration}`}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <button
                            onClick={() => toggleMedicineStatus(med.id, med.is_active)}
                            className={`text-xs px-3 py-1 rounded-full cursor-pointer ${
                              med.is_active ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                            }`}
                          >
                            {med.is_active ? "Active" : "Inactive"}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* REPORTS/TESTS */}
            {activeSection === "reports" && (
              <div className="space-y-4">
                {/* Add Test Button/Form */}
                {showTestForm ? (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-purple-50 rounded-xl p-4 border border-purple-200">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-semibold text-gray-900">Order New Test</h3>
                      <button onClick={() => setShowTestForm(false)} className="p-1 hover:bg-purple-100 rounded-lg">
                        <X className="w-5 h-5 text-gray-500" />
                      </button>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Test Type *</label>
                      <select
                        value={testForm.test_type}
                        onChange={(e) => setTestForm({ test_type: e.target.value })}
                        className="w-full rounded-lg border border-purple-200 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none bg-white"
                      >
                        <option value="">Select test type</option>
                        {TEST_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <button
                      onClick={addTest}
                      disabled={savingTest || !testForm.test_type}
                      className="mt-4 w-full sm:w-auto px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {savingTest ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      Order Test
                    </button>
                  </motion.div>
                ) : (
                  <button
                    onClick={() => setShowTestForm(true)}
                    className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-purple-400 hover:text-purple-600 transition flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Order New Test
                  </button>
                )}

                {/* Tests List */}
                <div className="space-y-3">
                  {tests.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No tests ordered</p>
                  ) : (
                    tests.map((test) => (
                      <div key={test.id} className="p-3 bg-gray-50 rounded-lg flex justify-between items-start">
                        <div>
                          <p className="font-medium text-gray-900">{test.test_type}</p>
                          <p className="text-sm text-gray-500">Ordered: {new Date(test.created_at).toLocaleDateString("en-IN")}</p>
                        </div>
                        <span className={`text-xs px-3 py-1 rounded-full ${
                          test.status === "completed" ? "bg-green-100 text-green-700" :
                          test.status === "confirmed" ? "bg-blue-100 text-blue-700" :
                          test.status === "pending" ? "bg-yellow-100 text-yellow-700" :
                          "bg-gray-100 text-gray-600"
                        }`}>
                          {test.status}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* DIET */}
            {activeSection === "diet" && (
              <div className="space-y-4">
                {/* Add Diet Button/Form */}
                {showDietForm ? (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-green-50 rounded-xl p-4 border border-green-200">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-semibold text-gray-900">Create Diet Plan</h3>
                      <button onClick={() => setShowDietForm(false)} className="p-1 hover:bg-green-100 rounded-lg">
                        <X className="w-5 h-5 text-gray-500" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Diet Plan Name *</label>
                        <input
                          type="text"
                          value={dietForm.diet_name}
                          onChange={(e) => setDietForm({ ...dietForm, diet_name: e.target.value })}
                          placeholder="e.g., Morning Nutrition Plan"
                          className="w-full rounded-lg border border-green-200 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Diet Type</label>
                        <select
                          value={dietForm.diet_type}
                          onChange={(e) => setDietForm({ ...dietForm, diet_type: e.target.value })}
                          className="w-full rounded-lg border border-green-200 px-3 py-2 text-sm focus:border-green-500 focus:outline-none bg-white"
                        >
                          <option value="">Select type</option>
                          {DIET_TYPES.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Calories</label>
                        <input
                          type="text"
                          value={dietForm.calories}
                          onChange={(e) => setDietForm({ ...dietForm, calories: e.target.value })}
                          placeholder="e.g., 2000 kcal"
                          className="w-full rounded-lg border border-green-200 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Timing</label>
                        <select
                          value={dietForm.timing}
                          onChange={(e) => setDietForm({ ...dietForm, timing: e.target.value })}
                          className="w-full rounded-lg border border-green-200 px-3 py-2 text-sm focus:border-green-500 focus:outline-none bg-white"
                        >
                          <option value="">Select timing</option>
                          {DIET_TIMINGS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Foods (comma separated)</label>
                        <input
                          type="text"
                          value={dietForm.foods}
                          onChange={(e) => setDietForm({ ...dietForm, foods: e.target.value })}
                          placeholder="e.g., Oats, Milk, Fruits, Green vegetables"
                          className="w-full rounded-lg border border-green-200 px-3 py-2 text-sm focus:border-green-500 focus:outline-none"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Instructions</label>
                        <textarea
                          value={dietForm.instructions}
                          onChange={(e) => setDietForm({ ...dietForm, instructions: e.target.value })}
                          placeholder="e.g., Drink 2 liters of water daily, avoid junk food"
                          rows={2}
                          className="w-full rounded-lg border border-green-200 px-3 py-2 text-sm focus:border-green-500 focus:outline-none resize-none"
                        />
                      </div>
                    </div>
                    <button
                      onClick={addDiet}
                      disabled={savingDiet || !dietForm.diet_name}
                      className="mt-4 w-full sm:w-auto px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {savingDiet ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      Create Diet Plan
                    </button>
                  </motion.div>
                ) : (
                  <button
                    onClick={() => setShowDietForm(true)}
                    className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-green-400 hover:text-green-600 transition flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Create New Diet Plan
                  </button>
                )}

                {/* Diet List */}
                <div className="space-y-3">
                  {diets.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No diet plans found</p>
                  ) : (
                    diets.map((diet) => (
                      <div key={diet.id} className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-gray-900">{diet.diet_name}</p>
                            <p className="text-sm text-gray-600">
                              {diet.diet_type && `${diet.diet_type}`}
                              {diet.calories && ` | ${diet.calories}`}
                              {diet.timing && ` | ${diet.timing}`}
                            </p>
                            {diet.foods && <p className="text-sm text-gray-500 mt-1">Foods: {diet.foods}</p>}
                            {diet.instructions && <p className="text-xs text-gray-400 mt-1">Note: {diet.instructions}</p>}
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full ${diet.is_active ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}`}>
                            {diet.is_active ? "Active" : "Inactive"}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}