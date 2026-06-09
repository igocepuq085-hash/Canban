import Link from "next/link";
import { Priority, RiskLevel, WorkspaceRole } from "@prisma/client";
import { createCardAction, importTasksAction, moveCardAction, returnCardAction } from "@/app/actions";
import { TaskNode } from "@/components/task-node";
import { priorityLabels, riskLabels } from "@/lib/labels";
import { requireWorkspaceMember } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function BoardPage({
  params,
  searchParams
}: {
  params: Promise<{ workspaceId: string; boardId: string }>;
  searchParams: Promise<{
    priority?: string;
    risk?: string;
    assignee?: string;
    imported?: string;
    skipped?: string;
  }>;
}) {
  const { workspaceId, boardId } = await params;
  const filters = await searchParams;
  const user = await requireUser();
  const membership = await requireWorkspaceMember(workspaceId, user.id);
  const board = await prisma.board.findFirstOrThrow({
    where: { id: boardId, workspaceId },
    include: {
      columns: {
        orderBy: { position: "asc" },
        include: {
          cards: {
            where: {
              priority: filters.priority ? (filters.priority as Priority) : undefined,
              riskLevel: filters.risk ? (filters.risk as RiskLevel) : undefined,
              assigneeId: membership.role === WorkspaceRole.EXECUTOR ? user.id : filters.assignee || undefined
            },
            include: { assignee: true },
            orderBy: { updatedAt: "desc" }
          }
        }
      },
      workspace: { include: { members: { include: { user: true } } } }
    }
  });
  const stageTransitions = await prisma.boardStageTransition.findMany({
    where: { sourceColumn: { boardId } },
    include: {
      sourceColumn: { include: { _count: { select: { cards: true } } } },
      targetColumn: { include: { _count: { select: { cards: true } } } }
    },
    orderBy: { createdAt: "asc" }
  });
  const nextColumns = (sourceColumnId: string) =>
    stageTransitions
      .filter((transition) => transition.sourceColumnId === sourceColumnId)
      .map((transition) => transition.targetColumn)
      .filter((column) => !column.wipLimit || column._count.cards < column.wipLimit);
  const previousColumn = (targetColumnId: string) =>
    stageTransitions
      .filter((transition) => transition.targetColumnId === targetColumnId)
      .map((transition) => transition.sourceColumn)
      .find((column) => !column.wipLimit || column._count.cards < column.wipLimit);
  const isReviewStage = (name: string) => /провер|соглас|выполн|review|done/i.test(name);
  const canManage = membership.role === WorkspaceRole.OWNER || membership.role === WorkspaceRole.ADMIN || membership.role === WorkspaceRole.MEMBER;
  const canReview = canManage;
  const basePath = `/app/workspaces/${workspaceId}/boards/${boardId}`;
  const totalCards = board.columns.reduce((sum, column) => sum + column.cards.length, 0);

  return (
    <main className="shell shell-wide">
      <section className="hero">
        <div>
          <p className="eyebrow">{board.workspace.name} · рабочий конвейер</p>
          <h1>{board.name}</h1>
          <p className="muted">{board.description}</p>
        </div>
        <Link className="button ghost" href={membership.role === WorkspaceRole.EXECUTOR ? "/app" : `/app/workspaces/${workspaceId}`}>Назад</Link>
      </section>

      <section className="board-toolbar compact-toolbar">
        <div className="flow-summary">
          <strong>Рабочий процесс</strong>
          <span>{board.columns.length} этапов</span>
          <span>{totalCards} задач</span>
        </div>
        <span className="board-help">Карточка открывается целиком. Передача доступна исполнителю после обязательного комментария.</span>
      </section>

      <details className="panel filter-panel compact-drawer">
        <summary>Фильтры задач</summary>
        <form className="inline">
          <select name="priority" defaultValue={filters.priority || ""}>
            <option value="">Любая важность</option>
            {Object.values(Priority).map((value) => <option key={value} value={value}>{priorityLabels[value]}</option>)}
          </select>
          <select name="risk" defaultValue={filters.risk || ""}>
            <option value="">Любое состояние</option>
            {Object.values(RiskLevel).map((value) => <option key={value} value={value}>{riskLabels[value]}</option>)}
          </select>
          <select name="assignee" defaultValue={filters.assignee || ""}>
            <option value="">Любой исполнитель</option>
            {board.workspace.members
              .filter((member) => membership.role !== WorkspaceRole.EXECUTOR || member.userId === user.id)
              .map((member) => <option key={member.userId} value={member.userId}>{member.user.name}</option>)}
          </select>
          <button className="button secondary" type="submit">Применить</button>
          <Link className="text-link" href={basePath}>Сбросить</Link>
        </form>
      </details>

      {filters.imported !== undefined && (
        <div className="notice import-notice">
          Импорт завершен: создано задач — {filters.imported}, пропущено строк — {filters.skipped || "0"}.
        </div>
      )}

      <section className="kanban">
        {board.columns.map((column, index) => (
          <div className="column" key={column.id}>
            <div className="column-head">
              <div><span className="column-number">{index + 1}</span><strong>{column.name}</strong></div>
              <span className="count">{column.cards.length}{column.wipLimit ? ` / ${column.wipLimit}` : ""}</span>
            </div>
            <div className="column-cards">
              {column.cards.map((card) => (
                <div className="card-with-action" id={`card-${card.id}`} key={card.id}>
                  <TaskNode card={card} workspaceId={workspaceId} columnName={column.name} compact />
                  {(card.assigneeId === user.id && nextColumns(column.id).length > 0) || (canReview && isReviewStage(column.name) && previousColumn(column.id)) ? (
                    <details className="card-actions">
                      <summary>Действия с задачей</summary>
                      {card.assigneeId === user.id && nextColumns(column.id).length > 0 && (
                        <form action={moveCardAction} className="move-form">
                          <input type="hidden" name="cardId" value={card.id} />
                          <select name="columnId" aria-label={`Следующий этап для ${card.title}`}>
                            {nextColumns(column.id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                          </select>
                          <textarea name="comment" required minLength={3} placeholder="Что выполнено перед передачей?" aria-label={`Комментарий исполнителя для ${card.title}`} />
                          <button type="submit">Передать дальше →</button>
                        </form>
                      )}
                      {canReview && isReviewStage(column.name) && previousColumn(column.id) && (
                        <form action={returnCardAction} className="return-form">
                          <input type="hidden" name="cardId" value={card.id} />
                          <textarea name="comment" required minLength={3} placeholder="Почему задача требует доработки?" aria-label={`Причина возврата ${card.title}`} />
                          <button type="submit">← Вернуть на доработку</button>
                        </form>
                      )}
                    </details>
                  ) : null}
                </div>
              ))}
              {!column.cards.length && <div className="empty-node">Задач пока нет</div>}
            </div>
          </div>
        ))}
      </section>

      {canManage && (
        <details className="panel create-drawer import-drawer">
          <summary>Импортировать задачи из Excel</summary>
          <div className="import-layout">
            <div>
              <h3>Заполните задачи одним файлом</h3>
              <p className="muted">
                Сервис перенесет названия, описания, даты, этапы, важность, прогресс и исполнителей.
                Неизвестные этапы попадут во «Входящие», неизвестные исполнители останутся неназначенными.
              </p>
              <Link className="button ghost" href="/templates/shablon-importa-zadach.xlsx" download>
                Скачать шаблон Excel
              </Link>
            </div>
            <form action={importTasksAction} className="import-form">
              <input type="hidden" name="boardId" value={board.id} />
              <label className="field">
                Файл с задачами
                <input
                  name="file"
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  required
                />
              </label>
              <button className="button" type="submit">Импортировать задачи</button>
            </form>
          </div>
        </details>
      )}

      {canManage && (
        <details className="panel create-drawer">
          <summary>Добавить задачу в конвейер</summary>
          <form action={createCardAction} className="form-grid">
            <input type="hidden" name="boardId" value={board.id} />
            <label className="field">Название<input name="title" required /></label>
            <label className="field">Исполнитель<select name="assigneeId"><option value="">Не назначен</option>{board.workspace.members.map((member) => <option value={member.userId} key={member.userId}>{member.user.name}</option>)}</select></label>
            <label className="field full">Описание<textarea name="description" /></label>
            <label className="field">Важность<select name="priority">{Object.values(Priority).map((value) => <option key={value} value={value}>{priorityLabels[value]}</option>)}</select></label>
            <label className="field">Крайний срок<input name="dueDate" type="date" /></label>
            <label className="field">Плановое начало<input name="plannedStartDate" type="date" /></label>
            <label className="field">Плановое окончание<input name="plannedEndDate" type="date" /></label>
            <button className="button" type="submit">Создать задачу</button>
          </form>
        </details>
      )}
    </main>
  );
}
