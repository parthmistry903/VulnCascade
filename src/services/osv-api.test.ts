import { afterEach, describe, expect, it, vi } from "vitest";
import { lookupPackageCves, parseOsvResponse } from "@/services/osv-api";

const originalOsvDisableNetwork = process.env.OSV_DISABLE_NETWORK;
const originalVulnDisableNetwork = process.env.VULN_DISABLE_NETWORK;

afterEach(() => {
  restoreEnv("OSV_DISABLE_NETWORK", originalOsvDisableNetwork);
  restoreEnv("VULN_DISABLE_NETWORK", originalVulnDisableNetwork);
  vi.restoreAllMocks();
});

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }
  process.env[key] = value;
}

describe("parseOsvResponse", () => {
  it("computes CVSS v3 scores when OSV provides only a vector", () => {
    const result = parseOsvResponse({
      vulns: [
        {
          id: "GHSA-test-critical",
          summary: "Critical CVSS-only vulnerability.",
          severity: [
            {
              type: "CVSS_V3",
              score: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H"
            }
          ],
          database_specific: {
            cwe_ids: ["CWE-20"]
          },
          published: "2024-01-01T00:00:00Z",
          modified: "2024-01-02T00:00:00Z"
        }
      ]
    });

    expect(result).toEqual([
      {
        id: "GHSA-test-critical",
        description: "Critical CVSS-only vulnerability.",
        cvssScore: 10,
        severity: "CRITICAL",
        cweIds: ["CWE-20"],
        references: [],
        publishedAt: "2024-01-01T00:00:00Z",
        lastModified: "2024-01-02T00:00:00Z"
      }
    ]);
  });

  it("uses OSV database severity as a fallback when no CVSS vector is available", () => {
    const result = parseOsvResponse({
      vulns: [
        {
          id: "GHSA-test-moderate",
          details: "Moderate vulnerability.",
          database_specific: {
            severity: "MODERATE"
          }
        }
      ]
    });

    expect(result[0]).toMatchObject({
      id: "GHSA-test-moderate",
      description: "Moderate vulnerability.",
      cvssScore: 5.5,
      severity: "MEDIUM"
    });
  });

  it("maps OSV reference URLs instead of exposing raw aliases as references", () => {
    const result = parseOsvResponse({
      vulns: [
        {
          id: "GHSA-test-refs",
          summary: "Reference mapping vulnerability.",
          aliases: ["CVE-2024-12345", "GHSA-abcd-efgh-ijkl"],
          references: [
            { type: "ADVISORY", url: "https://osv.dev/vulnerability/GHSA-test-refs" },
            { type: "WEB", url: "not-a-url" }
          ]
        }
      ]
    });

    expect(result[0].references).toEqual([
      "https://osv.dev/vulnerability/GHSA-test-refs",
      "https://nvd.nist.gov/vuln/detail/CVE-2024-12345",
      "https://github.com/advisories/GHSA-abcd-efgh-ijkl"
    ]);
  });

  it("returns unavailable without fetching when OSV network access is disabled", async () => {
    process.env.OSV_DISABLE_NETWORK = "true";
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const result = await lookupPackageCves({
      name: "vulncascade-offline-test-package",
      version: "1.0.0",
      requestedVersion: "1.0.0",
      ecosystem: "npm"
    });

    expect(result).toEqual({
      packageName: "vulncascade-offline-test-package",
      cves: [],
      lookupStatus: "unavailable"
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
