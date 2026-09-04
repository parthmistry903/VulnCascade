import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { createAccount, destroySession, getSessionUser, login } from "@/services/auth";

const originalDatabaseUrl = process.env.DATABASE_URL;

afterEach(() => {
  if (originalDatabaseUrl === undefined) {
    delete process.env.DATABASE_URL;
    return;
  }
  process.env.DATABASE_URL = originalDatabaseUrl;
});

describe("auth sessions", () => {
  it("creates accounts, logs in, and invalidates sessions", async () => {
    delete process.env.DATABASE_URL;

    const email = `user-${randomUUID()}@example.com`;
    const signup = await createAccount({
      email,
      name: "Security Lead",
      password: "correct-horse"
    });

    expect(signup.user.email).toBe(email);
    expect(await getSessionUser(signup.sessionToken)).toMatchObject({ email, name: "Security Lead" });

    const loggedIn = await login({ email, password: "correct-horse" });
    expect(loggedIn.sessionToken).not.toBe(signup.sessionToken);
    expect(await getSessionUser(loggedIn.sessionToken)).toMatchObject({ email });

    await destroySession(loggedIn.sessionToken);
    expect(await getSessionUser(loggedIn.sessionToken)).toBeNull();
  });

  it("rejects duplicate emails and invalid passwords", async () => {
    delete process.env.DATABASE_URL;

    const email = `duplicate-${randomUUID()}@example.com`;
    await createAccount({
      email,
      name: "Owner",
      password: "valid-passphrase"
    });

    await expect(
      createAccount({
        email: email.toUpperCase(),
        name: "Other",
        password: "valid-passphrase"
      })
    ).rejects.toMatchObject({ code: "EMAIL_IN_USE" });

    await expect(login({ email, password: "wrong-password" })).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
  });
});
