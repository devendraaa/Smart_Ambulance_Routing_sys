"use client";

import { useState, useEffect } from "react";
import { fetchBloodBanks } from "@/lib/api";

function formatTime(min: number): string {
  if (min < 1) return `${Math.round(min * 60)} sec`;
  const hrs = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return hrs > 0 ? `${hrs}h ${m}m` : `${m} min`;
}

const LITER_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  "A+": { bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-600" },
  "A-": { bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-600" },
  "B+": { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-600" },
  "B-": { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-600" },
  "AB+": { bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-600" },
  "AB-": { bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-600" },
  "O+": { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-600" },
  "O-": { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-600" },
};

export default function BloodBankPage() {
  const [banks, setBanks] = useState<any[]>([]);
  const [allBloodTypes, setAllBloodTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [originSet, setOriginSet] = useState(false);

  useEffect(() => {
    const originLat = localStorage.getItem("lastOriginLat");
    const originLon = localStorage.getItem("lastOriginLon");
    setOriginSet(originLat != null && originLon != null);

    fetchBloodBanks(
      originLat ? parseFloat(originLat) : undefined,
      originLon ? parseFloat(originLon) : undefined
    )
      .then((data) => {
        setBanks(data.banks);
        setAllBloodTypes(data.blood_types);
      })
      .catch(() => setBanks([]))
      .finally(() => setLoading(false));
  }, []);

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
      <div>
        <h1 className="text-2xl font-bold">Blood Bank Availability</h1>
        <p className="text-sm text-gray-500">
          {banks.length} blood banks in Mumbai{" "}
          {originSet && <span className="ml-2 text-emerald-600">(with distance &amp; ETA)</span>}
        </p>
      </div>

      {/* Aggregate availability */}
      <div className="rounded-lg border p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Quick Availability by Blood Type</h2>
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
          {allBloodTypes.map((bt) => {
            const totalLiters = banks.reduce(
              (sum, b) =>
                sum + (b.blood_availability.find((a: any) => a.blood_type === bt)?.available_liters ?? 0),
              0
            );
            const colors = LITER_COLORS[bt] || { bg: "bg-gray-50", border: "border-gray-200", text: "text-gray-600" };
            return (
              <div key={bt} className={`rounded-lg border ${colors.border} ${colors.bg} p-3 text-center`}>
                <div className={`font-bold ${colors.text}`}>{bt}</div>
                <div className="text-sm font-semibold">{totalLiters.toFixed(1)} L</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bank cards */}
      <div className="grid gap-6 lg:grid-cols-2">
        {banks.map((bank) => (
          <div key={bank.id} className="rounded-lg border p-5 space-y-4">
            <div>
              <h3 className="font-semibold text-lg">{bank.name}</h3>
              <p className="text-xs text-gray-500">{bank.address}</p>
              <p className="text-xs text-blue-600 mt-1">{bank.contact}</p>
              {bank.distance_km != null && (
                <div className="flex items-center gap-4 mt-2 text-sm font-medium">
                  <span className="text-emerald-600">{bank.distance_km} km</span>
                  <span className="text-gray-400">|</span>
                  <span className="text-blue-600">~{formatTime(bank.estimated_time_min)}</span>
                </div>
              )}
            </div>

            {/* Blood types grid */}
            <div className="grid grid-cols-4 gap-2">
              {bank.blood_availability.map((a: any) => {
                const colors = LITER_COLORS[a.blood_type] || { bg: "bg-gray-50", border: "border-gray-200", text: "text-gray-600" };
                const low = a.available_liters < 2.0;
                return (
                  <div key={a.blood_type} className={`rounded-lg border ${colors.border} ${colors.bg} p-2.5 text-center`}>
                    <div className={`font-bold text-sm ${colors.text}`}>{a.blood_type}</div>
                    <div className={`text-xs font-semibold mt-1 ${low ? "text-red-500" : "text-gray-700"}`}>
                      {a.available_liters} L
                      {low && <span className="ml-1">⚠</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {banks.length === 0 && (
        <p className="text-center text-gray-500 py-8">No blood bank data available.</p>
      )}
    </div>
  );
}
