import "server-only";
import { forbidden, redirect } from "next/navigation";
import { auth } from "@/auth";
import { loginUrlFor } from "@/lib/authz/redirects.mjs";
import { canAccessCustomer } from "@/lib/authz/scope.mjs";
import { isInternalSubject } from "@/lib/authz/customer-scope.mjs";
import {
  can,
  landingRouteFor,
  resolveCapabilities,
} from "@/lib/authz/permissions.mjs";
import {
  isSessionVersionCurrent,
  loadAssignedCustomerIds,
  loadPortalUser,
  type PortalUser,
} from "@/lib/authz/user-repository";
import {
  ASSURANCE_PASSWORD,
  isMfaRecent,
  isSecondFactorSatisfied,
} from "@/lib/auth/session-assurance.mjs";
import {
  ACCESS_DENIED,
  ACCESS_ENROLLMENT_ONLY,
  ACCESS_FULL,
  mfaStateFrom,
  resolveMfaMode,
  resolvePortalAccess,
  type AccessLevel,
} from "@/lib/auth/mfa-policy.mjs";
import { hasOpenEnrollmentGrant } from "@/lib/auth/enrollment-grant";

export type { PortalUser };

/**
 * Trenutni korisnik ili `null`. Uloga i dozvole se čitaju iz baze pri svakom
 * pozivu — token sesije nosi samo identitet.
 */
export async function getPortalUser(): Promise<PortalUser | null> {
  return (await loadAuthenticatedSession())?.fullAccess ?? null;
}

/**
 * Sesija sa izričitim nivoom pristupa.
 *
 * `access` je izvor istine i ima tri vrednosti — `denied`, `enrollment-only`,
 * `full`. Polja `fullAccess` i `enrollmentOnly` su izvedena iz njega, radi
 * pozivalaca kojima treba sam korisnik.
 *
 * Zašto izričito, a ne „nema punog znači vezivanje"
 * ------------------------------------------------
 * Kada je nivo pristupa samo odsustvo nečega, dovoljna je jedna provera koja
 * gleda pogrešno polje — ili jedan `if (user)` nad nepotpunim objektom — da
 * neverifikovan korisnik prođe kao pun. Sa tri imenovane vrednosti takva
 * greška ne izgleda kao ispravan kod.
 */
export type AuthenticatedSession = {
  user: PortalUser;
  /** Jedini izvor istine o nivou pristupa. */
  access: AccessLevel;
  assurance: string;
  mfaVerifiedAt: number | null;
  /** Izvedeno iz `access`; `null` kada pristup nije pun. */
  fullAccess: PortalUser | null;
  /** Izvedeno iz `access`; `null` kada sesija nije samo za vezivanje. */
  enrollmentOnly: PortalUser | null;
};

export async function loadAuthenticatedSession(): Promise<AuthenticatedSession | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  /*
   * Interna kapija odbija kupčev token IZRIČITO.
   *
   * Razdvojenost tabela je i dalje glavna garancija — kupčev ID ne postoji u
   * `users`, pa `loadPortalUser` vraća `null`. Ali oslanjati se samo na to
   * znači da je kontrola nevidljiva i da je nova šema može tiho ukinuti. Ovde
   * je izgovorena, i postflight audit (F-3) je tražio upravo to: helper koji je
   * bio testiran kao kapija, a nigde nije pozvan.
   *
   * Fail-closed: `customer` pada; odsustvo claim-a se i dalje tumači kao
   * interni nalog, jer tokeni izdati pre uvođenja polja moraju nastaviti da
   * važe, a podrazumevana vrednost vodi ka MANJEM pristupu.
   */
  if (!isInternalSubject(session.user)) return null;

  const user = await loadPortalUser(userId);
  if (!user) return null;

  const assurance = session.user.assurance ?? ASSURANCE_PASSWORD;
  const mfaVerifiedAt = session.user.mfaVerifiedAt ?? null;

  /*
   * Stanje MFA se čita iz BAZE, ne iz tokena: kada vlasnik poništi tuđi faktor,
   * to mora delovati odmah, a ne tek pri sledećoj prijavi.
   */
  const { readMfaStatus } = await import("@/lib/auth/mfa-service");
  const mfa = await readMfaStatus(user.id);
  const mfaState = mfaStateFrom(mfa);

  const { mode, environment } = resolveMfaMode(process.env);

  // Dozvola se čita samo kada od nje zavisi odluka — vidi `resolvePortalAccess`.
  const grantAvailable =
    mode === "enforced" && mfaState !== "active"
      ? await hasOpenEnrollmentGrant(user.id)
      : false;

  /*
   * Ista funkcija koja je odlučivala pri prijavi odlučuje i ovde.
   *
   * Ranije su to bile dve odvojene grane, i za režim `enroll` su davale
   * suprotne odgovore. Sada postoji jedan poziv — ako se pravilo promeni,
   * promeni se na oba mesta istovremeno, jer je mesto jedno.
   */
  const decision = resolvePortalAccess({
    mode,
    environment,
    accountActive: user.active,
    sessionVersionCurrent: isSessionVersionCurrent(
      session.user.sessionVersion,
      user.sessionVersion,
    ),
    mfaState,
    // Token nosi šta je potvrđeno; `isSecondFactorSatisfied` to prevodi u faktor.
    factor: isSecondFactorSatisfied(assurance)
      ? assurance === "recovery"
        ? "recovery"
        : "totp"
      : "none",
    grantAvailable,
  });

  if (decision.access === ACCESS_DENIED) return null;

  return {
    user,
    access: decision.access,
    assurance,
    mfaVerifiedAt,
    fullAccess: decision.access === ACCESS_FULL ? user : null,
    enrollmentOnly: decision.access === ACCESS_ENROLLMENT_ONLY ? user : null,
  };
}

