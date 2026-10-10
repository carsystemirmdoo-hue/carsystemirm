import Link from "next/link";
import { srDateTime, srMoney } from "@/components/customer/account-format";
import { OrderStatusBadge } from "@/components/ordering/OrderStatusBadge";
import { requireCustomerSession } from "@/lib/authz/customer-session";
import { listCustomerOrders } from "@/lib/ordering/ordering-service";
import { orderingEnabledFor } from "@/lib/ordering/trial";
import { LiveRefresh } from "@/components/ordering/LiveRefresh";
import { customerOrderStamp } from "@/lib/ordering/live-stamp";

export const dynamic = "force-dynamic";

/*
 * Zahtevi i porudžbine firme iz sesije. Zahtev (Z-…) postaje porudžbina (P-…)
 * tek kada ga kancelarija potvrdi; do tada se tako i zove.
 */
export default async function CustomerOrdersPage() {
  const session = await requireCustomerSession("/kupac/porudzbine");
  const [orders, enabled, stamp] = await Promise.all([listCustomerOrders(session.customerId), orderingEnabledFor(session.customerId), customerOrderStamp(session.customerId, null)]);

  return (
    <section className="portal-panel">
      <div className="portal-section-header">
        <div>
          <h2>Zahtevi i porudžbine</h2>
          <p>
            Poslat zahtev pregleda kancelarija. Porudžbina je tek potvrđen zahtev i dobija svoj broj (P-…). Fakture su
            posebna celina.
          </p>
        </div>
        <Link href="/kupac/korpa" className="portal-section-link">Korpa →</Link>
      </div>
      {orders.length === 0 ? (
        <div className="portal-panel-body ka-empty">
          <p>
            <strong>Još nema poslatih zahteva.</strong>{" "}
            {enabled
              ? "Artikle birate u odeljku „Izbor robe“, a zahtev šaljete iz korpe."
              : "Poručivanje kroz nalog još nije uključeno — porudžbine i dalje šaljete svom komercijalisti."}
          </p>
          {enabled ? (
            <p>
              <Link href="/kupac/naruci">Izbor robe →</Link>
            </p>
          ) : null}
        </div>
      ) : (
        <div className="portal-panel-body">
          <ol className="ka-invoices kk-orders">
            <li className="ka-invoices-head" aria-hidden="true">
              <span>Broj</span>
              <span>Poslato</span>
              <span>Stavki</span>
              <span>Status</span>
              <span>Ukupno sa PDV-om</span>
            </li>
            {orders.map((o) => (
              <li key={o.id}>
                <Link href={`/kupac/porudzbine/${o.id}`}>
                  <span className="ka-inv-number">
                    {o.orderNumber ?? o.requestNumber}
                    {o.orderNumber ? <small>zahtev {o.requestNumber}</small> : <small>zahtev</small>}
                    {o.otherVersions ? <small>starije verzije u istoriji: {o.otherVersions}</small> : null}
                  </span>
                  <span>{srDateTime(o.submittedAt)}</span>
                  <span>{o.lineCount}</span>
                  <span>
                    <OrderStatusBadge status={o.status} />
                  </span>
                  <span className="ka-amount">
                    {o.lineCount > 0 && o.onRequestLinesCount >= o.lineCount ? "Iznos još nije utvrđen" : srMoney(String(o.grossTotal), o.currency)}
                    {o.priceListKind === "demo" ? <small>demo cene</small> : null}
                    {o.onRequestLinesCount && o.onRequestLinesCount < o.lineCount ? <small>bez stavki na upit</small> : null}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      )}
      <LiveRefresh endpoint="/api/kupac/zahtevi/stanje" stamp={stamp} what="Spisak zahteva" />
    </section>
  );
}
