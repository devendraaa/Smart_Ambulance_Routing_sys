"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Pill, Clock, Calendar, CheckCircle2, AlertTriangle, Users, PackageCheck, Building2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getPatientMedicines, updateMedicine, Medicine } from "@/lib/healthcare";

const TIME_ICONS: Record<string, string> = {
  "Morning (8 AM)": "🌅",
  "Afternoon (12 PM)": "☀️",
  "Evening (6 PM)": "🌆",
  "Night (10 PM)": "🌙",
  "Before Meals": "🍽️",
  "After Meals": "🍽️",
  "Empty Stomach": "⚠️",
};

interface PatientGroup {
  patient_name: string;
  medicines: Medicine[];
}

function enrichWithHospital(
  medicines: Medicine[],
  appointmentMap: Map<string, { hospital_name: string }>
): Medicine[] {
  return medicines.map(med => ({
    ...med,
    hospital_name: med.hospital_name || appointmentMap.get(med.patient_email)?.hospital_name || "Unknown Hospital"
  }));
}

function groupByPatient(medicines: Medicine[]): PatientGroup[] {
  const map = new Map<string, Medicine[]>();
  for (const med of medicines) {
    const name = med.patient_name || med.patient_email.split("@")[0];
    if (!map.has(name)) map.set(name, []);
    map.get(name)!.push(med);
  }
  return Array.from(map.entries())
    .map(([patient_name, meds]) => ({ patient_name, medicines: meds }))
    .sort((a, b) => a.patient_name.localeCompare(b.patient_name));
}

function extractHospitals(medicines: Medicine[]): string[] {
  const set = new Set<string>();
  for (const m of medicines) {
    if (m.hospital_name) set.add(m.hospital_name);
  }
  return Array.from(set).sort();
}

