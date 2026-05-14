"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { FileText, Stethoscope, Pill, TestTube, Plus, Save, AlertTriangle, CheckCircle2, ChevronDown, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { createPrescription, getPrescriptions, updatePrescription, Prescription } from "@/lib/healthcare";

interface MedicineItem {
  name: string;
  dosage: string;
  timing: string;
  duration: string;
}

const TIMING_OPTIONS = ["Morning (8 AM)", "Afternoon (12 PM)", "Evening (6 PM)", "Night (10 PM)", "Before Meals", "After Meals", "Empty Stomach"];
const DURATION_OPTIONS = ["3 days", "5 days", "7 days", "14 days", "21 days", "30 days", "3 months", "6 months", " Ongoing"];
const TEST_OPTIONS = ["Blood Test", "Urine Test", "X-Ray", "CT Scan", "MRI", "ECG", "Echocardiography", "Sonography", "EEG", "Biopsy"];

export default function ReportTab() {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [selectedPrescription, setSelectedPrescription] = useState<Prescription | null>(null);

  // Form state
  const [doctorName, setDoctorName] = useState("");
  const [symptoms, setSymptoms] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [treatment, setTreatment] = useState("");
  const [notes, setNotes] = useState("");
  const [medicines, setMedicines] = useState<MedicineItem[]>([{ name: "", dosage: "", timing: "", duration: "" }]);
  const [suggestedTests, setSuggestedTests] = useState<string[]>([]);

  useEffect(() => {
    fetchPrescriptions();
  }, []);

  const fetchPrescriptions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const data = await getPrescriptions(user.email!);
      setPrescriptions(data.prescriptions);
    } catch (err) {
      console.error('Error fetching prescriptions:', err);
    }
  };

  const handleAddMedicine = () => {
    setMedicines([...medicines, { name: "", dosage: "", timing: "", duration: "" }]);
  };

  const handleRemoveMedicine = (index: number) => {
    setMedicines(medicines.filter((_, i) => i !== index));
  };

  const handleMedicineChange = (index: number, field: keyof MedicineItem, value: string) => {
    const updated = [...medicines];
    updated[index][field] = value;
    setMedicines(updated);
  };

  const toggleTest = (test: string) => {
    setSuggestedTests(prev => prev.includes(test) ? prev.filter(t => t !== test) : [...prev, test]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setSuccess("");

    if (!symptoms.trim()) { setError("Symptoms are required"); return; }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError("Please login to continue"); return; }

      const validMedicines = medicines.filter(m => m.name.trim());
      const prescription = {
        patient_email: user.email!,
        doctor_name: doctorName || "General Physician",
        symptoms: symptoms.trim(),
        diagnosis: diagnosis.trim() || undefined,
        treatment: treatment.trim() || undefined,
        notes: notes.trim() || undefined,
        medicines: validMedicines.length > 0 ? JSON.stringify(validMedicines) : undefined,
        suggested_tests: suggestedTests.length > 0 ? JSON.stringify(suggestedTests) : undefined,
      };

      if (selectedPrescription) {
        await updatePrescription(selectedPrescription.id, prescription);
        setSuccess("Prescription updated successfully!");
      } else {
        await createPrescription(prescription);
        setSuccess("Prescription saved successfully!");
      }

      resetForm();
      fetchPrescriptions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save prescription");
    } finally {
      setLoading(false);
    }
  };

  const editPrescription = (p: Prescription) => {
    setSelectedPrescription(p);
    setDoctorName(p.doctor_name || "");
    setSymptoms(p.symptoms || "");
    setDiagnosis(p.diagnosis || "");
    setTreatment(p.treatment || "");
    setNotes(p.notes || "");
    try {
      setMedicines(p.medicines ? JSON.parse(p.medicines) : [{ name: "", dosage: "", timing: "", duration: "" }]);
    } catch {
      setMedicines([{ name: "", dosage: "", timing: "", duration: "" }]);
    }
    try {
      setSuggestedTests(p.suggested_tests ? JSON.parse(p.suggested_tests) : []);
    } catch {
      setSuggestedTests([]);
    }
    setShowForm(true);
  };

  const resetForm = () => {
    setShowForm(false);
    setSelectedPrescription(null);
    setDoctorName(""); setSymptoms(""); setDiagnosis(""); setTreatment(""); setNotes("");
    setMedicines([{ name: "", dosage: "", timing: "", duration: "" }]);
    setSuggestedTests([]);
  };

  return (
    <div className="space-y-6">
      {/* Prescription Form */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
              <FileText className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Doctor Prescription</h2>
              <p className="text-sm text-gray-500">Add symptoms, diagnosis, and medicines</p>
            </div>
          </div>
          <button onClick={() => showForm ? resetForm() : setShowForm(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition">
            {showForm ? <><Trash2 className="w-4 h-4" />Cancel</> : <><Plus className="w-4 h-4" />New Prescription</>}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 p-3 rounded-xl"><AlertTriangle className="w-4 h-4" />{error}</div>}
            {success && <div className="flex items-center gap-2 text-emerald-700 text-sm bg-emerald-50 p-3 rounded-xl"><CheckCircle2 className="w-4 h-4" />{success}</div>}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5"><Stethoscope className="w-4 h-4 inline mr-1" />Doctor Name</label>
                <input type="text" value={doctorName} onChange={(e) => setDoctorName(e.target.value)} placeholder="Dr. Priya Sharma" className="w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 focus:border-purple-500 focus:outline-none transition" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Symptoms *</label>
                <input type="text" value={symptoms} onChange={(e) => setSymptoms(e.target.value)} placeholder="Chest pain, shortness of breath" className="w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 focus:border-purple-500 focus:outline-none transition" required />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Diagnosis</label>
              <input type="text" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} placeholder="Mild cardiac arrhythmia" className="w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 focus:border-purple-500 focus:outline-none transition" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Treatment</label>
              <textarea value={treatment} onChange={(e) => setTreatment(e.target.value)} placeholder="Prescribe rest and medication..." rows={2} className="w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 focus:border-purple-500 focus:outline-none transition resize-none" />
            </div>

            {/* Medicines */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium text-gray-700"><Pill className="w-4 h-4 inline mr-1" />Medicines</label>
                <button type="button" onClick={handleAddMedicine} className="text-sm text-purple-600 font-medium hover:text-purple-700">+ Add Medicine</button>
              </div>
              <div className="space-y-3">
                {medicines.map((med, idx) => (
                  <div key={idx} className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-gray-50 rounded-xl">
                    <input type="text" value={med.name} onChange={(e) => handleMedicineChange(idx, "name", e.target.value)} placeholder="Medicine name" className="col-span-2 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none" />
                    <input type="text" value={med.dosage} onChange={(e) => handleMedicineChange(idx, "dosage", e.target.value)} placeholder="Dosage (e.g. 500mg)" className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none" />
                    <input type="text" value={med.duration} onChange={(e) => handleMedicineChange(idx, "duration", e.target.value)} placeholder="Duration" className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none" />
                    <select value={med.timing} onChange={(e) => handleMedicineChange(idx, "timing", e.target.value)} className="col-span-2 sm:col-span-4 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none bg-white">
                      <option value="">Select timing</option>
                      {TIMING_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    {medicines.length > 1 && <button type="button" onClick={() => handleRemoveMedicine(idx)} className="col-span-2 sm:col-span-4 text-red-500 text-sm hover:text-red-700">Remove</button>}
                  </div>
                ))}
              </div>
            </div>

            {/* Suggested Tests */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2"><TestTube className="w-4 h-4 inline mr-1" />Suggested Tests</label>
              <div className="flex flex-wrap gap-2">
                {TEST_OPTIONS.map(test => (
                  <button key={test} type="button" onClick={() => toggleTest(test)} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${suggestedTests.includes(test) ? "bg-purple-100 text-purple-700 border-2 border-purple-300" : "bg-gray-100 text-gray-600 border-2 border-transparent hover:border-gray-300"}`}>
                    {test}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional notes for patient..." rows={2} className="w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 focus:border-purple-500 focus:outline-none transition resize-none" />
            </div>

            <motion.button type="submit" disabled={loading} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-purple-500 px-6 py-3 font-semibold text-white shadow-lg hover:shadow-xl transition-shadow flex items-center justify-center gap-2 disabled:opacity-50">
              {loading ? <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving...</> : <><Save className="w-5 h-5" />{selectedPrescription ? "Update Prescription" : "Save Prescription"}</>}
            </motion.button>
          </form>
        )}
      </motion.div>

      {/* Prescription History */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
            <FileText className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Prescription History</h2>
            <p className="text-sm text-gray-500">{prescriptions.length} record{prescriptions.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {prescriptions.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No prescriptions yet. Create your first prescription above!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {prescriptions.map((p) => {
              let parsedMedicines: MedicineItem[] = [];
              try { parsedMedicines = p.medicines ? JSON.parse(p.medicines) : []; } catch {}

              return (
                <motion.div key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 border border-gray-200 rounded-xl hover:border-purple-300 transition-colors">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-medium text-gray-900">{p.doctor_name || "General Physician"}</p>
                      <p className="text-sm text-gray-500">{new Date(p.created_at).toLocaleDateString()}</p>
                    </div>
                    <button onClick={() => editPrescription(p)} className="text-sm text-purple-600 font-medium hover:text-purple-700">Edit</button>
                  </div>
                  <div className="space-y-2">
                    <div className="text-sm"><span className="font-medium text-gray-700">Symptoms:</span> <span className="text-gray-600">{p.symptoms}</span></div>
                    {p.diagnosis && <div className="text-sm"><span className="font-medium text-gray-700">Diagnosis:</span> <span className="text-gray-600">{p.diagnosis}</span></div>}
                    {parsedMedicines.length > 0 && (
                      <div className="mt-2 p-2 bg-gray-50 rounded-lg">
                        <p className="text-sm font-medium text-gray-700 mb-1">Medicines:</p>
                        {parsedMedicines.map((med, i) => (
                          <div key={i} className="text-sm text-gray-600">{med.name} {med.dosage && `- ${med.dosage}`} {med.timing && `(${med.timing})`}</div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>
    </div>
  );
}
