export type Ecosystem = "npm" | "pip";
export type EcosystemInput = Ecosystem | "auto";
export type LookupStatus = "success" | "failed" | "cached" | "unavailable";
export type ScanStatus = "completed" | "partial" | "failed";
export type Severity = "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | "UNKNOWN";
export type RiskLabel = "Clean" | "Low" | "Medium" | "High" | "Critical";
export type VulnerabilitySource = "nvd" | "osv";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface PackageInfo {
  name: string;
  version: string | null;
  requestedVersion: string | null;
  ecosystem: Ecosystem;
  isDevDependency?: boolean;
  line?: number;
}

export interface ParseWarning {
  line?: number;
  message: string;
}

export interface ParseResult {
  ecosystem: Ecosystem;
  packages: PackageInfo[];
  warnings: ParseWarning[];
  projectName: string;
}

export interface CveRecord {
  id: string;
  description: string;
  cvssScore: number;
  severity: Severity;
  cweIds: string[];
  references: string[];
  publishedAt?: string;
  lastModified?: string;
}

export interface PackageScanResult extends PackageInfo {
  id: string;
  cves: CveRecord[];
  cveCount: number;
  lookupStatus: LookupStatus;
  riskScore: number;
  riskLabel: RiskLabel;
  blastRadius: BlastRadiusEntry[];
  blastRadiusSize: number;
}

export interface BlastRadiusEntry {
  packageId: string;
  packageName: string;
  depth: number;
}

export interface GraphNode {
  id: string;
  name: string;
  version: string | null;
  requestedVersion?: string | null;
  ecosystem: Ecosystem;
  riskScore: number;
  riskLabel: RiskLabel;
  cveCount: number;
  blastRadiusSize: number;
  isVulnerable: boolean;
  isRoot?: boolean;
  lookupStatus?: LookupStatus;
  cves: CveRecord[];
  blastRadius: BlastRadiusEntry[];
}

export interface GraphEdge {
  source: string;
  target: string;
  type: "depends_on";
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface ScanSummary {
  scanId: string;
  createdAt: string;
  projectName: string;
  ecosystem: Ecosystem;
  packageCount: number;
  vulnerableCount: number;
  overallRiskScore: number;
  riskLabel: RiskLabel;
  scanDurationMs: number;
  status: ScanStatus;
}

export interface ScanResult extends ScanSummary {
  packages: PackageScanResult[];
  graphData: GraphData;
  warnings: ParseWarning[];
}

export interface CacheStats {
  totalEntries: number;
  hitRateLast100: number;
  oldestEntryAge: string;
  totalSize: string;
  mode: "postgres" | "memory";
}

export interface CacheEntry {
  packageName: string;
  ecosystem: Ecosystem;
  source: VulnerabilitySource;
  cves: CveRecord[];
  fetchedAt: string;
}
