import "server-only";
import { inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { customerGroupMembers, customers } from "@/db/schema";
import { customerIdScopeFor } from "@/lib/authz/customer-scope.mjs";
import { seesAllCustomers } from "@/lib/authz/permissions.mjs";
import { loadAssignedCustomerIds, type PortalUser } from "@/lib/authz/user-repository";

/**
 * Opseg kupaca za pricing ekrane.
 *
 * Postoji zato što je postflight audit (F-2) našao da su sva pricing čitanja
 * bila NEOGRANIČENA: komercijalista sa paketom `cene_predlog` dobija
 * `view:cene`, a nema `customers:view_all` — pa je video imena i rabate svih
 * kupaca firme, i mogao je da pročita cenu bilo kog kupca stavljanjem njegovog
 * ID-a u adresu.
 *
 * Ovde se opseg razrešava JEDNOM i prosleđuje svakom upitu. Alternativa —
 * da svaki upit sam odlučuje — je tačno raspored u kome jedan upit ostane bez
 * uslova i niko to ne primeti.
 */
export type PricingScope = {
  /** `true` kada korisnik sme da vidi sve kupce (`customers:view_all`). */
  seesAll: boolean;
  /**
   * Dodeljeni kupci. `null` znači „bez ograničenja"; prazan niz znači „nijedan".
   *
   * Razlika je bitna: `null` izostavlja uslov iz upita, `[]` ga čini
   * nezadovoljivim. Zamena to dvoje pretvara komercijalistu bez ijedne dodele
   * u korisnika koji vidi sve.
   */
  customerIds: string[] | null;
  /** Grupe koje sadrže bar jednog dodeljenog kupca; `null` uz `seesAll`. */
  groupIds: string[] | null;
};

/**
 * Razrešava opseg iz baze.
 *
 * Grupe se izvode iz dodeljenih kupaca, a ne uzimaju sve: grupno pravilo je
 * vidljivo samo ako dodiruje bar jednog kupca koji je korisniku dodeljen. Bez
 * toga bi naziv grupe i njen rabat curili komercijalisti koji sa tom grupom
 * nema nikakve veze.
 */
export async function resolvePricingScope(user: PortalUser): Promise<PricingScope> {
  if (seesAllCustomers(user)) {
    return { seesAll: true, customerIds: null, groupIds: null };
  }

  const assigned = await loadAssignedCustomerIds(user.id);
  // Isti helper koji čuva pravilo „prazan opseg je `[]`, nikad `null`".
  const customerIds = customerIdScopeFor(user, assigned, seesAllCustomers) ?? [];

  if (customerIds.length === 0) {
    return { seesAll: false, customerIds: [], groupIds: [] };
  }

  const db = getDb();
  const rows = await db
    .selectDistinct({ groupId: customerGroupMembers.groupId })
    .from(customerGroupMembers)
    .where(inArray(customerGroupMembers.customerId, customerIds));

  return {
    seesAll: false,
    customerIds,
    groupIds: rows.map((row) => row.groupId),
  };
}

/**
 * Kupci koje korisnik sme da ponudi u izborniku.
 *
 * Obrazac koji nudi kupca kog korisnik ne sme da dodirne uči ga da pokušava, a
 * pokušaj koji server odbije izgleda kao kvar. Spisak je zato već skopiran.
 */
export async function listScopedCustomers(
  user: PortalUser,
): Promise<{ id: string; name: string; pib: string }[]> {
  const scope = await resolvePricingScope(user);
  const db = getDb();

  if (scope.seesAll) {
    return db
      .select({ id: customers.id, name: customers.name, pib: customers.pib })
      .from(customers)
      .limit(1000);
  }
  if (!scope.customerIds || scope.customerIds.length === 0) return [];

  return db
    .select({ id: customers.id, name: customers.name, pib: customers.pib })
    .from(customers)
    .where(inArray(customers.id, scope.customerIds))
    .limit(1000);
}

export class PricingScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PricingScopeError";
  }
}

/**
 * Kapija za `customerId` koji je stigao iz zahteva.
 *
 * `searchParams`, telo forme i query parametar NIKADA nisu dovoljni. Svaka
 * vrednost odatle mora proći ovuda pre nego što uđe u upit.
 *
 * Baca umesto da vrati `false`: pozivalac koji zaboravi da proveri povratnu
 * vrednost dobio bi tiho propuštanje, a to je tačno oblik greške koji je
 * audit i našao.
 */
export async function assertPricingCustomerAccess(
  user: PortalUser,
  requestedCustomerId: string,
): Promise<void> {
  const scope = await resolvePricingScope(user);
  if (scope.seesAll) return;
  if ((scope.customerIds ?? []).includes(requestedCustomerId)) return;

  throw new PricingScopeError(
    "Kupac nije u vašem opsegu. Cena se ne prikazuje.",
  );
}
