import { dmy } from "@/lib/ordering/panelFormat.mjs";
import { Metric, PageHeader } from "@/components/portal/PortalPrimitives";
import { SourceDocumentReview } from "@/features/portal/SourceDocumentReview";
import { requireCapability } from "@/lib/authz/session";
import { can } from "@/lib/authz/permissions.mjs";
import { SOURCE_DOCUMENT_LIST_LIMIT, countSourceDocuments, listSourceDocuments } from "@/lib/pdf/ingest";
import {
  resolveLedgerScope,
  unlinkedCorrectiveDocuments,
} from "@/lib/ledger/effective-sales";

export const dynamic = "force-dynamic";

const FILTERS = [
  { key: "svi", label: "Svi" },
  { key: "karantin", label: "Karantin" },
  { key: "sudar", label: "Sudari" },
  { key: "pregled", label: "Čeka pregled" },
  { key: "neproknjizeno", label: "Čeka mapiranje" },
  { key: "bez-uzorka", label: "Bez uzorka" },
] as const;

/**
 * Pregled izvornih PDF dokumenata.
 *
 * Ekran radi sa otiskom i statusom, ne sa sadržajem dokumenta. Ime fajla, naziv
 * kupca i broj računa se ne prenose na klijent — spisak se gleda i sa ekrana
 * koji nije nasamo, a otisak je dovoljan da se dokument pronađe.
 */
const BROJ = new Intl.NumberFormat("sr-Latn-RS");

