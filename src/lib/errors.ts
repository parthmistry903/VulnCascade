import { NextResponse } from "next/server";
import { ManifestParseError } from "@/lib/parser";

export class RequestBodyParseError extends Error {
  constructor(message = "Request body must be valid JSON.") {
    super(message);
    this.name = "RequestBodyParseError";
  }
}

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export class AuthRequiredError extends AuthError {
  constructor(message = "Sign in is required.") {
    super(message, "AUTH_REQUIRED", 401);
    this.name = "AuthRequiredError";
  }
}

export function errorResponse(error: unknown): NextResponse<{ error: string; code: string }> {
  if (error instanceof RequestBodyParseError) {
    return NextResponse.json({ error: error.message, code: "INVALID_JSON" }, { status: 400 });
  }

  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
  }

  if (error instanceof ManifestParseError) {
    return NextResponse.json(
      { error: error.message, code: error.statusCode === 413 ? "PAYLOAD_TOO_LARGE" : "INVALID_MANIFEST" },
      { status: error.statusCode }
    );
  }

  if (error instanceof Error) {
    console.error(error);
    return NextResponse.json({ error: "Request failed unexpectedly.", code: "REQUEST_FAILED" }, { status: 500 });
  }

  console.error(error);
  return NextResponse.json({ error: "Unexpected request failure.", code: "REQUEST_FAILED" }, { status: 500 });
}
