"use client";

import { useState, useEffect } from "react";
import { fetchBloodBanks } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { Droplet, MapPin, Clock, Phone, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

function formatTime(min: number): string {
  if (min < 1) return `${Math.round(min * 60)} sec`;
  const hrs = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return hrs > 0 ? `${hrs}h ${m}m` : `${m} min`;
}

const LITER_COLORS: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  "A+": { bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-600", glow: "shadow-rose-200" },
  "A-": { bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-600", glow: "shadow-rose-200" },
  "B+": { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-600", glow: "shadow-blue-200" },
  "B-": { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-600", glow: "shadow-blue-200" },
  "AB+": { bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-600", glow: "shadow-purple-200" },
  "AB-": { bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-600", glow: "shadow-purple-200" },
  "O+": { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-600", glow: "shadow-emerald-200" },
  "O-": { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-600", glow: "shadow-emerald-200" },
};

export default function BloodBankPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [banks, setBanks] = useState<any[]>([]);
  const [allBloodTypes, setAllBloodTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [originSet, setOriginSet] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    const originLat = localStorage.getItem("lastOriginLat");
    const originLon = localStorage.getItem("lastOriginLon");
    setOriginSet(originLat != null && originLon != null);

    fetchBloodBanks(
      originLat ? parseFloat(originLat) : undefined,
      originLon ? parseFloat(originLon) : undefined
    )
      .then((data) => { setBanks(data.banks); setAllBloodTypes(data.blood_types); })
      .catch(() => setBanks([]))
      .finally(() => setLoading(false));
  }, []);

  if (!mounted) {
    return <div className="min-h-screen flex items-center justify-center">{t("bloodbank.loading")}</div>;
  }

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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-7xl mx-auto p-6 py-8"
    >
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{t("bloodbank.heading")}</h1>
            <p className="text-gray-500 mt-1">
              {banks.length} {t("bloodbank.count")}
              {originSet && (
                <span className="ml-2 text-emerald-600">{t("bloodbank.distEta")}</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Droplet className="w-5 h-5 text-red-500" />
            <span className="text-sm text-gray-500">{t("bloodbank.realtime")}</span>
          </div>
        </div>

        {/* Blood Type Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
        >
          <h3 className="text-sm font-semibold text-gray-700 mb-4">{t("bloodbank.quickHeading")}</h3>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
            {allBloodTypes.map((bt, i) => {
              const totalLiters = banks.reduce(
                (sum, b) =>
                  sum + (b.blood_availability.find((a: any) => a.blood_type === bt)?.available_liters ?? 0),
                0
              );
              const colors = LITER_COLORS[bt] || { bg: "bg-gray-50", border: "border-gray-200", text: "text-gray-600", glow: "shadow-gray-200" };
              return (
                <motion.div
                  key={bt}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                  whileHover={{ y: -4, transition: { type: "spring", stiffness: 400 } }}
                  className={`rounded-xl border-2 ${colors.border} ${colors.bg} p-3 text-center shadow-sm ${colors.glow}`}
                >
                  <div className={`font-bold text-lg ${colors.text}`}>{bt}</div>
                  <div className="text-sm font-semibold text-gray-700 mt-1">{totalLiters.toFixed(1)} L</div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </motion.div>

      {/* Bank Cards */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      >
        {banks.map((bank, i) => (
          <motion.div
            key={bank.id}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            whileHover={{ y: -5, transition: { type: "spring", stiffness: 300, damping: 20 } }}
            className="bg-white rounded-2xl shadow-sm hover:shadow-lg border border-gray-100 overflow-hidden transition-shadow"
          >
            {/* Card Header */}
            <div className="bg-gradient-to-r from-red-600 to-red-500 p-4 text-white">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    <Droplet className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg leading-tight">{bank.name}</h3>
                    {bank.distance_km != null && (
                      <p className="text-red-100 text-xs mt-0.5 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {bank.distance_km} km
                      </p>
                    )}
                  </div>
                </div>
                {bank.estimated_time_min != null && (
                  <div className="bg-white/20 backdrop-blur-sm rounded-lg px-2 py-1 text-center">
                    <Clock className="w-3 h-3 mx-auto mb-0.5" />
                    <span className="text-xs font-semibold">
                      {formatTime(bank.estimated_time_min)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Card Body */}
            <div className="p-4 space-y-4">
              {/* Contact & Address */}
              <div className="space-y-2">
                <p className="text-xs text-gray-500 flex items-start gap-1">
                  <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  <span className="line-clamp-2">{bank.address}</span>
                </p>
                <p className="text-xs text-blue-600 flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {bank.contact}
                </p>
              </div>

              {/* Blood Types Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {bank.blood_availability.map((a: any) => {
                  const colors = LITER_COLORS[a.blood_type] || { bg: "bg-gray-50", border: "border-gray-200", text: "text-gray-600" };
                  const low = a.available_liters < 2.0;
                  return (
                    <motion.div
                      key={a.blood_type}
                      whileHover={{ scale: 1.05 }}
                      className={`rounded-xl border-2 ${colors.border} ${colors.bg} p-2 text-center ${
                        low ? "animate-pulse" : ""
                      }`}
                    >
                      <div className={`font-bold text-sm ${colors.text}`}>{a.blood_type}</div>
                      <div className={`text-xs font-semibold mt-0.5 ${low ? "text-red-500" : "text-gray-700"}`}>
                        {a.available_liters} L
                        {low && <AlertTriangle className="w-3 h-3 inline ml-0.5" />}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Empty State */}
      <AnimatePresence>
        {banks.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-center py-12"
          >
            <div className="text-6xl mb-4">🩸</div>
            <p className="text-gray-500 text-lg">{t("bloodbank.empty")}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
