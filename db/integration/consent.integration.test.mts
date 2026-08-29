import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after, before } from "node:test";
import {
  cleanupQa,
  closeTestDatabase,
  ensureTestCryptoEnv,
  initTestDatabase,
  seedAccounts,
  skipReason,
  type TestDatabase,
} from "./harness.mts";

/**
 * Saglasnosti kupca nad stvarnim PostgreSQL-om.
 *
 * Jedinični testovi dokazuju izvođenje stanja (`lib/customers/consent.test.mjs`).
 * Ovde se dokazuje ono što JavaScript ne može: da je tabela stvarno append-only
 * na nivou baze, da su CHECK-ovi na mestu, i da kupac ne može upisati tuđu
 * saglasnost.
 */

const reason = skipReason();
const guard = (t: { skip: (m?: string) => void }) => {
  if (reason) {
    t.skip(reason);
    return true;
  }
  return false;
};

let db: TestDatabase;
let fixture: {
  customerId: string;
  accountA: string;
  accountB: string;
  emailA: string;
  staffId: string;
  staffName: string;
};

before(async () => {
  if (reason) return;
  ensureTestCryptoEnv();
  db = await initTestDatabase();

  const run = randomUUID().slice(0, 8);
  const [customer] = await db.sql<{ id: string }[]>`
    INSERT INTO customers (pib, name) VALUES (${`QA${run}c`}, 'QA Consent Kupac') RETURNING id`;

  const emailA = `qa1bverify-${run}-a@qa-1b.invalid`;
  const [a] = await db.sql<{ id: string }[]>`
    INSERT INTO customer_users (customer_id, email, name, password_hash, status)
    VALUES (${customer.id}, ${emailA}, 'QA A', 'x', 'active') RETURNING id`;
  const [b] = await db.sql<{ id: string }[]>`
    INSERT INTO customer_users (customer_id, email, name, password_hash, status)
    VALUES (${customer.id}, ${`qa1bverify-${run}-b@qa-1b.invalid`}, 'QA B', 'x', 'active')
    RETURNING id`;

  const accounts = await seedAccounts(db, [{ key: "office", role: "kancelarija" }]);

  fixture = {
    customerId: customer.id,
    accountA: a.id,
    accountB: b.id,
    emailA,
    staffId: accounts.office.id,
    staffName: accounts.office.name,
  };
});

after(async () => {
  if (!reason && db) {
    // `DELETE` pada na append-only okidacu; `TRUNCATE` ne pokrece okidace nad
    // redovima, pa zastita ostaje netaknuta i ne iskljucuje se ni na trenutak.
    await db.sql.unsafe("TRUNCATE TABLE customer_contact_consents");
    await db.sql`DELETE FROM customer_users WHERE email LIKE 'qa1bverify-%'`;
    await db.sql`DELETE FROM customers WHERE pib LIKE 'QA%'`;
    await cleanupQa(db);
  }
  await closeTestDatabase();
});

const asCustomer = () => ({
  kind: "customer" as const,
  accountId: fixture.accountA,
  email: fixture.emailA,
  customerName: "QA Consent Kupac",
});

async function clearConsents() {
  // `DELETE` nad append-only tabelom mora ići u obliku koji okidač ne vidi kao
  // izmenu istorije: brisanje CELE tabele u pripremi testa, kroz TRUNCATE.
  await db.sql.unsafe("TRUNCATE TABLE customer_contact_consents RESTART IDENTITY");
}

/* -------------------------------------------------------------------------
 * Podrazumevano i lifecycle
 * ---------------------------------------------------------------------- */

test("nov nalog nema nijednu saglasnost", async (t) => {
  if (guard(t)) return;
  const { loadConsentState } = await import("@/lib/customers/consent-service");
  await clearConsents();

  const state = await loadConsentState(fixture.accountA);
  assert.equal(state.email_marketing.granted, false);
  assert.equal(state.ad_personalization.granted, false);
});