export default function MedicineTab() {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "completed">("active");
  const [selectedHospital, setSelectedHospital] = useState<string>("all");

  useEffect(() => {
    fetchMedicines();
  }, []);

  const fetchMedicines = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const data = await getPatientMedicines(user.email!, false);
      let meds = data.medicines || [];

      const { data: appointments } = await supabase
        .from("patient_appointments")
        .select("patient_email, hospital_name")
        .eq("patient_email", user.email);

      const appointmentMap = new Map<string, { hospital_name: string }>();
      appointments?.forEach(apt => {
        appointmentMap.set(apt.patient_email, { hospital_name: apt.hospital_name });
      });

      meds = enrichWithHospital(meds, appointmentMap);
      setMedicines(meds);
    } catch (err) {
      console.error('Error fetching medicines:', err);
    }
  };

  const handleToggleActive = async (medicineId: string, currentActive: boolean) => {
    setLoading(true);
    try {
      await updateMedicine(medicineId, { is_active: !currentActive });
      fetchMedicines();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update medicine");
    } finally {
      setLoading(false);
    }
  };

  const hospitals = useMemo(() => extractHospitals(medicines), [medicines]);

  const filteredMedicines = useMemo(() => {
    return medicines.filter(m => {
      if (filter === "active") return m.is_active;
      if (filter === "completed") return !m.is_active;
      return true;
    }).filter(m => {
      if (selectedHospital === "all") return true;
      return m.hospital_name === selectedHospital;
    });
  }, [medicines, filter, selectedHospital]);

  const patientGroups = useMemo(() => groupByPatient(filteredMedicines), [filteredMedicines]);

  const totalStats = useMemo(() => {
    let patients = 0;
    let total = 0;
    let collected = 0;
    for (const g of patientGroups) {
      patients++;
      total += g.medicines.length;
      collected += g.medicines.filter(m => m.medicine_collected).length;
    }
    return { patients, total, collected };
  }, [patientGroups]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-pink-100 flex items-center justify-center">
              <Pill className="w-5 h-5 text-pink-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Your Medicines</h2>
              <p className="text-sm text-gray-500">Track prescribed medications</p>
            </div>
          </div>
          <div className="flex gap-2">
            {(["active", "all", "completed"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition capitalize ${filter === f ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Hospital filter */}
        {hospitals.length > 1 && (
          <div className="relative mb-4">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              value={selectedHospital}
              onChange={(e) => setSelectedHospital(e.target.value)}
              className="w-full sm:w-64 pl-9 pr-8 py-2 bg-gray-50 border-2 border-gray-200 rounded-xl text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="all">All Hospitals ({hospitals.length})</option>
              {hospitals.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 p-3 rounded-xl mb-4">
            <AlertTriangle className="w-4 h-4" />{error}
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
          </div>
        )}
      </motion.div>

      {/* Medicines grouped by patient */}
      {patientGroups.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <Pill className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500">
            {filter === "active"
              ? "No active medicines. Prescriptions will appear here."
              : filter === "completed"
              ? "No completed medicines."
              : "No medicines found."}
          </p>
        </div>
      ) : (
        patientGroups.map((group) => {
          const activeCount = group.medicines.filter(m => m.is_active).length;
          const collectedCount = group.medicines.filter(m => m.medicine_collected).length;
          const allCollected = group.medicines.length > 0 && group.medicines.every(m => m.medicine_collected);
          const patientHospital = group.medicines[0]?.hospital_name;

          return (
            <motion.div
              key={group.patient_name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
            >
              {/* Patient header */}
              <div className={`px-4 sm:px-6 py-3 sm:py-4 border-b ${allCollected ? "bg-emerald-50 border-emerald-200" : "bg-gray-50 border-gray-100"}`}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-gray-900 text-sm sm:text-base truncate">{group.patient_name}</h3>
                    <p className="text-[10px] sm:text-xs text-gray-500 truncate">
                      {group.medicines.length} meds · {activeCount} active
                      {patientHospital && <span> · {patientHospital}</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {allCollected ? (
                      <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] sm:text-xs font-medium flex items-center gap-0.5 whitespace-nowrap">
                        <CheckCircle2 className="w-3 h-3" /> <span className="hidden sm:inline">All</span> Collected
                      </span>
                    ) : collectedCount > 0 ? (
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-[10px] sm:text-xs font-medium whitespace-nowrap">
                        {collectedCount}/{group.medicines.length} col
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Medicine cards */}
              <div className="p-4 sm:p-6">
                {group.medicines.length === 0 ? (
                  <p className="text-center py-6 text-gray-400 text-sm">No medicines</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    {group.medicines.map((med) => (
                      <motion.div
                        key={med.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className={`p-3 sm:p-4 rounded-xl border-2 transition ${
                          med.medicine_collected
                            ? "border-emerald-300 bg-emerald-50"
                            : med.is_active
                            ? "border-emerald-200 bg-emerald-50/50"
                            : "border-gray-200 bg-gray-50"
                        }`}
                      >
                        <div className="flex items-start justify-between mb-3 gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-gray-900 text-sm sm:text-base truncate">{med.medicine_name}</h3>
                              {med.is_prn && <span className="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded font-medium">PRN</span>}
                            </div>
                            {med.dosage && <p className="text-xs sm:text-sm text-gray-600 mt-0.5">{med.dosage} {med.route && `(${med.route})`}</p>}
                          </div>
                          <div className="flex flex-wrap items-center gap-1 shrink-0">
                            {med.medicine_collected && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] sm:text-xs bg-emerald-100 text-emerald-700 flex items-center gap-0.5">
                                <CheckCircle2 className="w-2.5 h-2.5" /> Collected
                              </span>
                            )}
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] sm:text-xs font-medium ${
                              med.is_active
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-gray-200 text-gray-600"
                            }`}>
                              {med.is_active ? "Active" : "Stopped"}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-2 text-sm">
                          {med.frequency && (
                            <div className="flex items-center gap-2 text-gray-600">
                              <Clock className="w-4 h-4" /> {med.frequency}
                            </div>
                          )}
                          {med.timing && (
                            <div className="flex items-center gap-2 text-gray-600">
                              <span className="text-base">{TIME_ICONS[med.timing] || "💊"}</span> {med.timing}
                            </div>
                          )}
                          {med.duration && (
                            <div className="flex items-center gap-2 text-gray-600">
                              <Calendar className="w-4 h-4" /> {med.duration}
                            </div>
                          )}
                          {med.quantity && (
                            <div className="flex items-center gap-2 text-gray-600">
                              <span className="text-base">📦</span> {med.quantity}
                            </div>
                          )}
                          {med.refills && med.refills !== "0" && (
                            <div className="flex items-center gap-2 text-gray-600">
                              <span className="text-base">🔄</span> Refills: {med.refills}
                            </div>
                          )}
                          {med.instructions && (
                            <div className="p-2 bg-white rounded-lg text-gray-600 text-xs">{med.instructions}</div>
                          )}
                        </div>

                        {!med.medicine_collected && (
                          <button
                            onClick={() => handleToggleActive(med.id, med.is_active)}
                            disabled={loading}
                            className={`mt-3 w-full py-2 rounded-lg text-sm font-medium transition ${
                              med.is_active
                                ? "bg-red-100 text-red-700 hover:bg-red-200"
                                : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                            }`}
                          >
                            {med.is_active ? "Stop Medicine" : "Resume Medicine"}
                          </button>
                        )}
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })
      )}

      {/* Daily Schedule */}
      {medicines.some(m => m.is_active) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
              <Clock className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Daily Schedule</h2>
              <p className="text-sm text-gray-500">When to take your medicines</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {["Morning (8 AM)", "Afternoon (12 PM)", "Evening (6 PM)", "Night (10 PM)"].map((time) => {
              const meds = medicines.filter(m => m.is_active && m.timing === time);
              return (
                <div key={time} className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xl">{TIME_ICONS[time] || "💊"}</span>
                    <span className="font-medium text-gray-700 text-sm">{time}</span>
                  </div>
                  {meds.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">No medicines</p>
                  ) : (
                    <div className="space-y-2">
                      {meds.map(med => (
                        <div key={med.id} className="p-2 bg-white rounded-lg shadow-sm">
                          <p className="font-medium text-gray-900 text-sm">{med.medicine_name}</p>
                          <div className="flex items-center justify-between mt-0.5">
                            <p className="text-xs text-gray-500">{med.dosage}</p>
                            <span className="text-xs text-gray-400">{med.patient_name || "You"}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
}
