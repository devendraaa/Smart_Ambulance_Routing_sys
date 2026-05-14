"use client";

export const dynamic = "force-dynamic";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isLoggedIn, getUserType } from "@/lib/auth";
import HealthcareDoctorDashboard from "@/components/healthcare/HealthcareDoctorDashboard";

export default function DoctorPage() {
  const router = useRouter();

  useEffect(() => {
    const userType = getUserType();
    const loggedIn = isLoggedIn();

    if (!loggedIn || userType !== "doctor") {
      router.push("/login");
    }
  }, [router]);

  return <HealthcareDoctorDashboard />;
}