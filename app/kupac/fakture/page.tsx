import Link from "next/link";
import { DOCUMENT_KIND_LABELS, srDate, srMoney } from "@/components/customer/account-format";
import { requireCustomerSession } from "@/lib/authz/customer-session";
import {
  loadCustomerInvoices,
  loadCustomerOverview,
  normalizeInvoiceFilter,
} from "@/lib/customers/customer-queries";
import { loadDatasetInfo } from "@/lib/data-state/dataset";

export const dynamic = "force-dynamic";

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
    <section className="portal-panel">
      <div className="portal-section-header">
        <div>
          <h2>Fakture</h2>
          <p>
            Dokumenti koje je Carsystem i R-M izdao vašoj firmi.{" "}
            {dataset.kind === "demo" ? "U ovom demou su izmišljene." : "Preuzete iz BizniSoft knjigovodstva."}{" "}
            Porudžbine su posebna celina.
          </p>
        </div>
      </div>
      <form className="ka-filters" method="get">
        <label>
          <span>Pretraga</span>
          <input type="search" name="q" defaultValue={filter.q ?? ""} placeholder="Broj fakture, šifra ili naziv artikla" />
        </label>
        <label>
          <span>Od</span>
          <input type="date" name="od" defaultValue={filter.from ?? ""} />
        </label>
        <label>
          <span>Do</span>
          <input type="date" name="do" defaultValue={filter.to ?? ""} />
        </label>
        <div className="ka-filter-actions">
          <button type="submit" className="portal-button" data-variant="primary">Prikaži</button>
          {filtered ? <Link href="/kupac/fakture" className="portal-button" data-variant="ghost">Poništi</Link> : null}
        </div>
      </form>

      <div className="portal-panel-body">
        <p className="ka-count">
          {result.total === 0
            ? filtered
              ? "Nijedna faktura ne odgovara pretrazi."
              : "Za vašu firmu još nema uvezenih faktura."
            : `${result.total} ${result.total === 1 ? "faktura" : "faktura"}${filtered ? " odgovara pretrazi" : ""} · strana ${result.page} od ${pages}`}
        </p>
        {result.rows.length ? (
          <ul className="ka-invoices">
            <li className="ka-invoices-head" aria-hidden="true">
              <span>Broj</span><span>Datum</span><span>Vrsta</span><span>Stavki</span><span>Iznos</span>
            </li>
            {result.rows.map((r) => (
              <li key={r.id}>
                <Link href={`/kupac/fakture/${r.id}`}>
                  <span className="ka-inv-number">{r.number}/{r.year}</span>
                  <span>{srDate(r.issuedOn)}</span>
                  <span>{DOCUMENT_KIND_LABELS[r.documentKind] ?? r.documentKind}</span>
                  <span>{r.lineCount} {r.lineCount === 1 ? "stavka" : "stavki"}</span>
                  <span className="ka-amount">{srMoney(r.totalAmount, r.currency)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
        {pages > 1 ? (
          <nav className="ka-pages" aria-label="Strane">
            {result.page > 1 ? <Link href={`/kupac/fakture${qs(result.page - 1)}`}>← Novije</Link> : <span />}
            <span>{result.page} / {pages}</span>
            {result.page < pages ? <Link href={`/kupac/fakture${qs(result.page + 1)}`}>Starije →</Link> : <span />}
          </nav>
        ) : null}
        <p className="portal-footnote">
          Iznosi su sa izdatih faktura (sa PDV-om). Nisu važeće cene u katalogu.
          {overview?.lastIssuedOn ? ` Poslednja faktura: ${srDate(overview.lastIssuedOn)}.` : ""}
        </p>
      </div>
    </section>
  );
}
