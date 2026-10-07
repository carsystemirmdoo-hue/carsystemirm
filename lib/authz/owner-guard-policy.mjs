/**
 * Odluka o tome da li izmena ostavlja firmu bez vlasnika.
 *
 * Izdvojeno iz `security-admin.ts` da bi bilo pozivo iz testa: taj modul je
 * `server-only` i vuče bazu, pa se ne može uvesti u `node --test`. Ovde je čista
 * funkcija bez ijedne zavisnosti — što je i tačno ono što treba proveriti, jer
 * je ovo pravilo, a ne infrastruktura.
 */

import { packageCapabilities, resolveCapabilities } from "./permissions.mjs";

/** Uloga koja nosi upravljanje nalozima. */
export const OWNER_ROLE = "gazda";

/**
 * Da li bi izmena uklonila cilj iz skupa AKTIVNIH vlasnika.
 *
 * Tri puta vode do iste posledice — isključivanje naloga, promena uloge i
 * brisanje — i sva tri moraju koristiti isti kriterijum. Da svaki računa po
 * svome, jedan bi pre ili kasnije zaboravio slučaj koji drugi pokriva.
 *
 * @param {{ role: string, active: boolean }} target stanje PRE izmene
 * @param {{ nextRole?: string, nextActive?: boolean }} change šta se menja
 * @returns {boolean}
 */
export function removesActiveOwner(target, change = {}) {
  const wasActiveOwner = target.role === OWNER_ROLE && target.active === true;
  if (!wasActiveOwner) return false;

  const stillOwner = (change.nextRole ?? target.role) === OWNER_ROLE;
  const stillActive = change.nextActive ?? target.active;
  return !(stillOwner && stillActive);
}

/**
 * Da li broj preostalih aktivnih vlasnika dozvoljava izmenu.
 *
 * Namerno odvojeno od upita: upit mora ići pod bravom, a pravilo koje tumači
 * njegov rezultat ne mora — i tako je proverivo.
 *
 * @param {number} remainingOtherOwners aktivni vlasnici RAZLIČITI od cilja
 * @returns {boolean}
 */
export function ownerGuardAllows(remainingOtherOwners) {
  return Number.isInteger(remainingOtherOwners) && remainingOtherOwners >= 1;
}

/**
 * Da li `actor` sme da POSTAVI novog aktivnog vlasnika — bilo otvaranjem novog
 * naloga sa ulogom `OWNER_ROLE`, bilo prebacivanjem postojećeg naloga u nju.
 *
 * Zašto ovo NIJE isto što i `users:manage_security`
 * ---------------------------------------------------
 * Ta sposobnost je namerno delegabilna van uloge „gazda" — paket „Bezbednost
 * naloga" postoji baš zato da gazda može da poveri bezbednosnu administraciju
 * (reset lozinke, isključivanje naloga) nekome ko sam nije vlasnik. Ali pravo
 * da se RESETUJE tuđi pristup nije isto što i pravo da se UMNOŽI broj
 * vlasnika: ko sme da postavi vlasnika mora sam već biti vlasnik. Da je
 * dovoljna delegirana sposobnost, jedan delegiran bezbednosni paket bi bio
 * tačno jedan korak od eskalacije na puno vlasništvo — bez obzira na to koliko
 * je taj paket uzak po nameni.
 *
 * Zašto ne proverava kapacitet ni svežinu MFA
 * ---------------------------------------------
 * To rade `requireCapability`/`requireSecurityAdmin`, koji zavise od sesije i
 * baze i zato ne mogu biti čista funkcija. Ova funkcija odgovara na TAČNO
 * jedno pitanje — sme li OVAJ actor da postavi OVU ciljnu ulogu — i poziva se
 * PRE tih provera, da odbijen pokušaj nikad ne stigne do TOTP provere.
 *
 * @param {{ role: string }} actor stanje IZ SESIJE, nikad iz forme/payload-a
 * @param {string} requestedRole uloga koja se dodeljuje/postavlja
 * @returns {boolean}
 */
