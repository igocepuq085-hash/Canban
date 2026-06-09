import { RiskLevel } from "@prisma/client";
import { riskLabels } from "@/lib/labels";

export function RiskBadge({ level }: { level: RiskLevel }) {
  return <span className={`badge ${level}`}>{riskLabels[level]}</span>;
}
