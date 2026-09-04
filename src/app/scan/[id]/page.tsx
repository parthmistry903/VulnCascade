import { AppNav } from "@/components/AppNav";
import { ScanResultsClient } from "@/components/ScanResultsClient";
import { DEMO_MODE, SIMULATED_SCAN_ID } from "@/lib/demo/config";
import { DEMO_SCAN_IDS } from "@/lib/demo/dataset";

interface ScanPageProps {
  params: Promise<{
    id: string;
  }>;
}

/**
 * The demo build is a static export, so every reachable scan URL has to be known
 * at build time: the eight seeded scans plus `/scan/simulated`, which renders
 * whatever the visitor scanned in their own browser.
 */
export function generateStaticParams(): Array<{ id: string }> {
  if (!DEMO_MODE) {
    return [];
  }
  return [...DEMO_SCAN_IDS, SIMULATED_SCAN_ID].map((id) => ({ id }));
}

export default async function ScanPage({ params }: ScanPageProps) {
  const { id } = await params;
  return (
    <div className="app-shell">
      <AppNav />
      <ScanResultsClient scanId={id} />
    </div>
  );
}
