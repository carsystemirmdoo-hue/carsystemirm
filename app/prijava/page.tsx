import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PortalLoginForm } from "@/features/portal/PortalLoginForm";
import { landingRouteFor } from "@/lib/authz/permissions.mjs";
import { isMfaRecent, isSecondFactorSatisfied } from "@/lib/auth/session-assurance.mjs";
import { readMfaStatus } from "@/lib/auth/mfa-service";
import { normalizeCallback, REAUTH_PARAM, REAUTH_VALUE, resolvePostLoginTarget } from "@/lib/authz/redirects.mjs";
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
  searchParams: Promise<{ callbackUrl?: string; [REAUTH_PARAM]?: string }>;
}) {
  const params = await searchParams;
  const { callbackUrl } = params;
  const session = await loadAuthenticatedSession();

  /*
   * Sesija samo za vezivanje ide pravo na vezivanje.
   *
   * Bez ovoga bi takav korisnik video obrazac za prijavu, uspešno se prijavio,
   * dobio istu ograničenu sesiju i vratio se ovde — petlja bez objašnjenja.
   */
  if (session?.enrollmentOnly) redirect(MFA_ENROLLMENT_ROUTE);

  /*
   * Ponovna potvrda identiteta: sesija važi, ali osetljiva radnja traži drugi
   * faktor u poslednjih 10 minuta. Isti obrazac i isti `authorize` izdaju novu
   * sesiju sa svežom potvrdom; povratak je na istu putanju (`callbackUrl`).
   */
  if (
    session?.fullAccess &&
    params[REAUTH_PARAM] === REAUTH_VALUE &&
    !(isSecondFactorSatisfied(session.assurance) && isMfaRecent(session.mfaVerifiedAt))
  ) {
    const mfa = await readMfaStatus(session.fullAccess.id);
    return (
      <PortalLoginForm
        // Povratna veza „Odustanite" prikazuje se samo za proverenu putanju unutar portala.
        callbackUrl={normalizeCallback(callbackUrl) ?? ""}
        reauth={{ email: session.fullAccess.email, hasSecondFactor: mfa.enabled }}
      />
    );
  }

  if (session?.fullAccess) {
    redirect(
      resolvePostLoginTarget(callbackUrl, landingRouteFor(session.fullAccess)),
    );
  }

  return <PortalLoginForm callbackUrl={callbackUrl ?? ""} />;
}
