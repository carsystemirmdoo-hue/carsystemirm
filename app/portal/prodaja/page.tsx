import { PageHeader } from "@/components/portal/PortalPrimitives";
import {
  SALES_LINES_DISPLAY,
  SalesBreakdown,
  SalesLines,
  SalesTotals,
} from "@/features/portal/SalesAnalytics";
import { NoInvoicesYet, SalesFilters } from "@/features/portal/SalesFilters";
import { seesAllCustomers } from "@/lib/authz/permissions.mjs";
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

export const dynamic = "force-dynamic";

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireCapability("view:prodaja", "/portal/prodaja");
  const params = await searchParams;
  const scoped = !seesAllCustomers(user);

  if (!(await hasImportedInvoices())) {
    return (
      <>
        <PageHeader eyebrow="Prodaja" title="Prodaja" />
        <NoInvoicesYet screen="Prodaja" />
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

  // Zbirovi nad CELIM filtriranim skupom u bazi; lista stavki je samo prikaz.
  const [summary, byCustomer, lines, customers, salespeople, productGroups] =
    await Promise.all([
      loadSalesSummary(user, filter),
      loadSalesBreakdown(user, filter, "kupci"),
      loadSalesLines(user, filter, SALES_LINES_DISPLAY),
      loadScopedCustomers(user),
      loadSalespeople(),
      loadProductGroups(),
    ]);

  return (
    <>
      <PageHeader
        eyebrow="Prodaja"
        title="Prodaja"
        description={
          scoped
            ? "Promet Vaših kupaca. Ograničenje važi i na izvoz i na direktno otvaranje adrese."
            : "Promet cele firme po kupcu, komercijalisti, artiklu i grupi proizvoda."
        }
      />

      <SalesFilters
        action="/portal/prodaja"
        options={{ customers, salespeople, productGroups }}
        applied={params}
        exportView="kupci"
        salespersonOnInvoices={
          summary.lineCount === 0 || summary.linesWithSalesperson > 0
        }
      />

      <section className="portal-panel">
        <div className="portal-section-header">
          <div>
            <h2>Ukupno u periodu</h2>
          </div>
        </div>
        <SalesTotals totals={summary} byCustomer={byCustomer} />
      </section>

      <section className="portal-panel">
        <div className="portal-section-header">
          <div>
            <h2>Po kupcu</h2>
          </div>
        </div>
        <SalesBreakdown rows={byCustomer} totals={summary} view="kupci" />
      </section>

      <section className="portal-panel">
        <div className="portal-section-header">
          <div>
            <h2>Stavke faktura</h2>
          </div>
        </div>
        <SalesLines lines={lines} totalLines={summary.lineCount} />
      </section>
    </>
  );
}
