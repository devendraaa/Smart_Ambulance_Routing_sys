"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { fetchActiveCases, DispatchCase } from "@/lib/dispatch";

const POLL_INTERVAL = 5000;

export function useDispatchPolling() {
  const [cases, setCases] = useState<DispatchCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCase, setSelectedCase] = useState<DispatchCase | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await fetchActiveCases();
      setCases(data.cases);
      if (data.cases.length > 0 && !silent) {
        setSelectedCase(data.cases[0]);
      }
    } catch {
      // ignore polling errors
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    intervalRef.current = setInterval(() => load(true), POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [load]);

  const refresh = useCallback(() => load(false), [load]);

  return { cases, loading, selectedCase, setSelectedCase, refresh };
}