test("davanje pa povlacenje ostavlja OBA reda u istoriji", async (t) => {
  if (guard(t)) return;
  const { loadConsentHistory, loadConsentState, recordConsentEvent } =
    await import("@/lib/customers/consent-service");
  await clearConsents();

  await recordConsentEvent(
    {
      customerUserId: fixture.accountA,
      purpose: "email_marketing",
      action: "granted",
      source: "customer_self_service",
    },
    asCustomer(),
  );
  await recordConsentEvent(
    {
      customerUserId: fixture.accountA,
      purpose: "email_marketing",
      action: "withdrawn",
      source: "customer_self_service",
    },
    asCustomer(),
  );

  const history = await loadConsentHistory(fixture.accountA);
  assert.equal(history.length, 2, "povlacenje je obrisalo raniji zapis");
  assert.deepEqual(
    history.map((row) => row.action),
    ["granted", "withdrawn"],
  );

  const state = await loadConsentState(fixture.accountA);
  assert.equal(state.email_marketing.granted, false);
});

test("dve svrhe su nezavisne i u bazi", async (t) => {
  if (guard(t)) return;
  const { loadConsentState, recordConsentEvent } = await import(
    "@/lib/customers/consent-service"
  );
  await clearConsents();

  await recordConsentEvent(
    {
      customerUserId: fixture.accountA,
      purpose: "email_marketing",
      action: "granted",
      source: "customer_self_service",
    },
    asCustomer(),
  );

  const state = await loadConsentState(fixture.accountA);
  assert.equal(state.email_marketing.granted, true);
  assert.equal(state.ad_personalization.granted, false);
});

test("saglasnost jednog naloga ne vazi za drugi nalog iste firme", async (t) => {
  if (guard(t)) return;
  const { loadConsentState, recordConsentEvent } = await import(
    "@/lib/customers/consent-service"
  );
  await clearConsents();

  await recordConsentEvent(
    {
      customerUserId: fixture.accountA,
      purpose: "email_marketing",
      action: "granted",
      source: "customer_self_service",
    },
    asCustomer(),
  );

  const stateB = await loadConsentState(fixture.accountB);
  assert.equal(
    stateB.email_marketing.granted,
    false,
    "saglasnost je procurila na drugi nalog",
  );
});

/* -------------------------------------------------------------------------
 * Autorizacija
 * ---------------------------------------------------------------------- */

test("kupac ne moze upisati saglasnost za tudji nalog", async (t) => {
  if (guard(t)) return;
  const { recordConsentEvent } = await import("@/lib/customers/consent-service");
  await clearConsents();

  await assert.rejects(
    () =>
      recordConsentEvent(
        {
          customerUserId: fixture.accountB,
          purpose: "email_marketing",
          action: "granted",
          source: "customer_self_service",
        },
        asCustomer(),
      ),
    /sopstveni nalog/,
  );

  const [{ count }] = await db.sql<{ count: number }[]>`
    SELECT count(*)::int AS count FROM customer_contact_consents`;
  assert.equal(count, 0, "odbijen upis je ipak nesto ostavio");
});

test("kancelarija evidentira i offline pristanak i offline povlacenje", async (t) => {
  if (guard(t)) return;
  const { loadConsentState, recordOfflineConsentDecision } = await import(
    "@/lib/customers/consent-service"
  );
  await clearConsents();

  const staff = {
    kind: "staff" as const,
    id: fixture.staffId,
    name: fixture.staffName,
    role: "kancelarija",
  };

  await recordOfflineConsentDecision(
    {
      customerUserId: fixture.accountA,
      purpose: "email_marketing",
      action: "granted",
      requestReference: "Potpisan formular na sajmu",
    },
    staff,
  );
  assert.equal((await loadConsentState(fixture.accountA)).email_marketing.granted, true);

  /*
   * Ovo je jezgro izmene: kupac je opozvao telefonom, i to sada MOZE da se
   * evidentira. Ranije nije moglo, pa bi u sistemu i dalje stajao kao saglasan.
   */
  const povuceno = await recordOfflineConsentDecision(
    {
      customerUserId: fixture.accountA,
      purpose: "email_marketing",
      action: "withdrawn",
      requestReference: "Telefonski zahtev 12.09.",
    },
    staff,
  );
  assert.equal(povuceno.recorded, true);
  assert.equal(
    (await loadConsentState(fixture.accountA)).email_marketing.granted,
    false,
    "effective status posle offline povlacenja nije false",
  );
});

