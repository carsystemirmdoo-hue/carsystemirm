import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PortalLoginForm } from "@/features/portal/PortalLoginForm";
import { landingRouteFor } from "@/lib/authz/permissions.mjs";
import { resolvePostLoginTarget } from "@/lib/authz/redirects.mjs";
import {
  loadAuthenticatedSession,
  MFA_ENROLLMENT_ROUTE,
} from "@/lib/authz/session";
import "../portal/portal.css";

export const metadata: Metadata = {
  title: "Prijava · Poslovni sistem",
  robots: { index: false, follow: false, noarchive: true },
};

export const dynamic = "force-dynamic";

/**
 * Prijava je van `/portal` da bi zaštićene rute mogle da je koriste bez
 * kruženja kroz sopstveni layout. Odredište stiže kao `callbackUrl` parametar —
 * nikada nadovezano na putanju.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  const session = await loadAuthenticatedSession();

  /*
   * Sesija samo za vezivanje ide pravo na vezivanje.
   *
   * Bez ovoga bi takav korisnik video obrazac za prijavu, uspešno se prijavio,
   * dobio istu ograničenu sesiju i vratio se ovde — petlja bez objašnjenja.
   */
  if (session?.enrollmentOnly) redirect(MFA_ENROLLMENT_ROUTE);

  if (session?.fullAccess) {
    redirect(
      resolvePostLoginTarget(callbackUrl, landingRouteFor(session.fullAccess)),
    );
  }

  return <PortalLoginForm callbackUrl={callbackUrl ?? ""} />;
}
