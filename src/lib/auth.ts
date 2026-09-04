import { NextResponse } from "next/server";
import { AuthRequiredError } from "@/lib/errors";
import type { AuthUser } from "@/lib/types";
import { destroySession, getSessionUser, SESSION_COOKIE_NAME } from "@/services/auth";

export async function requireAuthenticatedUser(request: Request): Promise<AuthUser> {
  const user = await getSessionUser(getSessionToken(request));
  if (!user) {
    throw new AuthRequiredError();
  }
  return user;
}

export async function clearCurrentSession(request: Request): Promise<void> {
  await destroySession(getSessionToken(request));
}

export function getSessionToken(request: Request): string | null {
  const cookie = request.headers.get("cookie");
  if (!cookie) {
    return null;
  }

  for (const part of cookie.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (rawName === SESSION_COOKIE_NAME) {
      try {
        return decodeURIComponent(rawValue.join("="));
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function setSessionCookie(response: NextResponse, sessionToken: string, expiresAt: string): void {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: sessionToken,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt)
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });
}
