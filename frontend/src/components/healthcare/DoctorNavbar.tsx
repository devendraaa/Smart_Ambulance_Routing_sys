"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { logout, getUsername } from "@/lib/auth";
import { Stethoscope, Menu, X } from "lucide-react";

const DOCTOR_TABS = [
  { id: "patient-info", label: "Patient Info", href: "/doctor?tab=patient-info", icon: "👤" },
  { id: "appointments", label: "Appointments", href: "/doctor?tab=appointments", icon: "📅" },
  { id: "medicines", label: "Medicines", href: "/doctor?tab=medicines", icon: "💊" },
  { id: "reports", label: "Reports", href: "/doctor?tab=reports", icon: "📋" },
  { id: "diet", label: "Diet Plans", href: "/doctor?tab=diet", icon: "🥗" },
];

export default function DoctorNavbar() {
  const [username, setUsername] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("patient-info");
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    setUsername(getUsername());
    const tab = searchParams.get("tab");
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const handleTabChange = (tabId: string, href: string) => {
    setActiveTab(tabId);
    router.push(href);
  };

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className="sticky top-0 z-[1000] bg-gradient-to-r from-blue-700 to-blue-500 shadow-lg"
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-4">
        <div className="flex items-center justify-between h-14 sm:h-16">
          {/* Logo */}
          <Link href="/doctor" className="flex items-center gap-2 sm:gap-3 group">
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="w-9 h-9 sm:w-10 sm:h-10 bg-white/20 rounded-xl flex items-center justify-center text-white"
            >
              <Stethoscope className="w-5 h-5 sm:w-6 sm:h-6" />
            </motion.div>
            <div className="flex flex-col">
              <span className="font-bold text-sm sm:text-base text-white">
                Doctor Dashboard
              </span>
              <span className="text-[9px] sm:text-[10px] text-blue-200 -mt-0.5 sm:mt-0">
                Healthcare Portal
              </span>
            </div>
          </Link>

          {/* Desktop Navigation - Tab Links */}
          <div className="hidden md:flex items-center gap-1">
            {DOCTOR_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id, tab.href)}
                className={`px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-lg transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? "bg-white text-blue-600 shadow-md"
                    : "text-blue-100 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span className="mr-1">{tab.icon}</span>
                <span className="hidden lg:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* User Info & Logout */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:block text-xs text-blue-200 px-2 py-1 bg-white/10 rounded-lg">
              Logged in as Doctor
            </div>
            <button
              onClick={handleLogout}
              className="px-2.5 sm:px-4 py-1.5 sm:py-2 bg-white/20 hover:bg-white/30 text-white text-xs sm:text-sm font-medium rounded-lg transition"
            >
              Logout
            </button>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-white"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden py-3 border-t border-white/20"
          >
            <div className="flex flex-col gap-1">
              {DOCTOR_TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => { handleTabChange(tab.id, tab.href); setMobileMenuOpen(false); }}
                  className={`px-3 py-2.5 text-sm font-medium rounded-lg text-left transition-all ${
                    activeTab === tab.id
                      ? "bg-white text-blue-600"
                      : "text-blue-100 hover:bg-white/10"
                  }`}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      <motion.div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-400" />
    </motion.nav>
  );
}