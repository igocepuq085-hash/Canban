import Link from "next/link";
import { registerAction } from "@/app/actions";

export default function RegisterPage() {
  return (
    <main className="auth-wrap">
      <section className="auth-card">
        <div className="brand"><span className="brand-mark">П</span> Поток <b>задач</b></div>
        <p className="eyebrow" style={{ marginTop: 24 }}>Новый профиль</p>
        <h1 style={{ fontSize: 36 }}>Создать учётную запись</h1>
        <form action={registerAction} className="stack">
          <label className="field">Имя<input name="name" required minLength={2} /></label>
          <label className="field">Электронная почта<input name="email" type="email" required /></label>
          <label className="field">Пароль<input name="password" type="password" required minLength={8} /></label>
          <button className="button" type="submit">Зарегистрироваться</button>
        </form>
        <p className="small muted" style={{ marginTop: 16 }}>Уже есть учётная запись? <Link href="/login"><strong>Войти</strong></Link></p>
      </section>
    </main>
  );
}
