"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { fetchHospitalsList, getTaskStatus, reverseGeocode, fetchBloodBanks, admitPatient } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { Hospital, MapPin, Calendar, User, Phone, AlertTriangle, Droplet, Loader2, Clock, Navigation, CheckCircle, Truck, Activity, Thermometer, Heart, Wind, AlertCircle, Stethoscope, Pill, TestTube, Bed, ChevronDown, ChevronUp, Save, Edit3, X, LayoutDashboard, ClipboardList, HeartPulse } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

type HospitalInfo = {
  id: number;
  name: string;
  address: string;
  specialist: string;
  total_beds: number;
  available_beds: number;
  emergency_beds: number;
  today_cases?: number;
};

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
  origin_address?: string;
  ambulance_number?: string;
  driver_name?: string;
  driver_mobile?: string;
  blood_availability?: { blood_type: string; available_liters: number }[];
  // Physiological vitals
  patient_bp_systolic?: number;
  patient_bp_diastolic?: number;
  patient_temperature?: number;
  patient_pulse?: number;
  patient_spo2?: number;
  // Doctor treatment fields
  treatment_problem?: string;
  treatment_details?: string;
  treatment_medicine?: string;
  treatment_tests?: string;
  consultant_name?: string;
  bed_number?: string;
};

function calculateTriageLevel(c: EmergencyCase): "red" | "yellow" | "green" {
  // Red (Immediate): Any critical vital or high-risk case
  if (!c.patient_bp_systolic && !c.patient_bp_diastolic && !c.patient_temperature && !c.patient_pulse && !c.patient_spo2) {
    // No vitals - triage based on case type
    if (c.patient_case === "Heart Attack" || c.patient_case === "Stroke") return "red";
    if (c.patient_case === "Accident" || c.patient_case === "Burn") return "yellow";
    return "green";
  }
  const bpSys = c.patient_bp_systolic;
  const bpDia = c.patient_bp_diastolic;
  const temp = c.patient_temperature;
  const pulse = c.patient_pulse;
  const spo2 = c.patient_spo2;

  // Critical conditions -> RED
  if (spo2 !== undefined && spo2 < 90) return "red";
  if (bpSys !== undefined && (bpSys < 90 || bpSys > 180)) return "red";
  if (bpDia !== undefined && bpDia > 120) return "red";
  if (temp !== undefined && (temp > 40 || temp < 35)) return "red";
  if (pulse !== undefined && (pulse > 140 || pulse < 40)) return "red";
  if (c.patient_case === "Heart Attack" || c.patient_case === "Stroke") return "red";

  // Urgent conditions -> YELLOW
  if (spo2 !== undefined && spo2 < 95) return "yellow";
  if (bpSys !== undefined && (bpSys > 140 || bpSys < 100)) return "yellow";
  if (temp !== undefined && (temp > 38 || temp < 36)) return "yellow";
  if (pulse !== undefined && (pulse > 100 || pulse < 60)) return "yellow";
  if (c.patient_case === "Accident" || c.patient_case === "Burn") return "yellow";

  // Default -> GREEN
  return "green";
}

