"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { ClipboardList, Plus, Trash2, Loader2, AlertTriangle, Search, FlaskConical } from "lucide-react";
import {
  COMMON_MEDICINES,
  DOSAGE_OPTIONS,
  FREQUENCY_OPTIONS,
  TIMING_OPTIONS,
  DURATION_OPTIONS,
  ROUTE_OPTIONS,
  REFILL_OPTIONS,
} from "@/lib/medicines";

const TEST_TYPES = ["MRI", "CT Scan", "Sonography", "Blood Test", "X-Ray", "ECG", "ECHO", "TMT", "Urine Test", "Stool Test", "Thyroid", "Sugar Test", "Lipid Profile", "Liver Function", "Kidney Function"];

const SYMPTOM_MEDICINE_MAP: Record<string, string[]> = {
  fever: ["Fever & Pain", "Viral Fever"],
  temperature: ["Fever & Pain", "Viral Fever"],
  viral: ["Viral Fever", "Fever & Pain"],
  chill: ["Fever & Pain", "Viral Fever"],
  headache: ["Headache", "Fever & Pain"],
  migraine: ["Headache"],
  cough: ["Cold & Cough", "Viral Fever"],
  cold: ["Cold & Cough"],
  "runny nose": ["Cold & Cough"],
  "sore throat": ["Cold & Cough", "Viral Fever"],
  throat: ["Cold & Cough", "Antibiotics"],
  pain: ["Body Pain", "Fever & Pain"],
  ache: ["Body Pain", "Fever & Pain"],
  "body pain": ["Body Pain"],
  "joint pain": ["Body Pain", "Fever & Pain"],
  "back pain": ["Body Pain"],
  infection: ["Antibiotics"],
  bacterial: ["Antibiotics"],
  wound: ["Antibiotics", "Skin"],
  bp: ["BP & Heart"],
  "blood pressure": ["BP & Heart"],
  heart: ["BP & Heart"],
  "chest pain": ["BP & Heart"],
  palpitation: ["BP & Heart"],
  diabetes: ["Diabetes"],
  sugar: ["Diabetes"],
  nausea: ["Stomach"],
  vomiting: ["Stomach"],
  stomach: ["Stomach"],
  abdomen: ["Stomach"],
  diarrhea: ["Stomach"],
  constipation: ["Stomach"],
  gastric: ["Stomach"],
  acidity: ["Stomach"],
  allergy: ["Viral Fever", "Skin"],
  allergic: ["Viral Fever", "Skin"],
  rash: ["Skin", "Viral Fever"],
  itching: ["Skin"],
  skin: ["Skin"],
  vitamin: ["Vitamins"],
  nutrition: ["Vitamins"],
  weak: ["Vitamins"],
  fatigue: ["Vitamins", "Viral Fever"],
  dizzy: ["Headache", "BP & Heart"],
  dizziness: ["Headache", "BP & Heart"],
  asthma: ["Cold & Cough"],
  breathing: ["Cold & Cough", "BP & Heart"],
  seizure: ["Headache"],
  epilepsy: ["Headache"],
  insomnia: ["Headache"],
  anxiety: ["Headache"],
  depression: ["Headache"],
};

interface MedicineRow {
  name: string;
  dosage: string;
  frequency: string;
  timing: string;
  duration: string;
  route: string;
  instructions: string;
  is_prn: boolean;
  quantity: string;
  refills: string;
}

interface PrescriptionFormProps {
  patientEmail: string;
  patientName: string;
  hospitalName?: string;
  patientAllergies?: string;
  onSaved: () => void;
  onCancel?: () => void;
  appointmentId?: string;
  initialData?: {
    id: string;
    symptoms?: string | null;
    diagnosis?: string | null;
    prescription_notes?: string | null;
    medicines?: string | null;
    follow_up_date?: string | null;
  } | null;
}

function newRow(): MedicineRow {
  return { name: "", dosage: "", frequency: "Once daily", timing: "After meal", duration: "7 days", route: "Oral", instructions: "", is_prn: false, quantity: "", refills: "0" };
}

