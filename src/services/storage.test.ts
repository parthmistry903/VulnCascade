import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { getCachedCves, setCachedCves, clearCache, saveScan, getScan, listScans, deleteScan } from "@/services/storage";
import type { CveRecord, ScanResult } from "@/lib/types";

const originalDatabaseUrl = process.env.DATABASE_URL;

afterEach(async () => {
  await clearCache("vulncascade-cache-source-test");
  if (originalDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL;
    return;
  }
  process.env.DATABASE_URL = originalDatabaseUrl;
});

describe("CVE cache storage", () => {
  it("keeps provider cache entries isolated by source", async () => {
    delete process.env.DATABASE_URL;

    const nvdCve = cve("CVE-2024-NVD");
    const osvCve = cve("GHSA-osv-test");

    await setCachedCves("vulncascade-cache-source-test", "npm", "nvd", [nvdCve]);
    expect(await getCachedCves("vulncascade-cache-source-test", "npm", "osv")).toBeNull();

    await setCachedCves("vulncascade-cache-source-test", "npm", "osv", [osvCve]);

    expect(await getCachedCves("vulncascade-cache-source-test", "npm", "nvd")).toEqual([nvdCve]);
    expect(await getCachedCves("vulncascade-cache-source-test", "npm", "osv")).toEqual([osvCve]);
  });
});

describe("scan storage ownership", () => {
  it("keeps scans isolated by user id in memory storage", async () => {
    delete process.env.DATABASE_URL;

    const ownerId = `owner-${randomUUID()}`;
    const otherUserId = `other-${randomUUID()}`;
    const scan = await saveScan(scanFixture(), ownerId);

    expect(await getScan(scan.scanId, ownerId)).toEqual(scan);
    expect(await getScan(scan.scanId, otherUserId)).toBeNull();

    expect(await listScans(ownerId, 1, 20)).toMatchObject({ total: 1 });
    expect(await listScans(otherUserId, 1, 20)).toMatchObject({ scans: [], total: 0 });

    expect(await deleteScan(scan.scanId, otherUserId)).toBe(false);
    expect(await getScan(scan.scanId, ownerId)).toEqual(scan);
    expect(await deleteScan(scan.scanId, ownerId)).toBe(true);
  });
});

function cve(id: string): CveRecord {
  return {
    id,
    description: "test",
    cvssScore: 5,
    severity: "MEDIUM",
    cweIds: [],
    references: []
  };
}

function scanFixture(): Omit<ScanResult, "scanId" | "createdAt"> {
  return {
    ecosystem: "npm",
    packageCount: 1,
    vulnerableCount: 0,
    overallRiskScore: 0,
    riskLabel: "Clean",
    scanDurationMs: 12,
    status: "completed",
    projectName: "isolated-project",
    warnings: [],
    packages: [
      {
        id: "npm:lodash",
        name: "lodash",
        ecosystem: "npm",
        version: "4.17.21",
        requestedVersion: "4.17.21",
        cves: [],
        cveCount: 0,
        lookupStatus: "success",
        riskScore: 0,
        riskLabel: "Clean",
        blastRadius: [],
        blastRadiusSize: 0
      }
    ],
    graphData: {
      nodes: [],
      edges: []
    }
  };
}
