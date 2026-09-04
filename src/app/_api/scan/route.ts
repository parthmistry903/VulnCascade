import { NextResponse } from "next/server";
import { buildScanGraph } from "@/algorithms/graph";
import { requireAuthenticatedUser } from "@/lib/auth";
import { RequestBodyParseError, errorResponse } from "@/lib/errors";
import { mapWithConcurrency } from "@/lib/concurrency";
import { parseManifest } from "@/lib/parser";
import { riskLabel } from "@/lib/risk";
import type { EcosystemInput, ScanStatus } from "@/lib/types";
import { lookupPackageCves } from "@/services/osv-api";
import { saveScan } from "@/services/storage";

interface ScanRequestBody {
  manifest?: unknown;
  ecosystem?: unknown;
  includeDev?: unknown;
}

export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request);
    const startedAt = performance.now();
    const body = await readRequestBody(request);
    const manifest = typeof body.manifest === "string" ? body.manifest : "";
    const ecosystem = normalizeEcosystem(body.ecosystem);
    const includeDev = typeof body.includeDev === "boolean" ? body.includeDev : true;

    const parsed = await parseManifest(manifest, ecosystem, includeDev);
    const lookupResults = await mapWithConcurrency(parsed.packages, lookupConcurrency(), lookupPackageCves);

    const graph = buildScanGraph(parsed.projectName, parsed.ecosystem, parsed.packages, lookupResults);
    const failedLookups = lookupResults.filter((result) => result.lookupStatus === "failed").length;
    const unavailableLookups = lookupResults.filter((result) => result.lookupStatus === "unavailable").length;
    const status: ScanStatus = failedLookups > 0 || unavailableLookups > 0 ? "partial" : "completed";
    const scanDurationMs = Math.max(1, Math.round(performance.now() - startedAt));
    const vulnerableCount = graph.packages.filter((pkg) => pkg.cveCount > 0).length;

    const scan = await saveScan(
      {
        ecosystem: parsed.ecosystem,
        packageCount: graph.packages.length,
        vulnerableCount,
        overallRiskScore: graph.overallRiskScore,
        riskLabel: riskLabel(graph.overallRiskScore),
        scanDurationMs,
        status,
        packages: graph.packages,
        graphData: graph.graphData,
        warnings: parsed.warnings,
        projectName: parsed.projectName
      },
      user.id
    );

    return NextResponse.json(scan, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

function normalizeEcosystem(value: unknown): EcosystemInput {
  if (value === "npm" || value === "pip" || value === "auto") {
    return value;
  }
  return "auto";
}

function lookupConcurrency(): number {
  const configured = Number.parseInt(process.env.OSV_LOOKUP_CONCURRENCY ?? "6", 10);
  return Number.isFinite(configured) ? configured : 6;
}

async function readRequestBody(request: Request): Promise<ScanRequestBody> {
  try {
    return (await request.json()) as ScanRequestBody;
  } catch {
    throw new RequestBodyParseError();
  }
}
