import Link from "next/link";
import type { RecentPayment } from "@/lib/sales-tools/receivables-service";

const money = (n: number) => n.toLocaleString("sr-Latn-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dmy = (d: string | null) => (d ? `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}.` : "—");
const day = (s: string | null) => (s ? `${s.slice(8, 10)}.${s.slice(5, 7)}.` : "—");

/**
 * Uplaćeno u poslednjih 5 dana (2026-11-24): kupac → koliko je uplatio; klik otvara plaćene
 * fakture i šta mu je ostalo da plati. Izvor je tabela dugovanja kancelarije.
 */
export function RecentPayments({ payments, since, days }: { payments: RecentPayment[]; since: string | null; days: number }) {
  const total = payments.reduce((s, p) => s + p.paidTotal, 0);
  return (
    <section className="portal-panel" id="uplaceno" aria-label={`Uplaćeno u poslednjih ${days} dana`}>
      <div className="portal-section-header">
        <div>
          <h2>Uplaćeno u poslednjih {days} dana{payments.length ? ` — ${payments.length} ${payments.length === 1 ? "kupac" : "kupaca"}, ${money(total)} RSD` : ""}</h2>
          <p>
            Po tabeli dugovanja kancelarije: faktura koja je nestala iz tabele je plaćena, smanjen ostatak je delimična uplata. Datum je dan
            kada je kancelarija to upisala. Kliknite na kupca da vidite plaćene fakture i šta mu je ostalo.
            {since ? ` Poređenje od ${day(since)}` : ""}
          </p>
        </div>
      </div>
      {payments.length === 0 ? (
        <p className="portal-empty">U ovom periodu nema evidentiranih uplata{since ? "" : " — tabela dugovanja još nema dovoljno snimaka za poređenje"}.</p>
      ) : (
        <div className="up-list">
          {payments.map((p) => (
            <details key={p.customerId} className="up-item">
              <summary>
                <span className="up-name">{p.customerName}</span>
                <span className="up-paid">uplatio <b>{money(p.paidTotal)}</b></span>
                <span className={p.remainingTotal > 0 ? "up-rest" : "up-rest up-rest--zero"}>
                  {p.remainingTotal > 0 ? <>ostalo <b>{money(p.remainingTotal)}</b>{p.overdueTotal > 0 ? <span className="pk-late"> · dospelo {money(p.overdueTotal)}</span> : null}</> : "nema više duga"}
                </span>
                <span className="up-when">{day(p.paid[0]?.seenOn ?? null)}</span>
              </summary>
              <div className="up-body">
                <h3>Plaćeno</h3>
                <div className="portal-table-wrap">
                  <table className="portal-table" data-sort="off">
                    <thead>
                      <tr><th>Faktura</th><th>Datum fakture</th><th className="portal-table-number">Bilo</th><th className="portal-table-number">Uplaćeno</th><th>Evidentirano</th></tr>
                    </thead>
                    <tbody>
                      {p.paid.map((i, n) => (
                        <tr key={`${i.invoiceNumber ?? ""}-${n}`}>
                          <th scope="row">{i.invoiceNumber ?? "—"}</th>
                          <td>{dmy(i.issuedOn)}</td>
                          <td className="portal-table-number">{money(i.before)}</td>
                          <td className="portal-table-number"><b>{money(i.paid)}</b>{i.full ? " · cela" : ` · ostalo ${money(i.after)}`}</td>
                          <td>{day(i.seenOn)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <h3>Ostalo da plati {p.open.length ? `(${p.open.length})` : ""}</h3>
                {p.open.length ? (
                  <div className="portal-table-wrap">
                    <table className="portal-table" data-sort="off">
                      <thead>
                        <tr><th>Faktura</th><th>Datum</th><th>Valuta</th><th className="portal-table-number">Ostatak</th><th className="portal-table-number">Kasni</th></tr>
                      </thead>
                      <tbody>
                        {p.open.map((l, n) => (
                          <tr key={`${l.invoiceNumber ?? ""}-${n}`}>
                            <th scope="row">{l.invoiceNumber ?? "—"}</th>
                            <td>{dmy(l.issuedOn)}</td>
                            <td>{dmy(l.dueOn)}</td>
                            <td className="portal-table-number"><b>{money(l.remaining)}</b></td>
                            <td className="portal-table-number">{l.daysOverdue && l.daysOverdue > 0 ? <span className="pk-late">{l.daysOverdue} d</span> : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="portal-footnote">Kupac nema otvorenih faktura u tabeli.</p>
                )}
                <p className="portal-footnote"><Link href={`/portal/dugovanja/${p.customerId}`}>Sve fakture kupca →</Link> · <Link href={`/portal/kupci/${p.customerId}`}>Kartica kupca</Link></p>
              </div>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}
