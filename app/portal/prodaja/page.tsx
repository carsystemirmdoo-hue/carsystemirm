import { PageHeader } from "@/components/portal/PortalPrimitives";
import {
  SALES_LINES_DISPLAY,
  SalesBreakdown,
  SalesLines,
  SalesTotals,
} from "@/features/portal/SalesAnalytics";
import { NoInvoicesYet, SalesFilters } from "@/features/portal/SalesFilters";
import { can, seesAllCustomers } from "@/lib/authz/permissions.mjs";
import { debtsByCustomer, latestSnapshot } from "@/lib/sales-tools/receivables-service";
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
import { normalizeSalesFilter } from "@/lib/sales/filterInput.mjs";
import { readPortalPeriod } from "@/lib/portal/period";


export const metadata = { title: "Prodaja" };

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

  // Neispravan datum ili ID iz adrese ne sme da obori stranu (B7).
  // Period iz adrese ili zapamćen sa drugog ekrana portala (Kupci, kartica kupca, Prodaja, Analitika).
  const period = await readPortalPeriod(params);
  const applied = { ...params, from: period.from ?? "", to: period.to ?? "" };
  const filter = normalizeSalesFilter(applied);

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

  // Dugovanja danas (tabela kancelarije) — isti opseg kupaca kao ekran Dugovanja.
  let debts: { total: number; overdue: number; customers: number; checkedAt: string } | null | undefined;
  if (can(user, "view:dugovanja")) {
    const snap = await latestSnapshot();
    if (!snap) debts = null;
    else {
      const rows = (await debtsByCustomer(user)).filter((r) => !filter.customerId || r.customerId === filter.customerId);
      debts = {
        total: rows.reduce((a, r) => a + r.total, 0),
        overdue: rows.reduce((a, r) => a + r.overdueTotal, 0),
        customers: rows.length,
        checkedAt: snap.checkedAt,
      };
    }
  }

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
        applied={applied}
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
        <SalesTotals totals={summary} byCustomer={byCustomer} debts={debts} />
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
