"use client";

import { DEMO_MODE, SIMULATED_SCAN_ID } from "@/lib/demo/config";
import { packagesToCsv } from "@/lib/export";
import type { AuthUser, EcosystemInput, ParseResult, ScanResult, ScanSummary } from "@/lib/types";

/**
 * Single seam between the UI and its data source.
 *
 * Live build  -> the Next.js route handlers in `src/app/api/*` (Postgres + OSV + NVD).
 * Demo build  -> `src/lib/demo/*` running entirely in the visitor's browser.
 *
 * Components never branch on DEMO_MODE themselves for data; they call these
 * functions, which means deleting the demo layer later is a local change.
 */

export const AUTH_REQUIRED = "AUTH_REQUIRED";

export class ApiError extends Error {
  readonly code: string | undefined;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
  }
}

export interface HistoryPayload {
  scans: ScanSummary[];
  total: number;
  page: number;
  pages: number;
}

/** Lazily pulled in so the demo dataset is never bundled into a live build's first load. */
async function demo() {
  return import("@/lib/demo/store");
}

// ------------------------------------------------------------------- auth --

export async function fetchCurrentUser(): Promise<AuthUser | null> {
  if (DEMO_MODE) {
    return (await demo()).currentUser();
  }

  const response = await fetch("/api/auth/me", { cache: "no-store" });
  if (!response.ok) {
    return null;
  }
  const data = (await response.json()) as { user: AuthUser };
  return data.user;
}

export async function signIn(email: string, password: string): Promise<AuthUser> {
  if (DEMO_MODE) {
    const store = await demo();
    try {
      return store.signIn(email, password);
    } catch (error) {
      throw new ApiError(error instanceof Error ? error.message : "Sign in failed.", "INVALID_CREDENTIALS");
    }
  }

  return postAuth("/api/auth/login", { email, password });
}

export async function createAccount(email: string, password: string, name: string): Promise<AuthUser> {
  if (DEMO_MODE) {
    throw new ApiError(
      "Account creation is turned off in the public demo — there is no database to write to. Sign in with the demo account instead.",
      "DEMO_READ_ONLY"
    );
  }

  return postAuth("/api/auth/signup", { email, password, name });
}

async function postAuth(path: string, body: Record<string, string>): Promise<AuthUser> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = (await response.json()) as { user?: AuthUser; error?: string; code?: string };
  if (!response.ok || !data.user) {
    throw new ApiError(data.error ?? "Authentication failed.", data.code);
  }
  return data.user;
}

export async function signOut(): Promise<void> {
  if (DEMO_MODE) {
    (await demo()).signOut();
    return;
  }
  await fetch("/api/auth/logout", { method: "POST" });
}

// ------------------------------------------------------------------ scans --

export async function fetchHistory(page: number, limit: number): Promise<HistoryPayload> {
  if (DEMO_MODE) {
    const store = await demo();
    if (!store.currentUser()) {
      throw new ApiError("Sign in to view scan history.", AUTH_REQUIRED);
    }
    const scans = store.visibleScans().map(store.toSummary);
    const pages = Math.max(1, Math.ceil(scans.length / limit));
    const safePage = Math.min(Math.max(1, page), pages);
    return {
      scans: scans.slice((safePage - 1) * limit, safePage * limit),
      total: scans.length,
      page: safePage,
      pages
    };
  }

  const response = await fetch(`/api/history?page=${page}&limit=${limit}`, { cache: "no-store" });
  if (response.status === 401) {
    throw new ApiError("Sign in to view scan history.", AUTH_REQUIRED);
  }
  if (!response.ok) {
    throw new ApiError("History could not be loaded.");
  }
  return (await response.json()) as HistoryPayload;
}

export async function fetchScan(scanId: string): Promise<ScanResult> {
  if (DEMO_MODE) {
    const store = await demo();
    if (!store.currentUser()) {
      throw new ApiError("Sign in to view this scan.", AUTH_REQUIRED);
    }
    const scan = store.findScan(scanId);
    if (!scan) {
      throw new ApiError(
        scanId === SIMULATED_SCAN_ID
          ? "That simulated scan is gone — browser storage was cleared. Run a new scan from the home page."
          : "Scan not found. It may have been deleted from this demo workspace.",
        "NOT_FOUND"
      );
    }
    return scan;
  }

  const response = await fetch(`/api/scan/${scanId}`, { cache: "no-store" });
  if (response.status === 401) {
    throw new ApiError("Sign in to view this scan.", AUTH_REQUIRED);
  }
  if (!response.ok) {
    throw new ApiError("Scan not found.", "NOT_FOUND");
  }
  return (await response.json()) as ScanResult;
}

export async function deleteScan(scanId: string): Promise<void> {
  if (DEMO_MODE) {
    const store = await demo();
    if (!store.currentUser()) {
      throw new ApiError("Sign in to manage scans.", AUTH_REQUIRED);
    }
    if (!store.removeScan(scanId)) {
      throw new ApiError("Scan not found.", "NOT_FOUND");
    }
    return;
  }

  const response = await fetch(`/api/scan/${scanId}`, { method: "DELETE" });
  if (response.status === 401) {
    throw new ApiError("Sign in to manage scans.", AUTH_REQUIRED);
  }
  if (!response.ok) {
    throw new ApiError("Scan could not be deleted.");
  }
}

export async function parseManifest(
  manifest: string,
  ecosystem: EcosystemInput,
  includeDev: boolean
): Promise<ParseResult> {
  if (DEMO_MODE) {
    const { parseManifest: parse } = await import("@/lib/parser");
    try {
      return await parse(manifest, ecosystem, includeDev);
    } catch (error) {
      throw new ApiError(error instanceof Error ? error.message : "Manifest could not be parsed.");
    }
  }

  const response = await fetch("/api/parse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ manifest, ecosystem, includeDev })
  });
  const data = (await response.json()) as ParseResult | { error: string };
  if (!response.ok) {
    throw new ApiError("error" in data ? data.error : "Manifest could not be parsed.");
  }
  return data as ParseResult;
}

export async function runScan(
  manifest: string,
  ecosystem: EcosystemInput,
  includeDev: boolean
): Promise<ScanResult> {
  if (DEMO_MODE) {
    const [store, { simulateScan }] = await Promise.all([demo(), import("@/lib/demo/simulate")]);
    if (!store.currentUser()) {
      throw new ApiError("Sign in to run a scan.", AUTH_REQUIRED);
    }
    let scan: ScanResult;
    try {
      scan = await simulateScan(manifest, ecosystem, includeDev);
    } catch (error) {
      throw new ApiError(error instanceof Error ? error.message : "Scan failed.");
    }
    store.saveSimulatedScan(scan);
    return scan;
  }

  const response = await fetch("/api/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ manifest, ecosystem, includeDev })
  });
  const data = (await response.json()) as ScanResult | { error: string };
  if (!response.ok) {
    throw new ApiError("error" in data ? data.error : "Scan failed.");
  }
  return data as ScanResult;
}

// ----------------------------------------------------------------- export --

export function exportScan(scan: ScanResult, format: "json" | "csv"): void {
  if (!DEMO_MODE) {
    window.location.href = `/api/scan/${scan.scanId}/export?format=${format}`;
    return;
  }

  const body = format === "csv" ? packagesToCsv(scan.packages) : JSON.stringify(scan, null, 2);
  const mimeType = format === "csv" ? "text/csv;charset=utf-8" : "application/json;charset=utf-8";
  const url = URL.createObjectURL(new Blob([body], { type: mimeType }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `vulncascade-${scan.scanId}.${format}`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
