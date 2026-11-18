import { PageHeader } from "@/components/portal/PortalPrimitives";
import {
  SALES_LINES_DISPLAY,
  SalesBreakdown,
  SalesLines,
  SalesTotals,
  type GroupView,
} from "@/features/portal/SalesAnalytics";
import { NoInvoicesYet, SalesFilters } from "@/features/portal/SalesFilters";
import { requireCapability } from "@/lib/authz/session";
import { listSalesReps } from "@/lib/partners/assignment-service";
import { seesAllCustomers } from "@/lib/authz/permissions.mjs";
import {
  hasImportedInvoices,
  loadProductGroups,
  loadSalesBreakdown,
  loadSalesLines,
  loadSalesSummary,
  loadSalespeople,
  loadScopedCustomers,
} from "@/lib/sales/queries";
import { normalizeSalesFilter } from "@/lib/sales/filterInput.mjs";
import { readPortalPeriod } from "@/lib/portal/period";
import { BRAND_PREFIXES } from "@/lib/procurement/suggest.mjs";

/** Brendovi za filter: isti spisak kao Lager lista i Nabavka, „Ostalo“ na kraju. */
const BRANDS = [...new Set(BRAND_PREFIXES.map(([, b]) => b))]
  .sort((a, b) => a.localeCompare(b, "sr"))
  .concat("Ostalo");

export const metadata = { title: "Analitika" };

export const dynamic = "force-dynamic";

const VIEWS: { key: GroupView; label: string }[] = [
  { key: "kupci", label: "Po kupcu" },
  { key: "komercijalisti", label: "Po komercijalisti" },
  { key: "brendovi", label: "Po brendu" },
  { key: "artikli", label: "Po artiklu" },
  { key: "grupe", label: "Po grupi proizvoda" },
];

/** Prethodni period iste dužine — osnova za poređenje. */
function previousRange(from?: string, to?: string) {
  if (!from || !to) return null;
  const start = new Date(from);
  const end = new Date(to);
  const span = end.getTime() - start.getTime();
  if (!Number.isFinite(span) || span < 0) return null;
  const previousEnd = new Date(start.getTime() - 86400000);
  const previousStart = new Date(previousEnd.getTime() - span);
  return {
    from: previousStart.toISOString().slice(0, 10),
    to: previousEnd.toISOString().slice(0, 10),
  };
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireCapability("view:analitika", "/portal/analitika");
  const params = await searchParams;

  if (!(await hasImportedInvoices())) {
    return (
      <>
        <PageHeader
          eyebrow="Pregled"
          title="Analitika"
          description="Dubinska analiza prometa cele firme: poređenja perioda, kupaca, komercijalista i grupa, sa drill-down do stavki fakture."
        />
        <NoInvoicesYet screen="Analitika" />
      </>
    );
  }

  // Neispravan datum ili ID iz adrese ne sme da obori stranu (B7).
  // Period iz adrese ili zapamćen sa drugog ekrana portala (Kupci, kartica kupca, Prodaja, Analitika).
  const period = await readPortalPeriod(params);
  const applied = { ...params, from: period.from ?? "", to: period.to ?? "" };
  const filter = normalizeSalesFilter(applied);
  const view = (VIEWS.find((item) => item.key === params.prikaz)?.key ??
    "kupci") as GroupView;

  const previousWindow = previousRange(
    filter.from ?? undefined,
    filter.to ?? undefined,
  );

  // Zbirovi nad CELIM filtriranim skupom u bazi; lista stavki je samo prikaz.
  const [
    summary,
    rows,
    byCustomer,
    lines,
    previous,
    customers,
    salespeople,
    productGroups,
  ] = await Promise.all([
    loadSalesSummary(user, filter),
    loadSalesBreakdown(user, filter, view),
    view === "kupci" ? null : loadSalesBreakdown(user, filter, "kupci"),
    loadSalesLines(user, filter, SALES_LINES_DISPLAY),
    previousWindow
      ? loadSalesSummary(user, { ...filter, ...previousWindow })
      : null,
    loadScopedCustomers(user),
    loadSalespeople(),
    loadProductGroups(),
  ]);
  // Filter po dodeli ima smisla samo ko vidi sve kupce.
  const reps = seesAllCustomers(user) ? await listSalesReps() : [];

  return (
    <>
      <PageHeader
        eyebrow="Pregled"
        title="Analitika"
        description="Bruto, povrati, korekcije i neto promet nad uvezenim fakturama. Pokazatelji naplate nisu deo ovog izvora podataka."
      />

      <SalesFilters
        action="/portal/analitika"
        options={{
          customers,
          salespeople,
          reps,
          productGroups,
          brands: BRANDS,
        }}
        applied={applied}
        views={VIEWS}
        exportView={view}
        salespersonOnInvoices={
          summary.lineCount === 0 || summary.linesWithSalesperson > 0
        }
      />

      <section className="portal-panel">
        <div className="portal-section-header">
          <div>
            <h2>Ukupno u periodu</h2>
            <p>
              {previousWindow
                ? `Poređenje sa prethodnim periodom ${previousWindow.from} — ${previousWindow.to}.`
                : "Zadajte period da bi se prikazalo poređenje sa prethodnim periodom."}
            </p>
          </div>
        </div>
        <SalesTotals
          totals={summary}
          previous={previous}
          byCustomer={byCustomer ?? rows}
        />
      </section>

      <section className="portal-panel">
        <div className="portal-section-header">
          <div>
            <h2>{VIEWS.find((item) => item.key === view)?.label}</h2>
            <p>
              {view === "kupci"
                ? "Naziv kupca otvara njegove fakture, a „artikli →“ šta je kupovao."
                : view === "brendovi"
                  ? "„artikli →“ otvara artikle tog brenda. Rabat je prosečan, na VP vrednost prodatog."
                  : view === "komercijalisti"
                    ? "Po komercijalisti sa fakture, a kada ga faktura nema — po današnjoj dodeli kupca. Kupac sa dva komercijaliste je u zajedničkoj grupi."
                    : "Zbirovi nad celim izabranim periodom."}
            </p>
          </div>
        </div>
        <SalesBreakdown
          rows={rows}
          totals={summary}
          view={view}
          drillDownBase="/portal/prodaja"
          rowHref={(row) => {
            // Isti filteri, samo prikaz po artiklu za izabranog kupca ili brend.
            const next = new URLSearchParams(
              Object.entries(params).filter(
                (e): e is [string, string] =>
                  typeof e[1] === "string" && e[1] !== "",
              ),
            );
            next.set("prikaz", "artikli");
            if (view === "kupci" && row.customerId)
              next.set("kupac", row.customerId);
            else if (view === "brendovi") next.set("brend", row.key);
            else return null;
            return `/portal/analitika?${next.toString()}`;
          }}
          rowHrefLabel="artikli →"
        />
      </section>

      <section className="portal-panel">
        <div className="portal-section-header">
          <div>
            <h2>Stavke faktura</h2>
            <p>
              Najniži nivo: pojedinačne stavke. Broj fakture vodi na ceo
              dokument.
            </p>
          </div>
        </div>
        <SalesLines lines={lines} totalLines={summary.lineCount} />
      </section>
    </>
  );
}
