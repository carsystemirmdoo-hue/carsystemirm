import "server-only";
import { and, eq, ne, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { clientIpFromRequest } from "@/lib/auth/client-ip";
import { verifyTotpForUser } from "@/lib/auth/mfa-service";
import {
  clearAccountAttempts,
  isBucketBlocked,
  registerAttempt,
} from "@/lib/auth/rate-limit-service";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit/record";
import {
  ownerGuardAllows,
  removesActiveOwner,
} from "@/lib/authz/owner-guard-policy.mjs";
import { requireCapability, requireFullPortalUser } from "@/lib/authz/session";
import type { PortalUser } from "@/lib/authz/user-repository";

/**
 * Jedina kapija za administratorske bezbednosne radnje nad TUĐIM nalogom.
 *
 * Zašto na jednom mestu
 * ---------------------
 * Provere razasute po komponentama znače da jedna zaboravljena grana otvara
 * rupu koju niko ne primeti dok se ne iskoristi. Ovde su sva pravila zajedno,
 * pa se svaka nova radnja prirodno vezuje za istu kapiju umesto da izmišlja
 * svoju. Poziv `requireSecurityAdmin` je jedini ispravan ulaz.
 *
 * Šta se traži
 * ------------
 *   1. puna portal sesija — `enrollment-only` ne prolazi,
 *   2. sposobnost `users:manage` iz postojećeg modela paketa,
 *   3. **svež TOTP unet baš za tu radnju**.
 *
 * Treća stavka je ono što razlikuje ovu kapiju od obične provere dozvole.
 * Potvrda iz prijave ne važi: ko dođe do otvorenog laptopa ne sme moći da
 * resetuje tuđe lozinke ili ugasi naloge. Kod ide kroz `verifyTotpForUser`,
 * dakle sa istom zaštitom od ponovne upotrebe kao pri prijavi — presretnut kod
 * ne prolazi drugi put.
 *
 * Namerno NEMA izuzetka za „vlasnika" ni za bilo koga drugog. Prečica koja
 * preskače drugi faktor bila bi tačno ona rupa koju ovaj modul zatvara.
 */

/**
 * Sposobnost koju nosi paket „Bezbednost naloga".
 *
 * Namerno UŽA od `users:manage`. Taj paket („Korisnici i dozvole") dobija svako
 * ko vodi naloge — uključujući magacionera kome je poveren unos zaposlenih — a
 * radnje ispod nisu vođenje naloga nego preuzimanje tuđeg pristupa. Da dele
 * istu sposobnost, delegiranje svakodnevnog posla poklanjalo bi i mogućnost da
 * se preuzme vlasnikov nalog.
 */
export const SECURITY_ADMIN_CAPABILITY = "users:manage_security";

export class SecurityActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecurityActionError";
  }
}

/**
 * Ista poruka za sve odbijene pokušaje.
 *
 * Iz odgovora se ne sme zaključiti šta je tačno bilo pogrešno — kod, cilj ili
 * postojanje naloga.
 */
export const SECURITY_GENERIC_ERROR =
  "Radnja nije izvršena. Proverite kod iz aplikacije i pokušajte ponovo.";

/**
 * Administrator ovlašćen za bezbednosnu radnju, uz svež drugi faktor.
 *
 * Nedostatak sposobnosti daje 403 kroz `requireCapability` — to je pokušaj
 * pristupa tuđoj funkciji. Pogrešan kod baca `SecurityActionError`, jer je to
 * greška u unosu koju obrazac treba da prikaže.
 *
 * @param totpToken kod unet u obrascu te radnje, nikad iz prijave
 */
export async function requireSecurityAdmin(totpToken: string): Promise<PortalUser> {
  // Puna sesija prvo: enrollment-only ne sme ni do provere sposobnosti.
  await requireFullPortalUser();
  const actor = await requireCapability(SECURITY_ADMIN_CAPABILITY);

  const clientIp = await clientIpFromRequest();

  /*
   * Pokušaji se broje i ovde, ne samo pri prijavi.
   *
   * Kod ima šest cifara. Zaštita od ponovne upotrebe sprečava da presretnut kod
   * prođe drugi put, ali ne sprečava **pogađanje**: ko je došao do otvorene
   * sesije mogao bi da šalje obrasce dok ne pogodi. Bez brojača je to pitanje
   * minuta, a nagrada je reset tuđe lozinke.
   *
   * Blokada se gleda PRE provere, da zaključan bucket ne troši rad servera.
   */
  if (
    await isBucketBlocked({
      scope: "totp",
      accountIdentifier: actor.email,
      clientIp,
    })
  ) {
    throw new SecurityActionError(SECURITY_GENERIC_ERROR);
  }

  const fresh = await verifyTotpForUser({ userId: actor.id, token: totpToken });
  if (!fresh) {
    const limit = await registerAttempt({
      scope: "totp",
      accountIdentifier: actor.email,
      clientIp,
    });
    if (!limit.allowed) {
      await recordAudit({
        actor: { id: actor.id, name: actor.name, role: actor.role },
        action: AUDIT_ACTIONS.mfaVerificationBlocked,
        entityType: "Korisnik",
        entityId: actor.id,
        entityLabel: actor.email,
        // Ni uneti kod ni sirova adresa ne ulaze u trag.
        reason: "Previše promašenih kodova pri bezbednosnoj radnji",
      });
    }
    throw new SecurityActionError(SECURITY_GENERIC_ERROR);
  }

  // Tek posle prihvaćenog koda brojač po nalogu se čisti.
  await clearAccountAttempts("totp", actor.email);

  return actor;
}

