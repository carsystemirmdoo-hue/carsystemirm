import { PageHeader } from "@/components/portal/PortalPrimitives";
import { can } from "@/lib/authz/permissions.mjs";
import { requireCapability } from "@/lib/authz/session";
import { listCustomerAccounts } from "@/lib/customers/account-service";
import { listScopedCustomers } from "@/lib/pricing/pricing-scope";
import { listAccountGates } from "@/lib/customers/verification-service";
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
  // Kapija se računa na serveru; ekran je samo prikazuje (i server je proverava ponovo).
  const gates = canManage ? await listAccountGates(accounts.map((a) => a.id)) : new Map();

  return (
    <>
      <PageHeader
        eyebrow="Prodaja"
        title="Nalozi kupaca"
        description="Kupčev nalog je odvojen identitet, ne peta interna uloga. Nalog fizički nosi svoj customer_id i ne postoji putanja u kojoj se taj podatak uzima odnekud drugde."
      />
      <AccountsAdmin
        accounts={accounts.map((a) => ({ ...a, gate: gates.get(a.id) ?? null }))}
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
