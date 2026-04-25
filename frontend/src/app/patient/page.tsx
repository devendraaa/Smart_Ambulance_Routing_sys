"use client";

import { useState, useEffect } from "react";

const EMERGENCY_REASONS = [
  { value: "Heart Attack", label: "Heart Attack" },
  { value: "Road Accident", label: "Road Accident" },
  { value: "Other", label: "Other" },
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

  // Load last saved patient
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
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-bold mb-1">Patient Details</h1>
      <p className="text-sm text-gray-500 mb-6">Enter patient information for emergency dispatch.</p>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
          <input
            type="text" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Rajesh Kumar"
            className="w-full rounded-md border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        {/* Age + Contact row */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Age *</label>
            <input
              type="number" min="1" max="150" value={age} onChange={(e) => setAge(e.target.value)}
              placeholder="e.g. 45"
              className="w-full rounded-md border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact Number *</label>
            <input
              type="tel" value={contact} onChange={(e) => setContact(e.target.value)}
              placeholder="+91 9876543210"
              className="w-full rounded-md border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
        </div>

        {/* Address */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
          <textarea
            value={address} onChange={(e) => setAddress(e.target.value)}
            placeholder="Full address of the patient/incident location"
            rows={3}
            className="w-full rounded-md border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {/* Emergency Reason + Blood Type row */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Reason *</label>
            <select
              value={reason} onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              required
            >
              <option value="">Select reason...</option>
              {EMERGENCY_REASONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Blood Type</label>
            <select
              value={bloodType} onChange={(e) => setBloodType(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {BLOOD_TYPES.map((bt) => (
                <option key={bt.value} value={bt.value}>{bt.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Error */}
        {error && <p className="text-red-600 text-sm">{error}</p>}

        {/* Success */}
        {saved && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center text-green-700">
            Patient details saved successfully!
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          className="w-full rounded-md bg-blue-600 px-4 py-2.5 font-medium text-white transition hover:bg-blue-700"
        >
          Save Patient Details
        </button>
      </form>
    </div>
  );
}
