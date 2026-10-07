import { PageHeader } from "@/components/portal/PortalPrimitives";
import {
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
  loadSalesLines,
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

  const [lines, customers, salespeople, productGroups] = await Promise.all([
    loadSalesLines(user, filter),
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
        salespersonOnInvoices={lines.some((line) => line.salespersonId)}
      />

      <section className="portal-panel">
        <div className="portal-section-header">
          <div>
            <h2>Ukupno u periodu</h2>
          </div>
        </div>
        <SalesTotals lines={lines} />
      </section>

      <section className="portal-panel">
        <div className="portal-section-header">
          <div>
            <h2>Po kupcu</h2>
          </div>
        </div>
        <SalesBreakdown lines={lines} view="kupci" />
      </section>

      <section className="portal-panel">
        <div className="portal-section-header">
          <div>
            <h2>Stavke faktura</h2>
          </div>
        </div>
        <SalesLines lines={lines} />
      </section>
    </>
  );
}
