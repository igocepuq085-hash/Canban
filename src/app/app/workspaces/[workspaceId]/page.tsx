import Link from "next/link";
import { WorkspaceRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { createBoardAction, inviteMemberAction } from "@/app/actions";
import { InviteLink } from "@/components/invite-link";
import { roleLabels } from "@/lib/labels";
import { requireWorkspaceMember } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function WorkspacePage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  const user = await requireUser();
  const membership = await requireWorkspaceMember(workspaceId, user.id);
  if (membership.role === WorkspaceRole.EXECUTOR) redirect("/app");
  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    include: {
      boards: { include: { cards: true }, orderBy: { createdAt: "asc" } },
      members: { include: { user: true }, orderBy: { createdAt: "asc" } },
      invitations: { orderBy: { createdAt: "desc" } }
    }
  });
  const cards = workspace.boards.flatMap((board) => board.cards);
  const overdue = cards.filter((card) => card.dueDate && card.dueDate < new Date() && card.manualProgress < 100).length;
  const risk = cards.filter((card) => ["RISK", "CRITICAL"].includes(card.riskLevel)).length;
  const unassigned = cards.filter((card) => !card.assigneeId).length;
  const stuck = cards.filter((card) => card.stuckFlag).length;
  const canManage = membership.role === WorkspaceRole.OWNER || membership.role === WorkspaceRole.ADMIN;
  const canBuild = canManage || membership.role === WorkspaceRole.MEMBER;

  return (
    <main className="shell shell-wide">
      <section className="hero">
        <div>
          <p className="eyebrow">{roleLabels[membership.role]} · пространство</p>
          <h1>{workspace.name}</h1>
          <p className="muted">{workspace.description}</p>
        </div>
        <Link className="button ghost" href="/app">Все пространства</Link>
      </section>

      <section className="grid grid-4 workspace-stats">
        <div className="stat"><span className="muted">Всего задач</span><strong>{cards.length}</strong></div>
        <div className="stat glow-overdue"><span className="muted">Просрочено</span><strong>{overdue}</strong></div>
        <div className="stat glow-soon"><span className="muted">Под угрозой</span><strong>{risk}</strong></div>
        <div className="stat glow-unassigned"><span className="muted">Без исполнителя / зависли</span><strong>{unassigned} / {stuck}</strong></div>
      </section>

      <section className="workspace-pipeline panel">
        <div className="section-heading">
          <div><p className="eyebrow">Конвейер пространства</p><h2>Маршрут рабочих досок</h2></div>
          <span className="muted">Каждая доска — самостоятельный участок общего процесса</span>
        </div>
        <div className="workspace-flow">
          {workspace.boards.map((board, index) => (
            <div className="workspace-flow-item" key={board.id}>
              {index < workspace.boards.length - 1 && <div className="workspace-connector"><span /></div>}
              <Link className="workspace-node" href={`/app/workspaces/${workspace.id}/boards/${board.id}`}>
                <span className="node-port node-port-in" />
                <span className="node-port node-port-out" />
                <span className="step-number">{String(index + 1).padStart(2, "0")}</span>
                <span className="node-kind">Рабочая доска</span>
                <h3>{board.name}</h3>
                <p>{board.description || "Описание не добавлено"}</p>
                <div className="node-footer"><span>{board.cards.length} задач</span><b>Открыть</b></div>
              </Link>
            </div>
          ))}
          {!workspace.boards.length && <div className="empty-node">Создайте первую доску, чтобы начать конвейер</div>}
        </div>
      </section>

      <details className="panel workspace-settings">
        <summary>Настройки пространства</summary>
        <section className="grid grid-2">
          {canBuild && (
            <section className="settings-block">
            <p className="eyebrow">Новый участок</p>
            <h2>Добавить доску в конвейер</h2>
            <form action={createBoardAction} className="stack">
              <input type="hidden" name="workspaceId" value={workspace.id} />
              <label className="field">Название<input name="name" required /></label>
              <label className="field">Описание<textarea name="description" /></label>
              <button className="button" type="submit">Добавить доску</button>
            </form>
            </section>
          )}
          <section className="settings-block">
          <p className="eyebrow">Команда</p>
          <h2>Участники пространства</h2>
          <div className="member-list">
            {workspace.members.map((member) => <span className="member" key={member.id}><b>{member.user.name}</b> · {roleLabels[member.role]}</span>)}
          </div>
          {canManage && (
            <form action={inviteMemberAction} className="form-grid" style={{ marginTop: 18 }}>
              <input type="hidden" name="workspaceId" value={workspace.id} />
              <label className="field">Фамилия исполнителя<input name="name" required placeholder="Например, Иванов" /></label>
              <div className="field"><span>Доступ</span><strong>Только назначенные задачи</strong></div>
              <button className="button" type="submit">Создать персональную ссылку</button>
            </form>
          )}
          {workspace.invitations.length > 0 && <div className="stack" style={{ marginTop: 16 }}>
            <p className="small muted">Персональные ссылки сотрудников:</p>
            {workspace.invitations.map((invite) => (
              <InviteLink
                key={invite.id}
                name={invite.name || invite.email}
                path={`/app/invite/${invite.token}/enter`}
                accepted={Boolean(invite.acceptedAt)}
              />
            ))}
          </div>}
          </section>
        </section>
      </details>
    </main>
  );
}
