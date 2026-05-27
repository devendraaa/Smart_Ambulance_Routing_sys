"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Building2, Plus, Edit2, Trash2, X, Stethoscope, Users, MapPin, AlertTriangle, HeartPulse, Activity, CheckCircle, Truck, Clock, Bed, LayoutDashboard, ClipboardList, AlertCircle } from "lucide-react";
import { fetchHospitalsList, fetchHospitalInfo, createHospitalInfo, updateHospitalInfo, deleteHospitalInfo, fetchEmergencyCases, HospitalInfo } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

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

interface HospitalOption {
  id: number;
  name: string;
  address?: string;
  specialist?: string;
  total_beds?: number;
  available_beds?: number;
  emergency_beds?: number;
}

type EmergencyCase = {
  task_id: string;
  hospital_name: string;
  origin_lat: number;
  origin_lon: number;
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
  patient_bp_systolic?: number;
  patient_bp_diastolic?: number;
  patient_temperature?: number;
  patient_pulse?: number;
  patient_spo2?: number;
  consultant_name?: string;
  bed_number?: string;
};

function calculateTriageLevel(c: EmergencyCase): "red" | "yellow" | "green" {
  if (!c.patient_bp_systolic && !c.patient_bp_diastolic && !c.patient_temperature && !c.patient_pulse && !c.patient_spo2) {
    if (c.patient_case === "Heart Attack" || c.patient_case === "Stroke") return "red";
    if (c.patient_case === "Accident" || c.patient_case === "Burn") return "yellow";
    return "green";
  }
  const bpSys = c.patient_bp_systolic;
  const bpDia = c.patient_bp_diastolic;
  const temp = c.patient_temperature;
  const pulse = c.patient_pulse;
  const spo2 = c.patient_spo2;
  if (spo2 !== undefined && spo2 < 90) return "red";
  if (bpSys !== undefined && (bpSys < 90 || bpSys > 180)) return "red";
  if (bpDia !== undefined && bpDia > 120) return "red";
  if (temp !== undefined && (temp > 40 || temp < 35)) return "red";
  if (pulse !== undefined && (pulse > 140 || pulse < 40)) return "red";
  if (c.patient_case === "Heart Attack" || c.patient_case === "Stroke") return "red";
  if (spo2 !== undefined && spo2 < 95) return "yellow";
  if (bpSys !== undefined && (bpSys > 140 || bpSys < 100)) return "yellow";
  if (temp !== undefined && (temp > 38 || temp < 36)) return "yellow";
  if (pulse !== undefined && (pulse > 100 || pulse < 60)) return "yellow";
  if (c.patient_case === "Accident" || c.patient_case === "Burn") return "yellow";
  return "green";
}

function isBpHigh(systolic?: number, diastolic?: number): boolean {
  if (!systolic && !diastolic) return false;
  return Boolean((systolic && systolic > 140) || (diastolic && diastolic > 90));
}

function isTemperatureHigh(temp?: number): boolean {
  if (!temp) return false;
  return temp > 38;
}

function isPulseHigh(pulse?: number): boolean {
  if (!pulse) return false;
  return pulse > 100;
}

function isPulseLow(pulse?: number): boolean {
  if (!pulse) return false;
  return pulse < 60;
}

function isSpo2Low(spo2?: number): boolean {
  if (!spo2) return false;
  return spo2 < 95;
}

function isAnyVitalAbnormal(c: EmergencyCase): boolean {
  return Boolean(
    isBpHigh(c.patient_bp_systolic, c.patient_bp_diastolic) ||
    isTemperatureHigh(c.patient_temperature) ||
    isPulseHigh(c.patient_pulse) ||
    isPulseLow(c.patient_pulse) ||
    isSpo2Low(c.patient_spo2)
  );
}

