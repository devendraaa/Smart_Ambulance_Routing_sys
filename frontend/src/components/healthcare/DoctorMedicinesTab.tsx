"use client";

import { useState, useEffect, useMemo } from "react";
import { Pill, Search, Plus, CheckCircle2, Building2, Users, PackageCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import MedicineForm from "./MedicineForm";

interface PatientMedicine {
  id: string;
  patient_email: string;
  patient_name?: string;
  hospital_name?: string;
  medicine_name: string;
  dosage: string;
  frequency: string;
  timing: string;
  duration: string;
  instructions: string;
  route?: string;
  is_prn?: boolean;
  quantity?: string;
  refills?: string;
  is_active: boolean;
  medicine_collected?: boolean;
  collected_at?: string;
  created_at: string;
  appointment_id?: string;
}

function groupByPatient(medicines: PatientMedicine[]): { patient_name: string; medicines: PatientMedicine[] }[] {
  const map = new Map<string, PatientMedicine[]>();
  for (const med of medicines) {
    const name = med.patient_name || med.patient_email.split("@")[0];
    if (!map.has(name)) map.set(name, []);
    map.get(name)!.push(med);
  }
  return Array.from(map.entries())
    .map(([patient_name, meds]) => ({ patient_name, medicines: meds }))
    .sort((a, b) => a.patient_name.localeCompare(b.patient_name));
}

export default function DoctorMedicinesTab() {
  const [medicines, setMedicines] = useState<PatientMedicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [error, setError] = useState("");
  const [selectedHospital, setSelectedHospital] = useState<string>("all");

  const isAdmin = true; // DoctorMedicinesTab always editable

  useEffect(() => {
    loadMedicines();
  }, []);

  const loadMedicines = async () => {
    try {
      const { data, error } = await supabase
        .from("patient_medicines")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      setMedicines(data || []);
    } catch (err) {
      console.error("Error loading medicines:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMedicine = async (formData: any) => {
    const { error } = await supabase.from("patient_medicines").insert([{
      patient_email: formData.patient_email || "unknown@patient.com",
      patient_name: formData.patient_name || "",
      hospital_name: formData.hospital_name || "",
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
    loadMedicines();
  };

  const toggleActive = async (medId: string, currentActive: boolean) => {
    await supabase.from("patient_medicines").update({ is_active: !currentActive }).eq("id", medId);
    setMedicines(medicines.map(m => m.id === medId ? { ...m, is_active: !currentActive } : m));
  };

  const toggleCollected = async (medId: string, currentlyCollected: boolean) => {
    await supabase.from("patient_medicines").update({
      medicine_collected: !currentlyCollected,
      collected_at: !currentlyCollected ? new Date().toISOString() : null,
    }).eq("id", medId);
    setMedicines(medicines.map(m =>
      m.id === medId ? { ...m, medicine_collected: !currentlyCollected } : m
    ));
  };

  const deleteMedicine = async (medId: string) => {
    if (!confirm("Delete this medicine?")) return;
    await supabase.from("patient_medicines").delete().eq("id", medId);
    setMedicines(medicines.filter(m => m.id !== medId));
  };

  const filteredMedicines = useMemo(() => {
    return medicines.filter(m => {
      if (searchQuery && !m.medicine_name.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !m.patient_email.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !(m.patient_name || "").toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      if (selectedHospital !== "all" && m.hospital_name !== selectedHospital) return false;
      return true;
    });
  }, [medicines, searchQuery, selectedHospital]);

  const patientGroups = useMemo(() => groupByPatient(filteredMedicines), [filteredMedicines]);

  const hospitals = useMemo(() => {
    const set = new Set<string>();
    for (const m of medicines) if (m.hospital_name) set.add(m.hospital_name);
    return Array.from(set).sort();
  }, [medicines]);

  const totalStats = useMemo(() => {
    let patients = 0, total = 0, collected = 0, active = 0;
    for (const g of patientGroups) {
      patients++;
      total += g.medicines.length;
      collected += g.medicines.filter(m => m.medicine_collected).length;
      active += g.medicines.filter(m => m.is_active).length;
    }
    return { patients, total, collected, active };
  }, [patientGroups]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Pill className="w-5 h-5 text-blue-600" />
          Patient Medicines
        </h2>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, email, medicine..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none w-48 sm:w-64"
            />
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center gap-2 transition"
          >
            <Plus className="w-4 h-4" />
            Add Medicine
          </button>
        </div>
      </div>

      <MedicineForm
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleSaveMedicine}
        existingMedicineNames={medicines.map(m => m.medicine_name)}
      />

      {error && (
        <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-xl">
          <CheckCircle2 className="w-4 h-4 shrink-0" />{error}
        </div>
      )}

      {hospitals.length > 1 && (
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-gray-400" />
          <select
            value={selectedHospital}
            onChange={(e) => setSelectedHospital(e.target.value)}
            className="rounded-lg border-2 border-gray-200 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none bg-white"
          >
            <option value="all">All Hospitals</option>
            {hospitals.map(h => <option key={h} value={h}>{h}</option>)}
          </select>
        </div>
      )}

      {patientGroups.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <div className="px-3 py-1.5 bg-blue-100 rounded-lg flex items-center gap-1.5">
            <Users className="w-4 h-4 text-blue-600" />
            <span className="text-sm text-blue-700">{totalStats.patients} patients</span>
          </div>
          <div className="px-3 py-1.5 bg-pink-100 rounded-lg flex items-center gap-1.5">
            <Pill className="w-4 h-4 text-pink-600" />
            <span className="text-sm text-pink-700">{totalStats.total} medicines</span>
          </div>
          <div className="px-3 py-1.5 bg-emerald-100 rounded-lg flex items-center gap-1.5">
            <PackageCheck className="w-4 h-4 text-emerald-600" />
            <span className="text-sm text-emerald-700">{totalStats.collected} collected</span>
          </div>
          <div className="px-3 py-1.5 bg-green-100 rounded-lg flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <span className="text-sm text-green-700">{totalStats.active} active</span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading medicines...</div>
      ) : patientGroups.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No medicines found</div>
      ) : (
        <div className="space-y-4">
          {patientGroups.map((group) => {
            const allCollected = group.medicines.every(m => m.medicine_collected);
            const collectedCount = group.medicines.filter(m => m.medicine_collected).length;
            const patientHospital = group.medicines[0]?.hospital_name;
            return (
              <div key={group.patient_name} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className={`px-4 py-3 border-b flex items-center gap-3 ${allCollected ? "bg-emerald-50 border-emerald-200" : "bg-gray-50"}`}>
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <Users className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 text-sm truncate">{group.patient_name}</h3>
                    <p className="text-xs text-gray-500">
                      {group.medicines.length} meds
                      {patientHospital && <span> &bull; {patientHospital}</span>}
                    </p>
                  </div>
                  {allCollected ? (
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Collected
                    </span>
                  ) : collectedCount > 0 ? (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">
                      {collectedCount}/{group.medicines.length} collected
                    </span>
                  ) : null}
                </div>
                <div className="p-4 space-y-2">
                  {group.medicines.map((med) => (
                    <div key={med.id} className={`p-3 rounded-lg border ${med.medicine_collected ? "border-emerald-300 bg-emerald-50" : med.is_active ? "border-gray-200 bg-white" : "border-gray-300 bg-gray-50"}`}>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-gray-900 text-sm">{med.medicine_name}</span>
                            {med.is_prn && <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded font-medium">PRN</span>}
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${med.is_active ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}`}>
                              {med.is_active ? "Active" : "Inactive"}
                            </span>
                            {med.medicine_collected && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded flex items-center gap-0.5">
                                <CheckCircle2 className="w-2.5 h-2.5" /> Collected
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-600 mt-1">
                            D: {med.dosage || "N/A"} | Route: {med.route || "Oral"} | F: {med.frequency} | T: {med.timing} | Dur: {med.duration}
                            {med.quantity && <span> | Qty: {med.quantity}</span>}
                            {med.refills && med.refills !== "0" && <span> | Refill: {med.refills}</span>}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">{med.patient_email}{med.patient_name ? ` (${med.patient_name})` : ""}</p>
                          {med.instructions && <p className="text-[10px] text-gray-500 mt-1">Note: {med.instructions}</p>}
                        </div>
                        <div className="flex gap-2 shrink-0">
                          {!med.medicine_collected && (
                            <button onClick={() => toggleCollected(med.id, false)}
                              className="px-2 py-1 text-[10px] bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200 font-medium">
                              Collect
                            </button>
                          )}
                          {med.medicine_collected && (
                            <button onClick={() => toggleCollected(med.id, true)}
                              className="px-2 py-1 text-[10px] bg-gray-100 text-gray-600 rounded hover:bg-gray-200 font-medium">
                              Undo
                            </button>
                          )}
                          <button onClick={() => toggleActive(med.id, med.is_active)}
                            className={`px-2 py-1 text-[10px] rounded font-medium ${med.is_active ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200" : "bg-green-100 text-green-700 hover:bg-green-200"}`}>
                            {med.is_active ? "Deactivate" : "Activate"}
                          </button>
                          <button onClick={() => deleteMedicine(med.id)}
                            className="px-2 py-1 text-[10px] bg-red-100 text-red-700 rounded hover:bg-red-200 font-medium">
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
