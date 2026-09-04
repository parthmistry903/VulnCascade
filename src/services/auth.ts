import { pbkdf2Sync, randomBytes, randomUUID, timingSafeEqual, createHash } from "node:crypto";
import { AuthError } from "@/lib/errors";
import type { AuthUser } from "@/lib/types";
import { ensureSchema, execute, isDatabaseConfigured, query } from "@/services/database";

export const SESSION_COOKIE_NAME = "vulncascade_session";

const PASSWORD_ITERATIONS = 310_000;
const PASSWORD_KEY_LENGTH = 64;
const PASSWORD_DIGEST = "sha512";
const SESSION_TOKEN_BYTES = 32;
const DEFAULT_SESSION_TTL_DAYS = 30;

const memoryUsers = new Map<string, UserRecord>();
const memoryUsersByEmail = new Map<string, string>();
const memorySessions = new Map<string, SessionRecord>();

interface UserRecord {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: string;
}

interface SessionRecord {
  tokenHash: string;
  userId: string;
  expiresAt: string;
  createdAt: string;
}

interface UserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  created_at: Date | string;
}

interface SessionUserRow {
  id: string;
  email: string;
  name: string;
  created_at: Date | string;
}

export interface AuthSession {
  user: AuthUser;
  sessionToken: string;
  expiresAt: string;
}

export async function createAccount(input: { email: string; name: string; password: string }): Promise<AuthSession> {
  assertPersistentAuthAvailable();
  const email = normalizeEmail(input.email);
  const name = normalizeName(input.name, email);
  const password = normalizePassword(input.password);
  const passwordHash = hashPassword(password);

  if (await ensureSchema()) {
    try {
      const [row] = await query<UserRow>(
        `INSERT INTO users (email, name, password_hash)
         VALUES ($1, $2, $3)
         RETURNING id, email, name, password_hash, created_at`,
        [email, name, passwordHash]
      );
      return createSessionForUser(userFromRow(row));
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AuthError("An account with this email already exists.", "EMAIL_IN_USE", 409);
      }
      throw error;
    }
  }

  if (memoryUsersByEmail.has(email)) {
    throw new AuthError("An account with this email already exists.", "EMAIL_IN_USE", 409);
  }

  const user: UserRecord = {
    id: randomUUID(),
    email,
    name,
    passwordHash,
    createdAt: new Date().toISOString()
  };
  memoryUsers.set(user.id, user);
  memoryUsersByEmail.set(email, user.id);
  return createSessionForUser(toAuthUser(user));
}

export async function login(input: { email: string; password: string }): Promise<AuthSession> {
  assertPersistentAuthAvailable();
  const email = normalizeEmail(input.email);
  const password = normalizePassword(input.password);

  const user = await findUserByEmail(email);
  const isPasswordValid = user ? verifyPassword(password, user.passwordHash) : false;
  if (!user) {
    
    hashPassword(password);
  }

  if (!user || !isPasswordValid) {
    throw new AuthError("Email or password is incorrect.", "INVALID_CREDENTIALS", 401);
  }

  return createSessionForUser(toAuthUser(user));
}

export async function getSessionUser(sessionToken: string | null): Promise<AuthUser | null> {
  if (!sessionToken) {
    return null;
  }

  const tokenHash = hashSessionToken(sessionToken);
  if (await ensureSchema()) {
    const [row] = await query<SessionUserRow>(
      `SELECT u.id, u.email, u.name, u.created_at
       FROM user_sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1
         AND s.expires_at > NOW()
       LIMIT 1`,
      [tokenHash]
    );
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      createdAt: new Date(row.created_at).toISOString()
    };
  }

  const session = memorySessions.get(tokenHash);
  if (!session || Date.parse(session.expiresAt) <= Date.now()) {
    memorySessions.delete(tokenHash);
    return null;
  }

  const user = memoryUsers.get(session.userId);
  return user ? toAuthUser(user) : null;
}

export async function destroySession(sessionToken: string | null): Promise<void> {
  if (!sessionToken) {
    return;
  }

  const tokenHash = hashSessionToken(sessionToken);
  if (await ensureSchema()) {
    await execute("DELETE FROM user_sessions WHERE token_hash = $1", [tokenHash]);
    return;
  }

  memorySessions.delete(tokenHash);
}

