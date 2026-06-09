import Link from "next/link";
import { redirect } from "next/navigation";
import { loginAction } from "@/app/actions";
import { isAuthBypassed } from "@/lib/auth";

export default function LoginPage() {
  if (isAuthBypassed) redirect("/app");

  return (
    <main className="auth-wrap">
      <section className="auth-card">
        <div className="brand"><span className="brand-mark">П</span> Поток <b>задач</b></div>
        <p className="eyebrow" style={{ marginTop: 24 }}>Командный контроль исполнения</p>
        <h1 style={{ fontSize: 36 }}>Войти в систему</h1>
        <p className="muted">Связанные конвейеры, сроки и управленческие сигналы в одном месте.</p>
        <form action={loginAction} className="stack">
          <label className="field">Электронная почта<input name="email" type="email" required /></label>
          <label className="field">Пароль<input name="password" type="password" required /></label>
          <button className="button" type="submit">Войти</button>
        </form>
        <p className="small muted" style={{ marginTop: 16 }}>Нет учётной записи? <Link href="/register"><strong>Зарегистрироваться</strong></Link></p>
      </section>
    </main>
  );
}
