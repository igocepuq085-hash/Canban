import Link from "next/link";
import type { Card, User } from "@prisma/client";
import { formatDate } from "@/lib/format";
import { priorityLabels, riskLabels } from "@/lib/labels";

type TaskNodeProps = {
  card: Card & { assignee: User | null };
  workspaceId: string;
  columnName: string;
  compact?: boolean;
  destination?: "card" | "board";
};

export function TaskNode({ card, workspaceId, columnName, compact = false, destination = "card" }: TaskNodeProps) {
  const href =
    destination === "board"
      ? `/app/workspaces/${workspaceId}/boards/${card.boardId}#card-${card.id}`
      : `/app/workspaces/${workspaceId}/cards/${card.id}`;
  return (
    <Link
      href={href}
      className={`task-node risk-card-${card.riskLevel.toLowerCase()} ${compact ? "compact" : ""}`}
      data-card-node={card.id}
    >
      <div className="node-topline">
        <span className="task-stage">{columnName}</span>
        <span className={`task-risk risk-${card.riskLevel.toLowerCase()}`}>{riskLabels[card.riskLevel]}</span>
      </div>
      <strong className="node-title">{card.title}</strong>
      {!compact && <p className="task-description">{card.description || "Описание не добавлено"}</p>}
      <div className="node-meta">
        <span>{card.assignee?.name || "Исполнитель не назначен"}</span>
        <span>{formatDate(card.dueDate)}</span>
      </div>
      <div className="task-progress">
        <div className="task-progress-label">
          <span>Прогресс</span>
          <strong>{card.manualProgress}%</strong>
        </div>
        <div className="progress" aria-label={`Прогресс ${card.manualProgress}%`}>
          <span style={{ width: `${card.manualProgress}%` }} />
        </div>
      </div>
      <span className="task-priority">{priorityLabels[card.priority]}</span>
    </Link>
  );
}
