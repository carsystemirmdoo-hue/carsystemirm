"use client";

import { useActionState } from "react";
import { recordStockRequestAction, resolveStockRequestsAction, type TrazenoState } from "./trazeno-actions";
import type { StockRequestRow } from "@/lib/stock/stock-requests";

const INIT: TrazenoState = { ok: null, error: null };
const qty = new Intl.NumberFormat("sr-RS", { maximumFractionDigits: 3 });
const dmy = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

/** „Kupac tražio“ (0065): šifra artikla, količina, napomena; kupac je zadat sa kartice kupca. */
export function KupacTrazioForm({ customerId, compact = false }: { customerId?: string; compact?: boolean }) {
  const [state, action, pending] = useActionState(recordStockRequestAction, INIT);
  return (
    <form action={action} className="portal-inline-form" aria-label="Kupac tražio artikal kog nema na stanju">
      {customerId ? <input type="hidden" name="kupac" value={customerId} /> : null}
      <input name="sifra" placeholder="Šifra artikla" aria-label="Šifra artikla" maxLength={40} required autoComplete="off" />
      <input name="kolicina" placeholder="Količina" aria-label="Količina" inputMode="decimal" maxLength={12} style={{ maxWidth: "8rem" }} />
      {compact ? null : <input name="napomena" placeholder="Napomena" aria-label="Napomena" maxLength={500} />}
      <button type="submit" className="portal-button" data-variant="primary" disabled={pending}>
        {pending ? "Beležim…" : "Kupac tražio"}
      </button>
      {state.ok ? <span role="status">{state.ok}</span> : null}
      {state.error ? <span role="alert" className="portal-error">{state.error}</span> : null}
    </form>
  );
}

/** Spisak otvorenih „traženo — nema na stanju“ sa označavanjem kao rešeno. */
export function TrazenoList({ rows, canResolve }: { rows: StockRequestRow[]; canResolve: boolean }) {
  const [state, action, pending] = useActionState(resolveStockRequestsAction, INIT);
  if (!rows.length) return <p className="portal-panel-body">Nema otvorenih zapisa u poslednjih 90 dana.</p>;
  return (
    <form action={action} style={{ display: "block", width: "100%", maxWidth: "none", minWidth: 0 }}>
      <div className="portal-table-wrap" style={{ width: "100%" }}>
        <table className="portal-table" data-sort="off">
          <thead>
            <tr>
              {canResolve ? <th scope="col" aria-label="Izbor" /> : null}
              <th scope="col">Datum</th>
              <th scope="col">Artikal</th>
              <th scope="col">Količina</th>
              <th scope="col">Kupac</th>
              <th scope="col">Izvor</th>
              <th scope="col">Lager tada</th>
              <th scope="col">Napomena</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                {canResolve ? (
                  <td>
                    <input type="checkbox" name="id" value={r.id} aria-label={`Označi ${r.code}`} />
                  </td>
                ) : null}
                <td>{dmy(r.createdAt)}</td>
                <th scope="row">
                  {r.name}
                  <small> · {r.code}</small>
                </th>
                <td className="portal-table-number">{r.quantity === null ? "—" : `${qty.format(r.quantity)} ${r.unit ?? ""}`}</td>
                <td>{r.customerName ?? "—"}</td>
                <td>{r.source === "porudzbina" ? `porudžbina ${r.orderNumber ?? ""}` : `ručno${r.requestedBy ? ` (${r.requestedBy})` : ""}`}</td>
                <td className="portal-table-number">{r.stockQuantity === null ? "—" : qty.format(r.stockQuantity)}</td>
                <td>{r.note ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {canResolve ? (
        <div className="portal-inline-form" style={{ marginTop: "0.75rem" }}>
          <input name="resenje" placeholder="Kako je rešeno (poručeno, stiglo…)" aria-label="Kako je rešeno" maxLength={200} required />
          <button type="submit" className="portal-button" disabled={pending}>
            {pending ? "Upisujem…" : "Označi označene kao rešeno"}
          </button>
          {state.ok ? <span role="status">{state.ok}</span> : null}
          {state.error ? <span role="alert" className="portal-error">{state.error}</span> : null}
        </div>
      ) : null}
    </form>
  );
}
