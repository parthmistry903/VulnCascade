import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth";
import { RequestBodyParseError, errorResponse } from "@/lib/errors";
import { login } from "@/services/auth";

interface LoginRequestBody {
  email?: unknown;
  password?: unknown;
}

export async function POST(request: Request) {
  try {
    const body = await readRequestBody(request);
    const session = await login({
      email: typeof body.email === "string" ? body.email : "",
      password: typeof body.password === "string" ? body.password : ""
    });

    const response = NextResponse.json({ user: session.user });
    setSessionCookie(response, session.sessionToken, session.expiresAt);
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}

async function readRequestBody(request: Request): Promise<LoginRequestBody> {
  try {
    return (await request.json()) as LoginRequestBody;
  } catch {
    throw new RequestBodyParseError();
  }
}
