import { AppNav } from "@/components/AppNav";
import { HomeClient } from "@/components/HomeClient";

export default function HomePage() {
  return (
    <div className="app-shell">
      <AppNav />
      <HomeClient />
    </div>
  );
}
