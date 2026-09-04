import type { Metadata, Viewport } from "next";
import { AnonymousPageAnalytics } from "@/components/AnonymousPageAnalytics";
import { DemoBanner } from "@/components/DemoBanner";
import { GlobalLoader } from "@/components/GlobalLoader";
import { DEMO_MODE } from "@/lib/demo/config";
import "./globals.css";

export const metadata: Metadata = {
  title: "VulnCascade",
  description: "CVE Dependency Risk Cascade Mapper",
  icons: {
    icon: "/logo.svg"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#e3f6e8"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <GlobalLoader />
        {DEMO_MODE ? <DemoBanner /> : null}
        {children}
        {/* No analytics endpoint exists in the static demo build, so no beacon is sent. */}
        {DEMO_MODE ? null : <AnonymousPageAnalytics />}
      </body>
    </html>
  );
}
