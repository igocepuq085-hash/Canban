import Link from "next/link";
import { createWorkspaceAction } from "@/app/actions";
import { TaskNode } from "@/components/task-node";
import { roleLabels } from "@/lib/labels";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function AppPage() {
  const user = await requireUser();
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId: user.id },
    include: { workspace: { include: { boards: true, members: true } } },
    orderBy: { createdAt: "desc" }
  });
  const managedWorkspaceIds = memberships
    .filter(({ role }) => role !== "EXECUTOR")
    .map(({ workspaceId }) => workspaceId);
  const canManageSpaces = memberships.length === 0 || managedWorkspaceIds.length > 0;
  const cards = await prisma.card.findMany({
    where: {
      OR: [
        { board: { workspaceId: { in: managedWorkspaceIds } } },
        { assigneeId: user.id }
      ]
    },
    include: { assignee: true, column: true, board: { include: { workspace: true } } },
    orderBy: [{ assigneeId: "asc" }, { updatedAt: "desc" }],
    take: 24
  });
  const assigned = cards.filter((card) => card.assigneeId === user.id).length;
  const atRisk = cards.filter((card) => card.riskLevel === "RISK" || card.riskLevel === "CRITICAL").length;
  const averageProgress = cards.length ? Math.round(cards.reduce((sum, card) => sum + card.manualProgress, 0) / cards.length) : 0;

  return (
    <main className="shell shell-wide">
      <section className="hero dashboard-hero">
        <div><p className="eyebrow">Рабочий центр</p><h1>Задачи в фокусе</h1><p className="muted">{user.name}, здесь собраны все доступные вам задачи и их текущий прогресс.</p></div>
        <div className="dashboard-metrics">
          <div className="metric-orb"><strong>{assigned}</strong><span>назначено вам</span></div>
          <div className="metric-orb"><strong>{atRisk}</strong><span>под угрозой</span></div>
          <div className="metric-orb"><strong>{averageProgress}%</strong><span>средний прогресс</span></div>
        </div>
      </section>

      <section className="dashboard-section">
        <div className="section-heading"><div><p className="eyebrow">Все доступные задачи</p><h2>Карточки заданий</h2></div><span className="muted">{cards.length} карточек</span></div>
        <div className="task-card-grid">
          {cards.map((card) => (
            <div className="dashboard-task" key={card.id}>
              <div className="task-context"><span>{card.board.workspace.name}</span><b>{card.board.name}</b></div>
              <TaskNode card={card} workspaceId={card.board.workspaceId} columnName={card.column.name} destination="board" />
            </div>
          ))}
          {!cards.length && <div className="empty-node">Задач пока нет</div>}
        </div>
      </section>

      {canManageSpaces && <details className="panel spaces-drawer">
        <summary>Пространства и настройки</summary>
        <div className="grid grid-3 spaces-grid">
          {memberships.map(({ workspace, role }) => (
            <Link key={workspace.id} href={`/app/workspaces/${workspace.id}`} className="panel workspace-card glow-calm">
              <p className="eyebrow">{roleLabels[role]}</p><h2>{workspace.name}</h2><p className="muted">{workspace.description || "Описание не добавлено"}</p>
              <div className="meta"><span>{workspace.boards.length} досок</span><span>{workspace.members.length} участников</span></div>
            </Link>
          ))}
          <section className="panel">
          <p className="eyebrow">Новое пространство</p>
          <h2>Создать рабочую среду</h2>
          <form action={createWorkspaceAction} className="stack">
            <label className="field">Название<input name="name" required placeholder="Например, Проектный отдел" /></label>
            <label className="field">Описание<textarea name="description" placeholder="Коротко о целях команды" /></label>
            <button className="button" type="submit">Создать пространство</button>
          </form>
          </section>
        </div>
      </details>}
    </main>
  );
}
