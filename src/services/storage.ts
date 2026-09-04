import { randomUUID } from "crypto";
import { ensureSchema, execute, isDatabaseConfigured, query, transaction } from "@/services/database";
import { packageNodeId } from "@/algorithms/graph";
import { riskLabel } from "@/lib/risk";
import type {
  CacheStats,
  CveRecord,
  Ecosystem,
  GraphData,
  GraphNode,
  PackageScanResult,
  ScanResult,
  ScanSummary,
  VulnerabilitySource
} from "@/lib/types";

const memoryScans = new Map<string, ScanResult>();
const memoryScanOwners = new Map<string, string>();
const memoryCache = new Map<string, { cves: CveRecord[]; fetchedAt: string }>();
const cacheEvents: boolean[] = [];

interface ScanRow {
  id: string;
  ecosystem: Ecosystem;
  package_count: number;
  vulnerable_count: number;
  overall_risk_score: string | number;
  scan_duration_ms: number;
  status: "completed" | "partial" | "failed";
  created_at: Date | string;
  project_name: string;
  warnings: unknown;
}

interface PackageRow {
  scan_package_id: string;
  package_id: string;
  package_name: string;
  ecosystem: Ecosystem;
  version: string | null;
  requested_version: string | null;
  risk_score: string | number;
  blast_radius_count: number;
  cve_count: number;
  lookup_status: PackageScanResult["lookupStatus"];
  blast_radius: unknown;
}

interface CveRow {
  scan_package_id: string;
  cve_id: string;
  description: string;
  cvss_score: string | number;
  severity: CveRecord["severity"];
  cwe_ids: string[] | null;
  references: string[] | null;
  published_at: Date | string | null;
  last_modified: Date | string | null;
}

interface EdgeRow {
  source_node_id: string;
  target_node_id: string;
  edge_type: "depends_on";
}

export async function saveScan(scan: Omit<ScanResult, "scanId" | "createdAt">, userId: string): Promise<ScanResult> {
  const scanResult: ScanResult = {
    ...scan,
    scanId: randomUUID(),
    createdAt: new Date().toISOString()
  };

  if (await ensureSchema()) {
    await saveScanToPostgres(scanResult, userId);
  } else {
    memoryScans.set(scanResult.scanId, scanResult);
    if (memoryScans.size > 100) {
      const oldestKey = memoryScans.keys().next().value;
      if (oldestKey) memoryScans.delete(oldestKey);
    }
    memoryScanOwners.set(scanResult.scanId, userId);
  }

  return scanResult;
}

export async function getScan(scanId: string, userId: string): Promise<ScanResult | null> {
  if (await ensureSchema()) {
    return getScanFromPostgres(scanId, userId);
  }
  if (memoryScanOwners.get(scanId) !== userId) {
    return null;
  }
  return memoryScans.get(scanId) ?? null;
}

