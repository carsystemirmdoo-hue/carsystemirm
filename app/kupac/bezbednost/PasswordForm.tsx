"use client";

import { useActionState } from "react";
import { changePasswordAction, type PasswordState } from "./actions";

/** Promena lozinke. Greška se prikazuje uz obrazac i najavljuje čitaču ekrana. */
export function PasswordForm() {
  const [state, action, pending] = useActionState<PasswordState, FormData>(changePasswordAction, { error: null });
  return (
    <form action={action} className="pn-fields">
      <div className="pn-field">
        <label htmlFor="lozinka-trenutna">Trenutna lozinka</label>
        <input id="lozinka-trenutna" type="password" name="current" autoComplete="current-password" required aria-invalid={state.error ? true : undefined} />
      </div>
      <div className="pn-field">
        <label htmlFor="lozinka-nova">Nova lozinka</label>
        <input id="lozinka-nova" type="password" name="next" autoComplete="new-password" required minLength={12} aria-describedby="lozinka-nova-h" />
        <span id="lozinka-nova-h" className="pn-help">
          Najmanje 12 znakova.
        </span>
      </div>
      <div className="pn-field">
        <label htmlFor="lozinka-potvrda">Potvrda nove lozinke</label>
        <input id="lozinka-potvrda" type="password" name="confirm" autoComplete="new-password" required minLength={12} />
      </div>
      {state.error ? (
        <p className="pn-error" role="alert">
          {state.error}
        </p>
      ) : null}
      <div className="pn-actions pn-actions-start">
        <button type="submit" className="pn-btn" data-variant="primary" disabled={pending} aria-busy={pending || undefined}>
          {pending ? "Menja se…" : "Promenite lozinku"}
        </button>
      </div>
    </form>
  );
}
