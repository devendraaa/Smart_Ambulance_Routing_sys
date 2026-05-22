"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { fetchHospitalsList, getTaskStatus, reverseGeocode, fetchBloodBanks } from "@/lib/api";
import { Hospital, MapPin, Calendar, User, Phone, AlertTriangle, Droplet, Loader2, Clock, Navigation, CheckCircle, Truck, Activity, Thermometer, Heart, Wind, AlertCircle, Stethoscope, Pill, TestTube, Bed, ChevronDown, ChevronUp, Save, Edit3 } from "lucide-react";

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

export default function DoctorEmergencyTab() {
  const [hospitals, setHospitals] = useState<HospitalInfo[]>([]);
  const [selectedHospital, setSelectedHospital] = useState("");
  const [cases, setCases] = useState<EmergencyCase[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingHospitals, setLoadingHospitals] = useState(true);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [treatmentForm, setTreatmentForm] = useState({
    treatment_problem: "",
    treatment_details: "",
    treatment_medicine: "",
    treatment_tests: "",
    consultant_name: "",
    bed_number: "",
  });

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

  useEffect(() => {
    if (!selectedHospital) return;
    const interval = setInterval(() => {
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
          </div>
        </div>
      </div>

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
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Showing <span className="font-semibold text-gray-700">{cases.length}</span> case(s) today
          </p>

          {cases.map((emergencyCase, index) => (
            <motion.div
              key={emergencyCase.task_id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow"
            >
              {/* Case Header - Case type prominent with animation */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
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
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-lg text-gray-900">
                      {emergencyCase.patient_name || "Unknown Patient"}
                    </h3>
                    {emergencyCase.patient_case && (
                      <motion.span
                        initial={{ scale: 0.8, opacity: 0.7 }}
                        animate={{ scale: [1, 1.05, 1], opacity: 1 }}
                        transition={{ duration: 1.5, repeat: Infinity, repeatType: "reverse" }}
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
              
              {/* Doctor Treatment Section */}
              <div className="mt-4">
                <button
                  onClick={() => toggleExpand(emergencyCase.task_id)}
                  className="w-full flex items-center justify-between p-3 bg-gradient-to-r from-violet-50 to-purple-50 rounded-xl border border-violet-200 hover:from-violet-100 hover:to-purple-100 transition-all"
                >
                  <div className="flex items-center gap-2">
                    <Stethoscope className="w-4 h-4 text-violet-600" />
                    <span className="text-xs font-bold text-violet-700 uppercase tracking-wide">Doctor Treatment</span>
                    {(emergencyCase.treatment_problem || emergencyCase.consultant_name || emergencyCase.bed_number) && (
                      <span className="px-2 py-0.5 bg-violet-500 text-white rounded-full text-xs">Saved</span>
                    )}
                  </div>
                  {expandedCards.has(emergencyCase.task_id) ? (
                    <ChevronUp className="w-4 h-4 text-violet-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-violet-500" />
                  )}
                </button>

                {expandedCards.has(emergencyCase.task_id) && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-3 bg-white rounded-xl border border-violet-200 p-4"
                  >
                    {editingId === emergencyCase.task_id ? (
                      /* Edit Mode */
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* Problem */}
                          <div>
                            <label className="block text-xs font-semibold text-violet-600 mb-1.5">
                              <AlertCircle className="w-3.5 h-3.5 inline mr-1" />
                              Patient Problem
                            </label>
                            <textarea
                              value={treatmentForm.treatment_problem}
                              onChange={(e) => setTreatmentForm({ ...treatmentForm, treatment_problem: e.target.value })}
                              placeholder="Describe patient's problem..."
                              rows={2}
                              className="w-full rounded-lg border-2 border-violet-200 bg-violet-50 px-3 py-2 text-sm focus:outline-none focus:border-violet-400 focus:bg-white transition"
                            />
                          </div>

                          {/* Treatment */}
                          <div>
                            <label className="block text-xs font-semibold text-violet-600 mb-1.5">
                              <Stethoscope className="w-3.5 h-3.5 inline mr-1" />
                              Treatment
                            </label>
                            <textarea
                              value={treatmentForm.treatment_details}
                              onChange={(e) => setTreatmentForm({ ...treatmentForm, treatment_details: e.target.value })}
                              placeholder="Treatment given..."
                              rows={2}
                              className="w-full rounded-lg border-2 border-violet-200 bg-violet-50 px-3 py-2 text-sm focus:outline-none focus:border-violet-400 focus:bg-white transition"
                            />
                          </div>

                          {/* Medicine */}
                          <div>
                            <label className="block text-xs font-semibold text-violet-600 mb-1.5">
                              <Pill className="w-3.5 h-3.5 inline mr-1" />
                              Medicines
                            </label>
                            <textarea
                              value={treatmentForm.treatment_medicine}
                              onChange={(e) => setTreatmentForm({ ...treatmentForm, treatment_medicine: e.target.value })}
                              placeholder="Medicines prescribed..."
                              rows={2}
                              className="w-full rounded-lg border-2 border-violet-200 bg-violet-50 px-3 py-2 text-sm focus:outline-none focus:border-violet-400 focus:bg-white transition"
                            />
                          </div>

                          {/* Tests */}
                          <div>
                            <label className="block text-xs font-semibold text-violet-600 mb-1.5">
                              <TestTube className="w-3.5 h-3.5 inline mr-1" />
                              New Tests
                            </label>
                            <textarea
                              value={treatmentForm.treatment_tests}
                              onChange={(e) => setTreatmentForm({ ...treatmentForm, treatment_tests: e.target.value })}
                              placeholder="Tests to be conducted..."
                              rows={2}
                              className="w-full rounded-lg border-2 border-violet-200 bg-violet-50 px-3 py-2 text-sm focus:outline-none focus:border-violet-400 focus:bg-white transition"
                            />
                          </div>
                        </div>

                        {/* Consultant & Bed in one row */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-violet-100">
                          <div>
                            <label className="block text-xs font-semibold text-violet-600 mb-1.5">
                              <User className="w-3.5 h-3.5 inline mr-1" />
                              Consultant Doctor
                            </label>
                            <input
                              type="text"
                              value={treatmentForm.consultant_name}
                              onChange={(e) => setTreatmentForm({ ...treatmentForm, consultant_name: e.target.value })}
                              placeholder="Dr. Name"
                              className="w-full rounded-lg border-2 border-violet-200 bg-violet-50 px-3 py-2 text-sm focus:outline-none focus:border-violet-400 focus:bg-white transition"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-violet-600 mb-1.5">
                              <Bed className="w-3.5 h-3.5 inline mr-1" />
                              Bed Number
                            </label>
                            <input
                              type="text"
                              value={treatmentForm.bed_number}
                              onChange={(e) => setTreatmentForm({ ...treatmentForm, bed_number: e.target.value })}
                              placeholder="e.g., ICU-101, Ward-A5"
                              className="w-full rounded-lg border-2 border-violet-200 bg-violet-50 px-3 py-2 text-sm focus:outline-none focus:border-violet-400 focus:bg-white transition"
                            />
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex justify-end gap-2 pt-3">
                          <button
                            onClick={cancelEditing}
                            className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => saveTreatment(emergencyCase.task_id)}
                            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 transition"
                          >
                            <Save className="w-4 h-4" />
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* View Mode */
                      <div className="space-y-4">
                        {(emergencyCase.treatment_problem || emergencyCase.treatment_details ||
                          emergencyCase.treatment_medicine || emergencyCase.treatment_tests ||
                          emergencyCase.consultant_name || emergencyCase.bed_number) ? (
                          <div className="space-y-3">
                            {/* Problem & Treatment */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {emergencyCase.treatment_problem && (
                                <div className="bg-rose-50 rounded-lg p-3 border border-rose-100">
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                                    <span className="text-xs font-semibold text-rose-700">Patient Problem</span>
                                  </div>
                                  <p className="text-sm text-rose-800">{emergencyCase.treatment_problem}</p>
                                </div>
                              )}
                              {emergencyCase.treatment_details && (
                                <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <Stethoscope className="w-3.5 h-3.5 text-blue-600" />
                                    <span className="text-xs font-semibold text-blue-700">Treatment</span>
                                  </div>
                                  <p className="text-sm text-blue-800">{emergencyCase.treatment_details}</p>
                                </div>
                              )}
                            </div>

                            {/* Medicine & Tests */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {emergencyCase.treatment_medicine && (
                                <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <Pill className="w-3.5 h-3.5 text-emerald-600" />
                                    <span className="text-xs font-semibold text-emerald-700">Medicines</span>
                                  </div>
                                  <p className="text-sm text-emerald-800">{emergencyCase.treatment_medicine}</p>
                                </div>
                              )}
                              {emergencyCase.treatment_tests && (
                                <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <TestTube className="w-3.5 h-3.5 text-amber-600" />
                                    <span className="text-xs font-semibold text-amber-700">New Tests</span>
                                  </div>
                                  <p className="text-sm text-amber-800">{emergencyCase.treatment_tests}</p>
                                </div>
                              )}
                            </div>

                            {/* Consultant & Bed */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-violet-100">
                              {emergencyCase.consultant_name && (
                                <div className="bg-violet-50 rounded-lg p-3 border border-violet-100">
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <User className="w-3.5 h-3.5 text-violet-600" />
                                    <span className="text-xs font-semibold text-violet-700">Consultant</span>
                                  </div>
                                  <p className="text-sm font-bold text-violet-800">{emergencyCase.consultant_name}</p>
                                </div>
                              )}
                              {emergencyCase.bed_number && (
                                <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-100">
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <Bed className="w-3.5 h-3.5 text-indigo-600" />
                                    <span className="text-xs font-semibold text-indigo-700">Bed Number</span>
                                  </div>
                                  <p className="text-sm font-bold text-indigo-800">{emergencyCase.bed_number}</p>
                                </div>
                              )}
                            </div>

                            <button
                              onClick={() => startEditing(emergencyCase)}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-violet-600 bg-violet-50 rounded-lg hover:bg-violet-100 transition"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              Edit Treatment
                            </button>
                          </div>
                        ) : (
                          <div className="text-center py-4">
                            <p className="text-sm text-gray-500 mb-3">No treatment details added yet</p>
                            <button
                              onClick={() => startEditing(emergencyCase)}
                              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 transition mx-auto"
                            >
                              <Edit3 className="w-4 h-4" />
                              Add Treatment Details
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
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