export default async function SourceDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; q?: string }>;
}) {
  const user = await requireCapability("view:importi", "/portal/importi/dokumenti");
  const { filter, q: rawQ } = await searchParams;
  const q = (rawQ ?? "").trim().slice(0, 80);
  const active = FILTERS.some((f) => f.key === filter) ? filter! : "svi";

  const counts = await countSourceDocuments();
  const rows = await listSourceDocuments({ ...queryFor(active), search: q || undefined });
  // Svaki dokument ima tačno jedno stanje provere, pa je zbir tih brojača ukupan broj.
  const totalDocuments = Object.entries(counts)
    .filter(([key]) => key.startsWith("validation:"))
    .reduce((sum, [, n]) => sum + n, 0);

  /*
   * Red korektivnih dokumenata bez dokazane veze.
   *
   * Čita se kroz opseg korisnika, kao i svaki drugi pogled na promet — ekran
   * uvoza nije izuzetak od ograničenja na dodeljene kupce.
   */
  const corrective = await unlinkedCorrectiveDocuments(await resolveLedgerScope(user), {
    limit: 100,
  });

  return (
    <>
      <PageHeader
        eyebrow="Sistem"
        title="Izvorni dokumenti"
        description="Svaki uvezen PDF ostavlja otisak, status provere i stavke. Dokument koji nije prošao proveru vidi se ovde, ali ne pravi promet."
      />

      <section className="portal-metrics">
        <Metric label="Pročitano i provereno" value={BROJ.format(counts["validation:valid"] ?? 0)} />
        <Metric
          label="Zbir se ne poklapa"
          value={BROJ.format(counts["validation:totals_mismatch"] ?? 0)}
          tone="danger"
        />
        <Metric
          label="Oblik bez uzorka"
          value={BROJ.format(counts["validation:unsupported_requires_sample"] ?? 0)}
          tone="info"
        />
        <Metric
          label="Sudari verzija"
          value={BROJ.format(counts["revision:conflict"] ?? 0)}
          tone="danger"
        />
        <Metric
          label="Čeka ručni pregled"
          value={BROJ.format(counts["review:pending"] ?? 0)}
          tone="warning"
        />
        <Metric
          label="Provereno, čeka mapiranje"
          value={BROJ.format(counts["unposted"] ?? 0)}
          tone="warning"
        />
      </section>

      <section className="portal-panel">
        <form className="portal-filters" method="get">
          <label className="portal-field">
            <span>Prikaz</span>
            <select name="filter" defaultValue={active}>
              {FILTERS.map((entry) => (
                <option key={entry.key} value={entry.key}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>
          <label className="portal-field">
            <span>Broj računa, šifra partnera ili kupac</span>
            <input type="search" name="q" defaultValue={q} maxLength={80} placeholder="npr. 26-RN021001169" />
          </label>
          <button type="submit" className="portal-button" data-variant="secondary">
            Primenite
          </button>
        </form>
        {q ? <p>Pronađeno: {BROJ.format(rows.length)}{rows.length >= SOURCE_DOCUMENT_LIST_LIMIT ? "+ (suzite pretragu)" : ""}.</p> : null}
      </section>

      {!q && rows.length >= SOURCE_DOCUMENT_LIST_LIMIT ? (
        <p className="portal-login-hint" role="status">
          Prikazano je {SOURCE_DOCUMENT_LIST_LIMIT} najnovijih dokumenata (ukupno u bazi:{" "}
          {BROJ.format(totalDocuments)}
          ). Za dokumente koji traže korak izaberite prikaz iznad — Karantin, Sudari, Čeka pregled ili Čeka mapiranje.
        </p>
      ) : null}

      <SourceDocumentReview
        canManage={can(user, "documents:resolve")}
        canOpenInvoice={can(user, "view:prodaja")}
        rows={rows.map((row) => ({
          id: row.id,
          fileHash: row.fileHash,
          pageCount: row.pageCount,
          lineCount: row.lineCount,
          issuerCode: row.issuerCode,
          externalPartnerCode: row.externalPartnerCode,
          documentDate: row.documentDate,
          validationStatus: row.validationStatus,
          validationDetail: row.validationDetail,
          revisionStatus: row.revisionStatus,
          conflictReason: row.conflictReason,
          manualReview: row.manualReview,
          posted: row.invoiceId !== null,
          invoiceId: row.invoiceId,
          businessDocumentNumber: row.businessDocumentNumber,
          customerName: row.customerName,
          stornoStatus: row.stornoStatus,
          reversed: row.reversed,
        }))}
      />

      <section className="portal-panel">
        <div className="portal-section-header">
          <div>
            <h2>Povrat, storno i korekcija bez dokazane veze</h2>
            <p>
              Ovi dokumenti se vide u prometu, ali NE umanjuju neto dok se ne
              povežu sa dokumentom koji ispravljaju. Veza traži izričitu
              referencu u samom dokumentu; dok je nema, sistem ne pogađa.
            </p>
          </div>
        </div>
        <div className="portal-table-wrap">
          <table className="portal-table">
            <thead>
              <tr>
                <th scope="col">Datum</th>
                <th scope="col">Vrsta</th>
                <th scope="col">Kofa</th>
                <th scope="col">Stavki</th>
                <th scope="col">Iznos</th>
              </tr>
            </thead>
            <tbody>
              {corrective.map((row) => (
                <tr key={row.invoiceId}>
                  <th scope="row" className="portal-nowrap">{dmy(String(row.issuedOn).slice(0, 10))}</th>
                  <td>{row.documentKind}</td>
                  <td>{row.bucket}</td>
                  <td className="portal-table-number">{row.lines}</td>
                  <td className="portal-table-number">{row.amount}</td>
                </tr>
              ))}
              {corrective.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    Nema nijednog korektivnog dokumenta u Vašem opsegu.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="portal-panel">
        <div className="portal-section-header">
          <div>
            <h2>Šta ovaj ekran ne radi</h2>
            <p>
              Sistem ne bira koja je verzija dokumenta važeća, ne pogađa da li je
              nešto storno ili povrat, i ne otvara kupca po šifri sa dokumenta.
              Sve troje traži odluku čoveka, jer se greška u bilo kom od njih
              vidi tek pri poređenju sa knjigovodstvom.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}

function queryFor(filter: string) {
  switch (filter) {
    case "karantin":
      return { validationStatus: "totals_mismatch" };
    case "sudar":
      return { revisionStatus: "conflict" };
    case "pregled":
      return { manualReview: "pending" };
    case "neproknjizeno":
      return { validationStatus: "valid", onlyUnposted: true };
    case "bez-uzorka":
      return { validationStatus: "unsupported_requires_sample" };
    default:
      return undefined;
  }
}
