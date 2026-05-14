"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { logout, getUsername } from "@/lib/auth";
import { Heart, Menu, X, ChevronDown } from "lucide-react";

const PATIENT_TABS = [
  { id: "appointment", label: "Appointment", href: "/patient?tab=appointment" },
  { id: "report", label: "Patient Report", href: "/patient?tab=report" },
  { id: "test", label: "Patient Test", href: "/patient?tab=test" },
  { id: "medicine", label: "Medicine", href: "/patient?tab=medicine" },
  { id: "ai", label: "AI Doctor", href: "/patient?tab=ai" },
  { id: "virtual", label: "Virtual Doctor", href: "/patient?tab=virtual" },
];

export default function PatientNavbar() {
  const [username, setUsername] = useState<string | null>(null);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("appointment");
  const router = useRouter();

  useEffect(() => {
    setUsername(getUsername());

    // Get current tab from URL
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab) setActiveTab(tab);
  }, []);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    router.push(`/patient?tab=${tabId}`);
  };

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className="sticky top-0 z-[1000] bg-white/90 backdrop-blur-lg shadow-sm border-b border-gray-100"
    >
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/patient" className="flex items-center gap-3 group">
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-400 rounded-xl flex items-center justify-center text-white text-xl shadow-lg shadow-emerald-200"
            >
              <Heart className="w-5 h-5" fill="white" />
            </motion.div>
            <div className="flex flex-col">
              <span className="font-bold text-base text-gray-800">
                Healthcare Portal
              </span>
              <span className="text-[10px] text-gray-500 -mt-1">
                Patient Dashboard
              </span>
            </div>
          </Link>

          {/* Desktop Navigation - Tab Links */}
          <div className="hidden lg:flex items-center gap-1">
            {PATIENT_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                  activeTab === tab.id
                    ? "text-emerald-600 bg-emerald-50"
                    : "text-gray-600 hover:text-emerald-600 hover:bg-emerald-50"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Auth Section */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-xl border border-emerald-100 hover:border-emerald-200 transition-colors"
              >
                <div className="w-7 h-7 bg-gradient-to-br from-emerald-500 to-emerald-400 rounded-lg flex items-center justify-center text-white text-xs font-bold">
                  {username?.charAt(0)?.toUpperCase() || "P"}
                </div>
                <span className="text-sm text-gray-700 font-medium max-w-[120px] truncate hidden sm:block">
                  {username}
                </span>
                <ChevronDown className={`w-3 h-3 transition-transform ${userDropdownOpen ? "rotate-180" : ""}`} />
              </motion.button>

              <AnimatePresence>
                {userDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute top-full right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50"
                  >
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="text-xs text-gray-500">Signed in as</p>
                      <p className="text-sm font-medium text-gray-800 truncate">{username}</p>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
                    >
                      Logout
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Mobile Menu Button */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 text-gray-600"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </motion.button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="lg:hidden pb-4"
            >
              <div className="grid grid-cols-2 gap-2 mt-4">
                {PATIENT_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      handleTabChange(tab.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`p-3 rounded-xl text-center text-sm font-medium transition-all ${
                      activeTab === tab.id
                        ? "text-emerald-600 bg-emerald-50"
                        : "text-gray-600 bg-gray-50 hover:bg-emerald-50"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom accent */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-500"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
      />
    </motion.nav>
  );
}