test("offline povlacenje radi i za pristanak dat KROZ PORTAL", async (t) => {
  if (guard(t)) return;
  const { loadConsentHistory, loadConsentState, recordConsentEvent,
          recordOfflineConsentDecision } = await import(
    "@/lib/customers/consent-service"
  );
  await clearConsents();

  // Pristanak kroz portal…
  await recordConsentEvent(
    {
      customerUserId: fixture.accountA,
      purpose: "ad_personalization",
      action: "granted",
      source: "customer_self_service",
    },
    asCustomer(),
  );

  // …pa povlacenje evidentirano u kancelariji.
  await recordOfflineConsentDecision(
    {
      customerUserId: fixture.accountA,
      purpose: "ad_personalization",
      action: "withdrawn",
      requestReference: "Pisani zahtev, protokol 41/26",
    },
    { kind: "staff", id: fixture.staffId, name: fixture.staffName, role: "kancelarija" },
  );

  assert.equal(
    (await loadConsentState(fixture.accountA)).ad_personalization.granted,
    false,
  );
  const istorija = await loadConsentHistory(fixture.accountA);
  assert.equal(istorija.length, 2, "raniji zapis je nestao");
  assert.deepEqual(
    istorija.map((r) => r.source),
    ["customer_self_service", "office_recorded_offline"],
  );
});

test("kupac sam povlaci pristanak koji je evidentiran offline", async (t) => {
  if (guard(t)) return;
  const { loadConsentState, recordConsentEvent, recordOfflineConsentDecision } =
    await import("@/lib/customers/consent-service");
  await clearConsents();

  await recordOfflineConsentDecision(
    {
      customerUserId: fixture.accountA,
      purpose: "email_marketing",
      action: "granted",
      requestReference: "Formular sa sajma",
    },
    { kind: "staff", id: fixture.staffId, name: fixture.staffName, role: "kancelarija" },
  );

  await recordConsentEvent(
    {
      customerUserId: fixture.accountA,
      purpose: "email_marketing",
      action: "withdrawn",
      source: "customer_self_service",
    },
    asCustomer(),
  );

  assert.equal(
    (await loadConsentState(fixture.accountA)).email_marketing.granted,
    false,
  );
});

test("ponovljeno isto povlacenje ne pravi drugi red", async (t) => {
  if (guard(t)) return;
  const { loadConsentHistory, recordConsentEvent } = await import(
    "@/lib/customers/consent-service"
  );
  await clearConsents();

  await recordConsentEvent(
    {
      customerUserId: fixture.accountA,
      purpose: "email_marketing",
      action: "granted",
      source: "customer_self_service",
    },
    asCustomer(),
  );
  const prvo = await recordConsentEvent(
    {
      customerUserId: fixture.accountA,
      purpose: "email_marketing",
      action: "withdrawn",
      source: "customer_self_service",
    },
    asCustomer(),
  );
  const drugo = await recordConsentEvent(
    {
      customerUserId: fixture.accountA,
      purpose: "email_marketing",
      action: "withdrawn",
      source: "customer_self_service",
    },
    asCustomer(),
  );

  assert.equal(prvo.recorded, true);
  assert.equal(drugo.recorded, false, "ponovljeno povlacenje je napravilo duplikat");
  assert.match(drugo.reason ?? "", /vec povucena|već povučena/);
  assert.equal((await loadConsentHistory(fixture.accountA)).length, 2);
});

