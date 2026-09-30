import { randomBytes, randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";
import {
  BUSINESS_TABLES,
  evaluateTestTarget,
  fingerprint,
  MAX_TOLERATED_BUSINESS_ROWS,
  SAFETY_MESSAGES,
} from "./safety.mjs";

/**
 * Priprema izolovane PostgreSQL baze za integracione testove.
 *
 * Zašto uopšte postoji
 * --------------------
 * Invarijante koje ovi testovi dokazuju ne žive u JavaScriptu nego u Postgresu:
 * serijalizacija kroz `pg_advisory_xact_lock`, atomičnost `UPDATE … RETURNING`,
 * strani ključevi, `unique` indeksi. Nijedan mock ih ne može pokazati.
 *
 * Zašto testovi zovu PRAVI kod
 * ----------------------------
 * `db/integration/tsconfig.test.json` zamenjuje `server-only` praznim modulom,
 * pa se `lib/auth/*.ts` i `lib/authz/*.ts` mogu uvesti u test proces. Bez toga
 * bi test morao da prepiše SQL koji testira — i onda ne bi testirao
 * produkcijski kod nego svoju kopiju.
 */

/** Prefiks po kome se prepoznaje sve što je test napravio. */
export const QA_PREFIX = "qa1bverify";

/** Domen koji ne postoji i ne može primiti poštu. */
export const QA_EMAIL_DOMAIN = "qa-1b.invalid";

export type TestDatabase = {
  /** Direktna veza za tvrdnje nad redovima. */
  sql: postgres.Sql;
  /** Redigovan opis mete — bez korisnika, lozinke i parametara. */
  target: { host: string; port: string; database: string };
  version: string;
  databaseName: string;
};

let cached: TestDatabase | null = null;

/**
 * Instrumentisana konekcija koju `installInstrumentedDb` gura u `globalThis`.
 *
 * Drži se odvojeno od `cached.sql` zato što se MORA zatvoriti: postgres.js pool
 * drži otvorene socket-e, a otvoren socket drži event loop. Bez ovoga proces
 * prođe sve testove i onda nikad ne izađe — što izgleda kao da se suite obesio,
 * a zapravo je završio.
 */
let instrumented: postgres.Sql | null = null;

/**
 * Razlog preskakanja, ili `null` kada se sme nastaviti.
 *
 * Testovi ga zovu PRE ijedne mutacije i, kada nije `null`, preskaču se uz
 * vidljivu poruku — nikad ne prolaze tiho.
 */
export function skipReason(): string | null {
  const decision = evaluateTestTarget({
    testUrl: process.env.TEST_DATABASE_URL,
    databaseUrl: process.env.DATABASE_URL,
    migrationUrl: process.env.MIGRATION_DATABASE_URL,
    vercelEnv: process.env.VERCEL_ENV,
  });
  if (decision.ok) return null;
  return SAFETY_MESSAGES[decision.reason as keyof typeof SAFETY_MESSAGES] ?? decision.reason;
}

/**
 * Otvara vezu i dokazuje da je meta bezbedna.
 *
 * Provera ima dva sloja. Prvi je nad imenom i otiskom, bez veze. Drugi traži
 * vezu: čita metapodatke i broji redove u poslovnim tabelama. Ime se može
 * slagati a baza ne biti prava meta; sadržaj ne laže.
 *
 * Tek pošto oba prođu, `DATABASE_URL` se postavlja **u ovom procesu**, da bi
 * `getDb()` iz produkcijskog koda gađao test bazu. Vrednost se nikada ne
 * upisuje u fajl i ne ispisuje.
 */
export async function initTestDatabase(): Promise<TestDatabase> {
  if (cached) return cached;

  const reason = skipReason();
  if (reason) throw new Error(reason);

  const url = process.env.TEST_DATABASE_URL!;
  const decision = evaluateTestTarget({
    testUrl: url,
    databaseUrl: process.env.DATABASE_URL,
    migrationUrl: process.env.MIGRATION_DATABASE_URL,
    vercelEnv: process.env.VERCEL_ENV,
  });

  const sql = postgres(url, { max: 4, onnotice: () => {} });

  // ---- Sloj 2: samo čitanje, pre ijedne izmene ----------------------------
  const [meta] = await sql<{ db: string; version: string }[]>`
    SELECT current_database() AS db, version() AS version
  `;

  const tables = await sql<{ table_name: string }[]>`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  `;
  const present = new Set(tables.map((t) => t.table_name));

  for (const table of BUSINESS_TABLES) {
    if (!present.has(table)) continue;
    const [{ count }] = await sql<{ count: number }[]>`
      SELECT count(*)::int AS count FROM ${sql(table)}
    `;
    if (count > MAX_TOLERATED_BUSINESS_ROWS) {
      await sql.end();
      throw new Error(
        `Baza sadrži ${count} redova u tabeli "${table}". ` +
          "To ne izgleda kao prazna test meta — staje se bez ijedne izmene i bez čišćenja.",
      );
    }
  }

  // Tek sada produkcijski `getDb()` sme da gađa ovu bazu, i to samo ovde.
  process.env.DATABASE_URL = url;
  installInstrumentedDb(url);

  cached = {
    sql,
    target: decision.target!,
    version: meta.version.split(" ").slice(0, 2).join(" "),
    databaseName: meta.db,
  };
  return cached;
}

/** Otisak mete — sme u izveštaj, za razliku od same vrednosti. */
export function targetFingerprint(): string {
  return fingerprint(process.env.TEST_DATABASE_URL ?? "");
}

/* =========================================================================
 * Sintetički nalozi
 * ====================================================================== */

export type QaAccount = {
  id: string;
  email: string;
  name: string;
  role: string;
  active: boolean;
  password: string;
};

/** Nasumična lozinka; nikada se ne ispisuje ni ne upisuje u fajl. */
function qaPassword() {
  return `qa-${randomBytes(15).toString("base64url")}`;
}

/**
 * Pravi naloge za jedan test. Svaki poziv dobija svoj `run` prefiks, pa
 * paralelni fajlovi ne gaze jedan drugom podatke.
 */
export async function seedAccounts(
  db: TestDatabase,
  specs: { key: string; role: string; active?: boolean }[],
): Promise<Record<string, QaAccount>> {
  const { hashPassword } = await import("@/lib/auth/password.mjs");
  const run = randomUUID().slice(0, 8);
  const created: Record<string, QaAccount> = {};

  for (const spec of specs) {
    const password = qaPassword();
    const email = `${QA_PREFIX}-${run}-${spec.key}@${QA_EMAIL_DOMAIN}`;
    const hash = await hashPassword(password);
    const [row] = await db.sql<{ id: string }[]>`
      INSERT INTO users (email, name, initials, password_hash, role, active)
      VALUES (
        ${email},
        ${`QA ${spec.key}`},
        ${spec.key.slice(0, 2).toUpperCase()},
        ${hash},
        ${spec.role},
        ${spec.active ?? true}
      )
      RETURNING id
    `;
    created[spec.key] = {
      id: row.id,
      email,
      name: `QA ${spec.key}`,
      role: spec.role,
      active: spec.active ?? true,
      password,
    };
  }

  return created;
}

/**
 * Sprema za sobom, bez ijedne radnje koja sme da padne.
 *
 * Zašto nije prosto `DELETE FROM users`
 * -------------------------------------
 * Korisnik koji figurira u tragu revizije se **ne briše** — `audit_log` ima
 * `ON DELETE RESTRICT` upravo zato što je trag nepromenljiv. Ranija verzija
 * ovog čišćenja je to ignorisala, pa je svaki test fajl koji je usput napravio
 * trag padao tek u `after()`, i to porukom koja je izgledala kao greška
 * okidača. Nije bila; bio je pogrešan ugovor o brisanju.
 *
 * Zato se ovde briše samo ono što se SME obrisati, a ostalo se prepušta
 * `resetQaDatabase()` na početku sledećeg prolaza. Nema `catch` koji guta
 * grešku: put je izabran tako da greške nema.
 */
export async function cleanupQa(db: TestDatabase): Promise<{
  deleted: number;
  deactivated: number;
  keptForAudit: number;
}> {
  const qa = `${QA_PREFIX}-%`;

  // Brojači nemaju strani ključ ka korisniku i mogu uvek.
  await db.sql`DELETE FROM auth_rate_limits`;

  const deleted = await db.sql<{ id: string }[]>`
    DELETE FROM users
    WHERE email LIKE ${qa}
      AND id NOT IN (SELECT actor_user_id FROM audit_log WHERE actor_user_id IS NOT NULL)
      AND id NOT IN (SELECT updated_by FROM system_settings WHERE updated_by IS NOT NULL)
    RETURNING id
  `;

  /*
   * Ono što se ne sme obrisati mora bar prestati da bude AKTIVNO.
   *
   * Prvi direktni prolaz je pao upravo ovde. `audit` test se izvršava prvi i
   * ostavlja dva aktivna `gazda` naloga koje čišćenje ne sme da obriše (imaju
   * trag). Owner guard test je zato kretao sa četiri aktivna vlasnika umesto
   * dva, pa su obe deaktivacije bile ISPRAVNO dozvoljene — invarijanta „ostaje
   * bar jedan vlasnik" nijednog trenutka nije bila ugrožena.
   *
   * Deaktivacija je izmena nad `users`, koja je dozvoljena; trag ostaje
   * netaknut. Time zaostali nalozi prestaju da utiču na brojanje aktivnih
   * vlasnika u sledećem fajlu.
   */
  const deactivated = await db.sql<{ id: string }[]>`
    UPDATE users SET active = false
    WHERE email LIKE ${qa} AND active = true
    RETURNING id
  `;

  const [{ count }] = await db.sql<{ count: number }[]>`
    SELECT count(*)::int AS count FROM users WHERE email LIKE ${qa}
  `;

  return { deleted: deleted.length, deactivated: deactivated.length, keptForAudit: count };
}

/**
 * Tabele koje QA prolaz sme da isprazni.
 *
 * `permission_packages` NIJE na spisku: nju puni migracija `0007`, i prazna bi
 * oborila svaku dodelu dozvole na strani ključ. `drizzle.__drizzle_migrations`
 * takođe nije — brisanje journala bi značilo da se ceo lanac primenjuje ponovo
 * nad već izmenjenom šemom.
 */
const RESETTABLE_TABLES = [
  /*
   * Tabele uvedene migracijama 0008–0014.
   *
   * Bez njih se redovi gomilaju izmedju prolaza, pa sigurnosna kapija
   * (`initTestDatabase`, brojanje redova u poslovnim tabelama) posle prvog
   * neuspelog `after()` hooka odbija bazu porukom „ne izgleda kao prazna test
   * meta". Kvar je izgledao kao greska u novom testu, a bio je u ciscenju.
   */
  "source_document_lines",
  "source_documents",
  "customer_contact_consents",
  /*
   * Registar partnera i potvrde osoba (0028). Potvrde su samo za dodavanje —
   * `DELETE` okidač odbija, `TRUNCATE` ne pokreće okidače po redu.
   */
  "customer_contact_verifications",
  /*
   * Poručivanje (0029). `customer_orders` ima `restrict` ka kupcima i
   * artiklima, pa mora u istu `TRUNCATE` naredbu.
   */
  "customer_remember_tokens",
  "customer_price_requests",
  "customer_order_events",
  "customer_order_lines",
  "customer_orders",
  "customer_cart_items",
  "price_list_customer_terms",
  "price_list_items",
  "price_lists",
  "partner_records",
  "partner_imports",
  "customer_account_tokens",
  "customer_message_outbox",
  "customer_users",
  "notifications",
  "price_rules",
  "customer_group_members",
  "customer_groups",
  "article_catalog_mappings",
  "customer_external_identifiers",

  /*
   * Sinhronizacija sa uređaja (0024–0025).
   *
   * `sync_command_events` je append-only i `DELETE` nad njim okidač odbija —
   * upravo zato je `TRUNCATE` jedini ispravan alat: ne pokreće okidače po redu,
   * pa se zaštita ne isključuje ni na trenutak. Bez ovih pet imena bi jedan
   * događaj iz ranijeg prolaza zauvek ostao u bazi i obarao čišćenje.
   */
  /*
   * Preporuke (0027). `recommendation_results` ima `restrict` ka `customers`,
   * pa mora otici pre njih — `TRUNCATE ... CASCADE` to resava, ali ime mora
   * biti na spisku da bi tabela uopste usla u naredbu.
   */
  "recommendation_results",
  "recommendation_runs",

  "sync_command_events",
  "sync_commands",
  "sync_request_nonces",
  "sync_device_keys",
  "sync_devices",

  "audit_log",
  "auth_rate_limits",
  "user_mfa",
  "mfa_recovery_codes",
  "mfa_enrollment_grants",
  "password_reset_codes",
  "user_permissions",
  "user_preferences",
  "customer_assignments",
  "invoice_lines",
  "invoices",
  "import_rows",
  "import_runs",
  "salespeople",
  "customers",
  "articles",
  "system_settings",
  "users",
];

/**
 * Vraća QA bazu u prazno stanje, tako da se prolaz može ponoviti.
 *
 * `TRUNCATE` je ovde ispravan alat, a ne zaobilaženje zaštite:
 *
 *   - ne pokreće okidače nad redovima, pa append-only zaštita ostaje netaknuta
 *     i **ne isključuje se** ni na trenutak;
 *   - `CASCADE` prati strane ključeve, pa ne treba pogađati redosled;
 *   - `RESTART IDENTITY` vraća brojače, pa su ID-jevi u ponovljenom prolazu isti.
 *
 * Radi ISKLJUČIVO nad metom koja ponovo prođe celu sigurnosnu kapiju. Provera se
 * ne preskače zato što je već prošla pri povezivanju — između tada i sada je
 * moglo proći vreme i promeniti se okruženje.
 *
 * Runtime aplikaciona rola nema `TRUNCATE` (vidi `db/provisioning/runtime-role.sql`);
 * ovo se izvršava vlasnikom test baze.
 */
export async function resetQaDatabase(db: TestDatabase): Promise<string[]> {
  const decision = evaluateTestTarget({
    testUrl: process.env.TEST_DATABASE_URL,
    databaseUrl: process.env.DATABASE_URL,
    migrationUrl: process.env.MIGRATION_DATABASE_URL,
    vercelEnv: process.env.VERCEL_ENV,
  });
  if (!decision.ok) {
    throw new Error(
      SAFETY_MESSAGES[decision.reason as keyof typeof SAFETY_MESSAGES] ??
        String(decision.reason),
    );
  }

  const postojece = await db.sql<{ table_name: string }[]>`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  `;
  const present = new Set(postojece.map((t) => t.table_name));
  const target = RESETTABLE_TABLES.filter((t) => present.has(t));
  if (target.length === 0) return [];

  const lista = target.map((t) => `"${t}"`).join(", ");
  await db.sql.unsafe(`TRUNCATE TABLE ${lista} RESTART IDENTITY CASCADE`);
  return target;
}

/** Zatvara vezu. Poziva se iz `after` u svakom test fajlu. */
export async function closeTestDatabase(): Promise<void> {
  if (instrumented) {
    await instrumented.end();
    instrumented = null;
    // Referenca u `globalThis` bi inače držala zatvoren pool i sledeći
    // `getDb()` bi gađao vezu koje više nema.
    delete (globalThis as unknown as { carsystemDb?: unknown }).carsystemDb;
  }
  if (!cached) return;
  await cached.sql.end();
  cached = null;
}

/**
 * Ključevi za šifrovanje u test procesu.
 *
 * Nasumični po pokretanju: test nikada ne sme koristiti pravi ključ, a ni
 * ostaviti svoj iza sebe. Postavljaju se samo ako ih okruženje već nema.
 */
export function ensureTestCryptoEnv(): void {
  process.env.PORTAL_MFA_MASTER_KEY_V1 ??= randomBytes(32).toString("base64");
  process.env.PORTAL_MFA_ACTIVE_KEY_VERSION ??= "1";
  process.env.AUTH_RATE_LIMIT_HMAC_KEY ??= randomBytes(32).toString("base64");
}


/**
 * Broj aktivnih vlasnika u CELOJ bazi.
 *
 * Owner guard broji sve, ne samo naloge tekućeg testa — zato i test mora da zna
 * stvarno stanje umesto da pretpostavlja da su njegova dva jedina.
 */
export async function countActiveOwners(db: TestDatabase): Promise<number> {
  const [{ count }] = await db.sql<{ count: number }[]>`
    SELECT count(*)::int AS count FROM users WHERE role = 'gazda' AND active = true
  `;
  return count;
}

/**
 * Ostavlja tačno navedene naloge kao jedine aktivne vlasnike.
 *
 * Test koji dokazuje „prolazi tačno jedna od dve" mora da kontroliše ceo skup
 * vlasnika, jer pravilo gleda ceo skup. Bez ovoga ishod zavisi od toga šta je
 * ostalo iza prethodnog fajla — a to nije osobina koda nego rasporeda.
 *
 * Radi isključivo nad QA bazom; ostali nalozi se deaktiviraju, ne brišu.
 */
export async function isolateOwners(
  db: TestDatabase,
  keepActiveIds: string[],
): Promise<number> {
  if (keepActiveIds.length === 0) {
    throw new Error("isolateOwners bez ijednog naloga bi ostavio bazu bez vlasnika");
  }

  // `sql(niz)` je postgres.js oblik za `IN (...)` listu; radi i za `uuid`.
  const demoted = await db.sql<{ id: string }[]>`
    UPDATE users SET active = false
    WHERE role = 'gazda' AND active = true
      AND id NOT IN ${db.sql(keepActiveIds)}
    RETURNING id
  `;
  return demoted.length;
}


/* =========================================================================
 * Brojanje SQL naredbi
 * ====================================================================== */

/**
 * Brojač naredbi koje je produkcijski kod poslao bazi.
 *
 * Zašto postoji
 * -------------
 * Timing merenje nad udaljenim Neonom je bučno: dve strukturno IDENTIČNE grane
 * javnog oporavka izmerene su na 4644 ms i 6121 ms. Iz takvog broja se ne može
 * zaključiti ništa o kodu.
 *
 * Broj mrežnih obilazaka, međutim, ne zavisi od mreže. Ako dve grane pošalju
 * isti broj naredbi istog oblika, razlika u vremenu je šum; ako pošalju
 * različit broj, razlika je strukturna i stvarna. Zato je ovo primarni dokaz, a
 * merenje vremena samo potvrda.
 */
export const sqlCounter = {
  count: 0,
  kinds: [] as string[],
  reset() {
    this.count = 0;
    this.kinds = [];
  },
  snapshot() {
    return { count: this.count, kinds: [...this.kinds] };
  },
};

/**
 * Ubacuje instrumentisanu konekciju tamo gde je produkcijski `getDb()` traži.
 *
 * `db/client.ts` čuva instancu u `globalThis.carsystemDb` i vraća je ako
 * postoji. Popunjavanje tog mesta unapred je test seam — produkcijski kod se ne
 * menja, a svi upiti prolaze kroz brojač.
 */
function installInstrumentedDb(url: string): void {
  const client = postgres(url, {
    max: 4,
    onnotice: () => {},
    debug: (_conn, query) => {
      sqlCounter.count += 1;
      /*
       * Samo prva reč: `select`, `update`, `insert`, `begin`, `commit`.
       *
       * Nijedan parametar se ne beleži, pa nijedna tajna ne može procuriti kroz
       * brojač. Spisak je ograničen jer traje ceo prolaz — bez granice bi rastao
       * bez potrebe.
       */
      if (sqlCounter.kinds.length < 200) {
        sqlCounter.kinds.push(query.trim().split(/\s+/)[0].toLowerCase());
      }
    },
  });

  instrumented = client;
  const globalForDb = globalThis as unknown as { carsystemDb?: unknown };
  globalForDb.carsystemDb = drizzle(client, { schema });
}
