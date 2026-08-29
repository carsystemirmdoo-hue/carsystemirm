import { asc } from "drizzle-orm";
import { PageHeader } from "@/components/portal/PortalPrimitives";
import { getDb } from "@/db/client";
import { customers } from "@/db/schema";
import { can } from "@/lib/authz/permissions.mjs";
import { requireCapability } from "@/lib/authz/session";
import { listCustomerAccounts } from "@/lib/customers/account-service";
import { AccountsAdmin } from "./AccountsAdmin";

export const dynamic = "force-dynamic";

export default async function CustomerAccountsPage() {
  const user = await requireCapability("view:kupacki_nalozi", "/portal/kupci/nalozi");
  const canManage = can(user, "customer_accounts:manage");

  const [accounts, customerRows] = await Promise.all([
    listCustomerAccounts(),
    getDb()
      .select({ id: customers.id, name: customers.name, pib: customers.pib })
      .from(customers)
      .orderBy(asc(customers.name))
      .limit(1000),
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
      />
    </>
  );
}
