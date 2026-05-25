"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Activity, Loader2, AlertTriangle } from "lucide-react";

const COMMON_SYMPTOMS = [
  "Fever", "Headache", "Cough", "Cold/Runny Nose", "Sore Throat",
  "Nausea/Vomiting", "Diarrhea", "Constipation", "Dizziness", "Fatigue/Weakness",
  "Chest Pain", "Shortness of Breath", "Abdominal Pain", "Back Pain", "Joint Pain",
  "Skin Rash", "Eye Redness", "Ear Pain", "Loss of Appetite", "Night Sweats",
  "Weight Loss", "Swelling/Edema", "Numbness/Tingling", "Palpitations"
];

const EMERGENCY_INDICATORS = [
  { value: "chest_pain", label: "Chest Pain" },
  { value: "shortness_of_breath", label: "Shortness of Breath" },
  { value: "severe_headache", label: "Severe Headache" },
  { value: "loss_of_consciousness", label: "Loss of Consciousness" },
  { value: "severe_abdominal_pain", label: "Severe Abdominal Pain" },
  { value: "bleeding", label: "Active Bleeding" },
  { value: "high_fever", label: "High Fever (>103\u00b0F)" },
  { value: "seizure", label: "Seizure" },
];

const COMMON_DISEASES = [
  "Diabetes", "Hypertension", "Asthma", "Thyroid Disorder",
  "Heart Disease", "Kidney Disease", "Liver Disease", "Cancer",
  "Arthritis", "COPD", "Tuberculosis", "Epilepsy",
  "Mental Health Condition", "Anemia", "None"
];

const DURATION_PRESETS = [
  { label: "Today", value: "Less than 24 hours" },
  { label: "2-3 days", value: "2-3 days" },
  { label: "1 week", value: "1 week" },
  { label: "2 weeks", value: "2 weeks" },
  { label: "1 month", value: "1 month" },
  { label: "3+ months", value: "3+ months" },
];

const SEVERITY_LABELS = [
  { range: [0, 0], label: "None", color: "bg-gray-400" },
  { range: [1, 3], label: "Mild", color: "bg-yellow-400" },
  { range: [4, 6], label: "Moderate", color: "bg-orange-400" },
  { range: [7, 9], label: "Severe", color: "bg-red-500" },
  { range: [10, 10], label: "Critical", color: "bg-red-700" },
];

const PAIN_DESCRIPTORS = [
  { score: 0, label: "No Pain", emoji: "?" },
  { score: 2, label: "Mild", emoji: "?" },
  { score: 4, label: "Moderate", emoji: "?" },
  { score: 6, label: "Severe", emoji: "?" },
  { score: 8, label: "Very Severe", emoji: "?" },
  { score: 10, label: "Worst Possible", emoji: "?" },
];

function getSeverityLabel(level: number): string {
  if (level === 0) return "None";
  if (level <= 3) return "Mild";
  if (level <= 6) return "Moderate";
  if (level <= 9) return "Severe";
  return "Critical";
}

function getSeverityColor(level: number): string {
  if (level === 0) return "bg-gray-400";
  if (level <= 3) return "bg-yellow-400";
  if (level <= 6) return "bg-orange-400";
  if (level <= 9) return "bg-red-500";
  return "bg-red-700";
}

function getBmiCategory(bmi: number): { label: string; color: string } {
  if (bmi < 18.5) return { label: "Underweight", color: "text-blue-600" };
  if (bmi < 25) return { label: "Normal", color: "text-green-600" };
  if (bmi < 30) return { label: "Overweight", color: "text-yellow-600" };
  if (bmi < 35) return { label: "Obese Class I", color: "text-orange-600" };
  if (bmi < 40) return { label: "Obese Class II", color: "text-red-600" };
  return { label: "Obese Class III", color: "text-red-800" };
}

function getVitalRangeColor(value: number | null, min: number, max: number, criticalMin?: number, criticalMax?: number): string {
  if (value === null) return "border-gray-200";
  if (criticalMin !== undefined && value < criticalMin) return "border-red-500 bg-red-50";
  if (criticalMax !== undefined && value > criticalMax) return "border-red-500 bg-red-50";
  if (value < min || value > max) return "border-orange-400 bg-orange-50";
  return "border-green-400 bg-green-50/30";
}

