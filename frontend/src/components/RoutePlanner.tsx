"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { startRouteCompute, searchHospitals, fetchHospitalsList } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin, Hospital, Navigation, Loader2, CheckCircle2, AlertCircle,
  Crosshair, Clock, Bed, Stethoscope, ChevronDown, Zap, User, Phone, Calendar, AlertTriangle, Droplet
} from "lucide-react";

type NearbyHospital = {
  id: number;
  name: string;
  address: string;
  contact: string;
  lat: number;
  lon: number;
  total_beds: number;
  available_beds: number;
  emergency_beds: number;
  total_doctors_vacant: number;
  specialist: string;
  distance_km: number | null;
  estimated_time_min: number | null;
};

export default function RoutePlanner() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [originLat, setOriginLat] = useState<number | null>(null);
  const [originLon, setOriginLon] = useState<number | null>(null);
  const [hospitalName, setHospitalName] = useState("");
  const [hospitalLat, setHospitalLat] = useState("");
  const [hospitalLon, setHospitalLon] = useState("");
  const [suggestions, setSuggestions] = useState<
    { name: string; display_name: string; latitude?: number; longitude?: number }[]
  >([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState("");
  const [nearbyHospitals, setNearbyHospitals] = useState<NearbyHospital[]>([]);
  const [loadingNearby, setLoadingNearby] = useState(false);
  const [selectedHospital, setSelectedHospital] = useState<number | null>(null);
  // Patient details state
  const [patientName, setPatientName] = useState("");
  const [patientAge, setPatientAge] = useState("");
  const [patientSex, setPatientSex] = useState("");
  const [patientMobile, setPatientMobile] = useState("");
  const [patientCase, setPatientCase] = useState("");
  const [patientBloodGroup, setPatientBloodGroup] = useState("");
  const [patientDate, setPatientDate] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Set current date on mount
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setPatientDate(today);
  }, []);
  const containerRef = useRef<HTMLDivElement>(null);
  const nearbyRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Auto-detect location on mount
  useEffect(() => { detectLocation(); }, []);

  const fetchNearbyHospitals = useCallback(async (lat: number, lon: number) => {
    setLoadingNearby(true);
    try {
      const data = await fetchHospitalsList(lat, lon);
      const top5 = (data.hospitals || [])
        .sort((a, b) => (a.distance_km ?? Infinity) - (b.distance_km ?? Infinity))
        .slice(0, 5);
      setNearbyHospitals(top5);
    } catch (err) {
      console.error("Failed to fetch nearby hospitals:", err);
      setNearbyHospitals([]);
    } finally {
      setLoadingNearby(false);
    }
  }, []);

  const detectLocation = () => {
    if (!navigator.geolocation) {
      setLocateError("Geolocation is not supported by your browser.");
      return;
    }
    setLocating(true);
    setLocateError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOriginLat(pos.coords.latitude);
        setOriginLon(pos.coords.longitude);
        setLocating(false);
        // Fetch nearby hospitals after location is set
        fetchNearbyHospitals(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        setLocateError(
          err.code === 1
            ? "Location permission denied. Please allow location access."
            : "Unable to retrieve your location. Please try again."
        );
        setLocating(false);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );
  };

  const fetchSuggestions = async (value: string) => {
    if (!value.trim()) { setSuggestions([]); return; }
    try {
      const results = await searchHospitals(value);
      setSuggestions(results);
    } catch { setSuggestions([]); }
  };

  const handleHospitalInput = (value: string) => {
    setHospitalName(value);
    setShowSuggestions(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(value), 300);
  };

  const pickSuggestion = (h: { display_name: string; latitude?: number; longitude?: number }) => {
    setHospitalName(h.display_name);
    if (h.latitude != null && h.longitude != null) {
      setHospitalLat(h.latitude.toString());
      setHospitalLon(h.longitude.toString());
    }
    setShowSuggestions(false);
  };

  const selectNearbyHospital = (h: NearbyHospital) => {
    setSelectedHospital(h.id);
    setHospitalName(h.name);
    setHospitalLat(h.lat.toString());
    setHospitalLon(h.lon.toString());
    setShowSuggestions(false);
    // Scroll to the form bottom
    setTimeout(() => {
      const el = document.getElementById("hospital-search-input");
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  };

  const startRoute = async () => {
    setIsSubmitting(true);
    if (!isLocationValid) {
      alert("Location not available. Please wait or detect location.");
      setIsSubmitting(false);
      return;
    }
    const payload: {
      origin_lat: number;
      origin_lon: number;
      hospital_name: string;
      hospital_lat?: number;
      hospital_lon?: number;
      patient_name?: string;
      patient_age?: string;
      patient_sex?: string;
      patient_mobile?: string;
      patient_case?: string;
      patient_blood_group?: string;
      patient_date?: string;
    } = {
      origin_lat: originLat!,
      origin_lon: originLon!,
      hospital_name: hospitalName,
    };
    if (hospitalLat && hospitalLon) {
      payload.hospital_lat = parseFloat(hospitalLat);
      payload.hospital_lon = parseFloat(hospitalLon);
    }
    if (patientName) payload.patient_name = patientName;
    if (patientAge) payload.patient_age = patientAge;
    if (patientSex) payload.patient_sex = patientSex;
    if (patientMobile) payload.patient_mobile = patientMobile;
    if (patientCase) payload.patient_case = patientCase;
    if (patientBloodGroup) payload.patient_blood_group = patientBloodGroup;
    if (patientDate) payload.patient_date = patientDate;

    // Save patient details to localStorage
    if (patientName) localStorage.setItem("patientName", patientName);
    if (patientAge) localStorage.setItem("patientAge", patientAge);
    if (patientSex) localStorage.setItem("patientSex", patientSex);
    if (patientMobile) localStorage.setItem("patientMobile", patientMobile);
    if (patientCase) localStorage.setItem("patientCase", patientCase);
    if (patientBloodGroup) localStorage.setItem("patientBloodGroup", patientBloodGroup);
    if (patientDate) localStorage.setItem("patientDate", patientDate);

    try {
      const data = await startRouteCompute(payload);
      localStorage.setItem("lastTaskId", data.task_id);
      localStorage.setItem("lastOriginLat", originLat!.toString());
      localStorage.setItem("lastOriginLon", originLon!.toString());
      router.push(`/map?task=${data.task_id}`);
    } catch (e) {
      console.error(e);
      setIsSubmitting(false);
    }
  };

  const isLocationValid =
    typeof originLat === "number" &&
    typeof originLon === "number" &&
    !isNaN(originLat) &&
    !isNaN(originLon);

  const formatDistance = (km: number | null) => {
    if (km == null) return "—";
    return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
  };

  const formatTime = (min: number | null) => {
    if (min == null) return "—";
    if (min < 1) return `${Math.round(min * 60)}s`;
    if (min < 60) return `${Math.round(min)} min`;
    return `${Math.floor(min / 60)}h ${Math.round(min % 60)}m`;
  };

  return (
    <motion.form
      onSubmit={(e) => { e.preventDefault(); startRoute(); }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6 bg-white rounded-3xl shadow-lg border border-gray-100 p-6 sm:p-8 overflow-hidden"
    >
      {/* Header */}
      <div className="text-center mb-2">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-400 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200"
        >
          <Navigation className="w-8 h-8 text-white" />
        </motion.div>
        <h2 className="text-2xl font-bold text-gray-900">Plan Ambulance Route</h2>
        <p className="text-sm text-gray-500 mt-1">Enter location and destination to compute optimal route</p>
      </div>

      {/* ─── Patient Details Section ─── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-gradient-to-br from-rose-50 to-orange-50 rounded-2xl p-5 border border-orange-100"
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-gradient-to-br from-rose-500 to-orange-500 rounded-lg flex items-center justify-center">
            <User className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-800">Patient Details</h3>
            <p className="text-xs text-gray-500">Enter patient information for emergency records</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {/* Date */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              <Calendar className="w-3.5 h-3.5 inline mr-1" />
              Date
            </label>
            <input
              type="date"
              value={patientDate}
              onChange={(e) => setPatientDate(e.target.value)}
              className="w-full rounded-xl border-2 border-orange-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition"
            />
          </div>

          {/* Patient Name */}
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              <User className="w-3.5 h-3.5 inline mr-1" />
              Patient Name
            </label>
            <input
              type="text"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              placeholder="Enter patient name"
              className="w-full rounded-xl border-2 border-orange-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition"
            />
          </div>

          {/* Age */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              <Calendar className="w-3.5 h-3.5 inline mr-1" />
              Age
            </label>
            <input
              type="number"
              min="1"
              max="150"
              value={patientAge}
              onChange={(e) => setPatientAge(e.target.value)}
              placeholder="e.g. 35"
              className="w-full rounded-xl border-2 border-orange-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition"
            />
          </div>

          {/* Sex */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              <User className="w-3.5 h-3.5 inline mr-1" />
              Sex
            </label>
            <select
              value={patientSex}
              onChange={(e) => setPatientSex(e.target.value)}
              className="w-full rounded-xl border-2 border-orange-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition"
            >
              <option value="">Select sex</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Blood Group */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              <Droplet className="w-3.5 h-3.5 inline mr-1" />
              Blood Group
            </label>
            <select
              value={patientBloodGroup}
              onChange={(e) => setPatientBloodGroup(e.target.value)}
              className="w-full rounded-xl border-2 border-orange-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition"
            >
              <option value="">Select</option>
              <option value="A+">A+</option>
              <option value="A-">A-</option>
              <option value="B+">B+</option>
              <option value="B-">B-</option>
              <option value="AB+">AB+</option>
              <option value="AB-">AB-</option>
              <option value="O+">O+</option>
              <option value="O-">O-</option>
            </select>
          </div>

          {/* Mobile Number */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              <Phone className="w-3.5 h-3.5 inline mr-1" />
              Mobile Number
            </label>
            <input
              type="tel"
              value={patientMobile}
              onChange={(e) => setPatientMobile(e.target.value)}
              placeholder="+91 98765 43210"
              className="w-full rounded-xl border-2 border-orange-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition"
            />
          </div>

          {/* Case Type - spans full width */}
          <div className="col-span-2 sm:col-span-3 lg:col-span-6">
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              <AlertTriangle className="w-3.5 h-3.5 inline mr-1" />
              Emergency Case Type
            </label>
            <select
              value={patientCase}
              onChange={(e) => setPatientCase(e.target.value)}
              className="w-full rounded-xl border-2 border-orange-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition"
            >
              <option value="">Select emergency case type</option>
              <option value="Accident">Accident</option>
              <option value="Heart Attack">Heart Attack</option>
              <option value="Burn">Burn</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>
      </motion.div>

      {/* Geolocation Button */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1 }}
      >
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          <Crosshair className="w-4 h-4 inline mr-2" />
          Current Location
        </label>
        <motion.button
          type="button"
          onClick={detectLocation}
          disabled={locating}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          className="w-full rounded-xl border-2 border-blue-200 bg-blue-50 px-4 py-3 text-blue-700 font-medium transition hover:bg-blue-100 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {locating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Detecting Location...
            </>
          ) : (
            <>
              <MapPin className="w-5 h-5" />
              Detect My Location
            </>
          )}
        </motion.button>

        <AnimatePresence>
          {!isLocationValid && !locateError && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-2 text-xs text-amber-600 flex items-center gap-1"
            >
              <Loader2 className="w-3 h-3 animate-spin" />
              Detecting location...
            </motion.p>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {originLat && originLon && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mt-2 text-xs text-emerald-600 flex items-center gap-1"
            >
              <CheckCircle2 className="w-3 h-3" />
              Location set: {originLat.toFixed(4)}, {originLon.toFixed(4)}
            </motion.p>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {locateError && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mt-2 text-xs text-red-500 flex items-center gap-1"
            >
              <AlertCircle className="w-3 h-3" />
              {locateError}
            </motion.p>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ─── Nearest Hospitals Section ─── */}
      <AnimatePresence>
        {isLocationValid && (loadingNearby || nearbyHospitals.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ delay: 0.15 }}
            ref={nearbyRef}
            className="w-full"
          >
            {/* Section Header */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-lg flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-800">Nearest Hospitals</h3>
                <p className="text-xs text-gray-500">Top 5 closest to your location</p>
              </div>
              {loadingNearby && <Loader2 className="w-4 h-4 animate-spin text-emerald-600 ml-auto" />}
            </div>

            {/* Hospital Cards */}
            <div className="space-y-2 w-full">
              {loadingNearby && nearbyHospitals.length === 0 && (
                <div className="grid gap-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-20 rounded-xl bg-gray-100 animate-pulse" />
                  ))}
                </div>
              )}

              {nearbyHospitals.map((h, i) => (
                <motion.div
                  key={h.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                  onClick={() => selectNearbyHospital(h)}
                  className={`relative cursor-pointer rounded-xl border-2 p-4 w-full transition-all duration-200 ${
                    selectedHospital === h.id
                      ? "border-blue-500 bg-blue-50 shadow-md shadow-blue-100"
                      : "border-gray-100 bg-white hover:border-blue-200 hover:shadow-md hover:shadow-blue-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    {/* Left: Hospital Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Hospital className={`w-4 h-4 ${selectedHospital === h.id ? "text-blue-600" : "text-emerald-600"}`} />
                        <span className="font-semibold text-sm text-gray-900 truncate">{h.name}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{h.address}</p>
                      {/* Tags row */}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-medium">
                          <Bed className="w-3 h-3" />
                          {h.available_beds}/{h.total_beds} beds
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-[10px] font-medium">
                          <Stethoscope className="w-3 h-3" />
                          {h.total_doctors_vacant} vacant
                        </span>
                        {h.specialist !== "None" && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-medium">
                            {h.specialist}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: Distance & ETA */}
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`inline-flex items-center gap-1 text-xs font-bold ${
                        selectedHospital === h.id ? "text-blue-700" : "text-emerald-700"
                      }`}>
                        <MapPin className="w-3 h-3" />
                        {formatDistance(h.distance_km)}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        {formatTime(h.estimated_time_min)}
                      </span>
                      {selectedHospital === h.id && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center"
                        >
                          <CheckCircle2 className="w-3 h-3 text-white" />
                        </motion.div>
                      )}
                    </div>
                  </div>

                  {/* Selection indicator bar */}
                  {selectedHospital === h.id && (
                    <motion.div
                      layoutId="selected-bar"
                      className="absolute bottom-0 left-4 right-4 h-0.5 bg-blue-500 rounded-full"
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  )}
                </motion.div>
              ))}
            </div>

            {/* Expand/collapse hint */}
            <p className="text-xs text-gray-400 text-center">
              Tap a hospital to auto-fill destination ↓
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Origin Coordinates */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-2 gap-4"
      >
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Origin Latitude</label>
          <input
            type="number"
            step="any"
            value={originLat ?? ""}
            onChange={(e) => setOriginLat(parseFloat(e.target.value))}
            placeholder="e.g. 19.0760"
            className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition input-focus"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Origin Longitude</label>
          <input
            type="number"
            step="any"
            value={originLon ?? ""}
            onChange={(e) => setOriginLon(parseFloat(e.target.value))}
            placeholder="e.g. 72.8777"
            className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition input-focus"
            required
          />
        </div>
      </motion.div>

      {/* Hospital Search */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.3 }}
        ref={containerRef}
        className="relative"
      >
        <label className="block text-sm font-semibold text-gray-700 mb-2" id="hospital-search-input">
          <Hospital className="w-4 h-4 inline mr-2" />
          Destination Hospital
          {selectedHospital && (
            <span className="ml-2 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-medium align-middle">
              Auto-filled ✓
            </span>
          )}
        </label>
        <input
          type="text"
          value={hospitalName}
          onChange={(e) => {
            handleHospitalInput(e.target.value);
            setSelectedHospital(null);
          }}
          placeholder="Search or select from nearest hospitals above..."
          className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition input-focus"
          required
        />
        <AnimatePresence>
          {showSuggestions && suggestions.length > 0 && (
            <motion.ul
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute z-[1000] mt-2 w-full overflow-auto rounded-xl border border-gray-200 bg-white shadow-xl max-h-48"
            >
              {suggestions.map((h, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => pickSuggestion(h)}
                  className="cursor-pointer px-4 py-3 text-sm hover:bg-blue-50 border-b border-gray-50 last:border-0 transition-colors"
                >
                  <div className="font-semibold text-gray-800">{h.name}</div>
                  {h.display_name && h.display_name !== h.name && (
                    <div className="text-xs text-gray-400 truncate">{h.display_name}</div>
                  )}
                  {h.latitude != null && h.longitude != null && (
                    <div className="text-xs text-gray-400">
                      📍 {h.latitude.toFixed(5)}, {h.longitude.toFixed(5)}
                    </div>
                  )}
                </motion.li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {showSuggestions && suggestions.length === 0 && hospitalName.length > 2 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute z-[1000] mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-4 text-center text-sm text-gray-400 shadow-xl"
            >
              No hospitals found nearby. Try a different search.
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Submit Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <motion.button
          type="submit"
          disabled={isSubmitting || !isLocationValid}
          whileHover={{ scale: isSubmitting ? 1 : 1.02 }}
          whileTap={{ scale: isSubmitting ? 1 : 0.97 }}
          className="w-full rounded-xl bg-gradient-to-r from-blue-700 to-blue-500 px-6 py-4 font-semibold text-white text-lg shadow-lg shadow-blue-200 transition hover:shadow-xl hover:shadow-blue-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Computing Route...
            </>
          ) : (
            <>
              <Navigation className="w-5 h-5" />
              Compute Optimal Route
            </>
          )}
        </motion.button>
      </motion.div>
    </motion.form>
  );
}
