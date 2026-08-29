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
 * Istorija mapiranja (F-10) nad stvarnim PostgreSQL-om.
 *
 * Dokazuje ono sto cista logika ne moze: da parcijalni unique indeks propusta
 * ISTORIJSKE redove a i dalje dopusta tacno jedan zivi, i da poniStena veza
 * cuva na sta je pokazivala.
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
let fx: { articleId: string; actor: { id: string; name: string; role: string } };

before(async () => {
  if (reason) return;
  ensureTestCryptoEnv();
  db = await initTestDatabase();

  const run = randomUUID().slice(0, 8);
  const [article] = await db.sql<{ id: string }[]>`
    INSERT INTO articles (code, name) VALUES (${`QAH-${run}`}, 'QA istorija') RETURNING id`;
  const accounts = await seedAccounts(db, [{ key: "office", role: "kancelarija" }]);
  fx = {
    articleId: article.id,
    actor: {
      id: accounts.office.id,
      name: accounts.office.name,
      role: accounts.office.role,
    },
  };
});

after(async () => {
  if (!reason && db) {
    await db.sql`DELETE FROM notifications`;
    await db.sql`DELETE FROM article_catalog_mappings`;
    await db.sql`DELETE FROM articles WHERE code LIKE 'QAH-%'`;
    await cleanupQa(db);
  }
  await closeTestDatabase();
});

test("ponistavanje cuva prethodni slug, ko i kada", async (t) => {
  if (guard(t)) return;
  const { decideMapping } = await import("@/lib/commercial/mapping-service");
  await db.sql`DELETE FROM article_catalog_mappings`;

  await decideMapping(
    {
      articleId: fx.articleId,
      status: "mapped",
      catalogProductSlug: "stari-proizvod",
      catalogVariantId: "3.5L",
      note: "provereno u cenovniku",
    },
    fx.actor,
  );

  await decideMapping(
    { articleId: fx.articleId, status: "revoked", note: "pogresno povezano" },
    fx.actor,
  );

  const [row] = await db.sql<
    {
      status: string;
      catalog_product_slug: string | null;
      previous_catalog_product_slug: string | null;
      previous_catalog_variant_id: string | null;
      revoked_by: string | null;
      revoked_at: Date | null;
      note: string;
    }[]
  >`SELECT status, catalog_product_slug, previous_catalog_product_slug,
           previous_catalog_variant_id, revoked_by, revoked_at, note
      FROM article_catalog_mappings WHERE article_id = ${fx.articleId}`;

  assert.equal(row.status, "revoked");
  // Aktivni slug se prazni; istorijski se cuva.
  assert.equal(row.catalog_product_slug, null);
  assert.equal(row.previous_catalog_product_slug, "stari-proizvod");
  assert.equal(row.previous_catalog_variant_id, "3.5L");
  assert.equal(row.revoked_by, fx.actor.id);
  assert.ok(row.revoked_at);
  assert.match(row.note, /pogresno povezano/);
});

test("posle ponistavanja novo mapiranje istog artikla prolazi", async (t) => {
  if (guard(t)) return;
  const { decideMapping } = await import("@/lib/commercial/mapping-service");
  await db.sql`DELETE FROM article_catalog_mappings`;

  await decideMapping(
    {
      articleId: fx.articleId,
      status: "mapped",
      catalogProductSlug: "stari",
      note: "prva veza",
    },
    fx.actor,
  );
  await decideMapping(
    { articleId: fx.articleId, status: "revoked", note: "ponisteno" },
    fx.actor,
  );
  await decideMapping(
    {
      articleId: fx.articleId,
      status: "mapped",
      catalogProductSlug: "novi",
      note: "druga veza",
    },
    fx.actor,
  );

  /*
   * `ORDER BY created_at`, ne `id`: primarni kljuc je `uuid` sa
   * `defaultRandom()`, pa bi sortiranje po njemu bilo nasumicno.
   */
  const rows = await db.sql<{ status: string; catalog_product_slug: string | null }[]>`
    SELECT status, catalog_product_slug FROM article_catalog_mappings
     WHERE article_id = ${fx.articleId} ORDER BY created_at`;

  assert.equal(rows.length, 2, "istorija je izgubljena ili nije nastao nov red");
  assert.deepEqual(
    rows.map((r) => r.status),
    ["revoked", "mapped"],
  );
  assert.equal(rows[1].catalog_product_slug, "novi");
});

test("dva ZIVA reda i dalje ne mogu postojati", async (t) => {
  if (guard(t)) return;
  await db.sql`DELETE FROM article_catalog_mappings`;
  await db.sql`
    INSERT INTO article_catalog_mappings (article_id, catalog_product_slug, status, note)
    VALUES (${fx.articleId}, 'a', 'mapped', 'prva')`;

  await assert.rejects(
    () => db.sql`
      INSERT INTO article_catalog_mappings (article_id, catalog_product_slug, status, note)
      VALUES (${fx.articleId}, 'b', 'mapped', 'druga')`,
    /article_catalog_mappings_live_key/,
  );
});

test("vise istorijskih redova je dozvoljeno", async (t) => {
  if (guard(t)) return;
  await db.sql`DELETE FROM article_catalog_mappings`;

  await db.sql`
    INSERT INTO article_catalog_mappings (article_id, status, note)
    VALUES (${fx.articleId}, 'rejected', 'prvi odbijen')`;
  await db.sql`
    INSERT INTO article_catalog_mappings (article_id, status, note)
    VALUES (${fx.articleId}, 'rejected', 'drugi odbijen')`;
  await db.sql`
    INSERT INTO article_catalog_mappings
      (article_id, status, note, previous_catalog_product_slug, revoked_by, revoked_at)
    VALUES (${fx.articleId}, 'revoked', 'ponisteno', 'x', ${fx.actor.id}, now())`;

  const [{ count }] = await db.sql<{ count: number }[]>`
    SELECT count(*)::int AS count FROM article_catalog_mappings
     WHERE article_id = ${fx.articleId}`;
  assert.equal(count, 3);
});

test("revoked bez prethodnog sluga i potpisa se odbija u bazi", async (t) => {
  if (guard(t)) return;
  await db.sql`DELETE FROM article_catalog_mappings`;

  await assert.rejects(
    () => db.sql`
      INSERT INTO article_catalog_mappings (article_id, status, note)
      VALUES (${fx.articleId}, 'revoked', 'bez istorije')`,
    /article_catalog_mappings_revoked_ck/,
  );
});

test("audit razlikuje odbijen predlog od ponistene veze", async (t) => {
  if (guard(t)) return;
  const { decideMapping } = await import("@/lib/commercial/mapping-service");
  await db.sql`DELETE FROM article_catalog_mappings`;

  await decideMapping(
    {
      articleId: fx.articleId,
      status: "mapped",
      catalogProductSlug: "x",
      note: "veza",
    },
    fx.actor,
  );
  await decideMapping(
    { articleId: fx.articleId, status: "revoked", note: "ponisteno" },
    fx.actor,
  );

  const [entry] = await db.sql<{ action: string; value_after: Record<string, unknown> }[]>`
    SELECT action, value_after FROM audit_log
     WHERE entity_id = ${fx.articleId} ORDER BY id DESC LIMIT 1`;

  assert.match(entry.action, /Poništena potvrđena veza/);
  assert.equal(entry.value_after.prethodniSlug, "x");
});
