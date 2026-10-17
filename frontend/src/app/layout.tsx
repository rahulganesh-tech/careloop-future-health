import type { Metadata } from "next";
import "./globals.css";
import { SyntheticBanner } from "@/components/SyntheticBanner";

export const metadata: Metadata = {
  title: "HealthPulse AI CareLoop — Closing the Screening-to-Care Loop",
  description: "Every actionable result gets a named owner, a time-bound next step, a patient route that works without an app, and evidence before the case can be closed.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-slate-50 antialiased">
        <SyntheticBanner />
        <main className="flex-1 flex flex-col">{children}</main>
      </body>
    </html>
  );
}
