import { riskClass, riskLabel } from "@/lib/risk";

interface RiskBadgeProps {
  score: number;
  compact?: boolean;
}

export function RiskBadge({ score, compact = false }: RiskBadgeProps) {
  const label = riskLabel(score);
  return (
    <span className={`badge ${riskClass(score)}`}>
      {compact ? `${score.toFixed(1)}` : `${label} ${score.toFixed(1)}`}
    </span>
  );
}
