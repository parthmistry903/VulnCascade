import { NextResponse } from "next/server";
import { DEMO_SCAN } from "@/lib/demo-scan";
import { packagesToCsv } from "@/lib/export";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "csv" ? "csv" : "json";

  if (format === "csv") {
    return new NextResponse(packagesToCsv(DEMO_SCAN.packages), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=\"vulncascade-demo.csv\""
      }
    });
  }

  return new NextResponse(JSON.stringify(DEMO_SCAN, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": "attachment; filename=\"vulncascade-demo.json\""
    }
  });
}
