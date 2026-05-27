"use client";

import { useState } from "react";
import { DispatchCase } from "@/lib/dispatch";
import {
  User, Phone, Droplets, Activity, Clock, MapPin,
  Thermometer, Heart, Wind, Route, Truck, Shield,
  CheckCircle, XCircle, Loader2,
} from "lucide-react";

interface Props {
  selectedCase: DispatchCase | null;
  onAssign: () => void;
  onStatusUpdate: (status: string) => Promise<void>;
}

function formatTime(min: number | undefined): string {
  if (min == null) return "—";
  if (min < 1) return `${Math.round(min * 60)} sec`;
  const hrs = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return hrs > 0 ? `${hrs}h ${m}m` : `${m} min`;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    unassigned: "bg-yellow-100 text-yellow-800 border-yellow-200",
    assigned: "bg-blue-100 text-blue-800 border-blue-200",
    arrived: "bg-green-100 text-green-800 border-green-200",
    delivering: "bg-purple-100 text-purple-800 border-purple-200",
    completed: "bg-emerald-100 text-emerald-800 border-emerald-200",
    cancelled: "bg-gray-100 text-gray-800 border-gray-200",
  };
  const s = styles[status] || "bg-gray-100 text-gray-800 border-gray-200";
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${s}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export default function DispatchCasePanel({ selectedCase, onAssign, onStatusUpdate }: Props) {
  const [updating, setUpdating] = useState(false);

  if (!selectedCase) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 rounded-2xl">
        <div className="text-center text-gray-400 p-6">
          <Shield className="w-12 h-12 mx-auto mb-3" />
          <p className="text-sm">Select a case to view details</p>
        </div>
      </div>
    );
  }

  const c = selectedCase;

  const nextStatus = (): string | null => {
    if (c.dispatch_status === "unassigned") return "assigned";
    if (c.dispatch_status === "assigned") return "arrived";
    if (c.dispatch_status === "arrived") return "delivering";
    if (c.dispatch_status === "delivering") return "completed";
    return null;
  };

  const handleStatusUpdate = async (status: string) => {
    setUpdating(true);
    try {
      await onStatusUpdate(status);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-white rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-bold text-gray-900 truncate flex items-center gap-2">
            <User className="w-4 h-4 text-blue-500" />
            {c.patient_name || "Unnamed Patient"}
          </h3>
          <StatusBadge status={c.dispatch_status} />
        </div>
        {c.patient_uhid && (
          <p className="text-xs text-gray-500 font-mono">UHID: {c.patient_uhid}</p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Patient Info */}
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Patient Details</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-[10px] text-gray-500">Age / Sex</p>
              <p className="text-sm font-bold text-gray-800">{c.patient_age || "?"}y {c.patient_sex || ""}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-[10px] text-gray-500">Blood Group</p>
              <p className="text-sm font-bold text-red-700">{c.patient_blood_group || "—"}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-[10px] text-gray-500">Mobile</p>
              <p className="text-sm font-bold text-gray-800">{c.patient_mobile || "—"}</p>
            </div>
            <div className="bg-red-50 rounded-xl p-3 border border-red-100">
              <p className="text-[10px] text-red-500">Case Type</p>
              <p className="text-sm font-bold text-red-700">{c.patient_case || "—"}</p>
            </div>
          </div>
        </div>

        {/* Vitals */}
        {(c.patient_bp_systolic || c.patient_temperature || c.patient_pulse || c.patient_spo2) && (
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Vitals</h4>
            <div className="grid grid-cols-2 gap-3">
              {c.patient_bp_systolic && (
                <div className="bg-cyan-50 rounded-xl p-3 border border-cyan-100">
                  <p className="text-[10px] text-cyan-600 flex items-center gap-1"><Activity className="w-3 h-3" /> BP</p>
                  <p className="text-sm font-bold text-cyan-800">{c.patient_bp_systolic}/{c.patient_bp_diastolic || "?"} mmHg</p>
                </div>
              )}
              {c.patient_temperature && (
                <div className="bg-orange-50 rounded-xl p-3 border border-orange-100">
                  <p className="text-[10px] text-orange-600 flex items-center gap-1"><Thermometer className="w-3 h-3" /> Temp</p>
                  <p className="text-sm font-bold text-orange-800">{c.patient_temperature}°C</p>
                </div>
              )}
              {c.patient_pulse && (
                <div className="bg-rose-50 rounded-xl p-3 border border-rose-100">
                  <p className="text-[10px] text-rose-600 flex items-center gap-1"><Heart className="w-3 h-3" /> Pulse</p>
                  <p className="text-sm font-bold text-rose-800">{c.patient_pulse} bpm</p>
                </div>
              )}
              {c.patient_spo2 && (
                <div className="bg-purple-50 rounded-xl p-3 border border-purple-100">
                  <p className="text-[10px] text-purple-600 flex items-center gap-1"><Wind className="w-3 h-3" /> SpO2</p>
                  <p className="text-sm font-bold text-purple-800">{c.patient_spo2}%</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Route Info */}
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Route Info</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
              <p className="text-[10px] text-blue-600 flex items-center gap-1"><Route className="w-3 h-3" /> Distance</p>
              <p className="text-sm font-bold text-blue-800">{c.distance_km != null ? `${c.distance_km} km` : "—"}</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
              <p className="text-[10px] text-blue-600 flex items-center gap-1"><Clock className="w-3 h-3" /> ETA</p>
              <p className="text-sm font-bold text-blue-800">{formatTime(c.duration_min)}</p>
            </div>
            <div className="col-span-2 bg-gray-50 rounded-xl p-3">
              <p className="text-[10px] text-gray-500 flex items-center gap-1"><MapPin className="w-3 h-3" /> Hospital</p>
              <p className="text-sm font-bold text-gray-800 truncate">{c.hospital_name}</p>
            </div>
          </div>
        </div>

        {/* Ambulance Info */}
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            <Truck className="w-3 h-3 inline mr-1" />
            Ambulance
          </h4>
          {c.ambulance_number ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-[10px] text-gray-500">Vehicle</p>
                <p className="text-sm font-bold text-gray-800">{c.ambulance_number}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-[10px] text-gray-500">Driver</p>
                <p className="text-sm font-bold text-gray-800">{c.driver_name || "—"}</p>
              </div>
              {c.driver_mobile && (
                <div className="col-span-2 bg-gray-50 rounded-xl p-3">
                  <p className="text-[10px] text-gray-500 flex items-center gap-1"><Phone className="w-3 h-3" /> Driver Contact</p>
                  <p className="text-sm font-bold text-gray-800">{c.driver_mobile}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-yellow-50 rounded-xl p-3 border border-yellow-200 text-center">
              <p className="text-xs text-yellow-700">No ambulance assigned yet</p>
            </div>
          )}
        </div>

        {/* Live Location */}
        {c.current_lat != null && c.current_lon != null && (
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Live Location</h4>
            <div className="bg-green-50 rounded-xl p-3 border border-green-200">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-xs font-medium text-green-700">Ambulance GPS Active</span>
              </div>
              <p className="text-xs text-green-600 font-mono">
                {c.current_lat.toFixed(5)}, {c.current_lon.toFixed(5)}
              </p>
              {c.last_location_update && (
                <p className="text-[10px] text-green-500 mt-1">
                  Updated: {new Date(c.last_location_update).toLocaleTimeString()}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-gray-100 space-y-2">
        {/* Assign Ambulance */}
        {c.dispatch_status === "unassigned" && (
          <button
            onClick={onAssign}
            className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition"
          >
            <Truck className="w-4 h-4" />
            Assign Ambulance
          </button>
        )}

        {/* Next status */}
        {nextStatus() && (
          <button
            onClick={() => handleStatusUpdate(nextStatus()!)}
            disabled={updating}
            className="w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition"
          >
            {updating ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Updating...</>
            ) : (
              <><CheckCircle className="w-4 h-4" /> Mark as {nextStatus()!.charAt(0).toUpperCase() + nextStatus()!.slice(1)}</>
            )}
          </button>
        )}

        {/* Cancel */}
        {c.dispatch_status !== "completed" && c.dispatch_status !== "cancelled" && (
          <button
            onClick={() => handleStatusUpdate("cancelled")}
            disabled={updating}
            className="w-full px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition border border-red-200"
          >
            <XCircle className="w-4 h-4" />
            Cancel Case
          </button>
        )}
      </div>
    </div>
  );
}
