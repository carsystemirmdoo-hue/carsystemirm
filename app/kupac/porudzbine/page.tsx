import Link from "next/link";
import { OrderStatusBadge } from "@/components/ordering/OrderStatusBadge";
import { ScrollTable } from "@/components/ordering/ScrollTable";
import { requireCustomerSession } from "@/lib/authz/customer-session";
import { listCustomerOrders, type OrderListRow } from "@/lib/ordering/ordering-service";
import { orderingEnabledFor } from "@/lib/ordering/trial";
import { LiveRefresh } from "@/components/ordering/LiveRefresh";
import { customerOrderStamp } from "@/lib/ordering/live-stamp";
import { countOf, STAVKA } from "@/lib/ordering/plural.mjs";
import { dmyTime, money } from "@/lib/ordering/panelFormat.mjs";
import { orderStage } from "@/lib/ordering/statusView.mjs";

export const dynamic = "force-dynamic";

function Rows({ list }: { list: OrderListRow[] }) {
  return (
    <ScrollTable label="Zahtevi i porudžbine">
      <table className="pn-table pn-table-cards">
        <thead>
          <tr>
            <th scope="col">Broj</th>
            <th scope="col">Poslato</th>
            <th scope="col" className="pn-r">
              Stavki
            </th>
            <th scope="col" className="pn-r">
              Ukupno sa PDV-om
            </th>
            <th scope="col">Stanje</th>
            <th scope="col">Na potezu</th>
          </tr>
        </thead>
        <tbody>
          {list.map((o) => {
            const st = orderStage(o.status, { audience: "customer" });
            const allOnRequest = o.lineCount > 0 && o.onRequestLinesCount >= o.lineCount;
            return (
              <tr key={o.id}>
                <td className="pn-c-name" style={{ minWidth: 150 }}>
                  <Link href={`/kupac/porudzbine/${o.id}`} className="pn-row-link pn-num">
                    {o.orderNumber ? `Porudžbina ${o.orderNumber}` : `Zahtev ${o.requestNumber}`}
                  </Link>
                  <span className="pn-sub">
                    {o.orderNumber ? `iz zahteva ${o.requestNumber}` : o.revisionNo > 1 ? `verzija ${o.revisionNo}` : null}
                    {o.otherVersions ? `${o.orderNumber || o.revisionNo > 1 ? " · " : ""}starije verzije u istoriji: ${o.otherVersions}` : null}
                  </span>
                </td>
                <td className="pn-num" data-label="Poslato">
                  {dmyTime(o.submittedAt)}
                </td>
                <td className="pn-r pn-num" data-label="Stavki">
                  {o.lineCount}
                </td>
                <td className="pn-r" data-label="Ukupno sa PDV-om">
                  {allOnRequest ? <span className="pn-muted">Iznos još nije utvrđen</span> : <span className="pn-num pn-strong">{money(o.grossTotal, o.currency)}</span>}
                  {o.onRequestLinesCount && !allOnRequest ? <span className="pn-sub">nije konačno · {countOf(o.onRequestLinesCount, STAVKA)} na upit</span> : null}
                  {o.priceListKind === "demo" ? <span className="pn-sub">demo cene</span> : null}
                </td>
                <td data-label="Stanje">
                  <OrderStatusBadge status={o.status} audience="customer" />
                </td>
                <td data-label="Na potezu" style={{ fontWeight: st.turn === "customer" ? 650 : 400, color: st.turn === "none" ? "var(--p-muted)" : undefined }}>
                  {st.turn === "customer" ? "Vi" : st.turn === "office" ? "Kancelarija" : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </ScrollTable>
  );
}

/*
 * Zahtevi i porudžbine firme iz sesije. Zahtev (Z-…) postaje porudžbina (P-…)
 * tek kada ga kancelarija potvrdi; do tada se tako i zove.
 */
export default async function CustomerOrdersPage() {
  const session = await requireCustomerSession("/kupac/porudzbine");
  const [orders, enabled, stamp] = await Promise.all([listCustomerOrders(session.customerId), orderingEnabledFor(session.customerId), customerOrderStamp(session.customerId, null)]);
  const yours = orders.filter((o) => o.status === "awaiting_customer" || o.status === "changes_requested");
  const rest = orders.filter((o) => !yours.includes(o));

  return (
    <div className="pn">
      <header className="pn-head">
        <div>
          <h1 className="pn-title">Zahtevi i porudžbine</h1>
          <p className="pn-lead">
            Poslat zahtev pregleda kancelarija. Porudžbina je tek potvrđen zahtev i dobija svoj broj (P-…). Ni zahtev ni porudžbina nisu faktura; fakture su u
            posebnom odeljku.
          </p>
        </div>
        {enabled ? (
          <Link href="/kupac/korpa" className="pn-btn" data-size="sm">
            Korpa →
          </Link>
        ) : null}
      </header>
      {orders.length === 0 ? (
        <div className="pn-card pn-empty">
          <strong>Još nema poslatih zahteva.</strong>
          <p>
            {enabled
              ? "Artikle birate u odeljku „Izbor robe“, a zahtev šaljete iz korpe."
              : "Poručivanje kroz nalog još nije uključeno — porudžbine i dalje šaljete svom komercijalisti."}
          </p>
          {enabled ? (
            <Link href="/kupac/naruci" className="pn-btn" data-variant="primary">
              Izbor robe
            </Link>
          ) : null}
        </div>
      ) : (
        <>
          {yours.length ? (
            <section className="pn-card pn-card-flush" aria-labelledby="ceka-vas" style={{ boxShadow: "inset 4px 0 0 var(--pn-warn-mark)" }}>
              <div className="pn-card-h">
                <h2 id="ceka-vas">
                  Čeka Vas <span className="pn-muted pn-num" style={{ fontWeight: 400 }}>· {yours.length}</span>
                </h2>
                <span className="pn-small pn-muted">Otvorite zahtev da potvrdite ili odbijete predlog, odnosno pošaljete ispravku</span>
              </div>
              <Rows list={yours} />
            </section>
          ) : null}
          <section className="pn-card pn-card-flush" aria-labelledby="svi-zahtevi">
            <div className="pn-card-h">
              <h2 id="svi-zahtevi">
                {yours.length ? "Ostali zahtevi i porudžbine" : "Svi zahtevi i porudžbine"} <span className="pn-muted pn-num" style={{ fontWeight: 400 }}>· {rest.length}</span>
              </h2>
              <span className="pn-small pn-muted">Važeće verzije; starije su u istoriji svakog zahteva</span>
            </div>
            {rest.length ? <Rows list={rest} /> : <p className="pn-empty pn-muted">Nema drugih zahteva.</p>}
          </section>
        </>
      )}
      <LiveRefresh endpoint="/api/kupac/zahtevi/stanje" stamp={stamp} what="Spisak zahteva" />
    </div>
  );
}
