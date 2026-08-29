import { PageHeader } from "@/components/portal/PortalPrimitives";
import { can } from "@/lib/authz/permissions.mjs";
import { requireCapability } from "@/lib/authz/session";
import { listCustomerAccounts } from "@/lib/customers/account-service";
import { listScopedCustomers } from "@/lib/pricing/pricing-scope";
import { AccountsAdmin } from "./AccountsAdmin";

export const dynamic = "force-dynamic";

export default async function CustomerAccountsPage() {
  const user = await requireCapability("view:kupacki_nalozi", "/portal/kupci/nalozi");
  const canManage = can(user, "customer_accounts:manage");
  const canPropose = can(user, "customer_accounts:propose");

  /*
   * Izbornik kupaca je skopiran na dodeljene.
   *
   * Komercijalista sme da predloži kontakt samo za svog kupca; obrazac zato ni
   * ne nudi tuđeg. Server to i sam proverava (`requireCustomerAccess`).
   */
  const [accounts, customerRows] = await Promise.all([
    listCustomerAccounts(),
    listScopedCustomers(user),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Prodaja"
        title="Nalozi kupaca"
        description="Kupčev nalog je odvojen identitet, ne peta interna uloga. Nalog fizički nosi svoj customer_id i ne postoji putanja u kojoj se taj podatak uzima odnekud drugde."
      />
      <AccountsAdmin
        accounts={accounts}
        customers={customerRows.map((customer) => ({
          id: customer.id,
          label: `${customer.name} · PIB ${customer.pib}`,
        }))}
        canManage={canManage}
        canPropose={canPropose}
      />
    </>
  );
}
