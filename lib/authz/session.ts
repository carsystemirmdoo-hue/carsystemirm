import "server-only";
import { forbidden, redirect } from "next/navigation";
import { auth } from "@/auth";
import { loginUrlFor } from "@/lib/authz/redirects.mjs";
import { canAccessCustomer } from "@/lib/authz/scope.mjs";
import {
  can,
  landingRouteFor,
  resolveCapabilities,
} from "@/lib/authz/permissions.mjs";
import {
  loadAssignedCustomerIds,
  loadPortalUser,
  type PortalUser,
} from "@/lib/authz/user-repository";

export type { PortalUser };

/**
 * Trenutni korisnik ili `null`. Uloga i dozvole se čitaju iz baze pri svakom
 * pozivu — token sesije nosi samo identitet.
 */
export async function getPortalUser(): Promise<PortalUser | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;
  return loadPortalUser(userId);
}

/**
 * Zahteva prijavljenog korisnika. Neprijavljen posetilac ide na prijavu, sa
 * putanjom na koju se vraća posle uspešne prijave.
 */
export async function requireUser(callbackPath?: string): Promise<PortalUser> {
  const user = await getPortalUser();
  if (user) return user;

  redirect(loginUrlFor(callbackPath));
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
    return Response.json({ error: error.message }, { status: error.status });
  }
  return null;
}