export default function HospitalInfoTab() {
  const [activeSubTab, setActiveSubTab] = useState<"info" | "cases" | "triage" | "edboard" | "beds">("info");
  const [hospitals, setHospitals] = useState<HospitalOption[]>([]);
  const [selectedHospital, setSelectedHospital] = useState<string>("");
  const [selectedCaseType, setSelectedCaseType] = useState<string>("");
  const [hospitalInfos, setHospitalInfos] = useState<HospitalInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [cases, setCases] = useState<EmergencyCase[]>([]);
  const [loadingCases, setLoadingCases] = useState(false);

  const [formData, setFormData] = useState({
    hospital_name: "",
    case_type: "",
    doctor_name: "",
    ward_no: "",
    floor_no: "",
    bed_no: "",
  });

  useEffect(() => {
    loadHospitals();
  }, []);

  useEffect(() => {
    if (activeSubTab === "info") {
      loadHospitalInfo();
    }
  }, [selectedHospital, selectedCaseType, activeSubTab]);

  useEffect(() => {
    if ((activeSubTab === "cases" || activeSubTab === "triage" || activeSubTab === "edboard") && selectedHospital) {
      loadCases();
    }
  }, [selectedHospital, activeSubTab]);

  const loadHospitals = async () => {
    try {
      const data = await fetchHospitalsList();
      setHospitals(data.hospitals);
    } catch (err) {
      console.error("Error loading hospitals:", err);
    }
  };

  const loadHospitalInfo = async () => {
    setLoading(true);
    try {
      const data = await fetchHospitalInfo(
        selectedHospital || undefined,
        selectedCaseType || undefined
      );
      setHospitalInfos(data);
    } catch (err) {
      console.error("Error loading hospital info:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadCases = async () => {
    setLoadingCases(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const data = await fetchEmergencyCases(selectedHospital, today, today);
      setCases(data || []);
    } catch (err) {
      console.error("Error loading cases:", err);
      setCases([]);
    } finally {
      setLoadingCases(false);
    }
  };

  const handleAdd = async () => {
    if (!formData.hospital_name || !formData.case_type || !formData.doctor_name || !formData.ward_no || !formData.floor_no) {
      alert("Please fill all required fields");
      return;
    }
    try {
      await createHospitalInfo(formData);
      setShowAddForm(false);
      setFormData({ hospital_name: "", case_type: "", doctor_name: "", ward_no: "", floor_no: "", bed_no: "" });
      loadHospitalInfo();
    } catch (err) {
      console.error("Error adding hospital info:", err);
      alert("Failed to add hospital info");
    }
  };

  const handleUpdate = async (id: string) => {
    try {
      await updateHospitalInfo(id, formData);
      setEditingId(null);
      setFormData({ hospital_name: "", case_type: "", doctor_name: "", ward_no: "", floor_no: "", bed_no: "" });
      loadHospitalInfo();
    } catch (err) {
      console.error("Error updating hospital info:", err);
      alert("Failed to update hospital info");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this hospital info?")) return;
    try {
      await deleteHospitalInfo(id);
      loadHospitalInfo();
    } catch (err) {
      console.error("Error deleting hospital info:", err);
    }
  };

  const startEdit = (info: HospitalInfo) => {
    setEditingId(info.id);
    setFormData({
      hospital_name: info.hospital_name,
      case_type: info.case_type,
      doctor_name: info.doctor_name,
      ward_no: info.ward_no,
      floor_no: info.floor_no,
      bed_no: info.bed_no || "",
    });
  };

  const startAdd = () => {
    setFormData({
      hospital_name: selectedHospital,
      case_type: selectedCaseType,
      doctor_name: "",
      ward_no: "",
      floor_no: "",
      bed_no: "",
    });
    setShowAddForm(true);
  };

  const newCaseCount = cases.filter(c => c.duration_min !== undefined && c.duration_min !== null).length;
  const pendingCaseCount = cases.filter(c => !c.duration_min).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
          <Building2 className="w-5 h-5 text-purple-600" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Hospital Operations</h2>
          <p className="text-sm text-gray-500">Manage hospital info, emergency cases, triage & beds</p>
        </div>
      </div>

      {/* Hospital Selector */}
      <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
        <select
          value={selectedHospital}
          onChange={(e) => setSelectedHospital(e.target.value)}
          className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition"
        >
          <option value="">Select a hospital</option>
          {hospitals.map((h) => (
            <option key={h.id} value={h.name}>{h.name}</option>
          ))}
        </select>
      </div>

      {/* Sub-Tabs */}
      {selectedHospital && (
        <div className="bg-white rounded-2xl border border-gray-200 p-1.5 flex shadow-sm">
          <button onClick={() => setActiveSubTab("info")}
            className={`flex-1 px-2 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${
              activeSubTab === "info" ? "bg-purple-600 text-white shadow-lg" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}>
            <Building2 className="w-3.5 h-3.5" /> Info
          </button>
          <button onClick={() => setActiveSubTab("cases")}
            className={`flex-1 px-2 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${
              activeSubTab === "cases" ? "bg-red-600 text-white shadow-lg" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}>
            <Truck className="w-3.5 h-3.5" /> Cases
          </button>
          <button onClick={() => setActiveSubTab("triage")}
            className={`flex-1 px-2 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${
              activeSubTab === "triage" ? "bg-amber-600 text-white shadow-lg" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}>
            <HeartPulse className="w-3.5 h-3.5" /> Triage
          </button>
          <button onClick={() => setActiveSubTab("edboard")}
            className={`flex-1 px-2 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${
              activeSubTab === "edboard" ? "bg-blue-600 text-white shadow-lg" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}>
            <LayoutDashboard className="w-3.5 h-3.5" /> ED Board
          </button>
          <button onClick={() => setActiveSubTab("beds")}
            className={`flex-1 px-2 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${
              activeSubTab === "beds" ? "bg-emerald-600 text-white shadow-lg" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}>
            <Bed className="w-3.5 h-3.5" /> Beds
          </button>
        </div>
      )}

      {/* ============ INFO TAB ============ */}
      {activeSubTab === "info" && (
        <>
          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hospital</label>
              <select
                value={selectedHospital}
                onChange={(e) => setSelectedHospital(e.target.value)}
                className="w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 focus:border-purple-500 focus:outline-none bg-white"
              >
                <option value="">All Hospitals</option>
                {hospitals.map((h) => (
                  <option key={h.id} value={h.name}>{h.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Case Type</label>
              <select
                value={selectedCaseType}
                onChange={(e) => setSelectedCaseType(e.target.value)}
                className="w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 focus:border-purple-500 focus:outline-none bg-white"
              >
                <option value="">All Case Types</option>
                {CASE_TYPES.map((ct) => (
                  <option key={ct.value} value={ct.value}>{ct.label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button onClick={startAdd}
                className="w-full px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" /> Add Info
              </button>
            </div>
          </div>

          {/* Results */}
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : hospitalInfos.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Building2 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No hospital info found. Add new entries or change filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {hospitalInfos.map((info) => (
                <motion.div key={info.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="p-4 border border-gray-200 rounded-xl hover:border-purple-300 transition-colors">
                  {editingId === info.id ? (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Doctor Name</label>
                        <input type="text" value={formData.doctor_name}
                          onChange={(e) => setFormData({ ...formData, doctor_name: e.target.value })}
                          className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none" />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Ward No</label>
                          <input type="text" value={formData.ward_no}
                            onChange={(e) => setFormData({ ...formData, ward_no: e.target.value })}
                            className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Floor</label>
                          <input type="text" value={formData.floor_no}
                            onChange={(e) => setFormData({ ...formData, floor_no: e.target.value })}
                            className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Bed No</label>
                          <input type="text" value={formData.bed_no}
                            onChange={(e) => setFormData({ ...formData, bed_no: e.target.value })}
                            className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none" />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleUpdate(info.id)} className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium">Save</button>
                        <button onClick={() => setEditingId(null)} className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm font-medium">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between items-start mb-2">
                        <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-lg text-xs font-medium">{info.case_type}</span>
                        <div className="flex gap-1">
                          <button onClick={() => startEdit(info)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => handleDelete(info.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                      <h3 className="font-semibold text-gray-900 mb-2">{info.hospital_name}</h3>
                      <div className="space-y-1.5 text-sm text-gray-600">
                        <p className="flex items-center gap-2"><Users className="w-4 h-4 text-gray-400" /> Dr. {info.doctor_name}</p>
                        <p className="flex items-center gap-2"><Building2 className="w-4 h-4 text-gray-400" /> Ward {info.ward_no}</p>
                        <p className="flex items-center gap-2"><MapPin className="w-4 h-4 text-gray-400" /> Floor {info.floor_no}{info.bed_no ? `, Bed ${info.bed_no}` : ""}</p>
                      </div>
                    </>
                  )}
                </motion.div>
              ))}
            </div>
          )}

          {/* Add Form Modal */}
          {showAddForm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-2xl max-w-md w-full p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Add Hospital Info</h3>
                  <button onClick={() => setShowAddForm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hospital *</label>
                    <select value={formData.hospital_name} onChange={(e) => setFormData({ ...formData, hospital_name: e.target.value })}
                      className="w-full rounded-lg border-2 border-gray-200 px-4 py-2.5 focus:border-purple-500 focus:outline-none bg-white">
                      <option value="">Select hospital</option>
                      {hospitals.map((h) => (<option key={h.id} value={h.name}>{h.name}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Case Type *</label>
                    <select value={formData.case_type} onChange={(e) => setFormData({ ...formData, case_type: e.target.value })}
                      className="w-full rounded-lg border-2 border-gray-200 px-4 py-2.5 focus:border-purple-500 focus:outline-none bg-white">
                      <option value="">Select case type</option>
                      {CASE_TYPES.map((ct) => (<option key={ct.value} value={ct.value}>{ct.label}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Doctor Name *</label>
                    <input type="text" value={formData.doctor_name} onChange={(e) => setFormData({ ...formData, doctor_name: e.target.value })}
                      placeholder="Dr. John Doe" className="w-full rounded-lg border-2 border-gray-200 px-4 py-2.5 focus:border-purple-500 focus:outline-none" />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Ward No *</label>
                      <input type="text" value={formData.ward_no} onChange={(e) => setFormData({ ...formData, ward_no: e.target.value })}
                        placeholder="A-101" className="w-full rounded-lg border-2 border-gray-200 px-4 py-2.5 focus:border-purple-500 focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Floor No *</label>
                      <input type="text" value={formData.floor_no} onChange={(e) => setFormData({ ...formData, floor_no: e.target.value })}
                        placeholder="2nd" className="w-full rounded-lg border-2 border-gray-200 px-4 py-2.5 focus:border-purple-500 focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Bed No</label>
                      <input type="text" value={formData.bed_no} onChange={(e) => setFormData({ ...formData, bed_no: e.target.value })}
                        placeholder="5" className="w-full rounded-lg border-2 border-gray-200 px-4 py-2.5 focus:border-purple-500 focus:outline-none" />
                    </div>
                  </div>
                  <button onClick={handleAdd} className="w-full px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium">Add Info</button>
                </div>
              </motion.div>
            </div>
          )}
        </>
      )}

      {/* ============ CASES TAB ============ */}
      {activeSubTab === "cases" && (
        <div>
          {!selectedHospital ? (
            <div className="text-center py-12 bg-gray-50 rounded-2xl border border-gray-100">
              <Truck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Select a hospital to view emergency cases</p>
            </div>
          ) : loadingCases ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mx-auto mb-2" />
              <p className="text-sm text-gray-500">Loading cases...</p>
            </div>
          ) : cases.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-2xl border border-gray-100">
              <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No emergency cases found today</p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">Showing {cases.length} case(s) for {selectedHospital}</p>
              {cases.map((c) => (
                <motion.div key={c.task_id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        c.patient_case === "Heart Attack" ? "bg-red-100" : c.patient_case === "Accident" ? "bg-orange-100" : c.patient_case === "Burn" ? "bg-yellow-100" : "bg-gray-100"
                      }`}>
                        <AlertTriangle className={`w-5 h-5 ${
                          c.patient_case === "Heart Attack" ? "text-red-600" : c.patient_case === "Accident" ? "text-orange-600" : c.patient_case === "Burn" ? "text-yellow-600" : "text-gray-600"
                        }`} />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900">{c.patient_name || "Unknown"}</h3>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          {c.patient_age && <span>{c.patient_age}y</span>}
                          {c.patient_sex && <span>{c.patient_sex}</span>}
                          {c.patient_blood_group && <span className="font-medium text-red-600">{c.patient_blood_group}</span>}
                        </div>
                      </div>
                    </div>
                    {c.patient_case && (
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                        c.patient_case === "Heart Attack" ? "bg-red-100 text-red-700" :
                        c.patient_case === "Accident" ? "bg-orange-100 text-orange-700" :
                        c.patient_case === "Burn" ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-700"
                      }`}>
                        {c.patient_case}
                      </span>
                    )}
                  </div>
                  {c.distance_km && c.duration_min && (
                    <div className="flex gap-3 mb-3">
                      <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-lg">{c.distance_km.toFixed(1)} km</span>
                      <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg">{c.duration_min.toFixed(0)} min</span>
                    </div>
                  )}
                  {(c.patient_bp_systolic || c.patient_temperature || c.patient_pulse || c.patient_spo2) && (
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      {c.patient_bp_systolic && (
                        <div className={`rounded-lg p-2 text-center border ${isBpHigh(c.patient_bp_systolic, c.patient_bp_diastolic) ? "bg-red-50 border-red-200" : "bg-cyan-50 border-cyan-200"}`}>
                          <p className="text-[10px] font-semibold text-gray-500">BP</p>
                          <p className="text-sm font-bold">{c.patient_bp_systolic}/{c.patient_bp_diastolic}</p>
                        </div>
                      )}
                      {c.patient_temperature && (
                        <div className={`rounded-lg p-2 text-center border ${isTemperatureHigh(c.patient_temperature) ? "bg-red-50 border-red-200" : "bg-orange-50 border-orange-200"}`}>
                          <p className="text-[10px] font-semibold text-gray-500">Temp</p>
                          <p className="text-sm font-bold">{c.patient_temperature}°</p>
                        </div>
                      )}
                      {c.patient_pulse && (
                        <div className={`rounded-lg p-2 text-center border ${isPulseHigh(c.patient_pulse) || isPulseLow(c.patient_pulse) ? "bg-red-50 border-red-200" : "bg-rose-50 border-rose-200"}`}>
                          <p className="text-[10px] font-semibold text-gray-500">Pulse</p>
                          <p className="text-sm font-bold">{c.patient_pulse}</p>
                        </div>
                      )}
                      {c.patient_spo2 && (
                        <div className={`rounded-lg p-2 text-center border ${isSpo2Low(c.patient_spo2) ? "bg-red-50 border-red-200" : "bg-purple-50 border-purple-200"}`}>
                          <p className="text-[10px] font-semibold text-gray-500">SpO2</p>
                          <p className="text-sm font-bold">{c.patient_spo2}%</p>
                        </div>
                      )}
                    </div>
                  )}
                  {(c.ambulance_number || c.driver_name) && (
                    <div className="flex gap-2 text-xs text-gray-500 pt-2 border-t border-gray-100">
                      {c.ambulance_number && <span>🚑 {c.ambulance_number}</span>}
                      {c.driver_name && <span>👤 {c.driver_name}</span>}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============ TRIAGE TAB ============ */}
      {activeSubTab === "triage" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-red-500 flex items-center justify-center"><HeartPulse className="w-5 h-5 text-white" /></div>
                <div>
                  <p className="text-xs font-semibold text-red-600 uppercase tracking-wide">Red (Immediate)</p>
                  <p className="text-3xl font-black text-red-700">{cases.filter(c => calculateTriageLevel(c) === "red").length}</p>
                </div>
              </div>
              <div className="text-xs text-red-600">
                {cases.filter(c => calculateTriageLevel(c) === "red").map(c => c.patient_name || "Unknown").join(", ") || "No critical patients"}
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center"><Activity className="w-5 h-5 text-white" /></div>
                <div>
                  <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide">Yellow (Urgent)</p>
                  <p className="text-3xl font-black text-amber-700">{cases.filter(c => calculateTriageLevel(c) === "yellow").length}</p>
                </div>
              </div>
              <div className="text-xs text-amber-600">
                {cases.filter(c => calculateTriageLevel(c) === "yellow").map(c => c.patient_name || "Unknown").join(", ") || "No urgent patients"}
              </div>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center"><CheckCircle className="w-5 h-5 text-white" /></div>
                <div>
                  <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">Green (Non-Urgent)</p>
                  <p className="text-3xl font-black text-emerald-700">{cases.filter(c => calculateTriageLevel(c) === "green").length}</p>
                </div>
              </div>
              <div className="text-xs text-emerald-600">
                {cases.filter(c => calculateTriageLevel(c) === "green").map(c => c.patient_name || "Unknown").join(", ") || "No non-urgent patients"}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-gradient-to-r from-amber-50 to-orange-50">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-amber-600" />
                Patient Triage Assessment
              </h3>
            </div>
            <div className="divide-y divide-gray-100">
              {cases.map(c => {
                const level = calculateTriageLevel(c);
                const lc = {
                  red: { bg: "bg-red-50", dot: "bg-red-500", badge: "bg-red-500", label: "Immediate" },
                  yellow: { bg: "bg-amber-50", dot: "bg-amber-500", badge: "bg-amber-500", label: "Urgent" },
                  green: { bg: "bg-emerald-50", dot: "bg-emerald-500", badge: "bg-emerald-500", label: "Non-Urgent" },
                }[level];
                return (
                  <div key={c.task_id} className={`px-5 py-3 flex items-center justify-between ${lc.bg}`}>
                    <div className="flex items-center gap-3">
                      <span className={`w-2.5 h-2.5 rounded-full ${lc.dot}`} />
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{c.patient_name || "Unknown"}</p>
                        <p className="text-xs text-gray-500">{c.patient_case} · {c.patient_age || "?"}y</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isAnyVitalAbnormal(c) && <AlertCircle className="w-4 h-4 text-red-400" />}
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold text-white ${lc.badge}`}>{lc.label}</span>
                    </div>
                  </div>
                );
              })}
              {cases.length === 0 && (
                <div className="px-5 py-8 text-center text-gray-400 text-sm">No cases to triage</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============ ED BOARD TAB ============ */}
      {activeSubTab === "edboard" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Total Beds</p>
              <p className="text-3xl font-black text-blue-700">
                {hospitals.find((h: any) => h.name === selectedHospital)?.total_beds || 0}
              </p>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
              <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">Available</p>
              <p className="text-3xl font-black text-emerald-700">
                {hospitals.find((h: any) => h.name === selectedHospital)?.available_beds || 0}
              </p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide">Emergency Beds</p>
              <p className="text-3xl font-black text-amber-700">
                {hospitals.find((h: any) => h.name === selectedHospital)?.emergency_beds || 0}
              </p>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4">
              <p className="text-xs font-semibold text-purple-600 uppercase tracking-wide">Today Cases</p>
              <p className="text-3xl font-black text-purple-700">{cases.length}</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-600" />
                Patient Flow & Disposition
              </h3>
            </div>
            <div className="p-5 space-y-3">
              {[
                { label: "Arrived", count: cases.filter(c => c.duration_min !== undefined).length, icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50" },
                { label: "In Transit", count: newCaseCount, icon: Truck, color: "text-blue-600", bg: "bg-blue-50" },
                { label: "Pending Route", count: pendingCaseCount, icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
              ].map(item => (
                <div key={item.label} className={`${item.bg} rounded-xl p-4 flex items-center justify-between`}>
                  <div className="flex items-center gap-3">
                    <item.icon className={`w-5 h-5 ${item.color}`} />
                    <span className="text-sm font-medium text-gray-700">{item.label}</span>
                  </div>
                  <span className={`text-xl font-bold ${item.color}`}>{item.count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-gradient-to-r from-rose-50 to-red-50">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Activity className="w-4 h-4 text-rose-600" />
                Cases by Type
              </h3>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {["Heart Attack", "Accident", "Burn", "Other"].map(type => {
                  const count = cases.filter(c => (c.patient_case === type) || (type === "Other" && !["Heart Attack", "Accident", "Burn"].includes(c.patient_case || ""))).length;
                  const colors: Record<string, string> = {
                    "Heart Attack": "bg-red-100 text-red-700 border-red-200",
                    "Accident": "bg-orange-100 text-orange-700 border-orange-200",
                    "Burn": "bg-yellow-100 text-yellow-700 border-yellow-200",
                    "Other": "bg-gray-100 text-gray-700 border-gray-200",
                  };
                  return (
                    <div key={type} className={`rounded-xl border p-4 text-center ${colors[type]}`}>
                      <p className="text-2xl font-black">{count}</p>
                      <p className="text-xs font-semibold mt-1">{type}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============ BEDS TAB ============ */}
      {activeSubTab === "beds" && (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-3">
            {(["ICU", "Emergency", "General", "CCU"] as const).map(ward => {
              const colors: Record<string, string> = {
                ICU: "from-red-500 to-rose-600",
                Emergency: "from-amber-500 to-orange-600",
                General: "from-emerald-500 to-teal-600",
                CCU: "from-blue-500 to-indigo-600",
              };
              return (
                <div key={ward} className={`bg-gradient-to-br ${colors[ward]} rounded-xl p-3 text-white`}>
                  <p className="text-[10px] font-semibold opacity-80 uppercase">{ward}</p>
                  <p className="text-lg font-black">--</p>
                  <p className="text-[10px] opacity-80">-- occupied</p>
                </div>
              );
            })}
          </div>
          <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center text-gray-500">
            <Bed className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p>Bed management details are available in the hospital system</p>
          </div>
        </div>
      )}
    </div>
  );
}
