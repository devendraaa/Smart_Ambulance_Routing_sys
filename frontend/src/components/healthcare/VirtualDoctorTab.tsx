"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Video, Calendar, Star, Clock, CreditCard, CheckCircle2, AlertTriangle, Phone, Globe, Mic, MicOff } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getDoctors, getVideoConsultations, bookVideoConsultation, Doctor, VideoConsultation } from "@/lib/healthcare";

const TIME_SLOTS = ["09:00 AM", "09:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM", "02:00 PM", "02:30 PM", "03:00 PM", "03:30 PM", "04:00 PM", "04:30 PM"];

export default function VirtualDoctorTab() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [consultations, setConsultations] = useState<VideoConsultation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [showBooking, setShowBooking] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    fetchDoctors();
    fetchConsultations();
  }, []);

  const fetchDoctors = async () => {
    try {
      const data = await getDoctors();
      setDoctors(data.doctors);
    } catch (err) {
      console.error('Error fetching doctors:', err);
    }
  };

  const fetchConsultations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const data = await getVideoConsultations(user.email!);
      setConsultations(data.consultations);
    } catch (err) {
      console.error('Error fetching consultations:', err);
    }
  };

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setSuccess("");

    if (!selectedDoctor || !selectedDate || !selectedSlot) {
      setError("Please select doctor, date and time slot");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setError("Please login to continue"); return; }

      const appointmentDate = new Date(`${selectedDate}T${convertTo24Hour(selectedSlot)}`);
      await bookVideoConsultation({
        patient_email: user.email!,
        doctor_id: selectedDoctor.id,
        appointment_date: appointmentDate.toISOString(),
        notes: notes.trim() || undefined,
        consultation_fee: selectedDoctor.consultation_fee,
      });

      setSuccess("Video consultation booked successfully!");
      setShowBooking(false);
      setSelectedDoctor(null);
      setSelectedDate("");
      setSelectedSlot("");
      setNotes("");
      fetchConsultations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to book consultation");
    } finally {
      setLoading(false);
    }
  };

  const convertTo24Hour = (time12h: string) => {
    const [time, modifier] = time12h.split(" ");
    let [hours, minutes] = time.split(":");
    if (modifier === "PM" && hours !== "12") hours = String(parseInt(hours) + 12);
    if (modifier === "AM" && hours === "12") hours = "00";
    return `${hours}:${minutes}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "scheduled": return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">Scheduled</span>;
      case "in_progress": return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">In Progress</span>;
      case "completed": return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">Completed</span>;
      case "cancelled": return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">Cancelled</span>;
      default: return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">{status}</span>;
    }
  };

  const StarRating = ({ rating }: { rating: number }) => (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star key={star} className={`w-4 h-4 ${star <= Math.round(rating) ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
      ))}
      <span className="ml-1 text-sm text-gray-600">{rating.toFixed(1)}</span>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Doctor List */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
            <Video className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Virtual Doctor Consultation</h2>
            <p className="text-sm text-gray-500">Book a video call with our specialists</p>
          </div>
        </div>

        {error && <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 p-3 rounded-xl mb-4"><AlertTriangle className="w-4 h-4" />{error}</div>}
        {success && <div className="flex items-center gap-2 text-emerald-700 text-sm bg-emerald-50 p-3 rounded-xl mb-4"><CheckCircle2 className="w-4 h-4" />{success}</div>}

        {doctors.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Video className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No doctors available at the moment.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {doctors.map((doctor) => (
              <motion.div key={doctor.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="p-4 border border-gray-200 rounded-xl hover:border-indigo-300 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center flex-shrink-0">
                    <span className="text-xl font-semibold text-white">{doctor.name.split(" ").pop()?.charAt(0)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900">{doctor.name}</h3>
                    <p className="text-sm text-indigo-600 font-medium">{doctor.specialty}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{doctor.qualification}</p>
                    {doctor.rating && <StarRating rating={doctor.rating} />}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-gray-500">
                      {doctor.experience_years && <span>{doctor.experience_years} years exp</span>}
                      {doctor.languages && <span>{doctor.languages}</span>}
                    </div>
                    <p className="text-lg font-bold text-gray-900 mt-2">₹{doctor.consultation_fee?.toLocaleString()}</p>
                  </div>
                </div>
                <button onClick={() => { setSelectedDoctor(doctor); setShowBooking(true); }}
                  className="mt-4 w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium hover:shadow-lg transition-shadow">
                  Book Consultation
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Booking Modal */}
      {showBooking && selectedDoctor && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowBooking(false)}>
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Book Video Consultation</h3>
            <div className="p-4 bg-indigo-50 rounded-xl mb-4">
              <p className="font-medium text-gray-900">{selectedDoctor.name}</p>
              <p className="text-sm text-indigo-600">{selectedDoctor.specialty}</p>
              <p className="text-lg font-bold text-gray-900 mt-1">₹{selectedDoctor.consultation_fee?.toLocaleString()}</p>
            </div>

            <form onSubmit={handleBook} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5"><Calendar className="w-4 h-4 inline mr-1" />Select Date *</label>
                <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} min={new Date().toISOString().split('T')[0]}
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 focus:border-indigo-500 focus:outline-none transition" required />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2"><Clock className="w-4 h-4 inline mr-1" />Select Time *</label>
                <div className="grid grid-cols-3 gap-2">
                  {TIME_SLOTS.map((slot) => (
                    <button key={slot} type="button" onClick={() => setSelectedSlot(slot)}
                      className={`p-2 rounded-lg text-sm font-medium transition ${selectedSlot === slot ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                      {slot}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes (Optional)</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Describe your symptoms or reason for consultation..."
                  rows={2} className="w-full rounded-xl border-2 border-gray-200 px-4 py-2.5 focus:border-indigo-500 focus:outline-none transition resize-none" />
              </div>

              <div className="flex gap-3">
                <motion.button type="submit" disabled={loading} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                  className="flex-1 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-3 font-semibold text-white shadow-lg hover:shadow-xl transition-shadow flex items-center justify-center gap-2 disabled:opacity-50">
                  {loading ? <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />Booking...</> : <><CreditCard className="w-5 h-5" />Confirm Booking</>}
                </motion.button>
                <button onClick={() => setShowBooking(false)} className="px-6 py-3 rounded-xl border-2 border-gray-200 font-medium text-gray-600 hover:bg-gray-50 transition">Cancel</button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}

      {/* Upcoming Consultations */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Your Consultations</h2>
            <p className="text-sm text-gray-500">{consultations.length} scheduled</p>
          </div>
        </div>

        {consultations.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Video className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No consultations scheduled. Book one above!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {consultations.map((consult) => (
              <div key={consult.id} className="p-4 border border-gray-200 rounded-xl hover:border-indigo-300 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{consult.doctors?.name || "Doctor"}</h3>
                    <p className="text-sm text-indigo-600">{consult.doctors?.specialty}</p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-gray-600">
                      <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{new Date(consult.appointment_date).toLocaleDateString()}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{new Date(consult.appointment_date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      {consult.consultation_fee && <span>₹{consult.consultation_fee.toLocaleString()}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {getStatusBadge(consult.status)}
                    {consult.status === "scheduled" && (
                      <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-100 text-indigo-700 text-sm font-medium hover:bg-indigo-200 transition">
                        <Video className="w-4 h-4" /> Join Call
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
