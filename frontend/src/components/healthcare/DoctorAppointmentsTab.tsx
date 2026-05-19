"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Search, Filter, Pill, FileText, Utensils, X, Plus, Trash2, ChevronRight, User, Stethoscope, Clock } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { fetchHospitalsList } from "@/lib/api";

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
  dosage: string;
  frequency: string;
  timing: string;
  duration: string;
  instructions: string;
  is_active: boolean;
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

// Constants
const DOSAGE_OPTIONS = ["5mg", "10mg", "25mg", "50mg", "100mg", "250mg", "500mg", "1g"];
const FREQUENCY_OPTIONS = ["Once daily", "Twice daily", "Three times daily", "Four times daily", "As needed"];
const TIMING_OPTIONS = ["Before meal", "After meal", "With food", "Empty stomach", "Bedtime"];
const DURATION_OPTIONS = ["3 days", "5 days", "7 days", "10 days", "14 days", "1 month", "2 months", "3 months"];
const TEST_TYPES = ["MRI", "CT Scan", "Sonography", "Blood Test", "X-Ray", "ECG", "ECHO", "TMT", "Urine Test", "Stool Test", "Thyroid", "Sugar Test"];
const DIET_TYPES = ["Weight Loss", "Weight Gain", "Diabetic", "Heart", "Low Salt", "High Protein", "Vegetarian", "Liquid Diet", "Soft Diet", "General"];

const COMMON_MEDICINES = [
  // Fever & Pain
  { name: "Paracetamol 500mg", category: "Fever & Pain" },
  { name: "Paracetamol 650mg", category: "Fever & Pain" },
  { name: "Ibuprofen 400mg", category: "Fever & Pain" },
  { name: "Ibuprofen 600mg", category: "Fever & Pain" },
  { name: "Aspirin 325mg", category: "Fever & Pain" },
  { name: "Naproxen 250mg", category: "Fever & Pain" },
  // Headache
  { name: "Caffeine + Paracetamol", category: "Headache" },
  { name: "Sumatriptan 50mg", category: "Headache" },
  { name: "Betahistine 16mg", category: "Headache" },
  // Body Pain & Muscle
  { name: "Metaxalone 400mg", category: "Body Pain" },
  { name: "Chlorzoxazone 250mg", category: "Body Pain" },
  { name: "Diclofenac Gel", category: "Body Pain" },
  { name: "Volini Gel", category: "Body Pain" },
  // Viral Fever
  { name: "L-Cetizine 5mg", category: "Viral Fever" },
  { name: "Cetirizine 10mg", category: "Viral Fever" },
  { name: "Montelukast 10mg", category: "Viral Fever" },
  { name: "Ambroxol 30mg", category: "Viral Fever" },
  { name: "Levocetirizine 5mg", category: "Viral Fever" },
  // Cold & Cough
  { name: "Cetirizine + Phenylephrine", category: "Cold & Cough" },
  { name: "Phenylephrine 10mg", category: "Cold & Cough" },
  { name: "Phenyramidol 50mg", category: "Cold & Cough" },
  { name: "Chlorpheniramine 4mg", category: "Cold & Cough" },
  { name: "Diphenhydramine 25mg", category: "Cold & Cough" },
  // Antibiotics
  { name: "Azithromycin 500mg", category: "Antibiotics" },
  { name: "Amoxicillin 500mg", category: "Antibiotics" },
  { name: "Ciprofloxacin 500mg", category: "Antibiotics" },
  { name: "Ofloxacin 200mg", category: "Antibiotics" },
  { name: "Metronidazole 400mg", category: "Antibiotics" },
  { name: "Doxycycline 100mg", category: "Antibiotics" },
  // Stomach
  { name: "Pantoprazole 40mg", category: "Stomach" },
  { name: "Omeprazole 20mg", category: "Stomach" },
  { name: "Domperidone 10mg", category: "Stomach" },
  { name: "Ondansetron 4mg", category: "Stomach" },
  { name: "Ranitidine 150mg", category: "Stomach" },
  { name: "Polycrol Suspension", category: "Stomach" },
  // BP & Heart
  { name: "Amlodipine 5mg", category: "BP & Heart" },
  { name: "Amlodipine 10mg", category: "BP & Heart" },
  { name: "Metoprolol 25mg", category: "BP & Heart" },
  { name: "Atenolol 50mg", category: "BP & Heart" },
  { name: "Losartan 50mg", category: "BP & Heart" },
  // Diabetes
  { name: "Metformin 500mg", category: "Diabetes" },
  { name: "Metformin 1000mg", category: "Diabetes" },
  { name: "Glimepride 2mg", category: "Diabetes" },
  { name: "Glimepride 4mg", category: "Diabetes" },
  // Vitamins
  { name: "Vitamin B-Complex", category: "Vitamins" },
  { name: "Vitamin C 500mg", category: "Vitamins" },
  { name: "Vitamin D3 1000IU", category: "Vitamins" },
  { name: "Calcium + Vitamin D", category: "Vitamins" },
  { name: "Iron + Folic Acid", category: "Vitamins" },
  // Skin
  { name: "Miconazole Cream", category: "Skin" },
  { name: "Clindamycin Gel", category: "Skin" },
  { name: "Fusidic Acid Cream", category: "Skin" },
  { name: "Hydrocortisone Cream", category: "Skin" },
];

