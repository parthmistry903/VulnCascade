import { AppNav } from "@/components/AppNav";
import { HistoryDashboard } from "@/components/HistoryDashboard";

export default function HistoryPage() {
  return (
    <div className="app-shell">
      <AppNav />
      <HistoryDashboard />
    </div>
  );
}
