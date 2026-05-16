"use client";

import { useState, useEffect } from "react";
import { Calendar, Search, Filter, Pill, FileText, Utensils, X, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { fetchHospitalsList } from "@/lib/api";

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
  medicine_name: string;
  dosage: string;
  frequency: string;
  timing: string;
  duration: string;
  instructions: string;
  is_active: boolean;
  created_at: string;
}

interface PatientTest {
  id: string;
  patient_email: string;
  test_type: string;
  status: string;
  report_url?: string;
  notes?: string;
  created_at: string;
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
  const [showAddForm, setShowAddForm] = useState(false);

  const isCurrentAppointment = isToday(appointment.appointment_date);

  useEffect(() => {
    loadPatientData();
  }, [appointment.patient_email]);

  const loadPatientData = async () => {
    setLoading(true);
    try {
      // Load medicines
      const { data: medsData } = await supabase
        .from("patient_medicines")
        .select("*")
        .eq("patient_email", appointment.patient_email)
        .order("created_at", { ascending: false });

      // Load tests
      const { data: testsData } = await supabase
        .from("patient_tests")
        .select("*")
        .eq("patient_email", appointment.patient_email)
        .order("created_at", { ascending: false });

      // Load diets
      const { data: dietsData } = await supabase
        .from("patient_diets")
        .select("*")
        .eq("patient_email", appointment.patient_email)
        .order("created_at", { ascending: false });

      setMedicines(medsData || []);
      setTests(testsData || []);
      setDiets(dietsData || []);
    } catch (err) {
      console.error("Error loading patient data:", err);
    } finally {
      setLoading(false);
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-4xl w-full p-6 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{appointment.patient_name}</h2>
            <p className="text-sm text-gray-500">{appointment.patient_email}</p>
            <p className="text-xs text-gray-400 mt-1">
              Appointment: {new Date(appointment.appointment_date).toLocaleDateString("en-IN")}
              {isCurrentAppointment && <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs">Today</span>}
              {!isCurrentAppointment && <span className="ml-2 px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">Past</span>}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-gray-200 mb-4">
          <button
            onClick={() => setActiveTab("medicines")}
            className={`px-4 py-2 font-medium text-sm rounded-t-lg transition ${activeTab === "medicines" ? "bg-blue-100 text-blue-700 border-b-2 border-blue-600" : "text-gray-500 hover:text-gray-700"}`}
          >
            <Pill className="w-4 h-4 inline mr-2" />
            Medicines ({medicines.length})
          </button>
          <button
            onClick={() => setActiveTab("reports")}
            className={`px-4 py-2 font-medium text-sm rounded-t-lg transition ${activeTab === "reports" ? "bg-blue-100 text-blue-700 border-b-2 border-blue-600" : "text-gray-500 hover:text-gray-700"}`}
          >
            <FileText className="w-4 h-4 inline mr-2" />
            Reports ({tests.length})
          </button>
          <button
            onClick={() => setActiveTab("diet")}
            className={`px-4 py-2 font-medium text-sm rounded-t-lg transition ${activeTab === "diet" ? "bg-blue-100 text-blue-700 border-b-2 border-blue-600" : "text-gray-500 hover:text-gray-700"}`}
          >
            <Utensils className="w-4 h-4 inline mr-2" />
            Diet ({diets.length})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : (
            <>
              {activeTab === "medicines" && (
                <MedicinesSection
                  patientEmail={appointment.patient_email}
                  medicines={medicines}
                  isEditable={isCurrentAppointment}
                  onRefresh={loadPatientData}
                />
              )}
              {activeTab === "reports" && (
                <ReportsSection
                  patientEmail={appointment.patient_email}
                  tests={tests}
                  isEditable={isCurrentAppointment}
                  onRefresh={loadPatientData}
                />
              )}
              {activeTab === "diet" && (
                <DietSection
                  patientEmail={appointment.patient_email}
                  diets={diets}
                  isEditable={isCurrentAppointment}
                  onRefresh={loadPatientData}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function MedicinesSection({
  patientEmail,
  medicines,
  isEditable,
  onRefresh
}: {
  patientEmail: string;
  medicines: PatientMedicine[];
  isEditable: boolean;
  onRefresh: () => void;
}) {
  const [showAddModal, setShowAddModal] = useState(false);
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
        medicine_name: newMedicine.medicine_name,
        dosage: newMedicine.dosage,
        frequency: newMedicine.frequency,
        timing: newMedicine.timing,
        duration: newMedicine.duration,
        instructions: newMedicine.instructions,
        is_active: true,
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
    <div className="space-y-4">
      {isEditable && (
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Add Medicine
        </button>
      )}

      {medicines.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No medicines found</div>
      ) : (
        <div className="space-y-2">
          {medicines.map((med) => (
            <div key={med.id} className="p-4 bg-gray-50 rounded-xl border border-gray-200">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-gray-900">{med.medicine_name}</h4>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${med.is_active ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}`}>
                      {med.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    <span className="font-medium">Dosage:</span> {med.dosage || "N/A"} |
                    <span className="font-medium"> Freq:</span> {med.frequency} |
                    <span className="font-medium"> Timing:</span> {med.timing} |
                    <span className="font-medium"> Duration:</span> {med.duration}
                  </p>
                  {med.instructions && <p className="text-xs text-gray-500 mt-1">Note: {med.instructions}</p>}
                </div>
                {isEditable && (
                  <button onClick={() => deleteMedicine(med.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Add Medicine</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Medicine Name *</label>
                <input
                  type="text"
                  value={newMedicine.medicine_name}
                  onChange={(e) => setNewMedicine({ ...newMedicine, medicine_name: e.target.value })}
                  placeholder="e.g., Paracetamol"
                  className="w-full rounded-lg border-2 border-gray-200 px-4 py-2.5 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dosage</label>
                  <select
                    value={newMedicine.dosage}
                    onChange={(e) => setNewMedicine({ ...newMedicine, dosage: e.target.value })}
                    className="w-full rounded-lg border-2 border-gray-200 px-4 py-2.5 focus:border-blue-500 focus:outline-none bg-white"
                  >
                    <option value="">Select</option>
                    {DOSAGE_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                  <select
                    value={newMedicine.frequency}
                    onChange={(e) => setNewMedicine({ ...newMedicine, frequency: e.target.value })}
                    className="w-full rounded-lg border-2 border-gray-200 px-4 py-2.5 focus:border-blue-500 focus:outline-none bg-white"
                  >
                    {FREQUENCY_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Timing</label>
                  <select
                    value={newMedicine.timing}
                    onChange={(e) => setNewMedicine({ ...newMedicine, timing: e.target.value })}
                    className="w-full rounded-lg border-2 border-gray-200 px-4 py-2.5 focus:border-blue-500 focus:outline-none bg-white"
                  >
                    {TIMING_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
                  <select
                    value={newMedicine.duration}
                    onChange={(e) => setNewMedicine({ ...newMedicine, duration: e.target.value })}
                    className="w-full rounded-lg border-2 border-gray-200 px-4 py-2.5 focus:border-blue-500 focus:outline-none bg-white"
                  >
                    {DURATION_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Instructions</label>
                <textarea
                  value={newMedicine.instructions}
                  onChange={(e) => setNewMedicine({ ...newMedicine, instructions: e.target.value })}
                  placeholder="Any special instructions..."
                  rows={2}
                  className="w-full rounded-lg border-2 border-gray-200 px-4 py-2.5 focus:border-blue-500 focus:outline-none resize-none"
                />
              </div>
              <button onClick={handleAddMedicine} className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">
                Add Medicine
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ReportsSection({
  patientEmail,
  tests,
  isEditable,
  onRefresh
}: {
  patientEmail: string;
  tests: PatientTest[];
  isEditable: boolean;
  onRefresh: () => void;
}) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTest, setNewTest] = useState({ test_type: "Blood Test", notes: "" });

  const handleAddTest = async () => {
    try {
      const { error } = await supabase.from("patient_tests").insert([{
        patient_email: patientEmail,
        test_type: newTest.test_type,
        notes: newTest.notes,
        status: "ordered",
        payment_status: "pending",
      }]);
      if (error) throw error;
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
    <div className="space-y-4">
      {isEditable && (
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Add Test
        </button>
      )}

      {tests.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No tests found</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Test Type</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Date</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Status</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Report</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tests.map((test) => (
                <tr key={test.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-900">{test.test_type}</td>
                  <td className="px-4 py-2 text-gray-600">{new Date(test.created_at).toLocaleDateString("en-IN")}</td>
                  <td className="px-4 py-2">{getStatusBadge(test.status)}</td>
                  <td className="px-4 py-2">
                    {test.report_url ? (
                      <a href={test.report_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        View
                      </a>
                    ) : (
                      <span className="text-gray-400">Not uploaded</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Book Test</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Test Type</label>
                <select
                  value={newTest.test_type}
                  onChange={(e) => setNewTest({ ...newTest, test_type: e.target.value })}
                  className="w-full rounded-lg border-2 border-gray-200 px-4 py-2.5 focus:border-blue-500 focus:outline-none bg-white"
                >
                  {TEST_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={newTest.notes}
                  onChange={(e) => setNewTest({ ...newTest, notes: e.target.value })}
                  placeholder="Any instructions..."
                  rows={2}
                  className="w-full rounded-lg border-2 border-gray-200 px-4 py-2.5 focus:border-blue-500 focus:outline-none resize-none"
                />
              </div>
              <button onClick={handleAddTest} className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">
                Book Test
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DietSection({
  patientEmail,
  diets,
  isEditable,
  onRefresh
}: {
  patientEmail: string;
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
    <div className="space-y-4">
      {isEditable && (
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Add Diet Plan
        </button>
      )}

      {diets.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No diet plans found</div>
      ) : (
        <div className="space-y-2">
          {diets.map((diet) => (
            <div key={diet.id} className="p-4 bg-gray-50 rounded-xl border border-gray-200">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-gray-900">{diet.diet_name}</h4>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">{diet.diet_type}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${diet.is_active ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}`}>
                      {diet.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {diet.calories && <span className="mr-3"><span className="font-medium">Calories:</span> {diet.calories}</span>}
                    {diet.timing && <span className="mr-3"><span className="font-medium">Timing:</span> {diet.timing}</span>}
                  </p>
                  {diet.foods && <p className="text-sm text-gray-500 mt-1"><span className="font-medium">Foods:</span> {diet.foods}</p>}
                  {diet.instructions && <p className="text-xs text-gray-400 mt-1">Note: {diet.instructions}</p>}
                </div>
                {isEditable && (
                  <button onClick={() => deleteDiet(diet.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Add Diet Plan</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Diet Name *</label>
                <input
                  type="text"
                  value={newDiet.diet_name}
                  onChange={(e) => setNewDiet({ ...newDiet, diet_name: e.target.value })}
                  placeholder="e.g., Morning Diet Plan"
                  className="w-full rounded-lg border-2 border-gray-200 px-4 py-2.5 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Diet Type</label>
                  <select
                    value={newDiet.diet_type}
                    onChange={(e) => setNewDiet({ ...newDiet, diet_type: e.target.value })}
                    className="w-full rounded-lg border-2 border-gray-200 px-4 py-2.5 focus:border-blue-500 focus:outline-none bg-white"
                  >
                    {DIET_TYPES.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Calories</label>
                  <input
                    type="text"
                    value={newDiet.calories}
                    onChange={(e) => setNewDiet({ ...newDiet, calories: e.target.value })}
                    placeholder="e.g., 2000 kcal"
                    className="w-full rounded-lg border-2 border-gray-200 px-4 py-2.5 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Timing</label>
                <select
                  value={newDiet.timing}
                  onChange={(e) => setNewDiet({ ...newDiet, timing: e.target.value })}
                  className="w-full rounded-lg border-2 border-gray-200 px-4 py-2.5 focus:border-blue-500 focus:outline-none bg-white"
                >
                  <option value="Morning (8 AM)">Morning (8 AM)</option>
                  <option value="Mid-morning (11 AM)">Mid-morning (11 AM)</option>
                  <option value="Lunch (1 PM)">Lunch (1 PM)</option>
                  <option value="Afternoon (4 PM)">Afternoon (4 PM)</option>
                  <option value="Dinner (8 PM)">Dinner (8 PM)</option>
                  <option value="Bedtime">Bedtime</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Foods (one per line)</label>
                <textarea
                  value={newDiet.foods}
                  onChange={(e) => setNewDiet({ ...newDiet, foods: e.target.value })}
                  placeholder="Milk - 1 glass&#10;Oats - 50g&#10;Banana - 1"
                  rows={3}
                  className="w-full rounded-lg border-2 border-gray-200 px-4 py-2.5 focus:border-blue-500 focus:outline-none resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Instructions</label>
                <textarea
                  value={newDiet.instructions}
                  onChange={(e) => setNewDiet({ ...newDiet, instructions: e.target.value })}
                  placeholder="Any special instructions..."
                  rows={2}
                  className="w-full rounded-lg border-2 border-gray-200 px-4 py-2.5 focus:border-blue-500 focus:outline-none resize-none"
                />
              </div>
              <button onClick={handleAddDiet} className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">
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
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterHospital, setFilterHospital] = useState<string>("all");
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [hospitals, setHospitals] = useState<{ name: string; count: number }[]>([]);

  useEffect(() => {
    loadAppointments();
    loadHospitals();
  }, []);

  const loadHospitals = async () => {
    try {
      const data = await fetchHospitalsList();
      const uniqueNames = [...new Set(data.hospitals.map(h => h.name).filter(Boolean))];

      // Get appointment counts per hospital
      const { data: appointmentsData } = await supabase
        .from("patient_appointments")
        .select("hospital_name");

      const countMap: Record<string, number> = {};
      appointmentsData?.forEach(apt => {
        if (apt.hospital_name) {
          countMap[apt.hospital_name] = (countMap[apt.hospital_name] || 0) + 1;
        }
      });

      const hospitalsWithCount = uniqueNames.map(name => ({
        name,
        count: countMap[name] || 0
      }));

      setHospitals(hospitalsWithCount);
    } catch (err) {
      console.error("Error loading hospitals:", err);
    }
  };

  const loadAppointments = async () => {
    try {
      const { data, error } = await supabase
        .from("patient_appointments")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAppointments(data || []);
    } catch (err) {
      console.error("Error loading appointments:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredAppointments = appointments.filter((apt) => {
    const matchesSearch = apt.patient_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      apt.patient_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      apt.hospital_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === "all" || apt.status === filterStatus;
    const matchesHospital = filterHospital === "all" || apt.hospital_name === filterHospital;
    return matchesSearch && matchesStatus && matchesHospital;
  });

  const updateAppointmentStatus = async (aptId: string, newStatus: string) => {
    try {
      await supabase
        .from("patient_appointments")
        .update({ status: newStatus })
        .eq("id", aptId);

      setAppointments(appointments.map((apt) =>
        apt.id === aptId ? { ...apt, status: newStatus } : apt
      ));
      setSelectedAppointment(null);
    } catch (err) {
      console.error("Error updating status:", err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-600" />
          All Patient Appointments
        </h2>
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            placeholder="Search patient..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          <select
            value={filterHospital}
            onChange={(e) => setFilterHospital(e.target.value)}
            className="rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none bg-white"
          >
            <option value="all">All Hospitals</option>
            {hospitals.map((h) => (
              <option key={h.name} value={h.name}>{h.name} ({h.count})</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none bg-white"
          >
            <option value="all">All Status</option>
            <option value="scheduled">Scheduled</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading appointments...</div>
      ) : filteredAppointments.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No appointments found</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Patient</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Case Type</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Hospital</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Date</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredAppointments.map((apt) => (
                <tr key={apt.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{apt.patient_name}</p>
                    <p className="text-xs text-gray-500">{apt.patient_email}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{apt.case_type}</td>
                  <td className="px-4 py-3 text-gray-600">{apt.hospital_name || "N/A"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600">{new Date(apt.appointment_date).toLocaleDateString("en-IN")}</span>
                      {isToday(apt.appointment_date) && (
                        <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">Today</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      apt.status === "scheduled" ? "bg-blue-100 text-blue-700" :
                      apt.status === "completed" ? "bg-green-100 text-green-700" :
                      "bg-red-100 text-red-700"
                    }`}>
                      {apt.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setSelectedAppointment(apt)}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      View / Update
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Patient Detail Panel */}
      {selectedAppointment && (
        <PatientDetailPanel
          appointment={selectedAppointment}
          onClose={() => setSelectedAppointment(null)}
        />
      )}
    </div>
  );
}