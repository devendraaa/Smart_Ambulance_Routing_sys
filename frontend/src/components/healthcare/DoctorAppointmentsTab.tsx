"use client";

import { useState, useEffect } from "react";
import { Calendar, Search, Filter } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Appointment {
  id: string;
  patient_name: string;
  patient_email: string;
  age: number;
  address: string;
  religion: string;
  appointment_date: string;
  case_type: string;
  hospital_name: string;
  status: string;
  created_at: string;
}

export default function DoctorAppointmentsTab() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);

  useEffect(() => {
    loadAppointments();
  }, []);

  const loadAppointments = async () => {
    try {
      const { data, error } = await supabase
        .from("patient_appointments")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAppointments(data || []);
    } catch (err) {
      console.error("Error loading appointments:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredAppointments = appointments.filter((apt) => {
    const matchesSearch = apt.patient_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      apt.patient_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      apt.hospital_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === "all" || apt.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const updateAppointmentStatus = async (aptId: string, newStatus: string) => {
    try {
      await supabase
        .from("patient_appointments")
        .update({ status: newStatus })
        .eq("id", aptId);

      setAppointments(appointments.map((apt) =>
        apt.id === aptId ? { ...apt, status: newStatus } : apt
      ));
      setSelectedAppointment(null);
    } catch (err) {
      console.error("Error updating status:", err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-600" />
          All Patient Appointments
        </h2>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search patient..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-lg border-2 border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none bg-white"
          >
            <option value="all">All Status</option>
            <option value="scheduled">Scheduled</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading appointments...</div>
      ) : filteredAppointments.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No appointments found</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Patient</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Case Type</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Hospital</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Date</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredAppointments.map((apt) => (
                <tr key={apt.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{apt.patient_name}</p>
                    <p className="text-xs text-gray-500">{apt.patient_email}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{apt.case_type}</td>
                  <td className="px-4 py-3 text-gray-600">{apt.hospital_name || "N/A"}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {new Date(apt.appointment_date).toLocaleDateString("en-IN")}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      apt.status === "scheduled" ? "bg-blue-100 text-blue-700" :
                      apt.status === "completed" ? "bg-green-100 text-green-700" :
                      "bg-red-100 text-red-700"
                    }`}>
                      {apt.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setSelectedAppointment(apt)}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      View / Update
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Appointment Detail Modal */}
      {selectedAppointment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Appointment Details</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Patient Name:</span>
                <span className="font-medium">{selectedAppointment.patient_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Email:</span>
                <span className="font-medium">{selectedAppointment.patient_email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Age:</span>
                <span className="font-medium">{selectedAppointment.age}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Case Type:</span>
                <span className="font-medium">{selectedAppointment.case_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Hospital:</span>
                <span className="font-medium">{selectedAppointment.hospital_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Address:</span>
                <span className="font-medium">{selectedAppointment.address}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Current Status:</span>
                <span className={`font-medium ${
                  selectedAppointment.status === "scheduled" ? "text-blue-600" :
                  selectedAppointment.status === "completed" ? "text-green-600" : "text-red-600"
                }`}>
                  {selectedAppointment.status}
                </span>
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <button
                onClick={() => updateAppointmentStatus(selectedAppointment.id, "completed")}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition"
              >
                Mark Completed
              </button>
              <button
                onClick={() => updateAppointmentStatus(selectedAppointment.id, "cancelled")}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={() => setSelectedAppointment(null)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}