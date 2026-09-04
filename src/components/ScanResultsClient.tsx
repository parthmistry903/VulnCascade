"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, FileJson, Info, RefreshCw } from "lucide-react";
import { AuthClient } from "@/components/AuthClient";
import { DependencyGraph } from "@/components/DependencyGraph";
import { ClientTime } from "@/components/ClientTime";
import { RiskBadge } from "@/components/RiskBadge";
import { ApiError, AUTH_REQUIRED, exportScan, fetchScan } from "@/lib/api-client";
import { DEMO_MODE, SIMULATED_SCAN_ID } from "@/lib/demo/config";
import { DEMO_SCAN_NOTES } from "@/lib/demo/dataset";
import { riskClass } from "@/lib/risk";
import type { ScanResult } from "@/lib/types";

interface ScanResultsClientProps {
  scanId: string;
  initialScan?: ScanResult;
  demoMode?: boolean;
}

export function ScanResultsClient({ scanId, initialScan, demoMode = false }: ScanResultsClientProps) {
  const [fetchedScan, setFetchedScan] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const scan = initialScan ?? fetchedScan;

  useEffect(() => {
    if (initialScan) {
      return;
    }

    let ignore = false;
    fetchScan(scanId)
      .then((data) => {
        if (ignore) {
          return;
        }
        setFetchedScan(data);
        setAuthRequired(false);
        setError(null);
        setSelectedNodeId(null);
      })
      .catch((fetchError: unknown) => {
        if (ignore) {
          return;
        }
        if (fetchError instanceof ApiError && fetchError.code === AUTH_REQUIRED) {
          setAuthRequired(true);
          setError(null);
          return;
        }
        setError(fetchError instanceof Error ? fetchError.message : "Scan not found.");
      });

    return () => {
      ignore = true;
    };
  }, [initialScan, scanId]);

  useEffect(() => {
    if (selectedNodeId) {
      document.getElementById(`pkg-${selectedNodeId}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selectedNodeId]);

  const packages = useMemo(() => {
    return [...(scan?.packages ?? [])].sort(
      (a, b) => b.riskScore - a.riskScore || b.cveCount - a.cveCount || a.name.localeCompare(b.name)
    );
  }, [scan?.packages]);

  const incompleteLookups = useMemo(
    () => packages.filter((pkg) => pkg.lookupStatus === "failed" || pkg.lookupStatus === "unavailable").length,
    [packages]
  );

  if (authRequired) {
    return <AuthClient mode="login" />;
  }

  if (error) {
    return (
      <main className="neo-panel">
        <div className="error-panel">{error}</div>
        <Link href="/" className="neo-button">
          <RefreshCw aria-hidden="true" />
          New Scan
        </Link>
      </main>
    );
  }

  if (!scan) {
    return (
      <main className="neo-panel">
        <h2 className="section-title">Loading scan...</h2>
        <div className="progress-bar indeterminate" aria-hidden="true">
          <div className="progress-fill" />
          <div className="progress-label">Loading</div>
        </div>
      </main>
    );
  }

  return (
    <main className="results-layout">
      <aside className="results-sidebar">
        <section className="risk-score-card">
          <p className="metric-label"><ClientTime value={scan.createdAt} /></p>
          <p className={`risk-number ${riskClass(scan.overallRiskScore)}`}>{scan.overallRiskScore.toFixed(1)}</p>
          <RiskBadge score={scan.overallRiskScore} />
          <div className="parse-summary" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", marginTop: 12 }}>
            <MetricCard label="Packages" value={String(scan.packageCount)} />
            <MetricCard label="Vulnerable" value={String(scan.vulnerableCount)} />
            <MetricCard label="Duration" value={`${scan.scanDurationMs}ms`} />
            <MetricCard label="Status" value={scan.status} />
          </div>
        </section>

        <section className="neo-panel">
          <div className="detail-header">
            <h2 className="compact-title">Packages</h2>
            <span className="badge">{scan.ecosystem}</span>
          </div>
          <div className="package-list">
            {packages.map((pkg) => (
              <button
                className={`package-row ${selectedNodeId === pkg.id ? "active" : ""}`}
                key={pkg.id}
                id={`pkg-${pkg.id}`}
                type="button"
                onClick={() => setSelectedNodeId(pkg.id)}
              >
                <span>
                  <span className="package-name">{pkg.name}</span>
                  <span className="metric-label">{pkg.version ?? "version not pinned"}</span>
                </span>
                <span className="package-meta">
                  <span className="badge">{pkg.cveCount} CVE</span>
                  {pkg.lookupStatus === "failed" || pkg.lookupStatus === "unavailable" ? (
                    <span className="badge lookup-warning">{pkg.lookupStatus}</span>
                  ) : null}
                  <RiskBadge score={pkg.riskScore} compact />
                </span>
              </button>
            ))}
          </div>
        </section>
      </aside>

      <section style={{ display: "grid", gap: 14, minWidth: 0 }}>
        <div className="neo-panel">
          <div className="detail-header">
            <div>
              <h2 className="compact-title">{scan.projectName}</h2>
              <p className="metric-label">{scanSubtitle(scan, demoMode)}</p>
            </div>
            <div className="nav-actions">
              <button className="neo-button" type="button" onClick={() => exportScan(scan, "json")}>
                <FileJson aria-hidden="true" />
                JSON
              </button>
              <button className="neo-button" type="button" onClick={() => exportScan(scan, "csv")}>
                <Download aria-hidden="true" />
                CSV
              </button>
            </div>
          </div>
          {DEMO_MODE ? (
            <div className="notice-panel">
              <Info aria-hidden="true" />
              <p>{demoExplanation(scan, incompleteLookups)}</p>
            </div>
          ) : null}
        </div>

        <DependencyGraph graphData={scan.graphData} selectedNodeId={selectedNodeId} onSelectNode={setSelectedNodeId} />

        <section className="accessible-table" aria-label="Accessible package table">
          <table>
            <thead>
              <tr>
                <th>Package</th>
                <th>Version</th>
                <th>Risk</th>
                <th>CVEs</th>
                <th>Blast Radius</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {packages.map((pkg) => (
                <tr key={`table-${pkg.id}`}>
                  <td className="mono">{pkg.name}</td>
                  <td>{pkg.version ?? "unknown"}</td>
                  <td>
                    <RiskBadge score={pkg.riskScore} />
                  </td>
                  <td>{pkg.cveCount}</td>
                  <td>{pkg.blastRadiusSize}</td>
                  <td>{pkg.lookupStatus === "cached" ? "success" : pkg.lookupStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {scan.warnings.length > 0 ? (
          <section className="neo-panel">
            <h2 className="compact-title">Warnings</h2>
            <div className="cve-list">
              {scan.warnings.map((warning) => (
                <div className="package-row" key={`${warning.line ?? "global"}:${warning.message}`}>
                  <span>{warning.message}</span>
                  {warning.line ? <span className="badge">line {warning.line}</span> : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}

function scanSubtitle(scan: ScanResult, demoMode: boolean): string {
  if (demoMode) {
    return "Public demo scan — no sign-in required";
  }
  if (DEMO_MODE) {
    return scan.scanId === SIMULATED_SCAN_ID ? "Simulated in your browser" : `Seeded demo scan · ${scan.scanId}`;
  }
  return `Scan ${scan.scanId}`;
}

function demoExplanation(scan: ScanResult, incompleteLookups: number): string {
  const base =
    scan.scanId === SIMULATED_SCAN_ID
      ? "You scanned this manifest in your own browser. The parser, dependency graph and risk scoring below are the production modules; the vulnerability source is a bundled advisory snapshot instead of a live Google OSV query."
      : DEMO_SCAN_NOTES[scan.scanId] ??
        "Seeded demo scan. Every edge below is a dependency the package really declares, and every score is computed by the production algorithms.";

  if (incompleteLookups === 0) {
    return base;
  }
  return `${base} ${incompleteLookups} package${incompleteLookups === 1 ? " is" : "s are"} marked grey because the lookup did not complete — unknown, not clean.`;
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-card">
      <p className="metric-value">{value}</p>
      <p className="metric-label">{label}</p>
    </div>
  );
}