test("re-grant posle povlacenja trazi nov eksplicitan dogadjaj", async (t) => {
  if (guard(t)) return;
  const { loadConsentHistory, loadConsentState, recordConsentEvent } =
    await import("@/lib/customers/consent-service");
  await clearConsents();

  for (const action of ["granted", "withdrawn", "granted"] as const) {
    await recordConsentEvent(
      {
        customerUserId: fixture.accountA,
        purpose: "email_marketing",
        action,
        source: "customer_self_service",
      },
      asCustomer(),
    );
  }

  const istorija = await loadConsentHistory(fixture.accountA);
  assert.equal(istorija.length, 3, "re-grant nije zabelezen kao nov dogadjaj");
  assert.equal(
    (await loadConsentState(fixture.accountA)).email_marketing.granted,
    true,
  );
});

test("povlacenje ne dira stanje naloga", async (t) => {
  if (guard(t)) return;
  const { recordOfflineConsentDecision } = await import(
    "@/lib/customers/consent-service"
  );
  await clearConsents();

  const [pre] = await db.sql<{ status: string; session_version: number }[]>`
    SELECT status, session_version FROM customer_users WHERE id = ${fixture.accountA}`;

  await recordOfflineConsentDecision(
    {
      customerUserId: fixture.accountA,
      purpose: "email_marketing",
      action: "withdrawn",
      requestReference: "Telefonski zahtev",
    },
    { kind: "staff", id: fixture.staffId, name: fixture.staffName, role: "kancelarija" },
  );

  const [posle] = await db.sql<{ status: string; session_version: number }[]>`
    SELECT status, session_version FROM customer_users WHERE id = ${fixture.accountA}`;

  assert.equal(posle.status, pre.status, "povlacenje je promenilo stanje naloga");
  assert.equal(
    posle.session_version,
    pre.session_version,
    "povlacenje je opozvalo sesiju",
  );
});

test("offline zapis bez reference na zahtev se odbija", async (t) => {
  if (guard(t)) return;
  const { recordOfflineConsentDecision } = await import(
    "@/lib/customers/consent-service"
  );
  await clearConsents();

  await assert.rejects(
    () =>
      recordOfflineConsentDecision(
        {
          customerUserId: fixture.accountA,
          purpose: "email_marketing",
          action: "withdrawn",
          requestReference: "x",
        },
        { kind: "staff", id: fixture.staffId, name: fixture.staffName, role: "kancelarija" },
      ),
    /referencu na zahtev/,
  );
});

test("komercijalista bez sposobnosti ne moze menjati tudju saglasnost", async (t) => {
  if (guard(t)) return;
  const { resolveCapabilities } = await import("@/lib/authz/permissions.mjs");
  const { recordOfflineConsentDecision } = await import(
    "@/lib/customers/consent-service"
  );
  await clearConsents();

  /*
   * Kapija je `customer_accounts:manage` i proverava je server akcija.
   * Ovde se dokazuje da je komercijalista sa svojim uobicajenim paketima
   * NEMA — dakle ruta ga odbija pre nego sto servis uopste bude pozvan.
   */
  const rep = resolveCapabilities("komercijalista", ["cene_predlog", "mapiranja"]);
  assert.equal(
    rep.has("customer_accounts:manage"),
    false,
    "komercijalista je dobio pravo nad tudjom saglasnoscu",
  );

  // A i sam servis odbija kupca koji bi se predstavio kao akter nad tudjim nalogom.
  await assert.rejects(
    () =>
      recordOfflineConsentDecision(
        {
          customerUserId: fixture.accountB,
          purpose: "email_marketing",
          action: "withdrawn",
          requestReference: "pokusaj",
        },
        // @ts-expect-error namerno pogresan akter — servis mora da ga odbije
        { kind: "customer", accountId: fixture.accountA, email: fixture.emailA, customerName: "X" },
      ),
    /zaposleni, ne kupac|sopstveni nalog/,
  );
});

test("kupac ne moze povuci saglasnost drugog kupca", async (t) => {
  if (guard(t)) return;
  const { recordConsentEvent } = await import("@/lib/customers/consent-service");
  await clearConsents();

  await assert.rejects(
    () =>
      recordConsentEvent(
        {
          customerUserId: fixture.accountB,
          purpose: "email_marketing",
          action: "withdrawn",
          source: "customer_self_service",
        },
        asCustomer(),
      ),
    /sopstveni nalog/,
  );

  const [{ count }] = await db.sql<{ count: number }[]>`
    SELECT count(*)::int AS count FROM customer_contact_consents`;
  assert.equal(count, 0);
});

