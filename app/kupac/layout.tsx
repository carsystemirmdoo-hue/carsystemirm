import type { Metadata } from "next";
import { AccountTabs } from "@/components/customer/AccountTabs";
import { DataStrip } from "@/components/portal/DataStrip";
import { getCustomerSession } from "@/lib/authz/customer-session";
import { loadDatasetInfo } from "@/lib/data-state/dataset";
import { orderingEnabledFor } from "@/lib/ordering/trial";
import { countCustomerOrdersAwaiting } from "@/lib/ordering/ordering-service";
import "../portal/portal.css";
import "../portal/panel.css";

export const metadata: Metadata = {
  title: { default: "Moj nalog", template: "%s · Moj nalog | Carsystem i R-M" },
  robots: { index: false, follow: false, noarchive: true },
};

export const dynamic = "force-dynamic";

/**
 * Okvir kupčevog naloga na javnom sajtu.
 *
 * Bez sesije okvir se ne iscrtava — strana sama preusmerava na prijavu sa
 * povratnom adresom (`requireCustomerSession(putanja)`), pa se posle prijave
 * kupac vraća baš tamo gde je krenuo.
 *
 * Odmah ispod javnog menija su kartice naloga; firma i odjava su u meniju
 * „Moj nalog“, a povratak na sajt daje sam meni (2026-11-04).
 */
export default async function CustomerAccountLayout({ children }: { children: React.ReactNode }) {
  const [session, dataset] = await Promise.all([getCustomerSession(), loadDatasetInfo()]);
  if (!session) return <>{children}</>;
  const [ordering, awaiting] = await Promise.all([orderingEnabledFor(session.customerId), countCustomerOrdersAwaiting(session.customerId)]);
  return (
    <div className="portal-root portal-customer-area">
      <main className="portal-main">
        <DataStrip dataset={dataset} />
        <AccountTabs ordering={ordering} awaiting={awaiting} />
        {children}
      </main>
    </div>
  );
}
