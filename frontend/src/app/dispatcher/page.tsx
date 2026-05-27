"use client";

export const dynamic = "force-dynamic";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DispatcherPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/doctor?tab=dispatch");
  }, [router]);

  return null;
}
