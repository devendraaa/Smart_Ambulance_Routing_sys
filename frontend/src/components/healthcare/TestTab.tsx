"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/lib/LanguageContext";
import { TestTube, Building2, User, Calendar, RefreshCw, ChevronDown, ChevronUp, Search, FileText, Loader2, Upload, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { fetchHospitalsList } from "@/lib/api";
import { uploadTestReportFile } from "@/lib/healthcare";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

interface PatientTest {
  id: string;
  patient_email: string;
  patient_name?: string;
  test_type: string;
  status: string;
  payment_status: string;
  payment_amount?: number;
  report_url?: string;
  notes?: string;
  created_at: string;
  hospital_name?: string;
  appointment_id?: string;
  appointment_date?: string;
  timing?: string;
  price?: number;
}

interface PatientGroup {
  patient_name: string;
  patient_email: string;
  tests: PatientTest[];
}

interface HospitalGroup {
  hospital_name: string;
  patients: PatientGroup[];
}

const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
  pending: { color: "text-gray-700", bg: "bg-gray-100", label: "Pending" },
  payment_pending: { color: "text-yellow-700", bg: "bg-yellow-100", label: "Payment Pending" },
  confirmed: { color: "text-blue-700", bg: "bg-blue-100", label: "Confirmed" },
  completed: { color: "text-green-700", bg: "bg-green-100", label: "Completed" },
  cancelled: { color: "text-red-700", bg: "bg-red-100", label: "Cancelled" },
  ordered: { color: "text-purple-700", bg: "bg-purple-100", label: "Ordered" },
};

const testTypeIcons: Record<string, string> = {
  "MRI": "🧠",
  "CT Scan": "🔬",
  "Sonography": "📻",
  "Blood Test": "🩸",
  "X-Ray": "☢️",
  "ECG": "❤️",
  "ECHO": "💓",
  "TMT": "🏃",
  "Urine Test": "🧪",
  "Stool Test": "💩",
  "Thyroid": "🦋",
  "Sugar Test": "🍬",
};

const TIMING_OPTIONS = ["09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM", "12:00 PM", "12:30 PM", "02:00 PM", "02:30 PM", "03:00 PM", "03:30 PM", "04:00 PM", "04:30 PM"];

const TEST_TYPES = [
  "MRI", "CT Scan", "Sonography", "Blood Test", "X-Ray", "ECG", "ECHO", "TMT", "Urine Test", "Stool Test", "Thyroid", "Sugar Test"
];

