import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
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
  title: "Smart Ambulance Route",
  description: "AI-powered ambulance route optimization",
};

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/route", label: "Route" },
  { href: "/hospitals", label: "Hospitals" },
  { href: "/patient", label: "Patient" },
  { href: "/blood-bank", label: "Blood Bank" },
  { href: "/sensor", label: "Sensors" },
  { href: "/sensor-map", label: "Sensor Map" },
  { href: "/map", label: "Route Map" },
  { href: "/road-network", label: "Road Network" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <nav className="border-b bg-white px-6 py-3">
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="font-bold text-blue-600"
            >
              Smart Ambulance
            </Link>
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-sm text-gray-600 hover:text-blue-600 transition"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </nav>
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
