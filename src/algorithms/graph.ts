import { computeBlastRadius } from "@/algorithms/blast-radius";
import { packageRiskScore, riskLabel, scanRiskScore } from "@/lib/risk";
import type {
  CveRecord,
  Ecosystem,
  GraphData,
  GraphEdge,
  GraphNode,
  PackageInfo,
  PackageScanResult
} from "@/lib/types";

export interface LookupResult {
  packageName: string;
  cves: CveRecord[];
  lookupStatus: PackageScanResult["lookupStatus"];
}

export interface BuildScanGraphResult {
  packages: PackageScanResult[];
  graphData: GraphData;
  overallRiskScore: number;
}

export function buildScanGraph(
  projectName: string,
  ecosystem: Ecosystem,
  packages: PackageInfo[],
  lookupResults: LookupResult[]
): BuildScanGraphResult {
  const lookupByName = new Map(lookupResults.map((result) => [result.packageName.toLowerCase(), result]));
  const rootId = "root";
  const packageNodes: GraphNode[] = packages.map((pkg) => {
    const lookup = lookupByName.get(pkg.name.toLowerCase());
    const cves = lookup?.cves ?? [];
    return {
      id: packageNodeId(pkg.ecosystem, pkg.name),
      name: pkg.name,
      version: pkg.version,
      requestedVersion: pkg.requestedVersion,
      ecosystem: pkg.ecosystem,
      riskScore: 0,
      riskLabel: "Clean",
      cveCount: cves.length,
      blastRadiusSize: 0,
      isVulnerable: cves.length > 0,
      lookupStatus: lookup?.lookupStatus ?? "failed",
      cves,
      blastRadius: []
    };
  });

  const edges: GraphEdge[] = packageNodes.map((node) => ({
    source: rootId,
    target: node.id,
    type: "depends_on"
  }));

  const rootNode: GraphNode = {
    id: rootId,
    name: projectName || "project",
    version: null,
    ecosystem,
    riskScore: 0,
    riskLabel: "Clean",
    cveCount: packageNodes.reduce((total, node) => total + node.cveCount, 0),
    blastRadiusSize: packageNodes.length,
    isVulnerable: false,
    isRoot: true,
    cves: [],
    blastRadius: []
  };

  const graphNodes = [rootNode, ...packageNodes];
  const enrichedNodes = graphNodes.map((node) => {
    if (node.isRoot || node.cves.length === 0) {
      return node;
    }

    const blastRadius = computeBlastRadius(node.id, graphNodes, edges);
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

  const scanPackages: PackageScanResult[] = packages.map((pkg) => {
    const node = enrichedNodes.find((candidate) => candidate.id === packageNodeId(pkg.ecosystem, pkg.name));
    if (!node) {
      throw new Error(`Graph node missing for ${pkg.name}.`);
    }
    return {
      ...pkg,
      id: node.id,
      cves: node.cves,
      cveCount: node.cveCount,
      lookupStatus: node.lookupStatus ?? "failed",
      riskScore: node.riskScore,
      riskLabel: node.riskLabel,
      blastRadius: node.blastRadius,
      blastRadiusSize: node.blastRadiusSize
    };
  });

  const overallRiskScore = scanRiskScore(scanPackages);
  const finalNodes = enrichedNodes.map((node) =>
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
    packages: scanPackages,
    graphData: {
      nodes: finalNodes,
      edges
    },
    overallRiskScore
  };
}

export function packageNodeId(ecosystem: Ecosystem, packageName: string): string {
  return `${ecosystem}:${packageName.toLowerCase()}`;
}
