import { Priority, RiskLevel, StageStatus, WorkspaceRole } from "@prisma/client";

export const roleLabels: Record<WorkspaceRole, string> = {
  OWNER: "Владелец",
  ADMIN: "Руководитель",
  MEMBER: "Участник",
  EXECUTOR: "Исполнитель",
  VIEWER: "Наблюдатель"
};

export const priorityLabels: Record<Priority, string> = {
  LOW: "Низкий",
  MEDIUM: "Обычный",
  HIGH: "Высокий",
  CRITICAL: "Срочный"
};

export const riskLabels: Record<RiskLevel, string> = {
  NORMAL: "В норме",
  ATTENTION: "Требует внимания",
  RISK: "Под угрозой",
  CRITICAL: "Критично"
};

export const stageStatusLabels: Record<StageStatus, string> = {
  NOT_STARTED: "Не начат",
  IN_PROGRESS: "Выполняется",
  DONE: "Завершён",
  BLOCKED: "Заблокирован"
};

export const activityLabels: Record<string, string> = {
  CARD_MOVED: "Задача перемещена",
  PROGRESS_UPDATED: "Ход выполнения обновлён",
  COMMENT_ADDED: "Добавлен комментарий",
  STAGE_CONNECTED: "Выбран следующий этап",
  CARD_PULLED: "Задача вытянута в следующий этап",
  CARD_RETURNED: "Задача возвращена на доработку",
  ASSIGNEE_UPDATED: "Назначен исполнитель"
};

export function taskGlow(card: {
  assigneeId?: string | null;
  dueDate?: Date | null;
  manualProgress: number;
  columnName?: string;
}) {
  const now = new Date();
  const daysLeft = card.dueDate ? Math.ceil((card.dueDate.getTime() - now.getTime()) / 86_400_000) : null;

  if (!card.assigneeId) return "glow-unassigned";
  if (daysLeft !== null && daysLeft < 0 && card.manualProgress < 100) return "glow-overdue";
  if (daysLeft !== null && daysLeft <= 3 && card.manualProgress < 100) return "glow-soon";
  if (
    card.manualProgress > 0 &&
    card.manualProgress < 100 &&
    (card.columnName?.toLowerCase().includes("работ") || card.manualProgress >= 10)
  ) {
    return "glow-active";
  }
  return "glow-calm";
}
