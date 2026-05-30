"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { PatientDetailContent } from "./PatientDetailPage";
import { supabase } from "@/lib/supabase";
import { fetchHospitalsList } from "@/lib/api";
import { Calendar, User, Building2, Clock, Loader2, ChevronRight, Activity, Filter } from "lucide-react";

interface AdmittedPatient {
  id: string;
  patient_name: string;
  patient_email: string;
  age: number | null;
  case_type: string;
  hospital_name: string;
  status: string;
  created_at: string;
  appointment_date: string;
}

export default function DoctorTreatmentTab() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const urlPatientId = searchParams.get("patient_id");

  const [patients, setPatients] = useState<AdmittedPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(urlPatientId);

  const [hospitals, setHospitals] = useState<{ id: string; name: string }[]>([]);
  const todayStr = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [filterHospital, setFilterHospital] = useState("all");
  const [filterCaseType, setFilterCaseType] = useState("all");

  const CASE_TYPE_OPTIONS = [
    { value: "all", label: "All Cases" },
    { value: "Emergency", label: "Emergency" },
    { value: "General OPD", label: "OPD" },
    { value: "Child OPD", label: "Child OPD" },
  ];

  const EMERGENCY_CASE_TYPES = new Set([
    "Emergency",
    "Heart Attack",
    "Road Accident",
    "Accident",
    "Stroke",
    "Burn",
    "Other",
    "Heart & Emergency",
    "Accident & Trauma",
  ]);

  const matchesCaseTypeFn = (caseType: string | undefined) => {
    if (filterCaseType === "all") return true;
    if (filterCaseType === "Emergency") return EMERGENCY_CASE_TYPES.has(caseType || "");
    return caseType === filterCaseType;
  };

  useEffect(() => {
    if (urlPatientId) {
      setSelectedPatientId(urlPatientId);
    }
  }, [urlPatientId]);

  useEffect(() => {
    loadAdmittedPatients();
  }, [selectedDate]);

  useEffect(() => {
    fetchHospitalsList()
      .then((r) => {
        if (r?.hospitals) setHospitals(r.hospitals.map((h: any) => ({ id: String(h.id), name: h.name })));
      })
      .catch(() => {});
  }, []);

  const filteredPatients = patients.filter((p) => {
    const matchesHospital = filterHospital === "all" || p.hospital_name === filterHospital;
    const matchesCaseType = matchesCaseTypeFn(p.case_type);
    return matchesHospital && matchesCaseType;
  });

  const loadAdmittedPatients = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("patient_appointments")
        .select("*")
        .gte("appointment_date", `${selectedDate}T00:00:00`)
        .lte("appointment_date", `${selectedDate}T23:59:59`)
        .order("created_at", { ascending: false });
      setPatients(data || []);
    } catch (err) {
      console.error("Error loading admitted patients:", err);
    } finally {
      setLoading(false);
    }
  };

  if (selectedPatientId) {
    return (
      <PatientDetailContent
        appointmentId={selectedPatientId}
        onBack={() => {
          setSelectedPatientId(null);
          if (urlPatientId) {
            router.push("/doctor?tab=treatment");
          }
        }}
      />
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Activity className="w-6 h-6 text-blue-600" />
          <h1 className="text-xl font-bold text-gray-900">Treatment & Consultation</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          {/* Filter Bar */}
          <div className="p-4 sm:p-5 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">Admitted Patients</h2>
            <p className="text-sm text-gray-500 mt-1">Patients admitted from Emergency are listed here</p>
            <div className="flex flex-col sm:flex-row gap-3 mt-4">
              <div className="flex items-center gap-2 sm:min-w-[180px]">
                <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full rounded-xl border-2 border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
                />
              </div>
              <div className="flex items-center gap-2 flex-1">
                <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
                <select
                  value={filterHospital}
                  onChange={(e) => setFilterHospital(e.target.value)}
                  className="w-full rounded-xl border-2 border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
                >
                  <option value="all">All Hospitals</option>
                  {hospitals.map((h) => (
                    <option key={h.id} value={h.name}>{h.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2 flex-1">
                <Filter className="w-4 h-4 text-gray-400 shrink-0" />
                <select
                  value={filterCaseType}
                  onChange={(e) => setFilterCaseType(e.target.value)}
                  className="w-full rounded-xl border-2 border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
                >
                  {CASE_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500 mx-auto" />
              <p className="text-sm text-gray-500 mt-2">Loading patients...</p>
            </div>
          ) : patients.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <Calendar className="w-6 h-6 text-blue-400" />
              </div>
              <p className="text-gray-500 text-sm">No patients for this date</p>
              <p className="text-gray-400 text-xs mt-1">
                {selectedDate === todayStr
                  ? "Patients admitted today will appear here"
                  : `No appointments found for ${new Date(selectedDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`}
              </p>
            </div>
          ) : filteredPatients.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-14 h-14 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <Filter className="w-6 h-6 text-orange-400" />
              </div>
              <p className="text-gray-500 text-sm">No patients match the selected filters</p>
              <button
                onClick={() => { setFilterHospital("all"); setFilterCaseType("all"); }}
                className="mt-2 text-sm text-blue-600 hover:text-blue-700 underline"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredPatients.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPatientId(p.id)}
                  className="w-full px-4 sm:px-5 py-4 text-left hover:bg-blue-50/50 transition flex items-center gap-4"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{p.patient_name || "Unknown"}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5 text-xs text-gray-500">
                      {p.age && <span>{p.age} yrs</span>}
                      <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{p.hospital_name || "—"}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="inline-block px-2.5 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                      {p.case_type || "Emergency"}
                    </span>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      p.status === "scheduled" ? "bg-blue-100 text-blue-700" :
                      p.status === "in-consultation" ? "bg-amber-100 text-amber-700" :
                      p.status === "completed" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    }`}>
                      {p.status === "scheduled" ? "Waiting" :
                       p.status === "in-consultation" ? "Consulting" :
                       p.status === "completed" ? "Completed" : p.status}
                    </span>
                    <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1 justify-end">
                      <Clock className="w-3 h-3" />
                      {new Date(p.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
