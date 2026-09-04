import { describe, expect, it } from "vitest";
import { parseNvdResponse } from "@/services/nist-nvd";

describe("parseNvdResponse", () => {
  it("extracts normalized CVE records from NVD v2 payloads", () => {
    const result = parseNvdResponse({
      vulnerabilities: [
        {
          cve: {
            id: "CVE-2020-8203",
            descriptions: [{ lang: "en", value: "Prototype pollution in lodash." }],
            metrics: {
              cvssMetricV31: [
                {
                  cvssData: {
                    baseScore: 7.4,
                    baseSeverity: "HIGH"
                  }
                }
              ]
            },
            weaknesses: [{ description: [{ lang: "en", value: "CWE-1321" }] }],
            references: {
              referenceData: [{ url: "https://nvd.nist.gov/vuln/detail/CVE-2020-8203" }]
            },
            published: "2020-07-15T14:15:00.000",
            lastModified: "2024-11-21T05:12:00.000"
          }
        }
      ]
    });

    expect(result).toEqual([
      {
        id: "CVE-2020-8203",
        description: "Prototype pollution in lodash.",
        cvssScore: 7.4,
        severity: "HIGH",
        cweIds: ["CWE-1321"],
        references: ["https://nvd.nist.gov/vuln/detail/CVE-2020-8203"],
        publishedAt: "2020-07-15T14:15:00.000",
        lastModified: "2024-11-21T05:12:00.000"
      }
    ]);
  });
});
