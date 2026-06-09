import { RiskLevel } from "@prisma/client";
import type { RiskResult } from "./risk.ts";

export type Insight = {
  riskLevel: RiskLevel;
  summary: string;
  issues: string[];
  recommendations: string[];
  delayPercent: number;
};

export function buildInsight(risk: RiskResult): Insight {
  const recommendations: string[] = [];

  if (risk.issues.some((issue) => issue.includes("ответственный"))) {
    recommendations.push("Назначить ответственного и подтвердить ближайший результат");
  }
  if (risk.issues.some((issue) => issue.includes("обновлений"))) {
    recommendations.push("Запросить короткий статус и зафиксировать причину задержки");
  }
  if (risk.issues.some((issue) => issue.includes("этап"))) {
    recommendations.push("Снять блокировку этапа или назначить владельца решения");
  }
  if (risk.delayPercent > 10) {
    recommendations.push("Пересмотреть оставшийся объём и обновить прогноз завершения");
  }
  if (!recommendations.length && risk.level === RiskLevel.NORMAL) {
    recommendations.push("Продолжать по плану и обновлять прогресс регулярно");
  }

  const summary =
    risk.level === RiskLevel.NORMAL
      ? "Задача движется без заметных отклонений."
      : `Задаче требуется внимание: найдено факторов риска — ${risk.issues.length}.`;

  return {
    riskLevel: risk.level,
    summary,
    issues: risk.issues,
    recommendations,
    delayPercent: risk.delayPercent
  };
}
