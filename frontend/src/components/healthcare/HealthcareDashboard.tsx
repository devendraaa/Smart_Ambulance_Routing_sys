"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import AppointmentTab from "./AppointmentTab";
import ReportTab from "./ReportTab";
import TestTab from "./TestTab";
import MedicineTab from "./MedicineTab";
import AIDoctorTab from "./AIDoctorTab";
import VirtualDoctorTab from "./VirtualDoctorTab";

function TabContent() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState("appointment");

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  switch (activeTab) {
    case "appointment":
      return <AppointmentTab />;
    case "report":
      return <ReportTab />;
    case "test":
      return <TestTab />;
    case "medicine":
      return <MedicineTab />;
    case "ai":
      return <AIDoctorTab />;
    case "virtual":
      return <VirtualDoctorTab />;
    default:
      return <AppointmentTab />;
  }
}

export default function HealthcareDashboard() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Suspense fallback={<div className="p-8 text-center">Loading...</div>}>
        <TabContent />
      </Suspense>
    </div>
  );
}