function getVitalRangeText(value: number | null, min: number, max: number, unit: string): string {
  if (value === null) return `Normal: ${min}\u2013${max} ${unit}`;
  if (value >= min && value <= max) return `\u2713 Normal (${min}\u2013${max} ${unit})`;
  if (value < min) return `\u2193 Below normal (${min}\u2013${max} ${unit})`;
  return `\u2191 Above normal (${min}\u2013${max} ${unit})`;
}

function calculateMap(systolic: number, diastolic: number): number {
  return Math.round((systolic + 2 * diastolic) / 3);
}

function getMapRangeColor(map: number | null): string {
  if (map === null) return "text-gray-500";
  if (map < 60) return "text-red-600 font-bold";
  if (map < 70) return "text-orange-500";
  if (map <= 100) return "text-green-600";
  return "text-orange-500";
}

interface SavedAssessmentData {
  prescriptionId: string;
  symptoms: string;
  diagnosis: string;
  chief_complaint: string;
  symptom_notes: string;
  severity_level: number;
  duration: string;
  existing_diseases: string;
  emergency_indicators: string[];
  allergies: string;
  smoking_history: string;
  alcohol_history: string;
  past_medications: string;
  bp_systolic: number | null;
  bp_diastolic: number | null;
  temperature: number | null;
  pulse: number | null;
  spo2: number | null;
  respiratory_rate: number | null;
  blood_sugar: number | null;
  weight: number | null;
  height: number | null;
  bmi: number | null;
  pain_score: number;
}

interface SymptomsAssessmentProps {
  patientEmail: string;
  patientName: string;
  hospitalName?: string;
  onSaved: () => void;
  onSwitchToPrescriptions?: (data: SavedAssessmentData) => void;
}

