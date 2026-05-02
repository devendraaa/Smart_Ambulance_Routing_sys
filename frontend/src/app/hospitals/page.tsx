"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { fetchHospitalsList } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { Search, MapPin, Bed, Stethoscope, Clock, Phone, ChevronDown, ChevronUp } from "lucide-react";

type Hospital = {
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

function formatTime(min: number): string {
  if (min < 1) return `${Math.round(min * 60)} sec`;
  const hrs = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return hrs > 0 ? `${hrs}h ${m}m` : `${m} min`;
}

function getBedColor(available: number, total: number): string {
  const pct = available / total;
  if (pct < 0.15) return "text-red-600 bg-red-50 border-red-200";
  if (pct < 0.3) return "text-amber-600 bg-amber-50 border-amber-200";
  return "text-emerald-600 bg-emerald-50 border-emerald-200";
}

export default function HospitalsPage() {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [originSet, setOriginSet] = useState(false);
  const [sortBy, setSortBy] = useState<"name" | "distance" | "beds">("distance");
  const [sortAsc, setSortAsc] = useState(true);

  useEffect(() => {
    const originLat = localStorage.getItem("lastOriginLat");
    const originLon = localStorage.getItem("lastOriginLon");
    setOriginSet(originLat != null && originLon != null);

    fetchHospitalsList(
      originLat ? parseFloat(originLat) : undefined,
      originLon ? parseFloat(originLon) : undefined
    )
      .then((data) => setHospitals(data.hospitals))
      .catch(() => setHospitals([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = hospitals.filter(
    (h) =>
      h.name.toLowerCase().includes(search.toLowerCase()) ||
      h.specialist.toLowerCase().includes(search.toLowerCase())
  );

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "name") return sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
    if (sortBy === "distance") {
      const aDist = a.distance_km ?? Infinity;
      const bDist = b.distance_km ?? Infinity;
      return sortAsc ? aDist - bDist : bDist - aDist;
    }
    return sortAsc ? a.available_beds - b.available_beds : b.available_beds - a.available_beds;
  });

  const toggleSort = (key: "name" | "distance" | "beds") => {
    if (sortBy === key) setSortAsc(!sortAsc);
    else { setSortBy(key); setSortAsc(true); }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <div className="animate-pulse space-y-4">
                <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map((j) => (
                    <div key={j} className="h-16 bg-gray-200 rounded"></div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Government Hospitals</h1>
            <p className="text-gray-500 mt-1">
              {filtered.length} hospitals found
              {originSet && (
                <span className="ml-2 text-emerald-600">• Distance & ETA from your location</span>
              )}
            </p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or specialist..."
              className="w-full sm:w-72 pl-10 pr-4 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100 transition input-focus"
            />
          </div>
        </div>

        {/* Sort Buttons */}
        <div className="flex gap-2 flex-wrap">
          <span className="text-sm text-gray-500 flex items-center mr-2">Sort by:</span>
          {[
            { key: "distance" as const, label: "Distance" },
            { key: "name" as const, label: "Name" },
            { key: "beds" as const, label: "Available Beds" },
          ].map((btn) => (
            <button
              key={btn.key}
              onClick={() => toggleSort(btn.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
                sortBy === btn.key
                  ? "bg-blue-100 text-blue-700"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {btn.label}
              {sortBy === btn.key && (
                sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
              )}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Hospital Cards */}
      <motion.div
        variants={{
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: { staggerChildren: 0.05 },
          },
        }}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      >
        {sorted.map((h, i) => {
          const bedColor = getBedColor(h.available_beds, h.total_beds);
          return (
            <motion.div
              key={h.id}
              variants={{
                hidden: { opacity: 0, y: 30, scale: 0.95 },
                visible: { opacity: 1, y: 0, scale: 1 },
              }}
              whileHover={{ y: -5, transition: { type: "spring", stiffness: 300, damping: 20 } }}
              className="bg-white rounded-2xl shadow-sm hover:shadow-lg border border-gray-100 overflow-hidden transition-shadow"
            >
              {/* Card Header */}
              <div className="bg-gradient-to-r from-blue-700 to-blue-500 p-4 text-white">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-xl">
                      🏥
                    </div>
                    <div>
                      <h3 className="font-bold text-lg leading-tight">{h.name}</h3>
                      <p className="text-blue-100 text-xs mt-0.5 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {h.distance_km != null ? `${h.distance_km} km` : "Distance N/A"}
                      </p>
                    </div>
                  </div>
                  {h.estimated_time_min != null && (
                    <div className="bg-white/20 backdrop-blur-sm rounded-lg px-2 py-1 text-center">
                      <Clock className="w-3 h-3 mx-auto mb-0.5" />
                      <span className="text-xs font-semibold">
                        {formatTime(h.estimated_time_min)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Card Body */}
              <div className="p-4 space-y-4">
                {/* Address */}
                <p className="text-xs text-gray-500 flex items-start gap-1">
                  <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  <span className="line-clamp-2">{h.address}</span>
                </p>

                {/* Stats Grid */}
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: "Total", value: h.total_beds, icon: "🛏️" },
                    { label: "Available", value: h.available_beds, icon: "✓", color: bedColor },
                    { label: "Emergency", value: h.emergency_beds, icon: "🚨" },
                    { label: "Vacant Docs", value: h.total_doctors_vacant, icon: "👨⚕️" },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className={`rounded-xl p-2 text-center ${stat.color?.split(" ").slice(0, 1).join("") || "bg-gray-50"}`}
                    >
                      <div className="text-xs">{stat.icon}</div>
                      <div className={`text-sm font-bold ${stat.color?.split(" ")[0] || "text-gray-700"}`}>
                        {stat.value}
                      </div>
                      <div className="text-[10px] text-gray-500">{stat.label}</div>
                    </div>
                  ))}
                </div>

                {/* Specialist & Contact */}
                <div className="pt-3 border-t border-gray-100 space-y-2">
                  <div className="flex items-center gap-1">
                    <Stethoscope className="w-3 h-3 text-gray-400" />
                    <span className="text-xs text-gray-600 truncate">{h.specialist}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Phone className="w-3 h-3 text-blue-500" />
                    <span className="text-xs text-blue-600">{h.contact}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Empty State */}
      <AnimatePresence>
        {filtered.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-center py-12"
          >
            <div className="text-6xl mb-4">🔍</div>
            <p className="text-gray-500 text-lg">No hospitals match your search.</p>
            <button
              onClick={() => setSearch("")}
              className="mt-4 text-blue-600 hover:underline text-sm"
            >
              Clear search
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
