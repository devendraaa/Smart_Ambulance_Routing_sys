"use client";

import dynamic from "next/dynamic";

const AuthCheck = dynamic(() => import("@/components/AuthCheck"), {
  ssr: false,
  loading: () => null,
});

export default function ClientAuthWrapper({ children }: { children: React.ReactNode }) {
  return <AuthCheck>{children}</AuthCheck>;
}
