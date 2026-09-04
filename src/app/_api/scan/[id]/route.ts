import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth";
import { errorResponse } from "@/lib/errors";
import { isUuid } from "@/lib/validation";
import { getScan, deleteScan } from "@/services/storage";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuthenticatedUser(_request);
    const { id } = await context.params;
    if (!isUuid(id)) {
      return NextResponse.json({ error: "Invalid scan ID format.", code: "INVALID_SCAN_ID" }, { status: 400 });
    }
    const scan = await getScan(id, user.id);
    if (!scan) {
      return NextResponse.json({ error: "Scan not found.", code: "NOT_FOUND" }, { status: 404 });
    }
    return NextResponse.json(scan);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const user = await requireAuthenticatedUser(_request);
    const { id } = await context.params;
    if (!isUuid(id)) {
      return NextResponse.json({ error: "Invalid scan ID format.", code: "INVALID_SCAN_ID" }, { status: 400 });
    }
    const deleted = await deleteScan(id, user.id);
    if (!deleted) {
      return NextResponse.json({ error: "Scan not found.", code: "NOT_FOUND" }, { status: 404 });
    }
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
