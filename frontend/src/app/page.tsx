"use client";

export const dynamic = "force-dynamic";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight, MapPin, Hospital, Heart, Droplets, Activity } from "lucide-react";

const features = [
  {
    icon: MapPin,
    title: "Smart Routing",
    description: "AI-powered route optimization using real-time OpenStreetMap data and OSRM routing algorithms.",
    color: "blue",
  },
  {
    icon: Hospital,
    title: "Hospital Finder",
    description: "Find nearby government hospitals with real-time bed availability and emergency room status.",
    color: "emerald",
  },
  {
    icon: Heart,
    title: "Patient Management",
    description: "Quick patient registration with emergency details, medical history, and blood type tracking.",
    color: "red",
  },
  {
    icon: Droplets,
    title: "Blood Bank Tracker",
    description: "Monitor blood availability across Mumbai with real-time inventory updates by blood type.",
    color: "purple",
  },
  {
    icon: Activity,
    title: "Sensor Network",
    description: "IoT sensor integration at road intersections for real-time traffic and emergency vehicle detection.",
    color: "amber",
  },
  {
    icon: Activity,
    title: "Real-Time Monitoring",
    description: "Track ambulance location, ETA, and route progress with live map updates and turn-by-turn directions.",
    color: "cyan",
  },
];

export default function Home() {
  return (
    <div className="min-h-[calc(100vh-8rem)]">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-hero text-white">
        <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28"
        >
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-center max-w-3xl mx-auto"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="w-20 h-20 mx-auto mb-6 bg-white/20 rounded-2xl flex items-center justify-center text-5xl backdrop-blur-sm"
            >
              🚑
            </motion.div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-4">
              Smart Ambulance
              <span className="block text-blue-200">Route System</span>
            </h1>
            <p className="text-lg sm:text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
              AI-powered emergency response system that optimizes ambulance routes
              using real-time traffic data, hospital availability, and IoT sensor networks.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/route">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-full sm:w-auto px-8 py-3.5 bg-white text-blue-700 font-semibold rounded-xl shadow-lg hover:shadow-xl transition-shadow"
                >
                  Plan Route →
                </motion.button>
              </Link>
              <Link href="/hospitals">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-full sm:w-auto px-8 py-3.5 bg-blue-500/30 text-white font-semibold rounded-xl border border-white/30 hover:bg-blue-500/50 transition-colors"
                >
                  View Hospitals
                </motion.button>
              </Link>
            </div>
          </motion.div>
        </motion.div>

        {/* Decorative bottom wave */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M0 60L48 54C96 48 192 36 288 42C384 48 480 72 576 78C672 84 768 72 864 60C960 48 1056 36 1152 42C1248 48 1344 72 1392 84L1440 96V120H1392C1344 120 1248 120 1152 120C1056 120 960 120 864 120C768 120 672 120 576 120C480 120 384 120 288 120C192 120 96 120 48 120H0V60Z"
              fill="#f8fafc"
            />
          </svg>
        </div>
      </section>

      {/* Stats Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 -mt-1">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6"
        >
          {[
            { label: "Mumbai Coverage", value: "100%", icon: "🌐" },
            { label: "Govt. Hospitals", value: "50+", icon: "🏥" },
            { label: "IoT Sensors", value: "1000+", icon: "📡" },
            { label: "Avg. Response", value: "< 8min", icon: "⚡" },
          ].map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="bg-white rounded-2xl p-4 sm:p-6 text-center shadow-sm hover:shadow-md transition-shadow border border-gray-100"
            >
              <div className="text-3xl mb-2">{stat.icon}</div>
              <div className="text-2xl sm:text-3xl font-bold text-blue-700">{stat.value}</div>
              <div className="text-xs sm:text-sm text-gray-500 mt-1">{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Features Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Everything You Need for
            <span className="text-blue-600"> Emergency Response</span>
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Comprehensive tools for ambulance dispatch, route optimization,
            and emergency resource management.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => {
            const Icon = feature.icon;
            const colorMap: Record<string, string> = {
              blue: "bg-blue-50 text-blue-600 border-blue-200",
              emerald: "bg-emerald-50 text-emerald-600 border-emerald-200",
              red: "bg-red-50 text-red-600 border-red-200",
              purple: "bg-purple-50 text-purple-600 border-purple-200",
              amber: "bg-amber-50 text-amber-600 border-amber-200",
              cyan: "bg-cyan-50 text-cyan-600 border-cyan-200",
            };
            const colors = colorMap[feature.color] || colorMap.blue;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                whileHover={{ y: -5, transition: { type: "spring", stiffness: 300 } }}
                className={`bg-white rounded-2xl p-6 shadow-sm border transition-shadow hover:shadow-lg ${colors.split(" ").slice(1).join(" ")}`}
              >
                <div className={`w-12 h-12 rounded-xl ${colors.split(" ")[0]} flex items-center justify-center mb-4`}>
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600 text-sm leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Quick Actions */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="bg-gradient-to-r from-blue-700 to-blue-500 rounded-3xl p-8 sm:p-12 text-white shadow-xl"
        >
          <div className="max-w-3xl">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4">
              Ready to Respond?
            </h2>
            <p className="text-blue-100 mb-8 text-lg">
              Get started by planning an optimal ambulance route or registering patient details for emergency dispatch.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { href: "/route", label: "Plan Route", icon: "🗺️" },
                { href: "/patient", label: "Patient Details", icon: "👤" },
                { href: "/blood-bank", label: "Blood Banks", icon: "🩸" },
              ].map((action) => (
                <Link key={action.href} href={action.href}>
                  <motion.div
                    whileHover={{ scale: 1.03, x: 5 }}
                    whileTap={{ scale: 0.97 }}
                    className="bg-white/10 backdrop-blur-sm rounded-xl p-4 flex items-center gap-3 hover:bg-white/20 transition-colors border border-white/20"
                  >
                    <span className="text-2xl">{action.icon}</span>
                    <span className="font-medium">{action.label}</span>
                    <ArrowRight className="w-4 h-4 ml-auto" />
                  </motion.div>
                </Link>
              ))}
            </div>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
