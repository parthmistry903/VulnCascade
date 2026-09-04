import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth";
import { errorResponse } from "@/lib/errors";
import { listScans } from "@/services/storage";

export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request);
    const url = new URL(request.url);
    const page = Number.parseInt(url.searchParams.get("page") ?? "1", 10);
    const limit = Number.parseInt(url.searchParams.get("limit") ?? "20", 10);
    const safePage = Number.isFinite(page) ? Math.max(1, page) : 1;
    const safeLimit = Math.min(100, Math.max(1, Number.isFinite(limit) ? limit : 20));
    const result = await listScans(user.id, safePage, safeLimit);
    return NextResponse.json({
      ...result,
      page: safePage,
      pages: Math.max(1, Math.ceil(result.total / safeLimit))
    });
  } catch (error) {
    return errorResponse(error);
  }
}
