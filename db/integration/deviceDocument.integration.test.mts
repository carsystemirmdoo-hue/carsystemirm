import assert from "node:assert/strict";
import { generateKeyPairSync, randomBytes, randomUUID, sign as cryptoSign } from "node:crypto";
import { readFile } from "node:fs/promises";
import test, { after, before, beforeEach } from "node:test";
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
 * Storno i knjižno odobrenje sa uređaja kao PDF (`/api/sync/document`, konektor 0.3.14).
 *
 * Nad STVARNIM route handler-ima i pravim PostgreSQL-om, sa sintetičkim fixture-ima:
 * - knjižno odobrenje postaje dokument vrste `knjizno_odobrenje` sa NEGATIVNIM iznosima;
 * - storno ne ulazi u promet, a potpun storno sa referencom isključuje original;
 * - fakturu ovim putem nije moguće poslati (ni pod pravim, ni pod lažnim imenom vrste).
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
let owner: { id: string; name: string; role: string };

const ISSUER = "QA01";
const KORENSKI = new URL("../../", import.meta.url);
const BASE = "https://qa.invalid";

before(async () => {
  if (reason) return;
  ensureTestCryptoEnv();
  process.env.FEATURE_SYNC_DEVICE_INGEST = "1";
  db = await initTestDatabase();
  const a = await seedAccounts(db, [{ key: "owner", role: "gazda" }]);
  owner = { id: a.owner.id, name: a.owner.name, role: a.owner.role };
});

after(async () => {
  if (!reason && db) {
    await ocisti();
    await db.sql`DELETE FROM sync_request_nonces`;
    await db.sql`DELETE FROM sync_device_keys`;
    await db.sql`DELETE FROM sync_devices`;
    await cleanupQa(db);
  }
  delete process.env.FEATURE_SYNC_DEVICE_INGEST;
  await closeTestDatabase();
});

async function ocisti() {
  await db.sql.begin(async (tx) => {
    // Zapis storna se namerno ne može obrisati; čišćenje test baze isključuje okidače samo u ovoj transakciji.
    await tx`SET LOCAL session_replication_role = replica`;
    await tx`DELETE FROM invoice_reversals`;
    await tx`DELETE FROM source_document_lines`;
    await tx`UPDATE source_documents SET invoice_id = NULL`;
    await tx`DELETE FROM invoice_lines`;
    await tx`DELETE FROM invoices`;
    await tx`DELETE FROM source_documents`;
  });
  await db.sql`DELETE FROM customer_external_identifiers`;
  await db.sql`DELETE FROM article_catalog_mappings`;
  await db.sql`DELETE FROM articles WHERE code LIKE '9%'`;
  await db.sql`DELETE FROM customers WHERE pib LIKE 'QA%'`;
  await db.sql`DELETE FROM auth_rate_limits`;
  await db.sql`DELETE FROM sync_request_nonces`;
}

beforeEach(async () => {
  if (!reason) await ocisti();
});

async function aktivanUredjaj() {
  const { registerDevice, activateDevice } = await import("@/lib/sync/device/registry");
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const kod = `dev-${randomUUID().slice(0, 8)}`;
  const out = await registerDevice(
    {
      deviceCode: kod,
      label: "QA uređaj",
      sourceSystem: "biznisoft",
      issuerCode: ISSUER,
      keyId: "k1",
      publicKeySpki: publicKey.export({ type: "spki", format: "der" }).toString("base64"),
    },
    owner,
  );
  await activateDevice({ deviceId: out.deviceId, keyId: "k1", expectedFingerprint: out.fingerprint }, owner);
  return { privateKey, deviceCode: kod, deviceId: out.deviceId };
}
type Uredjaj = Awaited<ReturnType<typeof aktivanUredjaj>>;

async function mapiranKupac(partnerCode = "09001") {
  const [c] = await db.sql<{ id: string }[]>`
    INSERT INTO customers (pib, name) VALUES (${`QA${randomUUID().slice(0, 6)}`}, 'QA Kupac') RETURNING id`;
  await db.sql`
    INSERT INTO customer_external_identifiers (source_system, issuer_code, external_partner_code, customer_id, status)
    VALUES ('biznisoft', ${ISSUER}, ${partnerCode}, ${c.id}, 'mapped')`;
  return c.id;
}

const fixture = async (ime: string) => new Uint8Array(await readFile(new URL(`fixtures/dev/biznisoft/${ime}`, KORENSKI)));

