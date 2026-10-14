import Link from "next/link";
import { PageHeader } from "@/components/portal/PortalPrimitives";
import { UnavailableValue } from "@/components/portal/PhaseNotice";
import { money } from "@/features/portal/SalesAnalytics";
import { NoInvoicesYet } from "@/features/portal/SalesFilters";
import { seesAllCustomers } from "@/lib/authz/permissions.mjs";
import { requireCapability } from "@/lib/authz/session";
import {
  hasImportedInvoices,
  loadSalesBreakdown,
  loadScopedCustomers,
} from "@/lib/sales/queries";
import { matchesStatusFilter, parseCustomerStatusFilter } from "@/lib/customers/customerStatus.mjs";
import { filterCustomerList, parseCustomerListFilter } from "@/lib/customers/customerListFilter.mjs";
import { listAssigneesByCustomer, listSalesReps } from "@/lib/partners/assignment-service";


export const metadata = { title: "Kupci" };

export const dynamic = "force-dynamic";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; komercijalista?: string }>;
}) {
  const user = await requireCapability("view:kupci", "/portal/kupci");
  const scoped = !seesAllCustomers(user);
  // Lista prometa podrazumevano prikazuje sve kupce; neaktivni nose oznaku.
  const params = await searchParams;
  const statusFilter = parseCustomerStatusFilter(params.status, "svi");
  // Pretraga i komercijalista po DODELI (B5); filter po komercijalisti ima smisla samo ko vidi sve kupce.
  const listFilter = parseCustomerListFilter(params);
  if (scoped) listFilter.rep = "";
  const allScoped = await loadScopedCustomers(user);
  const [assignees, reps] = await Promise.all([
    listAssigneesByCustomer(allScoped.map((c) => c.id)),
    scoped ? Promise.resolve([]) : listSalesReps(),
  ]);
  const customers = filterCustomerList(
    allScoped.filter((c) => matchesStatusFilter(c.active, statusFilter)),
    listFilter,
    assignees,
  );
  const filtered = Boolean(listFilter.q || listFilter.rep);
  const neaktivnih = allScoped.filter((c) => !c.active).length;

  if (!(await hasImportedInvoices())) {
    return (
      <>
        <PageHeader eyebrow="Prodaja" title="Kupci" />
        <NoInvoicesYet screen="Kupci" />
      </>
    );
  }

  // Promet po kupcu nad CELOM istorijom, u bazi — bez granice broja stavki.
  const byCustomer = new Map(
    (await loadSalesBreakdown(user, {}, "kupci")).map((row) => [row.key, row]),
  );

  return (
    <>
      <PageHeader
        eyebrow="Prodaja"
        title="Kupci"
        description={
          scoped
            ? `Dodeljeni kupci: ${allScoped.length}. Kupac koji Vam nije dodeljen ne otvara se ni preko direktne adrese.`
            : `Svi kupci firme (${allScoped.length}).`
        }
      />

      <section className="portal-panel">
        <div className="portal-section-header">
          <div>
            <h2>Promet po kupcu</h2>
            <form method="get" className="portal-inline-form">
              <input type="search" name="q" defaultValue={listFilter.q} placeholder="Naziv, PIB ili grad" aria-label="Pretraga kupaca" maxLength={80} />
              {scoped ? null : (
                <select name="komercijalista" defaultValue={listFilter.rep} aria-label="Komercijalista">
                  <option value="">Svi komercijalisti</option>
                  {reps.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                  <option value="bez">Bez komercijaliste</option>
                </select>
              )}
              <select name="status" defaultValue={statusFilter} aria-label="Kupci po statusu">
                <option value="svi">Svi kupci</option>
                <option value="aktivni">Aktivni</option>
                <option value="neaktivni">Neaktivni ({neaktivnih})</option>
              </select>
              <button type="submit" className="portal-button" data-variant="primary">Prikažite</button>
            </form>
            <p>
              {filtered ? `Prikazano ${customers.length} od ${allScoped.length}. ` : ""}Iznosi su iz uvezenih faktura. Dugovanje i naplata nisu deo ovog
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
                <th scope="col">Komercijalista</th>
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
                      {customer.active ? null : <small> · neaktivan</small>}
                    </th>
                    <td>{customer.pib}</td>
                    <td>{customer.city ?? "—"}</td>
                    <td>{(assignees.get(customer.id) ?? []).map((a) => a.name).join(", ") || "—"}</td>
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
                      <UnavailableValue
                        compact
                        note="Fakture ne sadrže podatke o plaćanju."
                      />
                    </td>
                  </tr>
                );
              })}
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    {filtered && allScoped.length > 0
                      ? "Nijedan kupac ne odgovara pretrazi i izabranom komercijalisti."
                      : statusFilter !== "svi" && allScoped.length > 0
                      ? `Nema ${statusFilter === "neaktivni" ? "neaktivnih" : "aktivnih"} kupaca u ovom prikazu.`
                      : scoped
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
