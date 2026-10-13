import type { Metadata } from "next";
import { requireCustomerSession } from "@/lib/authz/customer-session";
import { companyContact } from "@/lib/company-contact";
import { loadCustomerCompany } from "@/lib/customers/customer-queries";
import { loadCustomerContacts } from "@/lib/ordering/ordering-service";
import { approvedPaymentOptions } from "@/lib/pricing/payment-option-service";
import { optionLabel, optionNote } from "@/lib/pricing/paymentOptions.mjs";
import { belgradeDate } from "@/lib/recommendations/customerRhythm.mjs";

export const metadata: Metadata = {
  title: "Podaci firme · Carsystem i R-M",
  robots: { index: false, follow: false, noarchive: true },
};

export const dynamic = "force-dynamic";

/**
 * Podaci firme kupca (dok. 61 K5): firma, nalog, komercijalista i odobrene
 * opcije plaćanja. Samo čitanje; firma isključivo iz sesije, strana ne prima
 * parametre. Izmene ide preko komercijaliste ili kancelarije.
 */
export default async function CustomerCompanyPage() {
  const session = await requireCustomerSession("/kupac/firma");
  const [firm, contacts, options] = await Promise.all([
    loadCustomerCompany(session.customerId),
    loadCustomerContacts(session.customerId),
    approvedPaymentOptions(session.customerId, belgradeDate(new Date())),
  ]);

  return (
    <div className="pn">
      <header className="pn-head">
        <div>
          <h1 className="pn-title">Podaci firme</h1>
          <p className="pn-lead">Podaci kako ih vodi Carsystem i R-M. Za izmenu se javite svom komercijalisti ili kancelariji.</p>
        </div>
      </header>
      <div className="pn-split">
        <section className="pn-card" aria-labelledby="firma-naslov">
          <h2 id="firma-naslov" className="pn-h2">Firma</h2>
          <dl className="pn-facts">
            <div>
              <dt>Naziv</dt>
              <dd>{firm?.name ?? session.customerName}</dd>
            </div>
            <div>
              <dt>PIB</dt>
              <dd className="pn-num">{firm?.pib ?? "—"}</dd>
            </div>
            <div>
              <dt>Mesto</dt>
              <dd>{firm?.city ?? "—"}</dd>
            </div>
            <div>
              <dt>Vaš nalog</dt>
              <dd>
                {session.name}
                <small>{session.email}</small>
              </dd>
            </div>
          </dl>
        </section>
        <section className="pn-card" aria-labelledby="uslovi-naslov">
          <h2 id="uslovi-naslov" className="pn-h2">Plaćanje i kontakt</h2>
          <dl className="pn-facts">
            <div>
              <dt>Odobrene opcije plaćanja</dt>
              <dd>
                {options.length
                  ? options.map((o) => (
                      <span key={o} style={{ display: "block" }}>
                        {optionLabel(o)}
                        {optionNote(o) ? <small> · {optionNote(o)}</small> : null}
                      </span>
                    ))
                  : "po dogovoru sa kancelarijom"}
              </dd>
            </div>
            <div>
              <dt>Komercijalista</dt>
              <dd>
                {contacts.reps.length
                  ? contacts.reps.map((r) => (
                      <span key={r.email} style={{ display: "block" }}>
                        {r.name} · <a href={`mailto:${r.email}`}>{r.email}</a>
                      </span>
                    ))
                  : "nije dodeljen"}
              </dd>
            </div>
            <div>
              <dt>Kancelarija</dt>
              <dd>
                {companyContact.phone ? <span style={{ display: "block" }}>{companyContact.phone}</span> : null}
                <a href={companyContact.emailHref}>{companyContact.email}</a>
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
