"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { fetchHospitalsList, getTaskStatus } from "@/lib/api";
import { Hospital, MapPin, Calendar, User, Phone, AlertTriangle, Droplet, Loader2, Clock } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

type HospitalInfo = {
  id: number;
  name: string;
  address: string;
  specialist: string;
  total_beds: number;
  available_beds: number;
  emergency_beds: number;
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
        setHospitals(data.hospitals || []);
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
      setCases(data || []);
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
                    {h.name}
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
              {/* Case Header */}
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
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {emergencyCase.patient_name || "Unknown Patient"}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Clock className="w-3 h-3" />
                      {formatTime(emergencyCase.created_at)}
                    </div>
                  </div>
                </div>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${
                  emergencyCase.patient_case === "Heart Attack" ? "bg-red-100 text-red-700" :
                  emergencyCase.patient_case === "Accident" ? "bg-orange-100 text-orange-700" :
                  emergencyCase.patient_case === "Burn" ? "bg-yellow-100 text-yellow-700" :
                  "bg-gray-100 text-gray-700"
                }`}>
                  {emergencyCase.patient_case || "Unknown"}
                </span>
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
                  <div className="bg-red-50 rounded-lg p-2.5 border border-red-100">
                    <p className="text-xs text-red-600 flex items-center gap-1">
                      <Droplet className="w-3 h-3" /> Blood
                    </p>
                    <p className="text-sm font-bold text-red-700">{emergencyCase.patient_blood_group}</p>
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
                <div className="bg-gray-50 rounded-lg p-2.5">
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Status
                  </p>
                  <p className={`text-sm font-semibold ${emergencyCase.status === "completed" ? "text-green-700" : "text-yellow-700"}`}>
                    {emergencyCase.status}
                  </p>
                </div>
              </div>

              {/* Location Details */}
              <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                <p className="text-xs text-blue-600 font-medium mb-2">Origin Location</p>
                <p className="text-sm font-semibold text-gray-800 flex items-center gap-1">
                  <MapPin className="w-4 h-4 text-blue-500" />
                  {emergencyCase.origin_lat.toFixed(4)}, {emergencyCase.origin_lon.toFixed(4)}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}