import { dmy } from "@/lib/ordering/panelFormat.mjs";
import { PageHeader } from "@/components/portal/PortalPrimitives";
import {
  money,
  SALES_LINES_DISPLAY,
  SalesTotals,
} from "@/features/portal/SalesAnalytics";
import { NoInvoicesYet, SalesFilters } from "@/features/portal/SalesFilters";
import { requireCapability } from "@/lib/authz/session";
import {
  hasImportedInvoices,
  loadProductGroups,
  loadSalesBreakdown,
  loadSalesLines,
  loadSalesSummary,
  loadSalespeople,
  loadScopedCustomers,
} from "@/lib/sales/queries";
import { UNKNOWN_NEGATIVE_LABEL } from "@/lib/sales/totals.mjs";
import { loadMinusDocuments } from "@/lib/sales/minus-documents";
import Link from "next/link";


export const metadata = { title: "Povrati i minus fakture" };

export const dynamic = "force-dynamic";

const KIND_LABELS: Record<string, string> = {
  povrat_robe: "povrat robe",
  storno: "storno",
  knjizno_odobrenje: "knjižno odobrenje",
  korekcija_cene: "korekcija cene",
  korekcija_popusta: "korekcija popusta",
  nepoznato: UNKNOWN_NEGATIVE_LABEL,
};

