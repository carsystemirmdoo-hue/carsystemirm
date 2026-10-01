import assert from "node:assert/strict";
import { generateKeyPairSync, randomBytes, randomUUID, sign as cryptoSign } from "node:crypto";
import { readFile } from "node:fs/promises";
import test, { after, before } from "node:test";
import { cleanupQa, closeTestDatabase, ensureTestCryptoEnv, initTestDatabase, seedAccounts, skipReason, type TestDatabase } from "./harness.mts";

/**
 * Automatski obračun preporuka posle uspešnog uvoza (0032), kroz PRAVU rutu
 * uređaja sa potpisanim zahtevom.
 */

const reason = skipReason();
const guard = (t: { skip: (m?: string) => void }) => (reason ? (t.skip(reason), true) : false);
const ISSUER = "QA01";
const KORENSKI = new URL("../../", import.meta.url);
let db: TestDatabase;
let owner: { id: string; name: string; role: string };
let officeId = "";
let device: Awaited<ReturnType<typeof aktivanUredjaj>>;

before(async () => {
  if (reason) return;
  ensureTestCryptoEnv();
  process.env.FEATURE_SYNC_DEVICE_INGEST = "1";
  process.env.FEATURE_RECOMMENDATIONS = "1";
  db = await initTestDatabase();
  const a = await seedAccounts(db, [{ key: "owner", role: "gazda" }, { key: "office", role: "kancelarija" }]);
  owner = { id: a.owner.id, name: a.owner.name, role: a.owner.role };
  officeId = a.office.id;
  device = await aktivanUredjaj();
  const [c] = await db.sql<{ id: string }[]>`INSERT INTO customers (pib, name) VALUES (${`QA${randomUUID().slice(0, 6)}`}, 'QA Kupac') RETURNING id`;
  for (const code of ["09001", "09002", "00042", "09006", "09003"]) {
    await db.sql`INSERT INTO customer_external_identifiers (source_system, issuer_code, external_partner_code, customer_id, status)
                 VALUES ('biznisoft', ${ISSUER}, ${code}, ${c.id}, 'mapped') ON CONFLICT DO NOTHING`;
  }
});

after(async () => {
  if (!reason && db) {
    await db.sql`DELETE FROM recommendation_recompute_requests`;
    await db.sql`DELETE FROM recommendation_results`;
    await db.sql`DELETE FROM recommendation_runs`;
    await db.sql`DELETE FROM source_document_lines`;
    await db.sql`DELETE FROM source_documents`;
    await db.sql`DELETE FROM invoice_lines`;
    await db.sql`DELETE FROM invoices`;
    await db.sql`DELETE FROM customer_external_identifiers`;
    await db.sql`DELETE FROM articles WHERE code LIKE '9%'`;
    await db.sql`DELETE FROM customers WHERE pib LIKE 'QA%'`;
    await db.sql`DELETE FROM auth_rate_limits`;
    await db.sql`DELETE FROM sync_request_nonces`;
    await db.sql`DELETE FROM sync_device_keys`;
    await db.sql`DELETE FROM sync_devices`;
    await cleanupQa(db);
  }
  delete process.env.FEATURE_SYNC_DEVICE_INGEST;
  delete process.env.FEATURE_RECOMMENDATIONS;
  delete process.env.RECOMMENDATIONS_AUTO_RECOMPUTE;
  await closeTestDatabase();
});

async function aktivanUredjaj() {
  const { registerDevice, activateDevice } = await import("@/lib/sync/device/registry");
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const spki = publicKey.export({ type: "spki", format: "der" }).toString("base64");
  const kod = `dev-${randomUUID().slice(0, 8)}`;
  const out = await registerDevice({ deviceCode: kod, label: "QA", sourceSystem: "biznisoft", issuerCode: ISSUER, keyId: "k1", publicKeySpki: spki }, owner);
  await activateDevice({ deviceId: out.deviceId, keyId: "k1", expectedFingerprint: out.fingerprint }, owner);
  return { ...out, privateKey, deviceCode: kod };
}

