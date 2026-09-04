"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Clipboard, FileJson, FileText, Play, Upload, WifiOff } from "lucide-react";
import { AuthClient } from "@/components/AuthClient";
import { ClientTime } from "@/components/ClientTime";
import { RiskBadge } from "@/components/RiskBadge";
import { ApiError, AUTH_REQUIRED, fetchCurrentUser, fetchHistory, parseManifest, runScan } from "@/lib/api-client";
import { ADVISORY_COUNT, ADVISORY_PACKAGE_COUNT } from "@/lib/demo/catalog";
import { DEMO_MODE } from "@/lib/demo/config";
import type { AuthUser, EcosystemInput, ParseResult, ScanSummary } from "@/lib/types";

// Deliberately a mix: some pins the offline snapshot flags, some it clears.
const SAMPLE_PACKAGE_JSON = `{
  "name": "acme-storefront",
  "dependencies": {
    "express": "4.17.1",
    "axios": "0.21.1",
    "lodash": "4.17.15",
    "jsonwebtoken": "8.5.1",
    "ws": "7.5.9",
    "ejs": "3.1.6",
    "qs": "6.7.0",
    "node-fetch": "2.6.1",
    "semver": "7.6.3",
    "tar": "6.2.1"
  },
  "devDependencies": {
    "minimist": "1.2.5",
    "json5": "2.2.0",
    "braces": "3.0.3",
    "micromatch": "4.0.8",
    "cross-spawn": "7.0.3"
  }
}`;

const SAMPLE_REQUIREMENTS_TXT = `# acme-reporting service
Flask==2.1.3
Jinja2==3.1.2
Werkzeug==2.1.2
requests==2.28.1
urllib3==1.26.14
PyYAML==5.3.1
Pillow==9.0.0
gunicorn==20.1.0
certifi==2024.7.4
cryptography==42.0.8
setuptools==70.0.0
numpy==1.26.4`;

