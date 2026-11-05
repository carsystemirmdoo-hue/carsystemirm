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


export const metadata = { title: "Analitika" };

export const dynamic = "force-dynamic";

const VIEWS: { key: GroupView; label: string }[] = [
  { key: "kupci", label: "Po kupcu" },
  { key: "komercijalisti", label: "Po komercijalisti" },
  { key: "artikli", label: "Po artiklu" },
  { key: "grupe", label: "Po grupi proizvoda" },
  { key: "meseci", label: "Po mesecu" },
  { key: "godine", label: "Po godini" },
  { key: "dani", label: "Po danu" },
];

/** Najduži period za prikaz po danu; duži bi dao tabelu od ~1.500 redova. */
const DANI_MAX = 92;

function periodDays(from?: string | null, to?: string | null): number | null {
  if (!from || !to) return null;
  const span = (Date.parse(to) - Date.parse(from)) / 86400000;
  return Number.isFinite(span) && span >= 0 ? span + 1 : null;
}

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
  const filter = normalizeSalesFilter(params);
  const view = (VIEWS.find((item) => item.key === params.prikaz)?.key ??
    "kupci") as GroupView;

  const previousWindow = previousRange(params.from, params.to);
  const span = periodDays(filter.from, filter.to);
  const daysBlocked = view === "dani" && (span === null || span > DANI_MAX);

  // Zbirovi nad CELIM filtriranim skupom u bazi; lista stavki je samo prikaz.
  const [summary, rows, byCustomer, lines, previous, customers, salespeople, productGroups] =
    await Promise.all([
      loadSalesSummary(user, filter),
      daysBlocked ? Promise.resolve([]) : loadSalesBreakdown(user, filter, view),
      view === "kupci" ? null : loadSalesBreakdown(user, filter, "kupci"),
      loadSalesLines(user, filter, SALES_LINES_DISPLAY),
      previousWindow
        ? loadSalesSummary(user, { ...filter, ...previousWindow })
        : null,
      loadScopedCustomers(user),
      seesAllCustomers(user) ? loadSalespeople() : Promise.resolve([]),
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
        options={{ customers, salespeople, reps, productGroups }}
        applied={params}
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
                ? "Kliknite na kupca da otvorite njegove fakture."
                : view === "komercijalisti"
                  ? "Po komercijalisti sa fakture, a kada ga faktura nema — po današnjoj dodeli kupca. Kupac sa dva komercijaliste je u zajedničkoj grupi."
                  : daysBlocked
                    ? `Prikaz po danu traži period od najviše ${DANI_MAX} dana — zadajte Od i Do iznad (npr. „Ovaj mesec"). Izvoz radi i za duži period.`
                    : view === "dani" || view === "meseci" || view === "godine"
                      ? "Po datumu izdavanja fakture, od najnovijeg. Dani i meseci bez prometa se ne prikazuju."
                      : "Zbirovi nad celim izabranim periodom."}
            </p>
          </div>
        </div>
        {daysBlocked ? null : (
          <SalesBreakdown
            rows={rows}
            totals={summary}
            view={view}
            drillDownBase="/portal/prodaja"
          />
        )}
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
