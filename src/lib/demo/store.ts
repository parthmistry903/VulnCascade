"use client";

import { buildDemoScan } from "@/lib/demo/build";
import { DEMO_CREDENTIALS, DEMO_STORAGE, DEMO_USER, SIMULATED_SCAN_ID } from "@/lib/demo/config";
import { DEMO_SCAN_SPECS } from "@/lib/demo/dataset";
import type { AuthUser, ScanResult, ScanSummary } from "@/lib/types";

/**
 * Browser-side stand-in for the Postgres layer (`src/services/storage.ts`) and the
 * session layer (`src/services/auth.ts`).
 *
 * Everything lives in localStorage, so the demo remembers what you did across
 * reloads and "Reset demo data" puts it back exactly as it shipped.
 */

let cachedScans: ScanResult[] | null = null;

/** Seeded scans, newest first. Built once per page load so timestamps stay consistent. */
export function seededScans(): ScanResult[] {
  if (!cachedScans) {
    const now = Date.now();
    cachedScans = DEMO_SCAN_SPECS.map((spec) => buildDemoScan(spec, now)).sort(
      (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
    );
  }
  return cachedScans;
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Private-mode browsers reject writes; the demo still works, it just forgets. */
  }
}

function removeKey(key: string): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

// ----------------------------------------------------------------- session --

export function currentUser(): AuthUser | null {
  return readJson<AuthUser | null>(DEMO_STORAGE.session, null);
}

export class DemoAuthError extends Error {}

export function signIn(email: string, password: string): AuthUser {
  const emailMatches = email.trim().toLowerCase() === DEMO_CREDENTIALS.email;
  if (!emailMatches || password !== DEMO_CREDENTIALS.password) {
    throw new DemoAuthError(
      "Email or password is incorrect. This build ships a single demo account — use the credentials shown below the form."
    );
  }
  const user: AuthUser = { ...DEMO_USER };
  writeJson(DEMO_STORAGE.session, user);
  return user;
}

export function signOut(): void {
  removeKey(DEMO_STORAGE.session);
}

// ------------------------------------------------------------------- scans --

function deletedScanIds(): string[] {
  return readJson<string[]>(DEMO_STORAGE.deletedScans, []);
}

export function simulatedScan(): ScanResult | null {
  return readJson<ScanResult | null>(DEMO_STORAGE.simulatedScan, null);
}

export function saveSimulatedScan(scan: ScanResult): void {
  writeJson(DEMO_STORAGE.simulatedScan, scan);
}

/** Every scan visible right now: the visitor's simulated scan first, then the seeded set. */
export function visibleScans(): ScanResult[] {
  const removed = new Set(deletedScanIds());
  const simulated = simulatedScan();
  const scans = seededScans().filter((scan) => !removed.has(scan.scanId));
  return simulated && !removed.has(simulated.scanId) ? [simulated, ...scans] : scans;
}

export function findScan(scanId: string): ScanResult | null {
  if (scanId === SIMULATED_SCAN_ID) {
    return simulatedScan();
  }
  return visibleScans().find((scan) => scan.scanId === scanId) ?? null;
}

export function removeScan(scanId: string): boolean {
  const removed = new Set(deletedScanIds());
  if (removed.has(scanId)) {
    return false;
  }
  if (!visibleScans().some((scan) => scan.scanId === scanId)) {
    return false;
  }
  removed.add(scanId);
  writeJson(DEMO_STORAGE.deletedScans, [...removed]);
  return true;
}

export function toSummary(scan: ScanResult): ScanSummary {
  return {
    scanId: scan.scanId,
    createdAt: scan.createdAt,
    projectName: scan.projectName,
    ecosystem: scan.ecosystem,
    packageCount: scan.packageCount,
    vulnerableCount: scan.vulnerableCount,
    overallRiskScore: scan.overallRiskScore,
    riskLabel: scan.riskLabel,
    scanDurationMs: scan.scanDurationMs,
    status: scan.status
  };
}

/** True when the visitor has deleted a seeded scan or run a simulated one. */
export function isDemoDirty(): boolean {
  return deletedScanIds().length > 0 || simulatedScan() !== null;
}

/** Puts the demo workspace back to the state it ships in. Leaves the session alone. */
export function resetDemoData(): void {
  removeKey(DEMO_STORAGE.deletedScans);
  removeKey(DEMO_STORAGE.simulatedScan);
}