function isToday(dateString: string): boolean {
  const appointmentDate = new Date(dateString);
  const today = new Date();
  return appointmentDate.toDateString() === today.toDateString();
}

function PatientDetailPanel({
  appointment,
  onClose
}: {
  appointment: Appointment;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"medicines" | "reports" | "diet">("medicines");
  const [medicines, setMedicines] = useState<PatientMedicine[]>([]);
  const [tests, setTests] = useState<PatientTest[]>([]);
  const [diets, setDiets] = useState<PatientDiet[]>([]);
  const [loading, setLoading] = useState(true);

  const isCurrentAppointment = isToday(appointment.appointment_date);

  useEffect(() => {
    loadPatientData();
  }, [appointment.id]);

  const loadPatientData = async () => {
    setLoading(true);
    const appointmentId = appointment.id;
    console.log("Loading data for appointment:", appointmentId);
    try {
      const [medsData, testsData, dietsData] = await Promise.all([
        supabase.from("patient_medicines").select("*").eq("appointment_id", appointmentId).order("created_at", { ascending: false }),
        supabase.from("patient_tests").select("*").eq("appointment_id", appointmentId).order("created_at", { ascending: false }),
        supabase.from("patient_diets").select("*").eq("appointment_id", appointmentId).order("created_at", { ascending: false })
      ]);
      console.log("Medicines:", medsData.data?.length, "Tests:", testsData.data?.length, "Diets:", dietsData.data?.length);
      setMedicines(medsData.data || []);
      setTests(testsData.data || []);
      setDiets(dietsData.data || []);
    } catch (err) {
      console.error("Error loading patient data:", err);
    } finally {
      setLoading(false);
    }
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
                  {isCurrentAppointment && (
                    <span className="px-2 py-0.5 bg-white/20 text-white text-xs rounded-full">Today</span>
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
              <button
                onClick={onClose}
                className="p-1.5 sm:p-2 bg-white/20 hover:bg-white/30 rounded-lg transition"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 bg-gray-50">
            <button
              onClick={() => setActiveTab("medicines")}
              className={`flex-1 px-3 py-3 font-medium text-xs sm:text-sm flex items-center justify-center gap-1.5 transition ${activeTab === "medicines" ? "bg-white text-blue-600 border-b-2 border-blue-600" : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"}`}
            >
              <Pill className="w-4 h-4" />
              <span>Meds</span>
              <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full text-[10px]">{medicines.length}</span>
            </button>
            <button
              onClick={() => setActiveTab("reports")}
              className={`flex-1 px-3 py-3 font-medium text-xs sm:text-sm flex items-center justify-center gap-1.5 transition ${activeTab === "reports" ? "bg-white text-blue-600 border-b-2 border-blue-600" : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"}`}
            >
              <FileText className="w-4 h-4" />
              <span>Tests</span>
              <span className="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full text-[10px]">{tests.length}</span>
            </button>
            <button
              onClick={() => setActiveTab("diet")}
              className={`flex-1 px-3 py-3 font-medium text-xs sm:text-sm flex items-center justify-center gap-1.5 transition ${activeTab === "diet" ? "bg-white text-blue-600 border-b-2 border-blue-600" : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"}`}
            >
              <Utensils className="w-4 h-4" />
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
                {activeTab === "medicines" && (
                  <MedicinesSection patientEmail={appointment.patient_email} patientName={appointment.patient_name} appointmentId={appointment.id} hospitalName={appointment.hospital_name} medicines={medicines} isEditable={isCurrentAppointment} onRefresh={loadPatientData} />
                )}
                {activeTab === "reports" && (
                  <ReportsSection patientEmail={appointment.patient_email} patientName={appointment.patient_name} appointmentId={appointment.id} hospitalName={appointment.hospital_name} tests={tests} isEditable={isCurrentAppointment} onRefresh={loadPatientData} />
                )}
                {activeTab === "diet" && (
                  <DietSection patientEmail={appointment.patient_email} appointmentId={appointment.id} diets={diets} isEditable={isCurrentAppointment} onRefresh={loadPatientData} />
                )}
              </>
            )}
          </div>
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
  const [medicineSearch, setMedicineSearch] = useState("");
  const [showMedicineDropdown, setShowMedicineDropdown] = useState(false);
  const [newMedicine, setNewMedicine] = useState({
    medicine_name: "",
    dosage: "",
    frequency: "Once daily",
    timing: "After meal",
    duration: "7 days",
    instructions: "",
  });

  const handleAddMedicine = async () => {
    if (!newMedicine.medicine_name) {
      alert("Medicine name is required");
      return;
    }

    try {
      const { data, error } = await supabase.from("patient_medicines").insert([{
        patient_email: patientEmail,
        patient_name: patientName,
        appointment_id: appointmentId || null,
        hospital_name: hospitalName || null,
        medicine_name: newMedicine.medicine_name,
        dosage: newMedicine.dosage,
        frequency: newMedicine.frequency,
        timing: newMedicine.timing,
        duration: newMedicine.duration,
        instructions: newMedicine.instructions,
        is_active: true,
        created_at: new Date().toISOString(),
      }]).select();

      if (error) {
        console.error("Supabase error details:", JSON.stringify(error, null, 2));
        alert("Failed to add medicine: " + (error.message || JSON.stringify(error)));
        return;
      }
      console.log("Medicine added:", data);
      setShowAddModal(false);
      setNewMedicine({ medicine_name: "", dosage: "", frequency: "Once daily", timing: "After meal", duration: "7 days", instructions: "" });
      onRefresh();
    } catch (err) {
      console.error("Error adding medicine:", err);
      alert("Failed to add medicine: " + String(err));
    }
  };

  const deleteMedicine = async (medId: string) => {
    if (!confirm("Delete this medicine?")) return;
    try {
      await supabase.from("patient_medicines").delete().eq("id", medId);
      onRefresh();
    } catch (err) {
      console.error("Error deleting:", err);
    }
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      {isEditable && (
        <button
          onClick={() => setShowAddModal(true)}
          className="w-full sm:w-auto px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" /> Add Prescription
        </button>
      )}

      {medicines.length === 0 ? (
        <div className="text-center py-8">
          <Pill className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500 text-sm">No prescriptions for this patient</p>
          <p className="text-gray-400 text-xs mt-1">Click "Add Prescription" to create one</p>
        </div>
      ) : (
        <div className="space-y-2">
          {medicines.map((med) => (
            <div key={med.id} className="p-3 sm:p-4 bg-gray-50 rounded-xl border border-gray-200">
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-semibold text-gray-900 text-sm">{med.medicine_name}</h4>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${med.is_active ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}`}>
                      {med.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-600 mt-1.5 leading-relaxed">
                    <span className="font-medium">D:</span> {med.dosage || "N/A"} &bull;
                    <span className="font-medium"> F:</span> {med.frequency} &bull;
                    <span className="font-medium"> T:</span> {med.timing} &bull;
                    <span className="font-medium"> Dur:</span> {med.duration}
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

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center p-3 sm:p-4 z-[60] overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-md my-4 mx-1 sm:mx-0 p-4 sm:p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base sm:text-lg font-semibold">Add Medicine</h3>
              <button onClick={() => setShowAddModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Medicine Name *</label>
                <div className="relative space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input 
                      type="text" 
                      value={medicineSearch} 
                      onChange={(e) => { setMedicineSearch(e.target.value); setShowMedicineDropdown(true); }}
                      onFocus={() => setShowMedicineDropdown(true)}
                      placeholder="Search medicine (e.g., fever, pain, bp)..." 
                      className="w-full pl-9 rounded-lg border-2 border-gray-200 px-3 sm:px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none" 
                    />
                  </div>
                  
                  {/* Search Results Dropdown */}
                  {showMedicineDropdown && medicineSearch && (
                    <div className="absolute z-10 w-full mt-1 bg-white border-2 border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {(() => {
                        const filtered = COMMON_MEDICINES.filter(med => 
                          med.name.toLowerCase().includes(medicineSearch.toLowerCase()) ||
                          med.category.toLowerCase().includes(medicineSearch.toLowerCase())
                        );
                        if (filtered.length === 0) {
                          return (
                            <div className="p-3 text-sm text-gray-500 text-center">
                              No medicines found
                            </div>
                          );
                        }
                        return filtered.slice(0, 10).map(med => (
                          <button
                            key={med.name}
                            type="button"
                            onClick={() => {
                              setNewMedicine({ ...newMedicine, medicine_name: med.name });
                              setMedicineSearch("");
                              setShowMedicineDropdown(false);
                            }}
                            className="w-full px-4 py-2 text-left hover:bg-blue-50 flex items-center justify-between"
                          >
                            <span className="text-sm text-gray-900">{med.name}</span>
                            <span className="text-xs text-gray-500">{med.category}</span>
                          </button>
                        ));
                      })()}
                    </div>
                  )}
                  
                  {/* Custom Medicine Input */}
                  <input 
                    type="text" 
                    value={newMedicine.medicine_name} 
                    onChange={(e) => setNewMedicine({ ...newMedicine, medicine_name: e.target.value })} 
                    placeholder="Or enter custom medicine name" 
                    className="w-full rounded-lg border-2 border-gray-200 px-3 sm:px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none" 
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Dosage</label>
                  <select value={newMedicine.dosage} onChange={(e) => setNewMedicine({ ...newMedicine, dosage: e.target.value })} className="w-full rounded-lg border-2 border-gray-200 px-3 sm:px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none bg-white">
                    <option value="">Select</option>
                    {DOSAGE_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Frequency</label>
                  <select value={newMedicine.frequency} onChange={(e) => setNewMedicine({ ...newMedicine, frequency: e.target.value })} className="w-full rounded-lg border-2 border-gray-200 px-3 sm:px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none bg-white">
                    {FREQUENCY_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Timing</label>
                  <select value={newMedicine.timing} onChange={(e) => setNewMedicine({ ...newMedicine, timing: e.target.value })} className="w-full rounded-lg border-2 border-gray-200 px-3 sm:px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none bg-white">
                    {TIMING_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Duration</label>
                  <select value={newMedicine.duration} onChange={(e) => setNewMedicine({ ...newMedicine, duration: e.target.value })} className="w-full rounded-lg border-2 border-gray-200 px-3 sm:px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none bg-white">
                    {DURATION_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Instructions</label>
                <textarea value={newMedicine.instructions} onChange={(e) => setNewMedicine({ ...newMedicine, instructions: e.target.value })} placeholder="Any instructions..." rows={2} className="w-full rounded-lg border-2 border-gray-200 px-3 sm:px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none resize-none" />
              </div>
              <button onClick={handleAddMedicine} className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm">Add Medicine</button>
            </div>
          </div>
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
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
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
      const { data: appointmentsData } = await supabase.from("patient_appointments").select("hospital_name");
      const countMap: Record<string, number> = {};
      appointmentsData?.forEach(apt => { if (apt.hospital_name) countMap[apt.hospital_name] = (countMap[apt.hospital_name] || 0) + 1; });
      setHospitals(uniqueNames.map(name => ({ name, count: countMap[name] || 0 })));
    } catch (err) { console.error("Error loading hospitals:", err); }
  };

  const loadAppointments = async () => {
    try {
      const { data, error } = await supabase.from("patient_appointments").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      setAppointments(data || []);
    } catch (err) { console.error("Error loading appointments:", err); }
    finally { setLoading(false); }
  };

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
          <span className="hidden xs:inline">All Patient Appointments</span>
          <span className="xs:hidden">Appointments</span>
        </h2>
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
          className="px-3 py-2.5 rounded-xl border-2 border-gray-200 text-sm focus:border-blue-500 focus:outline-none bg-white min-w-[140px]"
        >
          <option value="all">All Hospitals</option>
          {hospitals.map((h) => (<option key={h.name} value={h.name}>{h.name.slice(0, 15)}...</option>))}
        </select>
        <select
          value={filterCaseType}
          onChange={(e) => setFilterCaseType(e.target.value)}
          className="px-3 py-2.5 rounded-xl border-2 border-gray-200 text-sm focus:border-blue-500 focus:outline-none bg-white min-w-[140px]"
        >
          <option value="all">All Case Types</option>
          {CASE_TYPES.map((ct) => (<option key={ct.value} value={ct.value}>{ct.label}</option>))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2.5 rounded-xl border-2 border-gray-200 text-sm focus:border-blue-500 focus:outline-none bg-white min-w-[120px]"
        >
          <option value="all">Status</option>
          <option value="scheduled">Scheduled</option>
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
          {filteredAppointments.map((apt) => (
            <div
              key={apt.id}
              onClick={() => router.push(`/doctor/patient?id=${apt.id}`)}
              className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 transition cursor-pointer"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900 truncate">{apt.patient_name}</h3>
                    {isToday(apt.appointment_date) && (
                      <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[10px] font-medium">Today</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 truncate">{apt.patient_email}</p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="text-xs text-gray-600 flex items-center gap-1">
                      <Stethoscope className="w-3 h-3" />
                      {apt.case_type?.slice(0, 12) || "General"}
                    </span>
                    <span className="text-xs text-gray-400">|</span>
                    <span className="text-xs text-gray-600 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(apt.appointment_date).toLocaleDateString("en-IN", { day: 'numeric', month: 'short' })}
                    </span>
                    {apt.hospital_name && (
                      <>
                        <span className="text-xs text-gray-400">|</span>
                        <span className="text-xs text-gray-500 truncate max-w-[80px]">{apt.hospital_name}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`text-[10px] px-2 py-1 rounded-full font-medium ${
                    apt.status === "scheduled" ? "bg-blue-100 text-blue-700" :
                    apt.status === "completed" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                  }`}>
                    {apt.status}
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}