"use client";

import { useActionState } from "react";
import { PortalButton } from "@/components/portal/PortalPrimitives";
import { dmyTime } from "@/lib/ordering/panelFormat.mjs";
import { CUSTOMER_ACCOUNT_LABELS } from "@/lib/portal/status-labels";
import { markHandedOverAction, type AccountActionState } from "./actions";

export type OutboxItem = {
  id: number;
  kind: "invitation" | "password_reset" | "security_notice";
  createdAt: string;
  email: string;
  customerName: string;
  accountStatus: string;
};

const KIND: Record<OutboxItem["kind"], string> = {
  invitation: "Poziv za nalog",
  password_reset: "Nova lozinka",
  security_notice: "Bezbednosno obaveštenje",
};

const EMPTY: AccountActionState = { error: null, ok: null };

function HandOver({ id }: { id: number }) {
  const [state, action, pending] = useActionState(markHandedOverAction, EMPTY);
  if (state.ok) return <span className="pn-small" role="status">{state.ok}</span>;
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <PortalButton type="submit" disabled={pending}>
        {pending ? "Beleži se…" : "Označite predatim"}
      </PortalButton>
      {state.error ? (
        <small role="alert" className="portal-form-error">
          {state.error}
        </small>
      ) : null}
    </form>
  );
}

/**
 * Poruke koje čekaju ručnu predaju (revizija 2026-10-11, B10).
 *
 * Sistem nema e-poštu: link poziva se prikazuje samo jednom, pri izdavanju, a
 * zapis ostaje „na čekanju“ dok ga neko ne označi predatim. Ovde se taj spisak
 * vidi i zatvara; sam link se ovde više ne može prikazati.
 */
export function OutboxPanel({ items }: { items: OutboxItem[] }) {
  return (
    <section className="portal-panel" aria-labelledby="outbox-naslov">
      <div className="portal-section-header">
        <div>
          <h2 id="outbox-naslov">Za ručnu predaju ({items.length})</h2>
          <p>
            Sistem ne šalje e-poštu. Link poziva se prikazuje samo jednom, pri izdavanju — predajte ga kupcu lično ili
            telefonom, pa ovde označite da je predat. Ako je link izgubljen, izdajte nov poziv; stari prestaje da važi.
          </p>
        </div>
      </div>
      {items.length === 0 ? (
        <p className="pn-small pn-muted">Nema poruka koje čekaju predaju.</p>
      ) : (
        <div className="portal-table-wrap">
          <table className="portal-table">
            <thead>
              <tr>
                <th scope="col">Firma</th>
                <th scope="col">Kontakt</th>
                <th scope="col">Vrsta</th>
                <th scope="col">Izdato</th>
                <th scope="col">Stanje naloga</th>
                <th scope="col">Radnja</th>
              </tr>
            </thead>
            <tbody>
              {items.map((m) => (
                <tr key={m.id}>
                  <th scope="row">{m.customerName}</th>
                  <td>{m.email}</td>
                  <td>{KIND[m.kind] ?? m.kind}</td>
                  <td>{dmyTime(m.createdAt)}</td>
                  <td>{m.accountStatus === "active" ? "Aktivan — kupac je već postavio lozinku" : (CUSTOMER_ACCOUNT_LABELS[m.accountStatus] ?? m.accountStatus)}</td>
                  <td>
                    <HandOver id={m.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
