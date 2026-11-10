"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { assignFromSheetAction, linkSheetLabelAction } from "./actions";

/**
 * Tabele kancelarije (2026-11-10):
 *  - „Poveži“: naziv iz tabele koji portal nije prepoznao → kupac (pamti se zauvek);
 *  - „Čiji je kupac“: kupac je u tabeli komercijaliste, a u portalu nije njemu dodeljen.
 */

type Unmatched = { key: string; label: string; sheet: string | null; invoices: number; total: number };
type Suggestion = { customerId: string; customerName: string; sheet: string; repId: string; repName: string; current: { id: string; name: string }[] };
type Customer = { id: string; name: string; city: string | null };

const whole = (n: number) => n.toLocaleString("sr-Latn-RS", { maximumFractionDigits: 0 });
const optionText = (c: Customer) => (c.city ? `${c.name} — ${c.city}` : c.name);

export function SheetMatching({ unmatched, customers, suggestions, canAssign }: { unmatched: Unmatched[]; customers: Customer[]; suggestions: Suggestion[]; canAssign: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<Record<string, { ok: boolean; text: string }>>({});
  const [showAll, setShowAll] = useState(false);
  const byText = new Map(customers.map((c) => [optionText(c), c.id]));

  const link = (u: Unmatched) => {
    const id = byText.get(picked[u.key] ?? "");
    if (!id) return setMsg({ ...msg, [u.key]: { ok: false, text: "Izaberite kupca sa spiska." } });
    start(async () => {
      const r = await linkSheetLabelAction({ key: u.key, customerId: id });
      setMsg({ ...msg, [u.key]: r ?? { ok: false, text: "Greška." } });
      if (r?.ok) router.refresh();
    });
  };
  const assign = (s: Suggestion, mode: "prebaci" | "dodaj") =>
    start(async () => {
      const r = await assignFromSheetAction({ customerId: s.customerId, repId: s.repId, mode });
      setMsg({ ...msg, [`a-${s.customerId}-${s.repId}`]: r ?? { ok: false, text: "Greška." } });
      if (r?.ok) router.refresh();
    });

  const withDebt = unmatched.filter((u) => u.total > 0);
  const shown = showAll ? unmatched : withDebt.length ? withDebt : unmatched.slice(0, 30);

  return (
    <>
      <datalist id="dg-kupci">
        {customers.map((c) => <option key={c.id} value={optionText(c)} />)}
      </datalist>

      {unmatched.length ? (
        <section className="portal-panel">
          <div className="portal-section-header">
            <div>
              <h2>Poveži kupce iz tabela ({unmatched.length})</h2>
              <p>
                Ove nazive portal nije sigurno prepoznao. Upišite deo imena, izaberite kupca i kliknite „Poveži“ — veza se pamti i važi i za
                sledeća čitanja. {withDebt.length ? `${withDebt.length} ima otvoren dug (prikazani prvi).` : ""}
              </p>
            </div>
            {unmatched.length > shown.length || showAll ? (
              <button type="button" className="dg-btn dg-btn--light" onClick={() => setShowAll(!showAll)}>
                {showAll ? "Samo sa dugom" : `Prikaži sve (${unmatched.length})`}
              </button>
            ) : null}
          </div>
          <div className="portal-table-wrap">
            <table className="portal-table dg-link">
              <thead>
                <tr><th>Naziv u tabeli</th><th>Tabela</th><th className="pk-num">Dug</th><th>Kupac u portalu</th><th aria-label="Radnja" /></tr>
              </thead>
              <tbody>
                {shown.map((u) => (
                  <tr key={u.key}>
                    <td data-label="Naziv u tabeli"><b>{u.label}</b></td>
                    <td data-label="Tabela">{u.sheet ?? "—"}</td>
                    <td className="pk-num" data-label="Dug">{u.total > 0 ? `${whole(u.total)} (${u.invoices})` : "—"}</td>
                    <td data-label="Kupac u portalu">
                      <input
                        className="dg-pick"
                        list="dg-kupci"
                        value={picked[u.key] ?? ""}
                        onChange={(e) => setPicked({ ...picked, [u.key]: e.target.value })}
                        placeholder="Upišite deo imena"
                        aria-label={`Kupac za ${u.label}`}
                      />
                      {msg[u.key] ? <span className={`dg-inline ${msg[u.key].ok ? "" : "dg-inline--err"}`}>{msg[u.key].text}</span> : null}
                    </td>
                    <td><button type="button" className="dg-btn" disabled={pending} onClick={() => link(u)}>Poveži</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {suggestions.length ? (
        <section className="portal-panel">
          <div className="portal-section-header">
            <div>
              <h2>Čiji je kupac — po tabelama ({suggestions.length})</h2>
              <p>
                Kupac je u tabeli komercijaliste, a u portalu nije dodeljen njemu. „Prebaci“ ostavlja kupca samo kod tog komercijaliste, „Dodaj“
                ga dodaje uz postojeće. {canAssign ? "" : "Dodelu potvrđuje vlasnik."}
              </p>
            </div>
          </div>
          <div className="portal-table-wrap">
            <table className="portal-table dg-link">
              <thead>
                <tr><th>Kupac</th><th>U tabeli</th><th>Sada u portalu</th><th aria-label="Radnja" /></tr>
              </thead>
              <tbody>
                {suggestions.map((s) => {
                  const k = `a-${s.customerId}-${s.repId}`;
                  return (
                    <tr key={k}>
                      <td data-label="Kupac"><b>{s.customerName}</b></td>
                      <td data-label="U tabeli">{s.repName}</td>
                      <td data-label="Sada u portalu">{s.current.length ? s.current.map((c) => c.name).join(", ") : <span className="pk-late">niko</span>}</td>
                      <td>
                        {canAssign ? (
                          <span className="dg-actions">
                            <button type="button" className="dg-btn" disabled={pending} onClick={() => assign(s, "prebaci")}>Prebaci</button>
                            {s.current.length ? (
                              <button type="button" className="dg-btn dg-btn--light" disabled={pending} onClick={() => assign(s, "dodaj")}>Dodaj</button>
                            ) : null}
                          </span>
                        ) : null}
                        {msg[k] ? <span className={`dg-inline ${msg[k].ok ? "" : "dg-inline--err"}`}>{msg[k].text}</span> : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </>
  );
}
