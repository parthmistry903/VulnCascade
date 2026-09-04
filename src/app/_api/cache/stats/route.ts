import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/errors";
import { cacheStats } from "@/services/storage";
import { requireAuthenticatedUser } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    await requireAuthenticatedUser(request);
    return NextResponse.json(await cacheStats());
  } catch (error) {
    return errorResponse(error);
  }
}
