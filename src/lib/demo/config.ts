/**
 * Demo-mode switchboard.
 *
 * This repository is published as a *public demo build*: there is no server, no
 * database and no outbound network call. Everything the UI shows comes from the
 * seeded dataset in `src/lib/demo/dataset.ts`.
 *
 * To run the real, fully-functional application, set NEXT_PUBLIC_DEMO_MODE=false
 * and follow the "Run the real thing" section of the README.
 */
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE !== "false";

/** The single account that exists in the demo build. */
export const DEMO_CREDENTIALS = {
  email: "recruiter@vulncascade.dev",
  password: "ScanTheDemo2026"
} as const;

export const DEMO_USER = {
  id: "demo-user-0001",
  email: DEMO_CREDENTIALS.email,
  name: "Demo Reviewer",
  createdAt: "2026-06-12T09:14:00.000Z"
} as const;

/** Repository the demo banner and README links point at. */
export const PROJECT_REPO_URL = "https://github.com/parthmistry903/VulnCascade";

/** localStorage keys used to persist demo session + mutations across reloads. */
export const DEMO_STORAGE = {
  session: "vc_demo_session_v1",
  deletedScans: "vc_demo_deleted_scans_v1",
  simulatedScan: "vc_demo_simulated_scan_v1",
  bannerDismissed: "vc_demo_banner_dismissed_v1"
} as const;

/** Route id reserved for a scan the visitor simulates in the browser. */
export const SIMULATED_SCAN_ID = "simulated";