/** Jedina ruta koja prima sesiju samo za vezivanje. */
export const MFA_ENROLLMENT_ROUTE = "/portal/bezbednost/mfa";

/**
 * Korisnik koji sme samo na vezivanje drugog faktora.
 *
 * Pun korisnik takođe sme na taj ekran — tamo menja uređaj i izdaje nove
 * rezervne kodove.
 */
export async function requireEnrollmentUser(): Promise<PortalUser> {
  const session = await loadAuthenticatedSession();
  const user = session?.fullAccess ?? session?.enrollmentOnly;
  if (!user) redirect(loginUrlFor(MFA_ENROLLMENT_ROUTE));
  return user;
}

/**
 * Korisnik sa punim portal pristupom.
 *
 * Enrollment-only sesija se NE odbija na prijavu nego šalje na vezivanje.
 * Slanje na prijavu bi bila petlja: korisnik se uspešno prijavi, dobije istu
 * ograničenu sesiju i vrati se na isti ekran, bez ijednog objašnjenja šta od
 * njega traže.
 *
 * Odbijanje ostaje odbijanje: nijedna portal ruta ne renderuje sadržaj takvoj
 * sesiji, bez obzira na to kuda je preusmerena.
 */
export async function requireFullPortalUser(callbackPath?: string): Promise<PortalUser> {
  const session = await loadAuthenticatedSession();
  if (session?.fullAccess) return session.fullAccess;
  if (session?.enrollmentOnly) redirect(MFA_ENROLLMENT_ROUTE);
  redirect(loginUrlFor(callbackPath));
}

/**
 * Osetljiva radnja traži SVEŽU potvrdu drugog faktora.
 *
 * Sesija traje osam sati; brisanje naloga ili promena tuđe lozinke ne smeju
 * proći na osnovu potvrde od jutros.
 */
export async function requireRecentMfa(): Promise<PortalUser> {
  const session = await loadAuthenticatedSession();
  if (!session?.fullAccess) forbidden();
  if (!isSecondFactorSatisfied(session.assurance)) forbidden();
  if (!isMfaRecent(session.mfaVerifiedAt)) forbidden();
  return session.fullAccess;
}

/**
 * Zahteva prijavljenog korisnika. Neprijavljen posetilac ide na prijavu, sa
 * putanjom na koju se vraća posle uspešne prijave.
 */
export async function requireUser(callbackPath?: string): Promise<PortalUser> {
  // Isti put kao `requireFullPortalUser`: jedno pravilo, jedno ponašanje.
  return requireFullPortalUser(callbackPath);
}

/**
 * Serverska kapija za stranice portala.
 *
 * Skrivanje stavke iz navigacije je samo kozmetika; ovo je provera koja zaista
 * važi. Direktno otvaranje zabranjene adrese vraća 403, a ne sadržaj.
 */
export async function requireCapability(
  capability: string,
  callbackPath?: string,
): Promise<PortalUser> {
  const user = await requireUser(callbackPath);
  if (!can(user, capability)) forbidden();
  return user;
}

/**
 * Sprečava čitanje tuđeg kupca menjanjem ID-a u adresi.
 * Gazda, kancelarija i nosioci paketa „analitika" vide sve; komercijalista samo dodeljene.
 */
export async function requireCustomerAccess(
  user: PortalUser,
  customerId: string,
): Promise<void> {
  const assigned = await loadAssignedCustomerIds(user.id);
  if (!canAccessCustomer(user, assigned, customerId)) forbidden();
}

export function capabilitiesOf(user: PortalUser): Set<string> {
  return resolveCapabilities(user.role, user.permissions);
}

export function landingRoute(user: PortalUser): string {
  return landingRouteFor(user);
}

export class ApiAuthError extends Error {
  constructor(
    readonly status: 401 | 403,
    message: string,
  ) {
    super(message);
    this.name = "ApiAuthError";
  }
}

/**
 * Varijanta za route handler-e: umesto preusmeravanja vraća status koji klijent
 * može da obradi (401 neprijavljen, 403 nedovoljne dozvole).
 */
export async function requireApiCapability(
  capability: string,
): Promise<PortalUser> {
  const user = await getPortalUser();
  if (!user) throw new ApiAuthError(401, "Potrebna je prijava.");
  if (!can(user, capability)) {
    throw new ApiAuthError(403, "Nemate dozvolu za ovu radnju.");
  }
  return user;
}

export function apiAuthResponse(error: unknown): Response | null {
  if (error instanceof ApiAuthError) {
    // Odbijanje zavisi od sesije pozivaoca; ne sme se keširati ni deliti.
    return Response.json({ error: error.message }, { status: error.status, headers: { "Cache-Control": "private, no-store" } });
  }
  return null;
}
