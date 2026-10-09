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
 * Prijem sa uređaja — nad STVARNIM route handler-ima i pravim PostgreSQL-om.
 *
 * Testira se `POST` iz `app/api/sync/*`, ne pomoćna funkcija za potpis: rupa u
 * rukovaocu (zaboravljen gate, preskočen rate limit, propušten nonce) ne bi se
 * videla ni u jednom testu koji zove servis direktno.
 *
 * Svi ključevi su SINTETIČKI i nastaju u ovom procesu. Privatni deo postoji
 * samo u testu; server ga nikada ne vidi i nema kolonu u koju bi stao.
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
let office: { id: string; name: string; role: string };

const ISSUER = "QA01";
const KORENSKI = new URL("../../", import.meta.url);
const BASE = "https://qa.invalid";

/** Sintetički par; privatni deo NIKAD ne napušta ovaj proces. */
function noviPar() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return {
    privateKey,
    publicKeySpki: publicKey.export({ type: "spki", format: "der" }).toString("base64"),
  };
}

before(async () => {
  if (reason) return;
  ensureTestCryptoEnv();
  /*
   * Feature gate se pali ISKLJUČIVO ovde, u izolovanom okruženju.
   *
   * Podrazumevano je isključen; poslednji test u fajlu to i dokazuje tako što
   * ga privremeno ugasi.
   */
  process.env.FEATURE_SYNC_DEVICE_INGEST = "1";
  db = await initTestDatabase();
  const a = await seedAccounts(db, [
    { key: "owner", role: "gazda" },
    { key: "office", role: "kancelarija" },
  ]);
  owner = { id: a.owner.id, name: a.owner.name, role: a.owner.role };
  office = { id: a.office.id, name: a.office.name, role: a.office.role };
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
  await db.sql`DELETE FROM source_document_lines`;
  await db.sql`DELETE FROM source_documents`;
  await db.sql`DELETE FROM invoice_lines`;
  await db.sql`DELETE FROM invoices`;
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

/* =========================================================================
 * Pomoćno: uređaj, potpis, poziv rukovaoca
 * ====================================================================== */

/** Registruje i aktivira uređaj kroz STVARNI servis, kao gazda. */
async function aktivanUredjaj(kod = `dev-${randomUUID().slice(0, 8)}`) {
  const { registerDevice, activateDevice } = await import("@/lib/sync/device/registry");
  const par = noviPar();
  const out = await registerDevice(
    {
      deviceCode: kod,
      label: "QA uređaj",
      sourceSystem: "biznisoft",
      issuerCode: ISSUER,
      keyId: "k1",
      publicKeySpki: par.publicKeySpki,
    },
    owner,
  );
  await activateDevice(
    { deviceId: out.deviceId, keyId: "k1", expectedFingerprint: out.fingerprint },
    owner,
  );
  return { ...out, ...par, deviceCode: kod };
}

async function mapiranKupac(partnerCode = "09002") {
  const [c] = await db.sql<{ id: string }[]>`
    INSERT INTO customers (pib, name)
    VALUES (${`QA${randomUUID().slice(0, 6)}`}, 'QA Kupac') RETURNING id`;
  await db.sql`
    INSERT INTO customer_external_identifiers
      (source_system, issuer_code, external_partner_code, customer_id, status)
    VALUES ('biznisoft', ${ISSUER}, ${partnerCode}, ${c.id}, 'mapped')`;
  return c.id;
}

/** Canonical payload iz sintetičkog PDF-a. */
async function canonicalPayload(ime = "vise-stavki.pdf") {
  const { parseBiznisoftPdf } = await import("@/lib/pdf/parseDocument");
  const { canonicalFromParsedDocument } = await import(
    "@/lib/sync/contract/fromParsedDocument.mjs"
  );
  const bytes = new Uint8Array(await readFile(new URL(`fixtures/dev/biznisoft/${ime}`, KORENSKI)));
  const parsed = await parseBiznisoftPdf(bytes);
  return { payload: canonicalFromParsedDocument(parsed, bytes, { issuerCode: ISSUER }), bytes };
}

type Uredjaj = Awaited<ReturnType<typeof aktivanUredjaj>>;

/** Sastavlja potpisan `Request` za dati rukovalac. */
async function potpisanZahtev(
  uredjaj: Uredjaj,
  opcije: {
    path?: string;
    body?: unknown;
    rawBody?: string;
    method?: string;
    nonce?: string;
    timestamp?: string;
    keyId?: string;
    deviceCode?: string;
    signWithPath?: string;
    signWithMethod?: string;
    contentType?: string | null;
    tamperBodyAfterSign?: string;
  } = {},
) {
  const { bodyHash, HEADERS, PROTOCOL_VERSION, signingString } = await import(
    "@/lib/sync/device/signing.mjs"
  );

  const path = opcije.path ?? "/api/sync/ingest";
  const method = opcije.method ?? "POST";
  const telo = opcije.rawBody ?? JSON.stringify(opcije.body ?? {});
  const bajtovi = new TextEncoder().encode(telo);
  const otisak = bodyHash(bajtovi);
  const nonce = opcije.nonce ?? randomBytes(16).toString("hex");
  const timestamp = opcije.timestamp ?? new Date().toISOString();
  const keyId = opcije.keyId ?? "k1";
  const deviceCode = opcije.deviceCode ?? uredjaj.deviceCode;

  const niz = signingString({
    version: PROTOCOL_VERSION,
    deviceId: deviceCode,
    keyId,
    method: opcije.signWithMethod ?? method,
    path: opcije.signWithPath ?? path,
    timestamp,
    nonce,
    bodyHash: otisak,
  });
  const potpis = cryptoSign(null, Buffer.from(niz, "utf8"), uredjaj.privateKey).toString("base64");

  const headers: Record<string, string> = {
    [HEADERS.version]: PROTOCOL_VERSION,
    [HEADERS.device]: deviceCode,
    [HEADERS.key]: keyId,
    [HEADERS.timestamp]: timestamp,
    [HEADERS.nonce]: nonce,
    [HEADERS.bodyHash]: otisak,
    [HEADERS.signature]: potpis,
  };
  const ct = opcije.contentType === null ? null : (opcije.contentType ?? "application/json");
  if (ct) headers["content-type"] = ct;

  // Telo se sme izmeniti POSLE potpisa — tako se dokazuje da otisak štiti sadržaj.
  const konacnoTelo = opcije.tamperBodyAfterSign ?? telo;

  return { request: new Request(`${BASE}${path}`, { method, headers, body: konacnoTelo }), nonce };
}

const ingest = async () => (await import("@/app/api/sync/ingest/route")).POST;
const heartbeat = async () => (await import("@/app/api/sync/heartbeat/route")).POST;

const telo = async (res: Response) => (await res.json()) as Record<string, unknown>;

const brojFaktura = async () => {
  const [{ n }] = await db.sql<{ n: number }[]>`SELECT count(*)::int AS n FROM invoices`;
  return n;
};

/* =========================================================================
 * Srećan put
 * ====================================================================== */

test("validan potpisan dokument daje JEDNU fakturu sa tačnim stavkama i poreklom", async (t) => {
  if (guard(t)) return;
  const uredjaj = await aktivanUredjaj();
  await mapiranKupac();
  const { payload } = await canonicalPayload();

  const { request } = await potpisanZahtev(uredjaj, { body: payload });
  const res = await (await ingest())(request);
  const body = await telo(res);

  assert.equal(res.status, 200, `neočekivan status: ${JSON.stringify(body)}`);
  assert.equal(body.code, "ingested");
  assert.equal(await brojFaktura(), 1);

  const [inv] = await db.sql<
    { origin: string; currency: string | null; currency_provenance: string | null; date_basis: string | null; trade_date: string | null }[]
  >`SELECT origin, currency, currency_provenance, date_basis, trade_date::text FROM invoices`;
  assert.equal(inv.origin, "device", "poreklo nije zabeleženo");
  assert.equal(inv.currency, "RSD");
  /*
   * `source_default`, ne `document`: čitač BizniSoft dokumenta valutu NE čita.
   * `document` bi tvrdilo da je pročitana sa papira.
   */
  assert.equal(inv.currency_provenance, "source_default");
  assert.equal(inv.date_basis, "issued_on");
  assert.equal(inv.trade_date, null);

  const [sd] = await db.sql<
    { origin: string; semantic_hash: string | null; delivered_by_device_id: string | null; canonicalization_version: number | null }[]
  >`SELECT origin, semantic_hash, delivered_by_device_id, canonicalization_version FROM source_documents`;
  assert.equal(sd.origin, "device");
  assert.equal(sd.delivered_by_device_id, uredjaj.deviceId, "uređaj nije zabeležen na dokumentu");
  assert.equal(sd.semantic_hash, payload.semantic_hash, "semantic hash nije sačuvan");
  assert.equal(sd.canonicalization_version, 1);

  const stavke = await db.sql<{ n: number }[]>`SELECT count(*)::int AS n FROM invoice_lines`;
  assert.equal(stavke[0].n, 7);
});

test("akter u tragu je UREĐAJ, ne čovek koji ga je registrovao", async (t) => {
  if (guard(t)) return;
  const uredjaj = await aktivanUredjaj();
  await mapiranKupac();
  const { payload } = await canonicalPayload();

  const { request } = await potpisanZahtev(uredjaj, { body: payload });
  await (await ingest())(request);

  /*
   * Trag je append-only, pa nosi i redove ranijih testova u ovom fajlu.
   * Upit se zato ogranicava na OVAJ uredjaj.
   */
  const redovi = await db.sql<
    { actor_kind: string; actor_device_id: string | null; actor_user_id: string | null }[]
  >`SELECT actor_kind, actor_device_id, actor_user_id FROM audit_log
     WHERE action IN ('Uvezen izvorni dokument', 'Izvorni dokument proknjizen')
       AND actor_device_id = ${uredjaj.deviceId}`;

  assert.ok(redovi.length >= 1, "nema traga o uvozu");
  for (const r of redovi) {
    assert.equal(r.actor_kind, "device");
    assert.equal(r.actor_device_id, uredjaj.deviceId);
    assert.equal(r.actor_user_id, null, "u tragu stoji korisnik umesto uređaja");
    assert.notEqual(r.actor_user_id, owner.id, "akter je čovek koji je registrovao uređaj");
  }
});

/* =========================================================================
 * Idempotentnost i duplo brojanje
 * ====================================================================== */

test("isti dokument ručnim i device putem, u OBA redosleda, bez duplog prometa", async (t) => {
  if (guard(t)) return;
  const { ingestBiznisoftPdf } = await import("@/lib/pdf/ingest");

  /* --- Redosled A: ručno pa uređaj. ----------------------------------- */
  const uredjajA = await aktivanUredjaj();
  await mapiranKupac();
  const { payload, bytes } = await canonicalPayload();

  const rucno = await ingestBiznisoftPdf(
    { bytes, fileName: "rucno.pdf", issuerCode: ISSUER },
    office,
  );
  assert.equal(rucno.result, "ingested");

  const { request: r1 } = await potpisanZahtev(uredjajA, { body: payload });
  const res1 = await (await ingest())(r1);
  assert.equal((await telo(res1)).code, "duplicate_file", "device put je zaobišao duplikat");
  assert.equal(await brojFaktura(), 1);

  /* --- Redosled B: uređaj pa ručno. ----------------------------------- */
  await ocisti();
  const uredjajB = await aktivanUredjaj();
  await mapiranKupac();

  const { request: r2 } = await potpisanZahtev(uredjajB, { body: payload });
  assert.equal((await telo(await (await ingest())(r2))).code, "ingested");

  const posle = await ingestBiznisoftPdf(
    { bytes, fileName: "rucno.pdf", issuerCode: ISSUER },
    office,
  );
  assert.equal(posle.result, "duplicate_file");
  assert.equal(await brojFaktura(), 1);
});

test("izgubljen odgovor: isti dokument sa NOVIM nonce-om je uredan retry", async (t) => {
  if (guard(t)) return;
  const uredjaj = await aktivanUredjaj();
  await mapiranKupac();
  const { payload } = await canonicalPayload();

  const { request: prvi } = await potpisanZahtev(uredjaj, { body: payload });
  assert.equal((await telo(await (await ingest())(prvi))).code, "ingested");

  /*
   * Klijent nije video odgovor i šalje ponovo — nov nonce, nov potpis.
   *
   * To NIJE replay: replay je ponovljen nonce. Ovo je normalan retry i mora
   * proći do kontrolisanog duplikata, bez drugog reda prometa.
   */
  const { request: drugi } = await potpisanZahtev(uredjaj, { body: payload });
  const res = await (await ingest())(drugi);
  assert.equal((await telo(res)).code, "duplicate_file");
  assert.equal(await brojFaktura(), 1);
});

test("isti nonce u Promise.all: najviše jedno izvršenje", async (t) => {
  if (guard(t)) return;
  const uredjaj = await aktivanUredjaj();
  await mapiranKupac();
  const { payload } = await canonicalPayload();

  const nonce = randomBytes(16).toString("hex");
  const timestamp = new Date().toISOString();
  const a = await potpisanZahtev(uredjaj, { body: payload, nonce, timestamp });
  const b = await potpisanZahtev(uredjaj, { body: payload, nonce, timestamp });

  const post = await ingest();
  const [r1, r2] = await Promise.all([post(a.request), post(b.request)]);
  const kodovi = [(await telo(r1)).code, (await telo(r2)).code].sort();

  assert.deepEqual(kodovi, ["ingested", "nonce_replayed"], `dobijeno: ${kodovi.join(", ")}`);
  assert.equal(await brojFaktura(), 1, "oba konkurentna zahteva su izvršila posao");
});

test("ponovljen nonce je replay i ne izvršava posao", async (t) => {
  if (guard(t)) return;
  const uredjaj = await aktivanUredjaj();
  await mapiranKupac();
  const { payload } = await canonicalPayload();

  const nonce = randomBytes(16).toString("hex");
  const { request: prvi } = await potpisanZahtev(uredjaj, { body: payload, nonce });
  assert.equal((await telo(await (await ingest())(prvi))).code, "ingested");

  const { request: drugi } = await potpisanZahtev(uredjaj, { body: payload, nonce });
  const res = await (await ingest())(drugi);
  assert.equal(res.status, 409);
  assert.equal((await telo(res)).code, "nonce_replayed");
  assert.equal(await brojFaktura(), 1);
});

test("replay preživljava restart aplikacionog procesa", async (t) => {
  if (guard(t)) return;
  const uredjaj = await aktivanUredjaj();
  await mapiranKupac();
  const { payload } = await canonicalPayload();
  const nonce = randomBytes(16).toString("hex");

  const { request: prvi } = await potpisanZahtev(uredjaj, { body: payload, nonce });
  await (await ingest())(prvi);

  /*
   * Nonce živi u BAZI, ne u memoriji procesa.
   *
   * `Set` u modulu bi nestao sa restartom i replay bi ponovo prošao. Ovde se
   * red čita direktno iz tabele — dokaz da preživljava svaki restart, i da ga
   * dele sve instance.
   */
  const [{ n }] = await db.sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM sync_request_nonces WHERE nonce = ${nonce}`;
  assert.equal(n, 1, "nonce nije u bazi — replay ne bi preživeo restart");

  const { request: drugi } = await potpisanZahtev(uredjaj, { body: payload, nonce });
  assert.equal((await telo(await (await ingest())(drugi))).code, "nonce_replayed");
});

/* =========================================================================
 * Uređaj, ključ, opoziv
 * ====================================================================== */

test("nepoznat, neaktivan i opozvan uređaj se odbijaju istom porukom", async (t) => {
  if (guard(t)) return;
  const { registerDevice, revokeDevice } = await import("@/lib/sync/device/registry");
  await mapiranKupac();
  const { payload } = await canonicalPayload();
  const post = await ingest();

  /* Nepoznat: potpis je ispravan, ali uređaja nema u bazi. */
  const nepoznat = { ...noviPar(), deviceId: "x", keyId: "k1", fingerprint: "x", deviceCode: "nepostojeci" };
  const { request: r1 } = await potpisanZahtev(nepoznat as Uredjaj, { body: payload });
  const res1 = await post(r1);
  assert.equal(res1.status, 401);
  assert.equal((await telo(res1)).code, "unknown_device");

  /* Registrovan ali NEAKTIVAN — registracija sama ne otvara kanal. */
  const par = noviPar();
  const kod = `dev-${randomUUID().slice(0, 8)}`;
  const reg = await registerDevice(
    {
      deviceCode: kod,
      label: "QA",
      sourceSystem: "biznisoft",
      issuerCode: ISSUER,
      keyId: "k1",
      publicKeySpki: par.publicKeySpki,
    },
    owner,
  );
  const neaktivan = { ...reg, ...par, deviceCode: kod };
  const { request: r2 } = await potpisanZahtev(neaktivan, { body: payload });
  const res2 = await post(r2);
  assert.equal((await telo(res2)).code, "device_not_active");

  /* Opozvan. */
  const opozvan = await aktivanUredjaj();
  await revokeDevice({ deviceId: opozvan.deviceId, reason: "QA opoziv" }, owner);
  const { request: r3 } = await potpisanZahtev(opozvan, { body: payload });
  assert.equal((await telo(await post(r3))).code, "device_not_active");

  assert.equal(await brojFaktura(), 0, "odbijen uređaj je nešto proknjižio");
});

test("opoziv zatvara pristup i pred konkurentnim ingestom", async (t) => {
  if (guard(t)) return;
  const { revokeDevice } = await import("@/lib/sync/device/registry");
  const uredjaj = await aktivanUredjaj();
  await mapiranKupac();
  const { payload } = await canonicalPayload();

  /*
   * Status se čita IZ BAZE pri svakom zahtevu, ne iz keša.
   *
   * Zato zahtev potpisan pre opoziva, a stigao posle, ne prolazi: nema
   * zastarelog stanja koje bi ga propustilo.
   */
  const { request } = await potpisanZahtev(uredjaj, { body: payload });
  await revokeDevice({ deviceId: uredjaj.deviceId, reason: "QA opoziv pre slanja" }, owner);

  const res = await (await ingest())(request);
  assert.equal((await telo(res)).code, "device_not_active");
  assert.equal(await brojFaktura(), 0);
});

test("tuđi ključ ne prolazi, i oporavljen ključ bez odobrenja ne važi", async (t) => {
  if (guard(t)) return;
  const uredjaj = await aktivanUredjaj();
  await mapiranKupac();
  const { payload } = await canonicalPayload();

  /* Potpis tuđim privatnim ključem uz tuđu oznaku uređaja. */
  const tudji = noviPar();
  const lazni = { ...uredjaj, privateKey: tudji.privateKey };
  const { request } = await potpisanZahtev(lazni, { body: payload });
  const res = await (await ingest())(request);
  assert.equal(res.status, 401);
  assert.equal((await telo(res)).code, "signature_invalid");

  /* Nepoznat `key_id` uz ispravan uređaj. */
  const { request: r2 } = await potpisanZahtev(uredjaj, { body: payload, keyId: "k-nepostojeci" });
  assert.equal((await telo(await (await ingest())(r2))).code, "unknown_device");

  assert.equal(await brojFaktura(), 0);
});

/* =========================================================================
 * Potpis, telo, vreme
 * ====================================================================== */

test("izmenjeno telo, lažan otisak i pogrešan potpis se odbijaju", async (t) => {
  if (guard(t)) return;
  const uredjaj = await aktivanUredjaj();
  await mapiranKupac();
  const { payload } = await canonicalPayload();
  const post = await ingest();

  /* Telo izmenjeno POSLE potpisa: otisak više ne odgovara. */
  const izmenjeno = JSON.parse(JSON.stringify(payload));
  izmenjeno.lines[0].quantity = "99.000";
  const { request: r1 } = await potpisanZahtev(uredjaj, {
    body: payload,
    tamperBodyAfterSign: JSON.stringify(izmenjeno),
  });
  assert.equal((await telo(await post(r1))).code, "body_hash_mismatch");

  /* Potpis nad drugom putanjom. */
  const { request: r2 } = await potpisanZahtev(uredjaj, {
    body: payload,
    signWithPath: "/api/sync/heartbeat",
  });
  assert.equal((await telo(await post(r2))).code, "signature_invalid");

  /* Potpis nad drugim metodom. */
  const { request: r3 } = await potpisanZahtev(uredjaj, {
    body: payload,
    signWithMethod: "DELETE",
  });
  assert.equal((await telo(await post(r3))).code, "signature_invalid");

  assert.equal(await brojFaktura(), 0);
});

test("istekao i prerano budući timestamp se odbijaju", async (t) => {
  if (guard(t)) return;
  const uredjaj = await aktivanUredjaj();
  await mapiranKupac();
  const { payload } = await canonicalPayload();
  const post = await ingest();

  const star = new Date(Date.now() - 6 * 60 * 1000).toISOString();
  const { request: r1 } = await potpisanZahtev(uredjaj, { body: payload, timestamp: star });
  assert.equal((await telo(await post(r1))).code, "timestamp_out_of_window");

  const budući = new Date(Date.now() + 6 * 60 * 1000).toISOString();
  const { request: r2 } = await potpisanZahtev(uredjaj, { body: payload, timestamp: budući });
  assert.equal(
    (await telo(await post(r2))).code,
    "timestamp_out_of_window",
    "budući timestamp je propušten",
  );

  assert.equal(await brojFaktura(), 0);
});

/* =========================================================================
 * Sadržaj: dobro potpisan, ali pogrešan
 * ====================================================================== */

test("savršen potpis ne spasava pogrešan sadržaj", async (t) => {
  if (guard(t)) return;
  const { semanticHash } = await import("@/lib/sync/contract/canonical.mjs");
  const uredjaj = await aktivanUredjaj();
  await mapiranKupac();
  const { payload } = await canonicalPayload();
  const post = await ingest();

  const slucajevi: [string, (d: Record<string, never>) => void, string][] = [
    [
      "pogrešni iznosi",
      (d) => {
        (d as never as { totals: { printed_gross_total: string } }).totals.printed_gross_total = "1.00";
        (d as never as { semantic_hash: string }).semantic_hash = semanticHash(d);
      },
      "totals_mismatch",
    ],
    [
      "lažan semantic hash",
      (d) => ((d as never as { semantic_hash: string }).semantic_hash = `sha256:${"a".repeat(64)}`),
      "semantic_hash_mismatch",
    ],
    [
      "nepodržana verzija ugovora",
      (d) => {
        (d as never as { schema_version: number }).schema_version = 99;
        (d as never as { semantic_hash: string }).semantic_hash = semanticHash(d);
      },
      "schema_version_unsupported",
    ],
    [
      "nepodržana valuta",
      (d) => {
        (d as never as { document: { currency: string } }).document.currency = "EUR";
        (d as never as { semantic_hash: string }).semantic_hash = semanticHash(d);
      },
      "currency_unsupported",
    ],
    [
      "datum prometa",
      (d) => {
        (d as never as { document: { trade_date: string } }).document.trade_date = "2026-01-02";
        (d as never as { semantic_hash: string }).semantic_hash = semanticHash(d);
      },
      "trade_date_unsupported",
    ],
    [
      "nemoguć datum",
      (d) => {
        (d as never as { document: { issued_on: string } }).document.issued_on = "2026-02-30";
        (d as never as { semantic_hash: string }).semantic_hash = semanticHash(d);
      },
      "issued_on_invalid",
    ],
    [
      "klijentska oznaka ispravnosti",
      (d) => ((d as never as { valid: boolean }).valid = true),
      "schema_invalid",
    ],
  ];

  for (const [naziv, izmeni, kod] of slucajevi) {
    const d = JSON.parse(JSON.stringify(payload));
    izmeni(d);
    const { request } = await potpisanZahtev(uredjaj, { body: d });
    const res = await post(request);
    assert.equal(res.status, 422, `„${naziv}“: neočekivan status ${res.status}`);
    assert.equal((await telo(res)).code, kod, `„${naziv}“`);
  }

  assert.equal(await brojFaktura(), 0, "nevalidan ulaz je ostavio fakturu");
  const [{ n }] = await db.sql<{ n: number }[]>`SELECT count(*)::int AS n FROM source_documents`;
  assert.equal(n, 0, "nevalidan ulaz je ostavio izvorni dokument");
});

test("lažan issuer se odbija — opseg dolazi iz registracije", async (t) => {
  if (guard(t)) return;
  const { semanticHash } = await import("@/lib/sync/contract/canonical.mjs");
  const uredjaj = await aktivanUredjaj();
  await mapiranKupac();
  const { payload } = await canonicalPayload();

  const lazan = JSON.parse(JSON.stringify(payload));
  lazan.issuer.code = "TUDJI";
  lazan.semantic_hash = semanticHash(lazan);

  const { request } = await potpisanZahtev(uredjaj, { body: lazan });
  const res = await (await ingest())(request);
  assert.equal(res.status, 422);
  assert.equal((await telo(res)).code, "issuer_mismatch");
  assert.equal(await brojFaktura(), 0);
});

test("tuđi runId iz zahteva ne postaje interni FK", async (t) => {
  if (guard(t)) return;
  const uredjaj = await aktivanUredjaj();
  await mapiranKupac();
  const { payload } = await canonicalPayload();

  /*
   * `run_id` nije ni polje ugovora — `additionalProperties: false` ga odbija.
   * Time je nemoguće da tuđi broj prolaza postane strani ključ ovog uvoza.
   */
  const sa = JSON.parse(JSON.stringify(payload));
  sa.run_id = 999999;
  const { request } = await potpisanZahtev(uredjaj, { body: sa });
  const res = await (await ingest())(request);
  assert.equal((await telo(res)).code, "schema_invalid");

  // I kroz ispravan zahtev: dokument ne dobija tuđi prolaz.
  const { request: cist } = await potpisanZahtev(uredjaj, { body: payload });
  await (await ingest())(cist);
  const [sd] = await db.sql<{ ingestion_run_id: number | null }[]>`
    SELECT ingestion_run_id FROM source_documents`;
  assert.equal(sd.ingestion_run_id, null);
});

test("tuđi source hash uz drugačiji sadržaj daje mismatch, ne tihi duplikat", async (t) => {
  if (guard(t)) return;
  const { semanticHash } = await import("@/lib/sync/contract/canonical.mjs");
  const uredjaj = await aktivanUredjaj();
  await mapiranKupac();

  const prvi = (await canonicalPayload("vise-stavki.pdf")).payload;
  const { request: r1 } = await potpisanZahtev(uredjaj, { body: prvi });
  assert.equal((await telo(await (await ingest())(r1))).code, "ingested");

  /*
   * Drugi dokument prijavljuje TUĐI `source_hash`.
   *
   * Server nema bajtove i ne može da proveri taj otisak — to je tvrdnja izvora.
   * Bez zaštite bi dobio čist `duplicate_file` i razlika bi zauvek ostala
   * neprimećena.
   */
  const drugi = (await canonicalPayload("jedna-stavka.pdf")).payload;
  const lazan = JSON.parse(JSON.stringify(drugi));
  lazan.source_hash = prvi.source_hash;
  lazan.semantic_hash = semanticHash(lazan);

  const { request: r2 } = await potpisanZahtev(uredjaj, { body: lazan });
  const res = await (await ingest())(r2);
  const body = await telo(res);

  assert.equal(res.status, 409);
  assert.equal(body.code, "source_hash_content_mismatch");
  assert.equal(body.comparable, true, "poređenje je bilo moguće i mora se tako i prijaviti");

  // Postojeća faktura je NETAKNUTA.
  assert.equal(await brojFaktura(), 1);
  const [{ n }] = await db.sql<{ n: number }[]>`SELECT count(*)::int AS n FROM invoice_lines`;
  assert.equal(n, 7, "postojeća faktura je izmenjena");
});

test("odgovor ne otkriva tuđi dokument ni njegov sadržaj", async (t) => {
  if (guard(t)) return;
  const { semanticHash } = await import("@/lib/sync/contract/canonical.mjs");
  const uredjaj = await aktivanUredjaj();
  await mapiranKupac();

  const prvi = (await canonicalPayload("vise-stavki.pdf")).payload;
  await (await ingest())((await potpisanZahtev(uredjaj, { body: prvi })).request);

  const drugi = JSON.parse(JSON.stringify((await canonicalPayload("jedna-stavka.pdf")).payload));
  drugi.source_hash = prvi.source_hash;
  drugi.semantic_hash = semanticHash(drugi);

  const res = await (await ingest())((await potpisanZahtev(uredjaj, { body: drugi })).request);
  const tekst = JSON.stringify(await telo(res));

  // Nijedan hash, broj računa, iznos ni ime fajla.
  assert.doesNotMatch(tekst, /sha256:/, "odgovor nosi hash");
  assert.doesNotMatch(tekst, /RN9000/, "odgovor nosi broj dokumenta");
  assert.doesNotMatch(tekst, /\.pdf/i, "odgovor nosi ime fajla");
  assert.doesNotMatch(tekst, /SELECT|INSERT|FROM /i, "odgovor nosi SQL");
  assert.doesNotMatch(tekst, /\bat \w+ \(/, "odgovor nosi stack trace");
});

/* =========================================================================
 * Telo, tip, granice
 * ====================================================================== */

test("preveliko telo, pogrešan tip i kompresija se odbijaju bez upisa", async (t) => {
  if (guard(t)) return;
  const uredjaj = await aktivanUredjaj();
  await mapiranKupac();
  const post = await ingest();

  /* Preveliko telo — bez `Content-Length`, kroz stream. */
  const ogromno = "x".repeat(600 * 1024);
  const { request: r1 } = await potpisanZahtev(uredjaj, { rawBody: ogromno });
  const res1 = await post(r1);
  assert.equal(res1.status, 413);
  assert.equal((await telo(res1)).code, "body_too_large");

  /* Pogrešan content type. */
  const { request: r2 } = await potpisanZahtev(uredjaj, {
    body: {},
    contentType: "text/plain",
  });
  const res2 = await post(r2);
  assert.equal(res2.status, 415);
  assert.equal((await telo(res2)).code, "content_type_unsupported");

  /* Bez content type-a uopšte. */
  const { request: r3 } = await potpisanZahtev(uredjaj, { body: {}, contentType: null });
  assert.equal((await telo(await post(r3))).code, "content_type_unsupported");

  /* Telo koje nije JSON, uz ispravan potpis. */
  const { request: r4 } = await potpisanZahtev(uredjaj, { rawBody: "nije json" });
  const res4 = await post(r4);
  assert.equal(res4.status, 400);
  assert.equal((await telo(res4)).code, "body_not_json");

  assert.equal(await brojFaktura(), 0);
});

test("nedozvoljen metod se odbija pre svega ostalog", async (t) => {
  if (guard(t)) return;
  const uredjaj = await aktivanUredjaj();
  /*
   * `Request` ne dozvoljava telo uz `GET`, pa se zahtev pravi direktno — bas
   * onako kako bi stigao sa mreze. Zaglavlja su i dalje potpisana, da se vidi
   * da metod pada PRE svake druge provere.
   */
  const { request: potpisan } = await potpisanZahtev(uredjaj, { body: {} });
  const getReq = new Request(potpisan.url, { method: "GET", headers: potpisan.headers });
  const res = await (await ingest())(getReq);
  assert.equal(res.status, 405);
  assert.equal((await telo(res)).code, "method_not_allowed");
});

/* =========================================================================
 * Rate limit
 * ====================================================================== */

test("rate limit za nepoznatog pozivaoca zaustavlja poplavu", async (t) => {
  if (guard(t)) return;
  const post = await ingest();

  /*
   * Nepoznata oznaka uređaja, uvek ista adresa. Potpis je besmislen — poenta je
   * da brojač radi PRE nego što se zna ko šalje.
   */
  const par = noviPar();
  const lazni = { ...par, deviceId: "x", keyId: "k1", fingerprint: "x", deviceCode: "flood-dev" };

  let ograniceno = false;
  for (let i = 0; i < 40; i += 1) {
    const { request } = await potpisanZahtev(lazni as Uredjaj, { body: {} });
    const res = await post(request);
    if (res.status === 429) {
      assert.equal((await telo(res)).code, "rate_limited");
      ograniceno = true;
      break;
    }
  }
  assert.ok(ograniceno, "rate limit za nepoznate pozivaoce se nije aktivirao");
  assert.equal(await brojFaktura(), 0);
});

test("autentifikovan uređaj NE troši brojač nepoznatih (serija od 45 zahteva)", async (t) => {
  if (guard(t)) return;
  /*
   * Regresija (generalna proba talasa 01): svaki zahtev se brojao i kao
   * „nepoznat" (20 u 5 min, blokada 15 min), pa je konektor posle 20
   * dokumenata stajao. Uređaj koji je dokazao identitet meri `sync_device`.
   */
  const uredjaj = await aktivanUredjaj();
  const post = await heartbeat();
  for (let i = 0; i < 45; i += 1) {
    const { request } = await potpisanZahtev(uredjaj, { path: "/api/sync/heartbeat", body: {} });
    const res = await post(request);
    assert.equal(res.status, 200, `zahtev ${i + 1} odbijen: ${res.status} ${(await telo(res)).code}`);
  }
  // Nepoznat pozivalac sa iste adrese i dalje biva zaustavljen posle neuspeha.
  const par = noviPar();
  const lazni = { ...par, deviceId: "x", keyId: "k1", fingerprint: "x", deviceCode: "flood-posle-serije" };
  const ing = await ingest();
  let ograniceno = false;
  for (let i = 0; i < 40 && !ograniceno; i += 1) {
    const { request } = await potpisanZahtev(lazni as Uredjaj, { body: {} });
    ograniceno = (await ing(request)).status === 429;
  }
  assert.ok(ograniceno, "neuspešni nepoznati zahtevi više ne aktiviraju ograničenje");
  // Blokada nepoznatih se proverava PRE tela i potpisa: i sledeći zahtev je 429.
  const { request } = await potpisanZahtev(lazni as Uredjaj, { body: {} });
  const blokiran = await ing(request);
  assert.equal(blokiran.status, 429);
  // Koliko da se čeka: zaglavlje i telo, ista vrednost (konektor poštuje Retry-After).
  const sekundi = Number(blokiran.headers.get("retry-after"));
  assert.ok(sekundi > 0 && sekundi <= 15 * 60, `Retry-After: ${blokiran.headers.get("retry-after")}`);
  assert.equal((await telo(blokiran)).retryAfterSeconds, sekundi);
});

test("autentifikovan uređaj i dalje ima sopstveno ograničenje (sync_device)", async (t) => {
  if (guard(t)) return;
  const { policyFor } = await import("@/lib/auth/rate-limit-policy.mjs");
  const limit = policyFor("sync_device", "account").limit;
  const uredjaj = await aktivanUredjaj();
  const post = await heartbeat();
  let prviOdbijen = 0;
  for (let i = 1; i <= limit + 5 && !prviOdbijen; i += 1) {
    const { request } = await potpisanZahtev(uredjaj, { path: "/api/sync/heartbeat", body: {} });
    const res = await post(request);
    if (res.status === 429) {
      assert.equal((await telo(res)).code, "rate_limited");
      prviOdbijen = i;
    }
  }
  assert.equal(prviOdbijen, limit + 1, `ograničenje uređaja: prvi odbijen ${prviOdbijen}, očekivano ${limit + 1}`);
});

test("ispravan uređaj NE troši limit nepoznatih pozivalaca — backfill nije ograničen na 20 zahteva", async (t) => {
  if (guard(t)) return;
  /*
   * Ranije je svaki zahtev, pa i uspešno potpisan, trošio `sync_unknown`
   * (20 u 5 minuta po oznaci uređaja). Konektor na 429 odlaže stavku do
   * sledećeg radnog dana, pa bi istorijski unos napredovao ~20 dokumenata
   * dnevno. `sync_device` (600 / 5 min) ostaje merodavan za poznat uređaj.
   */
  const uredjaj = await aktivanUredjaj();
  const post = await heartbeat();
  for (let i = 0; i < 30; i += 1) {
    const { request } = await potpisanZahtev(uredjaj, { path: "/api/sync/heartbeat", body: {} });
    const res = await post(request);
    assert.equal(res.status, 200, `zahtev ${i + 1} odbijen: ${(await telo(res)).code}`);
  }

  // Nijedan uspešan zahtev nije ostavio trag u brojaču nepoznatih pozivalaca.
  const [{ n }] = await db.sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM auth_rate_limits WHERE scope = 'sync_unknown'`;
  assert.equal(n, 0, "uspešni zahtevi su upisani u brojač nepoznatih pozivalaca");
});

test("neuspeli potpisi i dalje troše limit, pa i uz ispravnu oznaku uređaja", async (t) => {
  if (guard(t)) return;
  /*
   * Kontrola popravke iznad: napadač koji zna oznaku uređaja, ali nema ključ,
   * mora i dalje da bude zaustavljen posle istog broja neuspeha.
   */
  const uredjaj = await aktivanUredjaj();
  const post = await heartbeat();
  const tudj = { ...uredjaj, ...noviPar() };

  let ograniceno = false;
  for (let i = 0; i < 40; i += 1) {
    const { request } = await potpisanZahtev(tudj as Uredjaj, { path: "/api/sync/heartbeat", body: {} });
    const res = await post(request);
    if (res.status === 429) {
      ograniceno = true;
      break;
    }
    assert.equal(res.status, 401);
  }
  assert.ok(ograniceno, "pogrešni potpisi nad pravom oznakom uređaja nisu ograničeni");
});

/* =========================================================================
 * Heartbeat
 * ====================================================================== */

test("validan heartbeat osvežava kontakt, ali ne označava sync uspešnim", async (t) => {
  if (guard(t)) return;
  const uredjaj = await aktivanUredjaj();

  const pre = await db.sql<{ last_seen_at: Date | null }[]>`
    SELECT last_seen_at FROM sync_devices WHERE id = ${uredjaj.deviceId}`;
  assert.equal(pre[0].last_seen_at, null);

  const { request } = await potpisanZahtev(uredjaj, { path: "/api/sync/heartbeat", body: {} });
  const res = await (await heartbeat())(request);
  const body = await telo(res);

  assert.equal(res.status, 200);
  assert.equal(body.code, "acknowledged");
  /*
   * Izričito polje, da se `ok: true` ne pročita kao završena sinhronizacija.
   */
  assert.equal(body.meaning, "authenticated_contact_only");

  const posle = await db.sql<{ last_seen_at: Date | null }[]>`
    SELECT last_seen_at FROM sync_devices WHERE id = ${uredjaj.deviceId}`;
  assert.ok(posle[0].last_seen_at, "kontakt nije zabeležen");

  // Heartbeat ne pravi ni dokument ni promet.
  const [{ n }] = await db.sql<{ n: number }[]>`SELECT count(*)::int AS n FROM source_documents`;
  assert.equal(n, 0);
  assert.equal(await brojFaktura(), 0);
});

test("nepotpisan heartbeat NE osvežava kontakt", async (t) => {
  if (guard(t)) return;
  const uredjaj = await aktivanUredjaj();

  const bezPotpisa = new Request(`${BASE}/api/sync/heartbeat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  const res = await (await heartbeat())(bezPotpisa);
  assert.equal(res.status, 401);

  const [{ last_seen_at }] = await db.sql<{ last_seen_at: Date | null }[]>`
    SELECT last_seen_at FROM sync_devices WHERE id = ${uredjaj.deviceId}`;
  assert.equal(last_seen_at, null, "nepotpisan zahtev je osvežio status");
});

test("potpis za ingest ne prolazi na heartbeat", async (t) => {
  if (guard(t)) return;
  const uredjaj = await aktivanUredjaj();
  const { request } = await potpisanZahtev(uredjaj, {
    path: "/api/sync/heartbeat",
    body: {},
    signWithPath: "/api/sync/ingest",
  });
  assert.equal((await telo(await (await heartbeat())(request))).code, "signature_invalid");
});

/* =========================================================================
 * Autorizacija administrativnih radnji
 * ====================================================================== */

test("upravljanje uređajima traži `devices:manage` — samo gazda", async (t) => {
  if (guard(t)) return;
  const { can } = await import("@/lib/authz/permissions.mjs");

  const kaoKorisnik = (a: { id: string; role: string }, permissions: string[] = []) => ({
    role: a.role as "gazda" | "kancelarija" | "komercijalista" | "magacioner",
    permissions,
  });

  assert.equal(can(kaoKorisnik(owner), "devices:manage"), true, "gazda nema sposobnost");
  assert.equal(
    can(kaoKorisnik(office), "devices:manage"),
    false,
    "kancelarija je dobila upravljanje uređajima",
  );

  /*
   * `view:importi` i `documents:resolve` NE daju upravljanje uređajima.
   *
   * Pregled uvoza je svakodnevni posao; registracija uređaja otvara kanal
   * kojim promet ulazi bez ijednog čoveka u petlji.
   */
  const saPaketima = kaoKorisnik(office, ["analitika", "mapiranja"]);
  assert.equal(can(saPaketima, "view:importi"), true, "preduslov: paket daje view:importi");
  assert.equal(can(saPaketima, "documents:resolve"), true, "preduslov: paket daje documents:resolve");
  assert.equal(
    can(saPaketima, "devices:manage"),
    false,
    "paket je tiho dodelio upravljanje uređajima",
  );
});

test("opoziv čuva istoriju i ne briše trag", async (t) => {
  if (guard(t)) return;
  const { revokeDevice } = await import("@/lib/sync/device/registry");
  const uredjaj = await aktivanUredjaj();

  await revokeDevice({ deviceId: uredjaj.deviceId, reason: "QA: kompromitovan ključ" }, owner);

  const [d] = await db.sql<{ status: string; revoked_reason: string; activated_at: Date | null }[]>`
    SELECT status, revoked_reason, activated_at FROM sync_devices WHERE id = ${uredjaj.deviceId}`;
  assert.equal(d.status, "revoked");
  assert.equal(d.revoked_reason, "QA: kompromitovan ključ");
  // Aktivacija ostaje zapisana — istorija se ne briše.
  assert.ok(d.activated_at, "istorija aktivacije je obrisana");

  const [k] = await db.sql<{ status: string }[]>`
    SELECT status FROM sync_device_keys WHERE device_id = ${uredjaj.deviceId}`;
  assert.equal(k.status, "revoked", "ključ je ostao aktivan posle opoziva uređaja");

  const tragovi = await db.sql<{ action: string }[]>`
    SELECT action FROM audit_log WHERE entity_id = ${uredjaj.deviceId} ORDER BY id`;
  assert.deepEqual(
    tragovi.map((r) => r.action),
    ["Registrovan uređaj za prijem", "Aktiviran uređaj za prijem", "Opozvan uređaj za prijem"],
  );
});

test("aktivacija traži potvrđen otisak ključa", async (t) => {
  if (guard(t)) return;
  const { registerDevice, activateDevice, DeviceAdminError } = await import(
    "@/lib/sync/device/registry"
  );
  const par = noviPar();
  const kod = `dev-${randomUUID().slice(0, 8)}`;
  const reg = await registerDevice(
    {
      deviceCode: kod,
      label: "QA",
      sourceSystem: "biznisoft",
      issuerCode: ISSUER,
      keyId: "k1",
      publicKeySpki: par.publicKeySpki,
    },
    owner,
  );

  await assert.rejects(
    () =>
      activateDevice(
        { deviceId: reg.deviceId, keyId: "k1", expectedFingerprint: `sha256:${"0".repeat(64)}` },
        owner,
      ),
    DeviceAdminError,
    "aktivacija je prošla bez potvrđenog otiska",
  );

  const [d] = await db.sql<{ status: string }[]>`
    SELECT status FROM sync_devices WHERE id = ${reg.deviceId}`;
  assert.equal(d.status, "registered");
});

/* =========================================================================
 * Feature gate
 * ====================================================================== */

test("isključen gate čini endpoint neoperativnim", async (t) => {
  if (guard(t)) return;
  const uredjaj = await aktivanUredjaj();
  await mapiranKupac();
  const { payload } = await canonicalPayload();

  const prethodno = process.env.FEATURE_SYNC_DEVICE_INGEST;
  try {
    /*
     * Podrazumevano stanje je ISKLJUČENO. Ovde se to i proverava — i za
     * izričito „0“ i za potpuno odsustvo promenljive.
     */
    for (const vrednost of ["0", "false", "", undefined]) {
      if (vrednost === undefined) delete process.env.FEATURE_SYNC_DEVICE_INGEST;
      else process.env.FEATURE_SYNC_DEVICE_INGEST = vrednost;

      const { request } = await potpisanZahtev(uredjaj, { body: payload });
      const res = await (await ingest())(request);
      // 404, ne 403: isključen kanal ne treba da potvrdi da postoji.
      assert.equal(res.status, 404, `gate „${String(vrednost)}“ nije zatvorio rutu`);
      assert.equal((await telo(res)).code, "not_found");

      const { request: hb } = await potpisanZahtev(uredjaj, {
        path: "/api/sync/heartbeat",
        body: {},
      });
      assert.equal((await (await heartbeat())(hb)).status, 404);
    }
    assert.equal(await brojFaktura(), 0, "isključen gate je propustio uvoz");
  } finally {
    if (prethodno === undefined) delete process.env.FEATURE_SYNC_DEVICE_INGEST;
    else process.env.FEATURE_SYNC_DEVICE_INGEST = prethodno;
  }
});

/* =========================================================================
 * Privatni ključ nikad na serveru
 * ====================================================================== */

test("nijedna kolona ne čuva privatni ključ", async (t) => {
  if (guard(t)) return;
  const kolone = await db.sql<{ table_name: string; column_name: string }[]>`
    SELECT table_name, column_name FROM information_schema.columns
     WHERE table_schema = 'public'
       AND (table_name LIKE 'sync_%')`;

  for (const k of kolone) {
    assert.doesNotMatch(
      k.column_name,
      /private|secret|priv_key|privkey/i,
      `kolona ${k.table_name}.${k.column_name} liči na privatni ključ`,
    );
  }

  // I sam materijal: sve što se čuva mora biti SPKI (javni) oblik.
  const uredjaj = await aktivanUredjaj();
  const [k] = await db.sql<{ public_key_spki: string }[]>`
    SELECT public_key_spki FROM sync_device_keys WHERE device_id = ${uredjaj.deviceId}`;
  const der = Buffer.from(k.public_key_spki, "base64");
  // Ed25519 SPKI je tačno 44 bajta; privatni PKCS#8 je 48 i drugačijeg prefiksa.
  assert.equal(der.length, 44, "sačuvan materijal nije Ed25519 SPKI javni ključ");
});

/* =========================================================================
 * Potvrda rezervne kopije (0037) — isti potpisan kanal, bez lozinke baze.
 * ====================================================================== */

const backup = async () => (await import("@/app/api/sync/backup/route")).POST;

test("potvrda kopije: samo potpisano, samo za otisak koji je GitHub proverio, bez dupliranja", async (t) => {
  if (guard(t)) return;
  const uredjaj = await aktivanUredjaj();
  const post = await backup();
  const run = `8${Date.now()}`;
  const sha = randomBytes(32).toString("hex");
  const izvestaj = { vrsta: "offsite_stored", githubRunId: run, sifrovanSha256: sha, bajtova: 1234, kopijaOd: new Date().toISOString(), cuvaSe: 1 };

  // Nepotpisano: odbijeno pre baze.
  const bez = await post(new Request(`${BASE}/api/sync/backup`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(izvestaj) }));
  assert.equal(bez.status, 401);
  // Potpis za heartbeat ne važi ovde.
  const tudj = await potpisanZahtev(uredjaj, { path: "/api/sync/backup", signWithPath: "/api/sync/heartbeat", body: izvestaj });
  assert.equal((await telo(await post(tudj.request))).code, "signature_invalid");
  // Nepoznata kopija (GitHub je nije proverio): 409.
  const nepoznata = await post((await potpisanZahtev(uredjaj, { path: "/api/sync/backup", body: izvestaj })).request);
  assert.equal(nepoznata.status, 409);
  assert.equal((await telo(nepoznata)).code, "backup_unknown");
  // Dodatno polje (npr. putanja): 400.
  const visak = await post((await potpisanZahtev(uredjaj, { path: "/api/sync/backup", body: { ...izvestaj, putanja: "C:/x" } })).request);
  assert.equal(visak.status, 400);

  await db.sql`INSERT INTO backup_runs (kind, ok, source_label, encrypted_sha256, github_run_id) VALUES ('db_verified', true, 'qa-uredjaj', ${sha}, ${run})`;
  const prva = await post((await potpisanZahtev(uredjaj, { path: "/api/sync/backup", body: izvestaj })).request);
  assert.equal(prva.status, 200);
  assert.equal((await telo(prva)).code, "backup_recorded");
  const druga = await post((await potpisanZahtev(uredjaj, { path: "/api/sync/backup", body: izvestaj })).request);
  assert.equal((await telo(druga)).code, "backup_already_recorded");
  const [{ n, by }] = await db.sql<{ n: number; by: string }[]>`
    SELECT count(*)::int AS n, min(recorded_by) AS by FROM backup_runs WHERE kind = 'offsite_stored' AND github_run_id = ${run}`;
  assert.deepEqual({ n, by }, { n: 1, by: `uredjaj:${uredjaj.deviceCode}` });

  // Uređaj ne može da proglasi proveru baze.
  const lazna = await post((await potpisanZahtev(uredjaj, { path: "/api/sync/backup", body: { ...izvestaj, vrsta: "db_verified" } })).request);
  assert.equal(lazna.status, 400);
});
