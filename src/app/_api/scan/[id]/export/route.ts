import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth";
import { errorResponse } from "@/lib/errors";
import { packagesToCsv } from "@/lib/export";
import { isUuid } from "@/lib/validation";
import { getScan } from "@/services/storage";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuthenticatedUser(request);
    const { id } = await context.params;
    if (!isUuid(id)) {
      return NextResponse.json({ error: "Invalid scan ID format.", code: "INVALID_SCAN_ID" }, { status: 400 });
    }
    const scan = await getScan(id, user.id);
    if (!scan) {
      return NextResponse.json({ error: "Scan not found.", code: "NOT_FOUND" }, { status: 404 });
    }

    const url = new URL(request.url);
    const format = url.searchParams.get("format") === "csv" ? "csv" : "json";

    if (format === "csv") {
      const csv = packagesToCsv(scan.packages);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="scan-${scan.scanId}.csv"`
        }
      });
    }

    return new NextResponse(JSON.stringify(scan, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="scan-${scan.scanId}.json"`
      }
    });
  } catch (error) {
    return errorResponse(error);
  }
}
