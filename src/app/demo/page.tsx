import { AppNav } from "@/components/AppNav";
import { ScanResultsClient } from "@/components/ScanResultsClient";
import { DEMO_SCAN } from "@/lib/demo-scan";

export default function DemoPage() {
  return (
    <div className="app-shell">
      <AppNav />
      <ScanResultsClient scanId={DEMO_SCAN.scanId} initialScan={DEMO_SCAN} demoMode />
    </div>
  );
}
