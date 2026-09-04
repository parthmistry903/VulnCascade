import { severityFromScore } from "@/lib/risk";
import type { CveRecord, PackageInfo, Severity } from "@/lib/types";
import { getCachedCves, setCachedCves } from "@/services/storage";

export interface CveLookupResult {
  packageName: string;
  cves: CveRecord[];
  lookupStatus: "success" | "cached" | "failed" | "unavailable";
}

const OSV_URL = "https://api.osv.dev/v1/query";
const OSV_RETRY_DELAYS_MS = [0, 1000, 3000];

interface OsvVuln {
  id: string;
  summary?: string;
  details?: string;
  modified?: string;
  published?: string;
  database_specific?: {
    severity?: string;
    cwe_ids?: string[];
  };
  severity?: Array<{
    type: string;
    score: string;
  }>;
  aliases?: string[];
  references?: Array<{
    type?: string;
    url?: string;
  }>;
}

interface OsvResponse {
  vulns?: OsvVuln[];
}

export async function lookupPackageCves(pkg: PackageInfo): Promise<CveLookupResult> {
  const cached = await getCachedCves(pkg.name, pkg.ecosystem, "osv");
  if (cached) {
    return {
      packageName: pkg.name,
      cves: cached,
      lookupStatus: "cached"
    };
  }

  if (isOsvNetworkDisabled()) {
    return {
      packageName: pkg.name,
      cves: [],
      lookupStatus: "unavailable"
    };
  }

  try {
    const data = await fetchOsvWithRetry(pkg);
    const cves = parseOsvResponse(data);

    await setCachedCves(pkg.name, pkg.ecosystem, "osv", cves);

    return {
      packageName: pkg.name,
      cves,
      lookupStatus: "success"
    };
  } catch (error) {
    console.error(`OSV API failed for ${pkg.name}:`, error);
    return {
      packageName: pkg.name,
      cves: [],
      lookupStatus: "failed"
    };
  }
}

async function fetchOsvWithRetry(pkg: PackageInfo): Promise<OsvResponse> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < OSV_RETRY_DELAYS_MS.length; attempt += 1) {
    if (OSV_RETRY_DELAYS_MS[attempt] > 0) {
      await delay(OSV_RETRY_DELAYS_MS[attempt]);
    }

    try {
      const response = await fetchOsv(pkg);
      if (shouldRetryOsvStatus(response.status) && attempt < OSV_RETRY_DELAYS_MS.length - 1) {
        lastError = new Error(`OSV API responded with ${response.status}`);
        continue;
      }
      if (!response.ok) {
        throw new Error(`OSV API responded with ${response.status}`);
      }
      return (await response.json()) as OsvResponse;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unknown OSV request failure.");
      if (attempt === OSV_RETRY_DELAYS_MS.length - 1) {
        break;
      }
    }
  }

  throw lastError || new Error("OSV API is unavailable after retries.");
}

