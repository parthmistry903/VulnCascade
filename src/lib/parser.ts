import type { Ecosystem, EcosystemInput, PackageInfo, ParseResult, ParseWarning } from "@/lib/types";

const MAX_MANIFEST_BYTES = 1024 * 1024;
const PACKAGE_NAME_PATTERN = /^[a-zA-Z0-9@._/\-]+$/;

interface PackageJsonShape {
  name?: unknown;
  dependencies?: Record<string, unknown>;
  devDependencies?: Record<string, unknown>;
}

export class ManifestParseError extends Error {
  readonly warnings: ParseWarning[];
  readonly statusCode: number;

  constructor(message: string, warnings: ParseWarning[] = [], statusCode = 400) {
    super(message);
    this.name = "ManifestParseError";
    this.warnings = warnings;
    this.statusCode = statusCode;
  }
}

export function assertManifestSize(manifest: string): void {
  
  if (new TextEncoder().encode(manifest).length > MAX_MANIFEST_BYTES) {
    throw new ManifestParseError("Manifest files must be 1 MB or smaller.", [], 413);
  }
}

export async function parseManifest(
  manifest: string,
  ecosystemInput: EcosystemInput = "auto",
  includeDev = true
): Promise<ParseResult> {
  assertManifestSize(manifest);
  const trimmed = manifest.trim();
  if (!trimmed) {
    throw new ManifestParseError("Paste or upload a dependency manifest before scanning.");
  }

  
  await new Promise((resolve) => setTimeout(resolve, 0));

  const ecosystem = ecosystemInput === "auto" ? detectEcosystem(trimmed) : ecosystemInput;
  return ecosystem === "npm"
    ? parsePackageJson(trimmed, includeDev)
    : parseRequirementsTxt(trimmed);
}

export function detectEcosystem(manifest: string): Ecosystem {
  try {
    const parsed = JSON.parse(manifest) as PackageJsonShape;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      (isRecord(parsed.dependencies) || isRecord(parsed.devDependencies))
    ) {
      return "npm";
    }
  } catch {
    return "pip";
  }

  return "pip";
}

function parsePackageJson(manifest: string, includeDev: boolean): ParseResult {
  let parsed: PackageJsonShape;
  try {
    parsed = JSON.parse(manifest) as PackageJsonShape;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown JSON parse error.";
    throw new ManifestParseError(`package.json is malformed: ${message}`);
  }

  const warnings: ParseWarning[] = [];
  const packages: PackageInfo[] = [];
  const projectNameRaw = typeof parsed.name === "string" && parsed.name.trim() ? parsed.name.trim() : "project";
  const projectName = projectNameRaw.slice(0, 255);

  collectNpmDependencies(parsed.dependencies, false, packages, warnings);
  if (includeDev) {
    collectNpmDependencies(parsed.devDependencies, true, packages, warnings);
  }

  if (packages.length === 0) {
    throw new ManifestParseError("No dependencies were found in package.json.", warnings);
  }

  return { ecosystem: "npm", packages: dedupePackages(packages), warnings, projectName };
}

function collectNpmDependencies(
  dependencies: Record<string, unknown> | undefined,
  isDevDependency: boolean,
  packages: PackageInfo[],
  warnings: ParseWarning[]
): void {
  if (!isRecord(dependencies)) {
    return;
  }

  for (const [name, rawVersion] of Object.entries(dependencies)) {
    if (!isSafePackageName(name)) {
      warnings.push({ message: `Skipped unsafe npm package name "${name}".` });
      continue;
    }
    if (typeof rawVersion !== "string") {
      warnings.push({ message: `Skipped npm package "${name}" because its version specifier is not a string.` });
      continue;
    }

    const requestedVersion = rawVersion;
    const normalized = normalizeNpmDependency(name, requestedVersion, warnings);
    if (!normalized) {
      continue;
    }

    packages.push({
      name: normalized.name,
      version: normalized.version,
      requestedVersion,
      ecosystem: "npm",
      isDevDependency
    });
  }
}