export default function TestTab({ isDoctorView = false }: { isDoctorView?: boolean }) {
  const { t } = useLanguage();
  const [hospitalGroups, setHospitalGroups] = useState<HospitalGroup[]>([]);
  const [filteredGroups, setFilteredGroups] = useState<HospitalGroup[]>([]);
  const [hospitals, setHospitals] = useState<string[]>([]);
  const [selectedHospital, setSelectedHospital] = useState<string>("all");
  const [selectedTestType, setSelectedTestType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedHospitals, setExpandedHospitals] = useState<Set<string>>(new Set());
  const [expandedPatients, setExpandedPatients] = useState<Set<string>>(new Set());
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedTest, setSelectedTest] = useState<PatientTest | null>(null);
  const [scheduleForm, setScheduleForm] = useState({
    appointment_date: "",
    timing: "09:00 AM",
    price: ""
  });
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadTest, setUploadTest] = useState<PatientTest | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  // Patient view state
  const [patientGrouped, setPatientGrouped] = useState<PatientGroup[]>([]);
  const [patientFiltered, setPatientFiltered] = useState<PatientGroup[]>([]);
  const [patientHospitals, setPatientHospitals] = useState<string[]>([]);
  const [patientSelectedHospital, setPatientSelectedHospital] = useState<string>("all");
  const [showHistory, setShowHistory] = useState(false);

  const upcomingStatuses = ["pending", "payment_pending", "ordered", "confirmed"];
  const historyStatuses = ["completed", "cancelled"];

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterData();
  }, [hospitalGroups, selectedHospital, selectedTestType, searchQuery]);

  useEffect(() => {
    if (isDoctorView) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let filtered = patientGrouped;
    filtered = filtered.map(g => ({
      ...g,
      tests: g.tests.filter(t => {
        if (patientSelectedHospital !== "all" && t.hospital_name !== patientSelectedHospital) return false;
        const testDate = t.appointment_date ? new Date(t.appointment_date) : null;
        const isPast = testDate && testDate < today;
        const isScheduled = !!t.appointment_date;
        const isHistoryStatus = historyStatuses.includes(t.status);
        if (showHistory) {
          return isHistoryStatus || !isScheduled || isPast;
        }
        return isScheduled && !isPast;
      })
    })).filter(g => g.tests.length > 0);
    setPatientFiltered(filtered);
  }, [patientGrouped, patientSelectedHospital, showHistory, isDoctorView]);

  const loadHospitals = async () => {
    try {
      const data = await fetchHospitalsList();
      const hospitalNames = data.hospitals.map(h => h.name).filter(Boolean) as string[];
      setHospitals(hospitalNames);
    } catch (err) {
      console.error("Error loading hospitals:", err);
    }
  };

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];

      let testsData: any[] | null = null;

      if (isDoctorView) {
        const { data, error } = await supabase
          .from("patient_tests")
          .select("*")
          .gte("created_at", `${today}T00:00:00`)
          .lte("created_at", `${today}T23:59:59`)
          .order("created_at", { ascending: false });
        if (error) throw error;
        testsData = data;
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: testList } = await supabase
          .from("patient_tests")
          .select("patient_name")
          .eq("patient_email", user.email)
          .not("patient_name", "is", null)
          .limit(1);
        const patientName = testList?.[0]?.patient_name || "";
        const { data, error } = await supabase
          .from("patient_tests")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) throw error;
        testsData = (data || []).filter(t => {
          if (patientName && t.patient_name === patientName && t.patient_email === user.email) return true;
          return t.patient_email === user.email;
        });
      }

      if (!testsData || testsData.length === 0) {
        setHospitalGroups([]);
        await loadHospitals();
        if (!silent) setLoading(false);
        return;
      }

      const { data: appointmentsData } = await supabase
        .from("patient_appointments")
        .select("patient_email, patient_name, hospital_name");

      const appointmentMap = new Map<string, { patient_name: string; hospital_name: string }>();
      appointmentsData?.forEach(apt => {
        appointmentMap.set(apt.patient_email, {
          patient_name: apt.patient_name,
          hospital_name: apt.hospital_name
        });
      });

      const enrichedTests = (testsData || []).map(test => {
        const apt = appointmentMap.get(test.patient_email);
        return {
          ...test,
          patient_name: test.patient_name || apt?.patient_name || test.patient_email.split('@')[0],
          hospital_name: test.hospital_name || apt?.hospital_name || "Unknown Hospital"
        };
      });

      const groups = groupByHospital(enrichedTests);
      setHospitalGroups(groups);
      await loadHospitals();

      // Build patient-centered groups for patient view
      const patientMap = new Map<string, PatientTest[]>();
      enrichedTests.forEach(test => {
        const name = test.patient_name || test.patient_email.split('@')[0];
        if (!patientMap.has(name)) patientMap.set(name, []);
        patientMap.get(name)!.push(test);
      });
      const pGroups = Array.from(patientMap.entries())
        .map(([patient_name, tests]) => ({ patient_name, patient_email: tests[0].patient_email, tests }))
        .sort((a, b) => a.patient_name.localeCompare(b.patient_name));
      setPatientGrouped(pGroups);

      const hospitalSet = new Set(enrichedTests.map(t => t.hospital_name).filter(Boolean));
      setPatientHospitals(Array.from(hospitalSet).sort() as string[]);
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData(true);
    setRefreshing(false);
  };

  const handleRefreshRef = useRef(handleRefresh);
  useEffect(() => {
    handleRefreshRef.current = handleRefresh;
  });

  useEffect(() => {
    const interval = setInterval(() => {
      handleRefreshRef.current();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const groupByHospital = (tests: PatientTest[]): HospitalGroup[] => {
    const hospitalMap = new Map<string, Map<string, PatientTest[]>>();

    tests.forEach(test => {
      const hospital = test.hospital_name || "Unknown Hospital";
      const patientName = test.patient_name || test.patient_email.split('@')[0];
      
      if (!hospitalMap.has(hospital)) {
        hospitalMap.set(hospital, new Map());
      }
      const patientMap = hospitalMap.get(hospital)!;
      const patientKey = patientName.toLowerCase().trim();
      if (!patientMap.has(patientKey)) {
        patientMap.set(patientKey, []);
      }
      patientMap.get(patientKey)!.push(test);
    });

    return Array.from(hospitalMap.entries()).map(([hospital_name, patientMap]) => ({
      hospital_name,
      patients: Array.from(patientMap.entries()).map(([patientKey, tests]) => ({
        patient_name: tests[0].patient_name || tests[0].patient_email.split('@')[0],
        patient_email: tests[0].patient_email,
        tests: tests
      }))
    }));
  };

  const filterData = () => {
    let filtered = hospitalGroups;

    if (selectedHospital !== "all") {
      filtered = filtered.filter(g => 
        g.hospital_name.toLowerCase().trim() === selectedHospital.toLowerCase().trim()
      );
    }

    if (selectedTestType !== "all") {
      filtered = filtered.map(hospitalGroup => ({
        ...hospitalGroup,
        patients: hospitalGroup.patients.map(patient => ({
          ...patient,
          tests: patient.tests.filter(t => t.test_type === selectedTestType)
        })).filter(p => p.tests.length > 0)
      })).filter(g => g.patients.length > 0);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.map(hospitalGroup => ({
        ...hospitalGroup,
        patients: hospitalGroup.patients.filter(p =>
          p.patient_name?.toLowerCase().includes(query) ||
          p.patient_email.toLowerCase().includes(query) ||
          p.tests.some(t => t.test_type.toLowerCase().includes(query))
        )
      })).filter(g => g.patients.length > 0);
    }

    setFilteredGroups(filtered);
  };

  const toggleHospital = (hospital: string) => {
    const newExpanded = new Set(expandedHospitals);
    if (newExpanded.has(hospital)) {
      newExpanded.delete(hospital);
    } else {
      newExpanded.add(hospital);
    }
    setExpandedHospitals(newExpanded);
  };

  const togglePatient = (key: string) => {
    const newExpanded = new Set(expandedPatients);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedPatients(newExpanded);
  };

  useEffect(() => {
    if (selectedHospital !== "all" && filteredGroups.length > 0) {
      setExpandedHospitals(prev => {
        const newSet = new Set(prev);
        const hospitalGroup = filteredGroups.find(g => 
          g.hospital_name.toLowerCase().trim() === selectedHospital.toLowerCase().trim()
        );
        if (hospitalGroup) {
          newSet.add(hospitalGroup.hospital_name);
          hospitalGroup.patients.forEach(p => {
            newSet.add(`${hospitalGroup.hospital_name}-${p.patient_name?.toLowerCase().trim()}`);
          });
        }
        return newSet;
      });
    }
  }, [selectedHospital, filteredGroups]);

  const getTotalStats = () => {
    let totalPatients = 0;
    let totalTests = 0;
    filteredGroups.forEach(g => {
      totalPatients += g.patients.length;
      g.patients.forEach(p => totalTests += p.tests.length);
    });
    return { totalPatients, totalTests };
  };

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status] || statusConfig.pending;
    const labelMap: Record<string, string> = {
      pending: t("test.status.pending"),
      payment_pending: t("test.status.paymentPending"),
      confirmed: t("test.status.confirmed"),
      completed: t("test.status.completed"),
      cancelled: t("test.status.cancelled"),
      ordered: t("test.status.ordered"),
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs ${config.bg} ${config.color}`}>
        {labelMap[status] || config.label}
      </span>
    );
  };

  const openScheduleModal = (test: PatientTest) => {
    setSelectedTest(test);
    setScheduleForm({
      appointment_date: test.appointment_date ? test.appointment_date.split('T')[0] : "",
      timing: test.timing || "09:00 AM",
      price: test.price ? test.price.toString() : ""
    });
    setShowScheduleModal(true);
  };

  const saveSchedule = async () => {
    if (!selectedTest) return;
    if (!scheduleForm.appointment_date) {
      alert(t("test.alertSelectDate"));
      return;
    }

    try {
      const { error } = await supabase
        .from("patient_tests")
        .update({
          appointment_date: scheduleForm.appointment_date,
          timing: scheduleForm.timing,
          price: scheduleForm.price ? parseFloat(scheduleForm.price) : null,
          status: scheduleForm.appointment_date ? "confirmed" : "ordered"
        })
        .eq("id", selectedTest.id);

      if (error) throw error;

      setShowScheduleModal(false);
      loadData();
    } catch (err) {
      console.error("Error saving schedule:", err);
      alert(t("test.alertScheduleFailed"));
    }
  };

  const openUploadModal = (test: PatientTest) => {
    setUploadTest(test);
    setUploadFile(null);
    setUploadError("");
    setShowUploadModal(true);
  };

  const handleFileUpload = async () => {
    if (!uploadTest || !uploadFile) return;
    setUploading(true);
    setUploadError("");
    try {
      await uploadTestReportFile(uploadTest.id, uploadFile);
      setShowUploadModal(false);
      setUploadFile(null);
      loadData(true);
    } catch (err: any) {
      setUploadError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handlePayment = async (test: PatientTest) => {
    if (!test.price) return;
    
    const confirmed = confirm(t("test.alertPayConfirm").replace("{amount}", String(test.price)).replace("{testType}", test.test_type));
    if (!confirmed) return;
    
    try {
      const { error } = await supabase
        .from("patient_tests")
        .update({ payment_status: "paid" })
        .eq("id", test.id);
      
      if (error) throw error;
      
      alert(t("test.alertPaymentSuccess"));
      loadData();
    } catch (err) {
      console.error("Payment error:", err);
      alert(t("test.alertPaymentFailed"));
    }
  };

  const stats = getTotalStats();

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-purple-50 to-fuchsia-50 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6"
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                <TestTube className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">{t("test.header")}</h2>
                <p className="text-gray-500 text-sm">{isDoctorView ? t("test.headerDoctorSubtitle") : t("test.headerPatientSubtitle")}</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="px-4 py-2 bg-purple-100 rounded-xl">
                <span className="text-purple-700 font-semibold">{stats.totalPatients}</span>
                <span className="text-purple-500 text-sm ml-1">{t("test.patients")}</span>
              </div>
              <div className="px-4 py-2 bg-pink-100 rounded-xl">
                <span className="text-pink-700 font-semibold">{stats.totalTests}</span>
                <span className="text-pink-500 text-sm ml-1">{t("test.tests")}</span>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              {isDoctorView ? (
                <select
                  value={selectedHospital}
                  onChange={(e) => setSelectedHospital(e.target.value)}
                  className="w-full pl-10 pr-8 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none"
                >
                  <option value="all">{t("test.allHospitals").replace("{count}", String(hospitals.length))}</option>
                  {hospitals.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              ) : (
                <select
                  value={patientSelectedHospital}
                  onChange={(e) => setPatientSelectedHospital(e.target.value)}
                  className="w-full pl-10 pr-8 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none"
                >
                  <option value="all">{t("test.allHospitals").replace("{count}", String(patientHospitals.length))}</option>
                  {patientHospitals.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="relative flex-1">
              <TestTube className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <select
                value={selectedTestType}
                onChange={(e) => setSelectedTestType(e.target.value)}
                className="w-full pl-10 pr-8 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none"
              >
                <option value="all">{t("test.allTestTypes")}</option>
                {TEST_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder={t("test.searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none"
              />
            </div>

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="px-4 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
            >
              <Loader2 className={`w-5 h-5 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? t("test.refreshing") : t("test.refresh")}
            </button>
          </div>
        </motion.div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-4">
              <div className="w-10 h-10 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
              <p className="text-gray-500">{t("test.loading")}</p>
            </div>
          </div>
        ) : isDoctorView ? (
          /* --- Doctor View: Hospital → Patient grouping --- */
          filteredGroups.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <TestTube className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">{t("test.noRecords")}</h3>
              <p className="text-gray-500">
                {selectedHospital === "all" 
                  ? t("test.noRecordsDoctor") 
                  : t("test.noRecordsForHospital").replace("{hospital}", selectedHospital)}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredGroups.map((hospitalGroup) => (
                <motion.div
                  key={hospitalGroup.hospital_name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden"
                >
                  {/* Hospital Header */}
                  <button
                    onClick={() => toggleHospital(hospitalGroup.hospital_name)}
                    className="w-full p-3 sm:p-4 flex items-center justify-between gap-2 bg-gradient-to-r from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 transition"
                  >
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                      <Building2 className="w-5 h-5 text-purple-600 shrink-0" />
                      <span className="font-semibold text-gray-900 text-sm sm:text-base truncate">{hospitalGroup.hospital_name}</span>
                      <span className="px-1.5 sm:px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-[10px] sm:text-xs whitespace-nowrap shrink-0">
                        {t("test.patientsAbbr").replace("{count}", String(hospitalGroup.patients.length))}
                      </span>
                    </div>
                    {expandedHospitals.has(hospitalGroup.hospital_name) ? (
                      <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500 shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500 shrink-0" />
                    )}
                  </button>

                  {/* Patients */}
                  {expandedHospitals.has(hospitalGroup.hospital_name) && (
                    <div className="divide-y divide-gray-100">
                      {hospitalGroup.patients.map((patient) => {
                        const patientKey = `${hospitalGroup.hospital_name}-${patient.patient_name?.toLowerCase().trim()}`;
                        
                        return (
                          <div key={patientKey} className="p-3 sm:p-4">
                            <button
                              onClick={() => togglePatient(patientKey)}
                              className="w-full hover:bg-gray-50 rounded-lg p-2 -m-2 transition"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                                  <User className="w-5 h-5 text-purple-600" />
                                </div>
                                <div className="text-left min-w-0 flex-1">
                                  <div className="font-medium text-gray-900 text-sm sm:text-base truncate">{patient.patient_name}</div>
                                  <div className="text-xs sm:text-sm text-gray-500 truncate">{patient.patient_email}</div>
                                </div>
                                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                                  <span className="px-1.5 sm:px-2 py-1 bg-purple-100 text-purple-700 rounded text-[10px] sm:text-xs whitespace-nowrap">
                                    {t("test.testsCount").replace("{count}", String(patient.tests.length))}
                                  </span>
                                  {expandedPatients.has(patientKey) ? (
                                    <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 shrink-0" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 shrink-0" />
                                  )}
                                </div>
                              </div>
                            </button>

                            {/* Tests */}
                            {expandedPatients.has(patientKey) && (
                              <div className="mt-3 space-y-2">
                                {patient.tests.map((test, idx) => (
                                  <div
                                    key={test.id}
                                    className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                                  >
                                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                                      <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                                        <span className="text-lg sm:text-2xl">{testTypeIcons[test.test_type] || "🧪"}</span>
                                        <span className="font-medium text-gray-900 text-sm">{test.test_type}</span>
                                        {getStatusBadge(test.status)}
                                      </div>
                                      <div className="text-[10px] sm:text-xs text-gray-500 flex items-center gap-1 shrink-0">
                                        <Calendar className="w-3 h-3" />
                                        {test.created_at ? new Date(test.created_at).toLocaleDateString('en-IN') : t("test.na")}
                                      </div>
                                    </div>
                                    {test.notes && (
                                      <div className="mt-2 text-xs text-gray-600 bg-yellow-50 p-2 rounded">
                                        {t("test.note").replace("{notes}", test.notes)}
                                      </div>
                                    )}
                                    {test.report_url && (
                                      <div className="mt-2">
                                        <a 
                                          href={test.report_url.startsWith("http") ? test.report_url : `${API_URL}${test.report_url}`}
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                                        >
                                          <FileText className="w-3 h-3" /> {t("test.viewReport")}
                                        </a>
                                      </div>
                                    )}
                                    {/* Schedule & Payment */}
                                    <div className="mt-2 sm:mt-3 flex flex-wrap gap-1.5 sm:gap-2">
                                      {/* Doctor: Upload Report Button */}
                                      {isDoctorView && (
                                        <button
                                          onClick={() => openUploadModal(test)}
                                          className="px-2 sm:px-3 py-1 sm:py-1.5 bg-emerald-600 text-white text-[10px] sm:text-xs rounded-lg hover:bg-emerald-700 transition flex items-center gap-1"
                                        >
                                          <FileText className="w-3 h-3" />
                                          <span className="hidden sm:inline">{test.report_url ? t("test.updateReport") : t("test.uploadReport")}</span>
                                        </button>
                                      )}
                                      {/* Doctor: Schedule Button */}
                                      {isDoctorView && (
                                        <button
                                          onClick={() => openScheduleModal(test)}
                                          className="px-2 sm:px-3 py-1 sm:py-1.5 bg-purple-600 text-white text-[10px] sm:text-xs rounded-lg hover:bg-purple-700 transition flex items-center gap-1"
                                        >
                                          <Calendar className="w-3 h-3" />
                                          <span className="hidden sm:inline">{test.appointment_date ? t("test.editSchedule") : t("test.scheduleTest")}</span>
                                        </button>
                                      )}
                                      
                                      {/* Show Schedule Info */}
                                      {test.appointment_date && (
                                        <div className="flex items-center gap-2 text-xs bg-green-50 px-2 py-1 rounded">
                                          <Calendar className="w-3 h-3 text-green-600" />
                                          <span className="text-green-700 font-medium">
                                            {new Date(test.appointment_date).toLocaleDateString('en-IN')}
                                            {test.timing && ` ${t("test.atTime")} ${test.timing}`}
                                          </span>
                                          {test.price && (
                                            <span className="text-green-600">₹{test.price}</span>
                                          )}
                                        </div>
                                      )}

                                      {/* Patient: Payment Button */}
                                      {!isDoctorView && test.price && test.payment_status !== 'paid' && test.appointment_date && (
                                        <button
                                          onClick={() => handlePayment(test)}
                                          className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 transition flex items-center gap-1"
                                        >
                                          💳 Pay ₹{test.price}
                                        </button>
                                      )}

                                      {/* Payment Status */}
                                      {!isDoctorView && test.payment_status === 'paid' && (
                                        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                                          ✓ {t("test.paid")}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )
        ) : (
          /* --- Patient View: Patient-centered grouping with hospital filter --- */
          <div className="space-y-4">
            {/* Upcoming / History Toggle */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl shadow-sm border border-gray-200 p-1.5 flex items-center gap-1 max-w-xs"
            >
              <button
                onClick={() => setShowHistory(false)}
                className={`flex-1 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  !showHistory
                    ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                }`}
              >
                <Calendar className="w-4 h-4 inline mr-1.5 -mt-0.5" />
                {t("test.upcoming")}
              </button>
              <button
                onClick={() => setShowHistory(true)}
                className={`flex-1 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  showHistory
                    ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                }`}
              >
                <FileText className="w-4 h-4 inline mr-1.5 -mt-0.5" />
                {t("test.history")}
              </button>
            </motion.div>

            {patientFiltered.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-12 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <TestTube className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">{showHistory ? t("test.noHistoryTestsTitle") : t("test.noUpcomingTestsTitle")}</h3>
                <p className="text-gray-500">
                  {showHistory
                    ? t("test.noHistoryTestsDesc")
                    : patientSelectedHospital === "all"
                      ? t("test.noUpcomingTestsDesc")
                      : t("test.noUpcomingTestsForHospital").replace("{hospital}", patientSelectedHospital)}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {patientFiltered.map((group) => {
                  const patientHospital = group.tests[0]?.hospital_name;

                  return (
                    <motion.div
                      key={group.patient_name}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden"
                    >
                      {/* Patient header */}
                      <div className="px-4 sm:px-6 py-3 sm:py-4 border-b bg-gradient-to-r from-violet-50 to-pink-50 border-gray-100">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                            <User className="w-5 h-5 text-purple-600" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="font-semibold text-gray-900 text-sm sm:text-base truncate">{group.patient_name}</h3>
                            <p className="text-[10px] sm:text-xs text-gray-500 truncate">
                              {t("test.testsCount").replace("{count}", String(group.tests.length))}
                              {patientHospital && <span> · {patientHospital}</span>}
                            </p>
                          </div>
                          <span className="px-2 sm:px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-[10px] sm:text-xs font-medium whitespace-nowrap shrink-0">
                            {t("test.testsCount").replace("{count}", String(group.tests.length))}
                          </span>
                        </div>
                      </div>

                      {/* Test cards */}
                      <div className="p-4 sm:p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                          {group.tests.map((test) => (
                            <motion.div
                              key={test.id}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="p-3 sm:p-4 rounded-xl border-2 border-gray-200 bg-white hover:shadow-md transition"
                            >
                              <div className="flex items-start justify-between mb-3 gap-2">
                                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                                  <span className="text-lg sm:text-2xl">{testTypeIcons[test.test_type] || "🧪"}</span>
                                  <span className="font-medium text-gray-900 text-sm sm:text-base truncate">{test.test_type}</span>
                                </div>
                                {getStatusBadge(test.status)}
                              </div>

                              {test.notes && (
                                <div className="text-xs text-gray-600 bg-yellow-50 p-2 rounded mb-3">
                                  {t("test.note").replace("{notes}", test.notes)}
                                </div>
                              )}

                              {test.report_url && (
                                <div className="mb-3">
                                  <a 
                                    href={test.report_url.startsWith("http") ? test.report_url : `${API_URL}${test.report_url}`}
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                                  >
                                    <FileText className="w-3 h-3" /> {t("test.viewReport")}
                                  </a>
                                </div>
                              )}

                              {/* Schedule Info */}
                              {test.appointment_date && (
                                <div className="flex items-center gap-2 text-xs bg-green-50 px-2 py-1 rounded mb-3">
                                  <Calendar className="w-3 h-3 text-green-600" />
                                  <span className="text-green-700 font-medium">
                                    {new Date(test.appointment_date).toLocaleDateString('en-IN')}
                                    {test.timing && ` ${t("test.atTime")} ${test.timing}`}
                                  </span>
                                  {test.price && <span className="text-green-600">₹{test.price}</span>}
                                </div>
                              )}

                              <div className="flex flex-wrap gap-2">
                                {test.price && test.payment_status !== 'paid' && test.appointment_date && (
                                  <button
                                    onClick={() => handlePayment(test)}
                                    className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 transition flex items-center gap-1"
                                  >
                                    💳 Pay ₹{test.price}
                                  </button>
                                )}
                                {test.payment_status === 'paid' && (
                                  <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                                    ✓ {t("test.paid")}
                                  </span>
                                )}
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Schedule Modal */}
      {showScheduleModal && selectedTest && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center p-3 sm:p-4 pt-16 sm:pt-20 z-[9999] overflow-y-auto">
          <div className="bg-white rounded-xl p-4 sm:p-6 w-full max-w-md my-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">{t("test.scheduleHeading")}</h3>
              <button onClick={() => setShowScheduleModal(false)} className="text-gray-500 hover:text-gray-700">
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("test.patient")}</label>
                <p className="text-gray-900">{selectedTest.patient_name}</p>
                <p className="text-sm text-gray-500">{selectedTest.patient_email}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("test.testType")}</label>
                <p className="text-gray-900">{selectedTest.test_type}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("test.appointmentDate")}</label>
                <input
                  type="date"
                  value={scheduleForm.appointment_date}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, appointment_date: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("test.timing")}</label>
                <select
                  value={scheduleForm.timing}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, timing: e.target.value })}
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none"
                >
                  {TIMING_OPTIONS.map(time => (
                    <option key={time} value={time}>{time}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t("test.price")}</label>
                <input
                  type="number"
                  value={scheduleForm.price}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, price: e.target.value })}
                  placeholder={t("test.enterPrice")}
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-purple-500 focus:outline-none"
                />
              </div>

              <button
                onClick={saveSchedule}
                className="w-full py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition"
              >
                {t("test.saveSchedule")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Report Modal */}
      {showUploadModal && uploadTest && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center p-3 sm:p-4 pt-16 sm:pt-20 z-[9999] overflow-y-auto">
          <div className="bg-white rounded-xl p-4 sm:p-6 w-full max-w-md shadow-2xl my-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">{t("test.uploadTestReport")}</h3>
              <button onClick={() => setShowUploadModal(false)} className="p-1 hover:bg-gray-100 rounded-lg transition">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-sm text-gray-500">{t("test.patient")}</p>
                <p className="font-medium text-gray-900">{uploadTest.patient_name || uploadTest.patient_email}</p>
                <p className="text-xs text-gray-400 mt-1">{t("test.testLabel").replace("{type}", uploadTest.test_type)}</p>
                {uploadTest.status === "completed" && uploadTest.report_url && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-emerald-600">
                    <FileText className="w-3 h-3" />
                    {t("test.reportAlreadyUploaded")}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Upload className="w-4 h-4 inline mr-1" />
                  {t("test.selectReportFile")}
                </label>
                <div
                  onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("border-emerald-500", "bg-emerald-50"); }}
                  onDragLeave={(e) => { e.currentTarget.classList.remove("border-emerald-500", "bg-emerald-50"); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove("border-emerald-500", "bg-emerald-50");
                    const f = e.dataTransfer.files[0];
                    if (f) setUploadFile(f);
                  }}
                  className={`border-2 border-dashed rounded-xl p-6 text-center transition cursor-pointer hover:border-emerald-400 ${uploadFile ? "border-emerald-500 bg-emerald-50" : "border-gray-300 bg-gray-50"}`}
                  onClick={() => document.getElementById("report-file-input")?.click()}
                >
                  {uploadFile ? (
                    <div>
                      <FileText className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                      <p className="text-sm font-medium text-emerald-700">{uploadFile.name}</p>
                      <p className="text-xs text-gray-500 mt-1">{(uploadFile.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  ) : (
                    <div>
                      <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">{t("test.dropFileHint")}</p>
                      <p className="text-xs text-gray-400 mt-1">{t("test.fileFormats")}</p>
                    </div>
                  )}
                  <input
                    id="report-file-input"
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp"
                    className="hidden"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  />
                </div>
              </div>

              {uploadError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {uploadError}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
                >
                  {t("test.cancel")}
                </button>
                <button
                  onClick={handleFileUpload}
                  disabled={!uploadFile || uploading}
                  className="flex-1 py-2.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t("test.uploading")}
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      {t("test.uploadReportBtn")}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}