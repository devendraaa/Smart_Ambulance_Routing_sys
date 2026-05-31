"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/lib/LanguageContext";
import { Pill, Clock, Calendar, CheckCircle2, AlertTriangle, Users, PackageCheck, Building2, ChevronDown } from "lucide-react";
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

function groupByDate(medicines: Medicine[]): Map<string, Medicine[]> {
  const map = new Map<string, Medicine[]>();
  for (const med of medicines) {
    const dateKey = med.created_at ? med.created_at.split('T')[0] : "Unknown";
    if (!map.has(dateKey)) map.set(dateKey, []);
    map.get(dateKey)!.push(med);
  }
  return map;
}

function extractHospitals(medicines: Medicine[]): string[] {
  const set = new Set<string>();
  for (const m of medicines) {
    if (m.hospital_name) set.add(m.hospital_name);
  }
  return Array.from(set).sort();
}

export default function MedicineTab() {
  const { t } = useLanguage();
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "completed">("active");
  const [selectedHospital, setSelectedHospital] = useState<string>("all");
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

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

  useEffect(() => {
    if (!patientGroups.length) return;
    const dates = new Set<string>();
    patientGroups.forEach(g => {
      const gd = groupByDate(g.medicines);
      const sorted = Array.from(gd.keys()).sort((a, b) => b.localeCompare(a));
      if (sorted[0]) dates.add(`${g.patient_name}-${sorted[0]}`);
    });
    setExpandedDates(prev => {
      if (prev.size > 0) return prev;
      const next = new Set(prev);
      dates.forEach(d => next.add(d));
      return next;
    });
  }, [patientGroups]);

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
              <h2 className="text-lg font-semibold text-gray-900">{t("medicine.header")}</h2>
              <p className="text-sm text-gray-500">{t("medicine.subtitle")}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {(["active", "all", "completed"] as const).map(f => {
              const filterLabels: Record<string, string> = {
                active: t("medicine.filterActive"),
                all: t("medicine.filterAll"),
                completed: t("medicine.filterCompleted"),
              };
              return (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition capitalize ${filter === f ? "bg-emerald-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                {filterLabels[f]}
              </button>
              );
            })}
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
              <option value="all">{t("medicine.allHospitals").replace("{count}", String(hospitals.length))}</option>
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
              <span className="text-sm text-blue-700">{t("medicine.patientsCount").replace("{count}", String(totalStats.patients))}</span>
            </div>
            <div className="px-3 py-1.5 bg-pink-100 rounded-lg flex items-center gap-1.5">
              <Pill className="w-4 h-4 text-pink-600" />
              <span className="text-sm text-pink-700">{t("medicine.medicinesCount").replace("{count}", String(totalStats.total))}</span>
            </div>
            <div className="px-3 py-1.5 bg-emerald-100 rounded-lg flex items-center gap-1.5">
              <PackageCheck className="w-4 h-4 text-emerald-600" />
              <span className="text-sm text-emerald-700">{t("medicine.collectedCount").replace("{count}", String(totalStats.collected))}</span>
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
              ? t("medicine.emptyActive")
              : filter === "completed"
              ? t("medicine.emptyCompleted")
              : t("medicine.emptyAll")}
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
                      {t("medicine.medsAndActive").replace("{count}", String(group.medicines.length)).replace("{active}", String(activeCount))}
                      {patientHospital && <span> · {patientHospital}</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {allCollected ? (
                      <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] sm:text-xs font-medium flex items-center gap-0.5 whitespace-nowrap">
                        <CheckCircle2 className="w-3 h-3" /> <span className="hidden sm:inline">{t("medicine.all")}</span> {t("medicine.collected")}
                      </span>
                    ) : collectedCount > 0 ? (
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-[10px] sm:text-xs font-medium whitespace-nowrap">
                        {t("medicine.collectedAbbr").replace("{count}", String(collectedCount)).replace("{total}", String(group.medicines.length))}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Medicine cards grouped by date */}
              <div className="p-3 sm:p-4">
                {group.medicines.length === 0 ? (
                  <p className="text-center py-6 text-gray-400 text-sm">{t("medicine.noMedicines")}</p>
                ) : (() => {
                  const dateGroups = groupByDate(group.medicines);
                  const sortedDates = Array.from(dateGroups.keys()).sort((a, b) => b.localeCompare(a));
                  return (
                    <div className="space-y-4">
                      {sortedDates.map((dateKey) => {
                        const meds = dateGroups.get(dateKey)!;
                        const formattedDate = dateKey === "Unknown"
                          ? t("medicine.unknownDate")
                          : new Date(dateKey + "T00:00:00").toLocaleDateString('en-IN', {
                              weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
                            });
                        return (
                          <div key={dateKey}>
                            {(() => {
                              const uniqueKey = `${group.patient_name}-${dateKey}`;
                              return (
                                <>
                            <button
                              onClick={() => {
                                setExpandedDates(prev => {
                                  const next = new Set(prev);
                                  if (next.has(uniqueKey)) next.delete(uniqueKey);
                                  else next.add(uniqueKey);
                                  return next;
                                });
                              }}
                              className="w-full flex items-center gap-1.5 mb-2 group"
                            >
                              <Calendar className="w-3.5 h-3.5 text-blue-500" />
                              <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider group-hover:text-blue-600 transition">{formattedDate}</h4>
                              <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full font-medium">{meds.length}</span>
                              <ChevronDown className={`w-3.5 h-3.5 text-gray-400 ml-auto transition-transform ${expandedDates.has(uniqueKey) ? "rotate-180" : ""}`} />
                            </button>
                            {expandedDates.has(uniqueKey) && (
                              <div className="space-y-1.5">
                                {meds.map((med) => (
                                  <motion.div
                                    key={med.id}
                                    initial={{ opacity: 0, y: -4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`flex items-center gap-4 px-4 py-3 rounded-xl border-l-[5px] shadow-sm transition ${
                                      med.medicine_collected
                                        ? "border-emerald-500 bg-emerald-50/70"
                                        : med.is_active
                                        ? "border-blue-500 bg-white"
                                        : "border-gray-400 bg-gray-50"
                                    }`}
                                  >
                                    <div className="flex-1 min-w-0 flex items-center gap-3">
                                      <span className="text-xl shrink-0">{med.is_prn ? "⚡" : "💊"}</span>
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                          <span className="font-semibold text-gray-900 text-sm truncate">{med.medicine_name}</span>
                                          {med.dosage && <span className="text-xs text-gray-500">{med.dosage}</span>}
                                          {med.route && <span className="text-xs text-gray-400">({med.route})</span>}
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                                          {med.frequency && <span>🕐 {med.frequency}</span>}
                                          {med.timing && <span>{TIME_ICONS[med.timing] || "💊"} {med.timing}</span>}
                                          {med.duration && <span>📅 {med.duration}</span>}
                                          {med.quantity && <span>📦 {med.quantity}</span>}
                                          {med.refills && med.refills !== "0" && <span>🔄 x{med.refills}</span>}
                                        </div>
                                        {med.instructions && (
                                          <p className="text-xs text-gray-400 italic mt-1">{med.instructions}</p>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      {med.medicine_collected ? (
                                        <span className="text-xs px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-lg font-medium flex items-center gap-1">
                                          <CheckCircle2 className="w-3.5 h-3.5" /> {t("medicine.collected")}
                                        </span>
                                      ) : (
                                        <button
                                          onClick={() => handleToggleActive(med.id, med.is_active)}
                                          disabled={loading}
                                          className={`text-xs px-3 py-1.5 rounded-lg font-medium transition ${
                                            med.is_active
                                              ? "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
                                              : "bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200"
                                          }`}
                                        >
                                          {med.is_active ? t("medicine.stop") : t("medicine.resume")}
                                        </button>
                                      )}
                                    </div>
                                  </motion.div>
                                ))}
                              </div>
                            )}
                                </>
                              );
                            })()}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
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
              <h2 className="text-lg font-semibold text-gray-900">{t("medicine.dailySchedule")}</h2>
              <p className="text-sm text-gray-500">{t("medicine.dailyScheduleSubtitle")}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { key: "Morning (8 AM)", label: t("medicine.timeMorning") },
              { key: "Afternoon (12 PM)", label: t("medicine.timeAfternoon") },
              { key: "Evening (6 PM)", label: t("medicine.timeEvening") },
              { key: "Night (10 PM)", label: t("medicine.timeNight") },
            ].map(({ key: time, label }) => {
              const meds = medicines.filter(m => m.is_active && m.timing === time);
              return (
                <div key={time} className="p-4 rounded-xl bg-gray-50 border border-gray-200">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xl">{TIME_ICONS[time] || "💊"}</span>
                    <span className="font-medium text-gray-700 text-sm">{label}</span>
                  </div>
                  {meds.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">{t("medicine.noMedicines")}</p>
                  ) : (
                    <div className="space-y-2">
                      {meds.map(med => (
                        <div key={med.id} className="p-2 bg-white rounded-lg shadow-sm">
                          <p className="font-medium text-gray-900 text-sm">{med.medicine_name}</p>
                          <div className="flex items-center justify-between mt-0.5">
                            <p className="text-xs text-gray-500">{med.dosage}</p>
                            <span className="text-xs text-gray-400">{med.patient_name || t("medicine.you")}</span>
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
