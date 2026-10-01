import type { Metadata } from "next";
import Link from "next/link";
import { customerSignOutAction } from "@/app/prijava/kupac/actions";
import { AccountTabs } from "@/components/customer/AccountTabs";
import { DataStrip } from "@/components/portal/DataStrip";
import { getCustomerSession } from "@/lib/authz/customer-session";
import { loadDatasetInfo } from "@/lib/data-state/dataset";
import "../portal/portal.css";

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
 */
export default async function CustomerAccountLayout({ children }: { children: React.ReactNode }) {
  const [session, dataset] = await Promise.all([getCustomerSession(), loadDatasetInfo()]);
  if (!session) return <>{children}</>;
  return (
    <div className="portal-root portal-customer-area">
      <main className="portal-main">
        <DataStrip dataset={dataset} />
        <div className="ka-head">
          <div>
            <span className="ka-eyebrow">Moj nalog</span>
            <h1>{session.customerName}</h1>
            <p>
              Prijavljeni ste kao {session.name}. Nalog vidi isključivo podatke ove firme.
            </p>
          </div>
          <div className="ka-head-actions">
            <Link href="/katalog" className="portal-button" data-variant="secondary">
              Nazad na katalog
            </Link>
            <form action={customerSignOutAction}>
              <button type="submit" className="portal-button" data-variant="ghost">
                Odjavite se
              </button>
            </form>
          </div>
        </div>
        <AccountTabs />
        {children}
      </main>
    </div>
  );
}
