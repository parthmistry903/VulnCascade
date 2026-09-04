# VulnCascade

**A CVE risk mapper for dependency manifests.** Drop in a `package.json` or a `requirements.txt` and it resolves every declared package against the [Google OSV](https://osv.dev) advisory database, builds the dependency graph, and scores each finding by its *blast radius* — how much of your project a flaw in that package actually reaches.

A CVSS score tells you how bad a vulnerability is in isolation. It does not tell you that the 5.3 in `micromatch` sits under four of your build tools while the 9.8 in a leaf dev-dependency touches nothing. VulnCascade computes both and ranks on the combination.

> **⚠️ This repository is the public demo build.**
> It runs entirely in the browser: seeded data, no server, no database, no API keys, no outbound requests. The complete application is in this repo too — [see *Run the real thing*](#run-the-real-thing) to switch it on.

---

## Try it

**[→ Live demo](https://vulncascade.pages.dev)**

| | |
|---|---|
| **Email** | `recruiter@vulncascade.dev` |
| **Password** | `ScanTheDemo2026` |

Both fields are pre-filled on the sign-in page — press **Sign In**. There is also a `/demo` route that opens one scan with no sign-in at all.

---

## What you can do in the demo

- **Browse nine seeded scans** across npm and pip, ranging from a clean docs site (`0.0`) to an abandoned invoice renderer with two code-execution paths (`Critical 9.5`).
- **Open the dependency graph** — pan, zoom, drag nodes, filter by severity, isolate a package's blast radius, click through to CVE detail with CWE IDs and advisory links.
- **Run your own scan.** Paste any `package.json` or `requirements.txt`, or use the built-in samples. The parse, the graph, and the scoring are the production modules running in your tab.
- **Export** any scan as JSON or CSV.
- **Delete scans** and watch the risk trend redraw. **Reset Demo** in the header restores the seeded workspace.

Everything you change is stored in your own browser's `localStorage` and never leaves it.

---

## Demo build vs. real build

| | Demo (this deployment) | Real (`NEXT_PUBLIC_DEMO_MODE=false`) |
|---|---|---|
| Vulnerability source | Bundled snapshot: **57 real advisories across 52 packages** | Live Google OSV API, optionally enriched from NIST NVD |
| Storage | `localStorage` | PostgreSQL |
| Accounts | One fixed demo account | Sign-up, salted password hashes, server-side sessions |
| Scan history | Nine seeded scans + whatever you scan | Everything you have ever scanned, per user |
| Backend | None — static export | Next.js route handlers |
| Network calls | Zero | OSV, NVD, Postgres |
| API keys | None | Optional NVD key |

**Why it works this way.** A public deployment with live keys is a public deployment of *my* keys: anyone could burn the rate limit, run up a bill, or use the scanner as an open proxy to OSV. Freezing the advisory data removes the attack surface entirely — and the page loads in well under a second because there is nothing to wait for.

**What the demo does *not* fake.** The parser, the dependency-graph builder, the blast-radius BFS, and both risk formulas are the exact modules the live build runs. The seeded scans are hand-authored as real dependency trees — every edge is a dependency the package genuinely declares, every pinned version really shipped, and every advisory is a real published CVE or GHSA. The numbers on screen are computed from that tree at page load, not typed in.

One honest limitation: the offline snapshot only knows 52 packages. If you scan a manifest containing something it has never heard of, that package is reported as **`unavailable`** — grey in the graph, "unknown" in the table. It is never silently reported as clean. The live build resolves every package against OSV instead.

---

## How the scoring works

**Blast radius** is a reverse breadth-first search over the dependency graph: starting at a vulnerable package, walk *up* the edges to everything that depends on it, directly or transitively, including the project root. `computeBlastRadius` in [`src/algorithms/blast-radius.ts`](src/algorithms/blast-radius.ts).

**Package risk** amplifies the worst CVSS score by how far the package reaches:

```
riskScore = min(10, maxCvss × (1 + 0.1 × ln(blastRadiusSize + 1)))
```

**Project risk** is the blast-radius-weighted mean across vulnerable packages, so a shared transitive dependency moves the number more than an isolated leaf:

```
overall = Σ(riskᵢ × radiusᵢ) / Σ(radiusᵢ)
```

Both live in [`src/lib/risk.ts`](src/lib/risk.ts) with unit tests beside them.

**Worked example** — `qs@6.7.0` in the seeded `payments-api` scan. It carries `CVE-2022-24999` (7.5). Three packages pull it in — `express`, `body-parser`, `stripe` — which puts the project root in its radius too, so the radius is 4. Score: `7.5 × (1 + 0.1 × ln 5) = 8.7`. The same CVE on a package nothing else depends on would score `7.5 × (1 + 0.1 × ln 2) = 8.0`.

---

## Tech stack

Next.js 16 (App Router) · React 18 · TypeScript (strict) · PostgreSQL via `pg` · D3.js force simulation · Vitest · vanilla CSS, Neo-Brutalist.

No CSS framework, no component library, no ORM, no state-management library.

---

## Run it locally

Requires **Node 20+**.

```bash
git clone https://github.com/parthmistry903/VulnCascade.git
cd vulncascade
npm install
npm run dev
```

Open <http://localhost:3000>. That is the demo build — no database, no configuration, nothing to sign up for.

---

## Run the real thing

Four steps. Nothing is deleted; you are switching a flag and putting the route handlers back.

### 1. Restore the API routes

The demo is a static export, which cannot contain server routes, so they ship in a private folder that Next.js does not route (`_`-prefixed directories are excluded from the App Router). Rename it back:

```bash
mv src/app/_api src/app/api
```

That single directory contains every server route: auth, parse, scan, history, export, cache admin, analytics.

### 2. Create the database

PostgreSQL 14 or newer:

```bash
createdb vulncascade
psql vulncascade -f db/migrations/001_initial_schema.sql
psql vulncascade -f db/migrations/002_scan_user_id_not_null.sql
```

### 3. Configure the environment

```bash
cp .env.example .env
```

Then edit `.env`:

```dotenv
NEXT_PUBLIC_DEMO_MODE=false
DATABASE_URL=postgres://YOUR_USER@localhost:5432/vulncascade
```

That is the minimum. Everything else has a working default.

### 4. Run it

```bash
npm run dev:live     # development
npm run build:live   # production build
npm start            # serve the production build
```

Sign-up now works, scans hit the live OSV API, and history persists in Postgres.

### Bring your own keys

| Service | Needed? | How to get it |
|---|---|---|
| **Google OSV** | Used for every lookup | **No key, no account, no signup.** It is a free public API. |
| **NIST NVD** | Optional enrichment | Free key from [nvd.nist.gov/developers/request-an-api-key](https://nvd.nist.gov/developers/request-an-api-key). Without one you are capped at ~5 requests/30s; with one, ~50. Set `NVD_API_KEY=` in `.env`, or leave it blank and set `NVD_DISABLE_NETWORK=true` to skip NVD entirely. |
| **PostgreSQL** | Required | Local install, Docker, or any hosted Postgres (Neon, Supabase, Railway). Only the connection string goes in `.env`. |
| **Analytics Postgres** | Optional | Leave `ANALYTICS_DATABASE_URL` blank and no page-view beacon is sent. |

`.env` is git-ignored. Never commit it.

### Optional: strip the demo layer completely

You do not have to. With `NEXT_PUBLIC_DEMO_MODE=false`, Next.js inlines the flag at build time, so every demo branch becomes dead code and the demo dataset is tree-shaken out of the client bundle.

If you want it gone from the source anyway:

1. Delete `src/lib/demo/`, `src/lib/demo-scan.ts`, `src/components/DemoBanner.tsx`, `src/app/demo/`, and `src/app/api/demo/`.
2. In [`src/lib/api-client.ts`](src/lib/api-client.ts), delete every `if (DEMO_MODE) { … }` block and the `demo()` helper. What is left is the plain `fetch` layer.
3. Remove the `DEMO_MODE` imports and the JSX guarded by them from `AuthClient`, `AppNav`, `HomeClient`, `HistoryDashboard`, `ScanResultsClient`, `layout.tsx`, and `scan/[id]/page.tsx` (delete `generateStaticParams` there).
4. In [`next.config.mjs`](next.config.mjs), drop the `isDemo` branch and keep the `headers()` block.

---

## Deploy the demo

The demo build is a plain static site — `npm run build` writes `./out`, which any static host serves as-is.

**Cloudflare Pages** (recommended; the free tier covers this entirely):

1. Push this repository to GitHub.
2. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**, and pick the repo.
3. Build settings:
   - Framework preset: **None**
   - Build command: `npm run build`
   - Build output directory: `out`
   - Node version: set the environment variable `NODE_VERSION` to `20`
4. Deploy. `public/_headers` is picked up automatically and applies the CSP and cache rules.

No environment variables are needed — the demo flag defaults to on. GitHub Pages, Netlify, Vercel and Render all work the same way from `./out`.

---

## Tests

```bash
npm test        # vitest, single run
npm run test:watch
npm run typecheck
npm run lint
```

Coverage includes the manifest parsers (both ecosystems, malformed input, npm aliases, unsafe names), the risk formulas, the blast-radius BFS, the concurrency limiter, the OSV and NVD clients, storage, auth, and the integrity of the seeded demo dataset — that every dependency edge resolves, that counters match their package lists, that a package is only scored above zero when it has a CVE, and that a package with an incomplete lookup is never reported as clean.

---

## Project structure

```
src/
├── algorithms/
│   ├── blast-radius.ts      Reverse BFS over the dependency graph
│   └── graph.ts             Assembles nodes, edges and per-package scores
├── app/
│   ├── _api/                Server routes — rename to `api/` for the live build
│   ├── demo/                Public single-scan view, no sign-in
│   ├── history/  login/  signup/  scan/[id]/
│   └── globals.css          Whole design system, no framework
├── components/              Client components (D3 graph, tables, auth, nav)
├── lib/
│   ├── api-client.ts        The one seam between UI and data source
│   ├── parser.ts            package.json + requirements.txt parsers
│   ├── risk.ts              Scoring formulas
│   └── demo/                Offline demo layer (catalog, dataset, store)
└── services/                Postgres, OSV, NVD, auth, storage
db/migrations/               Schema, applied in filename order
```

---

## Security notes

- Passwords are hashed with PBKDF2-SHA512 and a per-password random salt, and verified with a timing-safe compare. Session tokens are 32 random bytes, stored only as a SHA-256 hash.
- Every scan row is scoped to its owner — `getScan`, `deleteScan` and `listScans` all filter by `user_id`.
- Manifests are capped at 1 MB, package names are validated against an allowlist pattern, and path traversal in names is rejected.
- CSV export escapes leading `=`, `+`, `-` and `@` to defuse spreadsheet formula injection.
- The demo build declares `connect-src 'self'` and makes no outbound requests at all.

Found something? Open an issue rather than a public PR with a proof of concept.

## License

MIT — see [LICENSE](LICENSE).
