import Link from "next/link";
import { notFound } from "next/navigation";
import {
  DOCUMENT_KIND_LABELS,
  srDate,
  srDateTime,
  srMoney,
  srQuantity,
} from "@/components/customer/account-format";
import { requireCustomerSession } from "@/lib/authz/customer-session";
import { loadCustomerInvoice } from "@/lib/customers/customer-queries";
import { ORIGIN_LABELS } from "@/lib/data-state/data-state";
import { loadDatasetInfo } from "@/lib/data-state/dataset";

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

  return (
    <section className="portal-panel">
      <div className="portal-section-header">
        <div>
          <h2>
            {DOCUMENT_KIND_LABELS[invoice.documentKind] ?? "Dokument"} {invoice.number}/{invoice.year}
          </h2>
          <p>Izdata {srDate(invoice.issuedOn)}</p>
        </div>
        <Link href="/kupac/fakture" className="portal-section-link">← Sve fakture</Link>
      </div>
      <dl className="ka-facts ka-facts-wide">
        <div><dt>Osnovica</dt><dd>{srMoney(invoice.netAmount, invoice.currency)}</dd></div>
        <div><dt>PDV</dt><dd>{srMoney(invoice.taxAmount, invoice.currency)}</dd></div>
        <div><dt>Ukupno</dt><dd>{srMoney(invoice.totalAmount, invoice.currency)}</dd></div>
        <div><dt>Poreklo</dt><dd>{origin}<small>uvezeno {srDateTime(invoice.ingestedAt)}</small></dd></div>
      </dl>
      <div className="portal-panel-body">
        <h3>Stavke ({invoice.lines.length})</h3>
        <ol className="ka-lines">
          <li className="ka-lines-head" aria-hidden="true">
            <span>Artikal</span><span>Količina</span><span>Cena na fakturi</span><span>Rabat</span><span>Iznos</span>
          </li>
          {invoice.lines.map((l) => (
            <li key={l.lineNumber}>
              <span className="ka-line-name">
                <strong>{l.description ?? l.articleCode}</strong>
                <small>{l.articleCode}</small>
              </span>
              <span data-label="Količina">{srQuantity(l.quantity)}</span>
              <span data-label="Cena na fakturi">{srMoney(l.unitPrice, invoice.currency)}</span>
              <span data-label="Rabat">{l.discountPercent && Number(l.discountPercent) ? `${srQuantity(l.discountPercent)} %` : "—"}</span>
              <span data-label="Iznos" className="ka-amount">{srMoney(l.lineAmount, invoice.currency)}</span>
            </li>
          ))}
        </ol>
        <p className="portal-footnote">
          Cene na ovoj fakturi su istorijske — važile su za ovu isporuku i nisu važeće cene u katalogu.
          {invoice.confirmed ? "" : " Ovaj dokument još nije potvrđen iz izvornog dokumenta."}
          {invoice.reversed ? " Ova faktura je u potpunosti stornirana i ne računa se u kupovinu." : ""}
        </p>
      </div>
    </section>
  );
}
