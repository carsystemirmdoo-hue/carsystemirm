import Link from "next/link";
import { srDate, srDateTime, DOCUMENT_KIND_LABELS, srMoney } from "@/components/customer/account-format";
import { requireCustomerSession } from "@/lib/authz/customer-session";
import { companyContact } from "@/lib/company-contact";
import { loadCustomerInvoices, loadCustomerOverview } from "@/lib/customers/customer-queries";
import { loadDatasetInfo } from "@/lib/data-state/dataset";
import { orderingEnabledFor } from "@/lib/ordering/trial";

export const dynamic = "force-dynamic";

/*
 * Nijedan podatak ne dolazi iz adrese. `customerId` je isključivo iz sesije, i
 * strana namerno nema parametre (lib/authz/customerIsolation.test.mjs).
 */
export default async function CustomerHomePage() {
  const session = await requireCustomerSession("/kupac");
  const ordering = await orderingEnabledFor(session.customerId);
  const [overview, recent, dataset] = await Promise.all([
    loadCustomerOverview(session.customerId),
    loadCustomerInvoices(session.customerId, { page: 1 }),
    loadDatasetInfo(),
  ]);
  const demo = dataset.kind === "demo";

  return (
    <div className="ka-grid">
      <section className="portal-panel">
        <h2>Firma</h2>
        <dl className="ka-facts">
          <div><dt>Naziv</dt><dd>{overview?.name}</dd></div>
          <div><dt>PIB</dt><dd>{overview?.pib}</dd></div>
          <div><dt>Mesto</dt><dd>{overview?.city ?? "—"}</dd></div>
          <div><dt>Vaš komercijalista</dt><dd>{overview?.reps.length ? overview.reps.join(", ") : "—"}</dd></div>
        </dl>
      </section>

      <section className="portal-panel">
        <h2>Fakture</h2>
        {overview && overview.invoices > 0 ? (
          <>
            <dl className="ka-facts">
              <div><dt>Ukupno</dt><dd>{overview.invoices}</dd></div>
              <div><dt>Poslednja</dt><dd>{srDate(overview.lastIssuedOn)}</dd></div>
              <div><dt>Prva</dt><dd>{srDate(overview.firstIssuedOn)}</dd></div>
            </dl>
            <ul className="ka-recent">
              {recent.rows.slice(0, 5).map((r) => (
                <li key={r.id}>
                  <Link href={`/kupac/fakture/${r.id}`}>
                    <strong>{r.number}/{r.year}</strong>
                    <span>{srDate(r.issuedOn)} · {DOCUMENT_KIND_LABELS[r.documentKind] ?? r.documentKind}{r.reversed ? " · stornirano" : ""}</span>
                    <span className="ka-amount">{srMoney(r.totalAmount, r.currency)}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link href="/kupac/fakture" className="ka-more">Sve fakture i pretraga →</Link>
          </>
        ) : (
          <p>Za Vašu firmu još nema uvezenih faktura.</p>
        )}
        <p className="portal-footnote">
          {demo
            ? "Poreklo: lokalni demo — izmišljene fakture, nisu iz knjigovodstva."
            : `Poreklo: fakture iz BizniSoft knjigovodstva, uvezene u portal. Poslednji uvoz: ${srDateTime(overview?.lastIngestedAt ?? null)}.`}
        </p>
      </section>

      <section className="portal-panel">
        <h2>Porudžbine</h2>
        {ordering ? (
          <p>
            Robu birate u odeljku <Link href="/kupac/naruci">Izbor robe</Link>, a zahtev šaljete iz{" "}
            <Link href="/kupac/korpa">korpe</Link>. Zahtev postaje porudžbina tek kada ga kancelarija potvrdi.
          </p>
        ) : (
          <p>
            Poručivanje kroz nalog još nije uključeno. Porudžbine i dalje šaljete kao do sada — svom
            komercijalisti ili kancelariji.
          </p>
        )}
        <p className="portal-footnote">
          Kancelarija:{" "}
          {companyContact.phone && companyContact.phoneHref ? (
            <>
              <a href={companyContact.phoneHref}>{companyContact.phone}</a> ·{" "}
            </>
          ) : null}
          <a href={companyContact.emailHref}>{companyContact.email}</a>
          {companyContact.workingHours ? <> · {companyContact.workingHours}</> : null}
        </p>
        <Link href="/kupac/porudzbine" className="ka-more">Šta se ovde prikazuje →</Link>
      </section>
    </div>
  );
}
