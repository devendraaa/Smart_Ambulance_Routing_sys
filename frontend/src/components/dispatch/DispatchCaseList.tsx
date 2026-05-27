"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { DispatchCase } from "@/lib/dispatch";
import { Clock, User, AlertTriangle } from "lucide-react";

interface Props {
  cases: DispatchCase[];
  selectedCase: DispatchCase | null;
  onSelect: (c: DispatchCase) => void;
}

const STATUS_ORDER = ["unassigned", "assigned", "arrived", "delivering"];

const STATUS_STYLES: Record<string, { badge: string; dot: string; label: string }> = {
  unassigned: { badge: "bg-yellow-100 text-yellow-800 border-yellow-200", dot: "bg-yellow-400", label: "Unassigned" },
  assigned: { badge: "bg-blue-100 text-blue-800 border-blue-200", dot: "bg-blue-400", label: "Assigned" },
  arrived: { badge: "bg-green-100 text-green-800 border-green-200", dot: "bg-green-400", label: "Arrived" },
  delivering: { badge: "bg-purple-100 text-purple-800 border-purple-200", dot: "bg-purple-400", label: "Delivering" },
  cancelled: { badge: "bg-gray-100 text-gray-800 border-gray-200", dot: "bg-gray-400", label: "Cancelled" },
};

function getDefaultStyle(s: string) {
  return { badge: "bg-gray-100 text-gray-800 border-gray-200", dot: "bg-gray-400", label: s };
}

function formatTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export default function DispatchCaseList({ cases, selectedCase, onSelect }: Props) {
  const sorted = useMemo(() => {
    return [...cases].sort((a, b) => {
      const ai = STATUS_ORDER.indexOf(a.dispatch_status);
      const bi = STATUS_ORDER.indexOf(b.dispatch_status);
      if (ai !== bi) return ai - bi;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [cases]);

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-gray-100">
        <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
          Active Cases
          <span className="ml-auto px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
            {cases.length}
          </span>
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
        {sorted.map((c) => {
          const st = STATUS_STYLES[c.dispatch_status] || getDefaultStyle(c.dispatch_status);
          const isSelected = selectedCase?.task_id === c.task_id;
          const isEmergency = c.patient_case?.toLowerCase().includes("emergency") ||
            c.patient_case?.toLowerCase().includes("accident") ||
            c.patient_case?.toLowerCase().includes("heart");
          return (
            <motion.button
              key={c.task_id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              onClick={() => onSelect(c)}
              className={`w-full text-left p-4 transition-colors hover:bg-blue-50/50 ${
                isSelected ? "bg-blue-50 border-l-4 border-l-blue-500" : "border-l-4 border-l-transparent"
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  {isEmergency && <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
                  <span className="text-sm font-semibold text-gray-900 truncate">
                    {c.patient_name || "Unnamed"}
                  </span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${st.badge} flex-shrink-0`}>
                  {st.label}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {c.patient_age || "?"}y {c.patient_sex || ""}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatTime(c.created_at)}
                </span>
                {c.current_lat != null && (
                  <span className={`w-1.5 h-1.5 rounded-full ${st.dot} animate-pulse`} />
                )}
              </div>
              {c.patient_case && (
                <p className="text-xs text-gray-600 mt-1 truncate">{c.patient_case}</p>
              )}
            </motion.button>
          );
        })}
        {sorted.length === 0 && (
          <div className="p-8 text-center text-gray-400 text-sm">No active cases</div>
        )}
      </div>
    </div>
  );
}