export default function SymptomsAssessment({ patientEmail, patientName, hospitalName, onSaved, onSwitchToPrescriptions }: SymptomsAssessmentProps) {
  const [doctorName, setDoctorName] = useState("");

  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [symptomsText, setSymptomsText] = useState("");
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [symptomNotes, setSymptomNotes] = useState("");
  const [severityLevel, setSeverityLevel] = useState(0);
  const [duration, setDuration] = useState("");
  const [durationCustom, setDurationCustom] = useState("");
  const [useCustomDuration, setUseCustomDuration] = useState(false);
  const [existingDiseases, setExistingDiseases] = useState<string[]>([]);

  const [emergencyIndicators, setEmergencyIndicators] = useState<string[]>([]);

  const [allergies, setAllergies] = useState("");
  const [smokingHistory, setSmokingHistory] = useState("Never");
  const [alcoholHistory, setAlcoholHistory] = useState("Never");
  const [pastMedications, setPastMedications] = useState("");

  const [bpSystolic, setBpSystolic] = useState("");
  const [bpDiastolic, setBpDiastolic] = useState("");
  const [temperature, setTemperature] = useState("");
  const [pulse, setPulse] = useState("");
  const [spo2, setSpo2] = useState("");
  const [respiratoryRate, setRespiratoryRate] = useState("");
  const [bloodSugar, setBloodSugar] = useState("");
  const [bloodSugarFasting, setBloodSugarFasting] = useState(false);
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [bmi, setBmi] = useState("");
  const [painScore, setPainScore] = useState(0);

  const [diagnosis, setDiagnosis] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setDoctorName(user.email);
    });
  }, []);

  useEffect(() => {
    if (weight && height) {
      const w = parseFloat(weight);
      const h = parseFloat(height);
      if (!isNaN(w) && !isNaN(h) && h > 0) {
        setBmi((w / ((h / 100) ** 2)).toFixed(1));
      } else {
        setBmi("");
      }
    } else {
      setBmi("");
    }
  }, [weight, height]);

  const bpSysNum = bpSystolic ? parseInt(bpSystolic) : null;
  const bpDiaNum = bpDiastolic ? parseInt(bpDiastolic) : null;
  const mapValue = bpSysNum && bpDiaNum ? calculateMap(bpSysNum, bpDiaNum) : null;
  const bmiNum = bmi ? parseFloat(bmi) : null;
  const bmiCategory = bmiNum ? getBmiCategory(bmiNum) : null;

  const toggleSymptom = (symptom: string) => {
    setSelectedSymptoms(prev => {
      if (prev.includes(symptom)) {
        return prev.filter(s => s !== symptom);
      }
      return [...prev, symptom];
    });
  };

  const toggleDisease = (disease: string) => {
    setExistingDiseases(prev => {
      if (disease === "None") return ["None"];
      const filtered = prev.filter(d => d !== "None");
      if (filtered.includes(disease)) {
        return filtered.filter(d => d !== disease);
      }
      return [...filtered, disease];
    });
  };

  const toggleEmergency = (indicator: string) => {
    setEmergencyIndicators(prev =>
      prev.includes(indicator)
        ? prev.filter(i => i !== indicator)
        : [...prev, indicator]
    );
  };

  const getDurationValue = () => {
    if (useCustomDuration) return durationCustom;
    return duration;
  };

  const handleSave = async () => {
    if (!symptomsText.trim() && selectedSymptoms.length === 0) {
      alert("Please enter symptoms or select from checklist");
      return;
    }
    if (!chiefComplaint.trim()) {
      alert("Please enter the chief complaint");
      return;
    }
    setSaving(true);
    try {
      const combinedSymptoms = selectedSymptoms.length > 0
        ? "Checklist: " + selectedSymptoms.join(", ") + (symptomsText.trim() ? " | " + symptomsText.trim() : "")
        : symptomsText.trim();

      const res = await fetch("http://127.0.0.1:8000/api/healthcare/doctor/prescriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_email: patientEmail,
          patient_name: patientName,
          doctor_name: doctorName,
          hospital_name: hospitalName || "",
          symptoms: combinedSymptoms,
          chief_complaint: chiefComplaint.trim(),
          symptom_notes: symptomNotes.trim(),
          severity_level: severityLevel,
          duration: getDurationValue(),
          existing_diseases: existingDiseases.length > 0 ? existingDiseases.join(", ") : "",
          diagnosis: diagnosis.trim(),
          emergency_indicators: emergencyIndicators,
          allergies: allergies.trim(),
          smoking_history: smokingHistory,
          alcohol_history: alcoholHistory,
          past_medications: pastMedications.trim(),
          prescription_notes: "",
          medicines: "[]",
          follow_up_date: null,
          bp_systolic: bpSysNum,
          bp_diastolic: bpDiaNum,
          temperature: temperature ? parseFloat(temperature) : null,
          pulse: pulse ? parseInt(pulse) : null,
          spo2: spo2 ? parseInt(spo2) : null,
          respiratory_rate: respiratoryRate ? parseInt(respiratoryRate) : null,
          blood_sugar: bloodSugar ? parseInt(bloodSugar) : null,
          weight: weight ? parseFloat(weight) : null,
          height: height ? parseFloat(height) : null,
          bmi: bmiNum,
          pain_score: painScore,
        }),
      });
      if (!res.ok) {
        const errBody = await res.text();
        console.error("Server error:", res.status, errBody);
        throw new Error(`Failed: ${res.status}`);
      }
      const savedData = await res.json();
      setSelectedSymptoms([]);
      setSymptomsText("");
      setChiefComplaint("");
      setSymptomNotes("");
      setSeverityLevel(0);
      setDuration("");
      setDurationCustom("");
      setUseCustomDuration(false);
      setExistingDiseases([]);
      setEmergencyIndicators([]);
      setAllergies("");
      setSmokingHistory("Never");
      setAlcoholHistory("Never");
      setPastMedications("");
      setBpSystolic("");
      setBpDiastolic("");
      setTemperature("");
      setPulse("");
      setSpo2("");
      setRespiratoryRate("");
      setBloodSugar("");
      setBloodSugarFasting(false);
      setWeight("");
      setHeight("");
      setBmi("");
      setPainScore(0);
      setDiagnosis("");
      onSaved();
      if (onSwitchToPrescriptions) {
        onSwitchToPrescriptions({
          prescriptionId: savedData.id,
          symptoms: combinedSymptoms,
          diagnosis: diagnosis.trim(),
          chief_complaint: chiefComplaint.trim(),
          symptom_notes: symptomNotes.trim(),
          severity_level: severityLevel,
          duration: getDurationValue(),
          existing_diseases: existingDiseases.length > 0 ? existingDiseases.join(", ") : "",
          emergency_indicators: emergencyIndicators,
          allergies: allergies.trim(),
          smoking_history: smokingHistory,
          alcohol_history: alcoholHistory,
          past_medications: pastMedications.trim(),
          bp_systolic: bpSysNum,
          bp_diastolic: bpDiaNum,
          temperature: temperature ? parseFloat(temperature) : null,
          pulse: pulse ? parseInt(pulse) : null,
          spo2: spo2 ? parseInt(spo2) : null,
          respiratory_rate: respiratoryRate ? parseInt(respiratoryRate) : null,
          blood_sugar: bloodSugar ? parseInt(bloodSugar) : null,
          weight: weight ? parseFloat(weight) : null,
          height: height ? parseFloat(height) : null,
          bmi: bmiNum,
          pain_score: painScore,
        });
      }
    } catch (err) {
      console.error("Error saving symptoms:", err);
      alert("Failed to save assessment");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
      <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
        <Activity className="w-4 h-4 text-rose-500" />
        Record Patient Assessment
      </h4>

      {/* Chief Complaint */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Chief Complaint <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={chiefComplaint}
          onChange={e => setChiefComplaint(e.target.value)}
          placeholder="Primary reason for visit (e.g., chest pain, headache)"
          className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-rose-400 focus:outline-none"
        />
      </div>

      {/* Symptoms Checklist */}
      <div className="space-y-2">
        <label className="block text-xs font-medium text-gray-600 mb-1">Symptoms Checklist</label>
        <div className="flex flex-wrap gap-1.5">
          {COMMON_SYMPTOMS.map(symptom => (
            <button
              key={symptom}
              type="button"
              onClick={() => toggleSymptom(symptom)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition ${
                selectedSymptoms.includes(symptom)
                  ? "bg-rose-100 text-rose-700 border-rose-300"
                  : "bg-gray-50 text-gray-600 border-gray-200 hover:border-rose-200 hover:text-rose-600"
              }`}
            >
              {symptom}
            </button>
          ))}
        </div>
        {selectedSymptoms.length > 0 && (
          <p className="text-xs text-gray-400">
            {selectedSymptoms.length} symptom{selectedSymptoms.length !== 1 ? "s" : ""} selected
          </p>
        )}
      </div>

      {/* Symptom Details */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Symptom Details <span className="text-red-500">*</span>
        </label>
        <textarea
          value={symptomsText}
          onChange={e => setSymptomsText(e.target.value)}
          placeholder="Describe symptoms in detail \u2014 onset, progression, triggers, relieving factors..."
          rows={2}
          className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-rose-400 focus:outline-none resize-none"
        />
      </div>

      {/* Symptom Notes */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Additional Notes</label>
        <textarea
          value={symptomNotes}
          onChange={e => setSymptomNotes(e.target.value)}
          placeholder="Patterns, associated symptoms, triggers, relieving factors..."
          rows={2}
          className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-rose-400 focus:outline-none resize-none"
        />
      </div>

      {/* Duration */}
      <div className="space-y-2">
        <label className="block text-xs font-medium text-gray-600 mb-1">Duration</label>
        {!useCustomDuration ? (
          <div className="flex flex-wrap gap-1.5">
            {DURATION_PRESETS.map(preset => (
              <button
                key={preset.value}
                type="button"
                onClick={() => setDuration(preset.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                  duration === preset.value
                    ? "bg-rose-100 text-rose-700 border-rose-300"
                    : "bg-gray-50 text-gray-600 border-gray-200 hover:border-rose-200"
                }`}
              >
                {preset.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setUseCustomDuration(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-dashed border-gray-300 text-gray-500 hover:border-rose-200 hover:text-rose-600 bg-gray-50"
            >
              + Custom
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={durationCustom}
              onChange={e => setDurationCustom(e.target.value)}
              placeholder="e.g., 5 days, 2 months"
              className="flex-1 rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-rose-400 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => { setUseCustomDuration(false); setDurationCustom(""); }}
              className="text-xs text-gray-500 hover:text-rose-600 underline"
            >
              Presets
            </button>
          </div>
        )}
      </div>

      {/* Severity Level */}
      <div className="space-y-2">
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Severity Level: <span className="font-semibold text-gray-800">{severityLevel}/10 \u2014 {getSeverityLabel(severityLevel)}</span>
        </label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min="0"
            max="10"
            value={severityLevel}
            onChange={e => setSeverityLevel(parseInt(e.target.value))}
            className="w-full"
          />
          <span className={`w-8 h-8 rounded-full text-white text-xs font-bold flex items-center justify-center ${getSeverityColor(severityLevel)}`}>
            {severityLevel}
          </span>
        </div>
        <div className="flex justify-between text-[10px] text-gray-400 px-1">
          <span>None</span>
          <span>Mild</span>
          <span>Moderate</span>
          <span>Severe</span>
          <span>Critical</span>
        </div>
      </div>

      {/* Medical History */}
      <div>
        <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Medical History</h5>
        <div className="space-y-3">

          {/* Existing Diseases */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-gray-600">Existing Diseases / Conditions</label>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_DISEASES.map(disease => (
                <button
                  key={disease}
                  type="button"
                  onClick={() => toggleDisease(disease)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition ${
                    existingDiseases.includes(disease)
                      ? "bg-blue-100 text-blue-700 border-blue-300"
                      : "bg-gray-50 text-gray-600 border-gray-200 hover:border-blue-200 hover:text-blue-600"
                  }`}
                >
                  {disease}
                </button>
              ))}
            </div>
          </div>

          {/* Allergies */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Allergies</label>
            <input
              type="text"
              value={allergies}
              onChange={e => setAllergies(e.target.value)}
              placeholder="Drug allergies, food allergies, environmental (comma separated)"
              className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-rose-400 focus:outline-none"
            />
          </div>

          {/* Smoking & Alcohol */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Smoking History</label>
              <select
                value={smokingHistory}
                onChange={e => setSmokingHistory(e.target.value)}
                className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-rose-400 focus:outline-none bg-white"
              >
                <option value="Never">Never</option>
                <option value="Former">Former</option>
                <option value="Current">Current</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Alcohol History</label>
              <select
                value={alcoholHistory}
                onChange={e => setAlcoholHistory(e.target.value)}
                className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-rose-400 focus:outline-none bg-white"
              >
                <option value="Never">Never</option>
                <option value="Occasional">Occasional</option>
                <option value="Regular">Regular</option>
              </select>
            </div>
          </div>

          {/* Past Medications */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Current / Past Medications</label>
            <textarea
              value={pastMedications}
              onChange={e => setPastMedications(e.target.value)}
              placeholder="List current medications the patient is taking (name, dosage, frequency)"
              rows={2}
              className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-rose-400 focus:outline-none resize-none"
            />
          </div>

        </div>
      </div>

      {/* Emergency Indicators */}
      <div className="space-y-2">
        <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
          <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
          Emergency Indicators
        </label>
        <div className="flex flex-wrap gap-2">
          {EMERGENCY_INDICATORS.map(ind => (
            <label key={ind.value} className="flex items-center gap-1 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={emergencyIndicators.includes(ind.value)}
                onChange={() => toggleEmergency(ind.value)}
                className="w-4 h-4 text-red-600 border-gray-300 rounded"
              />
              {ind.label}
            </label>
          ))}
        </div>
        {emergencyIndicators.length > 0 && (
          <p className="text-xs text-red-500 font-medium flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Emergency indicators flagged \u2014 review required
          </p>
        )}
      </div>

      {/* Vitals */}
      <div>
        <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Vital Signs</h5>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">

          {/* BP */}
          <div className="space-y-1">
            <label className="block text-[10px] font-medium text-gray-500 mb-0.5">BP (mmHg)</label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={bpSystolic}
                onChange={e => setBpSystolic(e.target.value)}
                placeholder="120"
                className={`w-full rounded-lg border-2 px-2 py-1.5 text-xs focus:outline-none focus:border-rose-400 ${getVitalRangeColor(bpSysNum, 90, 130, 70, 180)}`}
              />
              <span className="text-gray-400 text-xs">/</span>
              <input
                type="number"
                value={bpDiastolic}
                onChange={e => setBpDiastolic(e.target.value)}
                placeholder="80"
                className={`w-full rounded-lg border-2 px-2 py-1.5 text-xs focus:outline-none focus:border-rose-400 ${getVitalRangeColor(bpDiaNum, 60, 85, 40, 120)}`}
              />
            </div>
            <p className="text-[10px] text-gray-400">{getVitalRangeText(bpSysNum, 90, 130, "mmHg")}</p>
            {mapValue !== null && (
              <p className="text-[10px]">
                MAP: <span className={getMapRangeColor(mapValue)}>{mapValue} mmHg</span>
                {mapValue >= 70 && mapValue <= 100 ? " \u2713" : ""}
              </p>
            )}
          </div>

          {/* Temperature */}
          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Temp (\u00b0C)</label>
            <input
              type="number"
              step="0.1"
              value={temperature}
              onChange={e => setTemperature(e.target.value)}
              placeholder="37.0"
              className={`w-full rounded-lg border-2 px-2 py-1.5 text-xs focus:outline-none focus:border-rose-400 ${getVitalRangeColor(temperature ? parseFloat(temperature) : null, 36.5, 37.5, 35, 41)}`}
            />
            <p className="text-[10px] text-gray-400">{getVitalRangeText(temperature ? parseFloat(temperature) : null, 36.5, 37.5, "\u00b0C")}</p>
          </div>

          {/* Pulse */}
          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Pulse (bpm)</label>
            <input
              type="number"
              value={pulse}
              onChange={e => setPulse(e.target.value)}
              placeholder="72"
              className={`w-full rounded-lg border-2 px-2 py-1.5 text-xs focus:outline-none focus:border-rose-400 ${getVitalRangeColor(pulse ? parseInt(pulse) : null, 60, 100, 40, 140)}`}
            />
            <p className="text-[10px] text-gray-400">{getVitalRangeText(pulse ? parseInt(pulse) : null, 60, 100, "bpm")}</p>
          </div>

          {/* SpO2 */}
          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-0.5">SpO\u2082 (%)</label>
            <input
              type="number"
              value={spo2}
              onChange={e => setSpo2(e.target.value)}
              placeholder="98"
              className={`w-full rounded-lg border-2 px-2 py-1.5 text-xs focus:outline-none focus:border-rose-400 ${getVitalRangeColor(spo2 ? parseInt(spo2) : null, 95, 100, 85, 100)}`}
            />
            <p className="text-[10px] text-gray-400">{getVitalRangeText(spo2 ? parseInt(spo2) : null, 95, 100, "%")}</p>
          </div>

          {/* RR */}
          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-0.5">RR (/min)</label>
            <input
              type="number"
              value={respiratoryRate}
              onChange={e => setRespiratoryRate(e.target.value)}
              placeholder="16"
              className={`w-full rounded-lg border-2 px-2 py-1.5 text-xs focus:outline-none focus:border-rose-400 ${getVitalRangeColor(respiratoryRate ? parseInt(respiratoryRate) : null, 12, 20, 8, 30)}`}
            />
            <p className="text-[10px] text-gray-400">{getVitalRangeText(respiratoryRate ? parseInt(respiratoryRate) : null, 12, 20, "breaths/min")}</p>
          </div>

          {/* Blood Sugar */}
          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Blood Sugar (mg/dL)</label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={bloodSugar}
                onChange={e => setBloodSugar(e.target.value)}
                placeholder="Random"
                className={`w-full rounded-lg border-2 px-2 py-1.5 text-xs focus:outline-none focus:border-rose-400 ${getVitalRangeColor(bloodSugar ? parseInt(bloodSugar) : null, 70, 140, 40, 500)}`}
              />
            </div>
            <label className="flex items-center gap-1 mt-0.5">
              <input
                type="checkbox"
                checked={bloodSugarFasting}
                onChange={e => setBloodSugarFasting(e.target.checked)}
                className="w-3 h-3"
              />
              <span className="text-[10px] text-gray-400">Fasting</span>
            </label>
            <p className="text-[10px] text-gray-400">{getVitalRangeText(bloodSugar ? parseInt(bloodSugar) : null, 70, 140, "mg/dL")}</p>
          </div>

          {/* Weight */}
          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Weight (kg)</label>
            <input
              type="number"
              step="0.1"
              value={weight}
              onChange={e => setWeight(e.target.value)}
              placeholder="70"
              className="w-full rounded-lg border-2 border-gray-200 px-2 py-1.5 text-xs focus:border-rose-400 focus:outline-none"
            />
          </div>

          {/* Height */}
          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-0.5">Height (cm)</label>
            <input
              type="number"
              step="0.1"
              value={height}
              onChange={e => setHeight(e.target.value)}
              placeholder="170"
              className="w-full rounded-lg border-2 border-gray-200 px-2 py-1.5 text-xs focus:border-rose-400 focus:outline-none"
            />
          </div>

          {/* BMI */}
          <div>
            <label className="block text-[10px] font-medium text-gray-500 mb-0.5">BMI</label>
            <input
              type="number"
              step="0.1"
              value={bmi}
              readOnly
              placeholder="Auto"
              className="w-full rounded-lg border-2 border-gray-200 px-2 py-1.5 text-xs bg-gray-50 focus:outline-none"
            />
            {bmiCategory && (
              <p className={`text-[10px] font-medium ${bmiCategory.color}`}>
                {bmiCategory.label}
              </p>
            )}
          </div>

        </div>
      </div>

      {/* Pain Score */}
      <div className="space-y-2">
        <label className="block text-xs font-medium text-gray-600 mb-1">Pain Score (0\u201310)</label>
        <div className="flex items-center gap-1">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(score => (
            <button
              key={score}
              type="button"
              onClick={() => setPainScore(score)}
              className={`w-full h-10 rounded-lg text-xs font-bold transition ${
                painScore === score
                  ? score === 0 ? "bg-gray-400 text-white shadow-md"
                    : score <= 3 ? "bg-yellow-400 text-white shadow-md"
                    : score <= 6 ? "bg-orange-400 text-white shadow-md"
                    : score <= 9 ? "bg-red-500 text-white shadow-md"
                    : "bg-red-700 text-white shadow-md"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              {score}
            </button>
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-gray-400 px-1">
          <span>No Pain</span>
          <span>Mild</span>
          <span>Moderate</span>
          <span>Severe</span>
          <span>Worst</span>
        </div>
        {painScore > 0 && (
          <p className="text-xs font-medium text-center"
            style={{
              color: painScore <= 3 ? "#ca8a04" : painScore <= 6 ? "#ea580c" : "#dc2626"
            }}
          >
            {painScore === 0 ? "No Pain" :
             painScore <= 3 ? "Mild Pain" :
             painScore <= 6 ? "Moderate Pain" :
             painScore <= 9 ? "Severe Pain" : "Worst Possible Pain"}
          </p>
        )}
      </div>

      {/* Diagnosis */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Diagnosis</label>
        <textarea
          value={diagnosis}
          onChange={e => setDiagnosis(e.target.value)}
          placeholder="Enter diagnosis..."
          rows={2}
          className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-rose-400 focus:outline-none resize-none"
        />
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full px-4 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition"
      >
        {saving ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
        ) : (
          <><Activity className="w-4 h-4" /> Save Assessment</>
        )}
      </button>
    </div>
  );
}
