"use client";

import { useState, useEffect } from "react";
import { Pill, Search, Plus, X } from "lucide-react";
import { supabase } from "@/lib/supabase";

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

const DOSAGE_OPTIONS = ["5mg", "10mg", "25mg", "50mg", "100mg", "250mg", "500mg", "1g"];
const FREQUENCY_OPTIONS = ["Once daily", "Twice daily", "Three times daily", "Four times daily", "As needed"];
const TIMING_OPTIONS = ["Before meal", "After meal", "With food", "Empty stomach", "Bedtime"];
const DURATION_OPTIONS = ["3 days", "5 days", "7 days", "10 days", "14 days", "1 month", "2 months", "3 months"];

export default function DoctorMedicinesTab() {
  const [medicines, setMedicines] = useState<PatientMedicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newMedicine, setNewMedicine] = useState({
    patient_email: "",
    medicine_name: "",
    dosage: "",
    frequency: "Once daily",
    timing: "After meal",
    duration: "7 days",
    instructions: "",
  });

  useEffect(() => {
    loadMedicines();
  }, []);

  const loadMedicines = async () => {
    try {
      const { data, error } = await supabase
        .from("patient_medicines")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      setMedicines(data || []);
    } catch (err) {
      console.error("Error loading medicines:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredMedicines = medicines.filter((med) =>
    med.patient_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    med.medicine_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddMedicine = async () => {
    if (!newMedicine.patient_email || !newMedicine.medicine_name) {
      alert("Patient email and medicine name are required");
      return;
    }

    try {
      const { error } = await supabase.from("patient_medicines").insert([{
        patient_email: newMedicine.patient_email,
        medicine_name: newMedicine.medicine_name,
        dosage: newMedicine.dosage,
        frequency: newMedicine.frequency,
        timing: newMedicine.timing,
        duration: newMedicine.duration,
        instructions: newMedicine.instructions,
        is_active: true,
      }]);

      if (error) throw error;

      setShowAddModal(false);
      setNewMedicine({
        patient_email: "",
        medicine_name: "",
        dosage: "",
        frequency: "Once daily",
        timing: "After meal",
        duration: "7 days",
        instructions: "",
      });
      loadMedicines();
    } catch (err) {
      console.error("Error adding medicine:", err);
      alert("Failed to add medicine");
    }
  };

  const toggleMedicineStatus = async (medId: string, currentStatus: boolean) => {
    try {
      await supabase
        .from("patient_medicines")
        .update({ is_active: !currentStatus })
        .eq("id", medId);

      setMedicines(medicines.map((med) =>
        med.id === medId ? { ...med, is_active: !currentStatus } : med
      ));
    } catch (err) {
      console.error("Error updating medicine:", err);
    }
  };

  const deleteMedicine = async (medId: string) => {
    if (!confirm("Are you sure you want to delete this medicine?")) return;

    try {
      await supabase.from("patient_medicines").delete().eq("id", medId);
      setMedicines(medicines.filter((med) => med.id !== medId));
    } catch (err) {
      console.error("Error deleting medicine:", err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Pill className="w-5 h-5 text-blue-600" />
          Patient Medicines
        </h2>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search by email or medicine..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center gap-2 transition"
          >
            <Plus className="w-4 h-4" />
            Add Medicine
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading medicines...</div>
      ) : filteredMedicines.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No medicines found</div>
      ) : (
        <div className="space-y-3">
          {filteredMedicines.map((med) => (
            <div key={med.id} className={`p-4 rounded-xl border ${med.is_active ? "bg-white border-gray-200" : "bg-gray-50 border-gray-300"}`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">{med.medicine_name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      med.is_active ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"
                    }`}>
                      {med.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    <span className="font-medium">Dosage:</span> {med.dosage || "N/A"} |
                    <span className="font-medium"> Freq:</span> {med.frequency} |
                    <span className="font-medium"> Timing:</span> {med.timing}
                  </p>
                  <p className="text-sm text-gray-500">
                    <span className="font-medium">Duration:</span> {med.duration} |
                    <span className="font-medium"> Patient:</span> {med.patient_email}
                  </p>
                  {med.instructions && (
                    <p className="text-xs text-gray-400 mt-1">Note: {med.instructions}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => toggleMedicineStatus(med.id, med.is_active)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                      med.is_active
                        ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                        : "bg-green-100 text-green-700 hover:bg-green-200"
                    }`}
                  >
                    {med.is_active ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    onClick={() => deleteMedicine(med.id)}
                    className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Medicine Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Add New Medicine</h3>
              <button onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Patient Email *</label>
                <input
                  type="email"
                  value={newMedicine.patient_email}
                  onChange={(e) => setNewMedicine({ ...newMedicine, patient_email: e.target.value })}
                  placeholder="patient@example.com"
                  className="w-full rounded-lg border-2 border-gray-200 px-4 py-2.5 focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Medicine Name *</label>
                <input
                  type="text"
                  value={newMedicine.medicine_name}
                  onChange={(e) => setNewMedicine({ ...newMedicine, medicine_name: e.target.value })}
                  placeholder="e.g., Paracetamol"
                  className="w-full rounded-lg border-2 border-gray-200 px-4 py-2.5 focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dosage</label>
                  <select
                    value={newMedicine.dosage}
                    onChange={(e) => setNewMedicine({ ...newMedicine, dosage: e.target.value })}
                    className="w-full rounded-lg border-2 border-gray-200 px-4 py-2.5 focus:border-blue-500 focus:outline-none bg-white"
                  >
                    <option value="">Select dosage</option>
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

              <div className="grid grid-cols-2 gap-4">
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
                  rows={3}
                  className="w-full rounded-lg border-2 border-gray-200 px-4 py-2.5 focus:border-blue-500 focus:outline-none resize-none"
                />
              </div>

              <button
                onClick={handleAddMedicine}
                className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
              >
                Add Medicine
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}