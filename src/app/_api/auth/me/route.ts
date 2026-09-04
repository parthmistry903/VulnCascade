import { NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth";
import { errorResponse } from "@/lib/errors";
import { getSessionUser } from "@/services/auth";

export async function GET(request: Request) {
  try {
    const user = await getSessionUser(getSessionToken(request));
    if (!user) {
      return NextResponse.json({ error: "Sign in is required.", code: "AUTH_REQUIRED" }, { status: 401 });
    }
    return NextResponse.json({ user });
  } catch (error) {
    return errorResponse(error);
  }
}
