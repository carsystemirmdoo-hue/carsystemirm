import Link from "next/link";
import { srDateTime } from "@/components/customer/account-format";
import { PageHeader } from "@/components/portal/PortalPrimitives";
import { can } from "@/lib/authz/permissions.mjs";
import { requireCapability } from "@/lib/authz/session";
import {
  listPriceRequests,
  PRICE_REQUEST_KIND_LABELS,
  PRICE_REQUEST_STATUS_LABELS,
} from "@/lib/ordering/price-request-service";
import { PriceRequestActions } from "./PriceRequestActions";

export const dynamic = "force-dynamic";

const qfmt = new Intl.NumberFormat("sr-Latn-RS", { maximumFractionDigits: 3 });

/**
 * Radna lista: zahtevi kupaca za cenu ili posebne uslove. Kancelarija vidi sve,
 * komercijalista samo svoje kupce. Odgovor je tekst za kupca; cena se menja tek
 * kad uslov stigne iz BizniSofta u cenovnik.
 */
export default async function PriceRequestsPage() {
  const user = await requireCapability("view:zahtevi", "/portal/zahtevi/uslovi");
  const rows = await listPriceRequests(user);
  const canHandle = can(user, "price_requests:handle");
  const open = rows.filter((r) => r.status === "open" || r.status === "in_progress");
  const done = rows.filter((r) => r.status === "answered" || r.status === "closed");

  return (
    <>
      <PageHeader
        eyebrow="Prodaja"
        title="Cena i uslovi — zahtevi kupaca"
        description="Kupac je tražio cenu za proizvod bez cene ili posebne uslove. Odgovorite mu ovde; dogovoren uslov unesite u BizniSoft, a u korpi važi tek kada stigne sa izvozom cenovnika."
      />
      <nav className="kk-subnav" aria-label="Zahtevi kupaca">
        <Link href="/portal/zahtevi">Porudžbine</Link>
        <Link href="/portal/zahtevi/uslovi" aria-current="page">
          Cena i uslovi ({open.length})
        </Link>
      </nav>
      {[
        { key: "open", title: "Otvoreni", list: open },
        { key: "done", title: "Odgovoreni i zatvoreni", list: done },
      ].map((g) => (
        <section key={g.key} className="portal-panel">
          <div className="portal-section-header">
            <div>
              <h2>
                {g.title} · {g.list.length}
              </h2>
            </div>
          </div>
          <div className="portal-panel-body">
            {g.list.length === 0 ? (
              <p>Nema zahteva.</p>
            ) : (
              <ol className="kk-requests">
                {g.list.map((r) => (
                  <li key={r.id}>
                    <div className="kk-request-head">
                      <strong>{r.requestNumber}</strong>
                      <span className="kk-status" data-tone={r.status === "answered" ? "success" : r.status === "closed" ? "neutral" : "info"}>
                        {PRICE_REQUEST_STATUS_LABELS[r.status] ?? r.status}
                      </span>
                      <span className="kk-status" data-tone="warning">{PRICE_REQUEST_KIND_LABELS[r.kind] ?? r.kind}</span>
                      <small>{srDateTime(r.createdAt)}</small>
                    </div>
                    <p>
                      <Link href={`/portal/kupci/${r.customerId}`}>
                        <strong>{r.customerName}</strong>
                      </Link>{" "}
                      · {r.requestedByName} · komercijalista: {r.reps.length ? r.reps.join(", ") : "nije dodeljen"}
                    </p>
                    <p>
                      <Link href={`/proizvodi/${r.slug}`}>{r.catalogName}</Link>
                      {r.variantLabel ? ` · varijanta ${r.variantLabel}` : ""}
                      {r.articleCode ? ` · BizniSoft ${r.articleCode} — ${r.articleName}` : " · bez BizniSoft veze"} · količina {qfmt.format(r.quantity)}
                    </p>
                    {r.customerNote ? <p className="kk-fine">Napomena kupca: {r.customerNote}</p> : null}
                    {r.answer ? (
                      <p className="kk-answer">
                        <strong>Odgovor ({r.handledByName}):</strong> {r.answer}
                      </p>
                    ) : null}
                    {canHandle && r.status !== "closed" ? <PriceRequestActions id={r.id} status={r.status} /> : null}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>
      ))}
    </>
  );
}
