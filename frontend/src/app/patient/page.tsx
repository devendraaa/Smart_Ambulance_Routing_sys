"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, Calendar, MapPin, Phone, AlertTriangle, Droplet, CheckCircle2, AlertCircle, Heart } from "lucide-react";

const EMERGENCY_REASONS = [
  { value: "Heart Attack", label: "Heart Attack", icon: "🩺" },
  { value: "Road Accident", label: "Road Accident", icon: "🚗" },
  { value: "Other", label: "Other Emergency", icon: "🚨" },
];

const BLOOD_TYPES = [
  { value: "", label: "Not sure" },
  { value: "A+", label: "A+" },
  { value: "A-", label: "A-" },
  { value: "B+", label: "B+" },
  { value: "B-", label: "B-" },
  { value: "AB+", label: "AB+" },
  { value: "AB-", label: "AB-" },
  { value: "O+", label: "O+" },
  { value: "O-", label: "O-" },
];

export default function PatientPage() {
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [address, setAddress] = useState("");
  const [contact, setContact] = useState("");
  const [reason, setReason] = useState("");
  const [bloodType, setBloodType] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [focusedField, setFocusedField] = useState<string | null>(null);

  useEffect(() => {
    try {
      const data = localStorage.getItem("patientData");
      if (data) {
        const p = JSON.parse(data);
        setName(p.name || "");
        setAge(p.age || "");
        setAddress(p.address || "");
        setContact(p.contact || "");
        setReason(p.reason || "");
        setBloodType(p.bloodType || "");
      }
    } catch {}
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) { setError("Patient name is required"); return; }
    if (!age.trim() || parseInt(age) < 1 || parseInt(age) > 150) { setError("Enter a valid age (1-150)"); return; }
    if (!contact.trim() || contact.replace(/\D/g, "").length < 10) { setError("Enter a valid contact number"); return; }

    const patient = { name, age, address, contact, reason, bloodType, timestamp: new Date().toISOString() };
    localStorage.setItem("patientData", JSON.stringify(patient));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-[calc(100vh-8rem)] flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 25 }}
        className="w-full max-w-2xl"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="w-20 h-20 bg-gradient-to-br from-red-500 to-red-400 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-red-200"
          >
            <Heart className="w-10 h-10 text-white" fill="white" />
          </motion.div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Patient Details</h1>
          <p className="text-gray-500">Enter patient information for emergency dispatch</p>
        </div>

        {/* Form Card */}
        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6 sm:p-8 space-y-6"
        >
          {/* Name & Age Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <motion.div whileHover={{ y: -2 }} transition={{ type: "spring", stiffness: 400 }}>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <User className="w-4 h-4 inline mr-1" />
                Full Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onFocus={() => setFocusedField("name")}
                onBlur={() => setFocusedField(null)}
                placeholder="e.g. Rajesh Kumar"
                className={`w-full rounded-xl border-2 px-4 py-3 transition input-focus ${
                  focusedField === "name" ? "border-blue-500 ring-4 ring-blue-100" : "border-gray-200"
                }`}
                required
              />
            </motion.div>

            <motion.div whileHover={{ y: -2 }} transition={{ type: "spring", stiffness: 400 }}>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                Age *
              </label>
              <input
                type="number"
                min="1"
                max="150"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                onFocus={() => setFocusedField("age")}
                onBlur={() => setFocusedField(null)}
                placeholder="e.g. 45"
                className={`w-full rounded-xl border-2 px-4 py-3 transition input-focus ${
                  focusedField === "age" ? "border-blue-500 ring-4 ring-blue-100" : "border-gray-200"
                }`}
                required
              />
            </motion.div>
          </div>

          {/* Contact & Address */}
          <motion.div whileHover={{ y: -2 }} transition={{ type: "spring", stiffness: 400 }}>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <Phone className="w-4 h-4 inline mr-1" />
              Contact Number *
            </label>
            <input
              type="tel"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              onFocus={() => setFocusedField("contact")}
              onBlur={() => setFocusedField(null)}
              placeholder="+91 9876543210"
              className={`w-full rounded-xl border-2 px-4 py-3 transition input-focus ${
                focusedField === "contact" ? "border-blue-500 ring-4 ring-blue-100" : "border-gray-200"
              }`}
              required
            />
          </motion.div>

          <motion.div whileHover={{ y: -2 }} transition={{ type: "spring", stiffness: 400 }}>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <MapPin className="w-4 h-4 inline mr-1" />
              Address
            </label>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Full address of the patient/incident location"
              rows={3}
              className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100 transition resize-none"
            />
          </motion.div>

          {/* Emergency Reason & Blood Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <motion.div whileHover={{ y: -2 }} transition={{ type: "spring", stiffness: 400 }}>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <AlertTriangle className="w-4 h-4 inline mr-1" />
                Emergency Reason *
              </label>
              <div className="grid grid-cols-3 gap-2">
                {EMERGENCY_REASONS.map((r) => (
                  <motion.button
                    key={r.value}
                    type="button"
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setReason(r.value)}
                    className={`p-3 rounded-xl border-2 transition text-sm ${
                      reason === r.value
                        ? "border-red-500 bg-red-50 text-red-700"
                        : "border-gray-200 hover:border-gray-300 text-gray-600"
                    }`}
                  >
                    <div className="text-xl mb-1">{r.icon}</div>
                    <div className="font-medium">{r.label}</div>
                  </motion.button>
                ))}
              </div>
            </motion.div>

            <motion.div whileHover={{ y: -2 }} transition={{ type: "spring", stiffness: 400 }}>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <Droplet className="w-4 h-4 inline mr-1" />
                Blood Type
              </label>
              <select
                value={bloodType}
                onChange={(e) => setBloodType(e.target.value)}
                className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100 transition bg-white"
              >
                {BLOOD_TYPES.map((bt) => (
                  <option key={bt.value} value={bt.value}>{bt.label}</option>
                ))}
              </select>
            </motion.div>
          </div>

          {/* Error Message */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Success Message */}
          <AnimatePresence>
            {saved && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex items-center gap-2 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-medium">Patient details saved successfully!</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Submit Button */}
          <motion.button
            type="submit"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className="w-full rounded-xl bg-gradient-to-r from-red-600 to-red-500 px-6 py-4 font-semibold text-white text-lg shadow-lg shadow-red-200 hover:shadow-xl hover:shadow-red-300 transition-shadow flex items-center justify-center gap-2"
          >
            <Heart className="w-5 h-5" />
            Save Patient Details
          </motion.button>
        </motion.form>
      </motion.div>
    </motion.div>
  );
}
