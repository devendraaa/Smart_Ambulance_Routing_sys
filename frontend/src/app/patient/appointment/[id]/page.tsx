"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import jsPDF from "jspdf";
import { QRCodeCanvas } from "qrcode.react";
import { Calendar, MapPin, Heart, Stethoscope, ArrowLeft, Clock, Building2, Phone, User, AlertTriangle, UserRound, DoorOpen, Layers, Bed, FileDown, Droplet } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { fetchHospitalInfo } from "@/lib/api";

interface DoctorInfo {
  id: string;
  hospital_name: string;
  case_type: string;
  doctor_name: string;
  ward_no: string;
  floor_no: string;
  bed_no: string | null;
}

interface FamilyMember {
  id: string;
  patient_email: string;
  patient_uhid?: string;
  name: string;
  age: number | null;
  blood_group: string;
  phone: string;
  address: string;
  religion: string;
  created_at: string;
}

interface Appointment {
  id: string;
  patient_name: string;
  patient_email: string;
  patient_phone?: string;
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

const statusStyles: Record<string, { bg: string; text: string; label: string }> = {
  scheduled: { bg: "bg-blue-100", text: "text-blue-700", label: "Scheduled" },
  completed: { bg: "bg-green-100", text: "text-green-700", label: "Completed" },
  cancelled: { bg: "bg-red-100", text: "text-red-700", label: "Cancelled" },
};

export default function AppointmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [doctorInfo, setDoctorInfo] = useState<DoctorInfo | null>(null);
  const [loadingDoctor, setLoadingDoctor] = useState(false);
  const [matchingMember, setMatchingMember] = useState<FamilyMember | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    fetchAppointment();
  }, []);

  const fetchAppointment = async () => {
    try {
      const { data, error } = await supabase
        .from("patient_appointments")
        .select("*")
        .eq("id", params.id)
        .single();

      if (error) throw error;
      setAppointment(data);
      if (data?.hospital_name && data?.case_type) {
        fetchDoctorDetails(data.hospital_name, data.case_type);
      }
      if (data?.patient_email) {
        fetchMatchingMember(data.patient_email, data.patient_name);
      }
    } catch (err) {
      console.error("Error fetching appointment:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMatchingMember = async (email: string, patientName: string) => {
    try {
      const { data } = await supabase
        .from("patient_family_members")
        .select("*")
        .eq("patient_email", email);

      if (data) {
        const match = data.find(
          (m) => m.name.toLowerCase().trim() === patientName.toLowerCase().trim()
        );
        if (match) {
          setMatchingMember(match);
        }
      }
    } catch (err) {
      console.error("Error fetching family member:", err);
    }
  };

  const fetchDoctorDetails = async (hospitalName: string, caseType: string) => {
    setLoadingDoctor(true);
    try {
      const data = await fetchHospitalInfo(hospitalName, caseType);
      if (data.length > 0) {
        const randomIndex = Math.floor(Math.random() * data.length);
        setDoctorInfo(data[randomIndex]);
      }
    } catch (err) {
      console.error("Error fetching doctor info:", err);
    } finally {
      setLoadingDoctor(false);
    }
  };

  const cardRef = useRef<HTMLDivElement>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const downloadPdf = () => {
    if (!appointment) return;
    setDownloadingPdf(true);

    try {
      const pdf = new jsPDF("p", "mm", "a4");
      const pw = pdf.internal.pageSize.getWidth();
      const ph = pdf.internal.pageSize.getHeight();
      const ml = 16;
      const mr = 16;
      const cw = pw - ml - mr;
      let y = 20;

      const fmt = (d: string) =>
        new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

      // --- Helper functions ---
      const section = (title: string) => {
        pdf.setFillColor(209, 250, 229);
        pdf.rect(ml, y - 3, cw, 8, "F");
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(11);
        pdf.setTextColor(6, 95, 70);
        pdf.text(title, ml + 2, y + 3);
        y += 12;
      };

      const row = (label: string, value: string, color: number[] = [55, 65, 81]) => {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(10);
        pdf.setTextColor(107, 114, 128);
        pdf.text(label, ml, y);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(color[0], color[1], color[2]);
        pdf.text(value, ml + 50, y);
        y += 6;
      };

      const divider = () => {
        pdf.setDrawColor(229, 231, 235);
        pdf.line(ml, y, ml + cw, y);
        y += 6;
      };

      // --- Header ---
      pdf.setFillColor(16, 185, 129);
      pdf.rect(0, 0, pw, 24, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(16);
      pdf.setTextColor(255, 255, 255);
      pdf.text("Appointment Details", ml, 10);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.text(appointment.patient_name, ml, 18);

      // --- Status ---
      const statusColors: Record<string, number[]> = {
        scheduled: [59, 130, 246],
        completed: [22, 163, 74],
        cancelled: [220, 38, 38],
      };
      const sc = statusColors[appointment.status] || [59, 130, 246];
      pdf.setFillColor(sc[0], sc[1], sc[2]);
      pdf.rect(ml, y, 24, 6, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.setTextColor(255, 255, 255);
      pdf.text((appointment.status || "scheduled").toUpperCase(), ml + 2, y + 4.5);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(156, 163, 175);
      pdf.text(`Booked on ${fmt(appointment.created_at)}`, ml + 30, y + 4.5);
      y += 14;

      divider();

      // --- Date & Hospital ---
      section("Appointment Info");
      row("Date:", fmt(appointment.appointment_date));
      const aptTime = new Date(appointment.appointment_date);
      if (aptTime.getHours() > 0) {
        row("Time:", aptTime.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }));
      }
      row("Hospital:", appointment.hospital_name || "Not assigned", [29, 78, 216]);
      row("Case Type:", appointment.case_type, [6, 95, 70]);

      // --- Doctor & Ward ---
      if (doctorInfo) {
        divider();
        section("Doctor & Ward Details");
        row("Doctor:", `Dr. ${doctorInfo.doctor_name}`, [109, 40, 217]);
        row("Ward No:", doctorInfo.ward_no, [8, 145, 178]);
        row("Floor:", doctorInfo.floor_no, [217, 119, 6]);
        row("Bed No:", doctorInfo.bed_no || "TBD", [13, 148, 136]);
      }

      // --- Patient Info ---
      divider();
      section("Patient Information");
      row("Full Name:", appointment.patient_name);
      row("Age:", `${appointment.age} years`);
      row("Phone:", appointment.patient_phone || "N/A");
      if (matchingMember?.blood_group) {
        row("Blood Group:", matchingMember.blood_group, [220, 38, 38]);
      }
      row("Religion:", appointment.religion);
      row("Address:", appointment.address);

      // --- QR Code ---
      if (qrCanvasRef.current) {
        try {
          const qrImg = qrCanvasRef.current.toDataURL("image/png");
          y += 4;
          pdf.setFillColor(249, 250, 251);
          pdf.rect(ml, y, cw, 52, "F");
          pdf.setDrawColor(229, 231, 235);
          pdf.rect(ml, y, cw, 52, "S");
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(9);
          pdf.setTextColor(55, 65, 81);
          pdf.text("Patient QR Code", ml + 2, y + 5);
          const qrSize = 36;
          const qrX = ml + cw / 2 - qrSize / 2;
          pdf.addImage(qrImg, "PNG", qrX, y + 8, qrSize, qrSize);
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(8);
          pdf.setTextColor(107, 114, 128);
          pdf.text(matchingMember?.patient_uhid || "", ml + cw / 2, y + 48, { align: "center" });
          y += 56;
        } catch (_e) {
          // QR image failed, skip
        }
      }

      // --- Reminder ---
      y += 4;
      pdf.setFillColor(254, 243, 199);
      pdf.rect(ml, y, cw, 14, "F");
      pdf.setDrawColor(252, 211, 77);
      pdf.rect(ml, y, cw, 14, "S");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.setTextColor(146, 64, 14);
      pdf.text("Important Reminder", ml + 2, y + 5);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(180, 83, 9);
      pdf.text("Carry a valid ID proof and arrive at least 15 minutes before your appointment time.", ml + 2, y + 11);

      // --- Footer ---
      y = ph - 16;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(156, 163, 175);
      pdf.text("Smart Ambulance - Healthcare Portal", ml, y);
      pdf.text(new Date().toLocaleDateString("en-IN"), pw - mr, y, { align: "right" });

      pdf.save(`appointment_${appointment.patient_name.replace(/\s+/g, "_")}.pdf`);
    } catch (err) {
      console.error("PDF generation error:", err);
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Appointment not found</p>
          <button onClick={() => router.push("/patient")} className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const statusStyle = statusStyles[appointment.status] || statusStyles.scheduled;

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-4 sm:p-6">
      <div className="max-w-2xl mx-auto">
        {/* Back button */}
        <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition">
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">Back</span>
        </button>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-6 py-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center shrink-0">
                  <Calendar className="w-6 h-6 text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-xl font-bold text-white">Appointment Details</h1>
                  <p className="text-emerald-100 text-sm truncate">{appointment.patient_name}</p>
                </div>
              </div>
              <button
                onClick={downloadPdf}
                disabled={downloadingPdf}
                className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50"
              >
                <FileDown className="w-4 h-4" />
                {downloadingPdf ? "Downloading..." : "PDF"}
              </button>
            </div>
          </div>

          <div className="p-4 sm:p-6 space-y-6">
            {/* Status */}
            <div className="flex items-center justify-between">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                {statusStyle.label}
              </span>
              <span className="text-xs text-gray-400">
                Booked on {new Date(appointment.created_at).toLocaleDateString("en-IN")}
              </span>
            </div>

            {/* Date & Hospital */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                    <Clock className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs text-emerald-600 font-medium">Date & Time</p>
                    <p className="font-semibold text-gray-900">
                      {new Date(appointment.appointment_date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                    </p>
                    {new Date(appointment.appointment_date).getHours() > 0 && (
                      <p className="text-sm text-emerald-700">
                        {new Date(appointment.appointment_date).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-blue-600 font-medium">Hospital</p>
                    <p className="font-semibold text-gray-900 truncate">{appointment.hospital_name || "Not assigned"}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Doctor & Ward Details */}
            {(doctorInfo || loadingDoctor) && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-3">Doctor & Ward Details</h3>
                {loadingDoctor ? (
                  <div className="flex items-center gap-2 text-emerald-600 text-sm py-3">
                    <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                    Loading doctor assignment...
                  </div>
                ) : doctorInfo ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-3 border border-purple-100">
                      <div className="flex items-center gap-2">
                        <UserRound className="w-4 h-4 text-purple-500" />
                        <div>
                          <p className="text-xs text-purple-600 font-medium">Doctor</p>
                          <p className="font-semibold text-gray-900 text-sm">Dr. {doctorInfo.doctor_name}</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-gradient-to-br from-cyan-50 to-blue-50 rounded-xl p-3 border border-cyan-100">
                      <div className="flex items-center gap-2">
                        <DoorOpen className="w-4 h-4 text-cyan-500" />
                        <div>
                          <p className="text-xs text-cyan-600 font-medium">Ward No</p>
                          <p className="font-semibold text-gray-900 text-sm">{doctorInfo.ward_no}</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-3 border border-amber-100">
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-amber-500" />
                        <div>
                          <p className="text-xs text-amber-600 font-medium">Floor</p>
                          <p className="font-semibold text-gray-900 text-sm">{doctorInfo.floor_no}</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-gradient-to-br from-teal-50 to-emerald-50 rounded-xl p-3 border border-teal-100">
                      <div className="flex items-center gap-2">
                        <Bed className="w-4 h-4 text-teal-500" />
                        <div>
                          <p className="text-xs text-teal-600 font-medium">Bed No</p>
                          <p className="font-semibold text-gray-900 text-sm">{doctorInfo.bed_no || "TBD"}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {/* Patient Info */}
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-3">Patient Information</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Full Name</p>
                      <p className="font-medium text-gray-900">{appointment.patient_name}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center gap-2">
                    <Heart className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Age</p>
                      <p className="font-medium text-gray-900">{appointment.age} years</p>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Phone</p>
                      <p className="font-medium text-gray-900">{appointment.patient_phone || "N/A"}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center gap-2">
                    <Stethoscope className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-500">Case Type</p>
                      <p className="font-medium text-gray-900">{appointment.case_type}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Religion & Address */}
            <div className="space-y-3">
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500">Religion</p>
                <p className="font-medium text-gray-900">{appointment.religion}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500">Address</p>
                    <p className="font-medium text-gray-900">{appointment.address}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* QR Code */}
            {matchingMember?.patient_uhid && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 mb-3">Patient QR Code</h3>
                <div className="bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 p-4 flex flex-col items-center text-center">
                  <QRCodeCanvas
                    ref={qrCanvasRef}
                    value={JSON.stringify({
                      uhid: matchingMember.patient_uhid,
                      name: matchingMember.name,
                      bg: matchingMember.blood_group || "",
                    })}
                    size={130}
                    level="M"
                    includeMargin
                  />
                  <p className="text-sm font-bold text-gray-900 mt-2">{matchingMember.name}</p>
                  <p className="text-[10px] font-mono text-gray-500">{matchingMember.patient_uhid}</p>
                  {matchingMember.blood_group && (
                    <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-red-50 text-red-700 text-[10px] font-semibold rounded-full border border-red-200">
                      <Droplet className="w-3 h-3" /> {matchingMember.blood_group}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Reminder */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">Important Reminder</p>
                <p className="text-xs text-amber-700 mt-0.5">Carry a valid ID proof and arrive at least 15 minutes before your appointment time.</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
