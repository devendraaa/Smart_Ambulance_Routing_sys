"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Calendar, MapPin, Heart, Stethoscope, ArrowLeft, Clock, UserPlus, ExternalLink } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Appointment {
  id: string;
  patient_name: string;
  age: number;
  address: string;
  religion: string;
  appointment_date: string;
  case_type: string;
  hospital_name?: string;
  status: string;
  created_at: string;
}

const statusBadge = (status: string) => {
  switch (status) {
    case "scheduled":
      return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">Scheduled</span>;
    case "completed":
      return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">Completed</span>;
    case "cancelled":
      return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">Cancelled</span>;
    default:
      return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">{status}</span>;
  }
};

export default function AppointmentsPage() {
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("patient_appointments")
        .select("*")
        .eq("patient_email", user.email!)
        .order("created_at", { ascending: false });

      setAppointments(data || []);
    } catch (err) {
      console.error("Error fetching appointments:", err);
    } finally {
      setLoading(false);
    }
  };

  const grouped = new Map<string, Appointment[]>();
  for (const apt of appointments) {
    const key = apt.patient_name;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(apt);
  }
  const sortedGroups = Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-4 sm:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Back */}
        <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition">
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">Back</span>
        </button>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">All Appointments</h1>
              <p className="text-sm text-gray-500">{appointments.length} appointment{appointments.length !== 1 ? "s" : ""}</p>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            </div>
          ) : appointments.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No appointments yet.</p>
            </div>
          ) : (
            <div className="space-y-8">
              {sortedGroups.map(([patientName, apts]) => (
                <div key={patientName}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center">
                      <UserPlus className="w-4.5 h-4.5 text-blue-600" />
                    </div>
                    <h2 className="font-semibold text-gray-900 text-lg">{patientName}</h2>
                    <span className="px-2.5 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">{apts.length} appointment{apts.length !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {apts.map((apt) => (
                      <motion.div
                        key={apt.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        onClick={() => router.push(`/patient/appointment/${apt.id}`)}
                        className="p-4 border border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-md transition-all cursor-pointer bg-white"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            {apt.hospital_name && (
                              <p className="text-sm text-blue-600 font-medium truncate">{apt.hospital_name}</p>
                            )}
                          </div>
                          {statusBadge(apt.status)}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
                          <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5" />Age: {apt.age}</span>
                          <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{new Date(apt.appointment_date).toLocaleDateString()}</span>
                          <span className="flex items-center gap-1"><Stethoscope className="w-3.5 h-3.5" />{apt.case_type}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-400">
                          <MapPin className="w-3 h-3" />
                          <span className="line-clamp-1">{apt.address}</span>
                        </div>
                        <div className="mt-3 flex items-center justify-end text-xs text-blue-600 font-medium">
                          <ExternalLink className="w-3.5 h-3.5 mr-1" /> View Details
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