async function findUserByEmail(email: string): Promise<UserRecord | null> {
  if (await ensureSchema()) {
    const [row] = await query<UserRow>(
      "SELECT id, email, name, password_hash, created_at FROM users WHERE email = $1 LIMIT 1",
      [email]
    );
    return row
      ? {
          id: row.id,
          email: row.email,
          name: row.name,
          passwordHash: row.password_hash,
          createdAt: new Date(row.created_at).toISOString()
        }
      : null;
  }

  const userId = memoryUsersByEmail.get(email);
  return userId ? memoryUsers.get(userId) ?? null : null;
}

async function createSessionForUser(user: AuthUser): Promise<AuthSession> {
  const sessionToken = randomBytes(SESSION_TOKEN_BYTES).toString("base64url");
  const tokenHash = hashSessionToken(sessionToken);
  const expiresAt = new Date(Date.now() + sessionTtlMs()).toISOString();

  if (await ensureSchema()) {
    await execute(
      `INSERT INTO user_sessions (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, tokenHash, expiresAt]
    );
  } else {
    memorySessions.set(tokenHash, {
      tokenHash,
      userId: user.id,
      expiresAt,
      createdAt: new Date().toISOString()
    });
  }

  return { user, sessionToken, expiresAt };
}

function normalizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || normalized.length > 320) {
    throw new AuthError("Enter a valid email address.", "INVALID_EMAIL", 400);
  }
  return normalized;
}

function normalizeName(name: string, email: string): string {
  const normalized = name.trim() || email.split("@")[0] || "User";
  if (normalized.length > 120) {
    throw new AuthError("Name must be 120 characters or fewer.", "INVALID_NAME", 400);
  }
  return normalized;
}

function normalizePassword(password: string): string {
  if (password.length < 8) {
    throw new AuthError("Password must be at least 8 characters.", "WEAK_PASSWORD", 400);
  }
  if (password.length > 256) {
    throw new AuthError("Password must be 256 characters or fewer.", "PASSWORD_TOO_LONG", 400);
  }
  return password;
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("base64url");
  const hash = pbkdf2Sync(password, salt, PASSWORD_ITERATIONS, PASSWORD_KEY_LENGTH, PASSWORD_DIGEST).toString("base64url");
  return `pbkdf2_${PASSWORD_DIGEST}$${PASSWORD_ITERATIONS}$${salt}$${hash}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [algorithm, iterationsRaw, salt, expectedHash] = storedHash.split("$");
  if (algorithm !== `pbkdf2_${PASSWORD_DIGEST}` || !iterationsRaw || !salt || !expectedHash) {
    return false;
  }

  const iterations = Number.parseInt(iterationsRaw, 10);
  if (!Number.isFinite(iterations) || iterations < 1) {
    return false;
  }

  const actual = Buffer.from(pbkdf2Sync(password, salt, iterations, PASSWORD_KEY_LENGTH, PASSWORD_DIGEST).toString("base64url"));
  const expected = Buffer.from(expectedHash);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function hashSessionToken(sessionToken: string): string {
  return createHash("sha256").update(sessionToken).digest("hex");
}

function sessionTtlMs(): number {
  const days = Number.parseInt(process.env.SESSION_TTL_DAYS ?? String(DEFAULT_SESSION_TTL_DAYS), 10);
  const safeDays = Number.isFinite(days) && days > 0 ? days : DEFAULT_SESSION_TTL_DAYS;
  return safeDays * 24 * 60 * 60 * 1000;
}

function userFromRow(row: UserRow): AuthUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    createdAt: new Date(row.created_at).toISOString()
  };
}

function toAuthUser(user: UserRecord): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt
  };
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

function assertPersistentAuthAvailable(): void {
  if (process.env.NODE_ENV === "production" && !isDatabaseConfigured()) {
    throw new AuthError("DATABASE_URL is required for persistent user accounts.", "DATABASE_REQUIRED", 503);
  }
}
