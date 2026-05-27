"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useDispatchPolling } from "@/hooks/useDispatchPolling";
import { updateTaskStatus } from "@/lib/dispatch";
import DispatchCaseList from "./DispatchCaseList";
import DispatchMap from "./DispatchMap";
import DispatchCasePanel from "./DispatchCasePanel";
import DispatchAssignModal from "./DispatchAssignModal";
import { RefreshCw, Activity, List, Map as MapIcon, Info } from "lucide-react";

export default function DispatchDashboard() {
  const { cases, loading, selectedCase, setSelectedCase, refresh } = useDispatchPolling();
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [mobileTab, setMobileTab] = useState<"list" | "map" | "details">("list");

  const handleStatusUpdate = useCallback(async (status: string) => {
    if (!selectedCase) return;
    setStatusLoading(true);
    try {
      await updateTaskStatus(selectedCase.task_id, status);
      await refresh();
    } finally {
      setStatusLoading(false);
    }
  }, [selectedCase, refresh]);

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-gray-50">
        <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-br from-blue-600 to-indigo-500 rounded-xl flex items-center justify-center">
            <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-bold text-gray-900">Dispatch Dashboard</h1>
            <p className="text-[10px] sm:text-xs text-gray-500">{cases.length} active case{cases.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <button
          onClick={refresh}
          className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-xl transition text-gray-500 hover:text-blue-600"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
      </div>

      {/* Mobile tab bar */}
      <div className="lg:hidden flex border-b border-gray-200 bg-white">
        <button
          onClick={() => setMobileTab("list")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition ${
            mobileTab === "list"
              ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50/50"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <List className="w-4 h-4" />
          Cases ({cases.length})
        </button>
        <button
          onClick={() => setMobileTab("map")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition ${
            mobileTab === "map"
              ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50/50"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <MapIcon className="w-4 h-4" />
          Map
        </button>
        <button
          onClick={() => setMobileTab("details")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition ${
            mobileTab === "details"
              ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50/50"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Info className="w-4 h-4" />
          Details
        </button>
      </div>

      {/* Main layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Case List - hidden on mobile unless selected */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="hidden lg:flex w-72 lg:w-80 bg-white border-r border-gray-200 flex-shrink-0 overflow-hidden"
        >
          <DispatchCaseList
            cases={cases}
            selectedCase={selectedCase}
            onSelect={setSelectedCase}
          />
        </motion.div>

        {/* Mobile: Case List */}
        <div className={`lg:hidden flex-1 overflow-hidden ${mobileTab === "list" ? "block" : "hidden"}`}>
          <DispatchCaseList
            cases={cases}
            selectedCase={selectedCase}
            onSelect={(c) => { setSelectedCase(c); setMobileTab("details"); }}
          />
        </div>

        {/* Center: Map */}
        <div className={`flex-1 p-1 sm:p-2 lg:p-3 min-w-0 ${mobileTab === "map" ? "block" : "hidden lg:block"}`}>
          <DispatchMap selectedCase={selectedCase} />
        </div>

        {/* Right: Case Panel - hidden on mobile unless selected */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="hidden lg:flex w-80 lg:w-96 bg-white border-l border-gray-200 flex-shrink-0 overflow-hidden"
        >
          <DispatchCasePanel
            selectedCase={selectedCase}
            onAssign={() => setAssignModalOpen(true)}
            onStatusUpdate={handleStatusUpdate}
          />
        </motion.div>

        {/* Mobile: Case Details */}
        <div className={`lg:hidden flex-1 overflow-hidden ${mobileTab === "details" ? "block" : "hidden"}`}>
          <DispatchCasePanel
            selectedCase={selectedCase}
            onAssign={() => setAssignModalOpen(true)}
            onStatusUpdate={handleStatusUpdate}
          />
        </div>
      </div>

      {/* Assign Modal */}
      {selectedCase && (
        <DispatchAssignModal
          taskId={selectedCase.task_id}
          open={assignModalOpen}
          onClose={() => setAssignModalOpen(false)}
          onSuccess={refresh}
        />
      )}
    </div>
  );
}