async function posalji(ime: string) {
  const { parseBiznisoftPdf } = await import("@/lib/pdf/parseDocument");
  const { canonicalFromParsedDocument } = await import("@/lib/sync/contract/fromParsedDocument.mjs");
  const { bodyHash, HEADERS, PROTOCOL_VERSION, signingString } = await import("@/lib/sync/device/signing.mjs");
  const bytes = new Uint8Array(await readFile(new URL(`fixtures/dev/biznisoft/${ime}`, KORENSKI)));
  const payload = canonicalFromParsedDocument(await parseBiznisoftPdf(bytes), bytes, { issuerCode: ISSUER });
  const telo = JSON.stringify(payload);
  const otisak = bodyHash(new TextEncoder().encode(telo));
  const nonce = randomBytes(16).toString("hex");
  const timestamp = new Date().toISOString();
  const niz = signingString({ version: PROTOCOL_VERSION, deviceId: device.deviceCode, keyId: "k1", method: "POST", path: "/api/sync/ingest", timestamp, nonce, bodyHash: otisak });
  const potpis = cryptoSign(null, Buffer.from(niz, "utf8"), device.privateKey).toString("base64");
  const request = new Request("https://qa.invalid/api/sync/ingest", {
    method: "POST",
    headers: {
      [HEADERS.version]: PROTOCOL_VERSION, [HEADERS.device]: device.deviceCode, [HEADERS.key]: "k1",
      [HEADERS.timestamp]: timestamp, [HEADERS.nonce]: nonce, [HEADERS.bodyHash]: otisak, [HEADERS.signature]: potpis,
      "content-type": "application/json",
    },
    body: telo,
  });
  const res = await (await import("@/app/api/sync/ingest/route")).POST(request);
  return ((await res.json()) as { code: string }).code;
}

const zahtevi = async () =>
  db.sql<{ id: string; status: string; source: string; document_count: number; failure_code: string | null; failure_detail: string | null; run_id: string | null }[]>`
    SELECT id, status, source, document_count, failure_code, failure_detail, run_id FROM recommendation_recompute_requests ORDER BY requested_at`;

test("prekidač isključen: uvoz radi, zahtev za obračun ne nastaje", async (t) => {
  if (guard(t)) return;
  delete process.env.RECOMMENDATIONS_AUTO_RECOMPUTE;
  assert.equal(await posalji("jedna-stavka.pdf"), "ingested");
  assert.equal((await zahtevi()).length, 0);
});

test("uvoz → jedan zahtev; ponovljen dokument ne pravi novi; više dokumenata se spaja", async (t) => {
  if (guard(t)) return;
  process.env.RECOMMENDATIONS_AUTO_RECOMPUTE = "1";
  assert.equal(await posalji("vise-stavki.pdf"), "ingested");
  let rows = await zahtevi();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, "pending");
  assert.equal(rows[0].source, "device");
  assert.equal(await posalji("vise-stavki.pdf"), "duplicate_file", "isti fajl ponovo");
  assert.equal((await zahtevi()).length, 1, "ponovljen uvoz ne pravi zahtev");
  assert.equal(await posalji("vodeca-nula-partner.pdf"), "ingested");
  rows = await zahtevi();
  assert.equal(rows.length, 1, "niz dokumenata = jedan zahtev");
  assert.equal(rows[0].document_count, 2);
});

test("obrada: obračun sa izvorom „ingest”, bez čoveka, aktivan; bez novih podataka nema novog zahteva", async (t) => {
  if (guard(t)) return;
  const { processRecomputeQueue, requestRecomputeAfterIngest } = await import("@/lib/recommendations/auto-recompute");
  const r = await processRecomputeQueue();
  assert.deepEqual({ processed: r.processed, succeeded: r.succeeded, failed: r.failed }, { processed: 1, succeeded: 1, failed: 0 });
  const [row] = await zahtevi();
  assert.equal(row.status, "succeeded");
  const [run] = await db.sql<{ trigger_source: string; requested_by: string | null; is_active: boolean; status: string }[]>`
    SELECT trigger_source::text, requested_by, is_active, status FROM recommendation_runs WHERE id = ${row.run_id}`;
  assert.deepEqual(run, { trigger_source: "ingest", requested_by: null, is_active: true, status: "succeeded" });
  assert.equal((await requestRecomputeAfterIngest("device")).status, "unchanged");
  assert.equal((await processRecomputeQueue()).processed, 0, "nema šta da se obradi");
});