/** Nalog nad kojim se radnja izvršava. */
export type SecurityTarget = {
  id: string;
  email: string;
  name: string;
  role: string;
  active: boolean;
};

/**
 * Učitava cilj radnje iz baze.
 *
 * `userId` iz obrasca nikada nije dokaz — stanje se čita ponovo, jer je ono iz
 * pregleda moglo zastareti između prikaza i klika.
 *
 * @param options.allowSelf da li radnja sme da pogodi samog administratora
 */
export async function loadSecurityTarget(
  targetId: string,
  options: { allowSelf?: boolean; actorId: string },
): Promise<SecurityTarget> {
  if (!options.allowSelf && targetId === options.actorId) {
    throw new SecurityActionError(
      "Ova radnja se ne može primeniti na sopstveni nalog.",
    );
  }

  const [target] = await getDb()
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      active: users.active,
    })
    .from(users)
    .where(eq(users.id, targetId))
    .limit(1);

  if (!target) throw new SecurityActionError(SECURITY_GENERIC_ERROR);
  return target;
}

/**
 * Ključ brave za odluke o vlasničkim nalozima.
 *
 * Proizvoljan ali stabilan broj: druga vrednost znači drugu bravu, pa se ne
 * menja. Deli ga svaki put koji može da ukloni vlasnika.
 */
const OWNER_GUARD_LOCK_KEY = 774_155_301;

/** Transakcija u obliku koji Drizzle prosleđuje `db.transaction`. */
export type Tx = Parameters<
  Parameters<ReturnType<typeof getDb>["transaction"]>[0]
>[0];

/**
 * Izvršava izmenu uz garanciju da ostaje bar jedan aktivan `gazda`.
 *
 * Zašto brava, a ne obično prebrojavanje
 * --------------------------------------
 * Dva istovremena zahteva mogu oba pročitati „ima dva aktivna vlasnika", oba
 * zaključiti da smeju, i firma ostane bez ijednog — bez ijedne greške u kodu,
 * samo zbog rasporeda u vremenu. `pg_advisory_xact_lock` uzima ključ i drži ga
 * do kraja transakcije, pa drugi zahtev čeka i vidi već izmenjeno stanje.
 *
 * Brava se uzima PRE provere. Prebrojavanje pre zaključavanja ne znači ništa.
 *
 * `mutate` se izvršava unutar iste transakcije — provera i upis ne mogu se
 * razdvojiti.
 */
export async function withOwnerGuard<T>(
  input: {
    targetId: string;
    /** `true` kada bi radnja uklonila cilj iz skupa aktivnih vlasnika. */
    removesOwner: boolean;
  },
  mutate: (tx: Tx) => Promise<T>,
): Promise<T> {
  return getDb().transaction(async (tx) => {
    /*
     * Ključ se šalje kao `bigint`.
     *
     * `pg_advisory_xact_lock` ima dva oblika — `(bigint)` i `(int, int)`. Bez
     * izričitog tipa Postgres mora da pogađa koji je mišljen, a pogrešan izbor
     * znači drugu bravu. Eksplicitan tip uklanja to pogađanje.
     */
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(${OWNER_GUARD_LOCK_KEY}::bigint)`,
    );

    /*
     * Provera da je brava STVARNO uzeta na ovoj vezi.
     *
     * Iza spojnice u „transaction" režimu naredbe jedne transakcije mogu
     * završiti na različitim pozadinskim vezama. Tada `pg_advisory_xact_lock`
     * prođe bez greške, ali brava ostane na vezi koja više ne učestvuje — i
     * guard tiho prestane da serijalizuje bilo šta.
     *
     * Tiho prestajanje je najgori mogući ishod za zaštitu, pa se ovde traži
     * dokaz: brava mora biti vidljiva u `pg_locks` za TEKUĆU pozadinsku vezu.
     * Ako nije, radnja se odbija umesto da se izvrši bez zaštite.
     */
    const [held] = await tx.execute<{ held: number }>(
      sql`SELECT count(*)::int AS held
          FROM pg_locks
          WHERE locktype = 'advisory'
            AND granted
            AND pid = pg_backend_pid()
            AND ((classid::bigint << 32) | objid::bigint) = ${OWNER_GUARD_LOCK_KEY}::bigint`,
    );

    if (!held || held.held < 1) {
      throw new SecurityActionError(
        "Zaštita poslednjeg Gazda naloga ne može da se sprovede na ovoj vezi ka bazi. " +
          "Radnja je odbijena. Ako aplikacija radi preko spojnice (pooler), " +
          "transakcije moraju ići direktnom vezom.",
      );
    }

    if (input.removesOwner) {
      const [row] = await tx
        .select({ remaining: sql<number>`count(*)::int` })
        .from(users)
        .where(
          and(
            eq(users.role, "gazda"),
            eq(users.active, true),
            // Cilj se izuzima: pitanje je koliko ih ostaje POSLE radnje.
            ne(users.id, input.targetId),
          ),
        );

      if (!row || !ownerGuardAllows(row.remaining)) {
        throw new SecurityActionError(
          "Ovo je poslednji aktivan Gazda nalog. Otvorite drugi pre nego što ovaj isključite ili mu promenite ulogu.",
        );
      }
    }

    return mutate(tx);
  });
}

/**
 * Kriterijum „uklanja poslednjeg vlasnika" živi u
 * `lib/authz/owner-guard-policy.mjs` — čist modul bez baze, da bi bio pozivo iz
 * testa. Ovde se samo prosleđuje dalje, da pozivaoci imaju jedan uvoz.
 */
export { removesActiveOwner };
