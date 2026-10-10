import type { Metadata } from "next";
import Link from "next/link";
import { customerSignOutAction } from "@/app/prijava/kupac/actions";
import { AccountTabs } from "@/components/customer/AccountTabs";
import { DataStrip } from "@/components/portal/DataStrip";
import { getCustomerSession } from "@/lib/authz/customer-session";
import { loadDatasetInfo } from "@/lib/data-state/dataset";
import { publicSiteOpen } from "@/lib/site-mode";
import { orderingEnabledFor } from "@/lib/ordering/trial";
import { countCustomerOrdersAwaiting } from "@/lib/ordering/ordering-service";
import "../portal/portal.css";
import "../portal/panel.css";

export const metadata: Metadata = {
  title: "Moj nalog · Carsystem i R-M",
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
 * Firma i odjava su u jednom tankom redu; naslov strane (h1) daje svaka strana.
 */
export default async function CustomerAccountLayout({ children }: { children: React.ReactNode }) {
  const [session, dataset] = await Promise.all([getCustomerSession(), loadDatasetInfo()]);
  if (!session) return <>{children}</>;
  const [ordering, awaiting] = await Promise.all([orderingEnabledFor(session.customerId), countCustomerOrdersAwaiting(session.customerId)]);
  return (
    <div className="portal-root portal-customer-area">
      <main className="portal-main">
        <DataStrip dataset={dataset} />
        <div className="pn-account">
          <div className="pn-account-name">
            <strong>{session.customerName}</strong>
            <span>Prijavljeni ste kao {session.name}. Nalog vidi isključivo podatke ove firme.</span>
          </div>
          <div className="pn-inline">
            {publicSiteOpen() ? (
              <Link href="/katalog" className="pn-btn" data-size="sm">
                Nazad na katalog
              </Link>
            ) : null}
            <form action={customerSignOutAction}>
              <button type="submit" className="pn-btn" data-size="sm">
                Odjavite se
              </button>
            </form>
          </div>
        </div>
        <AccountTabs ordering={ordering} awaiting={awaiting} />
        {children}
      </main>
    </div>
  );
}
