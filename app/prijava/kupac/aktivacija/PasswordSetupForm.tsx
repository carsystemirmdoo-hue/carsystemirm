"use client";

import Link from "next/link";
import { useActionState } from "react";
import { CustomerAuthShell } from "@/components/customer/CustomerAuthShell";
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
    <CustomerAuthShell title="Aktivacija naloga" lead="Postavite lozinku koju znate samo Vi. Niko iz firme je ne vidi i ne može je pročitati.">
      {state.ok ? (
        <div className="pn-note" data-tone="success" role="status">
          <div className="pn-note-row">
            <span>{state.ok}</span>
            <Link href="/prijava/kupac" className="pn-btn" data-size="sm">
              Idite na prijavu
            </Link>
          </div>
        </div>
      ) : (
        <form action={formAction}>
          <input type="hidden" name="token" value={token} />
          <div className="pn-field">
            <label htmlFor="aktivacija-lozinka">Nova lozinka</label>
            <input
              id="aktivacija-lozinka"
              type="password"
              name="password"
              minLength={minLength}
              maxLength={200}
              autoComplete="new-password"
              required
              aria-describedby="aktivacija-pomoc"
            />
            <span id="aktivacija-pomoc" className="pn-help">
              Najmanje {minLength} znakova.
            </span>
          </div>
          <div className="pn-field">
            <label htmlFor="aktivacija-potvrda">Ponovite lozinku</label>
            <input id="aktivacija-potvrda" type="password" name="confirm" minLength={minLength} maxLength={200} autoComplete="new-password" required />
          </div>

          {state.error ? (
            <p className="pn-note" data-tone="danger" role="alert">
              <span>
                <strong>Nije uspelo.</strong> {state.error}
              </span>
            </p>
          ) : null}

          <button className="pn-btn" data-variant="primary" type="submit" disabled={pending} aria-busy={pending || undefined} style={{ width: "100%" }}>
            {pending ? "Čuva se…" : "Sačuvajte lozinku"}
          </button>
        </form>
      )}
    </CustomerAuthShell>
  );
}
