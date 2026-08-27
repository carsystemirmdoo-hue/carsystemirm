import { createHash } from "node:crypto";

/**
 * Sigurnosna kapija integracionih testova.
 *
 * Testovi ispod PIŠU i BRIŠU redove. Pokrenuti ih nad pogrešnom bazom nije
 * greška koja se popravlja — zato ovde nema upozorenja, samo odbijanja.
 *
 * Modul je čist: prima vrednosti, vraća odluku, ne dodiruje bazu i ne ispisuje
 * ništa. Zbog toga se cela logika može proveriti testom bez ijedne veze ka
 * pravoj bazi — a upravo to je deo koji mora biti tačan.
 *
 * NIJEDNA funkcija ovde ne vraća connection string ni njegov deo. Poređenja idu
 * preko otiska, a opis mete se redigira.
 */

/** Otisak za poređenje bez otkrivanja vrednosti. */
export function fingerprint(value) {
  return createHash("sha256").update(String(value)).digest("hex").slice(0, 12);
}

/**
 * Redigovan opis mete: dovoljno da čovek prepozna bazu, premalo da je otvori.
 *
 * Namerno ispada sve što je tajna: korisnik, lozinka i query parametri (u
 * kojima često stoji `sslmode`, ali i tokeni nekih provajdera).
 */
export function describeTarget(url) {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parsed.port || "(podrazumevan)",
      database: parsed.pathname.replace(/^\//, "") || "(nije navedena)",
    };
  } catch {
    return { host: "(neraščlanjivo)", port: "", database: "" };
  }
}

/** Reči po kojima se prepoznaje namenski odvojena baza. */
const TEST_MARKERS = ["test", "qa", "staging", "preview", "dev", "sandbox", "scratch"];

/** Reči koje same po sebi znače „ne diraj". */
const PRODUCTION_MARKERS = ["prod", "production", "live", "main-db", "primary"];

/**
 * Oznaka spojnice (connection pooler) u imenu hosta.
 *
 * Zašto se odbija baš ovde
 * ------------------------
 * Spojnica u „transaction" režimu ne garantuje da će sve naredbe jedne
 * transakcije završiti na istoj pozadinskoj vezi. Advisory brava
 * (`pg_advisory_xact_lock`) je vezana za konkretnu vezu — ako se naredbe
 * razdvoje, brava se uzme na jednoj vezi, a prebrojavanje i upis odu na drugu.
 * Tada guard ne serijalizuje ništa, a izgleda kao da radi.
 *
 * Zabrana važi ISKLJUČIVO za migracije i QA runner, gde se transakcione
 * invarijante dokazuju. Produkcijska aplikacija sme i treba da koristi spojnicu
 * — njoj brava nije jedini oslonac, a spojnica joj štedi veze.
 */
const POOLED_HOST_MARKERS = ["-pooler", ".pooler.", "pgbouncer"];

/**
 * Odlučuje sme li se pisati po meti.
 *
 * @param {object} input
 * @param {string|undefined} input.testUrl
 * @param {string|undefined} input.databaseUrl
 * @param {string|undefined} input.migrationUrl
 * @param {string|undefined} [input.vercelEnv]
 * @returns {{ ok: boolean, reason: string | null, target: ReturnType<typeof describeTarget> | null }}
 */
export function evaluateTestTarget({ testUrl, databaseUrl, migrationUrl, vercelEnv }) {
  if (!testUrl) {
    return { ok: false, reason: "missing", target: null };
  }

  /*
   * Poređenje ide preko otiska.
   *
   * Direktno poređenje stringova bi radilo isto, ali bi vrednost morala da
   * postoji u poruci kada test padne. Otisak se sme ispisati.
   */
  const testPrint = fingerprint(testUrl);
  if (databaseUrl && fingerprint(databaseUrl) === testPrint) {
    return { ok: false, reason: "same-as-database-url", target: null };
  }
  if (migrationUrl && fingerprint(migrationUrl) === testPrint) {
    return { ok: false, reason: "same-as-migration-url", target: null };
  }

  // Produkcijsko okruženje ne sme pokretati testove koji pišu, ni nad drugom bazom.
  if (vercelEnv === "production") {
    return { ok: false, reason: "production-environment", target: null };
  }

  const target = describeTarget(testUrl);
  const haystack = `${target.host} ${target.database}`.toLowerCase();

  if (PRODUCTION_MARKERS.some((marker) => haystack.includes(marker))) {
    return { ok: false, reason: "production-marker", target };
  }

  /*
   * Spojnica se odbija PRE provere imena.
   *
   * Meta može imati savršeno ime i biti potpuno odvojena, a i dalje biti
   * beskorisna za dokaz zaključavanja. Bolje jasno odbiti nego proizvesti
   * „prolaz" koji ništa ne dokazuje.
   */
  if (POOLED_HOST_MARKERS.some((marker) => target.host.toLowerCase().includes(marker))) {
    return { ok: false, reason: "pooled-connection-not-allowed", target };
  }

  /*
   * Ime mora reći da je baza za odbacivanje.
   *
   * Ovo nije dokaz — ime se može slagati a baza ne biti prava meta. Zato je ovo
   * samo prvi filter; drugi je provera sadržaja, koja traži stvarnu vezu.
   */
  if (!TEST_MARKERS.some((marker) => haystack.includes(marker))) {
    return { ok: false, reason: "no-test-marker", target };
  }

  return { ok: true, reason: null, target };
}

/** Poruke za čoveka. Nijedna ne sadrži vrednost promenljive. */
export const SAFETY_MESSAGES = {
  missing:
    "TEST_DATABASE_URL nije postavljen. Integracioni testovi se preskaču — invarijante NISU dokazane.",
  "same-as-database-url":
    "TEST_DATABASE_URL ima isti otisak kao DATABASE_URL. Odbijeno: testovi pišu i brišu redove.",
  "same-as-migration-url":
    "TEST_DATABASE_URL ima isti otisak kao MIGRATION_DATABASE_URL. Odbijeno.",
  "production-environment":
    "VERCEL_ENV=production. Testovi koji pišu se ne pokreću iz produkcijskog okruženja.",
  "production-marker":
    "Ime baze ili hosta sadrži oznaku produkcije. Odbijeno iz opreza.",
  "pooled-connection-not-allowed":
    "TEST_DATABASE_URL pokazuje na spojnicu (pooler). Transakcione invarijante — " +
    "pre svega pg_advisory_xact_lock — ne mogu se dokazati preko spojnice, jer " +
    "naredbe jedne transakcije mogu završiti na različitim vezama. Upotrebite " +
    "DIRECT connection string (host bez „-pooler“). Produkcijska aplikacija sme " +
    "i dalje da koristi spojnicu.",
  "no-test-marker":
    'Ime baze ne sadrži nijednu oznaku odvojene baze (test/qa/staging/preview/dev/sandbox). ' +
    "Preimenujte bazu ili koristite namenski disposable instancu.",
};

/**
 * Tabele koje odaju da baza NIJE prazna test meta.
 *
 * Prazna baza ili baza sa samo našim tabelama je u redu. Redovi u poslovnim
 * tabelama znače da neko tu radi — tada se staje, bez čišćenja.
 */
export const BUSINESS_TABLES = [
  "customers",
  "invoices",
  "invoice_lines",
  "articles",
  "salespeople",
  "customer_assignments",
];

/** Koliko redova u poslovnim tabelama se još tumači kao „prazna" baza. */
export const MAX_TOLERATED_BUSINESS_ROWS = 0;
