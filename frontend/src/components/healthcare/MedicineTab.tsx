"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Pill, Clock, Calendar, CheckCircle2, AlertTriangle, AlertCircle } from "lucide-react";
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

export default function MedicineTab() {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "completed">("active");

  useEffect(() => {
    fetchMedicines();
  }, []);

  const fetchMedicines = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const data = await getPatientMedicines(user.email!, false);
      setMedicines(data.medicines);
    } catch (err) {
      console.error('Error fetching medicines:', err);
    }
  };

  const handleToggleActive = async (medicineId: string, currentActive: boolean) => {
    setLoading(true);
    try {
      await updateMedicine(medicineId, !currentActive);
      fetchMedicines();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update medicine");
    } finally {
      setLoading(false);
    }
  };

  const filteredMedicines = medicines.filter(m => {
    if (filter === "active") return m.is_active;
    if (filter === "completed") return !m.is_active;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Medicine Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-pink-100 flex items-center justify-center">
              <Pill className="w-5 h-5 text-pink-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Your Medicines</h2>
              <p className="text-sm text-gray-500">Track your prescribed medications</p>
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

        {error && <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 p-3 rounded-xl mb-4"><AlertTriangle className="w-4 h-4" />{error}</div>}

        {filteredMedicines.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Pill className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>{filter === "active" ? "No active medicines. Your prescriptions will appear here." : filter === "completed" ? "No completed/stopped medicines." : "No medicines found."}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMedicines.map((med) => (
              <motion.div key={med.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className={`p-4 rounded-xl border-2 transition ${med.is_active ? "border-emerald-200 bg-emerald-50/50" : "border-gray-200 bg-gray-50"}`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{med.medicine_name}</h3>
                    {med.dosage && <p className="text-sm text-gray-600 mt-0.5">{med.dosage}</p>}
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${med.is_active ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-600"}`}>
                    {med.is_active ? "Active" : "Stopped"}
                  </span>
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
                  {med.instructions && (
                    <div className="p-2 bg-white rounded-lg text-gray-600 text-xs">{med.instructions}</div>
                  )}
                </div>

                <button onClick={() => handleToggleActive(med.id, med.is_active)} disabled={loading}
                  className={`mt-3 w-full py-2 rounded-lg text-sm font-medium transition ${med.is_active ? "bg-red-100 text-red-700 hover:bg-red-200" : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"}`}>
                  {med.is_active ? "Stop Medicine" : "Resume Medicine"}
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Medicine Schedule */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
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
                        {med.dosage && <p className="text-xs text-gray-500">{med.dosage}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
