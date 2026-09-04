import type { CveRecord, Ecosystem, Severity } from "@/lib/types";

/**
 * Offline advisory snapshot.
 *
 * In the real build these records are fetched live from the Google OSV API
 * (`src/services/osv-api.ts`) and enriched from NIST NVD (`src/services/nist-nvd.ts`).
 * The public demo build ships this frozen, hand-curated slice instead so that the
 * site works with zero network calls, zero API keys and sub-second page loads.
 *
 * Every entry below is a real, published advisory. `fixed` is the first release
 * that is NOT affected, which mirrors how OSV expresses its version ranges.
 */
export interface Advisory {
  ecosystem: Ecosystem;
  packageName: string;
  /** First release that is no longer affected. */
  fixed: string;
  cve: CveRecord;
}

function advisory(
  ecosystem: Ecosystem,
  packageName: string,
  fixed: string,
  id: string,
  cvssScore: number,
  severity: Severity,
  description: string,
  cweIds: string[],
  publishedAt: string
): Advisory {
  return {
    ecosystem,
    packageName,
    fixed,
    cve: {
      id,
      description,
      cvssScore,
      severity,
      cweIds,
      references: [
        id.startsWith("GHSA-") ? `https://github.com/advisories/${id}` : `https://nvd.nist.gov/vuln/detail/${id}`,
        `https://osv.dev/vulnerability/${id}`
      ],
      publishedAt,
      lastModified: publishedAt
    }
  };
}

