"use client";

import { useActionState } from "react";
import { Field, PortalButton } from "@/components/portal/PortalPrimitives";
import { linkReviewAction, type LinkActionState } from "./actions";

const INITIAL: LinkActionState = { error: null, ok: null, summary: [] };

export function LinkReviewForm({ applyEnabled }: { applyEnabled: boolean }) {
  const [state, action, pending] = useActionState(linkReviewAction, INITIAL);
  return (
    <section className="portal-panel">
      <h2>Primena pregledanih veza</h2>
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
          </div>
        ) : null}
        <Field label="Šifarnik partnera (XLSX, sirov izvoz)" required hint="Isti fajl iz kog je napravljen plan.">
          <input type="file" name="sifarnik" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required />
        </Field>
        <Field label="Pregledana tabela (CSV)" required hint="Kolone „odluka“ (potvrdi/odbij) i „potvrdio“ popunjava kancelarija.">
          <input type="file" name="pregled" accept=".csv,text/csv" required />
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
              <span>Pregledao/la sam proveru; primena otvara kupce i povezuje šifre.</span>
            </label>
            <p className="portal-login-hint">
              Primena traži prijavu sa drugim faktorom u poslednjih 10 minuta. Ako je prošlo više, odjavite se i
              prijavite ponovo.
            </p>
            <PortalButton type="submit" name="mode" value="primena" variant="primary" disabled={pending}>
              Primenite potvrđene
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
