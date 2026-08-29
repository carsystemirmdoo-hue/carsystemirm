"use client";

import { useActionState } from "react";
import { Field, PortalButton } from "@/components/portal/PortalPrimitives";
import {
  activateAccountAction,
  completeResetAction,
  type ActivationState,
} from "@/app/prijava/kupac/aktivacija/actions";

const INITIAL: ActivationState = { error: null, ok: null };

/**
 * Postavljanje lozinke — i za aktivaciju i za reset.
 *
 * Jedan obrazac za oba toka: pravila lozinke, poruke o grešci i ponašanje pri
 * neispravnom tokenu moraju biti identična, a dva obrasca bi se s vremenom
 * razišla.
 */
export function PasswordSetupForm({
  token,
  mode,
  minLength,
}: {
  token: string;
  mode: "activation" | "reset";
  minLength: number;
}) {
  const [state, formAction, pending] = useActionState(
    mode === "activation" ? activateAccountAction : completeResetAction,
    INITIAL,
  );

  return (
    <main className="portal-login-root">
      <section className="portal-login-form-side">
        <form className="portal-login-form" action={formAction}>
          <header>
            <span>Pristup za kupce</span>
            <h2>
              {mode === "activation" ? "Aktivacija naloga" : "Nova lozinka"}
            </h2>
            <p>
              Postavite lozinku koju znate samo vi. Niko iz firme je ne vidi i ne
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
            {pending ? "Čuvanje…" : "Sačuvaj lozinku"}
          </PortalButton>
        </form>
      </section>
    </main>
  );
}
