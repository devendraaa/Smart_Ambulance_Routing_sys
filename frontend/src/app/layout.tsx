import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Navbar from "@/components/Navbar";
import ClientAuthWrapper from "@/components/ClientAuthWrapper";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Smart Ambulance Route | Emergency Response System",
  description: "AI-powered ambulance route optimization for emergency medical services",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialised`}
    >
      <body className="min-h-full flex flex-col bg-gradient-to-br from-slate-50 to-blue-50">
        <ClientAuthWrapper>
          <Navbar />

          {/* Main Content */}
          <main className="flex-1 min-h-[calc(100vh-4rem)]">
            {children}
          </main>

          {/* Footer */}
          <footer className="bg-white border-t border-gray-100 py-6 animate-fade-in">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🚑</span>
                  <div>
                    <p className="font-semibold text-sm text-gray-800">
                      Smart Ambulance Route
                    </p>
                    <p className="text-xs text-gray-500">
                      Emergency Response System
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <span>Powered by OpenStreetMap</span>
                  <span>•</span>
                  <span>ORS & OSRM Routing</span>
                  <span>•</span>
                  <span>© 2026</span>
                </div>
              </div>
              {/* Designed by credit */}
              <div className="mt-4 pt-4 border-t border-gray-50 text-center">
                <p className="text-xs text-gray-400">
                  Designed & Developed by{" "}
                  <span className="text-blue-600 font-medium">Devendra Chavan</span>
                  {" "}(<span className="text-blue-600 font-medium">AI Engineer</span>) — Founder of{" "}
                  <span className="text-blue-600 font-semibold">SAAVO AVINYA</span>
                </p>
              </div>
            </div>
          </footer>
        </ClientAuthWrapper>
      </body>
    </html>
  );
}
