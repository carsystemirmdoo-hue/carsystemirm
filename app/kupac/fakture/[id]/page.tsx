import Link from "next/link";
import { notFound } from "next/navigation";
import { DOCUMENT_KIND_LABELS } from "@/components/customer/account-format";
import { ScrollTable } from "@/components/ordering/ScrollTable";
import { requireCustomerSession } from "@/lib/authz/customer-session";
import { loadCustomerInvoice } from "@/lib/customers/customer-queries";
import { ORIGIN_LABELS } from "@/lib/data-state/data-state";
import { loadDatasetInfo } from "@/lib/data-state/dataset";
import { amount, dmy, dmyTime, money, percent, quantity } from "@/lib/ordering/panelFormat.mjs";

export const dynamic = "force-dynamic";

/*
 * ID iz adrese se proverava ZAJEDNO sa firmom iz sesije. Tuđa i nepostojeća
 * faktura daju isti odgovor (404), pa se iz odgovora ne može saznati da tuđa
 * postoji.
 */
export default async function CustomerInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireCustomerSession(`/kupac/fakture/${encodeURIComponent(id)}`);
  const [invoice, dataset] = await Promise.all([
    loadCustomerInvoice(session.customerId, id),
    loadDatasetInfo(),
  ]);
  if (!invoice) notFound();

  const origin =
    dataset.kind === "demo"
      ? "Lokalni demo — izmišljen dokument"
      : ORIGIN_LABELS[invoice.origin as keyof typeof ORIGIN_LABELS] ?? invoice.origin;
  const cur = invoice.currency ?? "RSD";

  return (
    <div className="pn">
      <p className="pn-back">
        <Link href="/kupac/fakture">← Sve fakture</Link>
      </p>
      <header className="pn-head">
        <div>
          <h1 className="pn-title">
            {DOCUMENT_KIND_LABELS[invoice.documentKind] ?? "Dokument"} {invoice.number}/{invoice.year}
          </h1>
          <p className="pn-lead">
            Izdata {dmy(invoice.issuedOn)}
            {invoice.reversed ? " · u potpunosti stornirana" : ""}
          </p>
        </div>
      </header>
      {invoice.reversed ? (
        <p className="pn-note" data-tone="warning">
          <span>Ova faktura je u potpunosti stornirana i ne računa se u kupovinu.</span>
        </p>
      ) : null}
      <div className="pn-split">
        <section className="pn-card" aria-label="Podaci fakture">
          <dl className="pn-facts">
            <div>
              <dt>Vrsta dokumenta</dt>
              <dd>{DOCUMENT_KIND_LABELS[invoice.documentKind] ?? "Dokument"}</dd>
            </div>
            <div>
              <dt>Datum izdavanja</dt>
              <dd className="pn-num">{dmy(invoice.issuedOn)}</dd>
            </div>
            <div>
              <dt>Poreklo</dt>
              <dd>
                {origin}
                <small>uvezeno {dmyTime(invoice.ingestedAt)}</small>
              </dd>
            </div>
          </dl>
          {invoice.confirmed ? null : <p className="pn-small pn-muted">Ovaj dokument još nije potvrđen iz izvornog dokumenta.</p>}
        </section>
        <section className="pn-card" aria-label="Iznosi fakture">
          <h2 className="pn-h2">Iznosi</h2>
          <dl className="pn-totals">
            <dt>Osnovica</dt>
            <dd>{money(invoice.netAmount, cur)}</dd>
            <dt>PDV</dt>
            <dd>{money(invoice.taxAmount, cur)}</dd>
            <dt className="pn-grand">Ukupno</dt>
            <dd className="pn-grand">{money(invoice.totalAmount, cur)}</dd>
          </dl>
        </section>
      </div>
      <section className="pn-card pn-card-flush" aria-labelledby="faktura-stavke">
        <div className="pn-card-h">
          <h2 id="faktura-stavke">
            Stavke <span className="pn-muted pn-num" style={{ fontWeight: 400 }}>· {invoice.lines.length}</span>
          </h2>
        </div>
        <ScrollTable label="Stavke fakture">
          <table className="pn-table pn-table-cards">
            <thead>
              <tr>
                <th scope="col">Šifra</th>
                <th scope="col">Naziv</th>
                <th scope="col" className="pn-r">
                  Količina
                </th>
                <th scope="col" className="pn-r">
                  Cena na fakturi
                </th>
                <th scope="col" className="pn-r">
                  Rabat
                </th>
                <th scope="col" className="pn-r">
                  Iznos
                </th>
              </tr>
            </thead>
            <tbody>
              {invoice.lines.map((l) => (
                <tr key={l.lineNumber}>
                  <td className="pn-c-code">{l.articleCode}</td>
                  <td className="pn-c-name">
                    <span className="pn-strong">{l.description ?? l.articleCode}</span>
                  </td>
                  <td className="pn-r pn-num" data-label="Količina">
                    {quantity(l.quantity)}
                  </td>
                  <td className="pn-r pn-num" data-label="Cena na fakturi">
                    {amount(l.unitPrice)}
                  </td>
                  <td className="pn-r pn-num" data-label="Rabat">
                    {l.discountPercent && Number(l.discountPercent) ? percent(Number(l.discountPercent)) : "—"}
                  </td>
                  <td className="pn-r pn-num pn-strong pn-c-total" data-label="Iznos">
                    {amount(l.lineAmount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollTable>
        <p className="pn-card-foot">Iznosi su u {cur}. Cene na ovoj fakturi su istorijske — važile su za ovu isporuku i nisu važeće cene.</p>
      </section>
    </div>
  );
}
