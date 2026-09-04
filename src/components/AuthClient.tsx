"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import {
  Eye,
  EyeOff,
  FileJson,
  GitBranch,
  LockKeyhole,
  LogIn,
  Mail,
  Radar,
  ShieldCheck,
  User,
  UserPlus
} from "lucide-react";
import { ApiError, createAccount, signIn } from "@/lib/api-client";
import { ADVISORY_COUNT, ADVISORY_PACKAGE_COUNT } from "@/lib/demo/catalog";
import { DEMO_CREDENTIALS, DEMO_MODE } from "@/lib/demo/config";
import { DEMO_SCAN_COUNT } from "@/lib/demo/dataset";
import type { ScanResult } from "@/lib/types";

type AuthMode = "login" | "signup";

interface AuthClientProps {
  mode: AuthMode;
}

export function AuthClient({ mode }: AuthClientProps) {
  const router = useRouter();
  const isSignup = mode === "signup";
  const [name, setName] = useState("");
  const [email, setEmail] = useState(DEMO_MODE && !isSignup ? DEMO_CREDENTIALS.email : "");
  const [password, setPassword] = useState(DEMO_MODE && !isSignup ? DEMO_CREDENTIALS.password : "");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitAuth(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);

    if (isSignup && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      if (isSignup) {
        await createAccount(email, password, name);
        router.push("/login");
      } else {
        await signIn(email, password);
        window.location.href = "/";
      }
    } catch (authError) {
      const message =
        authError instanceof ApiError || authError instanceof Error
          ? authError.message
          : "Authentication failed.";
      setError(message);
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-layout">
      <div className="auth-grid">
        <ProofPanel />

        <section className="neo-panel auth-panel">
          <div className="auth-heading">
            {isSignup ? <UserPlus aria-hidden="true" /> : <LogIn aria-hidden="true" />}
            <div>
              <h2 className="section-title">{isSignup ? "Create Account." : "Sign In."}</h2>
              <p className="auth-copy">
                {DEMO_MODE && !isSignup
                  ? "Both fields are filled in. Press Sign In."
                  : "Access saved scans, history, and exports."}
              </p>
            </div>
          </div>

          {DEMO_MODE && !isSignup ? (
            <p className="demo-credentials">
              <span className="badge demo-chip">Demo</span>
              <span className="mono">
                {DEMO_CREDENTIALS.email} / {DEMO_CREDENTIALS.password}
              </span>
            </p>
          ) : null}
          {DEMO_MODE && isSignup ? (
            <div className="notice-panel">
              <ShieldCheck aria-hidden="true" />
              <p>
                Sign-up is switched off in the public demo — there is no database behind it.{" "}
                <Link href="/login">Sign in with the demo account</Link> instead, or self-host to get real accounts.
              </p>
            </div>
          ) : null}

          <form className="auth-form" onSubmit={(event) => void submitAuth(event)}>
            {isSignup ? (
              <label className="field-label">
                Name
                <span className="auth-input-wrap">
                  <User aria-hidden="true" />
                  <input
                    className="neo-input auth-input"
                    value={name}
                    autoComplete="name"
                    disabled={DEMO_MODE}
                    onChange={(event) => setName(event.currentTarget.value)}
                  />
                </span>
              </label>
            ) : null}

            <label className="field-label">
              Email
              <span className="auth-input-wrap">
                <Mail aria-hidden="true" />
                <input
                  className="neo-input auth-input"
                  type="email"
                  value={email}
                  autoComplete="email"
                  required
                  disabled={DEMO_MODE && isSignup}
                  onChange={(event) => setEmail(event.currentTarget.value)}
                />
              </span>
            </label>

            <label className="field-label">
              Password
              <span className="auth-input-wrap">
                <LockKeyhole aria-hidden="true" />
                <input
                  className="neo-input auth-input"
                  type={isPasswordVisible ? "text" : "password"}
                  value={password}
                  autoComplete={isSignup ? "new-password" : "current-password"}
                  minLength={8}
                  required
                  disabled={DEMO_MODE && isSignup}
                  onChange={(event) => setPassword(event.currentTarget.value)}
                />
                <button
                  className="password-toggle"
                  type="button"
                  aria-label={isPasswordVisible ? "Hide password" : "Show password"}
                  title={isPasswordVisible ? "Hide password" : "Show password"}
                  onClick={() => setIsPasswordVisible((value) => !value)}
                >
                  {isPasswordVisible ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}
                </button>
              </span>
            </label>

            {isSignup ? (
              <label className="field-label">
                Confirm Password
                <span className="auth-input-wrap">
                  <LockKeyhole aria-hidden="true" />
                  <input
                    className="neo-input auth-input"
                    type={isConfirmPasswordVisible ? "text" : "password"}
                    value={confirmPassword}
                    autoComplete="new-password"
                    minLength={8}
                    required
                    disabled={DEMO_MODE}
                    onChange={(event) => setConfirmPassword(event.currentTarget.value)}
                  />
                  <button
                    className="password-toggle"
                    type="button"
                    aria-label={isConfirmPasswordVisible ? "Hide confirm password" : "Show confirm password"}
                    title={isConfirmPasswordVisible ? "Hide confirm password" : "Show confirm password"}
                    onClick={() => setIsConfirmPasswordVisible((value) => !value)}
                  >
                    {isConfirmPasswordVisible ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}
                  </button>
                </span>
              </label>
            ) : null}

            {error ? <div className="error-panel">{error}</div> : null}

            <div className="auth-actions">
              <button className="neo-button primary" type="submit" disabled={isSubmitting || (DEMO_MODE && isSignup)}>
                {isSignup ? <UserPlus aria-hidden="true" /> : <LogIn aria-hidden="true" />}
                {isSubmitting ? "Please Wait" : isSignup ? "Create Account" : "Sign In"}
              </button>
              <Link className="neo-button" href="/demo">
                <Radar aria-hidden="true" />
                Try Demo Scan
              </Link>
            </div>
          </form>

          {DEMO_MODE && !isSignup ? null : (
            <p className="auth-switch">
              {isSignup ? "Already have an account? " : "Need an account? "}
              <Link href={isSignup ? "/login" : "/signup"}>{isSignup ? "Sign in" : "Create one"}</Link>
            </p>
          )}
          <p className="auth-footer">
            {DEMO_MODE
              ? `Runs offline — ${ADVISORY_COUNT} advisories bundled into the page. No server, no keys.`
              : "Public demo scans are size-limited. Do not upload private or sensitive manifests."}
          </p>
        </section>
      </div>
    </main>
  );
}

