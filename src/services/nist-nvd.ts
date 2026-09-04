import { severityFromScore } from "@/lib/risk";
import type { CveRecord, Ecosystem, PackageInfo, Severity } from "@/lib/types";
import { getCachedCves, setCachedCves } from "@/services/storage";

interface NvdResponse {
  vulnerabilities?: NvdVulnerability[];
}

interface NvdVulnerability {
  cve?: NvdCve;
}

interface NvdCve {
  id?: string;
  descriptions?: Array<{ lang?: string; value?: string }>;
  metrics?: {
    cvssMetricV31?: NvdMetric[];
    cvssMetricV30?: NvdMetric[];
    cvssMetricV2?: NvdMetric[];
  };
  weaknesses?: Array<{
    description?: Array<{ lang?: string; value?: string }>;
  }>;
  references?: {
    referenceData?: Array<{ url?: string }>;
  };
  published?: string;
  lastModified?: string;
}

interface NvdMetric {
  cvssData?: {
    baseScore?: number;
    baseSeverity?: string;
  };
  baseSeverity?: string;
}

export interface CveLookupResult {
  packageName: string;
  cves: CveRecord[];
  lookupStatus: "success" | "cached" | "failed" | "unavailable";
}

const NVD_URL = "https://services.nvd.nist.gov/rest/json/cves/2.0";
const WINDOW_MS = 30_000;
const MAX_REQUESTS_PER_WINDOW = process.env.NVD_API_KEY ? 45 : 4;

class NvdRateLimiter {
  private timestamps: number[] = [];

  async waitForSlot(): Promise<void> {
    const now = Date.now();
    this.timestamps = this.timestamps.filter((timestamp) => now - timestamp < WINDOW_MS);
    if (this.timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
      const waitMs = WINDOW_MS - (now - this.timestamps[0]) + 100;
      await delay(waitMs);
    }
    this.timestamps.push(Date.now());
  }
}

const limiter = new NvdRateLimiter();

export async function lookupPackageCves(pkg: PackageInfo): Promise<CveLookupResult> {
  const cached = await getCachedCves(pkg.name, pkg.ecosystem, "nvd");
  if (cached) {
    return {
      packageName: pkg.name,
      cves: cached,
      lookupStatus: "cached"
    };
  }

  if (process.env.NVD_DISABLE_NETWORK === "true") {
    return {
      packageName: pkg.name,
      cves: [],
      lookupStatus: "unavailable"
    };
  }

  try {
    await limiter.waitForSlot();
    const cves = await fetchWithRetry(pkg.name, pkg.ecosystem);
    await setCachedCves(pkg.name, pkg.ecosystem, "nvd", cves);
    return {
      packageName: pkg.name,
      cves,
      lookupStatus: "success"
    };
  } catch {
    return {
      packageName: pkg.name,
      cves: [],
      lookupStatus: "failed"
    };
  }
}

async function fetchWithRetry(packageName: string, ecosystem: Ecosystem): Promise<CveRecord[]> {
  const retryDelays = [0, 2000, 4000, 8000];
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retryDelays.length; attempt += 1) {
    if (retryDelays[attempt] > 0) {
      await delay(retryDelays[attempt]);
    }

    try {
      const response = await fetchNvd(packageName, ecosystem);
      if (response.status === 503) {
        lastError = new Error("NVD API is currently down (503 Service Unavailable).");
        break; 
      }
      if ([403, 429].includes(response.status) && attempt < retryDelays.length - 1) {
        lastError = new Error(`NVD responded with ${response.status}.`);
        continue;
      }
      if (!response.ok) {
        throw new Error(`NVD responded with ${response.status}.`);
      }
      const data = (await response.json()) as NvdResponse;
      return parseNvdResponse(data);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Unknown NVD request failure.");
      if (attempt === retryDelays.length - 1) {
        break;
      }
    }
  }

  throw lastError || new Error("NVD API is unavailable after retries");
}

async function fetchNvd(packageName: string, ecosystem: Ecosystem): Promise<Response> {
  const timeoutMs = Number.parseInt(process.env.NVD_REQUEST_TIMEOUT_MS ?? "10000", 10);
  const resultsPerPage = Number.parseInt(process.env.NVD_RESULTS_PER_PAGE ?? "20", 10);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number.isFinite(timeoutMs) ? timeoutMs : 10000);
  const params = new URLSearchParams({
    keywordSearch: packageName,
    keywordExactMatch: "true",
    resultsPerPage: String(Number.isFinite(resultsPerPage) ? resultsPerPage : 20)
  });

  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": `VulnCascade/1.0 (${ecosystem})`
  };
  if (process.env.NVD_API_KEY) {
    headers.apiKey = process.env.NVD_API_KEY;
  }

  try {
    return await fetch(`${NVD_URL}?${params.toString()}`, {
      headers,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

export function parseNvdResponse(data: NvdResponse): CveRecord[] {
  return (data.vulnerabilities ?? [])
    .map((item): CveRecord | null => {
      const cve = item.cve;
      if (!cve?.id) {
        return null;
      }

      const metric = firstMetric(cve.metrics);
      const cvssScore = safeScore(metric?.cvssData?.baseScore);
      const severity = normalizeSeverity(metric?.cvssData?.baseSeverity ?? metric?.baseSeverity, cvssScore);
      const englishDescription =
        cve.descriptions?.find((description) => description.lang === "en")?.value ??
        cve.descriptions?.[0]?.value ??
        "No CVE description was provided by NVD.";

      return {
        id: cve.id,
        description: englishDescription,
        cvssScore,
        severity,
        cweIds: extractCweIds(cve.weaknesses),
        references: (cve.references?.referenceData ?? [])
          .map((reference) => reference.url)
          .filter((url): url is string => typeof url === "string")
          .slice(0, 8),
        publishedAt: cve.published,
        lastModified: cve.lastModified
      };
    })
    .filter((record): record is CveRecord => record !== null)
    .sort((a, b) => b.cvssScore - a.cvssScore);
}

function firstMetric(metrics: NvdCve["metrics"] | undefined): NvdMetric | undefined {
  return metrics?.cvssMetricV31?.[0] ?? metrics?.cvssMetricV30?.[0] ?? metrics?.cvssMetricV2?.[0];
}

function safeScore(score: unknown): number {
  return typeof score === "number" && Number.isFinite(score) ? score : 0;
}

function normalizeSeverity(rawSeverity: unknown, score: number): Severity {
  if (typeof rawSeverity === "string") {
    const severity = rawSeverity.toUpperCase();
    if (severity === "NONE" || severity === "LOW" || severity === "MEDIUM" || severity === "HIGH" || severity === "CRITICAL") {
      return severity;
    }
  }
  return severityFromScore(score);
}

function extractCweIds(weaknesses: NvdCve["weaknesses"] | undefined): string[] {
  const ids = new Set<string>();
  for (const weakness of weaknesses ?? []) {
    for (const description of weakness.description ?? []) {
      if (description.value) {
        ids.add(description.value);
      }
    }
  }
  return [...ids];
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
