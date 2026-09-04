import type { DemoScanSpec } from "@/lib/demo/build";

/**
 * The seeded workspace shown to anyone who signs in to the public demo.
 *
 * Eight scans across two ecosystems, authored as real dependency trees: every
 * transitive edge below is a dependency the package actually declares, and every
 * pinned version is one that really shipped. That matters because blast radius
 * and risk are *computed* from this tree by the production algorithms, not typed
 * in by hand — so the numbers on screen are the numbers the live scanner produces.
 *
 * `hoursAgo` is relative to page load, so the history never reads as stale.
 */
export const DEMO_SCAN_SPECS: DemoScanSpec[] = [
  // -------------------------------------------------------------------------
  {
    id: "payments-api",
    projectName: "payments-api",
    ecosystem: "npm",
    hoursAgo: 9,
    scanDurationMs: 1483,
    note: "Node payment service still on the 2022 lockfile — the worst offender in the workspace.",
    direct: [
      "express", "jsonwebtoken", "axios", "pg", "stripe", "bullmq",
      "winston", "helmet", "zod", "dotenv",
      "jest", "typescript", "eslint", "nodemon"
    ],
    packages: [
      { name: "express", version: "4.17.1", deps: ["body-parser", "qs", "cookie", "path-to-regexp", "send"] },
      { name: "body-parser", version: "1.19.0", deps: ["qs", "raw-body"] },
      { name: "qs", version: "6.7.0" },
      { name: "cookie", version: "0.4.0" },
      { name: "path-to-regexp", version: "0.1.7" },
      { name: "send", version: "0.17.1", deps: ["mime"] },
      { name: "mime", version: "1.6.0" },
      { name: "raw-body", version: "2.4.0" },
      { name: "jsonwebtoken", version: "8.5.1", deps: ["lodash", "semver", "ms"] },
      { name: "lodash", version: "4.17.15" },
      { name: "semver", version: "5.7.1" },
      { name: "ms", version: "2.1.3" },
      { name: "axios", version: "0.21.1", deps: ["follow-redirects"] },
      { name: "follow-redirects", version: "1.14.7" },
      { name: "pg", version: "8.7.3", deps: ["pg-pool", "pg-protocol"] },
      { name: "pg-pool", version: "3.4.1" },
      { name: "pg-protocol", version: "1.5.0" },
      { name: "stripe", version: "8.222.0", deps: ["qs"] },
      { name: "bullmq", version: "1.91.1", deps: ["ioredis", "semver", "cron-parser"] },
      { name: "ioredis", version: "4.28.5" },
      { name: "cron-parser", version: "2.18.0" },
      { name: "winston", version: "3.3.3", deps: ["readable-stream"] },
      { name: "readable-stream", version: "3.6.0" },
      { name: "helmet", version: "4.6.0" },
      { name: "zod", version: "3.11.6" },
      { name: "dotenv", version: "10.0.0" },
      { name: "jest", version: "27.5.1", dev: true, deps: ["micromatch", "json5", "jest-worker"] },
      { name: "micromatch", version: "4.0.4", deps: ["braces"] },
      { name: "braces", version: "3.0.2" },
      { name: "json5", version: "2.2.0" },
      { name: "jest-worker", version: "27.5.1" },
      { name: "typescript", version: "4.5.5", dev: true },
      { name: "eslint", version: "8.7.0", dev: true, deps: ["minimist", "glob-parent", "json5", "cross-spawn"] },
      { name: "minimist", version: "1.2.5" },
      { name: "glob-parent", version: "5.1.1" },
      { name: "cross-spawn", version: "7.0.3" },
      { name: "nodemon", version: "2.0.15", dev: true, deps: ["semver", "minimatch"] },
      { name: "minimatch", version: "3.0.4" }
    ]
  },

  // -------------------------------------------------------------------------
  {
    id: "legacy-invoice-renderer",
    projectName: "legacy-invoice-renderer",
    ecosystem: "npm",
    hoursAgo: 30,
    scanDurationMs: 214,
    note: "Eight packages, untouched since 2019. Small surface, but two of the findings are straight code-execution paths.",
    direct: ["ejs", "lodash", "mkdirp", "pdfkit", "moment", "mime"],
    packages: [
      { name: "ejs", version: "3.1.6", deps: ["jake"] },
      { name: "jake", version: "10.8.2" },
      { name: "lodash", version: "4.17.11" },
      { name: "mkdirp", version: "0.5.1", deps: ["minimist"] },
      { name: "minimist", version: "1.2.0" },
      { name: "pdfkit", version: "0.11.0" },
      { name: "moment", version: "2.24.0" },
      { name: "mime", version: "1.6.0" }
    ]
  },

  // -------------------------------------------------------------------------
  {
    id: "risk-scoring-svc",
    projectName: "risk-scoring-svc",
    ecosystem: "pip",
    hoursAgo: 51,
    scanDurationMs: 968,
    note: "Flask scoring service. Web stack is a minor version behind on three separate advisories.",
    direct: [
      "Flask", "gunicorn", "SQLAlchemy", "psycopg2-binary", "redis", "celery",
      "numpy", "scipy", "pandas", "cryptography", "PyJWT", "requests"
    ],
    packages: [
      { name: "Flask", version: "2.1.3", deps: ["Werkzeug", "Jinja2", "itsdangerous", "click"] },
      { name: "Werkzeug", version: "2.1.2" },
      { name: "Jinja2", version: "3.1.2", deps: ["MarkupSafe"] },
      { name: "MarkupSafe", version: "2.1.3" },
      { name: "itsdangerous", version: "2.1.2" },
      { name: "click", version: "8.1.3" },
      { name: "gunicorn", version: "20.1.0" },
      { name: "SQLAlchemy", version: "2.0.15", deps: ["greenlet"] },
      { name: "greenlet", version: "2.0.2" },
      { name: "psycopg2-binary", version: "2.9.6" },
      { name: "redis", version: "4.5.5" },
      { name: "celery", version: "5.2.7", deps: ["kombu", "billiard", "click"] },
      { name: "kombu", version: "5.2.4", deps: ["amqp"] },
      { name: "amqp", version: "5.1.1" },
      { name: "billiard", version: "3.6.4.0" },
      { name: "numpy", version: "1.24.3" },
      { name: "scipy", version: "1.10.1", deps: ["numpy"] },
      { name: "pandas", version: "2.0.1", deps: ["numpy", "python-dateutil"] },
      { name: "python-dateutil", version: "2.8.2", deps: ["six"] },
      { name: "six", version: "1.16.0" },
      { name: "cryptography", version: "40.0.2", deps: ["cffi"] },
      { name: "cffi", version: "1.15.1" },
      { name: "PyJWT", version: "2.7.0" },
      { name: "requests", version: "2.30.0", deps: ["urllib3", "certifi", "idna", "charset-normalizer"] },
      { name: "urllib3", version: "1.26.16" },
      { name: "certifi", version: "2023.7.22" },
      { name: "idna", version: "3.4" },
      { name: "charset-normalizer", version: "3.1.0" }
    ]
  },

  // -------------------------------------------------------------------------
  {
    id: "ml-feature-store",
    projectName: "ml-feature-store",
    ecosystem: "pip",
    hoursAgo: 146,
    scanDurationMs: 1122,
    note: "Feature pipeline pinned for reproducibility — which is exactly why it carries two critical CVEs.",
    direct: [
      "transformers", "torch", "scikit-learn", "mlflow", "pandas", "numpy",
      "fastapi", "uvicorn", "pydantic", "PyYAML", "boto3"
    ],
    packages: [
      { name: "transformers", version: "4.30.2", deps: ["requests", "filelock", "tokenizers", "PyYAML", "numpy"] },
      { name: "torch", version: "2.0.1", deps: ["filelock", "sympy", "Jinja2"] },
      { name: "scikit-learn", version: "1.2.2", deps: ["numpy", "scipy", "joblib"] },
      { name: "mlflow", version: "2.4.1", deps: ["Flask", "Jinja2", "requests", "PyYAML", "pandas"] },
      { name: "Flask", version: "2.2.3", deps: ["Werkzeug", "Jinja2", "itsdangerous", "click"] },
      { name: "Werkzeug", version: "2.2.2" },
      { name: "Jinja2", version: "3.1.2", deps: ["MarkupSafe"] },
      { name: "MarkupSafe", version: "2.1.3" },
      { name: "itsdangerous", version: "2.1.2" },
      { name: "click", version: "8.1.3" },
      { name: "pandas", version: "2.0.2", deps: ["numpy", "python-dateutil"] },
      { name: "python-dateutil", version: "2.8.2" },
      { name: "numpy", version: "1.24.3" },
      { name: "scipy", version: "1.10.1", deps: ["numpy"] },
      { name: "joblib", version: "1.2.0" },
      { name: "fastapi", version: "0.95.2", deps: ["starlette", "pydantic", "python-multipart"] },
      { name: "starlette", version: "0.27.0" },
      { name: "python-multipart", version: "0.0.6" },
      { name: "uvicorn", version: "0.22.0", deps: ["click"] },
      { name: "pydantic", version: "1.10.8" },
      { name: "PyYAML", version: "5.3.1" },
      { name: "boto3", version: "1.26.140", deps: ["botocore"] },
      { name: "botocore", version: "1.29.140", deps: ["urllib3", "python-dateutil"] },
      { name: "requests", version: "2.29.0", deps: ["urllib3", "certifi", "idna"] },
      { name: "urllib3", version: "1.26.15" },
      { name: "certifi", version: "2023.5.7" },
      { name: "idna", version: "3.4" },
      { name: "filelock", version: "3.12.0" },
      { name: "tokenizers", version: "0.13.3" },
      { name: "sympy", version: "1.12" }
    ]
  },

  // -------------------------------------------------------------------------
  {
    id: "checkout-web",
    projectName: "checkout-web",
    ecosystem: "npm",
    hoursAgo: 264,
    scanDurationMs: 842,
    note: "Storefront on Next 13. Most findings sit in the build toolchain rather than in shipped code.",
    direct: [
      "next", "react", "react-dom", "axios", "d3", "zustand",
      "tailwindcss", "typescript", "eslint", "vitest"
    ],
    packages: [
      { name: "next", version: "13.4.7", deps: ["postcss", "styled-jsx", "caniuse-lite", "busboy"] },
      { name: "postcss", version: "8.4.24", deps: ["nanoid", "source-map-js"] },
      { name: "nanoid", version: "3.3.6" },
      { name: "source-map-js", version: "1.0.2" },
      { name: "styled-jsx", version: "5.1.1" },
      { name: "caniuse-lite", version: "1.0.30001515" },
      { name: "busboy", version: "1.6.0" },
      { name: "react", version: "18.2.0" },
      { name: "react-dom", version: "18.2.0", deps: ["scheduler", "react"] },
      { name: "scheduler", version: "0.23.0" },
      { name: "axios", version: "1.4.0", deps: ["follow-redirects", "form-data"] },
      { name: "follow-redirects", version: "1.15.2" },
      { name: "form-data", version: "4.0.0" },
      { name: "d3", version: "7.8.5", deps: ["d3-color", "d3-scale", "d3-selection"] },
      { name: "d3-color", version: "3.0.1" },
      { name: "d3-scale", version: "4.0.2" },
      { name: "d3-selection", version: "3.0.0" },
      { name: "zustand", version: "4.3.9" },
      { name: "tailwindcss", version: "3.3.2", deps: ["postcss", "micromatch"] },
      { name: "micromatch", version: "4.0.5", deps: ["braces"] },
      { name: "braces", version: "3.0.2" },
      { name: "typescript", version: "5.1.6", dev: true },
      { name: "eslint", version: "8.44.0", dev: true, deps: ["cross-spawn", "glob-parent", "minimatch"] },
      { name: "cross-spawn", version: "7.0.3" },
      { name: "glob-parent", version: "6.0.2" },
      { name: "minimatch", version: "3.1.2" },
      { name: "vitest", version: "0.33.0", dev: true, deps: ["vite", "tinypool"] },
      { name: "vite", version: "5.2.11" },
      { name: "tinypool", version: "0.7.0" }
    ]
  },

  // -------------------------------------------------------------------------
  {
    id: "notifications-worker",
    projectName: "notifications-worker",
    ecosystem: "npm",
    hoursAgo: 388,
    scanDurationMs: 611,
    note: "Queue worker that renders email templates. The EJS pin is a straight remote-code-execution path.",
    direct: ["express", "ws", "node-fetch", "ejs", "ioredis", "pino", "dotenv", "jest", "typescript"],
    packages: [
      { name: "express", version: "4.18.2", deps: ["body-parser", "qs", "cookie", "path-to-regexp", "send"] },
      { name: "body-parser", version: "1.20.1", deps: ["qs", "raw-body"] },
      { name: "qs", version: "6.11.0" },
      { name: "raw-body", version: "2.5.1" },
      { name: "cookie", version: "0.5.0" },
      { name: "path-to-regexp", version: "0.1.7" },
      { name: "send", version: "0.18.0" },
      { name: "ws", version: "7.5.9" },
      { name: "node-fetch", version: "2.6.1", deps: ["whatwg-url"] },
      { name: "whatwg-url", version: "5.0.0" },
      { name: "ejs", version: "3.1.6", deps: ["jake"] },
      { name: "jake", version: "10.8.5" },
      { name: "ioredis", version: "5.3.2", deps: ["cluster-key-slot"] },
      { name: "cluster-key-slot", version: "1.1.2" },
      { name: "pino", version: "8.14.1", deps: ["sonic-boom"] },
      { name: "sonic-boom", version: "3.3.0" },
      { name: "dotenv", version: "16.3.1" },
      { name: "jest", version: "29.5.0", dev: true, deps: ["micromatch", "json5"] },
      { name: "micromatch", version: "4.0.5", deps: ["braces"] },
      { name: "braces", version: "3.0.2" },
      { name: "json5", version: "2.2.3" },
      { name: "typescript", version: "5.1.3", dev: true }
    ]
  },

  // -------------------------------------------------------------------------
  {
    id: "data-ingest-etl",
    projectName: "data-ingest-etl",
    ecosystem: "pip",
    hoursAgo: 512,
    scanDurationMs: 2740,
    note: "Partial scan: two lookups were rate-limited upstream, so those packages are reported as unknown, not clean.",
    direct: [
      "pandas", "numpy", "requests", "boto3", "pyarrow", "SQLAlchemy",
      "psycopg2-binary", "PyYAML", "click", "python-dateutil"
    ],
    warnings: [
      { line: 14, message: "Could not parse requirements.txt line 14." },
      { message: "Package \"pyarrow\" uses an environment marker; version resolved without the marker." }
    ],
    packages: [
      { name: "pandas", version: "1.5.3", deps: ["numpy", "python-dateutil"] },
      { name: "numpy", version: "1.21.6" },
      { name: "requests", version: "2.28.1", deps: ["urllib3", "certifi", "charset-normalizer", "idna"] },
      { name: "urllib3", version: "1.26.14" },
      { name: "certifi", version: "2023.11.17" },
      { name: "charset-normalizer", version: "3.1.0" },
      { name: "idna", version: "3.4" },
      { name: "boto3", version: "1.26.90", deps: ["botocore", "s3transfer"] },
      { name: "botocore", version: "1.29.90", deps: ["urllib3", "python-dateutil"] },
      { name: "s3transfer", version: "0.6.0", deps: ["botocore"] },
      { name: "pyarrow", version: "11.0.0", deps: ["numpy"], lookupStatus: "unavailable" },
      { name: "SQLAlchemy", version: "1.4.46", deps: ["greenlet"] },
      { name: "greenlet", version: "2.0.2" },
      { name: "psycopg2-binary", version: "2.9.5", lookupStatus: "failed" },
      { name: "PyYAML", version: "6.0" },
      { name: "click", version: "8.1.3" },
      { name: "python-dateutil", version: "2.8.2", deps: ["six"] },
      { name: "six", version: "1.16.0" },
      { name: "setuptools", version: "65.5.0" }
    ]
  },

  // -------------------------------------------------------------------------
  {
    id: "internal-tools-cli",
    projectName: "internal-tools-cli",
    ecosystem: "npm",
    hoursAgo: 656,
    scanDurationMs: 397,
    note: "Small internal CLI, patched last sprint. Two findings left, both medium and both in build-time tooling.",
    direct: [
      "commander", "chalk", "ora", "inquirer", "semver", "tar",
      "cross-spawn", "yaml", "typescript", "vitest", "eslint"
    ],
    packages: [
      { name: "commander", version: "11.0.0" },
      { name: "chalk", version: "5.3.0" },
      { name: "ora", version: "7.0.1", deps: ["cli-cursor", "string-width"] },
      { name: "cli-cursor", version: "4.0.0" },
      { name: "string-width", version: "6.1.0" },
      { name: "inquirer", version: "9.2.7", deps: ["mute-stream", "run-async", "ora"] },
      { name: "mute-stream", version: "1.0.0" },
      { name: "run-async", version: "3.0.0" },
      { name: "semver", version: "7.5.4" },
      { name: "tar", version: "6.1.15" },
      { name: "cross-spawn", version: "7.0.6" },
      { name: "yaml", version: "2.3.1" },
      { name: "typescript", version: "5.1.6", dev: true },
      { name: "vitest", version: "1.6.0", dev: true, deps: ["vite", "tinypool"] },
      { name: "vite", version: "5.4.8" },
      { name: "tinypool", version: "0.8.4" },
      { name: "eslint", version: "8.57.0", dev: true, deps: ["cross-spawn", "glob-parent", "optionator"] },
      { name: "glob-parent", version: "6.0.2" },
      { name: "optionator", version: "0.9.3", deps: ["word-wrap"] },
      { name: "word-wrap", version: "1.2.3" }
    ]
  },

  // -------------------------------------------------------------------------
  {
    id: "docs-site",
    projectName: "docs-site",
    ecosystem: "npm",
    hoursAgo: 793,
    scanDurationMs: 288,
    note: "Marketing docs, dependencies refreshed last month. Zero findings — this is what clean looks like.",
    direct: [
      "next", "react", "react-dom", "tailwindcss", "gray-matter",
      "remark", "typescript", "eslint"
    ],
    packages: [
      { name: "next", version: "14.2.5", deps: ["postcss", "styled-jsx", "caniuse-lite"] },
      { name: "postcss", version: "8.4.39", deps: ["nanoid", "source-map-js"] },
      { name: "nanoid", version: "3.3.7" },
      { name: "source-map-js", version: "1.2.0" },
      { name: "styled-jsx", version: "5.1.6" },
      { name: "caniuse-lite", version: "1.0.30001640" },
      { name: "react", version: "18.3.1" },
      { name: "react-dom", version: "18.3.1", deps: ["scheduler", "react"] },
      { name: "scheduler", version: "0.23.2" },
      { name: "tailwindcss", version: "3.4.6", deps: ["postcss", "micromatch"] },
      { name: "micromatch", version: "4.0.8", deps: ["braces"] },
      { name: "braces", version: "3.0.3" },
      { name: "gray-matter", version: "4.0.3", deps: ["js-yaml"] },
      { name: "js-yaml", version: "4.1.0" },
      { name: "remark", version: "15.0.1", deps: ["unified"] },
      { name: "unified", version: "11.0.5" },
      { name: "typescript", version: "5.5.4", dev: true },
      { name: "eslint", version: "9.7.0", dev: true, deps: ["cross-spawn", "minimatch"] },
      { name: "cross-spawn", version: "7.0.6" },
      { name: "minimatch", version: "3.1.2" }
    ]
  }
];

/** Short human summaries, surfaced next to each row in the demo history table. */
export const DEMO_SCAN_NOTES: Record<string, string> = Object.fromEntries(
  DEMO_SCAN_SPECS.map((spec) => [spec.id, spec.note])
);

/** How many scans the seeded workspace ships with. */
export const DEMO_SCAN_COUNT = DEMO_SCAN_SPECS.length;

/** Static route params for `/scan/[id]` in the exported demo build. */
export const DEMO_SCAN_IDS: string[] = DEMO_SCAN_SPECS.map((spec) => spec.id);
