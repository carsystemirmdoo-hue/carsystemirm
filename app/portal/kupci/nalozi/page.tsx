import { PageHeader } from "@/components/portal/PortalPrimitives";
import { can } from "@/lib/authz/permissions.mjs";
import { requireCapability } from "@/lib/authz/session";
import { listCustomerAccounts } from "@/lib/customers/account-service";
import { listScopedCustomers } from "@/lib/pricing/pricing-scope";
import { listAccountGates } from "@/lib/customers/verification-service";
import { AccountsAdmin } from "./AccountsAdmin";
import { OutboxPanel } from "./OutboxPanel";
import { listPendingOutbox } from "@/lib/customers/invitation-service";


export const metadata = { title: "Nalozi kupaca" };

export const dynamic = "force-dynamic";

export default async function CustomerAccountsPage() {
  const user = await requireCapability("view:kupacki_nalozi", "/portal/kupci/nalozi");
  const canManage = can(user, "customer_accounts:manage");
  const canPropose = can(user, "customer_accounts:propose");

  /*
   * I spisak naloga i izbornik kupaca su skopirani na dodeljene.
   *
   * Komercijalista sme da predloži kontakt samo za svog kupca; obrazac zato ni
   * ne nudi tuđeg. Server to i sam proverava (`requireCustomerAccess`).
   */
  const [accounts, customerRows] = await Promise.all([
    listCustomerAccounts(user),
    listScopedCustomers(user),
  ]);
  // Kapija se računa na serveru; ekran je samo prikazuje (i server je proverava ponovo).
  const gates = canManage ? await listAccountGates(accounts.map((a) => a.id)) : new Map();
  // Poruke za ručnu predaju (B10): samo ko upravlja nalozima, u istom opsegu.
  const outbox = canManage ? await listPendingOutbox(user) : [];

  return (
    <>
      <PageHeader
        eyebrow="Prodaja"
        title="Nalozi kupaca"
        description="Kupčev nalog je odvojen identitet, ne peta interna uloga. Nalog nosi oznaku svog kupca i ne postoji put kojim bi se ta oznaka uzela odnekud drugde."
      />
      {canManage ? (
        <OutboxPanel
          items={outbox.map((m) => ({
            id: m.id,
            kind: m.kind,
            createdAt: m.createdAt.toISOString(),
            email: m.email,
            customerName: m.customerName,
            accountStatus: m.accountStatus,
          }))}
        />
      ) : null}
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
