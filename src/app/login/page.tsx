import { AppNav } from "@/components/AppNav";
import { AuthClient } from "@/components/AuthClient";

export default function LoginPage() {
  return (
    <div className="app-shell">
      <AppNav />
      <AuthClient mode="login" />
    </div>
  );
}
