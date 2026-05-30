"use client";

import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { logout, isLoggedIn, getUsername, getUserType } from "@/lib/auth";
import { motion, AnimatePresence } from "framer-motion";
import PatientNavbar from "@/components/healthcare/PatientNavbar";
import DoctorNavbar from "@/components/healthcare/DoctorNavbar";

// Driver nav links
const navLinks = [
  { href: "/", label: "Home", icon: "🏠" },
  { href: "/route", label: "Route", icon: "🗺️" },
  { href: "/hospitals", label: "Hospitals", icon: "🏥" },
  { href: "/blood-bank", label: "Blood Bank", icon: "🩸" },

];

const baseSensorLinks = [
  { href: "/sensor", label: "Sensor Management", icon: "📡" },
  { href: "/sensor-map", label: "Sensor Map", icon: "🗺️" },
  { href: "/installed-sensors", label: "Installed Sensors", icon: "📍" },
];

// Doctor nav links
const doctorNavLinks = [
  { href: "/doctor?tab=patient-info", label: "Patient Info", icon: "👤" },
  { href: "/doctor?tab=appointments", label: "Appointments", icon: "📅" },
  { href: "/doctor?tab=medicines", label: "Medicines", icon: "💊" },
  { href: "/doctor?tab=reports", label: "Reports", icon: "📋" },
  { href: "/doctor?tab=diet", label: "Diet", icon: "🥗" },
];

function DriverNavbar() {
  const [mapLink, setMapLink] = useState("/map");
  const [ambLocationLink, setAmbLocationLink] = useState("/amb-location");
  const [loggedIn, setLoggedIn] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [sensorDropdownOpen, setSensorDropdownOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const sensorLinks = [
    ...baseSensorLinks,
    { href: ambLocationLink, label: "Amb Location", icon: "📍" },
  ];

  useEffect(() => {
    setLoggedIn(isLoggedIn());
    setUsername(getUsername());

    const taskId = localStorage.getItem("lastTaskId");
    if (taskId) {
      setMapLink(`/map?task=${taskId}`);
      setAmbLocationLink(`/amb-location?task=${taskId}`);
    }

    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setSensorDropdownOpen(false);
      }
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target as Node)) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    setLoggedIn(false);
    setUsername(null);
    setUserDropdownOpen(false);
    router.push("/login");
  };

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className={`sticky top-0 z-[1000] transition-all duration-300 ${
        scrolled
          ? "bg-white/80 backdrop-blur-lg shadow-lg border-b border-gray-200/50"
          : "bg-white/60 backdrop-blur-md shadow-sm border-b border-gray-100/50"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">

          <Link href="/" className="flex items-center gap-3 group">
            <motion.div
              whileHover={{ scale: 1.05, rotate: 5 }}
              className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-400 rounded-xl md:rounded-2xl flex items-center justify-center text-white text-xl md:text-2xl shadow-lg shadow-blue-200/50"
            >
              🚑
            </motion.div>
            <div className="flex flex-col">
              <span className="font-bold text-base md:text-lg bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-500 bg-clip-text text-transparent">
                Smart Ambulance
              </span>
              <span className="text-[9px] md:text-[10px] text-gray-500 -mt-1 font-medium">
                Emergency Response
              </span>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="relative px-3 py-2 text-sm font-medium text-gray-600 hover:text-blue-600 rounded-xl hover:bg-blue-50/80 transition-all"
              >
                <span className="hidden lg:inline">{link.label}</span>
                <span className="lg:hidden text-base">{link.icon}</span>
              </Link>
            ))}

            <div className="relative" ref={dropdownRef}>
              <motion.button
                whileHover={{ scale: 1.02 }}
                onClick={() => setSensorDropdownOpen(!sensorDropdownOpen)}
                className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-blue-600 rounded-xl hover:bg-blue-50/80 transition-all flex items-center gap-1"
              >
                <span className="hidden lg:inline">Sensors</span>
                <span className="lg:hidden text-base">📡</span>
                <svg className={`w-3 h-3 transition-transform ${sensorDropdownOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </motion.button>

              <AnimatePresence>
                {sensorDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute top-full left-0 mt-2 w-56 bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-100/50 py-2 z-50"
                  >
                    {sensorLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setSensorDropdownOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-all"
                      >
                        <span className="text-base">{link.icon}</span>
                        <span className="font-medium">{link.label}</span>
                      </Link>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-3">
            {loggedIn ? (
              <div className="relative" ref={userDropdownRef}>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border border-blue-100/50"
                >
                  <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-lg flex items-center justify-center text-white text-xs font-bold">
                    {username?.charAt(0)?.toUpperCase() || "U"}
                  </div>
                  <span className="text-sm text-gray-700 font-medium max-w-[120px] truncate">{username}</span>
                </motion.button>

                <AnimatePresence>
                  {userDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute top-full right-0 mt-2 w-64 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-100/50 py-2 z-50"
                    >
                      <div className="px-4 py-3 border-b border-gray-100/50">
                        <p className="text-xs text-gray-500">Signed in as</p>
                        <p className="text-sm font-medium text-gray-800 truncate">{username}</p>
                      </div>
                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                      >
                        Logout
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <Link href="/login" className="px-5 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 rounded-xl flex items-center gap-2">
                Login
              </Link>
            )}
          </div>

          <motion.button
            whileTap={{ scale: 0.9 }}
            className="md:hidden p-2 rounded-xl hover:bg-blue-50 text-gray-600"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </motion.button>
        </div>

        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden overflow-hidden pb-4"
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4">
                {navLinks.map((link) => (
                  <Link key={link.href} href={link.href} onClick={() => setMobileMenuOpen(false)}
                    className="flex flex-col items-center gap-1 p-3 rounded-2xl hover:bg-blue-50 text-gray-600">
                    <span className="text-2xl">{link.icon}</span>
                    <span className="text-xs font-medium leading-tight text-center">{link.label}</span>
                  </Link>
                ))}
                {sensorLinks.map((link) => (
                  <Link key={link.href} href={link.href} onClick={() => setMobileMenuOpen(false)}
                    className="flex flex-col items-center gap-1 p-3 rounded-2xl hover:bg-blue-50 text-gray-600">
                    <span className="text-2xl">{link.icon}</span>
                    <span className="text-xs font-medium leading-tight text-center">{link.label}</span>
                  </Link>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200/50">
                {loggedIn ? (
                  <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-lg flex items-center justify-center text-white text-xs font-bold">
                        {username?.charAt(0)?.toUpperCase() || "U"}
                      </div>
                      <span className="text-sm text-gray-700 font-medium truncate">{username}</span>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl flex items-center gap-2"
                    >
                      Logout
                    </button>
                  </div>
                ) : (
                  <Link href="/login" onClick={() => setMobileMenuOpen(false)}
                    className="block w-full text-center px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 rounded-xl">
                    Login
                  </Link>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <motion.div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-600 via-cyan-400 to-blue-600" />
    </motion.nav>
  );
}

export default function Navbar() {
  const pathname = usePathname();

  // No navbar on login/signup pages
  if (pathname === "/login" || pathname === "/signup") {
    return null;
  }

  // Patient pages use PatientNavbar
  if (pathname === "/patient" || pathname?.startsWith("/patient")) {
    return <PatientNavbar />;
  }

  // Doctor pages use DoctorNavbar
  if (pathname === "/doctor" || pathname?.startsWith("/doctor")) {
    return <DoctorNavbar />;
  }

  return <DriverNavbar />;
}
