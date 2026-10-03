import "server-only";
import { and, eq, isNull, lt, lte, or, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { authRateLimits } from "@/db/schema";
import {
  evaluateRateLimit,
  policyFor,
  type RateLimitDimension,
  type RateLimitScope,
} from "@/lib/auth/rate-limit-policy.mjs";
import {
  isRateLimitConfigured,
  rateLimitSubjectKey,
  validateRateLimitConfiguration,
} from "@/lib/auth/rate-limit-key.mjs";

/**
 * Brojači pokušaja nad Postgresom.
 *
 * Zašto baza, a ne memorija: na Vercelu svaki zahtev može pasti na drugu
 * instancu, a instance ne dele memoriju. `Map` u modulu bi napadaču dao onoliko
 * pokušaja koliko ima instanci, i to bez ijednog traga.
 *
 * Zašto je upis atomski: dva istovremena pokušaja sa istim ključem moraju dati
 * brojač 2, ne dva puta 1. Zato se koristi `INSERT … ON CONFLICT DO UPDATE` sa
 * uvećanjem u samom SQL-u, umesto čitanja pa upisa iz aplikacije.
 */

export type RateLimitDecision = {
  allowed: boolean;
  retryAfterSeconds: number;
  /** Koja dimenzija je odbila zahtev — samo za audit, nikad za korisnika. */
  blockedBy: RateLimitDimension | null;
};

const ALLOWED: RateLimitDecision = {
  allowed: true,
  retryAfterSeconds: 0,
  blockedBy: null,
};

/*
 * `AUTH-02`: greška u podešavanju NIKAD ne sme da liči na `ALLOWED`.
 *
 * Nema stvarnog brojača iza ove odluke — vraća se fiksan, konzervativan
 * `retryAfterSeconds` (najkraći postojeći prozor blokade u politici) da
 * korisnik dobije istu vrstu poruke kao za svaku drugu privremenu blokadu,
 * bez otkrivanja da je uzrok konfiguracija, ne pravi limit.
 */
const CONFIG_ERROR_RETRY_SECONDS = 60;
const FAIL_CLOSED: RateLimitDecision = {
  allowed: false,
  retryAfterSeconds: CONFIG_ERROR_RETRY_SECONDS,
  blockedBy: null,
};

function env() {
  return {
    AUTH_RATE_LIMIT_HMAC_KEY: process.env.AUTH_RATE_LIMIT_HMAC_KEY,
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV,
  };
}

/*
 * Log-flood zaštita: napadač koji pošalje hiljadu zahteva dok je ključ
 * neispravan ne sme da ostavi hiljadu identičnih redova. Modulska promenljiva
 * traje dok traje proces (serverless "cold start") — jedan bezbedan signal po
 * pokretanju procesa je dovoljan da neko primeti problem; hiljadu ih ne bi
 * bilo čitljivije, samo skuplje.
 *
 * Odluka (FAIL_CLOSED/`true`) se vraća na SVAKOM pozivu, bez obzira na ovu
 * zastavicu — ograničava se samo LOG, nikad bezbednosni ishod.
 */
let configurationErrorLogged = false;

/**
 * Prijavljuje grešku podešavanja NAJVIŠE JEDNOM po procesu — NIKAD vrednost
 * ključa, adresu ni identifikator naloga, samo strukturni razlog (isti tekst
 * koji `validateRateLimitConfiguration` već vraća bez tajne). Isti obrazac kao
 * `console.error(configuration.reason)` za MFA u `auth.ts` — server-side
 * dijagnostika, nikad odgovor korisniku.
 */
function logConfigurationError(reason: string): void {
  if (configurationErrorLogged) return;
  configurationErrorLogged = true;
  console.error(`[rate-limit] ${reason}`);
}

/**
 * SAMO za testove: vraća log-dedup zastavicu na početno stanje.
 *
 * Produkcijski kod ovo nikad ne poziva — svaki novi proces (cold start)
 * prirodno počinje sa `false`. Postoji da bi test mogao da dokaže „loguje se
 * najviše jednom" bez zavisnosti od redosleda drugih testova u istom procesu,
 * i bez ijedne produkcijske tajne — resetuje samo lokalnu promenljivu.
 */
export function __resetRateLimitLogStateForTests(): void {
  configurationErrorLogged = false;
}

/**
 * Beleži pokušaj i kaže da li sme da se nastavi.
 *
 * Poziva se PRE provere tajne. Dva nezavisna brojača — po nalogu i po adresi —
 * jer nijedan sam ne pokriva oba oblika napada: brojač po nalogu ne zaustavlja
 * probanje jedne lozinke na hiljadu naloga, a brojač po adresi ne zaustavlja
 * botnet uperen u jedan nalog.
 *
 * Adresa sme biti `null` (lokalni razvoj bez posrednika) — tada radi samo
 * brojač po nalogu.
 */
export async function registerAttempt(input: {
  scope: RateLimitScope;
  accountIdentifier: string | null;
  clientIp: string | null;
  now?: Date;
}): Promise<RateLimitDecision> {
  const configuration = env();

  /*
   * `AUTH-02`: u produkciji, greška podešavanja odbija radnju.
   *
   * Van produkcije ostaje kako je oduvek bilo: bez ključa se ne ograničava —
   * lokalni rad i testovi ne treba da nose ceo aparat. Provera je namerno
   * odvojena od `isRateLimitConfigured` ispod, koja i dalje važi VAN
   * produkcije.
   */
  const validity = validateRateLimitConfiguration(configuration);
  if (!validity.ok) {
    logConfigurationError(validity.reason ?? "nepoznata greška podešavanja");
    return FAIL_CLOSED;
  }

  /*
   * Bez ključa se ne ograničava — VAN produkcije.
   *
   * Namerno se NE pada zatvoreno ovde: to bi značilo da nedostajuća
   * promenljiva obara lokalni rad i testove. Provera iznad već garantuje da se
   * do ove linije stiže SAMO van produkcije ili sa ispravnim ključem.
   */
  if (!isRateLimitConfigured(configuration)) return ALLOWED;

  const now = input.now ?? new Date();
  const dimensions: { dimension: RateLimitDimension; value: string }[] = [];
  if (input.accountIdentifier) {
    dimensions.push({ dimension: "account", value: input.accountIdentifier });
  }
  if (input.clientIp) {
    dimensions.push({ dimension: "ip", value: input.clientIp });
  }
  if (dimensions.length === 0) return ALLOWED;

  let decision: RateLimitDecision = ALLOWED;

  for (const { dimension, value } of dimensions) {
    const policy = policyFor(input.scope, dimension);
    const subjectKey = rateLimitSubjectKey(dimension, value, configuration);
    const current = await readBucket(input.scope, dimension, subjectKey);
    const outcome = evaluateRateLimit(current, policy, now);

    await writeBucket({
      scope: input.scope,
      dimension,
      subjectKey,
      attempts: outcome.nextAttempts,
      resetWindow: outcome.resetWindow,
      blockUntil: outcome.blockUntil,
      now,
    });

    // Svi brojači se uvek uvećavaju, i kad je odluka već pala — inače bi
    // napadač trošio samo jedan bucket i drugi bi ostao prazan.
    if (!outcome.allowed && decision.allowed) {
      decision = {
        allowed: false,
        retryAfterSeconds: outcome.retryAfterSeconds,
        blockedBy: dimension,
      };
    }
  }

  return decision;
}

async function readBucket(
  scope: string,
  dimension: string,
  subjectKey: string,
) {
  const rows = await getDb()
    .select({
      attempts: authRateLimits.attempts,
      windowStartedAt: authRateLimits.windowStartedAt,
      blockedUntil: authRateLimits.blockedUntil,
    })
    .from(authRateLimits)
    .where(
      and(
        eq(authRateLimits.scope, scope),
        eq(authRateLimits.dimension, dimension),
        eq(authRateLimits.subjectKey, subjectKey),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Atomski upis brojača.
 *
 * Uvećanje se radi u SQL-u (`attempts + 1`), ne u aplikaciji. Da se vrednost
 * računala u JavaScriptu, dva paralelna pokušaja bi oba pročitala istu staru
 * vrednost i oba upisala isti rezultat — napadač bi tako dobio dvostruko više
 * pokušaja nego što politika dozvoljava.
 */
async function writeBucket(input: {
  scope: string;
  dimension: string;
  subjectKey: string;
  attempts: number;
  resetWindow: boolean;
  blockUntil: Date | null;
  now: Date;
}) {
  await getDb()
    .insert(authRateLimits)
    .values({
      scope: input.scope,
      dimension: input.dimension,
      subjectKey: input.subjectKey,
      attempts: 1,
      windowStartedAt: input.now,
      blockedUntil: input.blockUntil,
      updatedAt: input.now,
    })
    .onConflictDoUpdate({
      target: [
        authRateLimits.scope,
        authRateLimits.dimension,
        authRateLimits.subjectKey,
      ],
      set: {
        attempts: input.resetWindow
          ? sql`1`
          : sql`${authRateLimits.attempts} + 1`,
        windowStartedAt: input.resetWindow
          ? input.now
          : authRateLimits.windowStartedAt,
        blockedUntil: input.blockUntil ?? authRateLimits.blockedUntil,
        updatedAt: input.now,
      },
    });
}

/**
 * Da li je bilo koji brojač već blokiran — bez uvećavanja.
 *
 * Postoji da bi se skup posao (scrypt, ~100 ms) preskočio kada je odluka već
 * pala. Bez ove provere napadač koji je odavno blokiran i dalje tera server da
 * računa hash pri svakom pokušaju.
 *
 * Namerno ne broji: pokušaji tokom blokade se ne kažnjavaju dodatno.
 */
export async function isBucketBlocked(input: {
  scope: RateLimitScope;
  accountIdentifier: string | null;
  clientIp: string | null;
  now?: Date;
}): Promise<boolean> {
  const configuration = env();

  /*
   * `AUTH-02`: u produkciji, greška podešavanja se tretira kao BLOKIRANO.
   *
   * Ovo je jedini ispravan smer: pozivalac ovu funkciju koristi da preskoči
   * skup posao (scrypt/TOTP) kada je odluka VEĆ pala. Vraćanje `false` bi
   * značilo „nastavi", tačno suprotno od namere fail-closed ponašanja.
   */
  const validity = validateRateLimitConfiguration(configuration);
  if (!validity.ok) {
    logConfigurationError(validity.reason ?? "nepoznata greška podešavanja");
    return true;
  }

  if (!isRateLimitConfigured(configuration)) return false;

  const now = input.now ?? new Date();
  const checks: { dimension: RateLimitDimension; value: string }[] = [];
  if (input.accountIdentifier) {
    checks.push({ dimension: "account", value: input.accountIdentifier });
  }
  if (input.clientIp) checks.push({ dimension: "ip", value: input.clientIp });

  for (const { dimension, value } of checks) {
    const bucket = await readBucket(
      input.scope,
      dimension,
      rateLimitSubjectKey(dimension, value, configuration),
    );
    if (bucket?.blockedUntil && bucket.blockedUntil > now) return true;
  }
  return false;
}

/**
 * Koliko sekundi je brojač još blokiran (0 = nije) — bez uvećavanja.
 *
 * Za odgovor 429 kome treba `Retry-After`. Greška podešavanja u produkciji se
 * tretira kao blokada od jednog prozora (isti smer kao `isBucketBlocked`).
 */
export async function blockedForSeconds(input: {
  scope: RateLimitScope;
  accountIdentifier: string | null;
  clientIp: string | null;
  now?: Date;
}): Promise<number> {
  const configuration = env();
  const validity = validateRateLimitConfiguration(configuration);
  if (!validity.ok) {
    logConfigurationError(validity.reason ?? "nepoznata greška podešavanja");
    return 60;
  }
  if (!isRateLimitConfigured(configuration)) return 0;
  const now = input.now ?? new Date();
  let max = 0;
  const checks: { dimension: RateLimitDimension; value: string }[] = [];
  if (input.accountIdentifier) checks.push({ dimension: "account", value: input.accountIdentifier });
  if (input.clientIp) checks.push({ dimension: "ip", value: input.clientIp });
  for (const { dimension, value } of checks) {
    const bucket = await readBucket(input.scope, dimension, rateLimitSubjectKey(dimension, value, configuration));
    if (bucket?.blockedUntil && bucket.blockedUntil > now) {
      max = Math.max(max, Math.ceil((bucket.blockedUntil.getTime() - now.getTime()) / 1000));
    }
  }
  return max;
}

/**
 * Poništava brojač po nalogu posle uspešne prijave.
 *
 * Namerno NE dira brojač po adresi: ako napadač sa jedne adrese probija više
 * naloga, jedna uspešna prijava (recimo njegova sopstvena) ne sme da mu obriše
 * trag i vrati pun broj pokušaja.
 *
 * Ne briše red, nego ga poništava — istorija pokušaja ostaje vidljiva.
 */
export async function clearAccountAttempts(
  scope: RateLimitScope,
  accountIdentifier: string,
  now = new Date(),
): Promise<void> {
  const configuration = env();
  if (!isRateLimitConfigured(configuration)) return;

  await getDb()
    .update(authRateLimits)
    .set({ attempts: 0, blockedUntil: null, windowStartedAt: now, updatedAt: now })
    .where(
      and(
        eq(authRateLimits.scope, scope),
        eq(authRateLimits.dimension, "account"),
        eq(
          authRateLimits.subjectKey,
          rateLimitSubjectKey("account", accountIdentifier, configuration),
        ),
      ),
    );
}

/**
 * Uklanja redove čiji je prozor odavno istekao.
 *
 * Uslov je namerno strog: briše se samo ono što nema aktivnu blokadu I čiji je
 * prozor stariji od praga. Brisanje aktivne blokade bi napadaču vratilo pun broj
 * pokušaja — zato ovo nikada ne sme biti prosto „obriši starije od X".
 *
 * Poziva se povremeno iz same auth putanje; nema zakazanog posla koji bi mogao
 * da radi bez nadzora.
 */
export async function pruneExpiredBuckets(
  olderThan: Date,
  now = new Date(),
): Promise<number> {
  const result = await getDb()
    .delete(authRateLimits)
    .where(
      and(
        lt(authRateLimits.windowStartedAt, olderThan),
        // Isti razlog kao gore: `Date` u sirovom šablonu ne prolazi kroz maper
        // kolone i drajver ga odbija.
        or(isNull(authRateLimits.blockedUntil), lte(authRateLimits.blockedUntil, now)),
      ),
    )
    .returning({ id: authRateLimits.id });
  return result.length;
}
