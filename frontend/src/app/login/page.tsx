"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, User, AlertCircle, Mail, Menu, Truck, Phone } from "lucide-react";
import { signIn } from "@/lib/auth";
import { useLanguage } from "@/lib/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export default function LoginPage() {
  const { t } = useLanguage();
  const [identifier, setIdentifier] = useState(""); // email or username
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [userType, setUserType] = useState("driver"); // driver, patient, or doctor
  const router = useRouter();

  // Driver specific fields
  const [driverName, setDriverName] = useState("");
  const [driverMobile, setDriverMobile] = useState("");
  const [ambulanceNumber, setAmbulanceNumber] = useState("");

  // Load saved driver details from localStorage
  useEffect(() => {
    if (userType === "driver") {
      setDriverName(localStorage.getItem("driverName") || "");
      setDriverMobile(localStorage.getItem("driverMobile") || "");
      setAmbulanceNumber(localStorage.getItem("ambulanceNumber") || "");
    }
  }, [userType]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Validate driver fields
      if (userType === "driver") {
        if (!driverName.trim() || !driverMobile.trim() || !ambulanceNumber.trim()) {
          setError(t("driver.fillDetails"));
          setLoading(false);
          return;
        }
      }

      await signIn(identifier, password, userType);

      // Save driver details to localStorage
      if (userType === "driver") {
        if (driverName) localStorage.setItem("driverName", driverName);
        if (driverMobile) localStorage.setItem("driverMobile", driverMobile);
        if (ambulanceNumber) localStorage.setItem("ambulanceNumber", ambulanceNumber);
      }

      // Redirect based on user type
      if (userType === "patient") {
        router.push("/patient");
      } else if (userType === "doctor") {
        router.push("/doctor");
      } else {
        router.push("/");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.invalidCredentials"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="bg-white rounded-3xl shadow-xl p-6 sm:p-8 relative">
          {/* Language Switcher */}
          <div className="absolute top-4 right-4">
            <LanguageSwitcher />
          </div>
          {/* Logo */}
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 20 }}
              className="w-20 h-20 bg-gradient-to-br from-blue-600 to-blue-400 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200"
            >
              <span className="text-4xl">🚑</span>
            </motion.div>
            <h1 className="text-2xl font-bold text-gray-900">{t("brand.name")}</h1>
            <p className="text-sm text-gray-500 mt-1">{t("brand.emergency")}</p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <Menu className="w-4 h-4 inline mr-2" />
                {t("auth.loginAs")}
              </label>
              <select
                value={userType}
                onChange={(e) => setUserType(e.target.value)}
                className="w-full rounded-xl border-2 border-gray-200 px-3 py-2 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              >
                <option value="driver">Driver</option>
                <option value="patient">Patient</option>
                <option value="doctor">Doctor</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <Mail className="w-4 h-4 inline mr-2" />
                {t("auth.email")}
              </label>
              <input
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={t("auth.emailPlaceholder")}
                className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <Lock className="w-4 h-4 inline mr-2" />
                {t("auth.password")}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("auth.passwordPlaceholder")}
                className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition"
                required
              />
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 text-red-500 text-sm bg-red-50 p-3 rounded-xl"
              >
                <AlertCircle className="w-4 h-4" />
                {error}
              </motion.div>
            )}

            {/* Driver specific fields */}
            <AnimatePresence>
              {userType === "driver" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-100"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Truck className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-semibold text-blue-800">{t("driver.details")}</span>
                    <span className="text-xs text-red-500 ml-auto">{t("driver.required")}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="flex flex-col">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        <User className="w-4 h-4 inline mr-1.5" />
                        {t("driver.name")} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={driverName}
                        onChange={(e) => setDriverName(e.target.value)}
                        placeholder={t("driver.namePlaceholder")}
                        required
                        className="w-full rounded-xl border-2 border-blue-200 px-4 py-3 text-sm focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100 transition"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        <Phone className="w-4 h-4 inline mr-1.5" />
                        {t("driver.mobile")} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="tel"
                        value={driverMobile}
                        onChange={(e) => setDriverMobile(e.target.value)}
                        placeholder={t("driver.mobilePlaceholder")}
                        required
                        className="w-full rounded-xl border-2 border-blue-200 px-4 py-3 text-sm focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100 transition"
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        <Truck className="w-4 h-4 inline mr-1.5" />
                        {t("driver.vehicle")} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={ambulanceNumber}
                        onChange={(e) => setAmbulanceNumber(e.target.value)}
                        placeholder={t("driver.vehiclePlaceholder")}
                        required
                        className="w-full rounded-xl border-2 border-blue-200 px-4 py-3 text-sm focus:outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100 transition"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-blue-700 to-blue-500 px-6 py-4 font-semibold text-white text-lg shadow-lg shadow-blue-200 transition hover:shadow-xl hover:shadow-blue-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {t("auth.loggingIn")}
                </>
              ) : (
                <>
                  <Lock className="w-5 h-5" />
                  {t("auth.login")}
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-500">
            {t("auth.noAccount")}{" "}
            <a
              href="/signup"
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              {t("auth.signupLink")}
            </a>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
