import Link from "next/link";
import { formatDate } from "@/lib/format";
import { roleLabels } from "@/lib/labels";
import { prisma } from "@/lib/prisma";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await prisma.invitation.findUnique({ where: { token }, include: { workspace: true } });
  if (!invite) return <main className="shell"><div className="empty">Приглашение не найдено.</div></main>;
  const valid = Boolean(invite.userId) && invite.expiresAt > new Date();
  return (
    <main className="auth-wrap">
      <section className="auth-card">
        <p className="eyebrow">Приглашение в команду</p>
        <h1 style={{ fontSize: 36 }}>{invite.workspace.name}</h1>
        <p className="muted">{invite.name} · роль: {roleLabels[invite.role]} · действует до {formatDate(invite.expiresAt)}</p>
        {valid ? (
          <Link className="button" href={`/app/invite/${token}/enter`}>Открыть мои задачи</Link>
        ) : <div className="notice">Персональная ссылка недействительна или срок её действия закончился.</div>}
      </section>
    </main>
  );
}
