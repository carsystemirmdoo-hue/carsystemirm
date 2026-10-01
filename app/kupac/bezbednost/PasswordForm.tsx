"use client";

import { useActionState } from "react";
import { changePasswordAction, type PasswordState } from "./actions";

export function PasswordForm() {
  const [state, action, pending] = useActionState<PasswordState, FormData>(changePasswordAction, { error: null });
  return (
    <form action={action} className="portal-form kk-password">
      <label className="portal-field">
        <span>Trenutna lozinka</span>
        <input type="password" name="current" autoComplete="current-password" required />
      </label>
      <label className="portal-field">
        <span>Nova lozinka</span>
        <input type="password" name="next" autoComplete="new-password" required minLength={12} />
      </label>
      <label className="portal-field">
        <span>Potvrda nove lozinke</span>
        <input type="password" name="confirm" autoComplete="new-password" required minLength={12} />
      </label>
      {state.error ? <p className="kk-problem" role="alert">{state.error}</p> : null}
      <button type="submit" className="portal-button" data-variant="primary" disabled={pending}>
        {pending ? "Menjam…" : "Promeni lozinku"}
      </button>
    </form>
  );
}
