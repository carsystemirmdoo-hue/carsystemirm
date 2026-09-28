import type { Metadata } from "next";
import { cookies } from "next/headers";
import { PortalShell } from "@/components/portal/PortalShell";
import {
  parseSidebarState,
  SIDEBAR_COOKIE,
  SIDEBAR_PREFERENCE_KEY,
} from "@/components/portal/sidebarState.mjs";
import { navGroupsFor, ROLE_LABELS } from "@/lib/authz/permissions.mjs";
import { loadAuthenticatedSession } from "@/lib/authz/session";
import { loginUrlFor } from "@/lib/authz/redirects.mjs";
import { redirect } from "next/navigation";
import { readUserPreference } from "@/lib/authz/user-repository";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { CartProvider } from "@/components/cart/CartProvider";
import { getPortalCommerceAccess } from "@/lib/commerce/portal-commerce";
import { signOutAction } from "./actions";
import { BreadcrumbProvider } from "@/components/portal/Breadcrumbs";
import { DataStrip } from "@/components/portal/DataStrip";
import { loadDatasetInfo } from "@/lib/data-state/dataset";
import "./portal.css";

export const metadata: Metadata = {
  title: "Poslovni sistem · Carsystem i R-M",
  description: "Interni poslovni sistem Carsystem i R-M Inđija d.o.o.",
  robots: { index: false, follow: false, noarchive: true },
};

// Svaki prikaz zavisi od prijavljenog korisnika i njegovih dozvola,
// pa se ništa ne sme unapred generisati u statičku stranu.
export const dynamic = "force-dynamic";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await loadAuthenticatedSession();
  if (!session) redirect(loginUrlFor());

  /*
   * Sesija samo za vezivanje dobija okvir BEZ portala.
   *
   * Ekran za vezivanje živi pod `/portal`, pa bi layout koji traži pun pristup
   * zaključao korisnika napolju: preusmerio bi ga na vezivanje, a vezivanje je
   * iza istog layouta. Zato ovde postoji drugi, prazan okvir.
   *
   * Prazan je namerno — bez navigacije, bez korpe, bez ijedne poslovne
   * komponente. Ono što se ne montira ne može ni da procuri, a stranice ionako
   * svaka za sebe odbijaju ovakvu sesiju.
   */
  if (session.enrollmentOnly) {
    return <main className="portal-enrollment-frame">{children}</main>;
  }

  const user = session.fullAccess;
  if (!user) redirect(loginUrlFor());

  // Korpa se montira samo uz uključen portal commerce i ovlašćenu sesiju.
  const commerce = await getPortalCommerceAccess();

  const cookieStore = await cookies();
  const cookieState = cookieStore.get(SIDEBAR_COOKIE)?.value;
  // Kolačić ima prednost jer stiže iz tekućeg pregledača; podešavanje naloga
  // je rezerva kada korisnik prvi put otvori sistem na drugom računaru.
  const savedPreference = await readUserPreference(
    user.id,
    SIDEBAR_PREFERENCE_KEY,
  );
  const collapsed =
    cookieState !== undefined
      ? parseSidebarState(cookieState)
      : savedPreference === true;

  const dataset = await loadDatasetInfo();

  const shell = (
    <BreadcrumbProvider>
      <PortalShell
        user={{
          name: user.name,
          initials: user.initials,
          roleLabel: ROLE_LABELS[user.role],
        }}
        navGroups={navGroupsFor(user)}
        initialCollapsed={collapsed}
        onSignOut={signOutAction}
        showCart={commerce.allowed}
        dataNotice={<DataStrip dataset={dataset} />}
      >
        {children}
      </PortalShell>
    </BreadcrumbProvider>
  );

  // Bez dozvole se cart sloj uopšte ne montira — nema providera, drawera ni
  // čitanja cart localStorage stanja.
  if (!commerce.allowed) return shell;

  return (
    <CartProvider userScope={user.id}>
      {shell}
      <CartDrawer />
    </CartProvider>
  );
}
