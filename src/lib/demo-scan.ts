import { buildDemoScan } from "@/lib/demo/build";
import { DEMO_SCAN_SPECS } from "@/lib/demo/dataset";
import type { ScanResult } from "@/lib/types";

/**
 * The one scan anybody can open without signing in (`/demo`).
 *
 * Built from the same seeded specification as the signed-in workspace, but with a
 * fixed timestamp so the prerendered page is byte-for-byte stable across builds.
 */
const FIXED_SCAN_TIME = Date.parse("2026-08-28T07:41:00.000Z");

export const DEMO_SCAN: ScanResult = buildDemoScan(
  { ...DEMO_SCAN_SPECS[0], hoursAgo: 0 },
  FIXED_SCAN_TIME
);