const CAPABILITIES = [
  { icon: FileJson, label: "package.json + requirements.txt" },
  { icon: Radar, label: "Google OSV advisories" },
  { icon: GitBranch, label: "Dependency graph + blast radius" }
];

function ProofPanel() {
  // Headline numbers come from the flagship seeded scan so the preview can never
  // drift from what you actually see after signing in. Computed after mount to
  // keep the prerendered markup and the hydrated markup identical.
  const [preview, setPreview] = useState<ScanResult | null>(null);

  useEffect(() => {
    if (!DEMO_MODE) {
      return;
    }

    let cancelled = false;
    void (async () => {
      const [{ buildDemoScan }, { DEMO_SCAN_SPECS }] = await Promise.all([
        import("@/lib/demo/build"),
        import("@/lib/demo/dataset")
      ]);
      const scan = buildDemoScan(DEMO_SCAN_SPECS[0], Date.now());
      if (!cancelled) {
        setPreview(scan);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="neo-panel auth-proof-panel">
      <div>
        <p className="brand-title auth-proof-brand">VulnCascade</p>
        <p className="brand-subtitle">CVE Risk Mapper</p>
      </div>
      <p className="auth-proof-copy">Scan dependency manifests before they surprise you in production.</p>

      <div className="support-list" aria-label="Supported scan capabilities">
        {CAPABILITIES.map(({ icon: Icon, label }) => (
          <span key={label}>
            <Icon aria-hidden="true" />
            {label}
          </span>
        ))}
      </div>

      <div className="scan-preview-box" aria-label="Sample scan result">
        <div className="detail-header">
          <p className="metric-label">{preview?.projectName ?? "Scan result"}</p>
          <span className={`badge ${(preview?.riskLabel ?? "High").toLowerCase()}`}>{preview?.riskLabel ?? "High"}</span>
        </div>
        <div className="scan-preview-grid">
          <PreviewMetric label="risk score" value={preview ? preview.overallRiskScore.toFixed(1) : "8.3"} />
          <PreviewMetric label="packages" value={preview ? String(preview.packageCount) : "33"} />
          <PreviewMetric label="vulnerable" value={preview ? String(preview.vulnerableCount) : "3"} />
          <PreviewMetric label="duration" value={`${preview?.scanDurationMs ?? 107}ms`} />
        </div>
      </div>

      {DEMO_MODE ? (
        <p className="proof-footnote">
          {DEMO_SCAN_COUNT} seeded scans behind the sign-in, across {ADVISORY_PACKAGE_COUNT} packages.
        </p>
      ) : null}
    </section>
  );
}

function PreviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="preview-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
