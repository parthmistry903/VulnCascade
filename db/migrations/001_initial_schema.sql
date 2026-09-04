CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS packages (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  package_name    VARCHAR(255) NOT NULL,
  ecosystem       VARCHAR(10)  NOT NULL CHECK (ecosystem IN ('npm', 'pip')),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (package_name, ecosystem)
);
CREATE INDEX IF NOT EXISTS idx_packages_name_eco ON packages (package_name, ecosystem);

CREATE TABLE IF NOT EXISTS cves (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  cve_id          VARCHAR(30)   NOT NULL UNIQUE,
  description     TEXT          NOT NULL,
  cvss_score      NUMERIC(4,1)  CHECK (cvss_score BETWEEN 0 AND 10),
  severity        VARCHAR(10)   CHECK (severity IN ('NONE','LOW','MEDIUM','HIGH','CRITICAL','UNKNOWN')),
  cwe_ids         TEXT[],
  "references"    TEXT[],
  published_at    TIMESTAMPTZ,
  last_modified   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cves_cve_id ON cves (cve_id);
CREATE INDEX IF NOT EXISTS idx_cves_severity ON cves (severity);

CREATE TABLE IF NOT EXISTS scans (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  ecosystem           VARCHAR(10)  NOT NULL CHECK (ecosystem IN ('npm', 'pip')),
  package_count       INTEGER      NOT NULL,
  vulnerable_count    INTEGER      NOT NULL DEFAULT 0,
  overall_risk_score  NUMERIC(4,2) NOT NULL DEFAULT 0,
  scan_duration_ms    INTEGER,
  status              VARCHAR(20)  NOT NULL DEFAULT 'completed'
                        CHECK (status IN ('completed','partial','failed')),
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  project_name        VARCHAR(255) NOT NULL DEFAULT 'project',
  warnings            JSONB        NOT NULL DEFAULT '[]'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_scans_created_at ON scans (created_at DESC);

CREATE TABLE IF NOT EXISTS scan_packages (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id             UUID         NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  package_id          UUID         NOT NULL REFERENCES packages(id),
  version             VARCHAR(50),
  requested_version   VARCHAR(100),
  risk_score          NUMERIC(4,2) NOT NULL DEFAULT 0,
  blast_radius_count  INTEGER      NOT NULL DEFAULT 0,
  cve_count           INTEGER      NOT NULL DEFAULT 0,
  lookup_status       VARCHAR(20)  NOT NULL DEFAULT 'success'
                        CHECK (lookup_status IN ('success','failed','cached','unavailable')),
  blast_radius        JSONB        NOT NULL DEFAULT '[]'::jsonb,
  UNIQUE (scan_id, package_id)
);
CREATE INDEX IF NOT EXISTS idx_sp_scan_id ON scan_packages (scan_id);

CREATE TABLE IF NOT EXISTS scan_package_cves (
  scan_package_id  UUID NOT NULL REFERENCES scan_packages(id) ON DELETE CASCADE,
  cve_id           UUID NOT NULL REFERENCES cves(id),
  PRIMARY KEY (scan_package_id, cve_id)
);

CREATE TABLE IF NOT EXISTS graph_edges (
  id              UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id         UUID  NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
  source_pkg_id   UUID,
  target_pkg_id   UUID,
  source_node_id  VARCHAR(320) NOT NULL,
  target_node_id  VARCHAR(320) NOT NULL,
  edge_type       VARCHAR(20) NOT NULL DEFAULT 'depends_on'
);
CREATE INDEX IF NOT EXISTS idx_edges_scan ON graph_edges (scan_id);

CREATE TABLE IF NOT EXISTS cve_cache (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  package_name    VARCHAR(255) NOT NULL,
  ecosystem       VARCHAR(10)  NOT NULL,
  source          VARCHAR(20)  NOT NULL DEFAULT 'osv',
  raw_cve_data    JSONB        NOT NULL,
  fetched_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (package_name, ecosystem, source)
);
CREATE INDEX IF NOT EXISTS idx_cache_pkg ON cve_cache (package_name, ecosystem);
CREATE INDEX IF NOT EXISTS idx_cache_fetched ON cve_cache (fetched_at);
