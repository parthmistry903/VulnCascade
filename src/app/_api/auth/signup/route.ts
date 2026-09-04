import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth";
import { RequestBodyParseError, errorResponse } from "@/lib/errors";
import { createAccount } from "@/services/auth";

interface SignupRequestBody {
  email?: unknown;
  name?: unknown;
  password?: unknown;
}

export async function POST(request: Request) {
  try {
    const body = await readRequestBody(request);
    const session = await createAccount({
      email: typeof body.email === "string" ? body.email : "",
      name: typeof body.name === "string" ? body.name : "",
      password: typeof body.password === "string" ? body.password : ""
    });

    const response = NextResponse.json({ user: session.user }, { status: 201 });
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}

async function readRequestBody(request: Request): Promise<SignupRequestBody> {
  try {
    return (await request.json()) as SignupRequestBody;
  } catch {
    throw new RequestBodyParseError();
  }
}
