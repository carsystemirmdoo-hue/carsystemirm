"use client";

import { useActionState, useId } from "react";
import { PortalIcon } from "@/components/portal/PortalIcon";
import { PortalButton } from "@/components/portal/PortalPrimitives";
import { changeOwnPasswordAction } from "./actions";
import { EMPTY_PASSWORD_CHANGE } from "./types";

/**
 * Promena sopstvene lozinke.
 *
 * Posle uspeha se ne nudi „nastavi rad": sve sesije su opozvane, uključujući
 * ovu. Ekran to kaže otvoreno i vodi na ponovnu prijavu, umesto da korisnik
 * naleti na neobjašnjivo izbacivanje pri sledećem kliku.
 */
export function PasswordChange({ onSignOut }: { onSignOut: () => Promise<void> }) {
  const [state, formAction, pending] = useActionState(
    changeOwnPasswordAction,
    EMPTY_PASSWORD_CHANGE,
  );

  const currentId = useId();
  const nextId = useId();
  const confirmId = useId();
  const tokenId = useId();
  const errorId = useId();

  if (state.done) {
    return (
      <section className="portal-panel">
        <h2>Lozinka je promenjena</h2>
        <p>
          Sve prijave na ovom i drugim uređajima su opozvane. Prijavite se ponovo
          novom lozinkom.
        </p>
        <form action={onSignOut}>
          <PortalButton type="submit">Odjava i ponovna prijava</PortalButton>
        </form>
      </section>
    );
  }

  return (
    <section className="portal-panel">
      <h2>Promena lozinke</h2>
      <p>
        Pored trenutne lozinke traži se i kod iz aplikacije. Posle promene sve
        otvorene prijave prestaju da važe.
      </p>

      <form action={formAction}>
        <label htmlFor={currentId}>Trenutna lozinka</label>
        <input
          id={currentId}
          type="password"
          name="current"
          autoComplete="current-password"
          required
          maxLength={200}
          aria-invalid={Boolean(state.error)}
          aria-describedby={state.error ? errorId : undefined}
        />

        <label htmlFor={nextId}>Nova lozinka</label>
        <input
          id={nextId}
          type="password"
          name="next"
          autoComplete="new-password"
          required
          minLength={12}
          maxLength={200}
          aria-describedby={`${nextId}-hint`}
        />
        <small id={`${nextId}-hint`}>
          Najmanje 12 znakova. Duga fraza je jača od kratke sa simbolima.
        </small>

        <label htmlFor={confirmId}>Potvrda nove lozinke</label>
        <input
          id={confirmId}
          type="password"
          name="confirm"
          autoComplete="new-password"
          required
          minLength={12}
          maxLength={200}
        />

        <label htmlFor={tokenId}>Kod iz aplikacije</label>
        <input
          id={tokenId}
          name="token"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={8}
          required
          aria-invalid={Boolean(state.error)}
        />

        {state.error ? (
          <p id={errorId} role="alert" className="portal-form-error">
            <PortalIcon name="warning" /> {state.error}
          </p>
        ) : null}

        <PortalButton type="submit" disabled={pending}>
          {pending ? "Menjanje…" : "Promenite lozinku"}
        </PortalButton>
      </form>
    </section>
  );
}
