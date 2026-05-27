"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { logout, getUsername } from "@/lib/auth";
import { Stethoscope, Menu, X } from "lucide-react";

const DOCTOR_TABS = [
  { id: "patient-info", label: "Patient Info", href: "/doctor?tab=patient-info", icon: "👤" },
  { id: "emergency", label: "Emergency", href: "/doctor?tab=emergency", icon: "🚨" },
  { id: "treatment", label: "Treatment", href: "/doctor?tab=treatment", icon: "💉" },
  { id: "dispatch", label: "Dispatch", href: "/doctor?tab=dispatch", icon: "📋" },
  { id: "appointments", label: "Appointments", href: "/doctor?tab=appointments", icon: "📅" },
  { id: "medical", label: "Medical", href: "/doctor?tab=medical", icon: "💊" },
  { id: "test", label: "All Test", href: "/doctor?tab=test", icon: "🧪" },
  { id: "hospital-info", label: "Hospital Info", href: "/doctor?tab=hospital-info", icon: "🏥" },
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
          <Link href="/doctor" className="flex items-center gap-2 sm:gap-3 group shrink-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-white/20 rounded-xl flex items-center justify-center text-white">
              <Stethoscope className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm sm:text-base text-white">Doctor Dashboard</span>
              <span className="text-[9px] sm:text-[10px] text-blue-200 -mt-0.5">Healthcare Portal</span>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-0.5 mx-2 overflow-x-auto">
            {DOCTOR_TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id, tab.href)}
                  className={`relative px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-lg whitespace-nowrap transition-all ${
                    isActive
                      ? "bg-white text-blue-600 shadow-md"
                      : "text-blue-100 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <span className="mr-1">{tab.icon}</span>
                  <span className="hidden lg:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleLogout}
              className="px-2.5 sm:px-3 py-1.5 sm:py-2 bg-white/20 hover:bg-white/30 text-white text-xs sm:text-sm font-medium rounded-lg transition"
            >
              Logout
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-white"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden py-3 border-t border-white/20">
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
          </div>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-400" />
    </motion.nav>
  );
}