export function canGrantOwnerRole(actor, requestedRole) {
  // Obična ciljna uloga ne aktivira ovu kapiju — postojeća autorizacija
  // (`users:manage`, eventualno `users:manage_security` za druge radnje)
  // ostaje jedini uslov, nepromenjena ovom funkcijom.
  if (requestedRole !== OWNER_ROLE) return true;
  return actor?.role === OWNER_ROLE;
}

/* =========================================================================
 * Eskalacija ka vlasništvu
 *
 * `users:manage` (paket „Korisnici i dozvole") i `users:manage_security`
 * (paket „Bezbednost naloga") su namerno delegabilni. Bez pravila ispod, nosilac
 * paketa „Korisnici" je mogao sebi da dodeli „Bezbednost naloga", a zatim sebe
 * da prebaci u ulogu Vlasnika; nosilac „Bezbednosti naloga" je mogao da
 * resetuje lozinku i MFA Vlasnika i preuzme njegov nalog.
 *
 * Funkcije vraćaju poruku za korisnika ili `null` kada je radnja dozvoljena.
 * `actor` je uvek stanje IZ SESIJE (id, uloga, paketi), nikad iz forme.
 * ====================================================================== */

/** Paketi koji vode do upravljanja nalozima: dodeljuje ih samo Vlasnik. */
export const ESCALATION_PACKAGES = Object.freeze(["korisnici", "bezbednost_naloga"]);

/**
 * Sme li `actor` da promeni ulogu naloga `target` u `requestedRole`.
 *
 * @param {{ id: string, role: string }} actor
 * @param {{ id: string, role: string }} target stanje PRE izmene
 * @param {string} requestedRole
 * @returns {string | null}
 */
export function roleChangeRefusal(actor, target, requestedRole) {
  if (actor?.id && actor.id === target?.id) {
    return "Sopstvenu ulogu ne možete menjati. To radi drugi Vlasnik.";
  }
  if (!canGrantOwnerRole(actor, requestedRole)) {
    return "Ulogu „Vlasnik“ može dodeliti samo Vlasnik.";
  }
  if (target?.role === OWNER_ROLE && actor?.role !== OWNER_ROLE) {
    return "Ulogu Vlasnika može menjati samo Vlasnik.";
  }
  return null;
}

/**
 * Sme li `actor` da dodeli ili oduzme paket `packageKey` nalogu `target`.
 *
 * @param {{ id: string, role: string, permissions?: readonly string[] }} actor
 * @param {{ id: string }} target
 * @param {string} packageKey
 * @param {boolean} grant
 * @returns {string | null}
 */
export function packageChangeRefusal(actor, target, packageKey, grant) {
  if (grant && actor?.id && actor.id === target?.id) {
    return "Paket ne možete dodeliti sami sebi. To radi Vlasnik ili drugi administrator.";
  }
  if (ESCALATION_PACKAGES.includes(packageKey) && actor?.role !== OWNER_ROLE) {
    return "Pakete „Korisnici i dozvole“ i „Bezbednost naloga“ dodeljuje i oduzima samo Vlasnik.";
  }
  if (grant) {
    const own = resolveCapabilities(actor?.role, actor?.permissions ?? []);
    if (packageCapabilities(packageKey).some((capability) => !own.has(capability))) {
      return "Ne možete dodeliti paket koji daje pristup koji ni sami nemate.";
    }
  }
  return null;
}

/** Da li dodela/oduzimanje paketa traži svež kod iz aplikacije. */
export function packageChangeNeedsFreshMfa(packageKey) {
  return ESCALATION_PACKAGES.includes(packageKey);
}

/**
 * Sme li `actor` da izvrši bezbednosnu radnju (reset lozinke, reset MFA,
 * dozvola za vezivanje, isključivanje) nad nalogom `target`.
 *
 * @param {{ role: string }} actor
 * @param {{ role: string }} target
 * @returns {string | null}
 */
export function securityTargetRefusal(actor, target) {
  if (target?.role === OWNER_ROLE && actor?.role !== OWNER_ROLE) {
    return "Bezbednosne radnje nad nalogom Vlasnika može izvršiti samo Vlasnik.";
  }
  return null;
}
