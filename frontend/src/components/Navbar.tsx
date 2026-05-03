"use client";

import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { logout, isLoggedIn, getUsername } from "@/lib/auth";
import { motion, AnimatePresence } from "framer-motion";

const navLinks = [
  { href: "/", label: "Home", icon: "🏠" },
  { href: "/route", label: "Route", icon: "🗺️" },
  { href: "/hospitals", label: "Hospitals", icon: "🏥" },
  { href: "/patient", label: "Patient", icon: "👤" },
  { href: "/blood-bank", label: "Blood Bank", icon: "🩸" },
];

const sensorLinks = [
  { href: "/sensor", label: "Sensor Management", icon: "📡" },
  { href: "/sensor-map", label: "Sensor Map", icon: "🗺️" },
  { href: "/map", label: "Route Map", icon: "📍" },
];

export default function Navbar() {
  const [mapLink, setMapLink] = useState("/map");
  const [loggedIn, setLoggedIn] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [sensorDropdownOpen, setSensorDropdownOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    setLoggedIn(isLoggedIn());
    setUsername(getUsername());

    const taskId = localStorage.getItem("lastTaskId");
    if (taskId) {
      setMapLink(`/map?task=${taskId}`);
    }

    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close dropdowns on click outside
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
      className={`sticky top-0 z-[1000] transition-all duration-300 relative ${
        scrolled
          ? "bg-white/80 backdrop-blur-lg shadow-lg border-b border-gray-200/50"
          : "bg-white/60 backdrop-blur-md shadow-sm border-b border-gray-100/50"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <motion.div
              whileHover={{ scale: 1.05, rotate: 5 }}
              className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-400 rounded-xl md:rounded-2xl flex items-center justify-center text-white text-xl md:text-2xl shadow-lg shadow-blue-200/50 group-hover:shadow-blue-300/50 transition-shadow duration-300"
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

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href === "/map" ? mapLink : link.href}
                className="relative px-3 py-2 text-sm font-medium text-gray-600 hover:text-blue-600 rounded-xl hover:bg-blue-50/80 transition-all duration-200 group"
              >
                <span className="hidden lg:inline">{link.label}</span>
                <span className="lg:hidden text-base">{link.icon}</span>
                <motion.div
                  className="absolute bottom-0 left-1/2 right-1/2 h-0.5 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-full"
                  initial={{ width: 0, left: "50%", right: "50%" }}
                  whileHover={{ width: "80%", left: "10%", right: "10%" }}
                  transition={{ duration: 0.2 }}
                />
              </Link>
            ))}

            {/* Sensors Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <motion.button
                whileHover={{ scale: 1.02 }}
                onClick={() => setSensorDropdownOpen(!sensorDropdownOpen)}
                className="relative px-3 py-2 text-sm font-medium text-gray-600 hover:text-blue-600 rounded-xl hover:bg-blue-50/80 transition-all duration-200 group flex items-center gap-1"
              >
                <span className="hidden lg:inline">Sensors</span>
                <span className="lg:hidden text-base">📡</span>
                <motion.svg
                  animate={{ rotate: sensorDropdownOpen ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </motion.svg>
                <motion.div
                  className="absolute bottom-0 left-1/2 right-1/2 h-0.5 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-full"
                  initial={{ width: 0, left: "50%", right: "50%" }}
                  whileHover={{ width: "80%", left: "10%", right: "10%" }}
                  transition={{ duration: 0.2 }}
                />
              </motion.button>

              {/* Dropdown Menu */}
              <AnimatePresence>
                {sensorDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="absolute top-full left-0 mt-2 w-56 bg-white/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-100/50 py-2 z-50 overflow-hidden"
                  >
                    {sensorLinks.map((link, index) => (
                      <motion.div
                        key={link.href}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <Link
                          href={link.href === "/map" ? mapLink : link.href}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gradient-to-r hover:from-blue-50 hover:to-cyan-50 hover:text-blue-600 transition-all duration-200 group/item"
                          onClick={() => setSensorDropdownOpen(false)}
                        >
                          <span className="text-base group-hover/item:scale-110 transition-transform duration-200">
                            {link.icon}
                          </span>
                          <span className="font-medium">{link.label}</span>
                          <motion.div
                            className="ml-auto opacity-0 group-hover/item:opacity-100 transition-opacity duration-200"
                            initial={{ x: -5 }}
                            whileHover={{ x: 0 }}
                          >
                            →
                          </motion.div>
                        </Link>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Auth Section */}
          <div className="hidden md:flex items-center gap-3">
            {loggedIn ? (
              <div className="relative" ref={userDropdownRef}>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border border-blue-100/50 hover:border-blue-200 transition-colors"
                >
                  <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-lg flex items-center justify-center text-white text-xs font-bold">
                    {username?.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm text-gray-700 font-medium max-w-[120px] truncate">{username}</span>
                  <motion.svg
                    animate={{ rotate: userDropdownOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </motion.svg>
                </motion.button>

                {/* User Dropdown */}
                <AnimatePresence>
                  {userDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      className="absolute top-full right-0 mt-2 w-64 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-100/50 py-2 z-50 overflow-hidden"
                    >
                      <div className="px-4 py-3 border-b border-gray-100/50">
                        <p className="text-xs text-gray-500">Signed in as</p>
                        <p className="text-sm font-medium text-gray-800 truncate">{username}</p>
                      </div>
                      <motion.button
                        whileHover={{ x: 5 }}
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Logout
                      </motion.button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Link
                  href="/login"
                  className="px-5 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 rounded-xl transition-all duration-200 shadow-md shadow-blue-200/50 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                  Login
                </Link>
              </motion.div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            className="md:hidden p-2 rounded-xl hover:bg-blue-50 text-gray-600 transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <motion.svg
              animate={{ rotate: mobileMenuOpen ? 90 : 0 }}
              transition={{ duration: 0.2 }}
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </motion.svg>
          </motion.button>
        </div>

        {/* Mobile Navigation */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="md:hidden overflow-hidden"
            >
              <div className="pb-4 border-t border-gray-100/50">
                <div className="grid grid-cols-3 gap-2 mt-4">
                  {navLinks.map((link) => (
                    <motion.div
                      key={link.href}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 }}
                    >
                      <Link
                        href={link.href === "/map" ? mapLink : link.href}
                        className="flex flex-col items-center gap-1 p-3 rounded-2xl hover:bg-gradient-to-br hover:from-blue-50 hover:to-cyan-50 text-gray-600 hover:text-blue-600 transition-all duration-200 border border-transparent hover:border-blue-100/50"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <span className="text-2xl">{link.icon}</span>
                        <span className="text-xs font-medium">{link.label}</span>
                      </Link>
                    </motion.div>
                  ))}

                  {/* Sensor Links in Mobile */}
                  {sensorLinks.map((link) => (
                    <motion.div
                      key={link.href}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                    >
                      <Link
                        href={link.href === "/map" ? mapLink : link.href}
                        className="flex flex-col items-center gap-1 p-3 rounded-2xl hover:bg-gradient-to-br hover:from-blue-50 hover:to-cyan-50 text-gray-600 hover:text-blue-600 transition-all duration-200 border border-transparent hover:border-blue-100/50"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <span className="text-2xl">{link.icon}</span>
                        <span className="text-xs font-medium">{link.label}</span>
                      </Link>
                    </motion.div>
                  ))}
                </div>

                {/* Auth in Mobile */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="mt-4 pt-4 border-t border-gray-100/50"
                >
                  {loggedIn ? (
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-2 mb-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-xl flex items-center justify-center text-white text-sm font-bold">
                          {username?.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm text-gray-700 font-medium">{username}</span>
                      </div>
                      <button
                        onClick={() => {
                          handleLogout();
                          setMobileMenuOpen(false);
                        }}
                        className="w-full px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl transition-colors border border-red-100"
                      >
                        Logout
                      </button>
                    </div>
                  ) : (
                    <Link
                      href="/login"
                      className="block w-full px-4 py-3 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 rounded-xl transition-all duration-200 text-center shadow-md shadow-blue-200/50"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Login
                    </Link>
                  )}
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Gradient bottom accent */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-600 via-cyan-400 to-blue-600 origin-left"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.5 }}
      />
    </motion.nav>
  );
}
