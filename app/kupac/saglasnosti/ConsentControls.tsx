"use client";

import { useActionState } from "react";
import {
  setConsentAction,
  type ConsentActionState,
} from "@/app/kupac/saglasnosti/actions";
import { CONSENT_LABELS, consentLabelFor } from "@/lib/customers/consent.mjs";

const INITIAL: ConsentActionState = { error: null, ok: null };

export type ConsentRow = {
  purpose: string;
  granted: boolean;
  since: string | null;
  textVersion: string | null;
};

/**
 * Prekidači saglasnosti.
 *
 * Namerno NIJE jedan obrazac sa checkboxovima koji se šalje zajedno. Svaka
 * svrha je zaseban `form` sa jednim dugmetom, pa je nemoguće „usput" promeniti
 * drugu odluku — a nema ni stanja u kome bi neoznačen checkbox mogao da se
 * pošalje kao pristanak.
 */
export function ConsentControls({ rows }: { rows: ConsentRow[] }) {
  const [state, formAction, pending] = useActionState(setConsentAction, INITIAL);

  return (
    <>
      {state.error ? (
        <p className="pn-note" data-tone="danger" role="alert">
          <span>
            <strong>Nije sačuvano.</strong> {state.error}
          </span>
        </p>
      ) : null}
      {state.ok ? (
        <p className="pn-note" data-tone="success" role="status">
          <span>{state.ok}</span>
        </p>
      ) : null}

      <ul className="pn-versions">
        {rows.map((row) => {
          // Data saglasnost prikazuje tekst svoje verzije; nova odluka trenutni tekst.
          const label =
            (row.granted ? consentLabelFor(row.purpose, row.textVersion) : null) ??
            CONSENT_LABELS[row.purpose as keyof typeof CONSENT_LABELS];
          return (
            <li key={row.purpose} style={{ alignItems: "flex-start", padding: 14 }}>
              <div style={{ display: "grid", gap: 6, flex: "1 1 360px", minWidth: 0 }}>
                <span className="pn-inline">
                  <strong>{label?.title ?? row.purpose}</strong>
                  <span className="pn-status" data-tone={row.granted ? "success" : "neutral"}>
                    {row.granted ? "Dato" : "Nije dato"}
                  </span>
                </span>
                <p className="pn-small">{label?.body}</p>
                <span className="pn-small pn-muted">
                  {row.granted && row.since
                    ? `Dato ${row.since}${row.textVersion ? ` · verzija teksta ${row.textVersion}` : ""}`
                    : "Bez saglasnosti — ovo je podrazumevano stanje."}
                </span>
              </div>
              <form action={formAction}>
                {/*
                 * Nema polja sa ID-em naloga. Nalog dolazi iz sesije na
                 * serveru; ovde se šalje samo koja svrha i koja odluka.
                 */}
                <input type="hidden" name="purpose" value={row.purpose} />
                <input type="hidden" name="action" value={row.granted ? "withdrawn" : "granted"} />
                <button type="submit" className="pn-btn" data-variant={row.granted ? undefined : "primary"} disabled={pending} aria-busy={pending || undefined}>
                  {row.granted ? "Povucite saglasnost" : "Dajem saglasnost"}
                </button>
              </form>
            </li>
          );
        })}
      </ul>
    </>
  );
}
