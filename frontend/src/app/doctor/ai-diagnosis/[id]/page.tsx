"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  Bot, Brain, FlaskConical, AlertTriangle, Loader2,
  ArrowLeft, Sparkles, ClipboardList, Activity,
  CheckCircle2, XCircle, Thermometer, Heart, Wind
} from "lucide-react";

interface Prescription {
  id: string;
  patient_email: string;
  patient_name?: string;
  doctor_name?: string;
  symptoms?: string;
  chief_complaint?: string;
  severity_level?: number;
  duration?: string;
  existing_diseases?: string;
  emergency_indicators?: string[] | null;
  bp_systolic?: number;
  bp_diastolic?: number;
  temperature?: number;
  pulse?: number;
  spo2?: number;
  respiratory_rate?: number;
  blood_sugar?: number;
  created_at: string;
  ai_diagnosis?: string;
  ai_disease_predictions?: any;
  ai_suggested_tests?: any;
  ai_notes?: string;
  ai_processed?: boolean;
}

export default function AIDiagnosisPage() {
  const params = useParams();
  const router = useRouter();
  const prescriptionId = params?.id as string;

  const [prescription, setPrescription] = useState<Prescription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (!prescriptionId) return;
    fetchPrescription();
  }, [prescriptionId]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            clearInterval(timer);
            fetchPrescription();
            return 0;
          }
          return c - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [countdown]);

  const fetchPrescription = async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error: err } = await supabase
        .from("doctor_prescriptions")
        .select("*")
        .eq("id", prescriptionId)
        .single();

      if (err) throw new Error(err.message);
      if (!data) throw new Error("Prescription not found");

      setPrescription(data);

      if (!data.ai_processed) {
        setCountdown(5);
      }
    } catch (e: any) {
      setError(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePrescription = () => {
    if (!prescription) return;

    const preFill = {
      diagnosis: prescription.ai_diagnosis || "",
      suggestedTests: Array.isArray(prescription.ai_suggested_tests)
        ? prescription.ai_suggested_tests
        : [],
    };
    localStorage.setItem("aiPreFillData", JSON.stringify(preFill));
    localStorage.setItem("aiPrescriptionId", prescription.id);
    localStorage.setItem("aiPrescriptionPatientEmail", prescription.patient_email);
    localStorage.setItem("aiPrescriptionPatientName", prescription.patient_name || "");
    const appointmentId = localStorage.getItem("aiDiagnosisAppointmentId");
    if (appointmentId) {
      localStorage.removeItem("aiDiagnosisAppointmentId");
      router.push(`/doctor/patient?id=${appointmentId}`);
    } else {
      router.push(`/doctor`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-indigo-100 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Bot className="w-8 h-8 text-indigo-600" />
          </div>
          <h2 className="text-lg font-bold text-gray-800 mb-1">Loading AI Diagnosis</h2>
          <p className="text-sm text-gray-500">Fetching the latest analysis...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-white flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-lg font-bold text-gray-800 mb-2">Error Loading AI Diagnosis</h2>
          <p className="text-sm text-gray-500 mb-6">{error}</p>
          <button onClick={() => router.back()} className="px-6 py-2.5 bg-gray-600 hover:bg-gray-700 text-white rounded-xl font-medium text-sm transition">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!prescription) return null;

  const isError = prescription.ai_diagnosis?.includes("unavailable") ||
    prescription.ai_diagnosis?.includes("failed") ||
    prescription.ai_diagnosis?.includes("error");

  const predictions = Array.isArray(prescription.ai_disease_predictions)
    ? prescription.ai_disease_predictions
    : [];
  const suggestedTests = Array.isArray(prescription.ai_suggested_tests)
    ? prescription.ai_suggested_tests
    : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-white">
      <div className="max-w-4xl mx-auto px-4 py-6 sm:py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition px-3 py-1.5 rounded-lg hover:bg-white/60"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Activity className="w-3.5 h-3.5" />
            {new Date(prescription.created_at).toLocaleDateString("en-IN", {
              day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
            })}
          </div>
        </div>

        {/* Patient & AI Header */}
        <div className="bg-white rounded-2xl shadow-lg border border-indigo-100 overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">AI Diagnosis Report</h1>
                <p className="text-indigo-200 text-sm">Powered by DxGPT</p>
              </div>
            </div>
          </div>

          {/* Patient Summary */}
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
              <p className="text-sm"><span className="font-medium text-gray-500">Patient:</span> <span className="text-gray-900">{prescription.patient_name || "N/A"}</span></p>
              <p className="text-sm"><span className="font-medium text-gray-500">Email:</span> <span className="text-gray-900">{prescription.patient_email}</span></p>
              {prescription.chief_complaint && (
                <p className="text-sm"><span className="font-medium text-gray-500">Chief Complaint:</span> <span className="text-gray-900">{prescription.chief_complaint}</span></p>
              )}
            </div>
          </div>

          {/* Vitals Row */}
          {(prescription.bp_systolic != null || prescription.temperature != null || prescription.pulse != null || prescription.spo2 != null) && (
            <div className="px-6 py-3 border-b border-gray-100 bg-gray-50/50">
              <div className="flex flex-wrap gap-3">
                {prescription.bp_systolic != null && prescription.bp_diastolic != null && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 rounded-lg border border-red-100">
                    <Heart className="w-4 h-4 text-red-500" />
                    <span className="text-xs text-red-700 font-medium">{prescription.bp_systolic}/{prescription.bp_diastolic}</span>
                    <span className="text-[10px] text-red-400">BP</span>
                  </div>
                )}
                {prescription.temperature != null && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 rounded-lg border border-orange-100">
                    <Thermometer className="w-4 h-4 text-orange-500" />
                    <span className="text-xs text-orange-700 font-medium">{prescription.temperature}°C</span>
                    <span className="text-[10px] text-orange-400">Temp</span>
                  </div>
                )}
                {prescription.pulse != null && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 rounded-lg border border-amber-100">
                    <Heart className="w-4 h-4 text-amber-500" />
                    <span className="text-xs text-amber-700 font-medium">{prescription.pulse}</span>
                    <span className="text-[10px] text-amber-400">Pulse</span>
                  </div>
                )}
                {prescription.spo2 != null && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 rounded-lg border border-teal-100">
                    <Wind className="w-4 h-4 text-teal-500" />
                    <span className="text-xs text-teal-700 font-medium">{prescription.spo2}%</span>
                    <span className="text-[10px] text-teal-400">SpO₂</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Symptoms Summary */}
          {prescription.symptoms && (
            <div className="px-6 py-3 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Reported Symptoms</p>
              <p className="text-sm text-gray-700">{prescription.symptoms}</p>
              {prescription.duration && (
                <p className="text-xs text-gray-400 mt-1">Duration: {prescription.duration}</p>
              )}
            </div>
          )}
        </div>

        {/* AI Results */}
        {!prescription.ai_processed ? (
          <div className="bg-white rounded-2xl shadow-lg border border-amber-200 p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-4">
              <Loader2 className="w-8 h-8 text-amber-600 animate-spin" />
            </div>
            <h2 className="text-lg font-bold text-amber-800 mb-2">AI Analysis in Progress</h2>
            <p className="text-sm text-amber-600 mb-4">The DxGPT AI is analyzing the symptoms and vitals. This usually takes a few seconds.</p>
            {countdown > 0 && (
              <p className="text-xs text-amber-500">Auto-refreshing in {countdown}s...</p>
            )}
            <button onClick={fetchPrescription} className="mt-4 px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-medium text-sm transition">
              Refresh Results
            </button>
          </div>
        ) : isError ? (
          <div className="bg-white rounded-2xl shadow-lg border border-red-200 p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-lg font-bold text-red-800 mb-2">AI Diagnosis Unavailable</h2>
            <p className="text-sm text-red-600 mb-6">{prescription.ai_diagnosis}</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => router.back()} className="px-6 py-2.5 border-2 border-gray-200 text-gray-700 rounded-xl font-medium text-sm hover:bg-gray-50 transition">
                Go Back
              </button>
              <button onClick={handleCreatePrescription} className="px-6 py-2.5 bg-gray-600 hover:bg-gray-700 text-white rounded-xl font-medium text-sm transition">
                Create Prescription Manually
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Primary Diagnosis Card */}
            <div className="bg-white rounded-2xl shadow-lg border border-emerald-100 overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-500 to-green-600 px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-emerald-100 text-xs font-medium uppercase tracking-wider">Primary Diagnosis</p>
                    <h2 className="text-xl font-bold text-white">{prescription.ai_diagnosis}</h2>
                  </div>
                </div>
              </div>
              <div className="px-6 py-4">
                <p className="text-xs text-gray-500">Identified by DxGPT AI based on the reported symptoms, vitals, and patient history.</p>
              </div>
            </div>

            {/* Predicted Diseases */}
            {predictions.length > 0 && (
              <div className="bg-white rounded-2xl shadow-lg border border-indigo-100 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Brain className="w-5 h-5 text-indigo-600" />
                  <h3 className="text-sm font-bold text-gray-800">Predicted Diseases</h3>
                  <span className="text-[10px] px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full">{predictions.length} conditions</span>
                </div>
                <div className="space-y-2.5">
                  {predictions.map((pred: any, i: number) => {
                    const disease = pred.disease || pred.disease_name || "";
                    const prob = pred.probability || pred.confidence || 0;
                    const pct = typeof prob === "number" ? prob : parseInt(prob) || 0;
                    const barColor = pct >= 70 ? "bg-red-500" : pct >= 40 ? "bg-amber-500" : "bg-blue-500";
                    const hasDescription = pred.description || pred.symptoms_in_common?.length > 0 || pred.symptoms_not_in_common?.length > 0;
                    return (
                      <div key={i} className="p-3 rounded-xl bg-gray-50 border border-gray-100 hover:border-indigo-200 transition">
                        <div className="flex items-center gap-3 mb-1.5">
                          <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                          <span className="text-sm font-semibold text-gray-800 flex-1">{disease}</span>
                          <span className="text-xs font-bold text-gray-600 w-10 text-right">{pct}%</span>
                        </div>
                        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
                          <div className={`h-full rounded-full ${barColor} transition-all duration-500`} style={{ width: `${Math.min(pct, 100)}%` }} />
                        </div>
                        {pred.description && (
                          <p className="text-xs text-gray-500 mt-1 leading-relaxed">{pred.description}</p>
                        )}
                        {pred.symptoms_in_common?.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            <span className="text-[10px] text-emerald-600 font-medium">Matches:</span>
                            {pred.symptoms_in_common.map((s: string, j: number) => (
                              <span key={j} className="text-[10px] px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">{s}</span>
                            ))}
                          </div>
                        )}
                        {pred.symptoms_not_in_common?.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            <span className="text-[10px] text-amber-600 font-medium">Non-matching:</span>
                            {pred.symptoms_not_in_common.map((s: string, j: number) => (
                              <span key={j} className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded-full border border-amber-200">{s}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Suggested Tests */}
            {suggestedTests.length > 0 && (
              <div className="bg-white rounded-2xl shadow-lg border border-purple-100 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <FlaskConical className="w-5 h-5 text-purple-600" />
                  <h3 className="text-sm font-bold text-gray-800">Suggested Investigations</h3>
                  <span className="text-[10px] px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">{suggestedTests.length} tests</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {suggestedTests.map((test: string, i: number) => (
                    <span key={i} className="text-xs px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg border border-purple-200">
                      {test}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* AI Notes */}
            {prescription.ai_notes && (
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Bot className="w-5 h-5 text-gray-600" />
                  <h3 className="text-sm font-bold text-gray-800">AI Analysis Notes</h3>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">{prescription.ai_notes}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2 pb-8">
              <button
                onClick={handleCreatePrescription}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-semibold text-sm shadow-lg flex items-center justify-center gap-2 transition"
              >
                <Sparkles className="w-5 h-5" /> Accept AI & Create Prescription
              </button>
              <button
                onClick={() => router.back()}
                className="px-6 py-3 border-2 border-gray-200 text-gray-700 rounded-xl font-medium text-sm hover:bg-gray-50 transition flex items-center justify-center gap-2"
              >
                <ClipboardList className="w-5 h-5" /> Back to Patient
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
