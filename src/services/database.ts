import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool, type PoolClient, type QueryResultRow } from "pg";

let pool: Pool | null = null;
let schemaReady = false;

export interface DatabaseConnection {
  query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<T[]>;
  execute(text: string, params?: readonly unknown[]): Promise<number>;
}

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const activePool = getPool();
  const result = await activePool.query<T>(text, params);
  return result.rows;
}

export async function execute(text: string, params: readonly unknown[] = []): Promise<number> {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const activePool = getPool();
  const result = await activePool.query(text, [...params]);
  return result.rowCount ?? 0;
}

export async function transaction<T>(callback: (connection: DatabaseConnection) => Promise<T>): Promise<T> {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const client = await getPool().connect();
  await client.query("BEGIN");

  try {
    const result = await callback(clientConnection(client));
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

let schemaPromise: Promise<boolean> | null = null;

export function ensureSchema(): Promise<boolean> {
  if (!isDatabaseConfigured()) {
    return Promise.resolve(false);
  }

  if (schemaReady) {
    return Promise.resolve(true);
  }

  if (!schemaPromise) {
    schemaPromise = (async () => {
      try {
        const activePool = getPool();
        await activePool.query(SCHEMA_SQL);
        await runSchemaMigrations(activePool);
        schemaReady = true;
        return true;
      } catch (error) {
        throw new Error("Database schema initialization failed.", { cause: error });
      } finally {
        schemaPromise = null;
      }
    })();
  }

  return schemaPromise;
}

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: Number.parseInt(process.env.PG_POOL_MAX ?? "10", 10)
    });
  }
  return pool;
}

function clientConnection(client: PoolClient): DatabaseConnection {
  return {
    async query<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []): Promise<T[]> {
      const result = await client.query<T>(text, params);
      return result.rows;
    },
    async execute(text: string, params: readonly unknown[] = []): Promise<number> {
      const result = await client.query(text, [...params]);
      return result.rowCount ?? 0;
    }
  };
}

const SCHEMA_SQL = readFileSync(join(process.cwd(), "db/migrations/001_initial_schema.sql"), "utf8");

interface SchemaMigration {
  id: string;
  sql: string;
}

const SCHEMA_MIGRATIONS: SchemaMigration[] = [
  {
    id: "20260626_existing_schema_compatibility",
    sql: `
      ALTER TABLE scans ADD COLUMN IF NOT EXISTS project_name VARCHAR(255) NOT NULL DEFAULT 'project';
      ALTER TABLE scans ADD COLUMN IF NOT EXISTS warnings JSONB NOT NULL DEFAULT '[]'::jsonb;

      ALTER TABLE scan_packages ADD COLUMN IF NOT EXISTS requested_version VARCHAR(100);
      ALTER TABLE scan_packages ADD COLUMN IF NOT EXISTS lookup_status VARCHAR(20) NOT NULL DEFAULT 'success';
      ALTER TABLE scan_packages ADD COLUMN IF NOT EXISTS blast_radius JSONB NOT NULL DEFAULT '[]'::jsonb;

      ALTER TABLE cves DROP CONSTRAINT IF EXISTS cves_severity_check;
      ALTER TABLE cves ADD CONSTRAINT cves_severity_check CHECK (severity IN ('NONE','LOW','MEDIUM','HIGH','CRITICAL','UNKNOWN'));

      ALTER TABLE scan_packages DROP CONSTRAINT IF EXISTS scan_packages_lookup_status_check;
      ALTER TABLE scan_packages ADD CONSTRAINT scan_packages_lookup_status_check CHECK (lookup_status IN ('success','failed','cached','unavailable'));

      ALTER TABLE cve_cache ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'legacy';
      ALTER TABLE cve_cache ALTER COLUMN source SET DEFAULT 'osv';
      ALTER TABLE cve_cache DROP CONSTRAINT IF EXISTS cve_cache_package_name_ecosystem_key;

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'cve_cache_package_name_ecosystem_source_key'
        ) THEN
          ALTER TABLE cve_cache
          ADD CONSTRAINT cve_cache_package_name_ecosystem_source_key UNIQUE (package_name, ecosystem, source);
        END IF;
      END $$;

      DROP INDEX IF EXISTS idx_cache_pkg;
      CREATE INDEX idx_cache_pkg ON cve_cache (package_name, ecosystem, source);
    `
  },
  {
    id: "20260630_user_auth_and_scan_ownership",
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        email           VARCHAR(320)  NOT NULL UNIQUE,
        name            VARCHAR(120)  NOT NULL,
        password_hash   VARCHAR(255)  NOT NULL,
        created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

      CREATE TABLE IF NOT EXISTS user_sessions (
        id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id         UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash      VARCHAR(64)   NOT NULL UNIQUE,
        expires_at      TIMESTAMPTZ   NOT NULL,
        created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_user_sessions_token_hash ON user_sessions (token_hash);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions (user_id);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions (expires_at);

      ALTER TABLE scans ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;
      CREATE INDEX IF NOT EXISTS idx_scans_user_created_at ON scans (user_id, created_at DESC);
    `
  },
  {
    id: "20260701_scan_user_id_not_null",
    sql: `
      DELETE FROM scans WHERE user_id IS NULL;
      ALTER TABLE scans ALTER COLUMN user_id SET NOT NULL;
    `
  }
];

async function runSchemaMigrations(activePool: Pool): Promise<void> {
  await activePool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id          VARCHAR(100) PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  for (const migration of SCHEMA_MIGRATIONS) {
    const existing = await activePool.query("SELECT id FROM schema_migrations WHERE id = $1", [migration.id]);
    if (existing.rowCount && existing.rowCount > 0) {
      continue;
    }

    await activePool.query("BEGIN");
    try {
      await activePool.query(migration.sql);
      await activePool.query("INSERT INTO schema_migrations (id) VALUES ($1)", [migration.id]);
      await activePool.query("COMMIT");
    } catch (error) {
      await activePool.query("ROLLBACK");
      throw error;
    }
  }
}
