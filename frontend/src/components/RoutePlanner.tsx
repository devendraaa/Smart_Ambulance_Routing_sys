"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { startRouteCompute, searchHospitals } from "@/lib/api";

export default function RoutePlanner() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // const [originLat, setOriginLat] = useState("");
  // const [originLon, setOriginLon] = useState("");
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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (taskId) {
      router.push(`/route?task=${taskId}`);
    }
  }, [taskId, router]);

  // Close suggestions on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    detectLocation();
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
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setOriginLat(lat);
        setOriginLon(lon);
        setLocating(false);
        // Auto-fetch nearby hospitals after location is set
        setTimeout(() => {
          fetchNearby(hospitalName || "");
        }, 500);
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

  const fetchNearby = async (value: string) => {
    if (!value.trim()) {
      setSuggestions([]);
      return;
    }
    try {
      const results = await searchHospitals(value);
      setSuggestions(results);
    } catch {
      setSuggestions([]);
    }
  };

  const handleHospitalInput = (value: string) => {
    setHospitalName(value);
    setShowSuggestions(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchNearby(value), 300);
  };

  const pickHospital = (h: { display_name: string; latitude?: number; longitude?: number }) => {
    setHospitalName(h.display_name);
    if (h.latitude != null && h.longitude != null) {
      setHospitalLat(h.latitude.toString());
      setHospitalLon(h.longitude.toString());
    }
    setShowSuggestions(false);
  };

  // const startRoute = async () => {
  //   setIsSubmitting(true);
  //   const payload: {
  //     origin_lat: number;
  //     origin_lon: number;
  //     hospital_name: string;
  //     hospital_lat?: number;
  //     hospital_lon?: number;
  //   } = {
  //     origin_lat: parseFloat(originLat),
  //     origin_lon: parseFloat(originLon),
  //     hospital_name: hospitalName,
  //   };
  //   if (hospitalLat && hospitalLon) {
  //     payload.hospital_lat = parseFloat(hospitalLat);
  //     payload.hospital_lon = parseFloat(hospitalLon);
  //   }
  //   try {
  //     const data = await startRouteCompute(payload);
  //     localStorage.setItem("lastTaskId", data.task_id);
  //     localStorage.setItem("lastOriginLat", originLat);
  //     localStorage.setItem("lastOriginLon", originLon);
  //     setTaskId(data.task_id);
  //   } catch (e) {
  //     console.error(e);
  //     setIsSubmitting(false);
  //   }
  // };

  const startRoute = async () => {
    setIsSubmitting(true);

    if (!isLocationValid) {
      alert("Location not available. Please wait or detect location.");
      setIsSubmitting(false);
      return;
    }

    const payload = {
      origin_lat: originLat!,
      origin_lon: originLon!,
      hospital_name: hospitalName,
    };

    if (hospitalLat && hospitalLon) {
      payload.hospital_lat = parseFloat(hospitalLat);
      payload.hospital_lon = parseFloat(hospitalLon);
    }

    console.log("FINAL PAYLOAD:", payload); // ✅ Debug log

    try {
      const data = await startRouteCompute(payload);
      localStorage.setItem("lastTaskId", data.task_id);
      localStorage.setItem("lastOriginLat", originLat!.toString());
      localStorage.setItem("lastOriginLon", originLon!.toString());
      setTaskId(data.task_id);
    } catch (e) {
      console.error(e);
      setIsSubmitting(false);
    }
  };

  if (taskId) {
    return (
      <div className="text-center text-gray-600">Redirecting to progress...</div>
    );
  }

  const isLocationValid =
    typeof originLat === "number" &&
    typeof originLon === "number" &&
    !isNaN(originLat) &&
    !isNaN(originLon);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        startRoute();
      }}
      className="space-y-4"
    >
      {/* Geolocation button */}
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Current Location
        </label>
        <button
          type="button"
          onClick={detectLocation}
          disabled={locating}
          className="mt-1 w-full rounded-md border border-blue-300 bg-blue-50 px-4 py-2 text-blue-700 transition hover:bg-blue-100 disabled:opacity-50"
        >
          {locating ? "Detecting..." : "Detect My Location"}
        </button>

        {/* ✅ Add here */}
        {!isLocationValid && !locateError && (
          <p className="mt-1 text-xs text-yellow-600">
            📍 Detecting location...
          </p>
        )}

        {originLat && originLon && (
          <p className="mt-1 text-xs text-green-600">
            Location set: {originLat}, {originLon}
          </p>
        )}

        {locateError && (
          <p className="mt-1 text-xs text-red-500">{locateError}</p>
        )}

        {locating && (
          <p className="mt-1 text-xs text-yellow-600">
          📡 Fetching GPS signal...
        </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Origin Latitude
        </label>
        <input
          type="number"
          step="any"
          // value={originLat}
          value={originLat ?? ""}
          onChange={(e) => setOriginLat(parseFloat(e.target.value))}
          // onChange={(e) => setOriginLat(e.target.value)}
          placeholder="e.g. 19.0760"
          className="mt-1 w-full rounded-md border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Origin Longitude
        </label>
        <input
          type="number"
          step="any"
          // value={originLon}
          value={originLon ?? ""}
          onChange={(e) => setOriginLon(parseFloat(e.target.value))}
          placeholder="e.g. 72.8777"
          className="mt-1 w-full rounded-md border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>
      <div ref={containerRef} className="relative">
        <label className="block text-sm font-medium text-gray-700">
          Hospital Location
        </label>
        <input
          type="text"
          value={hospitalName}
          onChange={(e) => handleHospitalInput(e.target.value)}
          placeholder="Type hospital name..."
          className="mt-1 w-full rounded-md border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
        {showSuggestions && suggestions.length > 0 && (
          <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-lg">
            {suggestions.map((h, i) => (
              <li
                key={i}
                onClick={() => pickHospital(h)}
                className="cursor-pointer px-3 py-2 text-sm hover:bg-blue-50"
              >
                <div className="font-medium text-gray-800">{h.name}</div>
                {h.display_name && h.display_name !== h.name && (
                  <div className="text-xs text-gray-400 truncate">{h.display_name}</div>
                )}
                {h.latitude != null && h.longitude != null && (
                  <div className="text-xs text-gray-400">
                    {h.latitude.toFixed(5)}, {h.longitude.toFixed(5)}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {showSuggestions && suggestions.length === 0 && originLat && originLon && (
          <div className="absolute z-10 mt-1 w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-4 text-center text-sm text-gray-400 shadow-lg">
            No hospitals found within 10km. Try a different location.
          </div>
        )}
      </div>
      <button
        type="submit"
        disabled={!mounted || isSubmitting || !isLocationValid}
        className="w-full rounded-md bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
      >
        {isSubmitting ? "Starting..." : "Compute Route"}
      </button>
    </form>
  );
}
