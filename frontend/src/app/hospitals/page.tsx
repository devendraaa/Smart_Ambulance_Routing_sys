"use client";

import { useState, useEffect } from "react";
import { fetchHospitalsList } from "@/lib/api";

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
  if (pct < 0.15) return "text-red-600";
  if (pct < 0.3) return "text-orange-500";
  return "text-green-600";
}

export default function HospitalsPage() {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [originSet, setOriginSet] = useState(false);

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

  const filtered = hospitals.filter((h) =>
    h.name.toLowerCase().includes(search.toLowerCase()) ||
    h.specialist.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl p-6">
        <div className="h-96 animate-pulse rounded-lg bg-gray-200" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Government Hospitals — Mumbai</h1>
          <p className="text-sm text-gray-500">
            {hospitals.length} hospitals available
            {originSet && (
              <span className="ml-2 text-emerald-600">(distance &amp; ETA calculated from your location)</span>
            )}
          </p>
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or specialist..."
          className="w-full sm:w-72 rounded-md border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Desktop Table */}
      <div className="hidden xl:block overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-4 py-3 text-left">#</th>
              <th className="px-4 py-3 text-left">Hospital</th>
              <th className="px-4 py-3 text-left">Address</th>
              <th className="px-4 py-3 text-left">Contact</th>
              <th className="px-4 py-3 text-center">Total Beds</th>
              <th className="px-4 py-3 text-center">Available</th>
              <th className="px-4 py-3 text-center">Emergency</th>
              <th className="px-4 py-3 text-center">Doctors Vacant</th>
              <th className="px-4 py-3 text-left">Specialist</th>
              <th className="px-4 py-3 text-center">Distance</th>
              <th className="px-4 py-3 text-center">ETA</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.map((h, i) => (
              <tr key={h.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                <td className="px-4 py-3 font-semibold">{h.name}</td>
                <td className="px-4 py-3 max-w-48 truncate text-gray-600" title={h.address}>{h.address}</td>
                <td className="px-4 py-3 text-blue-600 text-xs">{h.contact}</td>
                <td className="px-4 py-3 text-center">{h.total_beds}</td>
                <td className={`px-4 py-3 text-center font-semibold ${getBedColor(h.available_beds, h.total_beds)}`}>
                  {h.available_beds}
                </td>
                <td className="px-4 py-3 text-center">{h.emergency_beds}</td>
                <td className="px-4 py-3 text-center">{h.total_doctors_vacant}</td>
                <td className="px-4 py-3 max-w-40 truncate text-xs text-gray-500" title={h.specialist}>{h.specialist}</td>
                <td className="px-4 py-3 text-center">{h.distance_km != null ? `${h.distance_km} km` : "—"}</td>
                <td className="px-4 py-3 text-center">{h.estimated_time_min != null ? formatTime(h.estimated_time_min) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile/Tablet Cards */}
      <div className="xl:hidden grid gap-4 sm:grid-cols-2">
        {filtered.map((h, i) => (
          <div key={h.id} className="rounded-lg border p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-lg">{h.name}</h3>
                <p className="text-xs text-gray-500">{h.address}</p>
              </div>
              <span className="text-xs text-gray-400">#{i + 1}</span>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-4 gap-2 text-center text-sm">
              <div className="rounded bg-gray-50 p-2">
                <div className="text-xs text-gray-500">Total Beds</div>
                <div className="font-bold">{h.total_beds}</div>
              </div>
              <div className="rounded bg-gray-50 p-2">
                <div className="text-xs text-gray-500">Available</div>
                <div className={`font-bold ${getBedColor(h.available_beds, h.total_beds)}`}>{h.available_beds}</div>
              </div>
              <div className="rounded bg-gray-50 p-2">
                <div className="text-xs text-gray-500">Emergency</div>
                <div className="font-bold">{h.emergency_beds}</div>
              </div>
              <div className="rounded bg-gray-50 p-2">
                <div className="text-xs text-gray-500">Vacant Doctors</div>
                <div className="font-bold">{h.total_doctors_vacant}</div>
              </div>
            </div>

            <p className="text-xs text-gray-500 truncate">{h.specialist}</p>
            <p className="text-xs text-blue-600">{h.contact}</p>

            {h.distance_km != null && (
              <div className="flex items-center gap-4 text-sm font-medium">
                <span className="text-emerald-600">{h.distance_km} km</span>
                <span className="text-gray-400">|</span>
                <span className="text-blue-600">~{formatTime(h.estimated_time_min)}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-gray-500 py-8">No hospitals match your search.</p>
      )}
    </div>
  );
}
