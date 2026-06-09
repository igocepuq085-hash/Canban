import Link from "next/link";
import { WorkspaceRole } from "@prisma/client";
import { addCommentAction, assignCardAction, moveCardAction, returnCardAction, updateProgressAction } from "@/app/actions";
import { RiskBadge } from "@/components/risk-badge";
import { requireCardAccess, requireWorkspaceMember } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/format";
import { activityLabels, priorityLabels } from "@/lib/labels";
import { stagePlannedProgress } from "@/lib/progress";
import { prisma } from "@/lib/prisma";

export default async function CardPage({ params }: { params: Promise<{ workspaceId: string; cardId: string }> }) {
  const { workspaceId, cardId } = await params;
  const user = await requireUser();
  await requireCardAccess(cardId, user.id);
  const membership = await requireWorkspaceMember(workspaceId, user.id);
  const card = await prisma.card.findUniqueOrThrow({
    where: { id: cardId },
    include: {
      board: true,
      column: true,
      assignee: true,
      stages: { orderBy: { position: "asc" } },
      comments: { include: { user: true }, orderBy: { createdAt: "desc" }, take: 8 },
      activities: { include: { user: true }, orderBy: { createdAt: "desc" }, take: 12 }
    }
  });
  if (card.board.workspaceId !== workspaceId) throw new Error("Задача не принадлежит пространству");

  const transitions = await prisma.boardStageTransition.findMany({
    where: { sourceColumnId: card.columnId },
    include: { targetColumn: { include: { _count: { select: { cards: true } } } } }
  });
  const previousTransition = await prisma.boardStageTransition.findFirst({
    where: { targetColumnId: card.columnId, sourceColumn: { boardId: card.boardId } },
    include: { sourceColumn: { include: { _count: { select: { cards: true } } } } }
  });
  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId },
    include: { user: true },
    orderBy: { createdAt: "asc" }
  });
  const nextColumns = transitions
    .map((transition) => transition.targetColumn)
    .filter((column) => !column.wipLimit || column._count.cards < column.wipLimit);
  const planned = card.stages.length ? stagePlannedProgress(card.stages) : 0;
  const canWork =
    membership.role === WorkspaceRole.OWNER ||
    membership.role === WorkspaceRole.ADMIN ||
    membership.role === WorkspaceRole.MEMBER ||
    card.assigneeId === user.id;
  const canMove = card.assigneeId === user.id && nextColumns.length > 0;
  const canManage =
    membership.role === WorkspaceRole.OWNER ||
    membership.role === WorkspaceRole.ADMIN ||
    membership.role === WorkspaceRole.MEMBER;
  const canReturn =
    canManage &&
    /провер|соглас|выполн|review|done/i.test(card.column.name) &&
    Boolean(previousTransition) &&
    (!previousTransition?.sourceColumn.wipLimit ||
      previousTransition.sourceColumn._count.cards < previousTransition.sourceColumn.wipLimit);

  return (
    <main className="shell card-shell">
      <section className="card-topbar">
        <Link className="text-link" href={`/app/workspaces/${workspaceId}/boards/${card.boardId}`}>← Вернуться на доску</Link>
        <span className="card-stage-pill">{card.column.name}</span>
      </section>

      <section className="card-simple-hero panel">
        <div>
          <p className="eyebrow">{card.board.name}</p>
          <h1>{card.title}</h1>
          <p className="muted">{card.description || "Описание задачи не добавлено"}</p>
        </div>
        <div className="card-hero-progress">
          <strong>{card.manualProgress}%</strong>
          <span>выполнено</span>
          <div className="progress"><span style={{ width: `${card.manualProgress}%` }} /></div>
        </div>
      </section>

      <section className="card-workflow">
        <div className="panel work-step">
          <span className="work-step-number">1</span>
          <div>
            <p className="eyebrow">Сейчас</p>
            <h2>{card.column.name}</h2>
            <p className="muted">Исполнитель: <strong>{card.assignee?.name || "не назначен"}</strong></p>
          </div>
          {canManage && (
            <form action={assignCardAction} className="assign-form">
              <input type="hidden" name="cardId" value={card.id} />
              <select name="assigneeId" defaultValue={card.assigneeId || ""}>
                <option value="">Не назначен</option>
                {members.map((member) => <option value={member.userId} key={member.userId}>{member.user.name}</option>)}
              </select>
              <button type="submit">Назначить</button>
            </form>
          )}
        </div>

        {canWork && (
          <form action={updateProgressAction} className="panel work-step work-form">
            <span className="work-step-number">2</span>
            <div className="work-form-body">
              <div><p className="eyebrow">Обновите выполнение</p><h2>Прогресс задачи</h2></div>
              <input type="hidden" name="cardId" value={card.id} />
              <input type="hidden" name="plannedProgress" value={planned} />
              <label className="field">Выполнено, %<input name="progress" type="number" min="0" max="100" defaultValue={card.manualProgress} /></label>
              <label className="field">Короткий комментарий<textarea name="comment" placeholder="Что изменилось?" /></label>
              <button className="button" type="submit">Сохранить прогресс</button>
            </div>
          </form>
        )}

        <section className={`panel work-step move-card-panel ${canMove ? "ready" : ""}`}>
          <span className="work-step-number">3</span>
          <div className="work-form-body">
            <div>
              <p className="eyebrow">Следующий шаг</p>
              <h2>{canMove ? "Передать задачу дальше" : card.assigneeId ? "Следующий этап пока недоступен" : "Сначала назначьте исполнителя"}</h2>
              <p className="muted">
                {canMove
                  ? "Напишите, что выполнено, и отправьте задачу на следующий этап."
                  : card.assigneeId === user.id
                    ? "Следующий этап заполнен или задача уже на последнем этапе."
                    : `Передать задачу может назначенный исполнитель: ${card.assignee?.name || "не назначен"}.`}
              </p>
            </div>
            {canMove && (
              <form action={moveCardAction} className="card-transition-form">
                <input type="hidden" name="cardId" value={card.id} />
                <label className="field">Следующий этап
                  <select name="columnId">
                    {nextColumns.map((column) => <option value={column.id} key={column.id}>{column.name}</option>)}
                  </select>
                </label>
                <label className="field">Комментарий исполнителя
                  <textarea name="comment" required minLength={3} placeholder="Что выполнено перед передачей?" />
                </label>
                <button className="button transition-button" type="submit">Прокомментировать и передать →</button>
              </form>
            )}
          </div>
        </section>
        {canReturn && (
          <section className="panel work-step return-card-panel">
            <span className="work-step-number">↩</span>
            <form action={returnCardAction} className="work-form-body">
              <input type="hidden" name="cardId" value={card.id} />
              <div><p className="eyebrow">Проверка не пройдена</p><h2>Вернуть на доработку</h2></div>
              <label className="field">Причина возврата<textarea name="comment" required minLength={3} placeholder="Что нужно исправить?" /></label>
              <button className="button ghost" type="submit">← Вернуть на предыдущий этап</button>
            </form>
          </section>
        )}
      </section>

      <section className="card-quick-info">
        <div className="stat"><span className="muted">План сегодня</span><strong>{planned}%</strong></div>
        <div className="stat"><span className="muted">Срок</span><strong>{formatDate(card.dueDate)}</strong></div>
        <div className="stat"><span className="muted">Приоритет</span><strong>{priorityLabels[card.priority]}</strong></div>
        <div className="stat"><span className="muted">Риск</span><strong><RiskBadge level={card.riskLevel} /></strong></div>
      </section>

      <section className="grid grid-2 card-support">
        <details className="panel" open>
          <summary>Комментарии</summary>
          {canWork && (
            <form action={addCommentAction} className="comment-inline">
              <input type="hidden" name="cardId" value={card.id} />
              <textarea name="body" required placeholder="Добавить комментарий" />
              <button className="button" type="submit">Отправить</button>
            </form>
          )}
          <div className="comment-list">
            {card.comments.map((comment) => (
              <div className="comment-item" key={comment.id}>
                <strong>{comment.user.name}</strong>
                <span>{formatDateTime(comment.createdAt)}</span>
                <p>{comment.body}</p>
              </div>
            ))}
            {!card.comments.length && <p className="muted">Комментариев пока нет.</p>}
          </div>
        </details>

        <details className="panel">
          <summary>Дополнительная информация</summary>
          <div className="detail-list">
            <span>План: <strong>{formatDate(card.plannedStartDate)} — {formatDate(card.plannedEndDate)}</strong></span>
            <span>Фактическое начало: <strong>{formatDate(card.actualStartDate)}</strong></span>
            <span>Прогноз: <strong>{formatDate(card.forecastEndDate)}</strong></span>
          </div>
          <h3>Последние изменения</h3>
          <div className="comment-list">
            {card.activities.map((activity) => (
              <div className="comment-item" key={activity.id}>
                <strong>{activityLabels[activity.action] || "Задача изменена"}</strong>
                <span>{activity.user.name} · {formatDateTime(activity.createdAt)}</span>
              </div>
            ))}
          </div>
        </details>
      </section>
    </main>
  );
}
