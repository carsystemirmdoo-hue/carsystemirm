"use client";

import { useActionState } from "react";
import { Badge, PortalButton } from "@/components/portal/PortalPrimitives";
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
        <div className="portal-login-error" role="alert">
          <span>
            <strong>Nije sačuvano</strong>
            <small>{state.error}</small>
          </span>
        </div>
      ) : null}
      {state.ok ? (
        <p className="portal-login-hint" role="status">
          {state.ok}
        </p>
      ) : null}

      <ul className="portal-notification-list">
        {rows.map((row) => {
          // Data saglasnost prikazuje tekst svoje verzije; nova odluka trenutni tekst.
          const label =
            (row.granted ? consentLabelFor(row.purpose, row.textVersion) : null) ??
            CONSENT_LABELS[row.purpose as keyof typeof CONSENT_LABELS];
          return (
            <li key={row.purpose} data-status={row.granted ? "read" : "unread"}>
              <div>
                <Badge tone={row.granted ? "success" : "neutral"}>
                  {row.granted ? "Dato" : "Nije dato"}
                </Badge>
                <strong>{label?.title ?? row.purpose}</strong>
                <p>{label?.body}</p>
                <small>
                  {row.granted && row.since
                    ? `Dato ${row.since}${row.textVersion ? ` · verzija teksta ${row.textVersion}` : ""}`
                    : "Bez saglasnosti — ovo je podrazumevano stanje."}
                </small>
              </div>
              <div>
                <form action={formAction}>
                  {/*
                    * Nema polja sa ID-em naloga. Nalog dolazi iz sesije na
                    * serveru; ovde se šalje samo koja svrha i koja odluka.
                    */}
                  <input type="hidden" name="purpose" value={row.purpose} />
                  <input
                    type="hidden"
                    name="action"
                    value={row.granted ? "withdrawn" : "granted"}
                  />
                  <PortalButton
                    type="submit"
                    variant={row.granted ? "ghost" : "primary"}
                    disabled={pending}
                  >
                    {row.granted ? "Povucite saglasnost" : "Dajem saglasnost"}
                  </PortalButton>
                </form>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