/* -------------------------------------------------------------------------
 * Append-only i CHECK-ovi u bazi
 * ---------------------------------------------------------------------- */

test("zapis saglasnosti se ne moze izmeniti ni obrisati", async (t) => {
  if (guard(t)) return;
  const { recordConsentEvent } = await import("@/lib/customers/consent-service");
  await clearConsents();

  await recordConsentEvent(
    {
      customerUserId: fixture.accountA,
      purpose: "ad_personalization",
      action: "granted",
      source: "customer_self_service",
    },
    asCustomer(),
  );

  const [row] = await db.sql<{ id: number }[]>`
    SELECT id FROM customer_contact_consents LIMIT 1`;

  await assert.rejects(
    () => db.sql`
      UPDATE customer_contact_consents SET action = 'withdrawn' WHERE id = ${row.id}`,
    /append-only/i,
  );
  await assert.rejects(
    () => db.sql`DELETE FROM customer_contact_consents WHERE id = ${row.id}`,
    /append-only/i,
  );
});

test("offline izvor bez potpisa se ne moze upisati ni direktno", async (t) => {
  if (guard(t)) return;
  await clearConsents();
  await assert.rejects(
    () => db.sql`
      INSERT INTO customer_contact_consents
        (customer_user_id, purpose, action, source, consent_text_version)
      VALUES (${fixture.accountA}, 'email_marketing', 'granted',
              'office_recorded_offline', 'v1')`,
    /customer_contact_consents_source_ck/,
  );
});

test("self-service zapis sa potpisom zaposlenog se odbija", async (t) => {
  if (guard(t)) return;
  await clearConsents();
  await assert.rejects(
    () => db.sql`
      INSERT INTO customer_contact_consents
        (customer_user_id, purpose, action, source, consent_text_version, recorded_by)
      VALUES (${fixture.accountA}, 'email_marketing', 'granted',
              'customer_self_service', 'v1', ${fixture.staffId})`,
    /customer_contact_consents_source_ck/,
  );
});

test("prazna verzija teksta se odbija", async (t) => {
  if (guard(t)) return;
  await clearConsents();
  await assert.rejects(
    () => db.sql`
      INSERT INTO customer_contact_consents
        (customer_user_id, purpose, action, source, consent_text_version)
      VALUES (${fixture.accountA}, 'email_marketing', 'granted',
              'customer_self_service', '   ')`,
    /customer_contact_consents_text_version_ck/,
  );
});

test("audit zapis ne nosi PIB, adresu ni telefon", async (t) => {
  if (guard(t)) return;
  const { recordConsentEvent } = await import("@/lib/customers/consent-service");
  await clearConsents();
  /*
   * `audit_log` se NE cisti — append-only okidac to (ispravno) odbija. Umesto
   * toga se cita najnoviji zapis za ovaj nalog, sto je i onako ono sto test
   * tvrdi: da POSLEDNJI upis ne nosi osetljive vrednosti.
   */

  await recordConsentEvent(
    {
      customerUserId: fixture.accountA,
      purpose: "email_marketing",
      action: "granted",
      source: "customer_self_service",
    },
    asCustomer(),
  );

  const [entry] = await db.sql<
    { value_after: Record<string, unknown>; actor_label: string }[]
  >`SELECT value_after, actor_label FROM audit_log
    WHERE entity_type = 'Saglasnost kupca' AND entity_id = ${fixture.accountA}
    ORDER BY id DESC LIMIT 1`;

  assert.ok(entry, "saglasnost nije ostavila audit zapis");
  const payload = JSON.stringify(entry.value_after).toLowerCase();
  for (const forbidden of ["pib", "adresa", "telefon", "lozink", "token"]) {
    assert.ok(!payload.includes(forbidden), `audit nosi ${forbidden}`);
  }
  assert.match(entry.actor_label, /kupac/i);
});
