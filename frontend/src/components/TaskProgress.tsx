"use client";

import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertCircle, Loader2, Clock, Route } from "lucide-react";

interface TaskProgressProps {
  progress: number;
  processed_nodes?: number;
  total_nodes?: number;
  status: string;
  error?: string;
  distance_km?: number;
  duration_min?: number;
}

export default function TaskProgress({
  progress,
  processed_nodes,
  total_nodes,
  status,
  error,
  distance_km,
  duration_min,
}: TaskProgressProps) {
  const pct = Math.round(progress * 100);

  if (status === "completed") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
        className="space-y-4 rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50 p-6"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 15, delay: 0.2 }}
          className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-200"
        >
          <CheckCircle2 className="w-8 h-8 text-white" />
        </motion.div>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-center font-semibold text-emerald-800 text-lg"
        >
          Route Computation Complete!
        </motion.p>
        {(distance_km != null || duration_min != null) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="grid grid-cols-2 gap-4"
          >
            {distance_km != null && (
              <motion.div
                whileHover={{ scale: 1.02 }}
                className="bg-white rounded-xl p-4 text-center shadow-sm"
              >
                <Route className="w-5 h-5 text-blue-600 mx-auto mb-2" />
                <div className="text-xs text-gray-500 mb-1">Distance</div>
                <div className="text-xl font-bold text-blue-700">{distance_km.toFixed(2)} km</div>
              </motion.div>
            )}
            {duration_min != null && (
              <motion.div
                whileHover={{ scale: 1.02 }}
                className="bg-white rounded-xl p-4 text-center shadow-sm"
              >
                <Clock className="w-5 h-5 text-amber-600 mx-auto mb-2" />
                <div className="text-xs text-gray-500 mb-1">ETA</div>
                <div className="text-xl font-bold text-amber-700">{formatDuration(duration_min)}</div>
              </motion.div>
            )}
          </motion.div>
        )}
      </motion.div>
    );
  }

  if (status === "failed") {
    return (
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="rounded-2xl border-2 border-red-200 bg-red-50 p-6"
      >
        <div className="flex items-center gap-3 mb-3">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center"
          >
            <AlertCircle className="w-5 h-5 text-white" />
          </motion.div>
          <div>
            <p className="font-semibold text-red-800">Route Computation Failed</p>
            <p className="text-sm text-red-600">{error}</p>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-4 bg-white rounded-2xl border border-gray-100 p-6 shadow-sm"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          >
            <Loader2 className="w-5 h-5 text-blue-600" />
          </motion.div>
          <span className="text-sm font-medium text-gray-700">
            Processing route nodes
          </span>
        </div>
        <motion.span
          key={pct}
          initial={{ scale: 1.2, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-sm font-bold text-blue-600"
        >
          {pct}%
        </motion.span>
      </div>

      {/* Progress Bar */}
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-gray-100">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-blue-600 to-blue-400 progress-glow"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        />
        {/* Animated pulse at the end of progress */}
        {pct > 0 && pct < 100 && (
          <motion.div
            className="absolute top-0 bottom-0 w-4 rounded-full bg-blue-400"
            style={{ left: `${pct}%`, marginLeft: "-8px" }}
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        )}
      </div>

      {/* Stats */}
      <div className="flex justify-between text-xs text-gray-500">
        <span>
          Processed: <span className="font-semibold text-gray-700">{processed_nodes ?? 0}</span> / {total_nodes ?? 0} nodes
        </span>
        <span className="text-blue-600">{pct}% complete</span>
      </div>
    </motion.div>
  );
}

function formatDuration(minutes: number): string {
  if (minutes < 1) return `${Math.round(minutes * 60)} sec`;
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins} min`;
}
