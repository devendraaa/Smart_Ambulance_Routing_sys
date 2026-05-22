"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Calendar, User, Mail, Phone, MapPin, Building2, Pill, FileText, Utensils, ArrowLeft, X, Plus, Trash2, Search, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

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
  medicine_collected?: boolean;
  collected_at?: string;
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

const DOSAGE_OPTIONS = ["5mg", "10mg", "25mg", "50mg", "100mg", "250mg", "500mg", "1g"];
const FREQUENCY_OPTIONS = ["Once daily", "Twice daily", "Three times daily", "Four times daily", "As needed"];
const TIMING_OPTIONS = ["Before meal", "After meal", "With food", "Empty stomach", "Bedtime"];
const DURATION_OPTIONS = ["3 days", "5 days", "7 days", "10 days", "14 days", "1 month", "2 months", "3 months"];
const TEST_TYPES = ["MRI", "CT Scan", "Sonography", "Blood Test", "X-Ray", "ECG", "ECHO", "TMT", "Urine Test", "Stool Test", "Thyroid", "Sugar Test"];
const DIET_TYPES = ["Weight Loss", "Weight Gain", "Diabetic", "Heart", "Low Salt", "High Protein", "Vegetarian", "Liquid Diet", "Soft Diet", "General"];

const COMMON_MEDICINES = [
  { name: "Paracetamol 500mg", category: "Fever & Pain" },
  { name: "Paracetamol 650mg", category: "Fever & Pain" },
  { name: "Ibuprofen 400mg", category: "Fever & Pain" },
  { name: "Ibuprofen 600mg", category: "Fever & Pain" },
  { name: "Aspirin 325mg", category: "Fever & Pain" },
  { name: "Naproxen 250mg", category: "Fever & Pain" },
  { name: "Caffeine + Paracetamol", category: "Headache" },
  { name: "Sumatriptan 50mg", category: "Headache" },
  { name: "Betahistine 16mg", category: "Headache" },
  { name: "Metaxalone 400mg", category: "Body Pain" },
  { name: "Chlorzoxazone 250mg", category: "Body Pain" },
  { name: "Diclofenac Gel", category: "Body Pain" },
  { name: "Volini Gel", category: "Body Pain" },
  { name: "L-Cetizine 5mg", category: "Viral Fever" },
  { name: "Cetirizine 10mg", category: "Viral Fever" },
  { name: "Montelukast 10mg", category: "Viral Fever" },
  { name: "Ambroxol 30mg", category: "Viral Fever" },
  { name: "Levocetirizine 5mg", category: "Viral Fever" },
  { name: "Cetirizine + Phenylephrine", category: "Cold & Cough" },
  { name: "Phenylephrine 10mg", category: "Cold & Cough" },
  { name: "Phenyramidol 50mg", category: "Cold & Cough" },
  { name: "Chlorpheniramine 4mg", category: "Cold & Cough" },
  { name: "Diphenhydramine 25mg", category: "Cold & Cough" },
  { name: "Azithromycin 500mg", category: "Antibiotics" },
  { name: "Amoxicillin 500mg", category: "Antibiotics" },
  { name: "Ciprofloxacin 500mg", category: "Antibiotics" },
  { name: "Ofloxacin 200mg", category: "Antibiotics" },
  { name: "Metronidazole 400mg", category: "Antibiotics" },
  { name: "Doxycycline 100mg", category: "Antibiotics" },
  { name: "Pantoprazole 40mg", category: "Stomach" },
  { name: "Omeprazole 20mg", category: "Stomach" },
  { name: "Domperidone 10mg", category: "Stomach" },
  { name: "Ondansetron 4mg", category: "Stomach" },
  { name: "Ranitidine 150mg", category: "Stomach" },
  { name: "Polycrol Suspension", category: "Stomach" },
  { name: "Amlodipine 5mg", category: "BP & Heart" },
  { name: "Amlodipine 10mg", category: "BP & Heart" },
  { name: "Metoprolol 25mg", category: "BP & Heart" },
  { name: "Atenolol 50mg", category: "BP & Heart" },
  { name: "Losartan 50mg", category: "BP & Heart" },
  { name: "Metformin 500mg", category: "Diabetes" },
  { name: "Metformin 1000mg", category: "Diabetes" },
  { name: "Glimepride 2mg", category: "Diabetes" },
  { name: "Glimepride 4mg", category: "Diabetes" },
  { name: "Vitamin B-Complex", category: "Vitamins" },
  { name: "Vitamin C 500mg", category: "Vitamins" },
  { name: "Vitamin D3 1000IU", category: "Vitamins" },
  { name: "Calcium + Vitamin D", category: "Vitamins" },
  { name: "Iron + Folic Acid", category: "Vitamins" },
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

function PatientDetailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const appointmentId = searchParams.get("id");

  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [medicines, setMedicines] = useState<PatientMedicine[]>([]);
  const [tests, setTests] = useState<PatientTest[]>([]);
  const [diets, setDiets] = useState<PatientDiet[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"medicines" | "reports" | "diet">("medicines");

  const [showAddMedicine, setShowAddMedicine] = useState(false);
  const [showAddTest, setShowAddTest] = useState(false);
  const [showAddDiet, setShowAddDiet] = useState(false);
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

  const [newTest, setNewTest] = useState({ test_type: "Blood Test", notes: "" });

  const [newDiet, setNewDiet] = useState({
    diet_name: "",
    diet_type: "General",
    timing: "Lunch (1 PM)",
    foods: "",
    instructions: "",
  });

  const isCurrentAppointment = appointment ? isToday(appointment.appointment_date) : false;

  useEffect(() => {
    if (appointmentId) {
      loadData();
    }
  }, [appointmentId]);

  const loadData = async () => {
    if (!appointmentId) return;
    setLoading(true);
    try {
      const { data: aptData } = await supabase
        .from("patient_appointments")
        .select("*")
        .eq("id", appointmentId)
        .single();
      
      if (aptData) setAppointment(aptData);

      const [medsData, testsData, dietsData] = await Promise.all([
        supabase.from("patient_medicines").select("*").eq("appointment_id", appointmentId).order("created_at", { ascending: false }),
        supabase.from("patient_tests").select("*").eq("appointment_id", appointmentId).order("created_at", { ascending: false }),
        supabase.from("patient_diets").select("*").eq("appointment_id", appointmentId).order("created_at", { ascending: false })
      ]);

      setMedicines(medsData.data || []);
      setTests(testsData.data || []);
      setDiets(dietsData.data || []);
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMedicine = async () => {
    if (!newMedicine.medicine_name || !appointment) return;
    try {
      const { error } = await supabase.from("patient_medicines").insert([{
        patient_email: appointment.patient_email,
        patient_name: appointment.patient_name,
        appointment_id: appointment.id,
        hospital_name: appointment.hospital_name,
        medicine_name: newMedicine.medicine_name,
        dosage: newMedicine.dosage,
        frequency: newMedicine.frequency,
        timing: newMedicine.timing,
        duration: newMedicine.duration,
        instructions: newMedicine.instructions,
        is_active: true,
        created_at: new Date().toISOString(),
      }]);
      if (error) throw error;
      setShowAddMedicine(false);
      setNewMedicine({ medicine_name: "", dosage: "", frequency: "Once daily", timing: "After meal", duration: "7 days", instructions: "" });
      loadData();
    } catch (err) {
      console.error("Error adding medicine:", err);
      alert("Failed to add medicine");
    }
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

  const deleteMedicine = async (medId: string) => {
    if (!confirm("Delete this medicine?")) return;
    await supabase.from("patient_medicines").delete().eq("id", medId);
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
          <button onClick={() => router.push("/doctor?tab=appointments")} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg">
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
          <button onClick={() => router.push("/doctor?tab=appointments")} className="p-2 hover:bg-gray-100 rounded-lg">
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
                  <span className="flex items-center gap-1"><Mail className="w-4 h-4" />{appointment.patient_email}</span>
                  <span className="flex items-center gap-1"><Calendar className="w-4 h-4" />{new Date(appointment.appointment_date).toLocaleDateString()}</span>
                  <span className="flex items-center gap-1"><Building2 className="w-4 h-4" />{appointment.hospital_name}</span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  {isCurrentAppointment && (
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">Today</span>
                  )}
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    appointment.status === "scheduled" ? "bg-blue-100 text-blue-700" :
                    appointment.status === "completed" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                  }`}>
                    {appointment.status}
                  </span>
                  <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">{appointment.case_type}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-white rounded-t-2xl">
          <button
            onClick={() => setActiveTab("medicines")}
            className={`flex-1 px-4 py-4 font-medium text-sm flex items-center justify-center gap-2 transition ${activeTab === "medicines" ? "bg-blue-50 text-blue-600 border-b-2 border-blue-600" : "text-gray-500 hover:text-gray-700"}`}
          >
            <Pill className="w-4 h-4" /> Medicines <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs">{medicines.length}</span>
          </button>
          <button
            onClick={() => setActiveTab("reports")}
            className={`flex-1 px-4 py-4 font-medium text-sm flex items-center justify-center gap-2 transition ${activeTab === "reports" ? "bg-purple-50 text-purple-600 border-b-2 border-purple-600" : "text-gray-500 hover:text-gray-700"}`}
          >
            <FileText className="w-4 h-4" /> Tests <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full text-xs">{tests.length}</span>
          </button>
          <button
            onClick={() => setActiveTab("diet")}
            className={`flex-1 px-4 py-4 font-medium text-sm flex items-center justify-center gap-2 transition ${activeTab === "diet" ? "bg-green-50 text-green-600 border-b-2 border-green-600" : "text-gray-500 hover:text-gray-700"}`}
          >
            <Utensils className="w-4 h-4" /> Diet <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs">{diets.length}</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-b-2xl shadow-lg border border-t-0 p-6">
          {activeTab === "medicines" && (
            <div className="space-y-4">
              {isCurrentAppointment && (
                <button onClick={() => setShowAddMedicine(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium flex items-center gap-2 w-fit">
                  <Plus className="w-4 h-4" /> Add Medicine
                </button>
              )}
              {medicines.length === 0 ? (
                <div className="text-center py-12 text-gray-500">No medicines prescribed</div>
              ) : (
                <div className="space-y-3">
                  {medicines.map(med => (
                    <div key={med.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200 flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{med.medicine_name}</span>
                          <span className={`px-2 py-0.5 rounded text-xs ${med.is_active ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}`}>{med.is_active ? "Active" : "Inactive"}</span>
                          {med.medicine_collected && (
                            <span className="px-2 py-0.5 rounded text-xs bg-emerald-100 text-emerald-700 flex items-center gap-0.5">
                              <CheckCircle2 className="w-3 h-3" /> Collected
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          {med.dosage && <span>💊 {med.dosage}</span>}
                          {med.frequency && <span className="ml-2">📅 {med.frequency}</span>}
                          {med.timing && <span className="ml-2">⏰ {med.timing}</span>}
                          {med.duration && <span className="ml-2">📆 {med.duration}</span>}
                        </div>
                        {med.instructions && <div className="text-xs text-gray-500 mt-1">Note: {med.instructions}</div>}
                      </div>
                      {isCurrentAppointment && <button onClick={() => deleteMedicine(med.id)} className="p-2 text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "reports" && (
            <div className="space-y-4">
              {isCurrentAppointment && (
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
                      {isCurrentAppointment && <button onClick={() => deleteTest(test.id)} className="p-2 text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "diet" && (
            <div className="space-y-4">
              {isCurrentAppointment && (
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
                      {isCurrentAppointment && <button onClick={() => deleteDiet(diet.id)} className="p-2 text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add Medicine Modal */}
      {showAddMedicine && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center p-3 sm:p-4 pt-16 sm:pt-20 z-[9999] overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-md my-4 mx-1 sm:mx-0 p-4 sm:p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base sm:text-lg font-semibold">Add Medicine</h3>
              <button onClick={() => setShowAddMedicine(false)} className="p-1 hover:bg-gray-100 rounded">
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
                  
                  {showMedicineDropdown && medicineSearch && (
                    <div className="absolute z-10 w-full mt-1 bg-white border-2 border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {(() => {
                        const filtered = COMMON_MEDICINES.filter(med => 
                          med.name.toLowerCase().includes(medicineSearch.toLowerCase()) ||
                          med.category.toLowerCase().includes(medicineSearch.toLowerCase())
                        );
                        if (filtered.length === 0) {
                          return <div className="p-3 text-sm text-gray-500 text-center">No medicines found</div>;
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
                    {DOSAGE_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Frequency</label>
                  <select value={newMedicine.frequency} onChange={(e) => setNewMedicine({ ...newMedicine, frequency: e.target.value })} className="w-full rounded-lg border-2 border-gray-200 px-3 sm:px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none bg-white">
                    {FREQUENCY_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Timing</label>
                  <select value={newMedicine.timing} onChange={(e) => setNewMedicine({ ...newMedicine, timing: e.target.value })} className="w-full rounded-lg border-2 border-gray-200 px-3 sm:px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none bg-white">
                    {TIMING_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Duration</label>
                  <select value={newMedicine.duration} onChange={(e) => setNewMedicine({ ...newMedicine, duration: e.target.value })} className="w-full rounded-lg border-2 border-gray-200 px-3 sm:px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none bg-white">
                    {DURATION_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Instructions</label>
                <textarea value={newMedicine.instructions} onChange={(e) => setNewMedicine({ ...newMedicine, instructions: e.target.value })} rows={2} className="w-full rounded-lg border-2 border-gray-200 px-3 sm:px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none resize-none" />
              </div>
              <button onClick={handleAddMedicine} className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm">Add Medicine</button>
            </div>
          </div>
        </div>
      )}

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
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
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
    </div>
  );
}

export default PatientDetailPage;