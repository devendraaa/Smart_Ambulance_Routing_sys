"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import MapPageContent from "./MapPageContent";
import { useLanguage } from "@/lib/LanguageContext";

export default function MapPage() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const urlTaskId = searchParams.get("task");
  const taskId = urlTaskId || (typeof window !== 'undefined' ? localStorage.getItem("lastTaskId") : null);
  // Use taskId as key so MapPageContent fully remounts when a new route is computed.
  // When there's no taskId yet, fall back to a timestamp for the initial mount.
  const mountKey = taskId ?? (typeof window !== 'undefined' ? localStorage.getItem("lastTaskId") : Date.now().toString());

  useEffect(() => {
    // Listen for storage events in case another tab computes a new route
    const onStorage = (e: StorageEvent) => {
      if (e.key === "lastTaskId" && e.newValue) {
        window.location.href = `/map?task=${e.newValue}`;
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">{t("map.loading")}</div>}>
      <MapPageContent key={mountKey} taskId={taskId} />
    </Suspense>
  );
}
