import Link from "next/link";
import { srDateTime } from "@/components/customer/account-format";
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
    <section className="portal-panel">
      <div className="portal-section-header">
        <div>
          <h2>Upiti za cenu i uslove</h2>
          <p>
            Za proizvode bez određene cene ili za posebne uslove. Odgovara Vaš komercijalista ili kancelarija; odgovor nije
            promena cene u korpi dok uslov ne bude unet u cenovnik.
          </p>
        </div>
        <Link href="/katalog" className="portal-section-link">Katalog →</Link>
      </div>
      <div className="kk-contacts">
        <span>
          Komercijalista:{" "}
          {contacts.reps.length
            ? contacts.reps.map((r, i) => (
                <span key={r.email}>
                  {i ? ", " : ""}
                  <strong>{r.name}</strong> (<a href={`mailto:${r.email}`}>{r.email}</a>)
                </span>
              ))
            : "nije dodeljen"}
        </span>
        <span>
          Kancelarija:{" "}
          {companyContact.phone && companyContact.phoneHref ? (
            <>
              <a href={companyContact.phoneHref}>{companyContact.phone}</a> ·{" "}
            </>
          ) : null}
          <a href={companyContact.emailHref}>{companyContact.email}</a>
          {companyContact.workingHours ? <> · {companyContact.workingHours}</> : null}
        </span>
      </div>
      {rows.length === 0 ? (
        <div className="portal-panel-body ka-empty">
          <p>
            <strong>Još nema upita.</strong> Na stranici proizvoda bez cene izaberite „Zatražite cenu/uslove”.
          </p>
        </div>
      ) : (
        <div className="portal-panel-body">
          <ol className="kk-requests">
            {rows.map((r) => (
              <li key={r.id}>
                <div className="kk-request-head">
                  <strong>{r.requestNumber}</strong>
                  <span className="kk-status" data-tone={r.status === "answered" ? "success" : r.status === "closed" ? "neutral" : "info"}>
                    {PRICE_REQUEST_STATUS_LABELS[r.status] ?? r.status}
                  </span>
                  <small>{srDateTime(r.createdAt)}</small>
                </div>
                <p>
                  <Link href={`/proizvodi/${r.slug}`}>{r.catalogName}</Link>
                  {r.variantLabel ? ` · ${r.variantLabel}` : ""} · količina {qfmt.format(r.quantity)} ·{" "}
                  {PRICE_REQUEST_KIND_LABELS[r.kind] ?? r.kind}
                </p>
                {r.customerNote ? <p className="kk-fine">Vaša napomena: {r.customerNote}</p> : null}
                {r.answer ? (
                  <p className="kk-answer">
                    <strong>Odgovor:</strong> {r.answer}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
