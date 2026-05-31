"use client";

import { usePathname } from "next/navigation";
import Navbar from "@/components/Navbar";
import ClientAuthWrapper from "@/components/ClientAuthWrapper";
import PatientNavbar from "@/components/healthcare/PatientNavbar";
import DoctorNavbar from "@/components/healthcare/DoctorNavbar";
import { LanguageProvider, useLanguage } from "@/lib/LanguageContext";
import "./globals.css";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();

  // No navbar on login/signup pages
  if (pathname === "/login" || pathname === "/signup") {
    return (
      <html lang="en">
        <body suppressHydrationWarning className="min-h-full flex flex-col bg-gradient-to-br from-slate-50 to-blue-50">
          <LanguageProvider>
            <main className="flex-1">{children}</main>
          </LanguageProvider>
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <body suppressHydrationWarning className="min-h-full flex flex-col bg-gradient-to-br from-slate-50 to-blue-50">
        <LanguageProvider>
          {/* Patient pages use PatientNavbar */}
          {pathname === "/patient" || pathname?.startsWith("/patient") ? (
            <PatientNavbar />
          ) : pathname === "/doctor" || pathname?.startsWith("/doctor") ? (
            <DoctorNavbar />
          ) : (
            <Navbar />
          )}

          {/* Main Content */}
          <main className="flex-1 relative z-0">
            {children}
          </main>

          {/* Footer - hidden for patient/doctor pages */}
          {!(pathname === "/patient" || pathname?.startsWith("/patient") || pathname === "/doctor" || pathname?.startsWith("/doctor")) && (
            <FooterContent />
          )}
        </LanguageProvider>
      </body>
    </html>
  );
}

function FooterContent() {
  const { t } = useLanguage();
  return (
    <footer className="bg-white border-t border-gray-100 py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🚑</span>
            <div>
              <p className="font-semibold text-sm text-gray-800">{t("brand.short")}</p>
              <p className="text-xs text-gray-500">{t("brand.emergency")}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span>{t("brand.powered")}</span>
            <span>•</span>
            <span>{t("brand.ors")}</span>
            <span>•</span>
            <span>{t("brand.copyright")}</span>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-gray-50 text-center">
          <p className="text-xs text-gray-400">
            {t("brand.devBy")}{" "}
            <span className="text-blue-600 font-medium">Devendra Chavan</span>
            {" "}(<span className="text-blue-600 font-medium">AI Engineer</span>) — {t("brand.founder")}{" "}
            <span className="text-blue-600 font-semibold">SAAVO AVINYA</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
