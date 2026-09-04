import { AppNav } from "@/components/AppNav";
import { AuthClient } from "@/components/AuthClient";

export default function SignupPage() {
  return (
    <div className="app-shell">
      <AppNav />
      <AuthClient mode="signup" />
    </div>
  );
}
