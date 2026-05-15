"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { fetchHospitalsList, getTaskStatus, reverseGeocode, fetchBloodBanks } from "@/lib/api";
import { Hospital, MapPin, Calendar, User, Phone, AlertTriangle, Droplet, Loader2, Clock, Navigation, CheckCircle, Truck, Activity } from "lucide-react";

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
};

export default function DoctorEmergencyTab() {
  const [hospitals, setHospitals] = useState<HospitalInfo[]>([]);
  const [selectedHospital, setSelectedHospital] = useState("");
  const [cases, setCases] = useState<EmergencyCase[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingHospitals, setLoadingHospitals] = useState(true);

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

  const loadTodayCases = async () => {
    setLoading(true);
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
      setLoading(false);
    }
  };

  const formatTime = (dateStr: string) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
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
          <div className="text-right">
            <p className="text-xs text-gray-500">Date</p>
            <p className="text-sm font-semibold text-gray-800">{new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</p>
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

              {/* Patient Details Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
                {emergencyCase.patient_age && (
                  <div className="bg-gray-50 rounded-lg p-2.5">
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <User className="w-3 h-3" /> Age
                    </p>
                    <p className="text-sm font-semibold text-gray-800">{emergencyCase.patient_age} yrs</p>
                  </div>
                )}
                {emergencyCase.patient_sex && (
                  <div className="bg-gray-50 rounded-lg p-2.5">
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <User className="w-3 h-3" /> Sex
                    </p>
                    <p className="text-sm font-semibold text-gray-800">{emergencyCase.patient_sex}</p>
                  </div>
                )}
                {emergencyCase.patient_blood_group && (
                  <div className={`rounded-lg p-2.5 border ${
                    emergencyCase.blood_availability?.some(b => b.blood_type === emergencyCase.patient_blood_group && b.available_liters > 0)
                      ? "bg-green-50 border-green-200"
                      : "bg-red-50 border-red-100"
                  }`}>
                    <p className={`text-xs flex items-center gap-1 ${
                      emergencyCase.blood_availability?.some(b => b.blood_type === emergencyCase.patient_blood_group && b.available_liters > 0)
                        ? "text-green-600"
                        : "text-red-600"
                    }`}>
                      <Droplet className="w-3 h-3" />
                      {emergencyCase.blood_availability?.some(b => b.blood_type === emergencyCase.patient_blood_group && b.available_liters > 0)
                        ? "Blood Available"
                        : "Blood Group"}
                    </p>
                    <p className={`text-sm font-bold ${
                      emergencyCase.blood_availability?.some(b => b.blood_type === emergencyCase.patient_blood_group && b.available_liters > 0)
                        ? "text-green-700"
                        : "text-red-700"
                    }`}>
                      {emergencyCase.patient_blood_group}
                      {emergencyCase.blood_availability?.some(b => b.blood_type === emergencyCase.patient_blood_group) && (
                        <span className="text-xs font-normal text-green-600 ml-1">
                          ({emergencyCase.blood_availability.find(b => b.blood_type === emergencyCase.patient_blood_group)?.available_liters}L available)
                        </span>
                      )}
                    </p>
                  </div>
                )}
                {emergencyCase.patient_mobile && (
                  <div className="bg-gray-50 rounded-lg p-2.5">
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <Phone className="w-3 h-3" /> Mobile
                    </p>
                    <p className="text-sm font-semibold text-gray-800">{emergencyCase.patient_mobile}</p>
                  </div>
                )}
                <div className={`rounded-lg p-2.5 ${hasPatientArrived(emergencyCase.created_at, emergencyCase.duration_min || 0) ? "bg-green-50" : "bg-yellow-50"}`}>
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Status
                  </p>
                  <p className={`text-sm font-semibold ${hasPatientArrived(emergencyCase.created_at, emergencyCase.duration_min || 0) ? "text-green-700" : "text-yellow-700"}`}>
                    {hasPatientArrived(emergencyCase.created_at, emergencyCase.duration_min || 0) ? "Arrived" : "En Route"}
                  </p>
                </div>
              </div>

              {/* Location & Arrival Details */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Origin Address */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <MapPin className="w-3.5 h-3.5 text-blue-600" />
                      <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Pickup Location</p>
                    </div>
                    <p className="text-sm font-medium text-gray-800 leading-relaxed">
                      {emergencyCase.origin_address || "Loading..."}
                    </p>
                    {emergencyCase.distance_km && (
                      <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                        <Navigation className="w-3 h-3" />
                        {emergencyCase.distance_km.toFixed(1)} km away
                      </p>
                    )}
                  </div>

                  {/* Hospital Arrival */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                      <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">Hospital Arrival</p>
                    </div>
                    {emergencyCase.status === "completed" && emergencyCase.duration_min ? (
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-green-800 flex items-center gap-1.5">
                          <Clock className="w-4 h-4" />
                          {calculateArrivalTime(emergencyCase.created_at, emergencyCase.duration_min)}
                        </p>
                        <p className="text-xs text-gray-500">
                          ETA: {emergencyCase.duration_min.toFixed(0)} min from pickup
                        </p>
                      </div>
                    ) : emergencyCase.status === "running" ? (
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse" />
                        <p className="text-sm font-medium text-blue-700">En Route</p>
                      </div>
                    ) : (
                      <p className="text-sm font-medium text-gray-500">Pending</p>
                    )}
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

// Helper function to check if patient has arrived
function hasPatientArrived(createdAt: string, durationMin: number): boolean {
  if (!createdAt || !durationMin) return false;
  const pickupTime = new Date(createdAt);
  const arrivalTime = new Date(pickupTime.getTime() + durationMin * 60000);
  return new Date() > arrivalTime;
}