test("neuspeh je vidljiv (bez poruke drajvera), prethodni obračun važi, ponavljanje uspeva", async (t) => {
  if (guard(t)) return;
  const { processRecomputeQueue, requestRecomputeAfterIngest, loadRecomputeStatus, retryRecomputeRequest } = await import("@/lib/recommendations/auto-recompute");
  const [before_] = await db.sql<{ id: string }[]>`SELECT id FROM recommendation_runs WHERE is_active`;
  assert.equal(await posalji("dve-strane-ponovljeno-zaglavlje.pdf"), "ingested");
  const r = await processRecomputeQueue({ recompute: async () => { throw new Error('relation "x" SELECT tajna vrednost'); } });
  assert.equal(r.failed, 1);
  const status = await loadRecomputeStatus();
  assert.equal(status.latest?.status, "failed");
  assert.equal(status.latest?.failureCode, "unexpected");
  assert.doesNotMatch(status.latest!.failureDetail!, /SELECT|tajna|relation/, "poruka drajvera ne ide na ekran");
  const [still] = await db.sql<{ id: string }[]>`SELECT id FROM recommendation_runs WHERE is_active`;
  assert.equal(still.id, before_.id, "prethodni obračun važi dalje");
  assert.equal((await requestRecomputeAfterIngest("device")).status, "unchanged", "ponovljen uvoz ne sakriva neuspeh");

  const { loadPortalUser } = await import("@/lib/authz/user-repository");
  const office = (await loadPortalUser(officeId))!;
  assert.equal((await retryRecomputeRequest(randomUUID(), office)).ok, false);
  assert.equal((await retryRecomputeRequest(status.latest!.id, office)).ok, true);
  const again = await processRecomputeQueue();
  assert.equal(again.succeeded, 1);
  const [done] = await db.sql<{ status: string; attempts: number }[]>`SELECT status, attempts FROM recommendation_recompute_requests WHERE id = ${status.latest!.id}`;
  assert.deepEqual(done, { status: "succeeded", attempts: 2 });
  assert.equal((await retryRecomputeRequest(status.latest!.id, office)).ok, false, "uspeli se ne ponavlja");
});

test("zaglavljen obračun ističe kao vidljiv neuspeh; istovremena obrada daje jedan obračun", async (t) => {
  if (guard(t)) return;
  const { processRecomputeQueue } = await import("@/lib/recommendations/auto-recompute");
  await db.sql`INSERT INTO recommendation_recompute_requests (source, status, input_fingerprint, attempts, started_at)
               VALUES ('device', 'running', 'x', 1, now() - interval '20 minutes')`;
  await processRecomputeQueue();
  const [stuck] = await db.sql<{ status: string; failure_code: string }[]>`SELECT status, failure_code FROM recommendation_recompute_requests WHERE input_fingerprint = 'x'`;
  assert.deepEqual(stuck, { status: "failed", failure_code: "timeout" });

  // Nov zahtev (ispravni sintetički dokumenti su potrošeni) — obrada je ista.
  await db.sql`INSERT INTO recommendation_recompute_requests (source, input_fingerprint) VALUES ('device', 'y')`;
  const runsBefore = (await db.sql<{ n: number }[]>`SELECT count(*)::int n FROM recommendation_runs`)[0].n;
  const results = await Promise.all([processRecomputeQueue(), processRecomputeQueue(), processRecomputeQueue()]);
  assert.equal(results.reduce((s, r) => s + r.succeeded, 0), 1, "jedan obračun");
  const runsAfter = (await db.sql<{ n: number }[]>`SELECT count(*)::int n FROM recommendation_runs`)[0].n;
  assert.equal(runsAfter, runsBefore + 1);
});
