"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Building2, Plus, Edit2, Trash2, X, Stethoscope, Users, MapPin } from "lucide-react";
import { fetchHospitalsList, fetchHospitalInfo, createHospitalInfo, updateHospitalInfo, deleteHospitalInfo, HospitalInfo } from "@/lib/api";

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
}

export default function HospitalInfoTab() {
  const [hospitals, setHospitals] = useState<HospitalOption[]>([]);
  const [selectedHospital, setSelectedHospital] = useState<string>("");
  const [selectedCaseType, setSelectedCaseType] = useState<string>("");
  const [hospitalInfos, setHospitalInfos] = useState<HospitalInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

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
    loadHospitalInfo();
  }, [selectedHospital, selectedCaseType]);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
          <Building2 className="w-5 h-5 text-purple-600" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Hospital Information</h2>
          <p className="text-sm text-gray-500">Manage doctors, wards, floors & beds per case type</p>
        </div>
      </div>

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
          <button
            onClick={startAdd}
            className="w-full px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium flex items-center justify-center gap-2"
          >
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
            <motion.div
              key={info.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-4 border border-gray-200 rounded-xl hover:border-purple-300 transition-colors"
            >
              {editingId === info.id ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Doctor Name</label>
                    <input
                      type="text"
                      value={formData.doctor_name}
                      onChange={(e) => setFormData({ ...formData, doctor_name: e.target.value })}
                      className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Ward No</label>
                      <input
                        type="text"
                        value={formData.ward_no}
                        onChange={(e) => setFormData({ ...formData, ward_no: e.target.value })}
                        className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Floor</label>
                      <input
                        type="text"
                        value={formData.floor_no}
                        onChange={(e) => setFormData({ ...formData, floor_no: e.target.value })}
                        className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Bed No</label>
                      <input
                        type="text"
                        value={formData.bed_no}
                        onChange={(e) => setFormData({ ...formData, bed_no: e.target.value })}
                        className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleUpdate(info.id)} className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium">
                      Save
                    </button>
                    <button onClick={() => setEditingId(null)} className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm font-medium">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-start mb-2">
                    <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-lg text-xs font-medium">{info.case_type}</span>
                    <div className="flex gap-1">
                      <button onClick={() => startEdit(info)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(info.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg">
                        <Trash2 className="w-4 h-4" />
                      </button>
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
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl max-w-md w-full p-6"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Add Hospital Info</h3>
              <button onClick={() => setShowAddForm(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Hospital *</label>
                <select
                  value={formData.hospital_name}
                  onChange={(e) => setFormData({ ...formData, hospital_name: e.target.value })}
                  className="w-full rounded-lg border-2 border-gray-200 px-4 py-2.5 focus:border-purple-500 focus:outline-none bg-white"
                >
                  <option value="">Select hospital</option>
                  {hospitals.map((h) => (
                    <option key={h.id} value={h.name}>{h.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Case Type *</label>
                <select
                  value={formData.case_type}
                  onChange={(e) => setFormData({ ...formData, case_type: e.target.value })}
                  className="w-full rounded-lg border-2 border-gray-200 px-4 py-2.5 focus:border-purple-500 focus:outline-none bg-white"
                >
                  <option value="">Select case type</option>
                  {CASE_TYPES.map((ct) => (
                    <option key={ct.value} value={ct.value}>{ct.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Doctor Name *</label>
                <input
                  type="text"
                  value={formData.doctor_name}
                  onChange={(e) => setFormData({ ...formData, doctor_name: e.target.value })}
                  placeholder="Dr. John Doe"
                  className="w-full rounded-lg border-2 border-gray-200 px-4 py-2.5 focus:border-purple-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ward No *</label>
                  <input
                    type="text"
                    value={formData.ward_no}
                    onChange={(e) => setFormData({ ...formData, ward_no: e.target.value })}
                    placeholder="A-101"
                    className="w-full rounded-lg border-2 border-gray-200 px-4 py-2.5 focus:border-purple-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Floor No *</label>
                  <input
                    type="text"
                    value={formData.floor_no}
                    onChange={(e) => setFormData({ ...formData, floor_no: e.target.value })}
                    placeholder="2nd"
                    className="w-full rounded-lg border-2 border-gray-200 px-4 py-2.5 focus:border-purple-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bed No</label>
                  <input
                    type="text"
                    value={formData.bed_no}
                    onChange={(e) => setFormData({ ...formData, bed_no: e.target.value })}
                    placeholder="5"
                    className="w-full rounded-lg border-2 border-gray-200 px-4 py-2.5 focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>
              <button onClick={handleAdd} className="w-full px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium">
                Add Info
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}