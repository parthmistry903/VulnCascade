import { Pool } from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROJECT_NAME = cleanProjectName(process.env.ANALYTICS_PROJECT_NAME || "vulncascade");
const MAX_BODY_BYTES = 4096;

let pool: Pool | null | undefined;

function cleanProjectName(value: string): string {
  const cleaned = value.trim().toLowerCase();
  return /^[a-z0-9_-]{1,64}$/.test(cleaned) ? cleaned : "vulncascade";
}

function getPool(): Pool | null {
  if (pool !== undefined) return pool;

  const connectionString = process.env.ANALYTICS_DATABASE_URL;
  pool = connectionString
    ? new Pool({
        connectionString,
        max: 2
      })
    : null;
  return pool;
}

function cleanPagePath(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 512 || !trimmed.startsWith("/")) return null;

  try {
    return new URL(trimmed, "https://local.invalid").pathname.slice(0, 512) || "/";
  } catch {
    return null;
  }
}

function cleanReferrer(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;

  try {
    const url = new URL(value.trim());
    return `${url.origin}${url.pathname}`.slice(0, 1024);
  } catch {
    return null;
  }
}

function cleanVisitorId(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  return /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(trimmed)
    ? trimmed
    : null;
}

function emptyResponse(): Response {
  return new Response(null, {
    status: 204,
    headers: { "Cache-Control": "no-store" }
  });
}

export async function POST(request: Request): Promise<Response> {
  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > MAX_BODY_BYTES) return emptyResponse();

    const body = await request.json().catch(() => null);
    if (!body) return emptyResponse();

    const pagePath = cleanPagePath(body.page_path);
    const referrer = cleanReferrer(body.referrer);
    const visitorId = cleanVisitorId(body.anonymous_visitor_id);
    const activePool = getPool();

    if (!pagePath || !visitorId || !activePool) return emptyResponse();

    await activePool.query(
      `
        INSERT INTO analytics_page_views (
          project_name,
          page_path,
          referrer,
          anonymous_visitor_id
        )
        VALUES ($1, $2, $3, $4)
      `,
      [PROJECT_NAME, pagePath, referrer, visitorId]
    );
  } catch {
    
  }

  return emptyResponse();
}

export function HEAD(): Response {
  return emptyResponse();
}

export function OPTIONS(): Response {
  return emptyResponse();
}
