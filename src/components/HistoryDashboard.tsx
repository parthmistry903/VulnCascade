"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Eye, Info, Trash2 } from "lucide-react";
import { AuthClient } from "@/components/AuthClient";
import { ClientTime } from "@/components/ClientTime";
import { RiskBadge } from "@/components/RiskBadge";
import { ApiError, AUTH_REQUIRED, deleteScan, fetchHistory, type HistoryPayload } from "@/lib/api-client";
import { DEMO_MODE, SIMULATED_SCAN_ID } from "@/lib/demo/config";
import { DEMO_SCAN_NOTES, DEMO_SCAN_SPECS } from "@/lib/demo/dataset";
import type { ScanSummary } from "@/lib/types";

const PAGE_SIZE = 50;

export function HistoryDashboard() {
  const [history, setHistory] = useState<HistoryPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [deletingScanId, setDeletingScanId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const loadHistory = useCallback(
    async (activePage: number): Promise<void> => {
      try {
        const data = await fetchHistory(activePage, PAGE_SIZE);
        setHistory(data);
        setAuthRequired(false);
        setError(null);
      } catch (loadError) {
        if (loadError instanceof ApiError && loadError.code === AUTH_REQUIRED) {
          setAuthRequired(true);
          setError(null);
          return;
        }
        setError(loadError instanceof Error ? loadError.message : "History could not be loaded.");
      }
    },
    []
  );

  useEffect(() => {
    let ignore = false;
    void (async () => {
      if (ignore) {
        return;
      }
      await loadHistory(page);
    })();
    return () => {
      ignore = true;
    };
  }, [loadHistory, page]);

  const trend = useMemo(() => {
    const scans = [...(history?.scans ?? [])].slice(0, 10).reverse();
    if (scans.length === 0) {
      return { points: "", markers: [] as Array<{ x: number; y: number; scan: ScanSummary }> };
    }
    const step = scans.length === 1 ? 0 : 540 / (scans.length - 1);
    const markers = scans.map((scan, index) => ({
      x: 30 + index * step,
      y: 150 - scan.overallRiskScore * 12,
      scan
    }));
    return { points: markers.map((marker) => `${marker.x},${marker.y}`).join(" "), markers };
  }, [history?.scans]);

  async function removeScan(scanId: string): Promise<void> {
    const label = DEMO_MODE
      ? "Remove this scan from the demo workspace? Reset Demo in the header puts it back."
      : "Delete this scan permanently?";
    if (!window.confirm(label)) {
      return;
    }

    setDeletingScanId(scanId);
    try {
      await deleteScan(scanId);
      await loadHistory(page);
    } catch (deleteError) {
      if (deleteError instanceof ApiError && deleteError.code === AUTH_REQUIRED) {
        setAuthRequired(true);
        return;
      }
      setError(deleteError instanceof Error ? deleteError.message : "Scan could not be deleted.");
    } finally {
      setDeletingScanId(null);
    }
  }

  if (authRequired) {
    return <AuthClient mode="login" />;
  }

  if (error) {
    return <div className="error-panel">{error}</div>;
  }

  if (!history) {
    return <div className="empty-panel">Loading history</div>;
  }

  return (
    <main className="history-layout">
      <section className="neo-panel">
        <div className="detail-header">
          <h2 className="section-title">Scan History.</h2>
          <span className="badge">{history.total} scans</span>
        </div>

        {DEMO_MODE ? (
          <div className="notice-panel">
            <Info aria-hidden="true" />
            <p>
              Seeded demo workspace: {DEMO_SCAN_SPECS.length} scans across npm and pip, authored as real dependency
              trees and scored by the production algorithms. Deleting a row only affects your browser.
            </p>
          </div>
        ) : null}

        {history.pages > 1 ? (
          <div className="nav-actions history-pagination" aria-label="History pagination">
            <button className="neo-button" type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
              Previous
            </button>
            <span className="badge">
              Page {history.page} / {history.pages}
            </span>
            <button
              className="neo-button"
              type="button"
              disabled={page >= history.pages}
              onClick={() => setPage((value) => value + 1)}
            >
              Next
            </button>
          </div>
        ) : null}

        <svg className="trend-chart" viewBox="0 0 600 180" role="img" aria-label="Risk score across the last ten scans">
          <line x1="30" x2="570" y1="150" y2="150" stroke="#000000" strokeWidth="3" />
          <line x1="30" x2="30" y1="30" y2="150" stroke="#000000" strokeWidth="3" />
          {[0, 5, 10].map((score) => (
            <g key={score}>
              <line x1="25" x2="570" y1={150 - score * 12} y2={150 - score * 12} stroke="#000000" strokeWidth="1" opacity="0.2" />
              <text x="0" y={155 - score * 12} fontSize="12" fontWeight="900">
                {score}
              </text>
            </g>
          ))}
          {trend.points ? (
            <polyline points={trend.points} fill="none" stroke="#0f766e" strokeWidth="6" strokeLinejoin="round" strokeLinecap="round" />
          ) : null}
          {trend.markers.map((marker) => (
            <circle cx={marker.x} cy={marker.y} r="7" fill="#9ae6b4" stroke="#000000" strokeWidth="3" key={marker.scan.scanId}>
              <title>
                {marker.scan.scanId} — risk {marker.scan.overallRiskScore.toFixed(1)}
              </title>
            </circle>
          ))}
        </svg>
        <p className="panel-footnote">Oldest scan on the left, newest on the right.</p>
      </section>

      {history.scans.length === 0 ? (
        <div className="empty-panel">No scans saved yet</div>
      ) : (
        <section className="accessible-table">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Project</th>
                <th>Ecosystem</th>
                <th>Packages</th>
                <th>Vulnerable</th>
                <th>Risk Score</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {history.scans.map((scan) => (
                <tr key={scan.scanId}>
                  <td>
                    <ClientTime value={scan.createdAt} />
                    {scan.status === "partial" ? <span className="badge lookup-warning row-badge">partial</span> : null}
                  </td>
                  <td>
                    <span className="package-name">{scan.projectName}</span>
                    {DEMO_MODE ? (
                      <span className="row-note">
                        {scan.scanId === SIMULATED_SCAN_ID
                          ? "Scanned in your browser against the offline advisory snapshot."
                          : DEMO_SCAN_NOTES[scan.scanId] ?? "Seeded demo scan."}
                      </span>
                    ) : null}
                  </td>
                  <td>{scan.ecosystem}</td>
                  <td>{scan.packageCount}</td>
                  <td>{scan.vulnerableCount}</td>
                  <td>
                    <RiskBadge score={scan.overallRiskScore} />
                  </td>
                  <td>
                    <div className="nav-actions">
                      <Link className="neo-button" href={`/scan/${scan.scanId}`}>
                        <Eye aria-hidden="true" />
                        View
                      </Link>
                      <button
                        className="neo-button warning icon-button"
                        type="button"
                        aria-label={`Delete scan ${scan.scanId}`}
                        title="Delete"
                        disabled={deletingScanId === scan.scanId}
                        onClick={() => void removeScan(scan.scanId)}
                      >
                        <Trash2 aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
