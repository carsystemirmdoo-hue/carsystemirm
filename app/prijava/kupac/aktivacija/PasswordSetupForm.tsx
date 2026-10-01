"use client";

import { useActionState } from "react";
import { Field, PortalButton } from "@/components/portal/PortalPrimitives";
import {
  activateAccountAction,
  type ActivationState,
} from "@/app/prijava/kupac/aktivacija/actions";

const INITIAL: ActivationState = { error: null, ok: null };

/**
 * Postavljanje lozinke pri aktivaciji naloga.
 *
 * Samostalni reset zaboravljene lozinke je isključen dok ne postoji slanje
 * e-pošte (vidi `aktivacija/actions.ts`); oporavak ide novom pozivnicom, koja
 * vodi na ovaj isti obrazac.
 */
export function PasswordSetupForm({
  token,
  minLength,
}: {
  token: string;
  minLength: number;
}) {
  const [state, formAction, pending] = useActionState(activateAccountAction, INITIAL);

  return (
    <main className="portal-login-root">
      <section className="portal-login-form-side">
        <form className="portal-login-form" action={formAction}>
          <header>
            <span>Pristup za kupce</span>
            <h2>Aktivacija naloga</h2>
            <p>
              Postavite lozinku koju znate samo Vi. Niko iz firme je ne vidi i ne
              može je pročitati.
            </p>
          </header>

          <input type="hidden" name="token" value={token} />

          <Field label="Nova lozinka" required hint={`Najmanje ${minLength} znakova.`}>
            <input
              type="password"
              name="password"
              minLength={minLength}
              maxLength={200}
              autoComplete="new-password"
              required
            />
          </Field>
          <Field label="Ponovite lozinku" required>
            <input
              type="password"
              name="confirm"
              minLength={minLength}
              maxLength={200}
              autoComplete="new-password"
              required
            />
          </Field>

          {state.error ? (
            <div className="portal-login-error" role="alert">
              <span>
                <strong>Nije uspelo</strong>
                <small>{state.error}</small>
              </span>
            </div>
          ) : null}
          {state.ok ? (
            <p className="portal-login-hint" role="status">
              {state.ok} <a href="/prijava/kupac">Idite na prijavu</a>.
            </p>
          ) : null}

          <PortalButton type="submit" variant="primary" disabled={pending}>
            {pending ? "Čuvanje…" : "Sačuvajte lozinku"}
          </PortalButton>
        </form>
      </section>
    </main>
  );
}
