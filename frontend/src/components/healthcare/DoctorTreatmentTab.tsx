"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { PatientDetailContent } from "./PatientDetailPage";
import { Calendar, User, ChevronRight } from "lucide-react";

export default function DoctorTreatmentTab() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const patientId = searchParams.get("patient_id");

  if (!patientId) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Calendar className="w-8 h-8 text-blue-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Treatment & Consultation</h2>
        <p className="text-gray-500 mb-2">Select a patient from Appointments to start treatment</p>
        <button
          onClick={() => router.push("/doctor?tab=appointments")}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-medium text-sm hover:bg-blue-700 transition"
        >
          <User className="w-4 h-4" /> Go to Appointments <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <PatientDetailContent
      appointmentId={patientId}
      onBack={() => router.push("/doctor?tab=appointments")}
    />
  );
}
