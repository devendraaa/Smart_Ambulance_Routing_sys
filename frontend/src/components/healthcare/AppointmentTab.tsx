"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, MapPin, Phone, AlertTriangle, Droplet, Heart, UserPlus, CheckCircle2, Clock, FileText, Stethoscope, MapPinOff, Navigation, X, PartyPopper, ExternalLink, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { fetchHospitalsList, fetchHospitalInfo, HospitalInfo } from "@/lib/api";
import FamilyMemberManager, { FamilyMember } from "./FamilyMemberManager";

const CASE_TYPES = [
  { value: "General OPD", label: "General OPD" },
  { value: "Child OPD", label: "Child OPD" },
  { value: "Heart & Emergency", label: "Heart & Emergency" },
  { value: "Accident & Trauma", label: "Accident & Trauma" },
  { value: "Neurology", label: "Neurology" },
  { value: "Diabetes & Kidney", label: "Diabetes & Kidney" },
  { value: "Women & Pregnancy", label: "Women & Pregnancy" },
  { value: "Orthopedic", label: "Orthopedic" },
  { value: "ENT / Eye", label: "ENT / Eye" },
  { value: "Mental Health", label: "Mental Health" },
  { value: "Senior Citizen", label: "Senior Citizen" },
];

const RELIGIONS = [
  { value: "Hindu", label: "Hindu" },
  { value: "Muslim", label: "Muslim" },
  { value: "Christian", label: "Christian" },
  { value: "Buddhist", label: "Buddhist" },
  { value: "Sikh", label: "Sikh" },
  { value: "Jain", label: "Jain" },
  { value: "Parsis", label: "Parsis" },
  { value: "Other", label: "Other" },
];

interface Hospital {
  id: number;
  name: string;
  address: string;
  contact: string;
  lat: number;
  lon: number;
  total_beds: number;
  available_beds: number;
  emergency_beds: number;
  specialist: string;
  distance_km: number | null;
  estimated_time_min: number | null;
  availableSlots?: HospitalSlot[];
}

interface HospitalSlot {
  date: string;
  slots: string[];
}

interface Appointment {
  id: string;
  patient_name: string;
  age: number;
  address: string;
  religion: string;
  appointment_date: string;
  case_type: string;
  hospital_id?: number;
  hospital_name?: string;
  status: string;
  created_at: string;
}

// Haversine formula to calculate distance in km
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Generate random available slots for a hospital (OPD: 8 AM to 12 PM = 8 slots of 30 min)
function generateHospitalSlots(): HospitalSlot[] {
  const slots: HospitalSlot[] = [];
  const allTimeSlots = ["08:00 AM", "08:30 AM", "09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM"];
  const today = new Date();

  for (let day = 0; day < 7; day++) {
    const date = new Date(today);
    date.setDate(today.getDate() + day);
    const dateStr = date.toISOString().split('T')[0];

    // Randomly select 2-5 available slots for each day
    const numSlots = Math.floor(Math.random() * 4) + 2;
    const availableSlots: string[] = [];
    const shuffled = [...allTimeSlots].sort(() => Math.random() - 0.5);

    for (let i = 0; i < numSlots && i < shuffled.length; i++) {
      availableSlots.push(shuffled[i]);
    }

    slots.push({ date: dateStr, slots: availableSlots.sort() });
  }

  return slots;
}