export function HomeClient() {
  const router = useRouter();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [manifest, setManifest] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [ecosystem, setEcosystem] = useState<EcosystemInput>("auto");
  const [includeDev, setIncludeDev] = useState(true);
  const [preview, setPreview] = useState<ParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [recentScans, setRecentScans] = useState<ScanSummary[]>([]);

  useEffect(() => {
    let ignore = false;

    async function loadAccountAndHistory(): Promise<void> {
      const user = await fetchCurrentUser().catch(() => null);
      if (ignore) {
        return;
      }

      setAuthUser(user);
      setIsAuthChecking(false);

      if (!user) {
        setRecentScans([]);
        return;
      }

      try {
        const history = await fetchHistory(1, 3);
        if (!ignore) {
          setRecentScans(history.scans);
        }
      } catch {
        if (!ignore) {
          setRecentScans([]);
        }
      }
    }

    void loadAccountAndHistory();
    return () => {
      ignore = true;
    };
  }, []);

  async function handleFile(file: File): Promise<void> {
    setError(null);
    if (file.size > 1024 * 1024) {
      setError("Manifest files must be 1 MB or smaller.");
      return;
    }

    const content = await file.text();
    setPreview(null);
    setFileName(file.name);
    setManifest(content);
  }

  function loadSample(sample: string, name: string): void {
    setError(null);
    setPreview(null);
    setFileName(name);
    setManifest(sample);
  }

  async function reviewManifest(): Promise<ParseResult | null> {
    setError(null);
    setIsParsing(true);
    try {
      const parsed = await parseManifest(manifest, ecosystem, includeDev);
      setPreview(parsed);
      return parsed;
    } catch (reviewError) {
      setPreview(null);
      setError(reviewError instanceof Error ? reviewError.message : "Manifest could not be parsed.");
      return null;
    } finally {
      setIsParsing(false);
    }
  }

  async function startScan(): Promise<void> {
    if (!authUser) {
      router.push("/login");
      return;
    }

    if (!preview) {
      await reviewManifest();
      return;
    }

    setError(null);
    setIsScanning(true);
    try {
      const scan = await runScan(manifest, ecosystem, includeDev);
      // Keep the progress view on screen long enough to read; the reported
      // duration below is the real measured time, not this delay.
      await new Promise((resolve) => setTimeout(resolve, 550));
      router.push(`/scan/${scan.scanId}`);
    } catch (scanError) {
      setIsScanning(false);
      if (scanError instanceof ApiError && scanError.code === AUTH_REQUIRED) {
        router.push("/login");
        return;
      }
      setError(scanError instanceof Error ? scanError.message : "Scan failed.");
    }
  }

  if (isAuthChecking) {
    return (
      <main className="progress-view">
        <section className="neo-panel">
          <h2 className="section-title">Loading Account...</h2>
          <div className="progress-bar indeterminate" aria-hidden="true">
            <div className="progress-fill" />
            <div className="progress-label">Loading</div>
          </div>
        </section>
      </main>
    );
  }

  if (!authUser) {
    return <AuthClient mode="login" />;
  }

  if (isScanning) {
    const packageCount = preview?.packages.length ?? 0;
    return (
      <main className="progress-view">
        <section className="neo-panel">
          <h2 className="section-title">Scanning {packageCount} packages...</h2>
          <div
            className="progress-bar indeterminate"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Scan in progress"
          >
            <div className="progress-fill" />
            <div className="progress-label">Scanning</div>
          </div>
          <div className="parse-summary">
            <MetricCard label="Packages" value={String(packageCount)} />
            <MetricCard label="CVEs" value="checking" />
            <MetricCard label="Risk" value="pending" />
            <MetricCard label="Source" value={DEMO_MODE ? "offline snapshot" : "Google OSV"} />
          </div>
        </section>
        <section className="neo-panel">
          <h3 className="compact-title">Lookup Queue</h3>
          <div className="cve-list" aria-live="polite">
            {(preview?.packages ?? []).map((pkg) => (
              <div className="package-row" key={pkg.name}>
                <span className="package-name">{pkg.name}</span>
                <span className="badge">{pkg.version ?? "latest"}</span>
              </div>
            ))}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="home-grid">
      <section className="hero-panel neo-panel">
        <h2 className="section-title">Scan Your Dependencies.</h2>

        {DEMO_MODE ? (
          <div className="notice-panel">
            <WifiOff aria-hidden="true" />
            <p>
              This scan runs entirely in your browser. The parser, graph builder and risk scoring are the real modules;
              only the vulnerability source is swapped for a bundled snapshot of{" "}
              <strong>{ADVISORY_COUNT} advisories across {ADVISORY_PACKAGE_COUNT} packages</strong>. Anything outside
              that snapshot is reported as <em>unknown</em>, never as clean. Start with a sample below for the full
              picture.
            </p>
          </div>
        ) : null}

        <label
          className={`drop-zone ${isDragging ? "dragging" : ""}`}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            const file = event.dataTransfer.files.item(0);
            if (file) {
              void handleFile(file);
            }
          }}
        >
          <input
            aria-label="Upload dependency manifest"
            type="file"
            accept=".json,.txt,application/json,text/plain"
            onChange={(event) => {
              const file = event.currentTarget.files?.item(0);
              if (file) {
                void handleFile(file);
              }
            }}
          />
          <span className="drop-zone-content">
            <Upload aria-hidden="true" />
            <strong>{fileName ?? "Drop package.json or requirements.txt"}</strong>
            <span className="muted">or click to browse</span>
          </span>
        </label>

        <div className="control-grid">
          <div className="field-label">
            Ecosystem
            <div className="segmented three">
              {(["auto", "npm", "pip"] as EcosystemInput[]).map((option) => (
                <button
                  className={`segmented-button ${ecosystem === option ? "active" : ""}`}
                  key={option}
                  type="button"
                  onClick={() => {
                    setPreview(null);
                    setEcosystem(option);
                  }}
                >
                  {option === "pip" ? "Python" : option.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={includeDev}
              onChange={(event) => {
                setPreview(null);
                setIncludeDev(event.currentTarget.checked);
              }}
            />
            Include devDependencies
          </label>
          <div className="sample-actions">
            <button
              className="neo-button"
              type="button"
              onClick={() => loadSample(SAMPLE_PACKAGE_JSON, "package.json")}
            >
              <FileJson aria-hidden="true" />
              npm sample
            </button>
            <button
              className="neo-button"
              type="button"
              onClick={() => loadSample(SAMPLE_REQUIREMENTS_TXT, "requirements.txt")}
            >
              <FileText aria-hidden="true" />
              pip sample
            </button>
          </div>
        </div>

        <label className="field-label">
          Manifest
          <textarea
            className="neo-input"
            value={manifest}
            spellCheck={false}
            placeholder="Paste package.json or requirements.txt"
            onChange={(event) => {
              setPreview(null);
              setFileName(null);
              setManifest(event.currentTarget.value);
            }}
          />
        </label>

        {error ? <div className="error-panel">{error}</div> : null}

        {preview ? (
          <section className="neo-card" aria-label="Parsed manifest summary">
            <div className="parse-summary">
              <MetricCard label="Packages" value={String(preview.packages.length)} />
              <MetricCard label="Ecosystem" value={preview.ecosystem} />
              <MetricCard label="Project" value={preview.projectName} />
              <MetricCard label="Warnings" value={String(preview.warnings.length)} />
            </div>
            {preview.warnings.length > 0 ? (
              <div className="cve-list warning-list">
                {preview.warnings.map((warning) => (
                  <div className="package-row" key={`${warning.line ?? "global"}:${warning.message}`}>
                    <span>{warning.message}</span>
                    {warning.line ? <span className="badge">line {warning.line}</span> : null}
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        <div className="nav-actions">
          <button
            className="neo-button"
            type="button"
            onClick={() => void reviewManifest()}
            disabled={isParsing || !manifest.trim()}
          >
            <Clipboard aria-hidden="true" />
            {isParsing ? "Reviewing" : "Review"}
          </button>
          <button className="neo-button primary" type="button" onClick={() => void startScan()} disabled={!preview}>
            <Play aria-hidden="true" />
            Scan Now
          </button>
        </div>
      </section>

      <section className="neo-panel">
        <h3 className="compact-title">Recent Scans</h3>
        {recentScans.length === 0 ? (
          <div className="empty-panel">
            <FileText aria-hidden="true" /> No scans yet
          </div>
        ) : (
          <div className="recent-grid">
            {recentScans.map((scan) => (
              <Link className="neo-card recent-card" href={`/scan/${scan.scanId}`} key={scan.scanId}>
                <p className="metric-label"><ClientTime value={scan.createdAt} /></p>
                <p className="metric-value">{scan.packageCount}</p>
                <p className="metric-label">packages · {scan.vulnerableCount} vulnerable</p>
                <RiskBadge score={scan.overallRiskScore} />
              </Link>
            ))}
          </div>
        )}
        {DEMO_MODE ? <p className="panel-footnote">Seeded demo workspace — restore it any time with Reset Demo.</p> : null}
      </section>
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-card">
      <p className="metric-value">{value}</p>
      <p className="metric-label">{label}</p>
    </div>
  );
}
