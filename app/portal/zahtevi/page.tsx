import Link from "next/link";
import { srDateTime, srMoney } from "@/components/customer/account-format";
import { OrderStatusBadge } from "@/components/ordering/OrderStatusBadge";
import { PageHeader } from "@/components/portal/PortalPrimitives";
import { can } from "@/lib/authz/permissions.mjs";
import { requireCapability } from "@/lib/authz/session";
import { listOrderRequests, loadOrderingMode } from "@/lib/ordering/ordering-service";

export const dynamic = "force-dynamic";

const GROUPS = [
  { key: "new", title: "Novi — čekaju prijem", statuses: ["submitted"] },
  { key: "review", title: "U obradi", statuses: ["under_review"] },
  { key: "waiting", title: "Čeka se kupac", statuses: ["changes_requested", "awaiting_customer"] },
  { key: "confirmed", title: "Potvrđene porudžbine", statuses: ["confirmed"] },
  { key: "closed", title: "Odbijeni, otkazani i vraćeni na ispravku", statuses: ["rejected", "cancelled", "superseded"] },
];

export default async function OrderRequestsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireCapability("view:zahtevi", "/portal/zahtevi");
  const q = ((await searchParams).q ?? "").trim().slice(0, 80);
  const [rows, mode] = await Promise.all([listOrderRequests(user, null, q), loadOrderingMode()]);
  const canReview = can(user, "customer_orders:review");

  return (
    <>
      <PageHeader
        eyebrow="Prodaja"
        title="Zahtevi kupaca"
        description={
          canReview
            ? "Zahtevi koje kupci šalju iz korpe na sajtu. Zahtev postaje porudžbina tek Vašom potvrdom; potvrđenu porudžbinu u pilotu ručno unosite u BizniSoft i upisujete broj dokumenta."
            : "Zahtevi Vaših kupaca, samo za pregled. Prijem i potvrdu radi kancelarija."
        }
      />
      <nav className="kk-subnav" aria-label="Zahtevi kupaca">
        <Link href="/portal/zahtevi" aria-current="page">Porudžbine</Link>
        <Link href="/portal/zahtevi/uslovi">Cena i uslovi</Link>
      </nav>
      <form method="get" className="kk-search" role="search">
        <input
          type="search"
          name="q"
          defaultValue={q}
          maxLength={80}
          placeholder="Broj zahteva, kupac, BizniSoft šifra ili naziv artikla, kataloški naziv"
          aria-label="Pretraga zahteva"
        />
        <button type="submit" className="portal-button" data-variant="secondary">Traži</button>
        {q ? <Link href="/portal/zahtevi">Poništite</Link> : null}
      </form>
      <section className="portal-panel">
        <div className="kk-pricelist" data-kind={mode.priceList?.kind ?? "off"}>
          <strong>
            {mode.enabled ? `DEMO poručivanje · ${mode.priceList.name}` : "Poručivanje sa sajta nije uključeno"}
          </strong>
          <span>
            {mode.enabled
              ? "Izmišljeni cenovnik i izmišljeni kupci. Nijedan zahtev ne ide u BizniSoft."
              : mode.reason}
          </span>
        </div>
      </section>
      {GROUPS.map((g) => {
        const list = rows.filter((r) => g.statuses.includes(r.status));
        if (list.length === 0 && (g.key !== "new" || q)) return null;
        return (
          <section key={g.key} className="portal-panel">
            <div className="portal-section-header">
              <div>
                <h2>
                  {g.title} · {list.length}
                </h2>
              </div>
            </div>
            {list.length === 0 ? (
              <div className="portal-panel-body">
                <p>Nema novih zahteva.</p>
              </div>
            ) : (
              <div className="portal-panel-body">
                <ol className="ka-invoices kk-orders kk-orders-office">
                  <li className="ka-invoices-head" aria-hidden="true">
                    <span>Broj</span>
                    <span>Kupac</span>
                    <span>Poslato</span>
                    <span>Status</span>
                    <span>Ukupno sa PDV-om</span>
                  </li>
                  {list.map((o) => (
                    <li key={o.id}>
                      <Link href={`/portal/zahtevi/${o.id}`}>
                        <span className="ka-inv-number">
                          {o.orderNumber ?? o.requestNumber}
                          <small>
                            {o.orderNumber ? `zahtev ${o.requestNumber}` : `${o.lineCount} stavki`}
                            {o.replacesNumber ? ` · ispravka ${o.replacesNumber}` : ""}
                            {o.revisionNo > 1 ? ` · verzija ${o.revisionNo}` : ""}
                          </small>
                        </span>
                        <span>
                          {o.customerName}
                          {o.paymentOptionLabel ? <small>{o.paymentOptionLabel}</small> : null}
                        </span>
                        <span>{srDateTime(o.submittedAt)}</span>
                        <span>
                          <OrderStatusBadge status={o.status} />
                        </span>
                        <span className="ka-amount">
                          {srMoney(String(o.grossTotal), o.currency)}
                          {o.priceListKind === "demo" ? <small>demo cene</small> : null}
                          {o.onRequestLinesCount ? <small>+ {o.onRequestLinesCount} na upit</small> : null}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </section>
        );
      })}
    </>
  );
}
