import { computeBlastRadius } from "@/algorithms/blast-radius";
import { packageNodeId } from "@/algorithms/graph";
import { lookupAdvisories } from "@/lib/demo/catalog";
import { packageRiskScore, riskLabel, scanRiskScore } from "@/lib/risk";
import type {
  Ecosystem,
  GraphEdge,
  GraphNode,
  LookupStatus,
  PackageScanResult,
  ParseWarning,
  ScanResult,
  ScanStatus
} from "@/lib/types";

export interface DemoPackageSpec {
  name: string;
  /** null models a dependency that was declared without a resolvable version. */
  version: string | null;
  dev?: boolean;
  /** Names of packages in the same scan that this package pulls in. */
  deps?: string[];
  /** Used to model a partial scan, exactly like a real OSV timeout would. */
  lookupStatus?: LookupStatus;
}

export interface DemoScanSpec {
  id: string;
  projectName: string;
  ecosystem: Ecosystem;
  /** Kept relative to "now" so the seeded history never reads as stale. */
  hoursAgo: number;
  scanDurationMs: number;
  /** Names declared directly by the manifest; everything else is transitive. */
  direct: string[];
  packages: DemoPackageSpec[];
  warnings?: ParseWarning[];
  /** One-line description surfaced in the demo history table. */
  note: string;
}

const ROOT_ID = "root";

/**
 * Builds a full ScanResult from a hand-authored dependency tree.
 *
 * This deliberately runs the *production* scoring path — `computeBlastRadius`,
 * `packageRiskScore`, `scanRiskScore` — over the seeded tree, so every number the
 * demo displays is the number the real scanner would compute for that input.
 */
export function buildDemoScan(spec: DemoScanSpec, now: number): ScanResult {
  const byName = new Map(spec.packages.map((pkg) => [pkg.name.toLowerCase(), pkg]));
  const idOf = (name: string): string => packageNodeId(spec.ecosystem, name);

  const packageNodes: GraphNode[] = spec.packages.map((pkg) => {
    const lookupStatus: LookupStatus = pkg.lookupStatus ?? "success";
    const cves = lookupStatus === "success" || lookupStatus === "cached"
      ? lookupAdvisories(spec.ecosystem, pkg.name, pkg.version)
      : [];
    return {
      id: idOf(pkg.name),
      name: pkg.name,
      version: pkg.version,
      requestedVersion: pkg.version,
      ecosystem: spec.ecosystem,
      riskScore: 0,
      riskLabel: "Clean",
      cveCount: cves.length,
      blastRadiusSize: 0,
      isVulnerable: cves.length > 0,
      lookupStatus,
      cves,
      blastRadius: []
    };
  });

  const edges: GraphEdge[] = [];
  const seenEdges = new Set<string>();
  const addEdge = (source: string, target: string): void => {
    const key = `${source}->${target}`;
    if (seenEdges.has(key)) {
      return;
    }
    seenEdges.add(key);
    edges.push({ source, target, type: "depends_on" });
  };

  for (const name of spec.direct) {
    if (!byName.has(name.toLowerCase())) {
      throw new Error(`Demo scan "${spec.id}" declares direct dependency "${name}" that is not in its package list.`);
    }
    addEdge(ROOT_ID, idOf(name));
  }

  for (const pkg of spec.packages) {
    for (const dependency of pkg.deps ?? []) {
      if (!byName.has(dependency.toLowerCase())) {
        throw new Error(`Demo scan "${spec.id}": "${pkg.name}" depends on unknown package "${dependency}".`);
      }
      addEdge(idOf(pkg.name), idOf(dependency));
    }
  }

  const rootNode: GraphNode = {
    id: ROOT_ID,
    name: spec.projectName,
    version: null,
    ecosystem: spec.ecosystem,
    riskScore: 0,
    riskLabel: "Clean",
    cveCount: packageNodes.reduce((total, node) => total + node.cveCount, 0),
    blastRadiusSize: packageNodes.length,
    isVulnerable: false,
    isRoot: true,
    cves: [],
    blastRadius: []
  };

  const allNodes = [rootNode, ...packageNodes];
  const enrichedNodes = allNodes.map((node) => {
    if (node.isRoot || node.cves.length === 0) {
      return node;
    }
    const blastRadius = computeBlastRadius(node.id, allNodes, edges);
    const maxCvss = Math.max(...node.cves.map((cve) => cve.cvssScore), 0);
    const riskScore = packageRiskScore(maxCvss, blastRadius.length);
    return {
      ...node,
      riskScore,
      riskLabel: riskLabel(riskScore),
      blastRadius,
      blastRadiusSize: blastRadius.length
    };
  });

  const packages: PackageScanResult[] = spec.packages.map((pkg) => {
    const node = enrichedNodes.find((candidate) => candidate.id === idOf(pkg.name));
    if (!node) {
      throw new Error(`Demo scan "${spec.id}": graph node missing for ${pkg.name}.`);
    }
    return {
      name: pkg.name,
      version: pkg.version,
      requestedVersion: pkg.version,
      ecosystem: spec.ecosystem,
      isDevDependency: pkg.dev ?? false,
      id: node.id,
      cves: node.cves,
      cveCount: node.cveCount,
      lookupStatus: node.lookupStatus ?? "success",
      riskScore: node.riskScore,
      riskLabel: node.riskLabel,
      blastRadius: node.blastRadius,
      blastRadiusSize: node.blastRadiusSize
    };
  });

  const overallRiskScore = scanRiskScore(packages);
  const incompleteLookups = packages.filter(
    (pkg) => pkg.lookupStatus === "failed" || pkg.lookupStatus === "unavailable"
  ).length;
  const status: ScanStatus = incompleteLookups > 0 ? "partial" : "completed";

  const graphNodes = enrichedNodes.map((node) =>
    node.isRoot
      ? {
          ...node,
          riskScore: overallRiskScore,
          riskLabel: riskLabel(overallRiskScore),
          blastRadiusSize: packageNodes.length
        }
      : node
  );

  return {
    scanId: spec.id,
    createdAt: new Date(now - spec.hoursAgo * 3_600_000).toISOString(),
    ecosystem: spec.ecosystem,
    packageCount: packages.length,
    vulnerableCount: packages.filter((pkg) => pkg.cveCount > 0).length,
    overallRiskScore,
    riskLabel: riskLabel(overallRiskScore),
    scanDurationMs: spec.scanDurationMs,
    status,
    projectName: spec.projectName,
    packages,
    graphData: { nodes: graphNodes, edges },
    warnings: spec.warnings ?? []
  };
}