async function potpisano(uredjaj: Uredjaj, path: string, bajtovi: Uint8Array) {
  const { bodyHash, HEADERS, PROTOCOL_VERSION, signingString } = await import("@/lib/sync/device/signing.mjs");
  const otisak = bodyHash(bajtovi);
  const nonce = randomBytes(16).toString("hex");
  const timestamp = new Date().toISOString();
  const niz = signingString({
    version: PROTOCOL_VERSION, deviceId: uredjaj.deviceCode, keyId: "k1", method: "POST", path, timestamp, nonce, bodyHash: otisak,
  });
  const potpis = cryptoSign(null, Buffer.from(niz, "utf8"), uredjaj.privateKey).toString("base64");
  return new Request(`${BASE}${path}`, {
    method: "POST",
    headers: {
      [HEADERS.version]: PROTOCOL_VERSION,
      [HEADERS.device]: uredjaj.deviceCode,
      [HEADERS.key]: "k1",
      [HEADERS.timestamp]: timestamp,
      [HEADERS.nonce]: nonce,
      [HEADERS.bodyHash]: otisak,
      [HEADERS.signature]: potpis,
      "content-type": "application/json",
    },
    body: Buffer.from(bajtovi),
  });
}

async function posaljiDokument(uredjaj: Uredjaj, kind: string, pdf: Uint8Array, izmeni?: (o: Record<string, unknown>) => void) {
  const { buildDeviceDocumentBody } = await import("@/lib/sync/contract/deviceDocument.mjs");
  let telo: Uint8Array;
  if (kind === "storno" || kind === "knjizno_odobrenje") {
    telo = buildDeviceDocumentBody({ kind, bytes: pdf });
    if (izmeni) {
      const o = JSON.parse(Buffer.from(telo).toString("utf8"));
      izmeni(o);
      telo = Buffer.from(JSON.stringify(o), "utf8");
    }
  } else {
    // Ručno sastavljeno telo sa nedozvoljenom vrstom — graditelj ga ne bi napravio.
    const { createHash } = await import("node:crypto");
    telo = Buffer.from(JSON.stringify({
      contract: "carsystem/pdf-document/v1", kind, pdf_base64: Buffer.from(pdf).toString("base64"),
      pdf_sha256: createHash("sha256").update(pdf).digest("hex"),
    }), "utf8");
  }
  const { POST } = await import("@/app/api/sync/document/route");
  const res = await POST(await potpisano(uredjaj, "/api/sync/document", telo));
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

async function posaljiFakturu(uredjaj: Uredjaj, ime: string) {
  const { parseBiznisoftPdf } = await import("@/lib/pdf/parseDocument");
  const { canonicalFromParsedDocument } = await import("@/lib/sync/contract/fromParsedDocument.mjs");
  const bytes = await fixture(ime);
  const payload = canonicalFromParsedDocument(await parseBiznisoftPdf(bytes), bytes, { issuerCode: ISSUER });
  const { POST } = await import("@/app/api/sync/ingest/route");
  const res = await POST(await potpisano(uredjaj, "/api/sync/ingest", Buffer.from(JSON.stringify(payload), "utf8")));
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

/* ========================================================================= */

test("knjižno odobrenje sa uređaja umanjuje promet kupca: vrsta knjizno_odobrenje, negativni iznosi", async (t) => {
  if (guard(t)) return;
  const uredjaj = await aktivanUredjaj();
  const kupac = await mapiranKupac("09001");

  const r = await posaljiDokument(uredjaj, "knjizno_odobrenje", await fixture("knjizno-odobrenje.pdf"));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.code, "ingested");

  const [inv] = await db.sql<{ document_kind: string; number: string; customer_id: string; net: string; tax: string; total: string; origin: string }[]>`
    SELECT document_kind::text, number, customer_id, net_amount::text AS net, tax_amount::text AS tax, total_amount::text AS total, origin::text
      FROM invoices`;
  assert.equal(inv.document_kind, "knjizno_odobrenje");
  assert.equal(inv.number, "99-OK900000011");
  assert.equal(inv.customer_id, kupac);
  assert.equal(Number(inv.net), -1000);
  assert.equal(Number(inv.tax), -200);
  assert.equal(Number(inv.total), -1200);
  assert.equal(inv.origin, "device");

  const linije = await db.sql<{ quantity: string; line_amount: string }[]>`SELECT quantity::text, line_amount::text FROM invoice_lines`;
  assert.deepEqual(linije.map((l) => [Number(l.quantity), Number(l.line_amount)]), [[-1, -1000]]);

  // Izvorni dokument ostaje sa ODŠTAMPANIM (pozitivnim) iznosima i ulazi u promet.
  const [sd] = await db.sql<{ type: string; review: string; invoice: string | null; device: string | null }[]>`
    SELECT business_document_type::text AS type, manual_review::text AS review, invoice_id AS invoice, delivered_by_device_id AS device
      FROM source_documents`;
  assert.equal(sd.type, "knjizno_odobrenje");
  assert.equal(sd.review, "not_required");
  assert.ok(sd.invoice);
  assert.equal(sd.device, uredjaj.deviceId);

  // Promet: korekcija vrednosti, ne prodaja ni povrat robe.
  const { summarize } = await import("@/lib/sales/totals.mjs");
  const s = summarize(linije.map((l) => ({ documentKind: "knjizno_odobrenje", quantity: Number(l.quantity), lineAmount: Number(l.line_amount) })));
  assert.equal(s.correctionValue, -1000);
  assert.equal(s.returnValue, 0);
  assert.equal(s.net, -1000);

  // Ponovno slanje istog fajla ne pravi drugi dokument.
  const opet = await posaljiDokument(uredjaj, "knjizno_odobrenje", await fixture("knjizno-odobrenje.pdf"));
  assert.equal(opet.body.code, "duplicate_file");
  const [{ n }] = await db.sql<{ n: number }[]>`SELECT count(*)::int AS n FROM invoices`;
  assert.equal(n, 1);
});

test("knjižno odobrenje za nepovezanog kupca čeka mapiranje i ne pravi promet", async (t) => {
  if (guard(t)) return;
  const uredjaj = await aktivanUredjaj();
  const r = await posaljiDokument(uredjaj, "knjizno_odobrenje", await fixture("knjizno-odobrenje.pdf"));
  assert.equal(r.status, 200);
  assert.equal(r.body.code, "awaiting_customer_mapping");
  const [{ n }] = await db.sql<{ n: number }[]>`SELECT count(*)::int AS n FROM invoices`;
  assert.equal(n, 0);
});

test("storno sa uređaja: ne ulazi u promet, potpuno storno isključuje original", async (t) => {
  if (guard(t)) return;
  const uredjaj = await aktivanUredjaj();
  await mapiranKupac("09001");

  const f = await posaljiFakturu(uredjaj, "jedna-stavka.pdf");
  assert.equal(f.body.code, "ingested", JSON.stringify(f.body));

  const r = await posaljiDokument(uredjaj, "storno", await fixture("storno.pdf"));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.code, "quarantined");

  const [rev] = await db.sql<{ status: string; original_number: string }[]>`SELECT status::text, original_number FROM invoice_reversals`;
  assert.equal(rev.status, "applied");
  assert.equal(rev.original_number, "99-RN900000001");

  // Storno nije faktura; original više ne ulazi u promet.
  const fakture = await db.sql<{ number: string }[]>`SELECT number FROM invoices`;
  assert.deepEqual(fakture.map((x) => x.number), ["99-RN900000001"]);
  const [{ n }] = await db.sql<{ n: number }[]>`SELECT count(*)::int AS n FROM effective_sales_ledger`;
  assert.equal(n, 0);
});