function normalizeNpmDependency(
  name: string,
  requestedVersion: string,
  warnings: ParseWarning[]
): { name: string; version: string | null } | null {
  const trimmed = requestedVersion.trim();

  if (trimmed.startsWith("npm:")) {
    const aliasTarget = trimmed.slice("npm:".length);
    const versionSeparator = aliasTarget.lastIndexOf("@");
    if (versionSeparator <= 0) {
      warnings.push({ message: `Skipped npm alias "${name}" because it does not include a concrete target version.` });
      return null;
    }

    const targetName = aliasTarget.slice(0, versionSeparator);
    const targetVersion = aliasTarget.slice(versionSeparator + 1);
    if (!isSafePackageName(targetName)) {
      warnings.push({ message: `Skipped npm alias "${name}" because target package "${targetName}" is unsafe.` });
      return null;
    }

    return { name: targetName, version: normalizeVersion(targetVersion) };
  }

  if (/^(workspace:|file:|link:|git\+|github:|https?:)/.test(trimmed)) {
    warnings.push({ message: `Package "${name}" uses unsupported npm specifier "${trimmed}"; querying without a concrete version.` });
    return { name, version: null };
  }

  return { name, version: normalizeVersion(trimmed) };
}

function parseRequirementsTxt(manifest: string): ParseResult {
  const warnings: ParseWarning[] = [];
  const packages: PackageInfo[] = [];
  const lines = manifest.split(/\r?\n/);

  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const line = stripInlineComment(rawLine).trim();
    if (!line || line.startsWith("-r ") || line.startsWith("--")) {
      return;
    }

    const parsed = parseRequirementLine(line);
    if (!parsed) {
      warnings.push({ line: lineNumber, message: `Could not parse requirements.txt line ${lineNumber}.` });
      return;
    }

    if (!isSafePackageName(parsed.name)) {
      warnings.push({ line: lineNumber, message: `Skipped unsafe pip package name "${parsed.name}".` });
      return;
    }

    packages.push({
      name: parsed.name,
      version: normalizeVersion(parsed.versionSpec),
      requestedVersion: parsed.versionSpec,
      ecosystem: "pip",
      line: lineNumber
    });
  });

  if (packages.length === 0) {
    throw new ManifestParseError("No dependencies were found in requirements.txt.", warnings);
  }

  if (warnings.length > 0) {
    const seriousWarnings = warnings.filter((warning) => typeof warning.line === "number");
    if (seriousWarnings.length > 0 && seriousWarnings.length === lines.filter((line) => line.trim()).length) {
      throw new ManifestParseError("requirements.txt contains unparseable package lines.", warnings);
    }
  }

  return { ecosystem: "pip", packages: dedupePackages(packages), warnings, projectName: "python-project" };
}

function parseRequirementLine(line: string): { name: string; versionSpec: string | null } | null {
  const match = line.match(/^([A-Za-z0-9_.\-]+)(?:\[[^\]]+\])?\s*(?:(==|>=|<=|~=|>|<)\s*([^;\s]+))?\s*(?:;.*)?$/);
  if (!match) {
    return null;
  }

  const name = match[1];
  const operator = match[2] ?? "";
  const version = match[3] ?? "";
  return {
    name,
    versionSpec: operator || version ? `${operator}${version}` : null
  };
}

function stripInlineComment(line: string): string {
  const hashIndex = line.indexOf("#");
  if (hashIndex === -1) {
    return line;
  }
  return line.slice(0, hashIndex);
}

export function normalizeVersion(versionSpec: string | null): string | null {
  if (!versionSpec) {
    return null;
  }

  const cleaned = versionSpec
    .trim()
    .replace(/^[~^=<>! ]+/, "")
    .replace(/^\*/, "")
    .split(/[,\s|]/)[0]
    .trim();

  return cleaned.length > 0 ? cleaned : null;
}

export function isSafePackageName(packageName: string): boolean {
  return PACKAGE_NAME_PATTERN.test(packageName) && !packageName.includes("..");
}

function dedupePackages(packages: PackageInfo[]): PackageInfo[] {
  const seen = new Map<string, PackageInfo>();
  for (const pkg of packages) {
    const key = `${pkg.ecosystem}:${pkg.name.toLowerCase()}`;
    const existing = seen.get(key);
    if (!existing || (existing.isDevDependency && !pkg.isDevDependency)) {
      seen.set(key, pkg);
    }
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
