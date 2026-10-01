import Link from "next/link";
import { PageHeader } from "@/components/portal/PortalPrimitives";
import { UnavailableValue } from "@/components/portal/PhaseNotice";
import { money } from "@/features/portal/SalesAnalytics";
import { NoInvoicesYet } from "@/features/portal/SalesFilters";
import { seesAllCustomers } from "@/lib/authz/permissions.mjs";
import { requireCapability } from "@/lib/authz/session";
import {
  hasImportedInvoices,
  loadSalesLines,
  loadScopedCustomers,
} from "@/lib/sales/queries";
import { summarizeBy } from "@/lib/sales/totals.mjs";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const user = await requireCapability("view:kupci", "/portal/kupci");
  const scoped = !seesAllCustomers(user);
  const customers = await loadScopedCustomers(user);

  if (!(await hasImportedInvoices())) {
    return (
      <>
        <PageHeader eyebrow="Prodaja" title="Kupci" />
        <NoInvoicesYet screen="Kupci" />
      </>
    );
  }

  const lines = await loadSalesLines(user, {});
  const byCustomer = new Map(
    summarizeBy(lines, (line) => line.customerId).map((row) => [row.key, row]),
  );

  return (
    <>
      <PageHeader
        eyebrow="Prodaja"
        title="Kupci"
        description={
          scoped
            ? `Vidite ${customers.length} dodeljenih kupaca. Otvaranje tuđeg kupca preko adrese vraća 403.`
            : `Svi kupci firme (${customers.length}).`
        }
      />

      <section className="portal-panel">
        <div className="portal-section-header">
          <div>
            <h2>Promet po kupcu</h2>
            <p>
              Iznosi su iz uvezenih faktura. Dugovanje i naplata nisu deo ovog
              izvora podataka.
            </p>
          </div>
        </div>
        <div className="portal-table-wrap">
          <table className="portal-table">
            <thead>
              <tr>
                <th scope="col">Kupac</th>
                <th scope="col">PIB</th>
                <th scope="col">Grad</th>
                <th scope="col">Bruto</th>
                <th scope="col">Povrati</th>
                <th scope="col">Neto</th>
                <th scope="col">Faktura</th>
                <th scope="col">Dugovanje</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => {
                const totals = byCustomer.get(customer.id);
                return (
                  <tr key={customer.id}>
                    <th scope="row">
                      <Link href={`/portal/kupci/${customer.id}`}>
                        {customer.name}
                      </Link>
                    </th>
                    <td>{customer.pib}</td>
                    <td>{customer.city ?? "—"}</td>
                    <td className="portal-table-number">
                      {money(totals?.gross ?? 0)}
                    </td>
                    <td className="portal-table-number">
                      {money(totals?.returnValue ?? 0)}
                    </td>
                    <td className="portal-table-number">
                      <strong>{money(totals?.net ?? 0)}</strong>
                    </td>
                    <td className="portal-table-number">
                      {totals?.invoiceCount ?? 0}
                    </td>
                    <td>
                      <UnavailableValue note="Fakture ne sadrže podatke o plaćanju." />
                    </td>
                  </tr>
                );
              })}
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    {scoped
                      ? "Nemate dodeljenih kupaca. Dodelu radi Vlasnik."
                      : "Nema kupaca — uvezite fakture."}
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
