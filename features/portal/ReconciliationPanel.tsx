"use client";

import { useActionState } from "react";
import {
  reconcileAction,
  type ReconciliationState,
} from "@/app/portal/cene/reconciliation-actions";
import { Badge, PortalButton } from "@/components/portal/PortalPrimitives";
import {
  RECONCILIATION_OUTCOME_LABELS,
  RECONCILIATION_OUTCOME_TONES,
} from "@/lib/portal/status-labels";

const INITIAL: ReconciliationState = { error: null, ok: null, results: [] };

/**
 * Pokretanje usaglašavanja sa fakturom.
 *
 * Dugme ne „potvrđuje cenu" — pokreće proveru. Ishod je nalaz: ili je uslov
 * pronađen na fakturisanoj stavci, ili nije, ili još nema šta da se proveri.
 * Čovek koji klikne ne može uticati na to koji će od tri biti.
 */
export function ReconciliationPanel({ pending }: { pending: number }) {
  const [state, formAction, running] = useActionState(reconcileAction, INITIAL);

  return (
    <section className="portal-panel">
      <div className="portal-section-header">
        <div>
          <h2>Usaglašavanje sa fakturom</h2>
          <p>
            Pravilo postaje „potvrđeno“ isključivo kada se uslov nađe na
            fakturisanoj stavci. Evidencija kancelarije o unosu u BizniSoft nije
            dokaz — to je tvrdnja da je uneto.
          </p>
        </div>
      </div>

      <form action={formAction} className="portal-settings-form">
        <p>
          Pravila koja čekaju proveru: <strong>{pending}</strong>
        </p>
        <PortalButton type="submit" variant="primary" disabled={running || pending === 0}>
          {running ? "Proveravam…" : "Pokreni usaglašavanje"}
        </PortalButton>

        {state.error ? (
          <p className="portal-login-error" role="alert">{state.error}</p>
        ) : null}
        {state.ok ? (
          <p className="portal-permission-ok" role="status">{state.ok}</p>
        ) : null}
      </form>

      {state.results.length > 0 ? (
        <div className="portal-table-wrap">
          <table className="portal-table">
            <thead>
              <tr>
                <th scope="col">Ishod</th>
                <th scope="col">Pravila</th>
              </tr>
            </thead>
            <tbody>
              {state.results.map((row) => (
                <tr key={row.outcome}>
                  <th scope="row">
                    <Badge tone={RECONCILIATION_OUTCOME_TONES[row.outcome]}>
                      {RECONCILIATION_OUTCOME_LABELS[row.outcome] ?? row.outcome}
                    </Badge>
                  </th>
                  <td className="portal-table-number">{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
