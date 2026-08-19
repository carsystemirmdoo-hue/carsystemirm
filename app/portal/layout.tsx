import type { Metadata } from "next";
import { cookies } from "next/headers";
import { PortalShell } from "@/components/portal/PortalShell";
import {
  parseSidebarState,
  SIDEBAR_COOKIE,
  SIDEBAR_PREFERENCE_KEY,
} from "@/components/portal/sidebarState.mjs";
import { navGroupsFor, ROLE_LABELS } from "@/lib/authz/permissions.mjs";
import { requireUser } from "@/lib/authz/session";
import { readUserPreference } from "@/lib/authz/user-repository";
import { signOutAction } from "./actions";
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
  // Prijava je van /portal, pa svaka ruta ovde zahteva prijavljenog korisnika.
  const user = await requireUser();

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

  return (
    <PortalShell
      user={{
        name: user.name,
        initials: user.initials,
        roleLabel: ROLE_LABELS[user.role],
      }}
      navGroups={navGroupsFor(user)}
      initialCollapsed={collapsed}
      onSignOut={signOutAction}
    >
      {children}
    </PortalShell>
  );
}