export const ADVISORIES: Advisory[] = [
  // ---------------------------------------------------------------- npm ----
  advisory("npm", "lodash", "4.17.19", "CVE-2020-8203", 7.4, "HIGH",
    "Prototype pollution in zipObjectDeep allows an attacker who controls object keys to modify Object.prototype.",
    ["CWE-1321"], "2020-07-15T00:00:00.000Z"),
  advisory("npm", "lodash", "4.17.21", "CVE-2021-23337", 7.2, "HIGH",
    "Command injection in the template function when the options object is attacker-controlled.",
    ["CWE-78"], "2021-02-15T00:00:00.000Z"),
  advisory("npm", "minimist", "1.2.6", "CVE-2021-44906", 9.8, "CRITICAL",
    "Prototype pollution: crafted --__proto__ arguments let an attacker set properties on Object.prototype.",
    ["CWE-1321"], "2022-03-17T00:00:00.000Z"),
  advisory("npm", "qs", "6.10.3", "CVE-2022-24999", 7.5, "HIGH",
    "Prototype pollution in query string parsing lets a crafted request add __proto__ keys and stall the event loop.",
    ["CWE-1321", "CWE-400"], "2022-11-26T00:00:00.000Z"),
  advisory("npm", "semver", "7.5.2", "CVE-2022-25883", 7.5, "HIGH",
    "Regular expression denial of service when parsing an attacker-supplied version range.",
    ["CWE-1333"], "2023-06-21T00:00:00.000Z"),
  advisory("npm", "json5", "2.2.2", "CVE-2022-46175", 8.8, "HIGH",
    "JSON5.parse assigns __proto__ from parsed input, polluting the prototype of every object in the process.",
    ["CWE-1321"], "2022-12-24T00:00:00.000Z"),
  advisory("npm", "braces", "3.0.3", "CVE-2024-4068", 7.5, "HIGH",
    "Uncontrolled resource consumption: a crafted brace pattern exhausts memory before any length limit applies.",
    ["CWE-400"], "2024-05-14T00:00:00.000Z"),
  advisory("npm", "micromatch", "4.0.8", "CVE-2024-4067", 5.3, "MEDIUM",
    "Regular expression denial of service in the braces pattern used by micromatch.",
    ["CWE-1333"], "2024-05-14T00:00:00.000Z"),
  advisory("npm", "follow-redirects", "1.14.8", "CVE-2022-0536", 5.3, "MEDIUM",
    "The Authorization header is preserved across a cross-host redirect, leaking credentials to the redirect target.",
    ["CWE-200"], "2022-02-09T00:00:00.000Z"),
  advisory("npm", "jsonwebtoken", "9.0.0", "CVE-2022-23529", 8.1, "HIGH",
    "jwt.verify() can be coerced into an insecure verification path when secretOrPublicKey is attacker-influenced.",
    ["CWE-327"], "2022-12-22T00:00:00.000Z"),
  advisory("npm", "glob-parent", "5.1.2", "CVE-2020-28469", 7.5, "HIGH",
    "Regular expression denial of service via the enclosure regex used to strip glob magic.",
    ["CWE-1333"], "2021-06-03T00:00:00.000Z"),
  advisory("npm", "path-to-regexp", "0.1.10", "CVE-2024-45296", 7.5, "HIGH",
    "Backtracking regular expression: routes with two adjacent parameters can be stalled by a crafted path.",
    ["CWE-1333"], "2024-09-09T00:00:00.000Z"),
  advisory("npm", "body-parser", "1.20.3", "CVE-2024-45590", 7.5, "HIGH",
    "Denial of service when urlencoded extended parsing receives a large number of nested parameters.",
    ["CWE-405"], "2024-09-10T00:00:00.000Z"),
  advisory("npm", "express", "4.19.2", "CVE-2024-29041", 6.1, "MEDIUM",
    "Open redirect: res.location() and res.redirect() accept malformed URLs that browsers resolve to an external origin.",
    ["CWE-601"], "2024-03-25T00:00:00.000Z"),
  advisory("npm", "minimatch", "3.0.5", "CVE-2022-3517", 7.5, "HIGH",
    "Regular expression denial of service in the brace expansion path.",
    ["CWE-1333"], "2022-10-17T00:00:00.000Z"),
  advisory("npm", "axios", "0.21.2", "CVE-2021-3749", 7.5, "HIGH",
    "Regular expression denial of service in the trim helper applied to response headers.",
    ["CWE-1333"], "2021-08-31T00:00:00.000Z"),
  advisory("npm", "axios", "1.6.0", "CVE-2023-45857", 6.5, "MEDIUM",
    "The XSRF-TOKEN cookie is attached to cross-origin requests, leaking the CSRF token to third-party hosts.",
    ["CWE-200"], "2023-11-08T00:00:00.000Z"),
  advisory("npm", "ws", "8.17.1", "CVE-2024-37890", 7.5, "HIGH",
    "Denial of service: a request with many headers crashes the WebSocket server process.",
    ["CWE-400"], "2024-06-17T00:00:00.000Z"),
  advisory("npm", "tough-cookie", "4.1.3", "CVE-2023-26136", 6.5, "MEDIUM",
    "Prototype pollution in CookieJar when operating in rejectPublicSuffixes=false mode.",
    ["CWE-1321"], "2023-07-01T00:00:00.000Z"),
  advisory("npm", "node-fetch", "2.6.7", "CVE-2022-0235", 6.1, "MEDIUM",
    "Cookie and Authorization headers are forwarded to a different host after a redirect.",
    ["CWE-200"], "2022-01-16T00:00:00.000Z"),
  advisory("npm", "ejs", "3.1.7", "CVE-2022-29078", 9.8, "CRITICAL",
    "Server-side template injection through the outputFunctionName option leads to remote code execution.",
    ["CWE-94"], "2022-04-25T00:00:00.000Z"),
  advisory("npm", "postcss", "8.4.31", "CVE-2023-44270", 5.3, "MEDIUM",
    "Improper handling of carriage returns in external CSS lets an attacker smuggle rules past a linter.",
    ["CWE-74"], "2023-09-29T00:00:00.000Z"),
  advisory("npm", "word-wrap", "1.2.4", "CVE-2023-26115", 5.3, "MEDIUM",
    "Regular expression denial of service when wrapping long attacker-supplied strings.",
    ["CWE-1333"], "2023-06-22T00:00:00.000Z"),
  advisory("npm", "tar", "6.2.1", "CVE-2024-28863", 6.5, "MEDIUM",
    "Denial of service while unpacking an archive containing a deeply nested directory structure.",
    ["CWE-400"], "2024-03-21T00:00:00.000Z"),
  advisory("npm", "cross-spawn", "7.0.5", "CVE-2024-21538", 7.5, "HIGH",
    "Regular expression denial of service when the command argument is attacker-controlled.",
    ["CWE-1333"], "2024-11-08T00:00:00.000Z"),
  advisory("npm", "cookie", "0.7.0", "CVE-2024-47764", 5.3, "MEDIUM",
    "cookie.serialize accepts out-of-bounds characters in names and values, enabling cookie injection.",
    ["CWE-74"], "2024-10-04T00:00:00.000Z"),
  advisory("npm", "serialize-javascript", "6.0.2", "CVE-2024-11831", 5.4, "MEDIUM",
    "Cross-site scripting: regular expression output is not escaped before being embedded in a page.",
    ["CWE-79"], "2025-02-10T00:00:00.000Z"),
  advisory("npm", "next", "14.1.1", "CVE-2024-34351", 7.5, "HIGH",
    "Server-side request forgery through Server Actions when the Host header is attacker-controlled.",
    ["CWE-918"], "2024-05-09T00:00:00.000Z"),
  advisory("npm", "undici", "5.28.4", "CVE-2024-30260", 6.5, "MEDIUM",
    "The Proxy-Authorization header is not cleared on a cross-origin redirect.",
    ["CWE-200"], "2024-04-04T00:00:00.000Z"),
  advisory("npm", "webpack", "5.94.0", "CVE-2024-43788", 6.4, "MEDIUM",
    "DOM clobbering in the AutoPublicPathRuntimeModule can lead to cross-site scripting on pages with user-injected HTML.",
    ["CWE-79"], "2024-08-27T00:00:00.000Z"),
  advisory("npm", "vite", "5.4.6", "CVE-2024-45811", 6.5, "MEDIUM",
    "server.fs.deny can be bypassed with a crafted ?import&raw request, exposing files outside the project root.",
    ["CWE-22"], "2024-09-17T00:00:00.000Z"),
  advisory("npm", "ip", "2.0.1", "CVE-2023-42282", 5.3, "MEDIUM",
    "isPublic() misclassifies octal-encoded addresses, allowing an SSRF filter bypass.",
    ["CWE-918"], "2024-02-08T00:00:00.000Z"),
  advisory("npm", "protobufjs", "7.2.5", "CVE-2023-36665", 8.8, "HIGH",
    "Prototype pollution: parsing an attacker-supplied .proto definition can add properties to Object.prototype.",
    ["CWE-1321"], "2023-07-05T00:00:00.000Z"),
  advisory("npm", "d3-color", "3.1.0", "GHSA-36jr-mh4h-2g58", 7.5, "HIGH",
    "Regular expression denial of service when parsing an attacker-supplied colour string.",
    ["CWE-1333"], "2022-09-01T00:00:00.000Z"),

  // ---------------------------------------------------------------- pip ----
  advisory("pip", "urllib3", "1.26.17", "CVE-2023-43804", 8.1, "HIGH",
    "The Cookie header is not stripped on a cross-origin redirect, leaking the session to the redirect target.",
    ["CWE-200"], "2023-10-02T00:00:00.000Z"),
  advisory("pip", "urllib3", "1.26.18", "CVE-2023-45803", 4.2, "MEDIUM",
    "The request body is not removed when a 303 redirect changes the method to GET.",
    ["CWE-200"], "2023-10-17T00:00:00.000Z"),
  advisory("pip", "requests", "2.31.0", "CVE-2023-32681", 6.1, "MEDIUM",
    "Proxy-Authorization is forwarded to the destination server when redirected away from the proxy.",
    ["CWE-200"], "2023-05-26T00:00:00.000Z"),
  advisory("pip", "jinja2", "3.1.3", "CVE-2024-22195", 5.4, "MEDIUM",
    "The xmlattr filter accepts keys containing spaces and quotes, allowing attribute injection and XSS.",
    ["CWE-79"], "2024-01-11T00:00:00.000Z"),
  advisory("pip", "flask", "2.2.5", "CVE-2023-30861", 7.5, "HIGH",
    "A caching proxy can store and replay a response containing another user's session cookie.",
    ["CWE-539"], "2023-05-02T00:00:00.000Z"),
  advisory("pip", "werkzeug", "2.2.3", "CVE-2023-25577", 7.5, "HIGH",
    "Multipart form parsing allocates unbounded memory for requests with many small parts.",
    ["CWE-400"], "2023-02-14T00:00:00.000Z"),
  advisory("pip", "werkzeug", "3.0.3", "CVE-2024-34069", 7.5, "HIGH",
    "The debugger PIN can be bypassed via DNS rebinding, giving remote code execution on an exposed dev server.",
    ["CWE-94"], "2024-05-06T00:00:00.000Z"),
  advisory("pip", "pyyaml", "5.4", "CVE-2020-14343", 9.8, "CRITICAL",
    "yaml.full_load still resolves arbitrary Python tags, allowing code execution from untrusted YAML.",
    ["CWE-20"], "2021-02-09T00:00:00.000Z"),
  advisory("pip", "pillow", "9.0.1", "CVE-2022-22817", 9.8, "CRITICAL",
    "ImageMath.eval evaluates attacker-supplied expressions, leading to arbitrary code execution.",
    ["CWE-94"], "2022-01-10T00:00:00.000Z"),
  advisory("pip", "pillow", "10.3.0", "CVE-2024-28219", 7.3, "HIGH",
    "Buffer overflow in _imagingcms.c when handling an oversized ICC colour profile name.",
    ["CWE-120"], "2024-04-02T00:00:00.000Z"),
  advisory("pip", "certifi", "2023.7.22", "CVE-2023-37920", 9.8, "CRITICAL",
    "The bundle trusts e-Tugra root certificates, which were removed after a reported compromise.",
    ["CWE-345"], "2023-07-25T00:00:00.000Z"),
  advisory("pip", "cryptography", "41.0.2", "CVE-2023-38325", 7.5, "HIGH",
    "SSH certificates with critical options are mis-parsed, so a rejected certificate can appear valid.",
    ["CWE-295"], "2023-07-14T00:00:00.000Z"),
  advisory("pip", "gunicorn", "22.0.0", "CVE-2024-1135", 8.2, "HIGH",
    "Improper Transfer-Encoding validation permits HTTP request smuggling past a front-end proxy.",
    ["CWE-444"], "2024-04-16T00:00:00.000Z"),
  advisory("pip", "setuptools", "65.5.1", "CVE-2022-40897", 5.9, "MEDIUM",
    "Regular expression denial of service in package_index when reading an attacker-controlled index page.",
    ["CWE-1333"], "2022-12-23T00:00:00.000Z"),
  advisory("pip", "numpy", "1.22.0", "CVE-2021-33430", 5.3, "MEDIUM",
    "Buffer overflow in array_from_pyobj when a crafted shape is passed through the f2py interface.",
    ["CWE-120"], "2021-12-17T00:00:00.000Z"),
  advisory("pip", "aiohttp", "3.9.4", "CVE-2024-30251", 7.5, "HIGH",
    "An infinite loop in multipart POST parsing hangs the worker and denies service to every other request.",
    ["CWE-835"], "2024-04-18T00:00:00.000Z"),
  advisory("pip", "python-multipart", "0.0.7", "CVE-2024-24762", 7.5, "HIGH",
    "Regular expression denial of service while parsing a malformed Content-Type boundary.",
    ["CWE-1333"], "2024-02-05T00:00:00.000Z"),
  advisory("pip", "transformers", "4.36.0", "CVE-2023-6730", 9.8, "CRITICAL",
    "Deserialization of untrusted data when loading a model repository containing a crafted pickle payload.",
    ["CWE-502"], "2023-12-12T00:00:00.000Z"),
  advisory("pip", "scikit-learn", "1.5.0", "CVE-2024-5206", 5.5, "MEDIUM",
    "TfidfVectorizer retains the fitted stop_words_ list, leaking tokens from the training corpus.",
    ["CWE-921"], "2024-06-06T00:00:00.000Z"),
  advisory("pip", "mlflow", "2.9.2", "CVE-2023-6831", 8.1, "HIGH",
    "Path traversal in the artifact deletion endpoint allows deleting files outside the artifact root.",
    ["CWE-22"], "2023-12-15T00:00:00.000Z"),
  advisory("pip", "tornado", "6.4.2", "CVE-2024-52804", 7.5, "HIGH",
    "Regular expression denial of service when parsing a crafted multipart/form-data header.",
    ["CWE-1333"], "2024-11-22T00:00:00.000Z"),
  advisory("pip", "lxml", "4.9.1", "CVE-2022-2309", 7.5, "HIGH",
    "NULL pointer dereference in the iterwalk/cleanup path crashes the interpreter on crafted XML.",
    ["CWE-476"], "2022-07-05T00:00:00.000Z"),
  advisory("pip", "paramiko", "2.10.1", "CVE-2022-24302", 5.3, "MEDIUM",
    "A race condition leaves a newly written private key world-readable for a short window.",
    ["CWE-362"], "2022-03-14T00:00:00.000Z")
];