export default async function ReturnsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireCapability("view:povrati", "/portal/povrati");
  const params = await searchParams;

  if (!(await hasImportedInvoices())) {
    return (
      <>
        <PageHeader eyebrow="Prodaja" title="Povrati i minus fakture" />
        <NoInvoicesYet screen="Povrati" />
      </>
    );
  }

  const filter = {
    from: params.from || null,
    to: params.to || null,
    customerId: params.kupac || null,
    salespersonId: params.komercijalista || null,
    productGroup: params.grupa || null,
  };

  // Zbirovi nad CELIM filtriranim skupom u bazi. Negativne stavke se čitaju
  // posebnim upitom (samo iznos < 0), pa ih granica liste ne može sakriti.
  const [summary, byCustomer, negatives, customers, salespeople, productGroups, minusDocs] =
    await Promise.all([
      loadSalesSummary(user, filter),
      loadSalesBreakdown(user, filter, "kupci"),
      loadSalesLines(user, { ...filter, onlyNegative: true }, SALES_LINES_DISPLAY),
      loadScopedCustomers(user),
      loadSalespeople(),
      loadProductGroups(),
      loadMinusDocuments(user, { from: filter.from, to: filter.to, customerId: filter.customerId }),
    ]);
  const storna = minusDocs.filter((d) => d.kind === "storno");
  const odobrenja = minusDocs.filter((d) => d.kind === "knjizno_odobrenje");
  const REVERSAL: Record<string, string> = {
    applied: "primenjeno — original van prometa",
    waiting_original: "čeka originalnu fakturu",
    review: "na ručnom pregledu — original ostaje u prometu",
  };

  return (
    <>
      <PageHeader
        eyebrow="Prodaja"
        title="Povrati i minus fakture"
        description="Negativni dokumenti se čuvaju kako ih izvor daje. Vrsta se preuzima iz dokumenta — ništa se ne pretpostavlja."
      />

      <SalesFilters
        action="/portal/povrati"
        options={{ customers, salespeople, productGroups }}
        applied={params}
        exportView="stavke"
        salespersonOnInvoices={
          summary.lineCount === 0 || summary.linesWithSalesperson > 0
        }
      />

      <section className="portal-panel">
        <div className="portal-section-header">
          <div>
            <h2>Bruto, povrati i neto</h2>
          </div>
        </div>
        <SalesTotals totals={summary} byCustomer={byCustomer} alwaysShowAdjustments />
      </section>

      <section className="portal-panel">
        <div className="portal-section-header">
          <div>
            <h2>Storna i knjižna odobrenja ({minusDocs.length})</h2>
            <p>
              Storno ({storna.length}): kada je primenjeno, originalna faktura ne ulazi u promet. Knjižno odobrenje ({odobrenja.length}):
              kada je pročitano bez greške i kupac je povezan, umanjuje promet kupca (kao korekcija vrednosti, ne po artiklima).
              Oba stižu sama sa kancelarijskog računara; ručno otpremanje na Importima i dalje radi.
              {odobrenja.length ? ` Zbir odobrenja: ${money(odobrenja.reduce((a, d) => a + d.gross, 0))} RSD sa PDV-om.` : ""}
            </p>
          </div>
        </div>
        <div className="portal-table-wrap">
          <table className="portal-table">
            <thead>
              <tr>
                <th scope="col">Dokument</th>
                <th scope="col">Datum</th>
                <th scope="col">Kupac</th>
                <th scope="col">Vrsta</th>
                <th scope="col">Iznos sa PDV</th>
                <th scope="col">Veza / stanje</th>
              </tr>
            </thead>
            <tbody>
              {minusDocs.map((d) => (
                <tr key={d.id}>
                  <th scope="row">{d.number ?? "—"}</th>
                  <td className="portal-nowrap">{d.date ? dmy(d.date) : "—"}</td>
                  <td>
                    {d.customerId ? <Link href={`/portal/kupci/${d.customerId}`}>{d.customerName}</Link> : <span className="portal-unavailable">šifra {d.partnerCode ?? "—"} nije povezana</span>}
                  </td>
                  <td>{d.kind === "storno" ? "storno" : "knjižno odobrenje"}</td>
                  <td className="portal-table-number">{money(d.gross)}</td>
                  <td>
                    {d.kind === "storno"
                      ? d.reversal
                        ? `poništava ${d.reversal.originalNumber} · ${REVERSAL[d.reversal.status] ?? d.reversal.status}`
                        : "bez navedenog originala — ručni pregled"
                      : d.posted
                        ? "umanjuje promet kupca"
                        : "čeka pregled — ne umanjuje promet"}
                  </td>
                </tr>
              ))}
              {minusDocs.length === 0 ? (
                <tr>
                  <td colSpan={6}>Nema storna ni knjižnih odobrenja u izabranom periodu. Stižu sa kancelarijskog računara ili kao PDF na strani Importi.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="portal-panel">
        <div className="portal-section-header">
          <div>
            <h2>Negativne stavke ({summary.negativeLineCount})</h2>
            <p>
              Nijedan negativan iznos se ne proglašava automatski fizičkim
              povratom robe.
              {summary.negativeLineCount > negatives.length
                ? ` Lista prikazuje najnovijih ${negatives.length}; zbirovi iznad obuhvataju sve.`
                : ""}
            </p>
          </div>
        </div>
        <div className="portal-table-wrap">
          <table className="portal-table">
            <thead>
              <tr>
                <th scope="col">Dokument</th>
                <th scope="col">Datum</th>
                <th scope="col">Kupac</th>
                <th scope="col">Vrsta</th>
                <th scope="col">Artikal</th>
                <th scope="col">Količina</th>
                <th scope="col">Vrednost</th>
                <th scope="col">Izvor vrste</th>
              </tr>
            </thead>
            <tbody>
              {negatives.map((line, index) => (
                <tr key={`${line.invoiceId}-${index}`}>
                  <th scope="row">{line.invoiceNumber}</th>
                  <td className="portal-nowrap">{dmy(String(line.issuedOn).slice(0, 10))}</td>
                  <td>{line.customerName}</td>
                  <td>
                    {line.documentKind === "nepoznato" ? (
                      <span className="portal-unavailable">
                        {UNKNOWN_NEGATIVE_LABEL}
                      </span>
                    ) : (
                      KIND_LABELS[line.documentKind]
                    )}
                  </td>
                  <td>
                    <strong>{line.articleCode}</strong>
                    <small>{line.articleName ?? ""}</small>
                  </td>
                  <td className="portal-table-number">{line.quantity}</td>
                  <td className="portal-table-number">
                    {money(line.lineAmount)}
                  </td>
                  <td>
                    {line.sourceDocumentType ? (
                      `iz dokumenta: ${line.sourceDocumentType}`
                    ) : (
                      <span className="portal-unavailable">nije dostavljeno</span>
                    )}
                  </td>
                </tr>
              ))}
              {negatives.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    Nema negativnih dokumenata u izabranom periodu.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
