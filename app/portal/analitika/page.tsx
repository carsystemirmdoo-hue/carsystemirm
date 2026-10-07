import { PageHeader } from "@/components/portal/PortalPrimitives";
import {
  SalesBreakdown,
  SalesLines,
  SalesTotals,
  type GroupView,
} from "@/features/portal/SalesAnalytics";
import { NoInvoicesYet, SalesFilters } from "@/features/portal/SalesFilters";
import { requireCapability } from "@/lib/authz/session";
import {
  hasImportedInvoices,
  loadProductGroups,
  loadSalesLines,
  loadSalespeople,
  loadScopedCustomers,
} from "@/lib/sales/queries";

export const dynamic = "force-dynamic";

const VIEWS: { key: GroupView; label: string }[] = [
  { key: "kupci", label: "Po kupcu" },
  { key: "komercijalisti", label: "Po komercijalisti" },
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

  const filter = {
    from: params.from || null,
    to: params.to || null,
    customerId: params.kupac || null,
    salespersonId: params.komercijalista || null,
    productGroup: params.grupa || null,
  };
  const view = (VIEWS.find((item) => item.key === params.prikaz)?.key ??
    "kupci") as GroupView;

  const [lines, customers, salespeople, productGroups] = await Promise.all([
    loadSalesLines(user, filter),
    loadScopedCustomers(user),
    loadSalespeople(),
    loadProductGroups(),
  ]);

  const previousWindow = previousRange(params.from, params.to);
  const previous = previousWindow
    ? await loadSalesLines(user, { ...filter, ...previousWindow })
    : undefined;

  return (
    <>
      <PageHeader
        eyebrow="Pregled"
        title="Analitika"
        description="Bruto, povrati, korekcije i neto promet nad uvezenim fakturama. Pokazatelji naplate nisu deo ovog izvora podataka."
      />

      <SalesFilters
        action="/portal/analitika"
        options={{ customers, salespeople, productGroups }}
        applied={params}
        views={VIEWS}
        exportView={view}
        salespersonOnInvoices={lines.some((line) => line.salespersonId)}
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
        <SalesTotals lines={lines} previous={previous} />
      </section>

      <section className="portal-panel">
        <div className="portal-section-header">
          <div>
            <h2>{VIEWS.find((item) => item.key === view)?.label}</h2>
            <p>Kliknite na kupca da otvorite njegove fakture.</p>
          </div>
        </div>
        <SalesBreakdown lines={lines} view={view} drillDownBase="/portal/prodaja" />
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
        <SalesLines lines={lines} />
      </section>
    </>
  );
}
