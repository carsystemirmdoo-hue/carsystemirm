import Link from "next/link";
import { DOCUMENT_KIND_LABELS } from "@/components/customer/account-format";
import { OrderStatusBadge } from "@/components/ordering/OrderStatusBadge";
import { requireCustomerSession } from "@/lib/authz/customer-session";
import { companyContact } from "@/lib/company-contact";
import { loadCustomerInvoices, loadCustomerOverview } from "@/lib/customers/customer-queries";
import { loadDatasetInfo } from "@/lib/data-state/dataset";
import { listCustomerOrders } from "@/lib/ordering/ordering-service";
import { orderingEnabledFor } from "@/lib/ordering/trial";
import { dmy, dmyTime, money } from "@/lib/ordering/panelFormat.mjs";

export const dynamic = "force-dynamic";

/*
 * Nijedan podatak ne dolazi iz adrese. `customerId` je isključivo iz sesije, i
 * strana namerno nema parametre (lib/authz/customerIsolation.test.mjs).
 */
export default async function CustomerHomePage() {
  const session = await requireCustomerSession("/kupac");
  const ordering = await orderingEnabledFor(session.customerId);
  const [overview, recent, dataset, orders] = await Promise.all([
    loadCustomerOverview(session.customerId),
    loadCustomerInvoices(session.customerId, { page: 1 }),
    loadDatasetInfo(),
    listCustomerOrders(session.customerId),
  ]);
  const demo = dataset.kind === "demo";
  const waiting = orders.filter((o) => o.status === "awaiting_customer" || o.status === "changes_requested");

  return (
    <div className="pn">
      <h1 className="pn-title">Pregled naloga</h1>

      {waiting.length ? (
        <div className="pn-note" data-tone="warning" role="status">
          <div className="pn-note-row">
            <span>
              <strong>
                {waiting.length === 1 ? "Jedan zahtev čeka Vaš odgovor" : `${waiting.length} zahteva čekaju Vaš odgovor`}
              </strong>{" "}
              — izmenjen predlog kancelarije ili tražena izmena.
            </span>
            <Link href={waiting.length === 1 ? `/kupac/porudzbine/${waiting[0].id}` : "/kupac/porudzbine"} className="pn-btn" data-size="sm">
              {waiting.length === 1 ? `Otvorite ${waiting[0].requestNumber}` : "Otvorite zahteve"}
            </Link>
          </div>
        </div>
      ) : null}

      <div className="pn-split" style={{ alignItems: "start" }}>
        <div className="pn" style={{ alignContent: "start" }}>
          {ordering ? (
            <section className="pn-card pn-card-flush" aria-labelledby="pregled-zahtevi">
              <div className="pn-card-h">
                <h2 id="pregled-zahtevi">Poslednji zahtevi i porudžbine</h2>
                <Link href="/kupac/porudzbine" className="pn-small">
                  Svi zahtevi →
                </Link>
              </div>
              {orders.length ? (
                <table className="pn-table pn-table-cards">
                  <thead>
                    <tr>
                      <th scope="col">Broj</th>
                      <th scope="col">Poslato</th>
                      <th scope="col">Stanje</th>
                      <th scope="col" className="pn-r">
                        Ukupno sa PDV-om
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.slice(0, 5).map((o) => (
                      <tr key={o.id}>
                        <td className="pn-c-name">
                          <Link href={`/kupac/porudzbine/${o.id}`} className="pn-row-link pn-num">
                            {o.orderNumber ?? o.requestNumber}
                          </Link>
                        </td>
                        <td className="pn-num" data-label="Poslato">
                          {dmyTime(o.submittedAt)}
                        </td>
                        <td data-label="Stanje">
                          <OrderStatusBadge status={o.status} audience="customer" />
                        </td>
                        <td className="pn-r" data-label="Ukupno sa PDV-om">
                          {o.lineCount > 0 && o.onRequestLinesCount >= o.lineCount ? (
                            <span className="pn-muted">Iznos još nije utvrđen</span>
                          ) : (
                            <>
                              <span className="pn-num">{money(o.grossTotal, o.currency)}</span>
                              {o.onRequestLinesCount ? <span className="pn-sub">nije konačno — ima stavki na upit</span> : null}
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="pn-empty">
                  <strong>Još nema poslatih zahteva.</strong>
                  <p>Robu birate u odeljku „Izbor robe“, a zahtev šaljete iz korpe. Zahtev postaje porudžbina tek kada ga kancelarija potvrdi.</p>
                  <Link href="/kupac/naruci" className="pn-btn" data-variant="primary">
                    Izbor robe
                  </Link>
                </div>
              )}
            </section>
          ) : null}

          <section className="pn-card pn-card-flush" aria-labelledby="pregled-fakture">
            <div className="pn-card-h">
              <h2 id="pregled-fakture">Poslednje fakture</h2>
              {overview && overview.invoices > 0 ? (
                <Link href="/kupac/fakture" className="pn-small">
                  Sve fakture i pretraga →
                </Link>
              ) : null}
            </div>
            {overview && overview.invoices > 0 ? (
              <table className="pn-table pn-table-cards">
                <thead>
                  <tr>
                    <th scope="col">Broj</th>
                    <th scope="col">Datum</th>
                    <th scope="col">Vrsta</th>
                    <th scope="col" className="pn-r">
                      Iznos sa PDV-om
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recent.rows.slice(0, 5).map((r) => (
                    <tr key={r.id}>
                      <td className="pn-c-name">
                        <Link href={`/kupac/fakture/${r.id}`} className="pn-row-link pn-num">
                          {r.number}/{r.year}
                        </Link>
                        {r.reversed ? <span className="pn-tag" data-tone="neutral">stornirano</span> : null}
                      </td>
                      <td className="pn-num" data-label="Datum">
                        {dmy(r.issuedOn)}
                      </td>
                      <td data-label="Vrsta">{DOCUMENT_KIND_LABELS[r.documentKind] ?? r.documentKind}</td>
                      <td className="pn-r pn-num" data-label="Iznos sa PDV-om">
                        {money(r.totalAmount, r.currency ?? "RSD")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="pn-empty">
                <strong>Za Vašu firmu još nema uvezenih faktura.</strong>
              </div>
            )}
            <p className="pn-card-foot">
              {demo
                ? "Poreklo: lokalni demo — izmišljene fakture, nisu iz knjigovodstva."
                : `Fakture iz BizniSoft knjigovodstva, uvezene u portal. Poslednji uvoz: ${dmyTime(overview?.lastIngestedAt ?? null)}.`}
            </p>
          </section>
        </div>

        <aside className="pn-side">
          <section className="pn-card" aria-labelledby="pregled-firma">
            <h2 id="pregled-firma" className="pn-h2">
              Firma
            </h2>
            <dl className="pn-facts pn-facts-stack">
              <div>
                <dt>Naziv</dt>
                <dd>{overview?.name}</dd>
              </div>
              <div>
                <dt>PIB</dt>
                <dd className="pn-num">{overview?.pib}</dd>
              </div>
              <div>
                <dt>Mesto</dt>
                <dd>{overview?.city ?? "—"}</dd>
              </div>
              <div>
                <dt>Vaš komercijalista</dt>
                <dd>{overview?.reps.length ? overview.reps.join(", ") : "—"}</dd>
              </div>
              {overview && overview.invoices > 0 ? (
                <div>
                  <dt>Fakture</dt>
                  <dd>
                    {overview.invoices}
                    <small>
                      od {dmy(overview.firstIssuedOn)} do {dmy(overview.lastIssuedOn)}
                    </small>
                  </dd>
                </div>
              ) : null}
            </dl>
          </section>
          <section className="pn-card" aria-labelledby="pregled-kancelarija">
            <h2 id="pregled-kancelarija" className="pn-h2">
              Kancelarija
            </h2>
            <p className="pn-small">
              {ordering
                ? "Pitanja o zahtevu, isporuci ili ceni:"
                : "Poručivanje kroz nalog još nije uključeno. Porudžbine i dalje šaljete svom komercijalisti ili kancelariji:"}
            </p>
            <p className="pn-small">
              {companyContact.phone && companyContact.phoneHref ? (
                <>
                  <a href={companyContact.phoneHref}>{companyContact.phone}</a>
                  <br />
                </>
              ) : null}
              <a href={companyContact.emailHref}>{companyContact.email}</a>
              {companyContact.workingHours ? (
                <>
                  <br />
                  <span className="pn-muted">{companyContact.workingHours}</span>
                </>
              ) : null}
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