test("faktura ne može ovim putem — ni pod svojim imenom ni kao lažni storno", async (t) => {
  if (guard(t)) return;
  const uredjaj = await aktivanUredjaj();
  await mapiranKupac("09001");
  const pdf = await fixture("jedna-stavka.pdf");

  const kaoFaktura = await posaljiDokument(uredjaj, "faktura", pdf);
  assert.equal(kaoFaktura.status, 422);
  assert.equal(kaoFaktura.body.code, "document_kind_unsupported");

  const kaoStorno = await posaljiDokument(uredjaj, "storno", pdf);
  assert.equal(kaoStorno.status, 422);
  assert.equal(kaoStorno.body.code, "document_kind_mismatch");

  const [{ n }] = await db.sql<{ n: number }[]>`SELECT count(*)::int AS n FROM source_documents`;
  assert.equal(n, 0, "odbijen zahtev ne sme ostaviti izvorni dokument");
});

test("izmenjen PDF posle otiska se odbija pre čitanja", async (t) => {
  if (guard(t)) return;
  const uredjaj = await aktivanUredjaj();
  const r = await posaljiDokument(uredjaj, "knjizno_odobrenje", await fixture("knjizno-odobrenje.pdf"), (o) => {
    o.pdf_sha256 = "0".repeat(64);
  });
  assert.equal(r.status, 422);
  assert.equal(r.body.code, "document_hash_mismatch");
});
