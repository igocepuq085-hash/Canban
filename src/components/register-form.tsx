"use client";

import { useActionState } from "react";
import { registerAction, type AuthActionState } from "@/app/actions";

const initialState: AuthActionState = {};

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(registerAction, initialState);

  return (
    <form action={formAction} className="stack">
      <label className="field">Имя<input name="name" required minLength={2} /></label>
      <label className="field">Электронная почта<input name="email" type="email" required /></label>
      <label className="field">Пароль<input name="password" type="password" required minLength={8} /></label>
      {state.error && <p className="form-error" role="alert">{state.error}</p>}
      <button className="button" type="submit" disabled={pending}>
        {pending ? "Создаём учётную запись..." : "Зарегистрироваться"}
      </button>
    </form>
  );
}
