"use client";

import { useActionState } from "react";
import { Field, PortalButton } from "@/components/portal/PortalPrimitives";
import { contactProposalAction, type ContactActionState } from "./actions";

const INITIAL: ContactActionState = { error: null, ok: null, summary: [], izdvojeno: [] };

export function ContactProposalForm({ applyEnabled }: { applyEnabled: boolean }) {
  const [state, action, pending] = useActionState(contactProposalAction, INITIAL);
  return (
    <section className="portal-panel">
      <h2>Upis pregledanih kontakata</h2>
      <form action={action} className="portal-form">
        {state.error ? (
          <div className="portal-login-error" role="alert">
            <span>
              <strong>Nije izvršeno</strong>
              <small>{state.error}</small>
            </span>
          </div>
        ) : null}
        {state.ok ? (
          <div className="portal-login-hint" role="status">
            <p>{state.ok}</p>
            {state.summary.length ? (
              <ul>
                {state.summary.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            ) : null}
            {state.izdvojeno.length ? (
              <>
                <p>Izdvojeno za proveru:</p>
                <ul>
                  {state.izdvojeno.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        ) : null}
        <Field label="Pregledana tabela kontakata (CSV)" required hint="Kolone „odluka“ (potvrdi/odbij) i „potvrdio“ popunjava kancelarija.">
          <input type="file" name="tabela" accept=".csv,text/csv" required />
        </Field>
        <Field label="Izdavalac" required hint="Ista oznaka kao pri uvozu faktura (CSRM).">
          <input type="text" name="issuerCode" pattern="[A-Za-z0-9._\-]{1,64}" required />
        </Field>
        <PortalButton type="submit" name="mode" value="provera" variant="secondary" disabled={pending}>
          {pending ? "Radi…" : "Proverite (bez upisa)"}
        </PortalButton>
        {applyEnabled ? (
          <>
            <label className="portal-recovery-confirm">
              <input type="checkbox" name="potvrda" value="da" />
              <span>Pregledao/la sam proveru; primena upisuje predloge kontakata bez lozinke i bez poziva.</span>
            </label>
            <p className="portal-login-hint">
              Primena traži prijavu sa drugim faktorom u poslednjih 10 minuta. Ako je prošlo više, odjavite se i
              prijavite ponovo.
            </p>
            <PortalButton type="submit" name="mode" value="primena" variant="primary" disabled={pending}>
              Upišite potvrđene
            </PortalButton>
          </>
        ) : (
          <p>
            Primena je isključena u ovom okruženju (<code>FEATURE_PARTNER_REGISTRY</code>); provera radi.
          </p>
        )}
      </form>
    </section>
  );
}
