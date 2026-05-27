"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Truck, X, Loader2 } from "lucide-react";
import { assignAmbulance } from "@/lib/dispatch";

interface Props {
  taskId: string;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function DispatchAssignModal({ taskId, open, onClose, onSuccess }: Props) {
  const [ambulanceNumber, setAmbulanceNumber] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverMobile, setDriverMobile] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!ambulanceNumber.trim() || !driverName.trim() || !driverMobile.trim()) {
      setError("All fields are required");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await assignAmbulance(taskId, {
        ambulance_number: ambulanceNumber.trim(),
        driver_name: driverName.trim(),
        driver_mobile: driverMobile.trim(),
      });
      onSuccess();
      onClose();
    } catch (e: any) {
      setError(e.message || "Failed to assign ambulance");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[2000] p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
          >
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Truck className="w-4 h-4 text-blue-600" />
                </div>
                <h3 className="text-base font-bold text-gray-900">Assign Ambulance</h3>
              </div>
              <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Ambulance Number</label>
                <input
                  type="text"
                  value={ambulanceNumber}
                  onChange={(e) => setAmbulanceNumber(e.target.value)}
                  placeholder="e.g., MH-01-AB-1234"
                  className="w-full rounded-xl border-2 border-gray-200 px-3 py-2.5 text-sm focus:border-blue-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Driver Name</label>
                <input
                  type="text"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  placeholder="e.g., Rajesh Kumar"
                  className="w-full rounded-xl border-2 border-gray-200 px-3 py-2.5 text-sm focus:border-blue-400 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Driver Mobile</label>
                <input
                  type="tel"
                  value={driverMobile}
                  onChange={(e) => setDriverMobile(e.target.value)}
                  placeholder="e.g., 9876543210"
                  className="w-full rounded-xl border-2 border-gray-200 px-3 py-2.5 text-sm focus:border-blue-400 focus:outline-none"
                />
              </div>

              {error && (
                <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
              )}
            </div>

            <div className="flex items-center gap-3 p-5 border-t border-gray-100">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium text-sm transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition"
              >
                {submitting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Assigning...</>
                ) : (
                  <><Truck className="w-4 h-4" /> Assign</>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
