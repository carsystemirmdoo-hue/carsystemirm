"use client";

import { useActionState } from "react";
import { Field, PortalButton } from "@/components/portal/PortalPrimitives";
import {
  requestResetAction,
  type ActivationState,
} from "@/app/prijava/kupac/aktivacija/actions";

const INITIAL: ActivationState = { error: null, ok: null };

export function ResetRequestForm() {
  const [state, formAction, pending] = useActionState(requestResetAction, INITIAL);

  return (
    <main className="portal-login-root">
      <section className="portal-login-form-side">
        <form className="portal-login-form" action={formAction}>
          <header>
            <span>Pristup za kupce</span>
            <h2>Zaboravljena lozinka</h2>
            <p>Unesite e-poštu Vašeg naloga.</p>
          </header>

          <Field label="E-pošta" required>
            <input
              type="email"
              name="email"
              maxLength={254}
              autoComplete="username"
              required
            />
          </Field>

          {/*
            * Odgovor je uvek isti, i za postojeći i za nepostojeći nalog.
            * Razlika bi bila enumeracija: spisak kupaca jedne firme je
            * poslovno osetljiv podatak.
            */}
          {state.ok ? (
            <p className="portal-login-hint" role="status">
              {state.ok}
            </p>
          ) : null}

          <PortalButton type="submit" variant="primary" disabled={pending}>
            {pending ? "Slanje…" : "Zatražite promenu"}
          </PortalButton>
        </form>
      </section>
    </main>
  );
}
