"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { logout, getUser } from "@/lib/auth";
import DoctorPatientInfo from "./DoctorPatientInfo";
import DoctorAppointmentsTab from "./DoctorAppointmentsTab";
import DoctorMedicinesTab from "./DoctorMedicinesTab";
import DoctorReportsTab from "./DoctorReportsTab";
import DoctorDietTab from "./DoctorDietTab";
import DoctorEmergencyTab from "./DoctorEmergencyTab";
import HospitalInfoTab from "./HospitalInfoTab";

function TabContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("patient-info");

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const user = getUser();

  const renderTabContent = () => {
    switch (activeTab) {
      case "patient-info":
        return <DoctorPatientInfo />;
      case "emergency":
        return <DoctorEmergencyTab />;
      case "appointments":
        return <DoctorAppointmentsTab />;
      case "medicines":
        return <DoctorMedicinesTab />;
      case "reports":
        return <DoctorReportsTab />;
      case "diet":
        return <DoctorDietTab />;
      case "hospital-info":
        return <HospitalInfoTab />;
      default:
        return <DoctorPatientInfo />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3 sm:p-6"
        >
          {renderTabContent()}
        </motion.div>
      </div>
    </div>
  );
}

export default function HealthcareDoctorDashboard() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading dashboard...</div>}>
      <TabContent />
    </Suspense>
  );
}