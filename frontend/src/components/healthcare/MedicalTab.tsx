"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Pill, Building2, User, Calendar, RefreshCw, ChevronDown, ChevronUp, X, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { fetchHospitalsList } from "@/lib/api";

interface PatientMedicine {
  id: string;
  patient_email: string;
  patient_name?: string;
  medicine_name: string;
  dosage: string;
  frequency: string;
  timing: string;
  duration: string;
  instructions: string;
  is_active: boolean;
  created_at: string;
  hospital_name?: string;
  appointment_id?: string;
}

interface PatientGroup {
  patient_name: string;
  patient_email: string;
  medicines: PatientMedicine[];
}

interface HospitalGroup {
  hospital_name: string;
  patients: PatientGroup[];
}

export default function MedicalTab() {
  const [hospitalGroups, setHospitalGroups] = useState<HospitalGroup[]>([]);
  const [filteredGroups, setFilteredGroups] = useState<HospitalGroup[]>([]);
  const [hospitals, setHospitals] = useState<string[]>([]);
  const [selectedHospital, setSelectedHospital] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [expandedHospitals, setExpandedHospitals] = useState<Set<string>>(new Set());
  const [expandedPatients, setExpandedPatients] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterData();
  }, [hospitalGroups, selectedHospital, searchQuery]);

  // Auto-expand selected hospital
  useEffect(() => {
    if (selectedHospital !== "all" && filteredGroups.length > 0) {
      setExpandedHospitals(prev => {
        const newSet = new Set(prev);
        const hospitalGroup = filteredGroups.find(g => 
          g.hospital_name.toLowerCase().trim() === selectedHospital.toLowerCase().trim()
        );
        if (hospitalGroup) {
          newSet.add(hospitalGroup.hospital_name);
          // Also expand all patients for selected hospital
          hospitalGroup.patients.forEach(p => {
            newSet.add(`${hospitalGroup.hospital_name}-${p.patient_name?.toLowerCase().trim()}`);
          });
        }
        return newSet;
      });
    }
  }, [selectedHospital, filteredGroups]);

  const loadHospitals = async () => {
    try {
      const data = await fetchHospitalsList();
      const hospitalNames = data.hospitals.map(h => h.name).filter(Boolean) as string[];
      setHospitals(hospitalNames);
    } catch (err) {
      console.error("Error loading hospitals:", err);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: medsData, error: medsError } = await supabase
        .from("patient_medicines")
        .select("*")
        .order("created_at", { ascending: false });

      if (medsError) throw medsError;

      if (!medsData || medsData.length === 0) {
        setHospitalGroups([]);
        setLoading(false);
        await loadHospitals();
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

      const enrichedMeds = (medsData || []).map(med => {
        const apt = appointmentMap.get(med.patient_email);
        return {
          ...med,
          patient_name: med.patient_name || apt?.patient_name || med.patient_email.split('@')[0],
          hospital_name: med.hospital_name || apt?.hospital_name || "Unknown Hospital"
        };
      });

      const groups = groupByHospital(enrichedMeds);
      setHospitalGroups(groups);
      await loadHospitals();
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setLoading(false);
    }
  };

  const groupByHospital = (medicines: PatientMedicine[]): HospitalGroup[] => {
    console.log("=== GROUP DEBUG ===", medicines.length);
    
    const hospitalMap = new Map<string, Map<string, PatientMedicine[]>>();

    medicines.forEach(med => {
      const hospital = med.hospital_name || "Unknown Hospital";
      const patientName = med.patient_name || med.patient_email.split('@')[0];
      console.log("Med:", med.medicine_name, "Hospital:", hospital, "Patient:", patientName);
      
      if (!hospitalMap.has(hospital)) {
        hospitalMap.set(hospital, new Map());
      }
      const patientMap = hospitalMap.get(hospital)!;
      // Use patient_name as key instead of patient_email to differentiate patients
      const patientKey = patientName.toLowerCase().trim();
      if (!patientMap.has(patientKey)) {
        patientMap.set(patientKey, []);
      }
      patientMap.get(patientKey)!.push(med);
    });

    console.log("Hospital groups:", hospitalMap.size);
    hospitalMap.forEach((patientMap, hospital) => {
      console.log(`  ${hospital}: ${patientMap.size} patients`);
      patientMap.forEach((meds, patient) => {
        console.log(`    ${patient}: ${meds.length} meds`);
      });
    });

    return Array.from(hospitalMap.entries()).map(([hospital_name, patientMap]) => ({
      hospital_name,
      patients: Array.from(patientMap.entries()).map(([patientKey, meds]) => ({
        patient_name: meds[0].patient_name || meds[0].patient_email.split('@')[0],
        patient_email: meds[0].patient_email,
        medicines: meds
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

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.map(hospitalGroup => ({
        ...hospitalGroup,
        patients: hospitalGroup.patients.filter(p =>
          p.patient_name?.toLowerCase().includes(query) ||
          p.patient_email.toLowerCase().includes(query) ||
          p.medicines.some(m => m.medicine_name.toLowerCase().includes(query))
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

  const getTotalStats = () => {
    let totalPatients = 0;
    let totalMeds = 0;
    filteredGroups.forEach(g => {
      totalPatients += g.patients.length;
      g.patients.forEach(p => totalMeds += p.medicines.length);
    });
    return { totalPatients, totalMeds };
  };

  const stats = getTotalStats();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6"
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                <Pill className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Medical Records</h2>
                <p className="text-gray-500 text-sm">Patient medications by hospital</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="px-4 py-2 bg-blue-100 rounded-xl">
                <span className="text-blue-700 font-semibold">{stats.totalPatients}</span>
                <span className="text-blue-500 text-sm ml-1">Patients</span>
              </div>
              <div className="px-4 py-2 bg-green-100 rounded-xl">
                <span className="text-green-700 font-semibold">{stats.totalMeds}</span>
                <span className="text-green-500 text-sm ml-1">Medicines</span>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <select
                value={selectedHospital}
                onChange={(e) => setSelectedHospital(e.target.value)}
                className="w-full pl-10 pr-8 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
              >
                <option value="all">All Hospitals ({hospitalGroups.length})</option>
                {hospitalGroups.map((g) => (
                  <option key={g.hospital_name} value={g.hospital_name}>
                    {g.hospital_name} ({g.patients.length} patients)
                  </option>
                ))}
              </select>
            </div>

            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search patient or medicine..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
              />
            </div>

            <button
              onClick={loadData}
              className="px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition flex items-center gap-2"
            >
              <RefreshCw className="w-5 h-5" />
              Refresh
            </button>
          </div>
        </motion.div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-4">
              <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
              <p className="text-gray-500">Loading...</p>
            </div>
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Pill className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No Medical Records Found</h3>
            <p className="text-gray-500">
              {selectedHospital === "all" 
                ? "No medications have been prescribed yet" 
                : `No medications for ${selectedHospital}`}
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
                  className="w-full p-4 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 transition"
                >
                  <div className="flex items-center gap-3">
                    <Building2 className="w-5 h-5 text-blue-600" />
                    <span className="font-semibold text-gray-900">{hospitalGroup.hospital_name}</span>
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-sm">
                      {hospitalGroup.patients.length} patients
                    </span>
                  </div>
                  {expandedHospitals.has(hospitalGroup.hospital_name) ? (
                    <ChevronUp className="w-5 h-5 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-500" />
                  )}
                </button>

                {/* Patients */}
                {expandedHospitals.has(hospitalGroup.hospital_name) && (
                  <div className="divide-y divide-gray-100">
                    {hospitalGroup.patients.map((patient) => {
                      const patientKey = `${hospitalGroup.hospital_name}-${patient.patient_name?.toLowerCase().trim()}`;
                      const activeMeds = patient.medicines.filter(m => m.is_active).length;
                      
                      return (
                        <div key={patientKey} className="p-4">
                          <button
                            onClick={() => togglePatient(patientKey)}
                            className="w-full flex items-center justify-between hover:bg-gray-50 rounded-lg p-2 -m-2 transition"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                                <User className="w-5 h-5 text-emerald-600" />
                              </div>
                              <div className="text-left">
                                <div className="font-medium text-gray-900">{patient.patient_name}</div>
                                <div className="text-sm text-gray-500">{patient.patient_email}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm">
                                {patient.medicines.length} meds ({activeMeds} active)
                              </span>
                              {expandedPatients.has(patientKey) ? (
                                <ChevronUp className="w-5 h-5 text-gray-400" />
                              ) : (
                                <ChevronDown className="w-5 h-5 text-gray-400" />
                              )}
                            </div>
                          </button>

                          {/* Medicines */}
                          {expandedPatients.has(patientKey) && (
                            <div className="mt-4 space-y-3 pl-13">
                              {patient.medicines.map((med, idx) => (
                                <div
                                  key={med.id}
                                  className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                                >
                                  <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs flex items-center justify-center">
                                        {idx + 1}
                                      </span>
                                      <span className="font-medium text-gray-900">{med.medicine_name}</span>
                                      <span className={`px-2 py-0.5 rounded-full text-xs ${
                                        med.is_active 
                                          ? 'bg-green-100 text-green-700' 
                                          : 'bg-gray-200 text-gray-600'
                                      }`}>
                                        {med.is_active ? 'Active' : 'Inactive'}
                                      </span>
                                    </div>
                                    <div className="text-xs text-gray-500 flex items-center gap-1">
                                      <Calendar className="w-3 h-3" />
                                      {med.created_at ? new Date(med.created_at).toLocaleDateString('en-IN') : 'N/A'}
                                    </div>
                                  </div>
                                  <div className="mt-2 text-sm text-gray-600 flex flex-wrap gap-2">
                                    {med.dosage && <span>💊 {med.dosage}</span>}
                                    {med.frequency && <span>📅 {med.frequency}</span>}
                                    {med.timing && <span>⏰ {med.timing}</span>}
                                    {med.duration && <span>📆 {med.duration}</span>}
                                  </div>
                                  {med.instructions && (
                                    <div className="mt-2 text-xs text-gray-500 bg-yellow-50 p-2 rounded">
                                      Note: {med.instructions}
                                    </div>
                                  )}
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
        )}
      </div>
    </div>
  );
}