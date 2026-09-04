import { buildScanGraph, type LookupResult } from "@/algorithms/graph";
import { ADVISORY_COUNT, ADVISORY_PACKAGE_COUNT, isPackageCovered, lookupAdvisories } from "@/lib/demo/catalog";
import { SIMULATED_SCAN_ID } from "@/lib/demo/config";
import { parseManifest } from "@/lib/parser";
import { riskLabel } from "@/lib/risk";
import type { EcosystemInput, ParseWarning, ScanResult, ScanStatus } from "@/lib/types";

/**
 * Runs a real scan in the browser against the bundled advisory snapshot.
 *
 * The parser, the graph builder and every scoring function are the same modules
 * the server uses — only the vulnerability source is swapped: `lookupAdvisories`
 * (57 frozen advisories) stands in for a live Google OSV query. Packages the
 * snapshot has never heard of are reported as `unavailable` rather than clean,
 * because "we did not look" is not the same answer as "nothing found".
 */
export async function simulateScan(
  manifest: string,
  ecosystem: EcosystemInput,
  includeDev: boolean
): Promise<ScanResult> {
  const startedAt = performance.now();
  const parsed = await parseManifest(manifest, ecosystem, includeDev);

  const lookupResults: LookupResult[] = parsed.packages.map((pkg) => {
    const covered = isPackageCovered(parsed.ecosystem, pkg.name);
    return {
      packageName: pkg.name,
      cves: covered ? lookupAdvisories(parsed.ecosystem, pkg.name, pkg.version) : [],
      lookupStatus: covered ? "success" : "unavailable"
    };
  });

  const graph = buildScanGraph(parsed.projectName, parsed.ecosystem, parsed.packages, lookupResults);
  const uncovered = lookupResults.filter((result) => result.lookupStatus === "unavailable");
  const scanDurationMs = Math.max(1, Math.round(performance.now() - startedAt));
  const status: ScanStatus = uncovered.length > 0 ? "partial" : "completed";

  const warnings: ParseWarning[] = [...parsed.warnings];
  if (uncovered.length > 0) {
    warnings.push({
      message:
        `${uncovered.length} of ${parsed.packages.length} packages are outside this demo's offline advisory snapshot ` +
        `(${ADVISORY_COUNT} advisories across ${ADVISORY_PACKAGE_COUNT} packages) and are reported as unknown, not clean. ` +
        `The live build resolves every package against the Google OSV API instead.`
    });
  }

  return {
    scanId: SIMULATED_SCAN_ID,
    createdAt: new Date().toISOString(),
    ecosystem: parsed.ecosystem,
    packageCount: graph.packages.length,
    vulnerableCount: graph.packages.filter((pkg) => pkg.cveCount > 0).length,
    overallRiskScore: graph.overallRiskScore,
    riskLabel: riskLabel(graph.overallRiskScore),
    scanDurationMs,
    status,
    projectName: parsed.projectName,
    packages: graph.packages,
    graphData: graph.graphData,
    warnings
  };
}
