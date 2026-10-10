import { DateRangeField } from "@/components/portal/DateRangeField";
import Link from "next/link";
import { DOCUMENT_KIND_LABELS } from "@/components/customer/account-format";
import { ScrollTable } from "@/components/ordering/ScrollTable";
import { requireCustomerSession } from "@/lib/authz/customer-session";
import {
  loadCustomerInvoices,
  loadCustomerOverview,
  normalizeInvoiceFilter,
} from "@/lib/customers/customer-queries";
import { loadDatasetInfo } from "@/lib/data-state/dataset";
import { countOf } from "@/lib/ordering/plural.mjs";
import { dmy, money } from "@/lib/ordering/panelFormat.mjs";

export const dynamic = "force-dynamic";

const FAKTURA = ["faktura", "fakture", "faktura"];

/*
 * Parametri iz adrese su ISKLJUČIVO filteri (pretraga, datumi, strana).
 * Firma se uzima samo iz sesije i nijedan parametar je ne može promeniti.
 */
export default async function CustomerInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; od?: string; do?: string; strana?: string }>;
}) {
  const session = await requireCustomerSession("/kupac/fakture");
  const filter = normalizeInvoiceFilter(await searchParams);
  const [result, overview, dataset] = await Promise.all([
    loadCustomerInvoices(session.customerId, filter),
    loadCustomerOverview(session.customerId),
    loadDatasetInfo(),
  ]);
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const filtered = Boolean(filter.q || filter.from || filter.to);
  const qs = (page: number) => {
    const p = new URLSearchParams();
    if (filter.q) p.set("q", filter.q);
    if (filter.from) p.set("od", filter.from);
    if (filter.to) p.set("do", filter.to);
    if (page > 1) p.set("strana", String(page));
    const s = p.toString();
    return s ? `?${s}` : "";
  };

  return (
    <div className="pn">
      <header className="pn-head">
        <div>
          <h1 className="pn-title">Fakture</h1>
          <p className="pn-lead">
            Dokumenti koje je Carsystem i R-M izdao Vašoj firmi{dataset.kind === "demo" ? " (u ovom demou izmišljeni)" : ", preuzeti iz BizniSoft knjigovodstva"}. Zahtevi i
            porudžbine su poseban odeljak.
          </p>
        </div>
      </header>

      <form className="pn-card" method="get" role="search">
        <div className="pn-filters">
          <div className="pn-field">
            <label htmlFor="fakture-q">Pretraga</label>
            <input id="fakture-q" type="search" name="q" defaultValue={filter.q ?? ""} placeholder="Broj fakture, šifra ili naziv artikla" />
          </div>
          <DateRangeField nameOd="od" nameDo="do" defaultOd={filter.from} defaultDo={filter.to} />
          <div className="pn-inline">
            <button type="submit" className="pn-btn" data-variant="primary">
              Prikažite
            </button>
            {filtered ? (
              <Link href="/kupac/fakture" className="pn-btn" data-variant="quiet">
                Poništite filtere
              </Link>
            ) : null}
          </div>
        </div>
      </form>

      <section className="pn-card pn-card-flush" aria-labelledby="fakture-lista">
        <div className="pn-card-h">
          <h2 id="fakture-lista">
            {result.total === 0 ? "Nema faktura" : countOf(result.total, FAKTURA)}
            {filtered && result.total ? " odgovara pretrazi" : ""}
          </h2>
          {pages > 1 ? (
            <span className="pn-small pn-muted">
              Strana {result.page} od {pages}
            </span>
          ) : null}
        </div>
        {result.rows.length ? (
          <ScrollTable label="Fakture">
            <table className="pn-table pn-table-cards">
              <thead>
                <tr>
                  <th scope="col">Broj</th>
                  <th scope="col">Datum</th>
                  <th scope="col">Vrsta</th>
                  <th scope="col" className="pn-r">
                    Stavki
                  </th>
                  <th scope="col" className="pn-r">
                    Iznos <span className="pn-th-sub">sa PDV-om</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r) => (
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
                    <td className="pn-r pn-num" data-label="Stavki">
                      {r.lineCount}
                    </td>
                    <td className="pn-r pn-num pn-strong" data-label="Iznos sa PDV-om">
                      {money(r.totalAmount, r.currency ?? "RSD")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollTable>
        ) : (
          <div className="pn-empty">
            <strong>{filtered ? "Nijedna faktura ne odgovara pretrazi." : "Za Vašu firmu još nema uvezenih faktura."}</strong>
            {filtered ? <p>Proširite period ili pretražite po broju fakture ili šifri artikla.</p> : null}
          </div>
        )}
        {pages > 1 ? (
          <nav className="pn-pages" aria-label="Strane">
            {result.page > 1 ? (
              <Link href={`/kupac/fakture${qs(result.page - 1)}`} className="pn-btn" data-size="sm">
                ← Novije
              </Link>
            ) : (
              <span />
            )}
            <span className="pn-muted">
              {result.page} / {pages}
            </span>
            {result.page < pages ? (
              <Link href={`/kupac/fakture${qs(result.page + 1)}`} className="pn-btn" data-size="sm">
                Starije →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        ) : null}
        <p className="pn-card-foot">
          Iznosi su sa izdatih faktura (sa PDV-om), nisu važeće cene.
          {overview?.lastIssuedOn ? ` Poslednja faktura: ${dmy(overview.lastIssuedOn)}.` : ""}
        </p>
      </section>
    </div>
  );
}