export async function listScans(userId: string, page: number, limit: number): Promise<{ scans: ScanSummary[]; total: number }> {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(100, Math.max(1, limit));

  if (await ensureSchema()) {
    const [userCountRow] = await query<{ count: string }>("SELECT COUNT(*)::text AS count FROM scans WHERE user_id = $1", [userId]);
    const rows = await query<ScanRow>(
      `SELECT id, ecosystem, package_count, vulnerable_count, overall_risk_score, scan_duration_ms, status, created_at, project_name, warnings
       FROM scans
       WHERE user_id = $3
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [safeLimit, (safePage - 1) * safeLimit, userId]
    );
    return {
      scans: rows.map(summaryFromRow),
      total: Number.parseInt(userCountRow?.count ?? "0", 10)
    };
  }

  const allScans = [...memoryScans.values()]
    .filter((scan) => memoryScanOwners.get(scan.scanId) === userId)
    .map(toSummary)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return {
    scans: allScans.slice((safePage - 1) * safeLimit, safePage * safeLimit),
    total: allScans.length
  };
}

export async function deleteScan(scanId: string, userId: string): Promise<boolean> {
  if (await ensureSchema()) {
    return (await execute("DELETE FROM scans WHERE id = $1 AND user_id = $2", [scanId, userId])) > 0;
  }
  if (memoryScanOwners.get(scanId) !== userId) {
    return false;
  }
  memoryScanOwners.delete(scanId);
  return memoryScans.delete(scanId);
}

export async function getCachedCves(packageName: string, ecosystem: Ecosystem, source: VulnerabilitySource): Promise<CveRecord[] | null> {
  const ttlHours = Number.parseInt(process.env.CVE_CACHE_TTL_HOURS ?? "24", 10);
  const ttlMs = (Number.isFinite(ttlHours) ? ttlHours : 24) * 60 * 60 * 1000;

  if (await ensureSchema()) {
    const rows = await query<{ raw_cve_data: unknown }>(
      `SELECT raw_cve_data
       FROM cve_cache
       WHERE package_name = $1
         AND ecosystem = $2
         AND source = $3
         AND fetched_at > NOW() - ($4::text || ' hours')::interval
       LIMIT 1`,
      [packageName, ecosystem, source, String(Number.isFinite(ttlHours) ? ttlHours : 24)]
    );
    const cves = parseCveArray(rows[0]?.raw_cve_data);
    recordCacheEvent(Boolean(cves));
    return cves;
  }

  const key = cacheKey(packageName, ecosystem, source);
  const entry = memoryCache.get(key);
  if (!entry || Date.now() - Date.parse(entry.fetchedAt) > ttlMs) {
    recordCacheEvent(false);
    return null;
  }
  recordCacheEvent(true);
  return entry.cves;
}

export async function setCachedCves(packageName: string, ecosystem: Ecosystem, source: VulnerabilitySource, cves: CveRecord[]): Promise<void> {
  if (await ensureSchema()) {
    await execute(
      `INSERT INTO cve_cache (package_name, ecosystem, source, raw_cve_data, fetched_at)
       VALUES ($1, $2, $3, $4::jsonb, NOW())
       ON CONFLICT (package_name, ecosystem, source)
       DO UPDATE SET raw_cve_data = EXCLUDED.raw_cve_data, fetched_at = NOW()`,
      [packageName, ecosystem, source, JSON.stringify(cves)]
    );
    return;
  }

  memoryCache.set(cacheKey(packageName, ecosystem, source), {
    cves,
    fetchedAt: new Date().toISOString()
  });
}

export async function cacheStats(): Promise<CacheStats> {
  if (await ensureSchema()) {
    const [row] = await query<{ total: string; oldest: Date | string | null }>(
      "SELECT COUNT(*)::text AS total, MIN(fetched_at) AS oldest FROM cve_cache"
    );
    return {
      totalEntries: Number.parseInt(row?.total ?? "0", 10),
      hitRateLast100: cacheHitRate(),
      oldestEntryAge: row?.oldest ? ageFromDate(row.oldest) : "none",
      totalSize: "managed by PostgreSQL",
      mode: "postgres"
    };
  }

  const entries = [...memoryCache.values()];
  const oldest = entries.sort((a, b) => Date.parse(a.fetchedAt) - Date.parse(b.fetchedAt))[0];
  return {
    totalEntries: memoryCache.size,
    hitRateLast100: cacheHitRate(),
    oldestEntryAge: oldest ? ageFromDate(oldest.fetchedAt) : "none",
    totalSize: `${Math.round(JSON.stringify(entries).length / 1024)} KB`,
    mode: isDatabaseConfigured() ? "postgres" : "memory"
  };
}

export async function clearCache(packageName?: string): Promise<number> {
  if (await ensureSchema()) {
    if (packageName) {
      return execute("DELETE FROM cve_cache WHERE package_name = $1", [packageName]);
    }
    return execute("DELETE FROM cve_cache");
  }

  if (packageName) {
    let deleted = 0;
    for (const key of memoryCache.keys()) {
      if (key.endsWith(`:${packageName.toLowerCase()}`)) {
        memoryCache.delete(key);
        deleted += 1;
      }
    }
    return deleted;
  }
  const deleted = memoryCache.size;
  memoryCache.clear();
  return deleted;
}

async function saveScanToPostgres(scan: ScanResult, userId: string): Promise<void> {
  await transaction(async (db) => {
    await db.execute(
      `INSERT INTO scans (id, user_id, ecosystem, package_count, vulnerable_count, overall_risk_score, scan_duration_ms, status, created_at, project_name, warnings)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)`,
      [
        scan.scanId,
        userId,
        scan.ecosystem,
        scan.packageCount,
        scan.vulnerableCount,
        scan.overallRiskScore,
        scan.scanDurationMs,
        scan.status,
        scan.createdAt,
        scan.projectName,
        JSON.stringify(scan.warnings)
      ]
    );

    if (scan.packages.length === 0) return;

    const packageNames = scan.packages.map((p) => p.name);
    const ecosystems = scan.packages.map((p) => p.ecosystem);

    await db.execute(
      `INSERT INTO packages (package_name, ecosystem)
       SELECT * FROM UNNEST($1::varchar[], $2::varchar[])
       ON CONFLICT DO NOTHING`,
      [packageNames, ecosystems]
    );

    const packageDbIds = new Map<string, string>();
    const dbPackages = await db.query<{ id: string; package_name: string }>(
      `SELECT id, package_name FROM packages WHERE ecosystem = $1 AND package_name = ANY($2::varchar[])`,
      [scan.ecosystem, packageNames]
    );
    for (const row of dbPackages) {
      packageDbIds.set(row.package_name, row.id);
    }

    const spIds: string[] = [];
    const sIds: string[] = [];
    const pIds: string[] = [];
    const versions: (string | null)[] = [];
    const reqVersions: (string | null)[] = [];
    const riskScores: number[] = [];
    const blastRadius: number[] = [];
    const cveCounts: number[] = [];
    const statuses: string[] = [];
    const blasts: string[] = [];

    const allCves = new Map<string, CveRecord>();
    const scanPackageCves: { spId: string; cveId: string }[] = [];

    for (const pkg of scan.packages) {
      const spId = randomUUID();
      const originalPkgId = pkg.id; 
      spIds.push(spId);
      sIds.push(scan.scanId);
      pIds.push(packageDbIds.get(pkg.name)!);
      versions.push(pkg.version ?? null);
      reqVersions.push(pkg.requestedVersion ?? null);
      riskScores.push(pkg.riskScore);
      blastRadius.push(pkg.blastRadiusSize);
      cveCounts.push(pkg.cveCount);
      statuses.push(pkg.lookupStatus);
      blasts.push(JSON.stringify(pkg.blastRadius));

      packageDbIds.set(originalPkgId, packageDbIds.get(pkg.name)!); 
      pkg.id = spId; 

      for (const cve of pkg.cves) {
        allCves.set(cve.id, cve);
        scanPackageCves.push({ spId, cveId: cve.id });
      }
    }

    await db.execute(
      `INSERT INTO scan_packages (id, scan_id, package_id, version, requested_version, risk_score, blast_radius_count, cve_count, lookup_status, blast_radius)
       SELECT * FROM UNNEST($1::uuid[], $2::uuid[], $3::uuid[], $4::varchar[], $5::varchar[], $6::numeric[], $7::int[], $8::int[], $9::varchar[], $10::jsonb[])`,
      [spIds, sIds, pIds, versions, reqVersions, riskScores, blastRadius, cveCounts, statuses, blasts]
    );

    const cveDbIds = new Map<string, string>();
    for (const cve of allCves.values()) {
      const [cveRow] = await db.query<{ id: string }>(
        `INSERT INTO cves (cve_id, description, cvss_score, severity, cwe_ids, "references", published_at, last_modified)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (cve_id)
         DO UPDATE SET
           description = EXCLUDED.description,
           cvss_score = EXCLUDED.cvss_score,
           severity = EXCLUDED.severity,
           cwe_ids = EXCLUDED.cwe_ids,
           "references" = EXCLUDED."references",
           published_at = EXCLUDED.published_at,
           last_modified = EXCLUDED.last_modified
         RETURNING id`,
        [
          cve.id,
          cve.description,
          cve.cvssScore,
          cve.severity,
          cve.cweIds,
          cve.references,
          cve.publishedAt ?? null,
          cve.lastModified ?? null
        ]
      );
      cveDbIds.set(cve.id, cveRow.id);
    }

    if (scanPackageCves.length > 0) {
      const spcSpIds = scanPackageCves.map((s) => s.spId);
      const spcCveIds = scanPackageCves.map((s) => cveDbIds.get(s.cveId)!);
      await db.execute(
        `INSERT INTO scan_package_cves (scan_package_id, cve_id)
         SELECT * FROM UNNEST($1::uuid[], $2::uuid[])
         ON CONFLICT DO NOTHING`,
        [spcSpIds, spcCveIds]
      );
    }

    if (scan.graphData.edges.length > 0) {
      const eScanIds = scan.graphData.edges.map(() => scan.scanId);
      const eSources = scan.graphData.edges.map((e) => packageDbIds.get(e.source) ?? null);
      const eTargets = scan.graphData.edges.map((e) => packageDbIds.get(e.target) ?? null);
      const eSourceNodes = scan.graphData.edges.map((e) => e.source);
      const eTargetNodes = scan.graphData.edges.map((e) => e.target);
      const eTypes = scan.graphData.edges.map((e) => e.type);

      await db.execute(
        `INSERT INTO graph_edges (scan_id, source_pkg_id, target_pkg_id, source_node_id, target_node_id, edge_type)
         SELECT * FROM UNNEST($1::uuid[], $2::uuid[], $3::uuid[], $4::varchar[], $5::varchar[], $6::varchar[])`,
        [eScanIds, eSources, eTargets, eSourceNodes, eTargetNodes, eTypes]
      );
    }
  });
}

async function getScanFromPostgres(scanId: string, userId: string): Promise<ScanResult | null> {
  const [scanRow] = await query<ScanRow>(
    `SELECT id, ecosystem, package_count, vulnerable_count, overall_risk_score, scan_duration_ms, status, created_at, project_name, warnings
     FROM scans WHERE id = $1 AND user_id = $2`,
    [scanId, userId]
  );

  if (!scanRow) {
    return null;
  }

  const packageRows = await query<PackageRow>(
    `SELECT sp.id AS scan_package_id, p.id AS package_id, p.package_name, p.ecosystem, sp.version, sp.requested_version,
            sp.risk_score, sp.blast_radius_count, sp.cve_count, sp.lookup_status, sp.blast_radius
     FROM scan_packages sp
     JOIN packages p ON p.id = sp.package_id
     WHERE sp.scan_id = $1
     ORDER BY sp.risk_score DESC, p.package_name ASC`,
    [scanId]
  );

  const cveRows = await query<CveRow>(
    `SELECT spc.scan_package_id, c.cve_id, c.description, c.cvss_score, c.severity, c.cwe_ids, c."references", c.published_at, c.last_modified
     FROM scan_package_cves spc
     JOIN cves c ON c.id = spc.cve_id
     JOIN scan_packages sp ON sp.id = spc.scan_package_id
     WHERE sp.scan_id = $1
     ORDER BY c.cvss_score DESC`,
    [scanId]
  );

  const edgeRows = await query<EdgeRow>(
    `SELECT source_node_id, target_node_id, edge_type
     FROM graph_edges
     WHERE scan_id = $1`,
    [scanId]
  );

  const cvesByPackage = new Map<string, CveRecord[]>();
  for (const row of cveRows) {
    const cves = cvesByPackage.get(row.scan_package_id) ?? [];
    cves.push({
      id: row.cve_id,
      description: row.description,
      cvssScore: Number(row.cvss_score),
      severity: row.severity,
      cweIds: row.cwe_ids ?? [],
      references: row.references ?? [],
      publishedAt: row.published_at ? new Date(row.published_at).toISOString() : undefined,
      lastModified: row.last_modified ? new Date(row.last_modified).toISOString() : undefined
    });
    cvesByPackage.set(row.scan_package_id, cves);
  }

  const packages: PackageScanResult[] = packageRows.map((row) => {
    const riskScore = Number(row.risk_score);
    return {
      id: packageNodeId(row.ecosystem, row.package_name),
      name: row.package_name,
      ecosystem: row.ecosystem,
      version: row.version,
      requestedVersion: row.requested_version,
      cves: cvesByPackage.get(row.scan_package_id) ?? [],
      cveCount: row.cve_count,
      lookupStatus: row.lookup_status,
      riskScore,
      riskLabel: riskLabel(riskScore),
      blastRadius: Array.isArray(row.blast_radius) ? row.blast_radius : [],
      blastRadiusSize: row.blast_radius_count
    };
  });

  const overallRiskScore = Number(scanRow.overall_risk_score);
  const graphNodes: GraphNode[] = [
    {
      id: "root",
      name: scanRow.project_name,
      version: null,
      ecosystem: scanRow.ecosystem,
      riskScore: overallRiskScore,
      riskLabel: riskLabel(overallRiskScore),
      cveCount: packages.reduce((total, pkg) => total + pkg.cveCount, 0),
      blastRadiusSize: packages.length,
      isVulnerable: false,
      isRoot: true,
      cves: [],
      blastRadius: []
    },
    ...packages.map((pkg) => ({
      id: pkg.id,
      name: pkg.name,
      version: pkg.version,
      requestedVersion: pkg.requestedVersion,
      ecosystem: pkg.ecosystem,
      riskScore: pkg.riskScore,
      riskLabel: pkg.riskLabel,
      cveCount: pkg.cveCount,
      blastRadiusSize: pkg.blastRadiusSize,
      isVulnerable: pkg.cveCount > 0,
      lookupStatus: pkg.lookupStatus,
      cves: pkg.cves,
      blastRadius: pkg.blastRadius
    }))
  ];

  return {
    scanId: scanRow.id,
    createdAt: new Date(scanRow.created_at).toISOString(),
    ecosystem: scanRow.ecosystem,
    packageCount: scanRow.package_count,
    vulnerableCount: scanRow.vulnerable_count,
    overallRiskScore,
    riskLabel: riskLabel(overallRiskScore),
    scanDurationMs: scanRow.scan_duration_ms,
    status: scanRow.status,
    projectName: scanRow.project_name,
    warnings: Array.isArray(scanRow.warnings) ? scanRow.warnings : [],
    packages,
    graphData: {
      nodes: graphNodes,
      edges: edgeRows.map((row) => ({
        source: row.source_node_id,
        target: row.target_node_id,
        type: row.edge_type
      }))
    }
  };
}

function toSummary(scan: ScanResult): ScanSummary {
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

function summaryFromRow(row: ScanRow): ScanSummary {
  const overallRiskScore = Number(row.overall_risk_score);
  return {
    scanId: row.id,
    createdAt: new Date(row.created_at).toISOString(),
    projectName: row.project_name,
    ecosystem: row.ecosystem,
    packageCount: row.package_count,
    vulnerableCount: row.vulnerable_count,
    overallRiskScore,
    riskLabel: riskLabel(overallRiskScore),
    scanDurationMs: row.scan_duration_ms,
    status: row.status
  };
}

function parseCveArray(value: unknown): CveRecord[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  return value.filter((item): item is CveRecord => {
    return typeof item === "object" && item !== null && "id" in item && "cvssScore" in item;
  });
}

function recordCacheEvent(hit: boolean): void {
  cacheEvents.push(hit);
  if (cacheEvents.length > 100) {
    cacheEvents.shift();
  }
}

function cacheHitRate(): number {
  if (cacheEvents.length === 0) {
    return 0;
  }
  const hits = cacheEvents.filter(Boolean).length;
  return Math.round((hits / cacheEvents.length) * 100) / 100;
}

function cacheKey(packageName: string, ecosystem: Ecosystem, source: VulnerabilitySource): string {
  return `${source}:${ecosystem}:${packageName.toLowerCase()}`;
}

function ageFromDate(date: Date | string): string {
  const ageMs = Date.now() - new Date(date).getTime();
  if (ageMs < 60_000) {
    return "under 1 minute";
  }
  if (ageMs < 3_600_000) {
    return `${Math.round(ageMs / 60_000)} minutes`;
  }
  if (ageMs < 86_400_000) {
    return `${Math.round(ageMs / 3_600_000)} hours`;
  }
  return `${Math.round(ageMs / 86_400_000)} days`;
}
