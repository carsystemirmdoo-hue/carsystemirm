import Link from "next/link";
import { notFound } from "next/navigation";
import { DOCUMENT_KIND_LABELS } from "@/components/customer/account-format";
import { requireCustomerSession } from "@/lib/authz/customer-session";
import { companyContact } from "@/lib/company-contact";
import { loadCustomerInvoice } from "@/lib/customers/customer-queries";
import { amount, dmy, percent, quantity } from "@/lib/ordering/panelFormat.mjs";
import { PrintButton } from "@/app/portal/zahtevi/[id]/stampa/PrintButton";
import "@/app/portal/zahtevi/[id]/stampa/stampa.css";

export const dynamic = "force-dynamic";

/**
 * Pregled podataka iz fakture za štampu (A4) — revizija 2026-10-11, B6.
 *
 * NIJE original: originalni PDF se ne čuva u oblaku (konektor šalje samo
 * podatke, ručni uvoz samo otisak). Zato je oznaka „nije original dokumenta“
 * u naslovu, na dnu i u margini svake strane, i nema ničega što portal ne zna
 * (rok plaćanja, adresa, potpis). Tuđa i nepostojeća faktura: 404.
 */
export default async function CustomerInvoicePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireCustomerSession(`/kupac/fakture/${encodeURIComponent(id)}/stampa`);
  const invoice = await loadCustomerInvoice(session.customerId, id);
  if (!invoice) notFound();
  const kind = DOCUMENT_KIND_LABELS[invoice.documentKind] ?? "Dokument";
  const docNo = `${invoice.number}/${invoice.year}`;
  const cur = invoice.currency ?? "RSD";
  const margin = `Pregled podataka iz fakture ${docNo} — nije original dokumenta`;
  const pageCss = `@page { @bottom-left { content: ${JSON.stringify(margin)}; font: 8pt Arial, sans-serif; color: #333; } @bottom-right { content: "Strana " counter(page) " od " counter(pages); font: 8pt Arial, sans-serif; color: #333; } }
.zp-table .c-sifra { width: 22mm; } .zp-table td.nw { white-space: normal; overflow-wrap: anywhere; }
@media print { .acct-bar, header:has(.acct-bar-brand), .portal-customer-area .pn-account, .portal-customer-area nav, .portal-customer-area .portal-data-strip, .portal-customer-area [class*="data-strip"] { display: none !important; } .portal-customer-area, .portal-customer-area .portal-main { padding: 0 !important; margin: 0 !important; background: #fff !important; } }`;

  return (
    <>
      <div className="pn zp-screen-only">
        <p className="pn-back">
          <Link href={`/kupac/fakture/${invoice.id}`}>← Nazad na fakturu</Link>
        </p>
        <div className="pn-head">
          <div>
            <h1 className="pn-title">Štampa · {kind} {docNo}</h1>
            <p className="pn-lead">
              Pregled podataka koje portal ima iz fakture — nije original dokumenta. Original izdaje i čuva {companyContact.legalName}; zatražite ga od kancelarije. Za PDF u dijalogu štampe izaberite čuvanje kao PDF.
            </p>
          </div>
          <div className="pn-head-actions">
            <PrintButton />
          </div>
        </div>
      </div>
      <style>{pageCss}</style>
      <article className="zp-doc" aria-label={`Pregled podataka iz fakture ${docNo}`}>
        <p className="zp-old">PREGLED PODATAKA IZ FAKTURE — NIJE ORIGINAL DOKUMENTA</p>
        <header className="zp-head">
          <div>
            <p className="zp-firm">{companyContact.legalName}</p>
            <h1>
              {kind} {docNo}
            </h1>
            <p className="zp-not">Podaci uvezeni iz poslovnog programa izdavaoca. Za knjiženje i reklamacije važi original.</p>
          </div>
          <dl>
            <div>
              <dt>Broj</dt>
              <dd>{docNo}</dd>
            </div>
            <div>
              <dt>Datum izdavanja</dt>
              <dd>{dmy(invoice.issuedOn)}</dd>
            </div>
            {invoice.reversed ? (
              <div>
                <dt>Stanje</dt>
                <dd>stornirana</dd>
              </div>
            ) : null}
          </dl>
        </header>

        <section className="zp-parties">
          <div>
            <h2>Kupac</h2>
            <p>
              <strong>{session.customerName}</strong>
            </p>
          </div>
          <div>
            <h2>Izdavalac</h2>
            <p>
              <strong>{companyContact.legalName}</strong>
            </p>
            <p>PIB {companyContact.pib}</p>
          </div>
        </section>

        <table className="zp-table">
          <colgroup>
            <col className="c-rb" />
            <col className="c-sifra" />
            <col />
            <col className="c-jm" />
            <col className="c-kol" />
            <col className="c-osn" />
            <col className="c-rabat" />
            <col className="c-iznos" />
          </colgroup>
          <thead>
            <tr>
              <th>Rb</th>
              <th>Šifra</th>
              <th>Naziv artikla</th>
              <th>JM</th>
              <th className="r">Količina</th>
              <th className="r">Cena bez PDV-a</th>
              <th className="r">Rabat</th>
              <th className="r">Iznos bez PDV-a</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((l) => (
              <tr key={l.lineNumber}>
                <td className="r">{l.lineNumber}.</td>
                <td className="nw">{l.articleCode}</td>
                <td className="zp-name">{l.description ?? l.articleCode}</td>
                <td>{l.unit ?? "—"}</td>
                <td className="r">{quantity(l.quantity)}</td>
                <td className="r">{amount(l.unitPrice)}</td>
                <td className="r">{l.discountPercent && Number(l.discountPercent) ? percent(Number(l.discountPercent)) : "—"}</td>
                <td className="r b">{amount(l.lineAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="zp-totals">
          <dl>
            <div>
              <dt>Osnovica</dt>
              <dd>
                {amount(invoice.netAmount)} {cur}
              </dd>
            </div>
            <div>
              <dt>PDV</dt>
              <dd>
                {amount(invoice.taxAmount)} {cur}
              </dd>
            </div>
            <div className="zp-grand">
              <dt>Ukupno</dt>
              <dd>
                {amount(invoice.totalAmount)} {cur}
              </dd>
            </div>
          </dl>
        </section>

        <footer className="zp-foot">
          Pregled podataka iz fakture {docNo} sa portala {companyContact.legalName}. Nije original dokumenta i ne zamenjuje ga; ne sadrži rok plaćanja ni druge podatke koje portal nema. Cene su istorijske — važile su za ovu isporuku.
        </footer>
      </article>
    </>
  );
}
