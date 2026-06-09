import Link from "next/link";
import { RegisterForm } from "@/components/register-form";

export default function RegisterPage() {
  return (
    <main className="auth-wrap">
      <section className="auth-card">
        <div className="brand"><span className="brand-mark">П</span> Поток <b>задач</b></div>
        <p className="eyebrow" style={{ marginTop: 24 }}>Новый профиль</p>
        <h1 style={{ fontSize: 36 }}>Создать учётную запись</h1>
        <RegisterForm />
        <p className="small muted" style={{ marginTop: 16 }}>Уже есть учётная запись? <Link href="/login"><strong>Войти</strong></Link></p>
      </section>
    </main>
  );
}
