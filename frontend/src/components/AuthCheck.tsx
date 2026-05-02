"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { isLoggedIn } from "@/lib/auth";

export default function AuthCheck({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Don't redirect if on login page or if logged in
    if (pathname === "/login") return;
    if (!isLoggedIn()) {
      router.push("/login");
    }
  }, [pathname, router]);

  // Show nothing while checking auth (prevents flash)
  if (pathname !== "/login" && !isLoggedIn()) {
    return null;
  }

  return <>{children}</>;
}