export default function AppointmentTab() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [address, setAddress] = useState("");
  const [religion, setReligion] = useState("");
  const [appointmentDate, setAppointmentDate] = useState("");
  const [caseType, setCaseType] = useState("");
  const [selectedHospital, setSelectedHospital] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [doctorInfo, setDoctorInfo] = useState<HospitalInfo | null>(null);
  const [loadingDoctorInfo, setLoadingDoctorInfo] = useState(false);
  const [success, setSuccess] = useState("");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [hospitalsLoading, setHospitalsLoading] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [userLocation, setUserLocation] = useState<{lat: number; lon: number} | null>(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [selectedSlotDate, setSelectedSlotDate] = useState<string>("");
  const [showAppointmentPopup, setShowAppointmentPopup] = useState(false);
  const [bookedAppointment, setBookedAppointment] = useState<Appointment | null>(null);
  const [showFamilyManager, setShowFamilyManager] = useState(false);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const [showUpcomingAppointments, setShowUpcomingAppointments] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get user location and fetch nearby hospitals
  const fetchNearbyHospitals = useCallback(async (lat?: number, lon?: number) => {
    setHospitalsLoading(true);
    setLocationError("");
    try {
      let originLat = lat;
      let originLon = lon;

      // If no location provided, get from localStorage or use default Mumbai coordinates
      if (!originLat || !originLon) {
        const storedLat = localStorage.getItem("lastOriginLat");
        const storedLon = localStorage.getItem("lastOriginLon");
        if (storedLat && storedLon) {
          originLat = parseFloat(storedLat);
          originLon = parseFloat(storedLon);
        } else {
          originLat = 19.0760; // Mumbai default
          originLon = 72.8777;
        }
      }

      setUserLocation({ lat: originLat, lon: originLon });

      const data = await fetchHospitalsList(originLat, originLon);
      const allHospitals = data.hospitals;

      // Calculate distances and sort by distance, then take top 5
      const hospitalsWithDistance = allHospitals.map(h => ({
        ...h,
        distance_km: h.distance_km ?? calculateDistance(originLat!, originLon!, h.lat, h.lon),
        availableSlots: generateHospitalSlots()
      }));

      const topHospitals = hospitalsWithDistance
        .sort((a, b) => (a.distance_km || 0) - (b.distance_km || 0))
        .slice(0, 5);

      setHospitals(topHospitals);
    } catch (err) {
      console.error('Error fetching hospitals:', err);
      setLocationError("Could not load hospitals");
    } finally {
      setHospitalsLoading(false);
    }
  }, []);

  const fetchFamilyMembers = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("patient_family_members")
        .select("*")
        .eq("patient_email", user.email!)
        .order("created_at", { ascending: true });
      setFamilyMembers(data || []);
    } catch (err) {
      console.error("Error fetching family members:", err);
    }
  };

  const filteredMembers = useMemo(() => {
    if (!name.trim()) return familyMembers;
    const q = name.trim().toLowerCase();
    return familyMembers.filter((m) => m.name.toLowerCase().includes(q));
  }, [name, familyMembers]);

  const upcomingAppointments = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return appointments.filter(apt => {
      if (apt.status !== 'scheduled') return false;
      const aptDate = new Date(apt.appointment_date);
      return aptDate >= today;
    });
  }, [appointments]);

  const daysUntil = (dateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateStr);
    target.setHours(0, 0, 0, 0);
    const diff = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 0) return { text: "Today", color: "bg-emerald-100 text-emerald-700" };
    if (diff === 1) return { text: "Tomorrow", color: "bg-amber-100 text-amber-700" };
    return { text: `${diff} days left`, color: "bg-blue-100 text-blue-700" };
  };

  const selectMember = (member: FamilyMember) => {
    setName(member.name);
    setAge(member.age?.toString() || "");
    setPatientPhone(member.phone || "");
    if (member.address) setAddress(member.address);
    if (member.religion) setReligion(member.religion);
    setShowMemberDropdown(false);
  };

  const handleNameChange = (value: string) => {
    setName(value);
    // If typing something that doesn't exactly match a member name, clear auto-filled fields
    const exactMatch = familyMembers.find((m) => m.name.toLowerCase() === value.trim().toLowerCase());
    if (!exactMatch) {
      // Only clear if fields were previously auto-filled from a member
      // Don't clear if user just started typing
    }
  };

  const getCurrentLocation = () => {
    setGettingLocation(true);
    setLocationError("");

    if (!navigator.geolocation) {
      setLocationError("Geolocation not supported by your browser");
      setGettingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ lat: latitude, lon: longitude });
        fetchNearbyHospitals(latitude, longitude);
        setGettingLocation(false);
      },
      (err) => {
        setLocationError("Could not get your location. Using default location.");
        setGettingLocation(false);
        fetchNearbyHospitals();
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  useEffect(() => {
    fetchNearbyHospitals();
    fetchAppointments();
    fetchFamilyMembers();
  }, [fetchNearbyHospitals]);

  // Close member dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          nameInputRef.current && !nameInputRef.current.contains(e.target as Node)) {
        setShowMemberDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Fetch doctor info when hospital and case type are selected
  useEffect(() => {
    const fetchDoctorInfo = async () => {
      if (!selectedHospital || !caseType) {
        setDoctorInfo(null);
        return;
      }

      setLoadingDoctorInfo(true);
      try {
        const hospitalName = hospitals.find(h => h.id.toString() === selectedHospital)?.name;
        if (!hospitalName) return;

        const data = await fetchHospitalInfo(hospitalName, caseType);
        if (data.length > 0) {
          // Pick a random one from available options
          const randomIndex = Math.floor(Math.random() * data.length);
          setDoctorInfo(data[randomIndex]);
        } else {
          setDoctorInfo(null);
        }
      } catch (err) {
        console.error("Error fetching doctor info:", err);
        setDoctorInfo(null);
      } finally {
        setLoadingDoctorInfo(false);
      }
    };

    fetchDoctorInfo();
  }, [selectedHospital, caseType, hospitals]);

  const fetchAppointments = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('patient_appointments')
        .select('*')
        .eq('patient_email', user.email!)
        .order('created_at', { ascending: false });

      setAppointments(data || []);
    } catch (err) {
      console.error('Error fetching appointments:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!name.trim()) { setError("Patient name is required"); return; }
    if (!age.trim() || parseInt(age) < 1 || parseInt(age) > 150) { setError("Enter a valid age (1-150)"); return; }
    if (!patientPhone.trim()) { setError("Patient phone number is required"); return; }
    if (!/^\d{10}$/.test(patientPhone.trim())) { setError("Enter a valid 10-digit phone number"); return; }
    if (!address.trim()) { setError("Address is required"); return; }
    if (!religion.trim()) { setError("Religion is required"); return; }
    if (!appointmentDate) { setError("Appointment date is required"); return; }
    if (!caseType) { setError("Please select a case type"); return; }
    if (!selectedHospital) { setError("Please select a hospital"); return; }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError("Please login to continue"); return; }

      const hospital = hospitals.find(h => h.id.toString() === selectedHospital);

      // Convert appointment date to ISO format
      let appointmentDateISO = appointmentDate;
      if (appointmentDate && !appointmentDate.includes('T')) {
        // Handle format "2025-05-20 08:00 AM" or just "2025-05-20"
        const datePart = appointmentDate.split(' ')[0];
        const timePart = appointmentDate.split(' ').slice(1).join(' ');
        if (timePart) {
          // Convert 12-hour to 24-hour
          const [time, ampm] = timePart.split(' ');
          let [hours, minutes] = time.split(':');
          if (ampm?.toLowerCase() === 'pm' && hours !== '12') hours = String(parseInt(hours) + 12);
          if (ampm?.toLowerCase() === 'am' && hours === '12') hours = '00';
          appointmentDateISO = `${datePart}T${hours}:${minutes}:00`;
        } else {
          appointmentDateISO = `${datePart}T00:00:00`;
        }
      }

      const { error } = await supabase
        .from('patient_appointments')
        .insert([{
          patient_name: name.trim(),
          age: parseInt(age),
          patient_phone: patientPhone.trim(),
          address: address.trim(),
          religion: religion.trim(),
          appointment_date: appointmentDateISO,
          case_type: caseType,
          patient_email: user.email!,
          hospital_id: parseInt(selectedHospital) || null,
          hospital_name: hospital?.name || null,
          status: 'scheduled'
        }]);

      if (error) throw error;

      // Store booked appointment for popup
      const newAppointment: Appointment = {
        id: Date.now().toString(),
        patient_name: name.trim(),
        age: parseInt(age),
        address: address.trim(),
        religion: religion.trim(),
        appointment_date: appointmentDateISO,
        case_type: caseType,
        hospital_name: hospital?.name,
        status: 'scheduled',
        created_at: new Date().toISOString()
      };
      setBookedAppointment(newAppointment);
      setShowAppointmentPopup(true);

      setName(""); setAge(""); setPatientPhone(""); setAddress(""); setReligion(""); setAppointmentDate(""); setCaseType(""); setSelectedHospital("");
      fetchAppointments();
    } catch (err: any) {
      console.error('Booking error:', err);
      setError(err?.message || err?.error?.message || JSON.stringify(err) || "Failed to book appointment");
    } finally {
      setLoading(false);
    }
  };

  const handleMemberSelect = (member: FamilyMember) => {
    setName(member.name);
    setAge(member.age?.toString() || "");
    setPatientPhone(member.phone || "");
    if (member.address) setAddress(member.address);
    if (member.religion) setReligion(member.religion);
    setShowFamilyManager(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'scheduled':
        return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">Scheduled</span>;
      case 'completed':
        return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">Completed</span>;
      case 'cancelled':
        return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">Cancelled</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Quick Actions - Single unified card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
      >
        <div className="grid grid-cols-3 divide-x divide-gray-100">
          {/* Patient Appoint */}
          <button
            onClick={() => setShowUpcomingAppointments(!showUpcomingAppointments)}
            className="flex flex-col items-center gap-1 py-3 px-1 hover:bg-amber-50/50 transition-colors relative group"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center mb-0.5">
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <span className="text-[11px] font-semibold text-gray-800 leading-tight text-center">Patient<br />Appoint</span>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${upcomingAppointments.length > 0 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
              {upcomingAppointments.length > 0 ? `${upcomingAppointments.length} upcoming` : 'None'}
            </span>
          </button>

          {/* Family Members */}
          <button
            onClick={() => setShowFamilyManager(true)}
            className="flex flex-col items-center gap-1 py-3 px-1 hover:bg-purple-50/50 transition-colors relative group"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center mb-0.5">
              <Users className="w-4 h-4 text-purple-600" />
            </div>
            <span className="text-[11px] font-semibold text-gray-800 leading-tight text-center">Family<br />Members</span>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${familyMembers.length > 0 ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'}`}>
              {familyMembers.length > 0 ? `${familyMembers.length} members` : 'Add'}
            </span>
          </button>

          {/* All Appointments */}
          <button
            onClick={() => router.push("/patient/appointments")}
            className="flex flex-col items-center gap-1 py-3 px-1 hover:bg-blue-50/50 transition-colors relative group"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-100 to-cyan-100 flex items-center justify-center mb-0.5">
              <Calendar className="w-4 h-4 text-blue-600" />
            </div>
            <span className="text-[11px] font-semibold text-gray-800 leading-tight text-center">All<br />Appointments</span>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${appointments.length > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
              {appointments.length > 0 ? `${appointments.length} total` : 'None'}
            </span>
          </button>
        </div>
      </motion.div>

      {/* Upcoming Appointments (collapsible) */}
      <AnimatePresence>
        {showUpcomingAppointments && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
                  <Clock className="w-4.5 h-4.5 text-amber-600" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Upcoming Appointments</h2>
                  <p className="text-[11px] text-gray-500">
                    {upcomingAppointments.length > 0
                      ? `Showing ${upcomingAppointments.length} future appointment${upcomingAppointments.length !== 1 ? 's' : ''}`
                      : 'No upcoming appointments'}
                  </p>
                </div>
              </div>
              {upcomingAppointments.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
                    <Calendar className="w-7 h-7 text-gray-300" />
                  </div>
                  <p className="font-medium text-gray-600">No Upcoming Appointments</p>
                  <p className="text-sm mt-1">Book a new appointment using the form below</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingAppointments.map((apt) => {
                    const dayInfo = daysUntil(apt.appointment_date);
                    return (
                      <motion.div
                        key={apt.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        onClick={() => router.push(`/patient/appointment/${apt.id}`)}
                        className="group relative p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200 hover:border-amber-300 hover:shadow-lg transition-all cursor-pointer"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-gray-900 text-base truncate">{apt.patient_name}</h3>
                              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${dayInfo.color}`}>
                                {dayInfo.text}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-gray-600">
                              <span className="flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-amber-500" />
                                {new Date(apt.appointment_date).toLocaleDateString('en-IN', {
                                  day: 'numeric', month: 'short', year: 'numeric'
                                })}
                              </span>
                              {apt.appointment_date && new Date(apt.appointment_date).getHours() > 0 && (
                                <span className="flex items-center gap-1.5">
                                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                                  {new Date(apt.appointment_date).toLocaleTimeString('en-IN', {
                                    hour: '2-digit', minute: '2-digit'
                                  })}
                                </span>
                              )}
                              <span className="flex items-center gap-1.5">
                                <Heart className="w-3.5 h-3.5 text-rose-400" />
                                Age: {apt.age}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                              {apt.hospital_name && (
                                <span className="flex items-center gap-1.5 text-blue-600 font-medium">
                                  <Stethoscope className="w-3.5 h-3.5" />
                                  {apt.hospital_name}
                                </span>
                              )}
                              <span className="flex items-center gap-1.5 text-emerald-600">
                                <FileText className="w-3.5 h-3.5" />
                                {apt.case_type}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-gray-400">
                              <MapPin className="w-3 h-3" />
                              <span className="line-clamp-1">{apt.address}</span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2 shrink-0">
                            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                              Scheduled
                            </span>
                            <div className="flex items-center gap-1 text-xs text-amber-600 opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                              View Details <ExternalLink className="w-3 h-3" />
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Book New Appointment */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Book New Appointment</h2>
            <p className="text-sm text-gray-500">Schedule a visit with our medical team</p>
          </div>
        </div>

        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 text-red-500 text-sm bg-red-50 p-3 rounded-xl mb-4">
            <AlertTriangle className="w-4 h-4" /> {error}
          </motion.div>
        )}

        {showSuccess && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 text-emerald-700 text-sm bg-emerald-50 p-3 rounded-xl mb-4">
            <CheckCircle2 className="w-4 h-4" /> {success}
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5"><UserPlus className="w-4 h-4 inline mr-1" />Full Name *</label>
              <div className="relative">
                <input ref={nameInputRef} type="text" value={name} onChange={(e) => handleNameChange(e.target.value)} onFocus={() => setShowMemberDropdown(true)} placeholder="Enter patient full name or select from family" className="w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 focus:border-emerald-500 focus:outline-none transition" required />
                {familyMembers.length > 0 && showMemberDropdown && filteredMembers.length > 0 && (
                  <div ref={dropdownRef} className="absolute z-50 top-full mt-1 left-0 right-0 bg-white rounded-xl border-2 border-emerald-200 shadow-lg max-h-56 overflow-y-auto">
                    {filteredMembers.map((member) => (
                      <button key={member.id} type="button" onClick={() => selectMember(member)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-emerald-50 text-left transition border-b border-gray-100 last:border-0">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center shrink-0">
                          <UserPlus className="w-4 h-4 text-purple-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{member.name}</p>
                          <p className="text-xs text-gray-500">{member.age ? `${member.age}y` : ""} {member.blood_group ? `| ${member.blood_group}` : ""} {member.phone ? `| ${member.phone}` : ""}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {familyMembers.length > 0 && showMemberDropdown && filteredMembers.length === 0 && name.trim() && (
                  <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-white rounded-xl border-2 border-gray-200 shadow-lg p-4 text-center text-sm text-gray-400">
                    No matching family members found
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5"><Heart className="w-4 h-4 inline mr-1" />Age *</label>
              <input type="number" min="1" max="150" value={age} onChange={(e) => setAge(e.target.value)} placeholder="Enter age" className="w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 focus:border-emerald-500 focus:outline-none transition" required />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5"><Phone className="w-4 h-4 inline mr-1" />Phone Number *</label>
              <input type="tel" value={patientPhone} onChange={(e) => setPatientPhone(e.target.value)} placeholder="Enter 10-digit mobile number" maxLength={10} className="w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 focus:border-emerald-500 focus:outline-none transition" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5"><Droplet className="w-4 h-4 inline mr-1" />Religion *</label>
              <select value={religion} onChange={(e) => setReligion(e.target.value)} className="w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 focus:border-emerald-500 focus:outline-none transition bg-white" required>
                <option value="">Select religion</option>
                {RELIGIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
          </div>

          {/* Hospital Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              <Stethoscope className="w-4 h-4 inline mr-1" />Select Hospital *
            </label>
            {hospitalsLoading ? (
              <div className="flex items-center justify-center py-3 text-gray-500">
                <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mr-2" />
                Loading hospitals...
              </div>
            ) : (
              <div className="space-y-3">
                <select
                  value={selectedHospital}
                  onChange={(e) => { setSelectedHospital(e.target.value); setSelectedSlotDate(""); setAppointmentDate(""); }}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 focus:border-emerald-500 focus:outline-none transition bg-white"
                  required
                >
                  <option value="">Select a hospital</option>
                  {hospitals.map((hospital) => (
                    <option key={hospital.id} value={hospital.id}>
                      {hospital.name} - {hospital.distance_km ? `${hospital.distance_km.toFixed(1)} km` : 'N/A'} away ({hospital.available_beds} beds available)
                    </option>
                  ))}
                </select>

                {/* Slot Availability */}
                {selectedHospital && hospitals.find(h => h.id.toString() === selectedHospital)?.availableSlots && (
                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                    <p className="text-xs font-medium text-emerald-700 mb-2 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> Available Slots (OPD: 8:00 AM - 12:00 PM)
                    </p>
                    <div className="space-y-2">
                      <select
                        value={selectedSlotDate}
                        onChange={(e) => setSelectedSlotDate(e.target.value)}
                        className="w-full rounded-lg border border-emerald-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none bg-white"
                      >
                        <option value="">Select date</option>
                        {hospitals.find(h => h.id.toString() === selectedHospital)?.availableSlots?.map((slot) => (
                          <option key={slot.date} value={slot.date}>
                            {new Date(slot.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} - {slot.slots.length} slots available
                          </option>
                        ))}
                      </select>
                      {selectedSlotDate && (
                        <div className="flex flex-wrap gap-1.5">
                          {hospitals.find(h => h.id.toString() === selectedHospital)?.availableSlots?.find(s => s.date === selectedSlotDate)?.slots.map((time) => (
                            <button
                              key={time}
                              type="button"
                              onClick={() => setAppointmentDate(selectedSlotDate + ' ' + time)}
                              className={`px-2 py-1 text-xs rounded-lg border transition ${
                                appointmentDate === selectedSlotDate + ' ' + time
                                  ? 'bg-emerald-600 text-white border-emerald-600'
                                  : 'bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                              }`}
                            >
                              {time}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
            <button type="button" onClick={getCurrentLocation} disabled={gettingLocation}
              className="mt-2 flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium">
              {gettingLocation ? (
                <><div className="w-3 h-3 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />Getting location...</>
              ) : (
                <><Navigation className="w-3 h-3" />Find hospitals near me</>
              )}
            </button>
          </div>

          <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5"><MapPin className="w-4 h-4 inline mr-1" />Address *</label>
              <textarea value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Enter full address" rows={2} className="w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 focus:border-emerald-500 focus:outline-none transition resize-none" required />
            </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                <Calendar className="w-4 h-4 inline mr-1" />
                {selectedSlotDate ? "Selected Slot" : "Appointment Date"} *
              </label>
              {selectedSlotDate ? (
                <div className="w-full rounded-xl border-2 border-emerald-500 bg-emerald-50 px-4 py-2.5 text-emerald-700 font-medium">
                  {new Date(selectedSlotDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  {appointmentDate.includes(' ') && ` at ${appointmentDate.split(' ').slice(1).join(' ')}`}
                </div>
              ) : (
                <input type="date" value={appointmentDate.split(' ')[0]} onChange={(e) => setAppointmentDate(e.target.value)} min={new Date().toISOString().split('T')[0]} className="w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 focus:border-emerald-500 focus:outline-none transition" required />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5"><Stethoscope className="w-4 h-4 inline mr-1" />Case Type *</label>
              <select value={caseType} onChange={(e) => setCaseType(e.target.value)} className="w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 focus:border-emerald-500 focus:outline-none transition bg-white" required>
                <option value="">Select case type</option>
                {CASE_TYPES.map((ct) => <option key={ct.value} value={ct.value}>{ct.label}</option>)}
              </select>
            </div>
          </div>

          {/* Doctor Info Display */}
          {selectedHospital && caseType && (
            <div className="p-4 bg-gradient-to-r from-emerald-50 to-cyan-50 rounded-xl border border-emerald-200">
              {loadingDoctorInfo ? (
                <div className="flex items-center gap-2 text-emerald-600">
                  <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                  Finding available doctor...
                </div>
              ) : doctorInfo ? (
                <div>
                  <p className="text-xs font-medium text-emerald-700 mb-2 flex items-center gap-1">
                    <Stethoscope className="w-3.5 h-3.5" /> Assigned Doctor & Ward Details
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-white/80 rounded-lg p-2">
                      <p className="text-xs text-gray-500">Doctor</p>
                      <p className="text-sm font-medium text-gray-800">Dr. {doctorInfo.doctor_name}</p>
                    </div>
                    <div className="bg-white/80 rounded-lg p-2">
                      <p className="text-xs text-gray-500">Ward No</p>
                      <p className="text-sm font-medium text-gray-800">{doctorInfo.ward_no}</p>
                    </div>
                    <div className="bg-white/80 rounded-lg p-2">
                      <p className="text-xs text-gray-500">Floor</p>
                      <p className="text-sm font-medium text-gray-800">{doctorInfo.floor_no}</p>
                    </div>
                    <div className="bg-white/80 rounded-lg p-2">
                      <p className="text-xs text-gray-500">Bed No</p>
                      <p className="text-sm font-medium text-gray-800">{doctorInfo.bed_no || "TBD"}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-amber-600">No doctor info available for this hospital & case type. Please contact hospital.</p>
              )}
            </div>
          )}

          <motion.button type="submit" disabled={loading || !selectedHospital} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-6 py-3 font-semibold text-white shadow-lg hover:shadow-xl transition-shadow flex items-center justify-center gap-2 disabled:opacity-50">
            {loading ? <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />Booking...</> : <><Calendar className="w-5 h-5" />Book Appointment</>}
          </motion.button>
        </form>
      </motion.div>

      {/* Family Member Manager Modal */}
      <FamilyMemberManager
        isOpen={showFamilyManager}
        onClose={() => setShowFamilyManager(false)}
        onMemberSelect={handleMemberSelect}
      />

      {/* Appointment Confirmation Popup */}
      {showAppointmentPopup && bookedAppointment && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center p-3 sm:p-4 pt-16 sm:pt-20 z-[9999] overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white w-full max-w-[340px] sm:max-w-[380px] rounded-2xl overflow-hidden shadow-2xl border border-gray-100"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3 sm:px-5 sm:py-4 flex items-center gap-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                <PartyPopper className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white">Appointment Confirmed!</h2>
                <p className="text-emerald-100 text-[10px] sm:text-xs">Booking placed successfully</p>
              </div>
            </div>

            {/* Appointment Details */}
            <div className="p-3 sm:p-4 space-y-2.5">
              {/* Date & Time */}
              <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Calendar className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-emerald-600 font-medium">Date & Time</p>
                    <p className="text-sm font-bold text-gray-900 truncate">
                      {new Date(bookedAppointment.appointment_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                    {bookedAppointment.appointment_date && new Date(bookedAppointment.appointment_date).getHours() > 0 && (
                      <p className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(bookedAppointment.appointment_date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Patient Info Row */}
              <div className="flex gap-2">
                <div className="flex-1 bg-gray-50 rounded-lg p-2.5">
                  <p className="text-[10px] text-gray-500">Patient</p>
                  <p className="text-xs font-semibold text-gray-800 truncate">{bookedAppointment.patient_name}</p>
                </div>
                <div className="w-16 bg-gray-50 rounded-lg p-2.5">
                  <p className="text-[10px] text-gray-500">Age</p>
                  <p className="text-xs font-semibold text-gray-800">{bookedAppointment.age}</p>
                </div>
              </div>

              <div className="flex gap-2">
                <div className="flex-1 bg-gray-50 rounded-lg p-2.5">
                  <p className="text-[10px] text-gray-500">Case</p>
                  <p className="text-xs font-semibold text-gray-800 truncate">{bookedAppointment.case_type}</p>
                </div>
                <div className="w-20 bg-emerald-50 rounded-lg p-2.5 flex items-center justify-center">
                  <span className="text-[10px] font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">Scheduled</span>
                </div>
              </div>

              {/* Hospital */}
              {bookedAppointment.hospital_name && (
                <div className="bg-blue-50 rounded-lg p-2.5 border border-blue-100 flex items-center gap-2">
                  <Stethoscope className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-blue-600">Hospital</p>
                    <p className="text-xs font-semibold text-gray-800 truncate">{bookedAppointment.hospital_name}</p>
                  </div>
                </div>
              )}

              {/* Reminder */}
              <div className="bg-amber-50 rounded-lg p-2 border border-amber-100 flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-amber-800">Carry ID proof & arrive 15 min early</p>
              </div>
            </div>

            {/* Close Button */}
            <div className="px-3 pb-3 sm:px-4 sm:pb-4">
              <button
                onClick={() => setShowAppointmentPopup(false)}
                className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl font-medium text-sm shadow-md"
              >
                Got It!
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