export default function DoctorEmergencyTab() {
  const router = useRouter();
  const [hospitals, setHospitals] = useState<HospitalInfo[]>([]);
  const [selectedHospital, setSelectedHospital] = useState("");
  const [cases, setCases] = useState<EmergencyCase[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingHospitals, setLoadingHospitals] = useState(true);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [statusFilter, setStatusFilter] = useState<"new" | "pending" | "solved">("new");
  const [treatmentForm, setTreatmentForm] = useState({
    treatment_problem: "",
    treatment_details: "",
    treatment_medicine: "",
    treatment_tests: "",
    consultant_name: "",
    bed_number: "",
  });

  const [showHistory, setShowHistory] = useState(false);
  const [historyCases, setHistoryCases] = useState<EmergencyCase[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [expandedHistoryCards, setExpandedHistoryCards] = useState<Set<string>>(new Set());

  // Admit state
  const [admittingTaskId, setAdmittingTaskId] = useState<string | null>(null);
  const [admitMessages, setAdmitMessages] = useState<Record<string, string>>({});

  // Triage state per case
  const [triageLevels, setTriageLevels] = useState<Record<string, "red" | "yellow" | "green">>({});

  const getCaseStatus = useCallback((c: EmergencyCase): "new" | "pending" | "solved" => {
    const arrived = c.duration_min ? hasPatientArrived(c.created_at, c.duration_min, now) : false;
    if (arrived) return "solved";
    if (c.duration_min) return "new";
    return "pending";
  }, [now]);

  const newCaseCount = useMemo(() => cases.filter(c => getCaseStatus(c) === "new").length, [cases, getCaseStatus]);
  const pendingCaseCount = useMemo(() => cases.filter(c => getCaseStatus(c) === "pending").length, [cases, getCaseStatus]);
  const solvedCaseCount = useMemo(() => cases.filter(c => getCaseStatus(c) === "solved").length, [cases, getCaseStatus]);

  const filteredCases = useMemo(
    () => cases.filter(c => getCaseStatus(c) === statusFilter),
    [cases, statusFilter, getCaseStatus]
  );

  // Fetch hospitals on mount
  useEffect(() => {
    const loadHospitals = async () => {
      try {
        const data = await fetchHospitalsList();
        const hospitalsData = data.hospitals || [];

        // Get today's date range
        const today = new Date().toISOString().split("T")[0];

        // Fetch case counts for each hospital
        const hospitalsWithCounts = await Promise.all(
          hospitalsData.map(async (h: HospitalInfo) => {
            try {
              const response = await fetch(
                `${API_URL}/api/route/emergency/cases?hospital_name=${encodeURIComponent(h.name)}&start_date=${today}&end_date=${today}`
              );
              const cases = await response.json();
              return { ...h, today_cases: cases.length || 0 };
            } catch {
              return { ...h, today_cases: 0 };
            }
          })
        );

        // Sort by case count (highest first)
        hospitalsWithCounts.sort((a, b) => (b.today_cases || 0) - (a.today_cases || 0));

        setHospitals(hospitalsWithCounts);
      } catch (err) {
        console.error("Failed to load hospitals:", err);
      } finally {
        setLoadingHospitals(false);
      }
    };
    loadHospitals();
  }, []);

  // Fetch today's cases when hospital is selected
  useEffect(() => {
    if (selectedHospital) {
      loadTodayCases();
    } else {
      setCases([]);
    }
  }, [selectedHospital]);

  const loadTodayCases = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const response = await fetch(
        `${API_URL}/api/route/emergency/cases?hospital_name=${encodeURIComponent(selectedHospital)}&start_date=${today}&end_date=${today}`
      );
      const data = await response.json();

      // First fetch blood banks for the destination hospital
      let bloodBankData: any = null;
      try {
        const hospitalsResponse = await fetchHospitalsList();
        const hospitals = hospitalsResponse.hospitals || [];
        const selectedHospData = hospitals.find((h: any) => h.name === selectedHospital);
        if (selectedHospData?.lat && selectedHospData?.lon) {
          bloodBankData = await fetchBloodBanks(selectedHospData.lat, selectedHospData.lon);
        }
      } catch (err) {
        console.error("Error fetching blood banks:", err);
      }

      // Enrich each case with address and route details
      const enrichedCases = await Promise.all(
        (data || []).map(async (emergencyCase: EmergencyCase) => {
          let originAddress = "Loading...";
          let distance_km: number | undefined;
          let duration_min: number | undefined;

          try {
            // Get full task details for route info
            const taskStatus = await getTaskStatus(emergencyCase.task_id);
            distance_km = taskStatus.distance_km;
            duration_min = taskStatus.duration_min;

            // Reverse geocode origin
            const address = await reverseGeocode(emergencyCase.origin_lat, emergencyCase.origin_lon);
            originAddress = address || `${emergencyCase.origin_lat.toFixed(4)}, ${emergencyCase.origin_lon.toFixed(4)}`;
          } catch (err) {
            console.error("Error fetching case details:", err);
            originAddress = `${emergencyCase.origin_lat.toFixed(4)}, ${emergencyCase.origin_lon.toFixed(4)}`;
          }

          // Get blood availability for patient's blood group
          let bloodAvailability: { blood_type: string; available_liters: number }[] | undefined;
          if (emergencyCase.patient_blood_group && bloodBankData?.banks) {
            // Find nearest blood bank to the hospital
            const nearestBank = bloodBankData.banks[0];
            if (nearestBank?.blood_availability) {
              bloodAvailability = nearestBank.blood_availability;
            }
          }

          return {
            ...emergencyCase,
            origin_address: originAddress,
            distance_km,
            duration_min,
            blood_availability: bloodAvailability,
          };
        })
      );

      setCases(enrichedCases);
    } catch (err) {
      console.error("Failed to load emergency cases:", err);
      setCases([]);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const loadHistoryCases = async () => {
    if (!selectedHospital) return;
    setLoadingHistory(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const response = await fetch(
        `${API_URL}/api/route/emergency/cases?hospital_name=${encodeURIComponent(selectedHospital)}`
      );
      const data = await response.json();
      const historical = (data || []).filter((c: EmergencyCase) => {
        const createdDate = new Date(c.created_at).toISOString().split("T")[0];
        return createdDate !== today;
      });
      setHistoryCases(historical);
    } catch (err) {
      console.error("Failed to load history:", err);
      setHistoryCases([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const toggleHistoryExpand = (taskId: string) => {
    setExpandedHistoryCards((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const today = new Date().toISOString().split("T")[0];

      const data = await fetchHospitalsList();
      const hospitalsData = data.hospitals || [];

      const hospitalsWithCounts = await Promise.all(
        hospitalsData.map(async (h: HospitalInfo) => {
          try {
            const response = await fetch(
              `${API_URL}/api/route/emergency/cases?hospital_name=${encodeURIComponent(h.name)}&start_date=${today}&end_date=${today}`
            );
            const cases = await response.json();
            return { ...h, today_cases: cases.length || 0 };
          } catch {
            return { ...h, today_cases: 0 };
          }
        })
      );

      hospitalsWithCounts.sort((a, b) => (b.today_cases || 0) - (a.today_cases || 0));
      setHospitals(hospitalsWithCounts);

      if (selectedHospital) {
        await loadTodayCases(true);
      }
    } catch (err) {
      console.error("Failed to refresh:", err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleRefreshRef = useRef(handleRefresh);
  useEffect(() => {
    handleRefreshRef.current = handleRefresh;
  });

  const expandedCardsRef = useRef(expandedCards);
  useEffect(() => {
    expandedCardsRef.current = expandedCards;
  }, [expandedCards]);

  useEffect(() => {
    if (!selectedHospital) return;
    const interval = setInterval(() => {
      if (expandedCardsRef.current.size > 0) return;
      handleRefreshRef.current();
    }, 5000);
    return () => clearInterval(interval);
  }, [selectedHospital]);

  // Countdown tick every second
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Load history when modal opens
  useEffect(() => {
    if (showHistory && selectedHospital) {
      loadHistoryCases();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showHistory, selectedHospital]);

  const formatTime = (dateStr: string) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const toggleExpand = (taskId: string) => {
    setExpandedCards((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  const startEditing = (emergencyCase: EmergencyCase) => {
    setEditingId(emergencyCase.task_id);
    setTreatmentForm({
      treatment_problem: emergencyCase.treatment_problem || "",
      treatment_details: emergencyCase.treatment_details || "",
      treatment_medicine: emergencyCase.treatment_medicine || "",
      treatment_tests: emergencyCase.treatment_tests || "",
      consultant_name: emergencyCase.consultant_name || "",
      bed_number: emergencyCase.bed_number || "",
    });
  };

  const saveTreatment = async (taskId: string) => {
    // Update local state with the new treatment data
    setCases((prev) =>
      prev.map((c) =>
        c.task_id === taskId
          ? { ...c, ...treatmentForm }
          : c
      )
    );
    setEditingId(null);
    // Here you could also call an API to save to backend
  };

  const cancelEditing = () => {
    setEditingId(null);
    setTreatmentForm({
      treatment_problem: "",
      treatment_details: "",
      treatment_medicine: "",
      treatment_tests: "",
      consultant_name: "",
      bed_number: "",
    });
  };

  return (
    <>
      <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-orange-500 rounded-xl flex items-center justify-center">
          <AlertTriangle className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Emergency Cases</h2>
          <p className="text-sm text-gray-500">View today's patient details from ambulance routes</p>
        </div>
      </div>

      {/* Hospital Filter */}
      <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              <Hospital className="w-3.5 h-3.5 inline mr-1" />
              Select Hospital
            </label>
            {loadingHospitals ? (
              <div className="h-10 bg-gray-200 rounded-xl animate-pulse" />
            ) : (
              <select
                value={selectedHospital}
                onChange={(e) => setSelectedHospital(e.target.value)}
                className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
              >
                <option value="">Select a hospital</option>
                {hospitals.map((h) => (
                  <option key={h.id} value={h.name}>
                    {h.today_cases && h.today_cases > 0 ? `[${h.today_cases}] ${h.name}` : h.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs text-gray-500">Date</p>
              <p className="text-sm font-semibold text-gray-800">{new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</p>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition border border-blue-200"
            >
              <Loader2 className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
            <button
              onClick={() => setShowHistory(true)}
              disabled={!selectedHospital}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-purple-600 bg-purple-50 rounded-xl hover:bg-purple-100 disabled:opacity-50 disabled:cursor-not-allowed transition border border-purple-200"
            >
              <Calendar className="w-3.5 h-3.5" />
              History
            </button>
          </div>
        </div>
      </div>



      {/* Status Tabs */}
      {selectedHospital && !loading && cases.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-1.5 flex shadow-sm">
          <button
            onClick={() => setStatusFilter("new")}
            className={`flex-1 relative px-3 sm:px-6 py-2.5 sm:py-3 rounded-xl text-sm font-semibold transition-all duration-200 overflow-hidden ${
              statusFilter === "new"
                ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-200"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}
          >
            {statusFilter === "new" && newCaseCount > 0 && (
              <span className="absolute inset-0 animate-siren pointer-events-none" />
            )}
            <span className="hidden sm:inline">New Case</span>
            <span className="sm:hidden">New</span>
            <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
              statusFilter === "new" ? "bg-white/25 text-white" : "bg-gray-200 text-gray-600"
            }`}>
              {statusFilter !== "new" && newCaseCount > 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-live-dot" />
              )}
              {newCaseCount}
            </span>
          </button>
          <button
            onClick={() => setStatusFilter("pending")}
            className={`flex-1 px-3 sm:px-6 py-2.5 sm:py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
              statusFilter === "pending"
                ? "bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-lg shadow-amber-200"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}
          >
            <span className="hidden sm:inline">Pending Case</span>
            <span className="sm:hidden">Pending</span>
            <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
              statusFilter === "pending" ? "bg-white/25 text-white" : "bg-gray-200 text-gray-600"
            }`}>{pendingCaseCount}</span>
          </button>
          <button
            onClick={() => setStatusFilter("solved")}
            className={`flex-1 px-3 sm:px-6 py-2.5 sm:py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
              statusFilter === "solved"
                ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-200"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
            }`}
          >
            <span className="hidden sm:inline">Solved</span>
            <span className="sm:hidden">Solved</span>
            <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
              statusFilter === "solved" ? "bg-white/25 text-white" : "bg-gray-200 text-gray-600"
            }`}>{solvedCaseCount}</span>
          </button>
        </div>
      )}

      {/* Results */}
      {!selectedHospital ? (
        <div className="text-center py-12 bg-gray-50 rounded-2xl border border-gray-100">
          <Hospital className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Select a hospital to view emergency cases</p>
        </div>
      ) : loading ? (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Loading today's cases...</p>
        </div>
      ) : cases.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-2xl border border-gray-100">
          <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No emergency cases found today</p>
          <p className="text-sm text-gray-400 mt-1">For {selectedHospital}</p>
        </div>
      ) : filteredCases.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-2xl border border-gray-100">
          <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <AlertTriangle className="w-7 h-7 text-gray-400" />
          </div>
          <p className="text-gray-500 font-medium">No {statusFilter === "new" ? "new" : statusFilter === "pending" ? "pending" : "solved"} cases</p>
          <p className="text-sm text-gray-400 mt-1">For {selectedHospital}</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Showing <span className="font-semibold text-gray-700">{filteredCases.length}</span> {statusFilter === "new" ? "new" : statusFilter === "pending" ? "pending" : "solved"} case(s)
            </p>
          </div>

          {filteredCases.map((emergencyCase, index) => {
            const isNewCase = statusFilter === "new";
            return (
            <motion.div
              key={emergencyCase.task_id}
              layout
              initial={isNewCase ? { opacity: 0, x: 60, scale: 0.95 } : { opacity: 0, y: 20 }}
              animate={{
                opacity: 1,
                x: 0,
                y: 0,
                scale: 1,
                borderColor: isNewCase
                  ? ["rgba(239,68,68,0.3)", "rgba(239,68,68,0.7)", "rgba(239,68,68,0.3)"]
                  : ["rgba(229,231,235,1)", "rgba(229,231,235,1)", "rgba(229,231,235,1)"],
              }}
              transition={{
                delay: index * 0.08,
                duration: isNewCase ? 0.5 : 0.3,
                ease: isNewCase ? [0.34, 1.56, 0.64, 1] : "easeOut",
                borderColor: isNewCase ? { duration: 2, repeat: Infinity, ease: "easeInOut" } : { duration: 0.3 },
              }}
              className={`bg-white rounded-2xl border-2 p-5 shadow-sm transition-shadow relative overflow-hidden ${
                isNewCase
                  ? "hover:shadow-red-200/50 hover:shadow-md"
                  : "border-gray-100 hover:shadow-md"
              }`}
            >
              {/* Siren sweep overlay */}
              {isNewCase && (
                <div className="absolute inset-0 pointer-events-none animate-siren" />
              )}

              {/* Live indicator bar */}
              {isNewCase && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 via-rose-400 to-red-500 animate-pulse" />
              )}

              {/* Live badge */}
              {isNewCase && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.08 + 0.4 }}
                  className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-1 bg-red-500 text-white rounded-full text-[10px] font-bold shadow-lg shadow-red-300/50 z-10"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-live-dot" />
                  LIVE
                </motion.div>
              )}

              {/* Case Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  {isNewCase && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 300, damping: 10, delay: index * 0.08 + 0.2 }}
                      className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg shadow-red-300/50"
                    >
                      <AlertTriangle className="w-5 h-5 text-white" />
                    </motion.div>
                  )}
                  {!isNewCase && (
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    emergencyCase.status === "completed"
                      ? "bg-green-100"
                      : emergencyCase.status === "running"
                      ? "bg-blue-100"
                      : "bg-gray-100"
                  }`}>
                      <AlertTriangle className={`w-5 h-5 ${
                        emergencyCase.status === "completed"
                          ? "text-green-600"
                          : emergencyCase.status === "running"
                          ? "text-blue-600"
                          : "text-gray-600"
                      }`} />
                    </div>
                    )}
                    <div className="flex items-center gap-2">
                    <h3 className="font-bold text-lg text-gray-900">
                      {emergencyCase.patient_name || "Unknown Patient"}
                    </h3>
                    {emergencyCase.patient_case && (
                      <motion.span
                        initial={{ scale: 0.8, opacity: 0.7 }}
                        animate={isNewCase ? {
                          scale: [1, 1.08, 1],
                          opacity: 1,
                          boxShadow: [
                            "0 0 0 0 rgba(239,68,68,0.4)",
                            "0 0 12px 4px rgba(239,68,68,0.3)",
                            "0 0 0 0 rgba(239,68,68,0.4)",
                          ],
                        } : {
                          scale: [1, 1.05, 1],
                          opacity: 1,
                        }}
                        transition={{ duration: isNewCase ? 1.5 : 1.5, repeat: Infinity, repeatType: "reverse" }}
                        className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide ${
                          emergencyCase.patient_case === "Heart Attack" ? "bg-red-500 text-white shadow-lg shadow-red-300" :
                          emergencyCase.patient_case === "Accident" ? "bg-orange-500 text-white shadow-lg shadow-orange-300" :
                          emergencyCase.patient_case === "Burn" ? "bg-yellow-500 text-white shadow-lg shadow-yellow-300" :
                          "bg-gray-500 text-white shadow-lg shadow-gray-300"
                        }`}
                      >
                        <Activity className="w-3.5 h-3.5 mr-1.5" />
                        {emergencyCase.patient_case}
                      </motion.span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Clock className="w-3 h-3" />
                    {formatTime(emergencyCase.created_at)}
                  </div>
                </div>
              </div>

              {/* Compact Patient Info Bar */}
              <div className="flex flex-wrap items-center gap-2 mb-4">
                {emergencyCase.patient_age && (
                  <div className="bg-gray-100 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
                    <User className="w-3 h-3 text-gray-500" />
                    <span className="text-xs font-medium text-gray-700">{emergencyCase.patient_age}y</span>
                  </div>
                )}
                {emergencyCase.patient_sex && (
                  <div className="bg-gray-100 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
                    <User className="w-3 h-3 text-gray-500" />
                    <span className="text-xs font-medium text-gray-700">{emergencyCase.patient_sex}</span>
                  </div>
                )}
                {emergencyCase.patient_blood_group && (
                  <div className={`rounded-lg px-3 py-1.5 flex items-center gap-1.5 border ${
                    emergencyCase.blood_availability?.some(b => b.blood_type === emergencyCase.patient_blood_group && b.available_liters > 0)
                      ? "bg-green-50 border-green-200"
                      : "bg-red-50 border-red-100"
                  }`}>
                    <Droplet className={`w-3 h-3 ${emergencyCase.blood_availability?.some(b => b.blood_type === emergencyCase.patient_blood_group && b.available_liters > 0) ? "text-green-600" : "text-red-600"}`} />
                    <span className={`text-xs font-medium ${emergencyCase.blood_availability?.some(b => b.blood_type === emergencyCase.patient_blood_group && b.available_liters > 0) ? "text-green-700" : "text-red-700"}`}>
                      {emergencyCase.patient_blood_group}
                      {emergencyCase.blood_availability?.some(b => b.blood_type === emergencyCase.patient_blood_group) && (
                        <span className="ml-1 font-normal">({emergencyCase.blood_availability.find(b => b.blood_type === emergencyCase.patient_blood_group)?.available_liters}L)</span>
                      )}
                    </span>
                  </div>
                )}
                {emergencyCase.patient_mobile && (
                  <div className="bg-gray-100 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
                    <Phone className="w-3 h-3 text-gray-500" />
                    <span className="text-xs font-medium text-gray-700">{emergencyCase.patient_mobile}</span>
                  </div>
                )}
              </div>

              {/* Status + Pickup Address Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                {/* Status Badge */}
                <div className={`rounded-xl border-2 p-3 flex items-center gap-3 ${
                  hasPatientArrived(emergencyCase.created_at, emergencyCase.duration_min || 0, now)
                    ? "bg-green-50 border-green-200"
                    : "bg-amber-50 border-amber-200"
                }`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    hasPatientArrived(emergencyCase.created_at, emergencyCase.duration_min || 0, now)
                      ? "bg-green-100"
                      : "bg-amber-100"
                  }`}>
                    {hasPatientArrived(emergencyCase.created_at, emergencyCase.duration_min || 0, now) ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <Truck className="w-5 h-5 text-amber-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${hasPatientArrived(emergencyCase.created_at, emergencyCase.duration_min || 0, now) ? "text-green-700" : "text-amber-700"}`}>
                        {hasPatientArrived(emergencyCase.created_at, emergencyCase.duration_min || 0, now) ? "Arrived" : "In Route"}
                      </span>
                      {!hasPatientArrived(emergencyCase.created_at, emergencyCase.duration_min || 0, now) && emergencyCase.duration_min && (
                        <motion.span
                          key={formatCountdown(emergencyCase.created_at, emergencyCase.duration_min, now)}
                          initial={{ scale: 1 }}
                          animate={{ scale: [1, 1.05, 1] }}
                          transition={{ duration: 1, repeat: Infinity }}
                          className="text-lg font-black font-mono tabular-nums text-amber-800 bg-amber-100 px-2 py-0.5 rounded-lg"
                        >
                          {formatCountdown(emergencyCase.created_at, emergencyCase.duration_min, now)}
                        </motion.span>
                      )}
                    </div>
                    {emergencyCase.distance_km && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {emergencyCase.distance_km.toFixed(1)} km away
                      </p>
                    )}
                  </div>
                </div>

                {/* Pickup Address */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100 p-3 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                    <MapPin className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">Pickup Location</p>
                    <p className="text-sm font-medium text-gray-800 leading-snug break-words">
                      {emergencyCase.origin_address || "Loading..."}
                    </p>
                  </div>
                </div>
              </div>

              {/* Combined Vitals & Arrival Card */}
              <div className="mt-4 rounded-xl border-2 border-gray-200 overflow-hidden shadow-sm">
                <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-50 to-emerald-50 border-b border-gray-200">
                  <Activity className="w-4 h-4 text-cyan-600" />
                  <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">Physiological Vitals</span>
                  {isAnyVitalAbnormal(emergencyCase) && (
                    <motion.span
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-500 text-white rounded-full text-xs font-bold animate-pulse ml-auto"
                    >
                      <AlertCircle className="w-3 h-3" />
                      ABNORMAL
                    </motion.span>
                  )}
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                    {emergencyCase.patient_bp_systolic || emergencyCase.patient_bp_diastolic ? (
                      <motion.div
                        whileHover={{ scale: 1.02 }}
                        className={`rounded-xl p-4 border-2 ${isBpHigh(emergencyCase.patient_bp_systolic, emergencyCase.patient_bp_diastolic) ? "bg-red-50 border-red-300" : "bg-cyan-50 border-cyan-200"}`}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <Activity className={`w-4 h-4 ${isBpHigh(emergencyCase.patient_bp_systolic, emergencyCase.patient_bp_diastolic) ? "text-red-600" : "text-cyan-600"}`} />
                          <span className={`text-xs font-semibold ${isBpHigh(emergencyCase.patient_bp_systolic, emergencyCase.patient_bp_diastolic) ? "text-red-600" : "text-cyan-600"}`}>BP</span>
                        </div>
                        <p className={`text-xl font-semibold ${isBpHigh(emergencyCase.patient_bp_systolic, emergencyCase.patient_bp_diastolic) ? "text-red-800" : "text-cyan-800"}`}>
                          {emergencyCase.patient_bp_systolic}/{emergencyCase.patient_bp_diastolic}
                        </p>
                      </motion.div>
                    ) : null}
                    {emergencyCase.patient_temperature ? (
                      <motion.div
                        whileHover={{ scale: 1.02 }}
                        className={`rounded-xl p-4 border-2 ${isTemperatureHigh(emergencyCase.patient_temperature) ? "bg-red-50 border-red-300" : "bg-orange-50 border-orange-200"}`}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <Thermometer className={`w-4 h-4 ${isTemperatureHigh(emergencyCase.patient_temperature) ? "text-red-600" : "text-orange-600"}`} />
                          <span className={`text-xs font-semibold ${isTemperatureHigh(emergencyCase.patient_temperature) ? "text-red-600" : "text-orange-600"}`}>Temp</span>
                        </div>
                        <p className={`text-xl font-semibold ${isTemperatureHigh(emergencyCase.patient_temperature) ? "text-red-800" : "text-orange-800"}`}>
                          {emergencyCase.patient_temperature}°
                        </p>
                      </motion.div>
                    ) : null}
                    {emergencyCase.patient_pulse ? (
                      <motion.div
                        whileHover={{ scale: 1.02 }}
                        className={`rounded-xl p-4 border-2 ${isPulseHigh(emergencyCase.patient_pulse) || isPulseLow(emergencyCase.patient_pulse) ? "bg-red-50 border-red-300" : "bg-rose-50 border-rose-200"}`}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <Heart className={`w-4 h-4 ${isPulseHigh(emergencyCase.patient_pulse) || isPulseLow(emergencyCase.patient_pulse) ? "text-red-600" : "text-rose-600"}`} />
                          <span className={`text-xs font-semibold ${isPulseHigh(emergencyCase.patient_pulse) || isPulseLow(emergencyCase.patient_pulse) ? "text-red-600" : "text-rose-600"}`}>Pulse</span>
                        </div>
                        <p className={`text-xl font-semibold ${isPulseHigh(emergencyCase.patient_pulse) || isPulseLow(emergencyCase.patient_pulse) ? "text-red-800" : "text-rose-800"}`}>
                          {emergencyCase.patient_pulse}
                        </p>
                      </motion.div>
                    ) : null}
                    {emergencyCase.patient_spo2 ? (
                      <motion.div
                        whileHover={{ scale: 1.02 }}
                        className={`rounded-xl p-4 border-2 ${isSpo2Low(emergencyCase.patient_spo2) ? "bg-red-50 border-red-300" : "bg-purple-50 border-purple-200"}`}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <Wind className={`w-4 h-4 ${isSpo2Low(emergencyCase.patient_spo2) ? "text-red-600" : "text-purple-600"}`} />
                          <span className={`text-xs font-semibold ${isSpo2Low(emergencyCase.patient_spo2) ? "text-red-600" : "text-purple-600"}`}>SpO2</span>
                        </div>
                        <p className={`text-xl font-semibold ${isSpo2Low(emergencyCase.patient_spo2) ? "text-red-800" : "text-purple-800"}`}>
                          {emergencyCase.patient_spo2}%
                        </p>
                      </motion.div>
                    ) : null}
                    {!emergencyCase.patient_bp_systolic && !emergencyCase.patient_bp_diastolic &&
                     !emergencyCase.patient_temperature && !emergencyCase.patient_pulse && !emergencyCase.patient_spo2 && (
                      <div className="col-span-4 text-center py-4">
                        <p className="text-sm text-gray-400">No vitals recorded</p>
                      </div>
                    )}
                  </div>

                  {/* Arrival Countdown - centered below vitals */}
                  <div className="border-t border-gray-100 pt-4">
                    {emergencyCase.duration_min && hasPatientArrived(emergencyCase.created_at, emergencyCase.duration_min, now) ? (
                      <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="text-center py-3"
                      >
                        <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
                        <p className="text-lg font-bold text-green-700">Arrived</p>
                        <p className="text-sm text-green-600">at {calculateArrivalTime(emergencyCase.created_at, emergencyCase.duration_min)}</p>
                      </motion.div>
                    ) : emergencyCase.duration_min ? (
                      (() => {
                        const remaining = getRemainingSeconds(emergencyCase.created_at, emergencyCase.duration_min, now);
                        const urgent = remaining !== null && remaining <= 300;
                        return (
                          <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="text-center"
                          >
                            <div className="flex items-center justify-center gap-2 mb-2">
                              <div className={`w-3 h-3 rounded-full animate-pulse ${urgent ? "bg-red-500" : "bg-emerald-500"}`} />
                              <span className={`text-xs font-bold uppercase tracking-wider ${urgent ? "text-red-600" : "text-emerald-600"}`}>
                                Arriving in
                              </span>
                            </div>
                            <motion.span
                              key={formatCountdown(emergencyCase.created_at, emergencyCase.duration_min, now)}
                              className={`text-4xl font-black font-mono tabular-nums tracking-widest bg-white px-5 py-2 rounded-2xl shadow-lg border-2 inline-block ${
                                urgent
                                  ? "text-red-700 border-red-300 animate-pulse"
                                  : "text-emerald-700 border-emerald-200"
                              }`}
                            >
                              {formatCountdown(emergencyCase.created_at, emergencyCase.duration_min, now)}
                            </motion.span>
                            <p className={`text-xs mt-2 ${urgent ? "text-red-600" : "text-emerald-600"}`}>
                              ETA {emergencyCase.duration_min.toFixed(0)} min · Est. {calculateArrivalTime(emergencyCase.created_at, emergencyCase.duration_min)}
                            </p>
                          </motion.div>
                        );
                      })()
                    ) : (
                      <div className="text-center py-3">
                        <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                        <p className="text-sm font-medium text-gray-500">Pending</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

                {/* Case Type Badge */}
                {emergencyCase.patient_case && (
                  <div className="mt-3 pt-3 border-t border-blue-100">
                    <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold ${
                      emergencyCase.patient_case === "Heart Attack" ? "bg-red-100 text-red-700 border border-red-200" :
                      emergencyCase.patient_case === "Accident" ? "bg-orange-100 text-orange-700 border border-orange-200" :
                      emergencyCase.patient_case === "Burn" ? "bg-yellow-100 text-yellow-700 border border-yellow-200" :
                      "bg-gray-100 text-gray-700 border border-gray-200"
                    }`}>
                      <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                      {emergencyCase.patient_case} Case
                    </span>
                  </div>
                )}

                {/* Ambulance Details */}
                {(emergencyCase.ambulance_number || emergencyCase.driver_name || emergencyCase.driver_mobile) && (
                  <div className="mt-3 pt-3 border-t border-slate-200">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Truck className="w-3.5 h-3.5 text-slate-600" />
                      <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Ambulance Details</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {emergencyCase.ambulance_number && (
                        <div className="bg-slate-100 rounded-lg p-2">
                          <p className="text-xs text-slate-500 flex items-center gap-1">
                            <Truck className="w-3 h-3" /> Vehicle
                          </p>
                          <p className="text-sm font-bold text-slate-800">{emergencyCase.ambulance_number}</p>
                        </div>
                      )}
                      {emergencyCase.driver_name && (
                        <div className="bg-slate-100 rounded-lg p-2">
                          <p className="text-xs text-slate-500 flex items-center gap-1">
                            <User className="w-3 h-3" /> Driver
                          </p>
                          <p className="text-sm font-bold text-slate-800">{emergencyCase.driver_name}</p>
                        </div>
                      )}
                      {emergencyCase.driver_mobile && (
                        <div className="bg-slate-100 rounded-lg p-2">
                          <p className="text-xs text-slate-500 flex items-center gap-1">
                            <Phone className="w-3 h-3" /> Contact
                          </p>
                          <p className="text-sm font-bold text-slate-800">{emergencyCase.driver_mobile}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              
              {/* Triage & Assign Section */}
              <div className="mt-4">
                <button
                  onClick={() => toggleExpand(emergencyCase.task_id)}
                  className="w-full flex items-center justify-between p-3 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200 hover:from-amber-100 hover:to-orange-100 transition-all"
                >
                  <div className="flex items-center gap-2">
                    <HeartPulse className="w-4 h-4 text-amber-600" />
                    <span className="text-xs font-bold text-amber-700 uppercase tracking-wide">Triage & Assign</span>
                    {(emergencyCase.consultant_name || triageLevels[emergencyCase.task_id]) && (
                      <span className="px-2 py-0.5 bg-amber-500 text-white rounded-full text-xs">Done</span>
                    )}
                  </div>
                  {expandedCards.has(emergencyCase.task_id) ? (
                    <ChevronUp className="w-4 h-4 text-amber-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-amber-500" />
                  )}
                </button>

                {expandedCards.has(emergencyCase.task_id) && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-3 bg-white rounded-xl border border-amber-200 p-4"
                  >
                    <div className="space-y-4">
                      {/* Auto Triage Level */}
                      {(() => {
                        const level = calculateTriageLevel(emergencyCase);
                        const colorMap = {
                          red: { bg: "bg-red-50 border-red-300", dot: "bg-red-500", text: "text-red-700", icon: AlertTriangle, label: "Immediate (Red)" },
                          yellow: { bg: "bg-amber-50 border-amber-300", dot: "bg-amber-500", text: "text-amber-700", icon: Activity, label: "Urgent (Yellow)" },
                          green: { bg: "bg-emerald-50 border-emerald-300", dot: "bg-emerald-500", text: "text-emerald-700", icon: CheckCircle, label: "Non-Urgent (Green)" },
                        };
                        const cc = colorMap[level];
                        const Icon = cc.icon;
                        return (
                          <div className={`${cc.bg} rounded-xl border-2 p-4`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <span className={`w-4 h-4 rounded-full ${cc.dot}`} />
                                <div>
                                  <p className={`text-sm font-bold ${cc.text}`}>{cc.label}</p>
                                  <p className="text-xs text-gray-500 mt-0.5">Auto-assigned based on vitals & case type</p>
                                </div>
                              </div>
                              <Icon className={`w-6 h-6 ${cc.text}`} />
                            </div>
                          </div>
                        );
                      })()}

                      {/* Consultant Assignment */}
                      <div>
                        <label className="block text-xs font-semibold text-amber-600 mb-1.5">
                          <User className="w-3.5 h-3.5 inline mr-1" />
                          Assign Consultant
                        </label>
                        <div className="flex gap-2">
                          <select
                            value={emergencyCase.consultant_name || ""}
                            onChange={(e) => {
                              setCases(prev => prev.map(c =>
                                c.task_id === emergencyCase.task_id ? { ...c, consultant_name: e.target.value } : c
                              ));
                            }}
                            className="flex-1 rounded-lg border-2 border-amber-200 bg-amber-50 px-3 py-2 text-sm focus:outline-none focus:border-amber-400 focus:bg-white transition"
                          >
                            <option value="">Select consultant...</option>
                            <option value="Dr. Sharma (Cardio)">Dr. Sharma (Cardio)</option>
                            <option value="Dr. Verma (Neuro)">Dr. Verma (Neuro)</option>
                            <option value="Dr. Patel (Ortho)">Dr. Patel (Ortho)</option>
                            <option value="Dr. Singh (Medicine)">Dr. Singh (Medicine)</option>
                            <option value="Dr. Gupta (Pediatrics)">Dr. Gupta (Pediatrics)</option>
                            <option value="Dr. Joshi (Surgery)">Dr. Joshi (Surgery)</option>
                          </select>
                        </div>
                      </div>

                      {/* Bed Assignment */}
                      <div>
                        <label className="block text-xs font-semibold text-amber-600 mb-1.5">
                          <Bed className="w-3.5 h-3.5 inline mr-1" />
                          Assign Ward
                        </label>
                        <select
                          value={emergencyCase.bed_number || ""}
                          onChange={(e) => {
                            setCases(prev => prev.map(c =>
                              c.task_id === emergencyCase.task_id ? { ...c, bed_number: e.target.value } : c
                            ));
                          }}
                          className="w-full rounded-lg border-2 border-amber-200 bg-amber-50 px-3 py-2 text-sm focus:outline-none focus:border-amber-400 focus:bg-white transition"
                        >
                          <option value="">Select ward...</option>
                          <option value="ICU-01">ICU - Bed 01</option>
                          <option value="ICU-02">ICU - Bed 02</option>
                          <option value="ICU-03">ICU - Bed 03</option>
                          <option value="ICU-04">ICU - Bed 04</option>
                          <option value="Emergency-01">Emergency - Bed 01</option>
                          <option value="Emergency-02">Emergency - Bed 02</option>
                          <option value="Emergency-03">Emergency - Bed 03</option>
                          <option value="Emergency-04">Emergency - Bed 04</option>
                          <option value="General-01">General Ward - Bed 01</option>
                          <option value="General-02">General Ward - Bed 02</option>
                          <option value="General-03">General Ward - Bed 03</option>
                          <option value="CCU-01">CCU - Bed 01</option>
                          <option value="CCU-02">CCU - Bed 02</option>
                        </select>
                      </div>

                      {/* Quick Notes */}
                      <div>
                        <label className="block text-xs font-semibold text-amber-600 mb-1.5">
                          <ClipboardList className="w-3.5 h-3.5 inline mr-1" />
                          Triage Notes
                        </label>
                        <textarea
                          value={treatmentForm.treatment_details}
                          onChange={(e) => setTreatmentForm({ ...treatmentForm, treatment_details: e.target.value })}
                          placeholder="Clinical notes, immediate actions needed..."
                          rows={2}
                          className="w-full rounded-lg border-2 border-amber-200 bg-amber-50/50 px-3 py-2 text-sm focus:outline-none focus:border-amber-400 focus:bg-white transition"
                        />
                      </div>

                      {/* Admit Patient Button */}
                      <button
                        onClick={async () => {
                          setAdmittingTaskId(emergencyCase.task_id);
                          setAdmitMessages(prev => ({ ...prev, [emergencyCase.task_id]: "" }));
                          try {
                            const level = calculateTriageLevel(emergencyCase);
                            await admitPatient({
                              task_id: emergencyCase.task_id,
                              triage_level: level,
                              triage_notes: treatmentForm.treatment_details || undefined,
                              ward_name: emergencyCase.bed_number?.split("-")[0] || undefined,
                              consultant_name: emergencyCase.consultant_name || undefined,
                            });
                            // Create an appointment for treatment tab
                            const { data: aptData, error: aptError } = await supabase
                              .from("patient_appointments")
                              .insert({
                                patient_name: emergencyCase.patient_name || "Unknown",
                                patient_email: emergencyCase.patient_mobile || "",
                                age: emergencyCase.patient_age ? parseInt(emergencyCase.patient_age) : null,
                                case_type: emergencyCase.patient_case || "Emergency",
                                hospital_name: emergencyCase.hospital_name || selectedHospital,
                                appointment_date: new Date().toISOString(),
                                status: "in-consultation",
                              })
                              .select("id")
                              .single();
                            if (aptError) throw aptError;
                            // Remove from active cases view
                            setCases(prev => prev.filter(c => c.task_id !== emergencyCase.task_id));
                            // Redirect to treatment tab
                            router.push(`/doctor?tab=treatment&patient_id=${aptData.id}`);
                          } catch (err: any) {
                            setAdmitMessages(prev => ({
                              ...prev,
                              [emergencyCase.task_id]: `Failed to admit: ${err.message}`,
                            }));
                          } finally {
                            setAdmittingTaskId(null);
                          }
                        }}
                        disabled={admittingTaskId === emergencyCase.task_id || !emergencyCase.consultant_name}
                        className={`w-full mt-2 px-4 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                          admitMessages[emergencyCase.task_id]?.includes("successfully")
                            ? "bg-emerald-500 text-white"
                            : "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-200 hover:shadow-xl hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        }`}
                      >
                        {admittingTaskId === emergencyCase.task_id ? (
                          <><Loader2 className="w-4 h-4 animate-spin" /> Admitting...</>
                        ) : admitMessages[emergencyCase.task_id]?.includes("successfully") ? (
                          <><CheckCircle className="w-4 h-4" /> {admitMessages[emergencyCase.task_id]}</>
                        ) : (
                          <><CheckCircle className="w-4 h-4" /> Admit Patient</>
                        )}
                      </button>
                      {admitMessages[emergencyCase.task_id] && !admitMessages[emergencyCase.task_id].includes("successfully") && (
                        <p className="text-xs text-red-500 mt-1">{admitMessages[emergencyCase.task_id]}</p>
                      )}
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
            );
          })}
        </div>
      )}
    </div>

      {/* History Modal */}
      {showHistory && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setShowHistory(false)}>
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}>

            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-xl flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Emergency History</h3>
                  <p className="text-xs text-gray-500">{selectedHospital}</p>
                </div>
              </div>
              <button onClick={() => setShowHistory(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {loadingHistory ? (
                <div className="text-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Loading history...</p>
                </div>
              ) : historyCases.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No previous emergency cases found</p>
                  <p className="text-sm text-gray-400 mt-1">For {selectedHospital}</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(
                    historyCases.reduce((groups, c) => {
                      const dt = new Date(c.created_at).toISOString().split("T")[0];
                      if (!groups[dt]) groups[dt] = [];
                      groups[dt].push(c);
                      return groups;
                    }, {} as Record<string, EmergencyCase[]>)
                  )
                    .sort(([a], [b]) => b.localeCompare(a))
                    .map(([date, dateCases]) => (
                      <div key={date}>
                        <div className="flex items-center gap-2 mb-3 sticky top-0 bg-white pb-2 z-10">
                          <Calendar className="w-4 h-4 text-purple-600" />
                          <h4 className="text-sm font-bold text-gray-800">
                            {new Date(date + "T00:00:00").toLocaleDateString("en-IN", {
                              day: "2-digit", month: "long", year: "numeric"
                            })}
                          </h4>
                          <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                            {dateCases.length} case{dateCases.length > 1 ? "s" : ""}
                          </span>
                        </div>
                        <div className="space-y-2">
                          {dateCases.map((c) => (
                            <div key={c.task_id}
                              className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden transition hover:border-purple-200">
                              <button onClick={() => toggleHistoryExpand(c.task_id)}
                                className="w-full flex items-center justify-between p-4 text-left">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center shrink-0">
                                    <User className="w-4 h-4 text-gray-600" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold text-gray-900 truncate">
                                      {c.patient_name || "Unknown Patient"}
                                    </p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      {c.patient_age && <span className="text-xs text-gray-500">{c.patient_age}y</span>}
                                      {c.patient_sex && <span className="text-xs text-gray-500">{c.patient_sex}</span>}
                                      {c.patient_case && (
                                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${c.patient_case === "Heart Attack" ? "bg-red-100 text-red-700" : c.patient_case === "Accident" ? "bg-orange-100 text-orange-700" : c.patient_case === "Burn" ? "bg-yellow-100 text-yellow-700" : "bg-gray-200 text-gray-600"}`}>
                                          {c.patient_case}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                  <span className="text-xs text-gray-400">{formatTime(c.created_at)}</span>
                                  {expandedHistoryCards.has(c.task_id)
                                    ? <ChevronUp className="w-4 h-4 text-gray-400" />
                                    : <ChevronDown className="w-4 h-4 text-gray-400" />
                                  }
                                </div>
                              </button>

                              {expandedHistoryCards.has(c.task_id) && (
                                <div className="px-4 pb-4 border-t border-gray-200">
                                  {(c.patient_bp_systolic || c.patient_bp_diastolic || c.patient_temperature || c.patient_pulse || c.patient_spo2) && (
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                                      {c.patient_bp_systolic || c.patient_bp_diastolic ? (
                                        <div className="bg-cyan-50 rounded-lg p-2 border border-cyan-200">
                                          <p className="text-[10px] font-semibold text-cyan-600">BP</p>
                                          <p className="text-sm font-bold text-cyan-800">{c.patient_bp_systolic}/{c.patient_bp_diastolic}</p>
                                        </div>
                                      ) : null}
                                      {c.patient_temperature ? (
                                        <div className="bg-orange-50 rounded-lg p-2 border border-orange-200">
                                          <p className="text-[10px] font-semibold text-orange-600">Temp</p>
                                          <p className="text-sm font-bold text-orange-800">{c.patient_temperature}°</p>
                                        </div>
                                      ) : null}
                                      {c.patient_pulse ? (
                                        <div className="bg-rose-50 rounded-lg p-2 border border-rose-200">
                                          <p className="text-[10px] font-semibold text-rose-600">Pulse</p>
                                          <p className="text-sm font-bold text-rose-800">{c.patient_pulse}</p>
                                        </div>
                                      ) : null}
                                      {c.patient_spo2 ? (
                                        <div className="bg-purple-50 rounded-lg p-2 border border-purple-200">
                                          <p className="text-[10px] font-semibold text-purple-600">SpO2</p>
                                          <p className="text-sm font-bold text-purple-800">{c.patient_spo2}%</p>
                                        </div>
                                      ) : null}
                                    </div>
                                  )}

                                  {(c.distance_km || c.duration_min) && (
                                    <div className="flex flex-wrap gap-2 mt-3">
                                      {c.distance_km ? (
                                        <div className="bg-blue-50 rounded-lg px-2.5 py-1.5 border border-blue-200">
                                          <p className="text-[10px] text-blue-600">Distance</p>
                                          <p className="text-xs font-bold text-blue-800">{c.distance_km.toFixed(1)} km</p>
                                        </div>
                                      ) : null}
                                      {c.duration_min ? (
                                        <div className="bg-emerald-50 rounded-lg px-2.5 py-1.5 border border-emerald-200">
                                          <p className="text-[10px] text-emerald-600">Duration</p>
                                          <p className="text-xs font-bold text-emerald-800">{c.duration_min.toFixed(0)} min</p>
                                        </div>
                                      ) : null}
                                    </div>
                                  )}

                                  {(c.ambulance_number || c.driver_name || c.driver_mobile) && (
                                    <div className="mt-3 pt-2 border-t border-gray-200">
                                      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                                        <Truck className="w-3 h-3 inline mr-1" />
                                        Ambulance
                                      </p>
                                      <div className="flex flex-wrap gap-2">
                                        {c.ambulance_number ? (
                                          <span className="text-xs text-gray-700 bg-gray-100 px-2 py-0.5 rounded">{c.ambulance_number}</span>
                                        ) : null}
                                        {c.driver_name ? (
                                          <span className="text-xs text-gray-700 bg-gray-100 px-2 py-0.5 rounded">{c.driver_name}</span>
                                        ) : null}
                                        {c.driver_mobile ? (
                                          <span className="text-xs text-gray-700 bg-gray-100 px-2 py-0.5 rounded">{c.driver_mobile}</span>
                                        ) : null}
                                      </div>
                                    </div>
                                  )}

                                  {c.patient_mobile && (
                                    <div className="mt-2 pt-2 border-t border-gray-200">
                                      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                                        <Phone className="w-3 h-3 inline mr-1" />
                                        Contact
                                      </p>
                                      <p className="text-xs text-gray-700">{c.patient_mobile}</p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Helper function to calculate arrival time
function calculateArrivalTime(createdAt: string, durationMin: number): string {
  if (!createdAt || !durationMin) return "-";
  const pickupTime = new Date(createdAt);
  const arrivalTime = new Date(pickupTime.getTime() + durationMin * 60000);
  return arrivalTime.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

// Helper function to format countdown remaining time
function formatCountdown(createdAt: string, durationMin: number, now: number): string {
  const remaining = getRemainingSeconds(createdAt, durationMin, now);
  if (remaining === null) return "--:--";
  if (remaining <= 0) return "00:00";
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function getRemainingSeconds(createdAt: string, durationMin: number, now: number): number | null {
  if (!createdAt || !durationMin) return null;
  const arrivalTime = new Date(createdAt).getTime() + durationMin * 60000;
  return Math.max(0, Math.floor((arrivalTime - now) / 1000));
}

// Helper function to check if patient has arrived
function hasPatientArrived(createdAt: string, durationMin: number, now: number): boolean {
  if (!createdAt || !durationMin) return false;
  const arrivalTime = new Date(createdAt).getTime() + durationMin * 60000;
  return now > arrivalTime;
}

// Helper functions for vital sign analysis
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