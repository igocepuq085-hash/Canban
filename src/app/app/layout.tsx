import Link from "next/link";
import { logoutAction, returnToPreviewOwnerAction } from "@/app/actions";
import { isAuthBypassed, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const executorMembership = isAuthBypassed
    ? await prisma.workspaceMember.findFirst({ where: { userId: user.id, role: "EXECUTOR" } })
    : null;
  return (
    <>
      <header className="topbar">
        <Link href="/app" className="brand"><span className="brand-mark">П</span> Поток</Link>
        <nav className="topnav"><Link href="/app">Пространства</Link></nav>
        <div className="nav-user">
          <span>{user.name}</span>
          <div className="avatar">{user.name.slice(0, 1).toUpperCase()}</div>
          {executorMembership && <form action={returnToPreviewOwnerAction}><button className="button ghost" type="submit">Режим руководителя</button></form>}
          {!isAuthBypassed && <form action={logoutAction}><button className="button ghost" type="submit">Выйти</button></form>}
        </div>
      </header>
      {children}
    </>
  );
}