export default function PrescriptionForm({ patientEmail, patientName, hospitalName, patientAllergies, onSaved, onCancel, appointmentId, initialData }: PrescriptionFormProps) {
  const isEdit = !!initialData;
  const [doctorName, setDoctorName] = useState("");
  const [symptoms, setSymptoms] = useState(initialData?.symptoms || "");
  const [diagnosis, setDiagnosis] = useState(initialData?.diagnosis || "");
  const [notes, setNotes] = useState(initialData?.prescription_notes || "");
  const [followUp, setFollowUp] = useState(initialData?.follow_up_date || "");

  const [orderedTests, setOrderedTests] = useState<{ test_type: string; notes: string }[]>([]);
  const [newTestType, setNewTestType] = useState("Blood Test");
  const [newTestNotes, setNewTestNotes] = useState("");

  const [medRows, setMedRows] = useState<MedicineRow[]>(() => {
    if (initialData?.medicines) {
      try {
        const parsed = JSON.parse(initialData.medicines);
        if (Array.isArray(parsed)) {
          return parsed.map((m: any) => ({
            name: m.name || "",
            dosage: m.dosage || "",
            frequency: m.frequency || "Once daily",
            timing: m.timing || "After meal",
            duration: m.duration || "7 days",
            route: m.route || "Oral",
            instructions: m.instructions || "",
            is_prn: m.is_prn || false,
            quantity: m.quantity || "",
            refills: m.refills || "0",
          }));
        }
      } catch {}
    }
    return [];
  });

  const [saving, setSaving] = useState(false);
  const [medSearch, setMedSearch] = useState("");
  const [showMedDropdown, setShowMedDropdown] = useState(false);
  const [activeMedIdx, setActiveMedIdx] = useState(-1);
  const [duplicateWarnings, setDuplicateWarnings] = useState<string[]>([]);
  const [allergyWarnings, setAllergyWarnings] = useState<string[]>([]);
  const [prescriptionType, setPrescriptionType] = useState<"new" | "followup" | "refill">("new");
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setDoctorName(user.email);
    });
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowMedDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const addRow = () => setMedRows([...medRows, newRow()]);
  const removeRow = (i: number) => setMedRows(medRows.filter((_, idx) => idx !== i));
  const updateRow = (i: number, field: string, val: any) => {
    const rows = [...medRows];
    (rows[i] as any)[field] = val;
    setMedRows(rows);
  };

  const suggestedCategories = symptoms
    ? (() => {
        const symptomLower = symptoms.toLowerCase();
        const matched = new Set<string>();
        for (const [keyword, categories] of Object.entries(SYMPTOM_MEDICINE_MAP)) {
          if (symptomLower.includes(keyword)) {
            categories.forEach(c => matched.add(c));
          }
        }
        return matched;
      })()
    : new Set<string>();

  const filteredMeds = (() => {
    if (!medSearch.trim()) return [];
    const q = medSearch.toLowerCase();
    const matches = COMMON_MEDICINES.filter(m => m.name.toLowerCase().includes(q) || m.category.toLowerCase().includes(q));
    if (suggestedCategories.size > 0) {
      matches.sort((a, b) => {
        const aRelevant = suggestedCategories.has(a.category) ? 1 : 0;
        const bRelevant = suggestedCategories.has(b.category) ? 1 : 0;
        return bRelevant - aRelevant;
      });
    }
    return matches.slice(0, 10);
  })();

  const suggestedMeds = medSearch.trim() === "" && suggestedCategories.size > 0
    ? COMMON_MEDICINES.filter(m => suggestedCategories.has(m.category)).slice(0, 8)
    : [];

  const checkDuplicates = (): string[] => {
    const names = medRows.map(m => m.name.trim().toLowerCase()).filter(Boolean);
    const seen = new Map<string, number[]>();
    names.forEach((name, idx) => {
      if (!seen.has(name)) seen.set(name, []);
      seen.get(name)!.push(idx);
    });
    const warnings: string[] = [];
    seen.forEach((indices, name) => {
      if (indices.length > 1) {
        warnings.push(`Duplicate: "${medRows[indices[0]].name}" appears ${indices.length} times`);
      }
    });
    return warnings;
  };

  const checkAllergies = (): string[] => {
    if (!patientAllergies) return [];
    const allergyLower = patientAllergies.toLowerCase();
    const warnings: string[] = [];
    medRows.forEach(m => {
      if (!m.name.trim()) return;
      const nameLower = m.name.trim().toLowerCase();
      if (allergyLower.includes(nameLower)) {
        warnings.push(`Allergy alert: "${m.name.trim()}" may conflict with patient's known allergies`);
      }
    });
    return warnings;
  };

  const handleSave = async () => {
    if (!symptoms.trim()) { alert("Please enter symptoms"); return; }
    if (medRows.length === 0) { alert("Please add at least one medicine"); return; }

    const dups = checkDuplicates();
    const alrs = checkAllergies();
    setDuplicateWarnings(dups);
    setAllergyWarnings(alrs);
    if (dups.length > 0 || alrs.length > 0) {
      if (dups.length > 0) alert(dups.join("\n"));
      if (alrs.length > 0) alert(alrs.join("\n"));
      return;
    }

    setSaving(true);
    try {
      const medicinesJson = JSON.stringify(medRows.filter(m => m.name.trim()));

      if (isEdit && initialData?.id) {
        const res = await fetch(`http://127.0.0.1:8000/api/healthcare/doctor/prescriptions/${initialData.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            symptoms: symptoms.trim(),
            diagnosis: diagnosis.trim(),
            prescription_notes: notes.trim(),
            medicines: medicinesJson,
            follow_up_date: followUp || null,
          }),
        });
        if (!res.ok) {
          const errBody = await res.text();
          console.error("Server error:", res.status, errBody);
          throw new Error("Failed to update prescription");
        }
      } else {
        const res = await fetch("http://127.0.0.1:8000/api/healthcare/doctor/prescriptions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patient_email: patientEmail,
            patient_name: patientName,
            doctor_name: doctorName,
            hospital_name: hospitalName || "",
            symptoms: symptoms.trim(),
            diagnosis: diagnosis.trim(),
            prescription_notes: notes.trim(),
            medicines: medicinesJson,
            follow_up_date: followUp || null,
            status: prescriptionType === "refill" ? "Active" : "Active",
          }),
        });
        if (!res.ok) {
          const errBody = await res.text();
          console.error("Server error:", res.status, errBody);
          throw new Error("Failed to create prescription");
        }
      }

      if (orderedTests.length > 0) {
        const testInserts = orderedTests.map(t => ({
          patient_email: patientEmail,
          patient_name: patientName,
          hospital_name: hospitalName || null,
          appointment_id: appointmentId || null,
          test_type: t.test_type,
          notes: t.notes,
          status: "ordered",
          payment_status: "pending",
          created_at: new Date().toISOString(),
        }));
        const { error: testErr } = await supabase.from("patient_tests").insert(testInserts);
        if (testErr) {
          console.error("Error saving tests:", testErr);
          alert("Prescription saved but failed to save some tests");
        }
      }

      const validMeds = medRows.filter(m => m.name.trim());
      if (validMeds.length > 0) {
        const medicineInserts = validMeds.map(m => ({
          patient_email: patientEmail,
          patient_name: patientName,
          hospital_name: hospitalName || null,
          appointment_id: appointmentId || null,
          medicine_name: m.name,
          dosage: m.dosage,
          frequency: m.frequency,
          timing: m.timing,
          duration: m.duration,
          route: m.route,
          instructions: m.instructions,
          is_prn: m.is_prn,
          quantity: m.quantity,
          refills: m.refills,
          is_active: true,
        }));
        const { error: medErr } = await supabase.from("patient_medicines").insert(medicineInserts);
        if (medErr) {
          console.error("Error saving medicines to patient_medicines:", medErr);
        }
      }

      setSymptoms("");
      setDiagnosis("");
      setNotes("");
      setFollowUp("");
      setMedRows([]);
      setOrderedTests([]);
      setDuplicateWarnings([]);
      setAllergyWarnings([]);
      setPrescriptionType("new");
      onSaved();
    } catch (err) {
      console.error("Error saving prescription:", err);
      alert("Failed to save prescription");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
        <ClipboardList className="w-4 h-4 text-emerald-500" />
        {isEdit ? "Edit Prescription" : "New Prescription"}
      </h4>

      {/* Prescription Type (only for new) */}
      {!isEdit && (
        <div className="flex gap-2">
          {(["new", "followup", "refill"] as const).map(type => (
            <button
              key={type}
              type="button"
              onClick={() => setPrescriptionType(type)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                prescriptionType === type
                  ? "bg-emerald-100 text-emerald-700 border-emerald-300"
                  : "bg-gray-50 text-gray-600 border-gray-200 hover:border-emerald-200"
              }`}
            >
              {type === "new" ? "New" : type === "followup" ? "Follow-up" : "Refill"}
            </button>
          ))}
        </div>
      )}

      {/* Symptoms */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Symptoms <span className="text-red-500">*</span></label>
        <textarea value={symptoms} onChange={e => setSymptoms(e.target.value)} placeholder="Describe symptoms..." rows={2} className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none resize-none" />
      </div>

      {/* Diagnosis */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Diagnosis</label>
        <textarea value={diagnosis} onChange={e => setDiagnosis(e.target.value)} placeholder="Enter diagnosis..." rows={2} className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none resize-none" />
      </div>

      {/* Suggested Medicines */}
      {suggestedMeds.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">
            Suggested for symptoms <span className="text-gray-400 font-normal">(click to add)</span>
          </label>
          <div className="flex flex-wrap gap-1.5">
            {suggestedMeds.map(m => {
              const alreadyAdded = medRows.some(r => r.name.toLowerCase() === m.name.toLowerCase());
              return (
                <button
                  key={m.name}
                  type="button"
                  disabled={alreadyAdded}
                  onClick={() => {
                    if (!alreadyAdded) {
                      const r = newRow();
                      r.name = m.name;
                      setMedRows([...medRows, r]);
                    }
                  }}
                  className={`px-2.5 py-1.5 rounded-full text-xs font-medium border transition ${
                    alreadyAdded
                      ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                      : "bg-purple-100 text-purple-700 border-purple-300 hover:bg-purple-200 hover:border-purple-400"
                  }`}
                >
                  {m.name}
                  <span className="ml-1 opacity-60">({m.category})</span>
                  {alreadyAdded && <span className="ml-1">✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Medicines */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs font-medium text-gray-700">Medicines <span className="text-red-500">*</span></label>
          <button onClick={addRow} className="text-xs text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1">
            <Plus className="w-3 h-3" /> Add Medicine
          </button>
        </div>

        {duplicateWarnings.length > 0 && (
          <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded-lg flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
            <div className="text-xs text-red-700">{duplicateWarnings.map((w, i) => <p key={i}>{w}</p>)}</div>
          </div>
        )}

        {allergyWarnings.length > 0 && (
          <div className="mb-2 p-2 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-700">{allergyWarnings.map((w, i) => <p key={i}>{w}</p>)}</div>
          </div>
        )}

        {medRows.length === 0 && <p className="text-xs text-gray-400 italic py-2">Click "Add Medicine" to add medicines</p>}

        <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 space-y-2">
          {medRows.map((row, i) => (
            <div key={i} className="p-3 bg-white rounded-xl border border-purple-100 space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex-1 relative" ref={activeMedIdx === i ? searchRef : undefined}>
                  <input
                    type="text"
                    value={row.name}
                    onChange={e => { updateRow(i, "name", e.target.value); setMedSearch(e.target.value); setShowMedDropdown(true); setActiveMedIdx(i); }}
                    onFocus={() => { setMedSearch(row.name); setShowMedDropdown(true); setActiveMedIdx(i); }}
                    placeholder="Medicine name"
                    className="w-full rounded-lg border-2 border-purple-200 px-2.5 py-1.5 text-xs focus:border-purple-500 focus:outline-none"
                  />
                  {showMedDropdown && activeMedIdx === i && medSearch && filteredMeds.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border-2 border-purple-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                      {filteredMeds.map(m => (
                        <button
                          key={m.name}
                          type="button"
                          onClick={() => { updateRow(i, "name", m.name); setShowMedDropdown(false); setMedSearch(""); }}
                          className="w-full px-3 py-1.5 text-xs text-left hover:bg-purple-50"
                        >
                          {m.name} <span className="text-gray-400">({m.category})</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={() => removeRow(i)} className="p-1 text-red-500 hover:bg-red-50 rounded shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                <select value={row.dosage} onChange={e => updateRow(i, "dosage", e.target.value)} className="rounded-lg border-2 border-purple-200 px-1.5 py-1 text-xs focus:border-purple-500 focus:outline-none bg-white">
                  <option value="">Dose</option>
                  {DOSAGE_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <select value={row.frequency} onChange={e => updateRow(i, "frequency", e.target.value)} className="rounded-lg border-2 border-purple-200 px-1.5 py-1 text-xs focus:border-purple-500 focus:outline-none bg-white">
                  {FREQUENCY_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <select value={row.timing} onChange={e => updateRow(i, "timing", e.target.value)} className="rounded-lg border-2 border-purple-200 px-1.5 py-1 text-xs focus:border-purple-500 focus:outline-none bg-white">
                  {TIMING_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <select value={row.duration} onChange={e => updateRow(i, "duration", e.target.value)} className="rounded-lg border-2 border-purple-200 px-1.5 py-1 text-xs focus:border-purple-500 focus:outline-none bg-white">
                  {DURATION_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <select value={row.route} onChange={e => updateRow(i, "route", e.target.value)} className="rounded-lg border-2 border-purple-200 px-1.5 py-1 text-xs focus:border-purple-500 focus:outline-none bg-white">
                  {ROUTE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={row.quantity}
                    onChange={e => updateRow(i, "quantity", e.target.value)}
                    placeholder="Qty (e.g. 30 tabs)"
                    className="w-full rounded-lg border-2 border-purple-200 px-2 py-1 text-xs focus:border-purple-500 focus:outline-none"
                  />
                </div>
                <select value={row.refills} onChange={e => updateRow(i, "refills", e.target.value)} className="rounded-lg border-2 border-purple-200 px-1.5 py-1 text-xs focus:border-purple-500 focus:outline-none bg-white">
                  {REFILL_OPTIONS.map(r => <option key={r} value={r}>Refills: {r}</option>)}
                </select>
                <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={row.is_prn}
                    onChange={e => updateRow(i, "is_prn", e.target.checked)}
                    className="w-3.5 h-3.5 text-purple-600 border-gray-300 rounded"
                  />
                  Take as needed (PRN)
                </label>
              </div>

              <div>
                <input
                  type="text"
                  value={row.instructions}
                  onChange={e => updateRow(i, "instructions", e.target.value)}
                  placeholder="Instructions (e.g., Take with food, Avoid alcohol, Complete the course)"
                  className="w-full rounded-lg border-2 border-purple-200 px-2.5 py-1.5 text-xs focus:border-purple-500 focus:outline-none"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tests */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs font-medium text-gray-700">Order Tests</label>
        </div>
        <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 space-y-2">
          <div className="flex items-center gap-2">
            <select
              value={newTestType}
              onChange={e => setNewTestType(e.target.value)}
              className="flex-1 rounded-lg border-2 border-purple-200 px-2.5 py-2 text-xs focus:border-purple-500 focus:outline-none bg-white"
            >
              {TEST_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input
              type="text"
              value={newTestNotes}
              onChange={e => setNewTestNotes(e.target.value)}
              placeholder="Notes"
              className="flex-1 rounded-lg border-2 border-purple-200 px-2.5 py-2 text-xs focus:border-purple-500 focus:outline-none bg-white"
            />
            <button
              type="button"
              onClick={() => {
                if (!orderedTests.find(t => t.test_type === newTestType)) {
                  setOrderedTests([...orderedTests, { test_type: newTestType, notes: newTestNotes }]);
                  setNewTestNotes("");
                }
              }}
              className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-medium flex items-center gap-1 shrink-0"
            >
              <Plus className="w-3 h-3" /> Add
            </button>
          </div>
          {orderedTests.length > 0 && (
            <div className="space-y-1.5">
              {orderedTests.map((t, i) => (
                <div key={i} className="flex items-center justify-between gap-2 bg-white rounded-lg px-3 py-2 border border-purple-100">
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium text-purple-800">{t.test_type}</span>
                    {t.notes && <span className="text-[10px] text-gray-500 ml-2">- {t.notes}</span>}
                  </div>
                  <button onClick={() => setOrderedTests(orderedTests.filter((_, idx) => idx !== i))} className="p-1 text-red-500 hover:bg-red-50 rounded shrink-0">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {orderedTests.length === 0 && <p className="text-xs text-gray-400 italic">No tests ordered yet</p>}
        </div>
      </div>

      {/* Follow-up + Notes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Follow-up Date</label>
          <input type="date" value={followUp} onChange={e => setFollowUp(e.target.value)} className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Additional notes..." rows={2} className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none resize-none" />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        {onCancel && (
          <button onClick={onCancel} className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium text-sm transition">
            Cancel
          </button>
        )}
        <button onClick={handleSave} disabled={saving} className={`${onCancel ? "flex-1" : "w-full"} px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition`}>
          {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><ClipboardList className="w-4 h-4" /> {isEdit ? "Update Prescription" : "Save Prescription"}</>}
        </button>
      </div>
    </div>
  );
}
