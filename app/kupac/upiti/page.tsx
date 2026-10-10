import { publicSiteOpen } from "@/lib/site-mode";
import Link from "next/link";
import { dmyTime } from "@/lib/ordering/panelFormat.mjs";
import { requireCustomerSession } from "@/lib/authz/customer-session";
import { companyContact } from "@/lib/company-contact";
import { loadCustomerContacts } from "@/lib/ordering/ordering-service";
import {
  listCustomerPriceRequests,
  PRICE_REQUEST_KIND_LABELS,
  PRICE_REQUEST_STATUS_LABELS,
} from "@/lib/ordering/price-request-service";

export const dynamic = "force-dynamic";

const qfmt = new Intl.NumberFormat("sr-Latn-RS", { maximumFractionDigits: 3 });

/** Upiti za cenu i posebne uslove firme iz sesije, sa odgovorom kancelarije/komercijaliste. */
export default async function CustomerPriceRequestsPage() {
  const session = await requireCustomerSession("/kupac/upiti");
  const [rows, contacts] = await Promise.all([
    listCustomerPriceRequests(session.customerId),
    loadCustomerContacts(session.customerId),
  ]);
  return (
    <div className="pn">
      <header className="pn-head">
        <div>
          <h1 className="pn-title">Upiti za cenu i uslove</h1>
          <p className="pn-lead">
            Za proizvode bez određene cene ili za posebne uslove. Odgovara Vaš komercijalista ili kancelarija; odgovor ne menja cenu u korpi dok uslov ne bude
            unet u cenovnik.
          </p>
        </div>
        {publicSiteOpen() ? (
          <Link href="/katalog" className="pn-btn" data-size="sm">
            Katalog →
          </Link>
        ) : null}
      </header>
      <section className="pn-card" aria-label="Kontakt">
        <dl className="pn-facts">
          <div>
            <dt>Vaš komercijalista</dt>
            <dd>
              {contacts.reps.length
                ? contacts.reps.map((r, i) => (
                    <span key={r.email}>
                      {i ? ", " : ""}
                      {r.name} · <a href={`mailto:${r.email}`}>{r.email}</a>
                    </span>
                  ))
                : "nije dodeljen"}
            </dd>
          </div>
          <div>
            <dt>Kancelarija</dt>
            <dd>
              {companyContact.phone && companyContact.phoneHref ? (
                <>
                  <a href={companyContact.phoneHref}>{companyContact.phone}</a> ·{" "}
                </>
              ) : null}
              <a href={companyContact.emailHref}>{companyContact.email}</a>
              {companyContact.workingHours ? <small>{companyContact.workingHours}</small> : null}
            </dd>
          </div>
        </dl>
      </section>
      <section className="pn-card pn-card-flush" aria-labelledby="upiti-lista">
        <div className="pn-card-h">
          <h2 id="upiti-lista">
            Vaši upiti <span className="pn-muted pn-num" style={{ fontWeight: 400 }}>· {rows.length}</span>
          </h2>
        </div>
        {rows.length === 0 ? (
          <div className="pn-empty">
            <strong>Još nema upita.</strong>
            <p>
              {publicSiteOpen()
                ? "Na stranici proizvoda bez cene izaberite „Zatražite cenu/uslove“."
                : "Za cenu ili posebne uslove obratite se komercijalisti ili kancelariji (kontakt iznad)."}
            </p>
          </div>
        ) : (
          <ul className="pn-versions" style={{ padding: 16 }}>
            {rows.map((r) => (
              <li key={r.id} style={{ display: "grid", gap: 6, justifyContent: "stretch" }}>
                <span className="pn-inline" style={{ justifyContent: "space-between" }}>
                  <span className="pn-inline">
                    <strong className="pn-num">{r.requestNumber}</strong>
                    <span className="pn-status" data-tone={r.status === "answered" ? "success" : r.status === "closed" ? "neutral" : "info"}>
                      {PRICE_REQUEST_STATUS_LABELS[r.status] ?? r.status}
                    </span>
                  </span>
                  <span className="pn-small pn-muted pn-num">{dmyTime(r.createdAt)}</span>
                </span>
                <span>
                  {publicSiteOpen() ? <Link href={`/proizvodi/${r.slug}`}>{r.catalogName}</Link> : <strong>{r.catalogName}</strong>}
                  {r.variantLabel ? ` · ${r.variantLabel}` : ""} · količina {qfmt.format(r.quantity)} · {PRICE_REQUEST_KIND_LABELS[r.kind] ?? r.kind}
                </span>
                {r.customerNote ? <span className="pn-small pn-muted">Vaša napomena: {r.customerNote}</span> : null}
                {r.answer ? (
                  <span className="pn-note" data-tone="success">
                    <span>
                      <strong>Odgovor:</strong> {r.answer}
                    </span>
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
