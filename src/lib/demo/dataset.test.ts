import { describe, expect, it } from "vitest";
import { buildDemoScan } from "@/lib/demo/build";
import { ADVISORIES, compareVersions, lookupAdvisories } from "@/lib/demo/catalog";
import { DEMO_SCAN_SPECS } from "@/lib/demo/dataset";
import { riskLabel } from "@/lib/risk";

const NOW = Date.parse("2026-09-01T00:00:00.000Z");
const scans = DEMO_SCAN_SPECS.map((spec) => buildDemoScan(spec, NOW));

describe("advisory snapshot", () => {
  it("compares versions across release segments", () => {
    expect(compareVersions("1.2.5", "1.2.6")).toBe(-1);
    expect(compareVersions("1.10.0", "1.9.0")).toBe(1);
    expect(compareVersions("2023.5.7", "2023.7.22")).toBe(-1);
    expect(compareVersions("7.0.6", "7.0.5")).toBe(1);
    expect(compareVersions("3.0.3-beta.1", "3.0.3")).toBe(0);
  });

  it("only reports a package as affected below the fixed release", () => {
    expect(lookupAdvisories("npm", "minimist", "1.2.5").map((cve) => cve.id)).toContain("CVE-2021-44906");
    expect(lookupAdvisories("npm", "minimist", "1.2.6")).toEqual([]);
    // An unpinned dependency cannot be cleared, so every advisory is returned.
    expect(lookupAdvisories("npm", "minimist", null)).toHaveLength(1);
  });

  it("gives every advisory a severity consistent with its CVSS score", () => {
    for (const entry of ADVISORIES) {
      expect(entry.cve.cvssScore).toBeGreaterThan(0);
      expect(entry.cve.cvssScore).toBeLessThanOrEqual(10);
      expect(entry.cve.references.length).toBeGreaterThan(0);
      expect(entry.cve.description.length).toBeGreaterThan(20);
    }
  });

  it("has no duplicate advisory ids for the same package", () => {
    const seen = new Set<string>();
    for (const entry of ADVISORIES) {
      const key = `${entry.ecosystem}:${entry.packageName}:${entry.cve.id}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });
});

describe("seeded demo scans", () => {
  it("builds every seeded scan without dangling dependency edges", () => {
    expect(scans).toHaveLength(DEMO_SCAN_SPECS.length);
    for (const scan of scans) {
      const ids = new Set(scan.graphData.nodes.map((node) => node.id));
      for (const edge of scan.graphData.edges) {
        expect(ids.has(edge.source)).toBe(true);
        expect(ids.has(edge.target)).toBe(true);
      }
    }
  });

  it("uses unique scan ids", () => {
    expect(new Set(scans.map((scan) => scan.scanId)).size).toBe(scans.length);
  });

  it("keeps summary counters in step with the package list", () => {
    for (const scan of scans) {
      expect(scan.packageCount).toBe(scan.packages.length);
      expect(scan.vulnerableCount).toBe(scan.packages.filter((pkg) => pkg.cveCount > 0).length);
      expect(scan.riskLabel).toBe(riskLabel(scan.overallRiskScore));
      expect(scan.overallRiskScore).toBeGreaterThanOrEqual(0);
      expect(scan.overallRiskScore).toBeLessThanOrEqual(10);
    }
  });

  it("marks a scan partial exactly when a lookup did not complete", () => {
    for (const scan of scans) {
      const incomplete = scan.packages.some(
        (pkg) => pkg.lookupStatus === "failed" || pkg.lookupStatus === "unavailable"
      );
      expect(scan.status).toBe(incomplete ? "partial" : "completed");
    }
  });

  it("never reports CVEs for a package whose lookup did not complete", () => {
    for (const scan of scans) {
      for (const pkg of scan.packages) {
        if (pkg.lookupStatus === "failed" || pkg.lookupStatus === "unavailable") {
          expect(pkg.cveCount).toBe(0);
          expect(pkg.riskScore).toBe(0);
        }
      }
    }
  });

  it("scores a package above zero if and only if it has a CVE", () => {
    for (const scan of scans) {
      for (const pkg of scan.packages) {
        expect(pkg.riskScore > 0).toBe(pkg.cveCount > 0);
      }
    }
  });

  it("counts blast radius as the set of dependents, root included", () => {
    const payments = scans.find((scan) => scan.scanId === "payments-api");
    expect(payments).toBeDefined();
    // qs is pulled in by express, body-parser and stripe, so a flaw in it reaches
    // those three plus the project root.
    const qs = payments?.packages.find((pkg) => pkg.name === "qs");
    expect(qs?.blastRadiusSize).toBe(4);
    expect(qs?.blastRadius.map((entry) => entry.packageName).sort()).toEqual([
      "body-parser",
      "express",
      "payments-api",
      "stripe"
    ]);
  });

  it("covers the full range of risk labels so every UI state is reachable", () => {
    const labels = new Set(scans.map((scan) => scan.riskLabel));
    expect(labels).toContain("Clean");
    expect(labels).toContain("Medium");
    expect(labels).toContain("High");
    expect(labels).toContain("Critical");
  });

  it("spans both supported ecosystems", () => {
    expect(new Set(scans.map((scan) => scan.ecosystem))).toEqual(new Set(["npm", "pip"]));
  });
});
