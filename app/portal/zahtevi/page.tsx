import Link from "next/link";
import { countOf, STAVKA } from "@/lib/ordering/plural.mjs";
import { srDateTime, srMoney } from "@/components/customer/account-format";
import { OrderStatusBadge } from "@/components/ordering/OrderStatusBadge";
import { PageHeader } from "@/components/portal/PortalPrimitives";
import { can } from "@/lib/authz/permissions.mjs";
import { requireCapability } from "@/lib/authz/session";
import { listOrderRequests, loadOrderingMode } from "@/lib/ordering/ordering-service";
import { trialOverview } from "@/lib/ordering/trial-service";
import { trialCustomerIds } from "@/lib/ordering/trial";
import { TrialPanel } from "./TrialPanel";

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
  const [rows, mode, trialIds] = await Promise.all([listOrderRequests(user, null, q), loadOrderingMode(), trialCustomerIds()]);
  const allCustomers = process.env.CUSTOMER_ORDERING === "cenovnik";
  const canReview = can(user, "customer_orders:review");
  const isOwner = can(user, "customer_accounts:manage") && can(user, "prices:approve");
  const trials = isOwner ? await trialOverview() : [];

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
        <button type="submit" className="portal-button" data-variant="secondary">Tražite</button>
        {q ? <Link href="/portal/zahtevi">Poništite</Link> : null}
      </form>
      <section className="portal-panel">
        {allCustomers ? (
          <div className="kk-pricelist" data-kind="real">
            <strong>Poručivanje je uključeno za kupce sa nalogom</strong>
            <span>Cene iz cenovnika i odobrenih uslova kupca. Potvrđenu porudžbinu unosite u BizniSoft ručno.</span>
          </div>
        ) : trialIds.length ? (
          <div className="kk-pricelist" data-kind="trial">
            <strong>Kontrolisana proba</strong>
            <span>
              Zahtev mogu da pošalju samo izdvojeni test kupci ({trialIds.length}). Za stvarne kupce poručivanje preko
              sajta još nije uključeno.
            </span>
          </div>
        ) : mode.enabled ? (
          <div className="kk-pricelist" data-kind={mode.priceList?.kind ?? "off"}>
            <strong>DEMO poručivanje · {mode.priceList.name}</strong>
            <span>Izmišljeni cenovnik i izmišljeni kupci. Nijedan zahtev ne ide u BizniSoft.</span>
          </div>
        ) : (
          <div className="kk-pricelist" data-kind="off">
            <strong>Poručivanje preko sajta još nije uključeno</strong>
            <span>Kupci porudžbine i dalje šalju svom komercijalisti.</span>
          </div>
        )}
      </section>
      {isOwner ? (
        <section className="portal-panel">
          <div className="portal-section-header"><div><h2>Kontrolisana proba</h2></div></div>
          <TrialPanel trials={trials} />
        </section>
      ) : null}
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
                            {o.orderNumber ? `zahtev ${o.requestNumber}` : countOf(o.lineCount, STAVKA)}
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
                          {o.onRequestLinesCount ? <small>+ {countOf(o.onRequestLinesCount, STAVKA)} na upit</small> : null}
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
