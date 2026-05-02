"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Upload, CheckCircle2, AlertCircle, Trash2, FileSpreadsheet } from "lucide-react";
import { addSensor, uploadSensorsCSV, fetchManualSensors } from "@/lib/api";

type ManualSensor = {
  id: string;
  latitude: number;
  longitude: number;
  degree?: number;
  created_at?: string;
};

export default function SensorPage() {
  const [sensors, setSensors] = useState<ManualSensor[]>([]);
  const [loading, setLoading] = useState(true);

  // Manual input form
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [degree, setDegree] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [formMsg, setFormMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // CSV upload
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvLoading, setCsvLoading] = useState(false);
  const [csvMsg, setCsvMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadSensors = async () => {
    try {
      const data = await fetchManualSensors();
      setSensors(data);
    } catch (err) {
      console.error("Failed to fetch sensors:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSensors();
  }, []);

  const handleAddSensor = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormMsg(null);

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);
    const degreeVal = degree.trim() ? parseFloat(degree) : undefined;

    if (isNaN(latitude) || isNaN(longitude)) {
      setFormMsg({ type: "error", text: "Please enter valid latitude and longitude" });
      return;
    }

    setFormLoading(true);
    try {
      const payload: { latitude: number; longitude: number; degree?: number } = {
        latitude,
        longitude,
      };
      if (degreeVal !== undefined) payload.degree = degreeVal;

      await addSensor(payload);
      setFormMsg({ type: "success", text: "Sensor added successfully!" });
      setLat("");
      setLon("");
      setDegree("");
      loadSensors();
    } catch (err) {
      setFormMsg({ type: "error", text: "Failed to add sensor. Please try again." });
    } finally {
      setFormLoading(false);
    }
  };

  const handleCSVUpload = async () => {
    if (!csvFile) {
      setCsvMsg({ type: "error", text: "Please select a CSV file first" });
      return;
    }

    setCsvLoading(true);
    setCsvMsg(null);

    try {
      const text = await csvFile.text();
      const result = await uploadSensorsCSV(text);
      setCsvMsg({ type: "success", text: result.message });
      setCsvFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      loadSensors();
    } catch (err: any) {
      setCsvMsg({ type: "error", text: err.message || "Failed to upload CSV" });
    } finally {
      setCsvLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith(".csv")) {
        setCsvMsg({ type: "error", text: "Please upload a CSV file" });
        return;
      }
      setCsvFile(file);
      setCsvMsg(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-3xl mx-auto p-6 py-8"
    >
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Sensor Management</h1>
        <p className="text-gray-500">Add sensors manually or upload CSV file</p>
      </motion.div>

      {/* Manual Input Form */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
            <MapPin className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Add Single Sensor</h3>
            <p className="text-sm text-gray-500">Enter sensor coordinates manually</p>
          </div>
        </div>

        <form onSubmit={handleAddSensor} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Latitude <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="any"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                placeholder="e.g. 19.0760"
                className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Longitude <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="any"
                value={lon}
                onChange={(e) => setLon(e.target.value)}
                placeholder="e.g. 72.8777"
                className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Degree <span className="text-gray-400">(optional)</span>
              </label>
              <input
                type="number"
                step="any"
                value={degree}
                onChange={(e) => setDegree(e.target.value)}
                placeholder="e.g. 45"
                className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition"
              />
            </div>
          </div>

          <AnimatePresence>
            {formMsg && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className={`p-3 rounded-xl text-sm flex items-center gap-2 ${
                  formMsg.type === "error"
                    ? "bg-red-50 text-red-700 border border-red-200"
                    : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                }`}
              >
                {formMsg.type === "error" ? (
                  <AlertCircle className="w-4 h-4" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                {formMsg.text}
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            type="submit"
            disabled={formLoading}
            whileHover={{ scale: formLoading ? 1 : 1.02 }}
            whileTap={{ scale: formLoading ? 1 : 0.98 }}
            className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-3.5 text-white font-medium shadow-lg shadow-blue-200 hover:shadow-xl transition-shadow disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {formLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Adding Sensor...
              </>
            ) : (
              <>
                <MapPin className="w-5 h-5" />
                Add Sensor
              </>
            )}
          </motion.button>
        </form>
      </motion.div>

      {/* CSV Upload */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
            <FileSpreadsheet className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Upload CSV File</h3>
            <p className="text-sm text-gray-500">Bulk upload sensors from CSV (lat, long, degree)</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-purple-400 transition-colors">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
              id="csv-upload"
            />
            <label htmlFor="csv-upload" className="cursor-pointer">
              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600">
                {csvFile ? csvFile.name : "Click to upload or drag and drop"}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                CSV format: latitude, longitude, degree (degree is optional)
              </p>
            </label>
          </div>

          <AnimatePresence>
            {csvMsg && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className={`p-3 rounded-xl text-sm flex items-center gap-2 ${
                  csvMsg.type === "error"
                    ? "bg-red-50 text-red-700 border border-red-200"
                    : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                }`}
              >
                {csvMsg.type === "error" ? (
                  <AlertCircle className="w-4 h-4" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                {csvMsg.text}
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            onClick={handleCSVUpload}
            disabled={csvLoading || !csvFile}
            whileHover={{ scale: csvLoading || !csvFile ? 1 : 1.02 }}
            whileTap={{ scale: csvLoading || !csvFile ? 1 : 0.98 }}
            className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-purple-500 px-6 py-3.5 text-white font-medium shadow-lg shadow-purple-200 hover:shadow-xl transition-shadow disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {csvLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                Upload CSV
              </>
            )}
          </motion.button>
        </div>
      </motion.div>

      {/* Sensor List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
      >
        <div className="p-6 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">
            Added Sensors
            <span className="ml-2 text-sm font-normal text-gray-500">
              ({sensors.length} sensors)
            </span>
          </h3>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-500">Loading sensors...</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
            {sensors.map((s, i) => (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className="p-4 hover:bg-blue-50/50 transition-colors flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                    <MapPin className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <div className="font-mono text-sm text-gray-800">
                      {s.latitude.toFixed(5)}, {s.longitude.toFixed(5)}
                    </div>
                    {s.degree !== undefined && (
                      <div className="text-xs text-gray-500">Degree: {s.degree}°</div>
                    )}
                  </div>
                </div>
                <span className="text-xs text-gray-400 font-mono">
                  #{i + 1}
                </span>
              </motion.div>
            ))}
            {sensors.length === 0 && (
              <div className="p-8 text-center text-gray-400">
                <MapPin className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p>No sensors added yet.</p>
                <p className="text-xs mt-1">Use the form above to add sensors.</p>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