async function fetchOsv(pkg: PackageInfo): Promise<Response> {
  const timeoutMs = Number.parseInt(process.env.OSV_REQUEST_TIMEOUT_MS ?? "10000", 10);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number.isFinite(timeoutMs) ? timeoutMs : 10000);

  try {
    return await fetch(OSV_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": `VulnCascade/1.0 (${pkg.ecosystem})`
      },
      body: JSON.stringify({
        version: pkg.version || undefined,
        package: {
          name: pkg.name,
          ecosystem: pkg.ecosystem === "npm" ? "npm" : "PyPI"
        }
      }),
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

function isOsvNetworkDisabled(): boolean {
  return process.env.OSV_DISABLE_NETWORK === "true" || process.env.VULN_DISABLE_NETWORK === "true";
}

function shouldRetryOsvStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

export function parseOsvResponse(data: OsvResponse): CveRecord[] {
  if (!data.vulns) return [];

  return data.vulns.map((vuln) => {
    let severity: Severity = "UNKNOWN";
    let cvssScore = 0.0;

    const cvss = vuln.severity?.find((item) => item.type === "CVSS_V3");
    const parsedCvssScore = cvss?.score ? cvssV3BaseScore(cvss.score) : null;
    if (parsedCvssScore !== null) {
      cvssScore = parsedCvssScore;
      severity = severityFromScore(cvssScore);
    }

    if (cvssScore === 0) {
      severity = normalizeOsvSeverity(vuln.database_specific?.severity);
    }

    if (cvssScore === 0) {
      if (severity === "CRITICAL") cvssScore = 9.5;
      else if (severity === "HIGH") cvssScore = 8.0;
      else if (severity === "MEDIUM") cvssScore = 5.5;
      else if (severity === "LOW") cvssScore = 3.0;
    }

    return {
      id: vuln.id,
      description: vuln.summary || vuln.details || "No description provided.",
      cvssScore,
      severity,
      cweIds: vuln.database_specific?.cwe_ids || [],
      references: extractOsvReferences(vuln),
      publishedAt: vuln.published,
      lastModified: vuln.modified
    };
  });
}

function extractOsvReferences(vuln: OsvVuln): string[] {
  const urls = new Set<string>();
  for (const reference of vuln.references ?? []) {
    if (typeof reference.url === "string" && reference.url.startsWith("http")) {
      urls.add(reference.url);
    }
  }

  for (const alias of vuln.aliases ?? []) {
    if (alias.startsWith("CVE-")) {
      urls.add(`https://nvd.nist.gov/vuln/detail/${alias}`);
    } else if (alias.startsWith("GHSA-")) {
      urls.add(`https://github.com/advisories/${alias}`);
    }
  }

  return [...urls].slice(0, 8);
}

function normalizeOsvSeverity(rawSeverity: unknown): Severity {
  if (typeof rawSeverity !== "string") {
    return "UNKNOWN";
  }

  const severity = rawSeverity.toUpperCase();
  if (severity === "NONE") return "NONE";
  if (severity === "LOW") return "LOW";
  if (severity === "MODERATE" || severity === "MEDIUM") return "MEDIUM";
  if (severity === "HIGH") return "HIGH";
  if (severity === "CRITICAL") return "CRITICAL";
  return "UNKNOWN";
}

function cvssV3BaseScore(vector: string): number | null {
  const metrics = parseCvssVector(vector);
  const scope = metrics.get("S");
  const confidentiality = metricValue(metrics, "C", IMPACT_VALUES);
  const integrity = metricValue(metrics, "I", IMPACT_VALUES);
  const availability = metricValue(metrics, "A", IMPACT_VALUES);
  if ([confidentiality, integrity, availability].some((value) => value === 0)) {
    return null;
  }
  const impactMetric = confidentiality * integrity * availability;
  const impactSubScore = 1 - impactMetric;

  if (scope !== "U" && scope !== "C") {
    return null;
  }

  const attackVector = metricValue(metrics, "AV", ATTACK_VECTOR_VALUES);
  const attackComplexity = metricValue(metrics, "AC", ATTACK_COMPLEXITY_VALUES);
  const privilegesRequired = metricValue(metrics, "PR", scope === "C" ? PRIVILEGES_REQUIRED_CHANGED_VALUES : PRIVILEGES_REQUIRED_UNCHANGED_VALUES);
  const userInteraction = metricValue(metrics, "UI", USER_INTERACTION_VALUES);

  if ([attackVector, attackComplexity, privilegesRequired, userInteraction].some((value) => value === 0)) {
    return null;
  }

  const impact = scope === "U"
    ? 6.42 * impactSubScore
    : 7.52 * (impactSubScore - 0.029) - 3.25 * Math.pow(impactSubScore - 0.02, 15);
  const exploitability = 8.22 * attackVector * attackComplexity * privilegesRequired * userInteraction;

  if (impact <= 0) {
    return 0;
  }

  const rawScore = scope === "U"
    ? Math.min(impact + exploitability, 10)
    : Math.min(1.08 * (impact + exploitability), 10);
  return roundUpCvss(rawScore);
}

function parseCvssVector(vector: string): Map<string, string> {
  const metrics = new Map<string, string>();
  for (const part of vector.trim().split("/")) {
    if (part.startsWith("CVSS:")) {
      continue;
    }
    const [key, value] = part.split(":");
    if (key && value) {
      metrics.set(key, value);
    }
  }
  return metrics;
}

function metricValue(metrics: Map<string, string>, key: string, values: Record<string, number>): number {
  const value = metrics.get(key);
  return value ? values[value] ?? 0 : 0;
}

function roundUpCvss(score: number): number {
  return Math.ceil((score - Number.EPSILON) * 10) / 10;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

const ATTACK_VECTOR_VALUES: Record<string, number> = {
  N: 0.85,
  A: 0.62,
  L: 0.55,
  P: 0.2
};

const ATTACK_COMPLEXITY_VALUES: Record<string, number> = {
  L: 0.77,
  H: 0.44
};

const PRIVILEGES_REQUIRED_UNCHANGED_VALUES: Record<string, number> = {
  N: 0.85,
  L: 0.62,
  H: 0.27
};

const PRIVILEGES_REQUIRED_CHANGED_VALUES: Record<string, number> = {
  N: 0.85,
  L: 0.68,
  H: 0.5
};

const USER_INTERACTION_VALUES: Record<string, number> = {
  N: 0.85,
  R: 0.62
};

const IMPACT_VALUES: Record<string, number> = {
  H: 0.44,
  L: 0.78,
  N: 1
};
