import type { RiskLabel, Severity } from "@/lib/types";

export function riskLabel(score: number): RiskLabel {
  if (score <= 0) {
    return "Clean";
  }
  if (score < 4) {
    return "Low";
  }
  if (score < 7) {
    return "Medium";
  }
  if (score < 9) {
    return "High";
  }
  return "Critical";
}

export function severityFromScore(score: number): Severity {
  if (score <= 0) {
    return "NONE";
  }
  if (score < 4) {
    return "LOW";
  }
  if (score < 7) {
    return "MEDIUM";
  }
  if (score < 9) {
    return "HIGH";
  }
  return "CRITICAL";
}

export function riskClass(score: number): "clean" | "low" | "medium" | "high" | "critical" {
  const label = riskLabel(score);
  return label.toLowerCase() as "clean" | "low" | "medium" | "high" | "critical";
}

export function packageRiskScore(maxCvssScore: number, blastRadiusSize: number): number {
  if (maxCvssScore <= 0) {
    return 0;
  }
  const weighted = maxCvssScore * (1 + 0.1 * Math.log(blastRadiusSize + 1));
  return roundScore(Math.min(10, weighted));
}

export function scanRiskScore(packages: Array<{ riskScore: number; blastRadiusSize: number }>): number {
  const vulnerablePackages = packages.filter((pkg) => pkg.riskScore > 0);
  if (vulnerablePackages.length === 0) {
    return 0;
  }

  const numerator = vulnerablePackages.reduce(
    (total, pkg) => total + pkg.riskScore * Math.max(1, pkg.blastRadiusSize),
    0
  );
  const denominator = vulnerablePackages.reduce(
    (total, pkg) => total + Math.max(1, pkg.blastRadiusSize),
    0
  );

  return roundScore(denominator === 0 ? 0 : numerator / denominator);
}

export function roundScore(score: number): number {
  return Math.round(score * 100) / 100;
}
