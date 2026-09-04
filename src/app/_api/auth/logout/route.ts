import { NextResponse } from "next/server";
import { clearCurrentSession, clearSessionCookie } from "@/lib/auth";
import { errorResponse } from "@/lib/errors";

export async function POST(request: Request) {
  try {
    await clearCurrentSession(request);
    const response = NextResponse.json({ ok: true });
    clearSessionCookie(response);
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
