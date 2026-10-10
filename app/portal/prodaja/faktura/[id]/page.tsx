import { notFound } from "next/navigation";
import { PageHeader } from "@/components/portal/PortalPrimitives";
import { UnavailableValue } from "@/components/portal/PhaseNotice";
import { amount } from "@/lib/ordering/panelFormat.mjs";
import { requireCapability } from "@/lib/authz/session";
import { loadInvoiceDetail } from "@/lib/sales/queries";
import { UNKNOWN_NEGATIVE_LABEL } from "@/lib/sales/totals.mjs";

export const dynamic = "force-dynamic";

const QTY = new Intl.NumberFormat("sr-Latn-RS", { maximumFractionDigits: 3 });

/** Poslednji nivo drill-down-a: cela faktura sa svim stavkama. */
export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireCapability(
    "view:prodaja",
    `/portal/prodaja/faktura/${id}`,
  );

  // `loadInvoiceDetail` vraća `null` i kada faktura postoji ali je izvan opsega
  // korisnika — tuđi dokument se ne otvara ni direktnim ID-om.
  const detail = await loadInvoiceDetail(user, id);
  if (!detail) notFound();

  const { invoice, lines } = detail;
  const negativeUnknown =
    invoice.documentKind === "nepoznato" && Number(invoice.netAmount) < 0;

  return (
    <>
      <PageHeader
        eyebrow="Prodaja"
        title={`Faktura ${invoice.number}`}
        description={`${invoice.customerName} · PIB ${invoice.customerPib} · izdata ${invoice.issuedOn}`}
      />

      <section className="portal-panel">
        <div className="portal-section-header">
          <div>
            <h2>Zaglavlje dokumenta</h2>
          </div>
        </div>
        <div className="portal-phase-notice">
          <ul>
            <li>
              <strong>Vrsta dokumenta:</strong>{" "}
              {negativeUnknown ? (
                <span className="portal-unavailable">
                  {UNKNOWN_NEGATIVE_LABEL}
                </span>
              ) : (
                (invoice.sourceDocumentType ?? invoice.documentKind)
              )}
            </li>
            <li>
              <strong>Komercijalista:</strong> {invoice.salespersonName ?? "—"}
            </li>
            <li>
              <strong>Neto iznos:</strong> {amount(invoice.netAmount)} RSD
            </li>
            <li>
              <strong>Ukupno:</strong> {amount(invoice.totalAmount)} RSD
            </li>
            <li>
              <strong>Status plaćanja:</strong>{" "}
              <UnavailableValue note="Fakture ne sadrže podatke o plaćanju." />
            </li>
          </ul>
        </div>
      </section>

      <section className="portal-panel">
        <div className="portal-section-header">
          <div>
            <h2>Stavke</h2>
            <p>Negativne količine i iznosi se prikazuju onako kako stoje u izvoru.</p>
          </div>
        </div>
        <div className="portal-table-wrap">
          <table className="portal-table">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Šifra</th>
                <th scope="col">Opis</th>
                <th scope="col">Količina</th>
                <th scope="col">Cena</th>
                <th scope="col">Rabat %</th>
                <th scope="col">Iznos</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.lineNumber}>
                  <td>{line.lineNumber}</td>
                  <th scope="row">{line.articleCode}</th>
                  <td>{line.description ?? "—"}</td>
                  <td className="portal-table-number">
                    {QTY.format(Number(line.quantity))}
                  </td>
                  <td className="portal-table-number">
                    {amount(line.unitPrice)}
                  </td>
                  <td className="portal-table-number">
                    {QTY.format(Number(line.discountPercent))}
                  </td>
                  <td className="portal-table-number">
                    <strong>{amount(line.lineAmount)}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
