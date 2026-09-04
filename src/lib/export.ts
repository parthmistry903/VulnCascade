import type { PackageScanResult } from "@/lib/types";

export function packagesToCsv(packages: PackageScanResult[]): string {
  const header = ["package_name", "version", "cve_id", "cvss_score", "severity", "blast_radius_size"];
  const rows = packages.flatMap((pkg) => {
    if (pkg.cves.length === 0) {
      return [[pkg.name, pkg.version ?? "", "", "0", "NONE", String(pkg.blastRadiusSize)]];
    }
    return pkg.cves.map((cve) => [
      pkg.name,
      pkg.version ?? "",
      cve.id,
      String(cve.cvssScore),
      cve.severity,
      String(pkg.blastRadiusSize)
    ]);
  });

  return [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
}

function csvEscape(value: string): string {
  let safeValue = value;
  if (/^[=+\-@]/.test(safeValue)) {
    safeValue = `'${safeValue}`;
  }
  if (/["\n,]/.test(safeValue)) {
    return `"${safeValue.replaceAll("\"", "\"\"")}"`;
  }
  return safeValue;
}