const BY_KEY = new Map<string, Advisory[]>();
for (const entry of ADVISORIES) {
  const key = `${entry.ecosystem}:${entry.packageName.toLowerCase()}`;
  const bucket = BY_KEY.get(key);
  if (bucket) {
    bucket.push(entry);
  } else {
    BY_KEY.set(key, [entry]);
  }
}

/** Number of advisories in the offline snapshot — surfaced in the UI so the demo is honest about its scope. */
export const ADVISORY_COUNT = ADVISORIES.length;

/** Distinct packages covered by the offline snapshot. */
export const ADVISORY_PACKAGE_COUNT = BY_KEY.size;

/** Whether the offline snapshot has any record of a package at all. */
export function isPackageCovered(ecosystem: Ecosystem, packageName: string): boolean {
  return BY_KEY.has(`${ecosystem}:${packageName.toLowerCase()}`);
}

/**
 * Offline equivalent of `lookupPackageCves` from `src/services/osv-api.ts`.
 * A null version means "not pinned", which — exactly like the live OSV query —
 * returns every known advisory for the package.
 */
export function lookupAdvisories(ecosystem: Ecosystem, packageName: string, version: string | null): CveRecord[] {
  const bucket = BY_KEY.get(`${ecosystem}:${packageName.toLowerCase()}`);
  if (!bucket) {
    return [];
  }
  return bucket
    .filter((entry) => version === null || compareVersions(version, entry.fixed) < 0)
    .map((entry) => entry.cve);
}

/** Loose numeric version comparison; good enough for semver and PEP 440 release segments. */
export function compareVersions(left: string, right: string): number {
  const a = versionSegments(left);
  const b = versionSegments(right);
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const diff = (a[index] ?? 0) - (b[index] ?? 0);
    if (diff !== 0) {
      return diff < 0 ? -1 : 1;
    }
  }
  return 0;
}

function versionSegments(version: string): number[] {
  return version
    .split(/[-+]/)[0]
    .split(".")
    .map((segment) => {
      const parsed = Number.parseInt(segment, 10);
      return Number.isFinite(parsed) ? parsed : 0;
    });
}
