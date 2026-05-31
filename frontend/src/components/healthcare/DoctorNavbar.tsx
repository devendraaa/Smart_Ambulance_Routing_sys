"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { logout, getUsername } from "@/lib/auth";
import {
  Stethoscope, Menu, X, Ambulance, User, Activity, Calendar,
  Pill, FlaskConical, ClipboardList, Building2, LogOut
} from "lucide-react";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useLanguage } from "@/lib/LanguageContext";

const DOCTOR_TABS = [
  { id: "emergency", labelKey: "doctor.emergency", href: "/doctor?tab=emergency", icon: Ambulance },
  { id: "patient-info", labelKey: "doctor.patientInfo", href: "/doctor?tab=patient-info", icon: User },
  { id: "treatment", labelKey: "doctor.treatment", href: "/doctor?tab=treatment", icon: Activity },
  { id: "appointments", labelKey: "doctor.appointments", href: "/doctor?tab=appointments", icon: Calendar },
  { id: "medical", labelKey: "doctor.medical", href: "/doctor?tab=medical", icon: Pill },
  { id: "test", labelKey: "doctor.allTest", href: "/doctor?tab=test", icon: FlaskConical },
  { id: "dispatch", labelKey: "doctor.dispatch", href: "/doctor?tab=dispatch", icon: ClipboardList },
  { id: "hospital-info", labelKey: "doctor.hospitalInfo", href: "/doctor?tab=hospital-info", icon: Building2 },
];

export default function DoctorNavbar() {
  const { t } = useLanguage();
  const [username, setUsername] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("emergency");
  const router = useRouter();

  useEffect(() => {
    setUsername(getUsername());
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab) setActiveTab(tab);
  }, []);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const handleTabChange = (tabId: string, href: string) => {
    setActiveTab(tabId);
    setMobileMenuOpen(false);
    router.push(href);
  };

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className="sticky top-0 z-[1000] bg-gradient-to-r from-blue-700 to-blue-500 shadow-lg"
    >
      <div className="max-w-7xl mx-auto px-2 sm:px-4">
        <div className="flex items-center justify-between h-14 sm:h-16">
          <Link href="/doctor" className="flex items-center gap-2 sm:gap-3 group shrink-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-white/20 rounded-xl flex items-center justify-center text-white group-hover:bg-white/30 transition">
              <Stethoscope className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm sm:text-base text-white">{t("doctor.brand")}</span>
              <span className="text-[9px] sm:text-[10px] text-blue-200 -mt-0.5 hidden xs:block">{t("doctor.subtitle")}</span>
            </div>
          </Link>

          <div className="hidden md:flex items-center justify-center flex-1 gap-0.5 mx-1">
            {DOCTOR_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id, tab.href)}
                  className={`relative flex items-center gap-1 px-2 lg:px-2.5 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    isActive
                      ? "bg-white text-blue-700 shadow-md"
                      : "text-blue-100 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="hidden xl:inline">{t(tab.labelKey)}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <LanguageSwitcher theme="dark" />
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 bg-white/20 hover:bg-white/30 text-white text-xs sm:text-sm font-medium rounded-lg transition"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">{t("auth.logout")}</span>
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-white hover:bg-white/10 rounded-lg transition"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden overflow-hidden border-t border-white/20"
            >
              <div className="py-2 space-y-0.5">
                {DOCTOR_TABS.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => handleTabChange(tab.id, tab.href)}
                      className={`flex items-center gap-3 w-full px-3 py-2.5 text-sm font-medium rounded-lg transition-all ${
                        isActive
                          ? "bg-white text-blue-700"
                          : "text-blue-100 hover:bg-white/10"
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {t(tab.labelKey)}
                    </button>
                  );
                })}
                <div className="border-t border-white/10 pt-2 mt-2">
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 w-full px-3 py-2.5 text-sm font-medium text-red-200 hover:bg-white/10 rounded-lg transition"
                  >
                    <LogOut className="w-4 h-4" />
                    {t("auth.logout")}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-400" />
    </motion.nav>
  );
}
