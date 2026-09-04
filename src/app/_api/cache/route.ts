import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/errors";
import { clearCache } from "@/services/storage";

export async function DELETE(request: Request) {
  try {
    const unauthorized = authorizeCacheDelete(request);
    if (unauthorized) {
      return unauthorized;
    }

    const url = new URL(request.url);
    const packageName = url.searchParams.get("packageName") ?? undefined;
    const deleted = await clearCache(packageName);
    return NextResponse.json({ deleted });
  } catch (error) {
    return errorResponse(error);
  }
}

function authorizeCacheDelete(request: Request): NextResponse<{ error: string; code: string }> | null {
  const expectedToken = process.env.CACHE_ADMIN_TOKEN;
  if (expectedToken) {
    const providedToken = request.headers.get("x-cache-admin-token");
    if (providedToken !== expectedToken) {
      return NextResponse.json({ error: "Cache admin token is invalid.", code: "UNAUTHORIZED" }, { status: 401 });
    }
    return null;
  }

  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "CACHE_ADMIN_TOKEN is required to clear cache in production.", code: "CACHE_ADMIN_TOKEN_REQUIRED" },
      { status: 403 }
    );
  }

  return null;
}
