import { RiskLevel, StageStatus } from "@prisma/client";

export type RiskInput = {
  dueDate?: Date | null;
  assigneeId?: string | null;
  plannedProgress: number;
  actualProgress: number;
  updatedAt: Date;
  stages: Array<{ status: StageStatus; isBlocking: boolean; name: string }>;
};

export type RiskResult = {
  level: RiskLevel;
  score: number;
  stuckFlag: boolean;
  issues: string[];
  delayPercent: number;
};

const DAY = 86_400_000;

export function analyzeRisk(input: RiskInput, now = new Date()): RiskResult {
  const issues: string[] = [];
  let score = 0;
  const delayPercent = Math.max(0, input.plannedProgress - input.actualProgress);
  const overdue = Boolean(input.dueDate && input.dueDate < now && input.actualProgress < 100);
  const staleDays = Math.floor((now.getTime() - input.updatedAt.getTime()) / DAY);
  const blockedStage = input.stages.find((stage) => stage.status === StageStatus.BLOCKED || stage.isBlocking);
  const dueSoon =
    input.dueDate &&
    input.dueDate >= now &&
    input.dueDate.getTime() - now.getTime() <= 2 * DAY &&
    input.actualProgress < 70;

  if (overdue) {
    score += 60;
    issues.push("Срок задачи уже прошёл");
  }
  if (!input.assigneeId) {
    score += 15;
    issues.push("Не назначен ответственный");
  }
  if (delayPercent > 40) {
    score += 45;
    issues.push(`Отставание от плана ${delayPercent}%`);
  } else if (delayPercent > 25) {
    score += 30;
    issues.push(`Отставание от плана ${delayPercent}%`);
  } else if (delayPercent > 10) {
    score += 15;
    issues.push(`Факт ниже плана на ${delayPercent}%`);
  }
  if (staleDays > 5) {
    score += 20;
    issues.push(`Нет обновлений ${staleDays} дней`);
  }
  if (blockedStage) {
    score += 35;
    issues.push(`Заблокирован этап «${blockedStage.name}»`);
  }
  if (dueSoon) {
    score += 25;
    issues.push("Срок через два дня или раньше при низком прогрессе");
  }

  const level =
    overdue || delayPercent > 40 || score >= 75
      ? RiskLevel.CRITICAL
      : delayPercent > 25 || Boolean(blockedStage) || Boolean(dueSoon) || score >= 45
        ? RiskLevel.RISK
        : score >= 20
          ? RiskLevel.ATTENTION
          : RiskLevel.NORMAL;

  return { level, score: Math.min(score, 100), stuckFlag: staleDays > 5 || Boolean(blockedStage), issues, delayPercent };
}
