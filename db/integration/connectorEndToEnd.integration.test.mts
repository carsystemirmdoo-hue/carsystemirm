import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { randomUUID } from "node:crypto";
import { cp, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AddressInfo } from "node:net";
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
 * Konektor → STVARNI HTTP → STVARNI P2 rukovaoci → QA Postgres.
 *
 * Ovo je jedini test koji dokazuje da serijalizacija i transport nisu mock:
 * telo putuje kroz pravu utičnicu, a na drugoj strani je `POST` iz
 * `app/api/sync/*`, ne pomoćna funkcija.
 *
 * Konektor se uvozi iz SPAKOVANOG paketa (`connector/dist`), pa se testira ono
 * što bi se isporučilo — uključujući prevedeni `parseDocument.js`.
 *
 * Svi dokumenti i ključevi su sintetički.
 */

/**
 * Konektoru treba `node:sqlite` — dakle Node 22+, u praksi Node 24.
 *
 * `npm run test:integration` se pokreće runtime-om web projekta (Node 20), gde
 * tog modula nema. Umesto lažno zelenog rezultata, ovaj fajl se tada IZRIČITO
 * preskače i kaže zašto; pun prolaz daje `npm run connector:e2e`, koji ga
 * pokreće pod Node 24.
 */
async function nedostajeSqlite(): Promise<string | null> {
  try {
    /*
     * Proverava se STVARNI `import`, ne `getBuiltinModule`.
     *
     * Node 20 zna za ime modula preko `getBuiltinModule`, ali ESM `import` puca
     * sa `ERR_UNKNOWN_BUILTIN_MODULE` — pa bi provera preko imena dala lažno
     * zeleno i test bi pao kasnije, sa nerazumljivom porukom.
     */
    await import("node:sqlite");
    return null;
  } catch {
    return `Konektor traži node:sqlite (Node 22+); tekući runtime je ${process.version}. ` +
      "Pun prolaz: `npm run connector:e2e`.";
  }
}

const reason = skipReason() ?? (await nedostajeSqlite());
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
let server: Server;
let origin: string;
/** Tela heartbeat zahteva i brojač slanja dokumenata — za proveru ciklusa (0.3.9). */
const heartbeatTela: string[] = [];
let heartbeatPokvaren = false;
let ingestZahteva = 0;

const ISSUER = "QA01";
const KOREN = new URL("../../", import.meta.url);
const DIST = new URL("../../connector/dist/", import.meta.url);

const D = (p: string) => new URL(`connector/src/${p}`, DIST).href;

/* ========================================================================= */

/** Podiže pravi HTTP server nad stvarnim route handler-ima. */
async function podigniServer(): Promise<{ server: Server; origin: string }> {
  const { POST: ingest } = await import("@/app/api/sync/ingest/route");
  const { POST: heartbeat } = await import("@/app/api/sync/heartbeat/route");
  const { POST: pollKomandu } = await import("@/app/api/sync/commands/poll/route");
  const { POST: azurirajKomandu } = await import("@/app/api/sync/commands/update/route");

  const s = createServer(async (req, res) => {
    const delovi: Buffer[] = [];
    for await (const deo of req) delovi.push(deo as Buffer);
    const telo = Buffer.concat(delovi);

    /*
     * `IncomingMessage` → `Request`, bez ijedne izmene tela.
     *
     * Bajtovi moraju stići do rukovaoca tačno onakvi kakvi su poslati; svaka
     * ponovna serijalizacija ovde bi obesmislila proveru otiska.
     */
    const zahtev = new Request(`http://127.0.0.1${req.url}`, {
      method: req.method,
      headers: Object.entries(req.headers).flatMap(([k, v]) =>
        typeof v === "string" ? [[k, v] as [string, string]] : [],
      ),
      body: req.method === "POST" ? telo : undefined,
    });

    const putanja = new URL(zahtev.url).pathname;
    /* Heartbeat: telo se beleži za proveru, a server se po potrebi „kvari". */
    if (putanja === "/api/sync/heartbeat") {
      heartbeatTela.push(telo.toString("utf8"));
      if (heartbeatPokvaren) {
        res.statusCode = 503;
        res.setHeader("content-type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ ok: false, code: "temporarily_unavailable" }));
        return;
      }
    }
    if (putanja === "/api/sync/ingest") ingestZahteva += 1;
    const rute: Record<string, (r: Request) => Promise<Response>> = {
      "/api/sync/ingest": ingest,
      "/api/sync/heartbeat": heartbeat,
      "/api/sync/commands/poll": pollKomandu,
      "/api/sync/commands/update": azurirajKomandu,
    };
    const rukovalac = rute[putanja] ?? heartbeat;
    const odgovor = await rukovalac(zahtev);

    res.statusCode = odgovor.status;
    odgovor.headers.forEach((v, k) => res.setHeader(k, v));
    res.end(Buffer.from(await odgovor.arrayBuffer()));
  });

  await new Promise<void>((r) => s.listen(0, "127.0.0.1", r));
  const port = (s.address() as AddressInfo).port;
  return { server: s, origin: `http://127.0.0.1:${port}` };
}

before(async () => {
  if (reason) return;
  ensureTestCryptoEnv();
  process.env.FEATURE_SYNC_DEVICE_INGEST = "1";
  process.env.FEATURE_SYNC_OPERATIONS = "1";
  db = await initTestDatabase();
  const a = await seedAccounts(db, [
    { key: "owner", role: "gazda" },
    { key: "office", role: "kancelarija" },
  ]);
  owner = { id: a.owner.id, name: a.owner.name, role: a.owner.role };
  office = { id: a.office.id, name: a.office.name, role: a.office.role };
  ({ server, origin } = await podigniServer());
});

after(async () => {
  if (server) await new Promise<void>((r) => server.close(() => r()));
  if (!reason && db) {
    await ocisti();
    await db.sql`DELETE FROM sync_request_nonces`;
    await db.sql`DELETE FROM sync_device_keys`;
    await db.sql`DELETE FROM sync_devices`;
    await cleanupQa(db);
  }
  delete process.env.FEATURE_SYNC_DEVICE_INGEST;
  delete process.env.FEATURE_SYNC_OPERATIONS;
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
  /*
   * `TRUNCATE`, jer je `sync_command_events` append-only: okidač odbija `DELETE`
   * po redu, a `TRUNCATE` ne pokreće okidače, pa se zaštita ne gasi.
   */
  await db.sql.unsafe(
    `TRUNCATE TABLE "sync_command_events", "sync_commands", "sync_device_cycles", "audit_log"
     RESTART IDENTITY CASCADE`,
  );
}

beforeEach(async () => {
  if (!reason) await ocisti();
});

/* ========================================================================= */

/** Registruje i aktivira uređaj kroz STVARNI servis, kao gazda. */
async function aktivanUredjaj() {
  const { registerDevice, activateDevice } = await import("@/lib/sync/device/registry");
  const { generateKeyPairSync } = await import("node:crypto");
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const kod = `dev-${randomUUID().slice(0, 8)}`;

  const out = await registerDevice(
    {
      deviceCode: kod,
      label: "QA konektor",
      sourceSystem: "biznisoft",
      issuerCode: ISSUER,
      keyId: "k1",
      publicKeySpki: publicKey.export({ type: "spki", format: "der" }).toString("base64"),
    },
    owner,
  );
  await activateDevice(
    { deviceId: out.deviceId, keyId: "k1", expectedFingerprint: out.fingerprint },
    owner,
  );
  return {
    ...out,
    deviceCode: kod,
    privateKeyPkcs8Der: new Uint8Array(privateKey.export({ type: "pkcs8", format: "der" })),
  };
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

/** Privremeno okruženje konektora: izvorni folder i lokalni red. */
async function okruzenje(fajlovi: string[] = ["vise-stavki.pdf"]) {
  const baza = await mkdtemp(join(tmpdir(), "cs-e2e-"));
  const izvor = join(baza, "Moj Folder ČĆŽŠĐ", "fakture");
  await mkdir(izvor, { recursive: true });
  for (const f of fajlovi) {
    await cp(new URL(`fixtures/dev/biznisoft/${f}`, KOREN).pathname, join(izvor, `Faktura ${f}`));
  }
  return { baza, izvor, redPutanja: join(baza, "stanje", "queue.db") };
}

const konfiguracija = (izvor: string, deviceCode: string) => ({
  serverOrigin: origin,
  deviceCode,
  keyId: "k1",
  sourceSystem: "biznisoft",
  issuerCode: ISSUER,
  izvorniFolder: izvor,
  dodatnaZatvaranja: [],
  maxPoCiklusu: 50,
  timeoutMs: 15_000,
});

const identitet = (deviceCode: string) => ({
  origin,
  deviceCode,
  sourceSystem: "biznisoft",
  issuerCode: ISSUER,
  contractVersion: 1,
});

const brojFaktura = async () => {
  const [{ n }] = await db.sql<{ n: number }[]>`SELECT count(*)::int AS n FROM invoices`;
  return n;
};

/**
 * Koren `FAKTURE/` sa godišnjim podfolderima — kancelarijska struktura.
 *
 * Isti dokument namerno stoji u DVA godišnja foldera: to se u arhivi dešava
 * kada neko prekopira fakturu „da bude i ovde".
 */
async function godisnjiFolderi(raspored: Record<string, string[]>) {
  const baza = await mkdtemp(join(tmpdir(), "cs-godine-"));
  const koren = join(baza, "FAKTURE");
  for (const [folder, fajlovi] of Object.entries(raspored)) {
    const put = join(koren, folder);
    await mkdir(put, { recursive: true });
    for (const f of fajlovi) {
      await cp(new URL(`fixtures/dev/biznisoft/${f}`, KOREN).pathname, join(put, `Faktura ${f}`));
    }
  }
  return { baza, izvor: koren, redPutanja: join(baza, "stanje", "queue.db") };
}

/* =========================================================================
 * Pun tok
 * ====================================================================== */

test("isti PDF u DVA godišnja foldera ne duplira ni fakturu ni ledger", async (t) => {
  if (guard(t)) return;
  const { otvoriStore } = await import(D("store.mjs"));
  const { skenirajURed, posaljiIzReda } = await import(D("pipeline.mjs"));

  const uredjaj = await aktivanUredjaj();
  await mapiranKupac();
  /*
   * ISTI dokument u dva godišnja foldera — tačno ono što se u arhivi dešava
   * kada neko prekopira fakturu „da bude i ovde". Treći fajl bi uveo drugog
   * partnera i drugi tok mapiranja; ovde se meri samo dvostruko brojanje.
   */
  const okr = await godisnjiFolderi({
    "FAKTURE 2024": ["vise-stavki.pdf"],
    "FAKTURE 2025": ["vise-stavki.pdf"],
  });
  const store = otvoriStore({ putanja: okr.redPutanja, identitet: identitet(uredjaj.deviceCode) });

  try {
    const k = konfiguracija(okr.izvor, uredjaj.deviceCode);

    const skeniranje = await skenirajURed({ store, konfiguracija: k });
    /*
     * Popis vidi sva tri fajla — koren ima tri neposredna podfoldera, i nijedno
     * ime nije upisano u kod. Dva su isti sadržaj, pa u red ulaze DVA dokumenta.
     */
    assert.equal(skeniranje.pregledano, 2, "godišnji podfolderi nisu popisani");
    assert.equal(skeniranje.novo, 1, "isti sadržaj je ušao u red dvaput");
    assert.equal(skeniranje.poznato, 1, "drugi primerak nije prepoznat kao poznat");

    const slanje = await posaljiIzReda({
      store,
      konfiguracija: k,
      kljuc: uredjaj.privateKeyPkcs8Der,
      lokalniDatum: "2026-03-10",
      dozvoliHttp: true,
    });
    assert.equal(slanje.potvrdjeno, 1, `neočekivano: ${JSON.stringify(slanje)}`);

    // Jedna faktura, ne dve: kopija u drugom folderu nije napravila drugu.
    assert.equal(await brojFaktura(), 1, "kopija je napravila dodatnu fakturu");

    const [{ n: dokumenata }] = await db.sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM source_documents`;
    assert.equal(dokumenata, 1, "kopija je napravila dodatan izvorni dokument");

    /*
     * Ledger je merodavan: promet se broji tačno jednom.
     *
     * `vise-stavki.pdf` nosi 7 stavki. Da je kopija prošla kao zaseban
     * dokument, ovde bi stajalo 14 — i to bi izgledalo kao dvostruki promet,
     * ne kao greška skenera.
     */
    const [{ n: redova }] = await db.sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM effective_sales_ledger WHERE enters_net`;
    assert.equal(redova, 7, "promet je udvostručen kroz drugi godišnji folder");
  } finally {
    store.zatvori();
    await rm(okr.baza, { recursive: true, force: true });
  }
});

test("PDF bez oznake `faktura`/`fak` u imenu ne stiže do reda, payload-a ni servera", async (t) => {
  if (guard(t)) return;
  const { otvoriStore } = await import(D("store.mjs"));
  const { skenirajURed, posaljiIzReda } = await import(D("pipeline.mjs"));

  const uredjaj = await aktivanUredjaj();
  await mapiranKupac();
  // Kancelarijski oblik: `Fakture\2026\`. Jedan PDF nosi oznaku fakture.
  const okr = await godisnjiFolderi({ "2026": ["vise-stavki.pdf"] });
  const store = otvoriStore({ putanja: okr.redPutanja, identitet: identitet(uredjaj.deviceCode) });

  try {
    /*
     * Dva PDF-a sa ISPRAVNIM, parsabilnim sadržajem, ali bez oznake u imenu.
     * Da filter ne postoji, oba bi ušla u red i otišla serveru.
     */
    for (const [izvor, ime] of [
      ["jedna-stavka.pdf", "racun 123.pdf"],
      ["vodeca-nula-partner.pdf", "profaktura 7.pdf"],
    ]) {
      await cp(new URL(`fixtures/dev/biznisoft/${izvor}`, KOREN).pathname, join(okr.izvor, "2026", ime));
    }

    const k = konfiguracija(okr.izvor, uredjaj.deviceCode);
    const skeniranje = await skenirajURed({ store, konfiguracija: k });
    assert.equal(skeniranje.ukupnoPdf, 3);
    assert.equal(skeniranje.nijeFakturaPoNazivu, 2);
    assert.equal(skeniranje.kandidata, 1);
    assert.equal(skeniranje.novo, 1);
    assert.deepEqual(
      Object.values(store.zbir()).reduce((a: number, b) => a + Number(b), 0),
      1,
      "PDF bez oznake je ušao u lokalni red",
    );

    const slanje = await posaljiIzReda({
      store,
      konfiguracija: k,
      kljuc: uredjaj.privateKeyPkcs8Der,
      lokalniDatum: "2026-03-10",
      dozvoliHttp: true,
    });
    assert.equal(slanje.potvrdjeno, 1, `neočekivano: ${JSON.stringify(slanje)}`);

    const [{ n: dokumenata }] = await db.sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM source_documents`;
    assert.equal(dokumenata, 1, "server je primio dokument bez oznake fakture");
    assert.equal(await brojFaktura(), 1);
  } finally {
    store.zatvori();
    await rm(okr.baza, { recursive: true, force: true });
  }
});

test("dva nivoa dublje i junction/symlink ne ulaze u ledger", async (t) => {
  if (guard(t)) return;
  const { otvoriStore } = await import(D("store.mjs"));
  const { skenirajURed, posaljiIzReda } = await import(D("pipeline.mjs"));
  const { symlink } = await import("node:fs/promises");

  const uredjaj = await aktivanUredjaj();
  await mapiranKupac();
  const okr = await godisnjiFolderi({ "FAKTURE 2026": ["vise-stavki.pdf"] });
  const store = otvoriStore({ putanja: okr.redPutanja, identitet: identitet(uredjaj.deviceCode) });

  try {
    // Dva nivoa dublje — ne sme se skenirati.
    const duboko = join(okr.izvor, "FAKTURE 2026", "arhiva");
    await mkdir(duboko, { recursive: true });
    await cp(
      new URL("fixtures/dev/biznisoft/jedna-stavka.pdf", KOREN).pathname,
      join(duboko, "FAK duboka.pdf"),
    );

    // Podfolder-link ka putanji van korena — ne sme se pratiti.
    const spolja = join(okr.baza, "TUDJE");
    await mkdir(spolja, { recursive: true });
    await cp(
      new URL("fixtures/dev/biznisoft/dve-strane-ponovljeno-zaglavlje.pdf", KOREN).pathname,
      join(spolja, "FAK tudja.pdf"),
    );
    await symlink(spolja, join(okr.izvor, "PRECICA")).catch(() => {});

    const k = konfiguracija(okr.izvor, uredjaj.deviceCode);
    const skeniranje = await skenirajURed({ store, konfiguracija: k });
    assert.equal(skeniranje.pregledano, 1, "skener je sišao dublje ili pratio link");

    await posaljiIzReda({
      store,
      konfiguracija: k,
      kljuc: uredjaj.privateKeyPkcs8Der,
      lokalniDatum: "2026-03-10",
      dozvoliHttp: true,
    });

    assert.equal(await brojFaktura(), 1, "dokument van dozvoljenog stabla je knjižen");
    const [{ n }] = await db.sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM effective_sales_ledger WHERE enters_net`;
    assert.equal(n, 7, "u ledger je ušao dokument koji nije smeo da bude skeniran");
  } finally {
    store.zatvori();
    await rm(okr.baza, { recursive: true, force: true });
  }
});

test("PDF → lokalni red → STVARNI HTTP → jedna faktura sa device poreklom", async (t) => {
  if (guard(t)) return;
  const { otvoriStore } = await import(D("store.mjs"));
  const { skenirajURed, posaljiIzReda } = await import(D("pipeline.mjs"));

  const uredjaj = await aktivanUredjaj();
  await mapiranKupac();
  const okr = await okruzenje();
  const store = otvoriStore({ putanja: okr.redPutanja, identitet: identitet(uredjaj.deviceCode) });

  try {
    const k = konfiguracija(okr.izvor, uredjaj.deviceCode);

    const skeniranje = await skenirajURed({ store, konfiguracija: k });
    assert.equal(skeniranje.novo, 1, "dokument nije ušao u red");

    const slanje = await posaljiIzReda({
      store,
      konfiguracija: k,
      kljuc: uredjaj.privateKeyPkcs8Der,
      lokalniDatum: "2026-03-10",
      dozvoliHttp: true,
    });

    assert.equal(slanje.potvrdjeno, 1, `neočekivano: ${JSON.stringify(slanje)}`);
    assert.equal(await brojFaktura(), 1);

    const [inv] = await db.sql<{ origin: string; currency: string; currency_provenance: string }[]>`
      SELECT origin, currency, currency_provenance FROM invoices`;
    assert.equal(inv.origin, "device", "poreklo nije zabeleženo");
    assert.equal(inv.currency, "RSD");
    assert.equal(inv.currency_provenance, "source_default");

    const [{ n }] = await db.sql<{ n: number }[]>`SELECT count(*)::int AS n FROM invoice_lines`;
    assert.equal(n, 7, "stavke se ne poklapaju");

    // Uređaj je akter u tragu, ne čovek koji ga je registrovao.
    const [trag] = await db.sql<{ actor_kind: string; actor_device_id: string }[]>`
      SELECT actor_kind, actor_device_id FROM audit_log
       WHERE action = 'Izvorni dokument proknjizen' LIMIT 1`;
    assert.equal(trag.actor_kind, "device");
    assert.equal(trag.actor_device_id, uredjaj.deviceId);
  } finally {
    store.zatvori();
    await rm(okr.baza, { recursive: true, force: true });
  }
});

test("izgubljen odgovor: NOV proces, ISTI red, nov nonce → jedna faktura", async (t) => {
  if (guard(t)) return;
  const { otvoriStore } = await import(D("store.mjs"));
  const { skenirajURed, posaljiIzReda } = await import(D("pipeline.mjs"));
  const { ledgerTotals } = await import("@/lib/ledger/effective-sales");

  const uredjaj = await aktivanUredjaj();
  await mapiranKupac();
  const okr = await okruzenje();
  const k = konfiguracija(okr.izvor, uredjaj.deviceCode);

  try {
    /* --- Prolaz 1: server KNJIŽI, ali odgovor se „izgubi“. -------------- */
    const prvi = otvoriStore({
      putanja: okr.redPutanja,
      identitet: identitet(uredjaj.deviceCode),
    });
    await skenirajURed({ store: prvi, konfiguracija: k });

    /*
     * `fetchImpl` propušta zahtev do pravog servera, pa ga server ZAISTA
     * knjiži — a zatim odbacuje odgovor i javlja prekid veze. Tačno ono što se
     * dešava kada mreža pukne posle upisa.
     */
    const izgubi: typeof fetch = async (...args) => {
      await fetch(...(args as Parameters<typeof fetch>));
      throw Object.assign(new Error("veza prekinuta"), { name: "FetchError" });
    };

    const pokusaj = await posaljiIzReda({
      store: prvi,
      konfiguracija: k,
      kljuc: uredjaj.privateKeyPkcs8Der,
      lokalniDatum: "2026-03-10",
      dozvoliHttp: true,
      fetchImpl: izgubi,
      cekaj: async () => {},
    });
    /*
     * Prekid veze je privremen: postepeno ponavljanje u ciklusu, pa zaustavljanje
     * bez odlaganja za sutra — stavka ostaje `spremno` u istom redu.
     */
    assert.equal(pokusaj.zaustavljeno, "server_nedostupan", JSON.stringify(pokusaj));
    assert.equal(pokusaj.odlozeno, 0);
    assert.deepEqual(prvi.zbir(), { spremno: 1 });
    assert.equal(await brojFaktura(), 1, "preduslov: server je knjižio");

    // Konektor NE zna da je knjiženo — stavka je i dalje u redu.
    assert.equal(prvi.zbir().potvrdjeno ?? 0, 0);
    prvi.zatvori(); // „pad“ procesa

    /* --- Prolaz 2: NOV proces otvara ISTI trajni red. ------------------- */
    const drugi = otvoriStore({
      putanja: okr.redPutanja,
      identitet: identitet(uredjaj.deviceCode),
    });
    try {
      const ponovo = await posaljiIzReda({
        store: drugi,
        konfiguracija: k,
        kljuc: uredjaj.privateKeyPkcs8Der,
        // Isti dan, posle isteka zabeležene pauze.
        lokalniDatum: "2026-03-10",
        sada: () => Date.now() + 10 * 60_000,
        dozvoliHttp: true,
      });

      /*
       * Isti dokument, NOV nonce i nov timestamp → server prepoznaje otisak i
       * vraća `duplicate_file`. To je potvrda, ne greška.
       */
      assert.equal(ponovo.potvrdjeno, 1, `neočekivano: ${JSON.stringify(ponovo)}`);
      assert.equal(await brojFaktura(), 1, "nastala je druga faktura");

      const promet = await ledgerTotals({ customerIds: null });
      assert.equal(promet.gross_sales.lines, 7, "promet je udvostručen");
    } finally {
      drugi.zatvori();
    }
  } finally {
    await rm(okr.baza, { recursive: true, force: true });
  }
});

test("pad usred slanja: nov proces oporavlja `salje_se` i završi posao", async (t) => {
  if (guard(t)) return;
  const { otvoriStore } = await import(D("store.mjs"));
  const { skenirajURed, posaljiIzReda } = await import(D("pipeline.mjs"));

  const uredjaj = await aktivanUredjaj();
  await mapiranKupac();
  const okr = await okruzenje();
  const k = konfiguracija(okr.izvor, uredjaj.deviceCode);

  try {
    const prvi = otvoriStore({ putanja: okr.redPutanja, identitet: identitet(uredjaj.deviceCode) });
    await skenirajURed({ store: prvi, konfiguracija: k });

    // Preuzeta za slanje, pa proces „pada“ pre ijednog odgovora.
    const [stavka] = prvi.zaSlanje({ lokalniDatum: "2026-03-10" });
    assert.equal(prvi.oznaciSalje(stavka.id), true);
    prvi.zatvori();

    const drugi = otvoriStore({ putanja: okr.redPutanja, identitet: identitet(uredjaj.deviceCode) });
    try {
      const rez = await posaljiIzReda({
        store: drugi,
        konfiguracija: k,
        kljuc: uredjaj.privateKeyPkcs8Der,
        lokalniDatum: "2026-03-10",
        dozvoliHttp: true,
      });
      assert.equal(rez.oporavljeno, 1, "zaglavljena stavka nije oporavljena");
      assert.equal(rez.potvrdjeno, 1);
      assert.equal(await brojFaktura(), 1);
    } finally {
      drugi.zatvori();
    }
  } finally {
    await rm(okr.baza, { recursive: true, force: true });
  }
});

/* =========================================================================
 * Odbijanja preko stvarnog transporta
 * ====================================================================== */

test("opozvan uređaj: ciklus staje, ništa se ne knjiži", async (t) => {
  if (guard(t)) return;
  const { revokeDevice } = await import("@/lib/sync/device/registry");
  const { otvoriStore } = await import(D("store.mjs"));
  const { skenirajURed, posaljiIzReda } = await import(D("pipeline.mjs"));

  const uredjaj = await aktivanUredjaj();
  await mapiranKupac();
  const okr = await okruzenje();
  const k = konfiguracija(okr.izvor, uredjaj.deviceCode);
  const store = otvoriStore({ putanja: okr.redPutanja, identitet: identitet(uredjaj.deviceCode) });

  try {
    await skenirajURed({ store, konfiguracija: k });
    await revokeDevice({ deviceId: uredjaj.deviceId, reason: "QA opoziv" }, owner);

    const rez = await posaljiIzReda({
      store,
      konfiguracija: k,
      kljuc: uredjaj.privateKeyPkcs8Der,
      lokalniDatum: "2026-03-10",
      dozvoliHttp: true,
    });

    assert.equal(rez.zaustavljeno, "device_not_active", "ciklus nije zaustavljen");
    assert.equal(rez.potvrdjeno, 0);
    assert.equal(await brojFaktura(), 0);
    // Dokument nije kriv za opoziv: ostaje u redu, ne u trajnom `blokirano`.
    assert.equal(store.zbir().blokirano, undefined);
    assert.equal(store.zbir().spremno, 1);
  } finally {
    store.zatvori();
    await rm(okr.baza, { recursive: true, force: true });
  }
});

test("isključen feature gate: endpoint nije operativan, red ostaje", async (t) => {
  if (guard(t)) return;
  const { otvoriStore } = await import(D("store.mjs"));
  const { skenirajURed, posaljiIzReda } = await import(D("pipeline.mjs"));

  const uredjaj = await aktivanUredjaj();
  await mapiranKupac();
  const okr = await okruzenje();
  const k = konfiguracija(okr.izvor, uredjaj.deviceCode);
  const store = otvoriStore({ putanja: okr.redPutanja, identitet: identitet(uredjaj.deviceCode) });

  const prethodno = process.env.FEATURE_SYNC_DEVICE_INGEST;
  try {
    await skenirajURed({ store, konfiguracija: k });
    delete process.env.FEATURE_SYNC_DEVICE_INGEST;

    const rez = await posaljiIzReda({
      store,
      konfiguracija: k,
      kljuc: uredjaj.privateKeyPkcs8Der,
      lokalniDatum: "2026-03-10",
      dozvoliHttp: true,
    });

    // 404 `not_found` → blokada, bez menjanja serverske konfiguracije.
    assert.equal(rez.zaustavljeno, "not_found");
    assert.equal(await brojFaktura(), 0);
    assert.equal(store.zbir().spremno, 1, "stavka je izašla iz reda zbog gašenja gate-a");

    /*
     * Gate se ponovo uključi — ISTI red, bez novog popisa. Dokument koji je
     * naišao na isključen gate mora sada da stigne; ranije je ostajao trajno
     * `blokirano` i nijedan ciklus ga više nije slao.
     */
    process.env.FEATURE_SYNC_DEVICE_INGEST = "1";
    const posle = await posaljiIzReda({
      store,
      konfiguracija: k,
      kljuc: uredjaj.privateKeyPkcs8Der,
      lokalniDatum: "2026-03-10",
      dozvoliHttp: true,
    });
    assert.equal(posle.zaustavljeno, null);
    assert.equal(posle.potvrdjeno, 1, `dokument nije poslat posle ponovnog uključenja: ${JSON.stringify(posle)}`);
    assert.equal(await brojFaktura(), 1);
  } finally {
    process.env.FEATURE_SYNC_DEVICE_INGEST = prethodno;
    store.zatvori();
    await rm(okr.baza, { recursive: true, force: true });
  }
});

test("HTML 200 nije potvrda — stavka ostaje u redu", async (t) => {
  if (guard(t)) return;
  const { otvoriStore } = await import(D("store.mjs"));
  const { skenirajURed, posaljiIzReda } = await import(D("pipeline.mjs"));

  const uredjaj = await aktivanUredjaj();
  await mapiranKupac();
  const okr = await okruzenje();
  const k = konfiguracija(okr.izvor, uredjaj.deviceCode);
  const store = otvoriStore({ putanja: okr.redPutanja, identitet: identitet(uredjaj.deviceCode) });

  try {
    await skenirajURed({ store, konfiguracija: k });

    /*
     * Posrednik koji vrati captive-portal stranicu sa HTTP 200.
     *
     * Bez provere `content-type` i `code`, konektor bi ovo upisao kao potvrdu i
     * dokument bi nestao iz reda a nikad ne bi bio knjižen.
     */
    const portal: typeof fetch = async () =>
      new Response("<html>Prijavite se na mrežu</html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      });

    const rez = await posaljiIzReda({
      store,
      konfiguracija: k,
      kljuc: uredjaj.privateKeyPkcs8Der,
      lokalniDatum: "2026-03-10",
      dozvoliHttp: true,
      fetchImpl: portal,
    });

    assert.equal(rez.potvrdjeno, 0, "HTML 200 je prihvaćen kao potvrda");
    assert.equal(rez.odlozeno, 1);
    assert.equal(await brojFaktura(), 0);
  } finally {
    store.zatvori();
    await rm(okr.baza, { recursive: true, force: true });
  }
});

test("ručni i device put, isti PDF u OBA redosleda — bez duplog prometa", async (t) => {
  if (guard(t)) return;
  const { ingestBiznisoftPdf } = await import("@/lib/pdf/ingest");
  const { otvoriStore } = await import(D("store.mjs"));
  const { skenirajURed, posaljiIzReda } = await import(D("pipeline.mjs"));
  const { readFile } = await import("node:fs/promises");

  const bajtovi = new Uint8Array(
    await readFile(new URL("fixtures/dev/biznisoft/vise-stavki.pdf", KOREN).pathname),
  );

  /* --- Redosled A: ručno pa konektor. --------------------------------- */
  const a = await aktivanUredjaj();
  await mapiranKupac();
  const okrA = await okruzenje();
  const kA = konfiguracija(okrA.izvor, a.deviceCode);
  const storeA = otvoriStore({ putanja: okrA.redPutanja, identitet: identitet(a.deviceCode) });
  try {
    assert.equal(
      (await ingestBiznisoftPdf({ bytes: bajtovi, fileName: "rucno.pdf", issuerCode: ISSUER }, office))
        .result,
      "ingested",
    );
    await skenirajURed({ store: storeA, konfiguracija: kA });
    const rez = await posaljiIzReda({
      store: storeA, konfiguracija: kA, kljuc: a.privateKeyPkcs8Der,
      lokalniDatum: "2026-03-10", dozvoliHttp: true,
    });
    assert.equal(rez.potvrdjeno, 1, "konektor nije dobio potvrđen duplikat");
    assert.equal(await brojFaktura(), 1);
  } finally {
    storeA.zatvori();
    await rm(okrA.baza, { recursive: true, force: true });
  }

  /* --- Redosled B: konektor pa ručno. --------------------------------- */
  await ocisti();
  const b = await aktivanUredjaj();
  await mapiranKupac();
  const okrB = await okruzenje();
  const kB = konfiguracija(okrB.izvor, b.deviceCode);
  const storeB = otvoriStore({ putanja: okrB.redPutanja, identitet: identitet(b.deviceCode) });
  try {
    await skenirajURed({ store: storeB, konfiguracija: kB });
    await posaljiIzReda({
      store: storeB, konfiguracija: kB, kljuc: b.privateKeyPkcs8Der,
      lokalniDatum: "2026-03-10", dozvoliHttp: true,
    });
    assert.equal(await brojFaktura(), 1);

    const posle = await ingestBiznisoftPdf(
      { bytes: bajtovi, fileName: "rucno.pdf", issuerCode: ISSUER },
      office,
    );
    assert.equal(posle.result, "duplicate_file");
    assert.equal(await brojFaktura(), 1, "nastala je druga faktura");
  } finally {
    storeB.zatvori();
    await rm(okrB.baza, { recursive: true, force: true });
  }
});

test("nepodržan dokument ne stiže do mreže", async (t) => {
  if (guard(t)) return;
  const { otvoriStore } = await import(D("store.mjs"));
  const { skenirajURed } = await import(D("pipeline.mjs"));

  const uredjaj = await aktivanUredjaj();
  const okr = await okruzenje(["nastavak-tabele.pdf", "zbir-se-ne-poklapa.pdf"]);
  const store = otvoriStore({ putanja: okr.redPutanja, identitet: identitet(uredjaj.deviceCode) });

  try {
    const rez = await skenirajURed({
      store,
      konfiguracija: konfiguracija(okr.izvor, uredjaj.deviceCode),
    });
    /*
     * Granice koje P1 postavlja ostaju: konektor ih ne pomera time što je dodat.
     * Nepodržan dokument se ne šalje i ne troši ciklus.
     */
    assert.equal(rez.nepodrzano, 2);
    assert.equal(rez.novo, 0);
    assert.equal(store.zbir().nepodrzano, 2);
  } finally {
    store.zatvori();
    await rm(okr.baza, { recursive: true, force: true });
  }
});

/* =========================================================================
 * Potpis i klijent, preko stvarnog transporta
 * ====================================================================== */

test("heartbeat dokazuje SAMO javljanje", async (t) => {
  if (guard(t)) return;
  const { posaljiHeartbeat } = await import(D("client.mjs"));
  const uredjaj = await aktivanUredjaj();

  const odgovor = await posaljiHeartbeat({
    origin,
    deviceCode: uredjaj.deviceCode,
    keyId: "k1",
    privateKeyPkcs8Der: uredjaj.privateKeyPkcs8Der,
    dozvoliHttp: true,
  });

  assert.equal(odgovor.httpStatus, 200);
  assert.equal(odgovor.code, "acknowledged");

  const [d] = await db.sql<{ last_seen_at: Date | null }[]>`
    SELECT last_seen_at FROM sync_devices WHERE id = ${uredjaj.deviceId}`;
  assert.ok(d.last_seen_at, "kontakt nije zabeležen");

  // Heartbeat ne pravi ni dokument ni promet.
  assert.equal(await brojFaktura(), 0);
});

test("klijent odbija HTTP i redirekciju bez izričitog test režima", async (t) => {
  if (guard(t)) return;
  const { proveriOrigin } = await import(D("client.mjs"));

  assert.throws(() => proveriOrigin("http://kancelarija.local"), (e: { code: string }) =>
    e.code === "origin_not_https");
  assert.throws(() => proveriOrigin("https://a.invalid/putanja"), (e: { code: string }) =>
    e.code === "origin_has_path");
  assert.throws(() => proveriOrigin("https://a.invalid/?x=1"), (e: { code: string }) =>
    e.code === "origin_has_query");
  assert.equal(proveriOrigin("https://a.invalid"), "https://a.invalid");
  // Test režim je jedini put do HTTP-a.
  assert.equal(proveriOrigin("http://127.0.0.1:1", { dozvoliHttp: true }), "http://127.0.0.1:1");
});

test("potpis iz STVARNOG klijenta prihvata stvarni rukovalac", async (t) => {
  if (guard(t)) return;
  const { posaljiPotpisano } = await import(D("client.mjs"));
  const { canonicalFromParsedDocument } = await import("@/lib/sync/contract/fromParsedDocument.mjs");
  const { parseBiznisoftPdf } = await import("@/lib/pdf/parseDocument");
  const { readFile } = await import("node:fs/promises");

  const uredjaj = await aktivanUredjaj();
  // `jedna-stavka.pdf` nosi sifru partnera `09001`, ne `09002`.
  await mapiranKupac("09001");

  const bajtovi = new Uint8Array(
    await readFile(new URL("fixtures/dev/biznisoft/jedna-stavka.pdf", KOREN).pathname),
  );
  const payload = canonicalFromParsedDocument(await parseBiznisoftPdf(bajtovi), bajtovi, {
    issuerCode: ISSUER,
  });

  /*
   * Telo se serijalizuje JEDNOM i šalje kao isti niz bajtova.
   *
   * Da klijent ponovo serijalizuje pred slanje, otisak ne bi odgovarao i
   * rukovalac bi vratio `body_hash_mismatch`.
   */
  const telo = new TextEncoder().encode(JSON.stringify(payload));

  const odgovor = await posaljiPotpisano({
    origin,
    path: "/api/sync/ingest",
    bodyBytes: telo,
    deviceCode: uredjaj.deviceCode,
    keyId: "k1",
    privateKeyPkcs8Der: uredjaj.privateKeyPkcs8Der,
    dozvoliHttp: true,
  });

  assert.equal(odgovor.httpStatus, 200, `odgovor: ${JSON.stringify(odgovor)}`);
  assert.equal(odgovor.code, "ingested");
  assert.equal(await brojFaktura(), 1);
});

test("parser iz PAKETA daje isti canonical rezultat kao serverski put", async (t) => {
  if (guard(t)) return;
  const { readFile } = await import("node:fs/promises");

  // Iz paketa (prevedeni `.js`), bez Next okruženja.
  const paket = await import(new URL("lib/pdf/parseDocument.js", DIST).href);
  // Serverski put (isti izvor, kroz `@/` alias i tsx).
  const server = await import("@/lib/pdf/parseDocument");
  const { canonicalFromParsedDocument } = await import("@/lib/sync/contract/fromParsedDocument.mjs");

  for (const ime of ["jedna-stavka.pdf", "vise-stavki.pdf", "vodeca-nula-partner.pdf"]) {
    const b = new Uint8Array(
      await readFile(new URL(`fixtures/dev/biznisoft/${ime}`, KOREN).pathname),
    );
    const izPaketa = canonicalFromParsedDocument(await paket.parseBiznisoftPdf(b), b, {
      issuerCode: ISSUER,
    });
    const saServera = canonicalFromParsedDocument(await server.parseBiznisoftPdf(b), b, {
      issuerCode: ISSUER,
    });
    assert.deepEqual(izPaketa, saServera, `„${ime}“ se razlikuje između paketa i servera`);
    assert.equal(izPaketa.semantic_hash, saServera.semantic_hash);
  }
});

/* =========================================================================
 * Ručne komande (P4) — pun tok, kroz stvarni HTTP
 * ====================================================================== */

/** Kontekst za `commands.mjs`, isti oblik koji CLI sastavlja. */
function komandniKontekst(
  store: unknown,
  izvor: string,
  uredjaj: Awaited<ReturnType<typeof aktivanUredjaj>>,
) {
  return {
    store,
    konfiguracija: konfiguracija(izvor, uredjaj.deviceCode),
    kljuc: uredjaj.privateKeyPkcs8Der,
    dozvoliHttp: true,
    lokalniDatum: "2026-03-10",
  };
}

test("portal → komanda → konektor → jedna faktura, bez čekanja na 09:00", async (t) => {
  if (guard(t)) return;
  const { otvoriStore } = await import(D("store.mjs"));
  const { izvrsiKomandu, preuzmiKomandu } = await import(D("commands.mjs"));
  const { zakaziKomandu } = await import("@/lib/sync/commands/service");

  const uredjaj = await aktivanUredjaj();
  await mapiranKupac();
  const okr = await okruzenje();
  const store = otvoriStore({ putanja: okr.redPutanja, identitet: identitet(uredjaj.deviceCode) });

  try {
    // 1. Kancelarija klikne dugme.
    const { commandId } = await zakaziKomandu({ deviceId: uredjaj.deviceId }, office);

    // 2. Konektor pita i dobija komandu — preko stvarnog potpisanog HTTP-a.
    const ctx = komandniKontekst(store, okr.izvor, uredjaj);
    const preuzeta = await preuzmiKomandu(ctx);
    assert.equal(preuzeta.ishod, "komanda", JSON.stringify(preuzeta));
    assert.equal(preuzeta.komanda.id, commandId);

    // 3. Izvršenje ide kroz ISTI ciklus koji radi i `run-once`.
    const rez = await izvrsiKomandu({ ...ctx, komanda: preuzeta.komanda });
    assert.equal(rez.stanje, "completed", JSON.stringify(rez));
    assert.equal(await brojFaktura(), 1);

    // 4. Server vidi završenu komandu sa tačnim brojačima.
    const [red] = await db.sql<
      { status: string; posted_count: number; review_count: number; finished_at: string | null }[]
    >`SELECT status, posted_count, review_count, finished_at
        FROM sync_commands WHERE id = ${commandId}`;
    assert.equal(red.status, "completed");
    assert.equal(red.posted_count, 1);
    assert.equal(red.review_count, 0);
    assert.ok(red.finished_at, "završetak nije zabeležen");

    /*
     * Trag razdvaja aktere: kancelarija je ZATRAŽILA, uređaj je IZVRŠIO.
     * Spajanje bi značilo da izveštaj tvrdi da je čovek uneo dokumente.
     */
    const trag = await db.sql<{ action: string; actor_kind: string }[]>`
      SELECT action, actor_kind FROM audit_log
       WHERE entity_type = 'Komanda sinhronizacije' ORDER BY created_at`;
    assert.deepEqual(
      trag.map((r) => [r.action, r.actor_kind]),
      [
        ["Zatražena sinhronizacija", "user"],
        ["Komanda sinhronizacije završena", "device"],
      ],
    );

    // Lokalno je komanda zatvorena i nijedan događaj ne visi nepotvrđen.
    assert.equal(store.otvorenaKomanda(), null);
    assert.equal(store.nepotvrdjeniDogadjaji().length, 0);
  } finally {
    store.zatvori();
    await rm(okr.baza, { recursive: true, force: true });
  }
});

test("izgubljen ACK: NOV proces šalje ISTI event_id, posao se ne ponavlja", async (t) => {
  if (guard(t)) return;
  const { otvoriStore } = await import(D("store.mjs"));
  const { izvrsiKomandu, posaljiNepotvrdjene, preuzmiKomandu } = await import(D("commands.mjs"));
  const { zakaziKomandu } = await import("@/lib/sync/commands/service");

  const uredjaj = await aktivanUredjaj();
  await mapiranKupac();
  const okr = await okruzenje();
  const { commandId } = await zakaziKomandu({ deviceId: uredjaj.deviceId }, office);

  // --- Proces 1: odradi posao, ali mu završni ACK „propadne“. -------------
  const prvi = otvoriStore({ putanja: okr.redPutanja, identitet: identitet(uredjaj.deviceCode) });
  try {
    const ctx = komandniKontekst(prvi, okr.izvor, uredjaj);
    const preuzeta = await preuzmiKomandu(ctx);
    assert.equal(preuzeta.ishod, "komanda");

    /*
     * `fetch` koji radi za `ingest`, a puca na `commands/update`.
     *
     * Tako se pogađa tačno onaj prozor u kome je posao OBAVLJEN a server to ne
     * zna — najopasniji trenutak, jer naivan konektor tu ponovi ceo posao.
     */
    const stvarni = globalThis.fetch;
    const ustaljen = async (url: string | URL | Request, init?: RequestInit) => {
      if (String(url).includes("/commands/update")) throw new Error("ECONNRESET");
      return stvarni(url as never, init);
    };

    const rez = await izvrsiKomandu({
      ...ctx,
      komanda: preuzeta.komanda,
      fetchImpl: ustaljen as unknown as typeof fetch,
    });
    assert.equal(rez.stanje, "completed");
    assert.equal(rez.ackPoslat, false, "test nije pogodio prozor izgubljenog ACK-a");
    assert.equal(await brojFaktura(), 1, "faktura nije knjižena");

    // Server i dalje misli da komanda radi; događaji čekaju potvrdu.
    const [pre] = await db.sql<{ status: string }[]>`
      SELECT status FROM sync_commands WHERE id = ${commandId}`;
    assert.ok(["delivered", "running"].includes(pre.status), `stanje: ${pre.status}`);
    assert.ok(prvi.nepotvrdjeniDogadjaji().length >= 1);
  } finally {
    prvi.zatvori();
  }

  // --- Proces 2: nov proces, isti red. -----------------------------------
  const drugi = otvoriStore({ putanja: okr.redPutanja, identitet: identitet(uredjaj.deviceCode) });
  try {
    const ctx = komandniKontekst(drugi, okr.izvor, uredjaj);
    const poslato = await posaljiNepotvrdjene(ctx);
    assert.ok(poslato.poslato >= 1, JSON.stringify(poslato));

    const [posle] = await db.sql<{ status: string; posted_count: number }[]>`
      SELECT status, posted_count FROM sync_commands WHERE id = ${commandId}`;
    assert.equal(posle.status, "completed");
    assert.equal(posle.posted_count, 1);

    /*
     * JEDNA faktura, i posle ponovljenog izveštaja.
     *
     * Da je nov proces ponovo skenirao i poslao, ovde bi bile dve — ili bi
     * `source_hash` idempotentnost tiho sakrila drugi pokušaj.
     */
    assert.equal(await brojFaktura(), 1);
  } finally {
    drugi.zatvori();
    await rm(okr.baza, { recursive: true, force: true });
  }
});

test("opoziv usred posla: komanda ne može da se zatvori tuđim ključem", async (t) => {
  if (guard(t)) return;
  const { otvoriStore } = await import(D("store.mjs"));
  const { preuzmiKomandu } = await import(D("commands.mjs"));
  const { zakaziKomandu } = await import("@/lib/sync/commands/service");
  const { revokeDevice } = await import("@/lib/sync/device/registry");

  const uredjaj = await aktivanUredjaj();
  const okr = await okruzenje();
  const store = otvoriStore({ putanja: okr.redPutanja, identitet: identitet(uredjaj.deviceCode) });

  try {
    await zakaziKomandu({ deviceId: uredjaj.deviceId }, office);
    const ctx = komandniKontekst(store, okr.izvor, uredjaj);
    assert.equal((await preuzmiKomandu(ctx)).ishod, "komanda");

    // Gazda opoziva uređaj dok komanda stoji otvorena.
    await revokeDevice({ deviceId: uredjaj.deviceId, reason: "QA opoziv usred posla" }, owner);

    /*
     * Sledeće javljanje pada na autentifikaciji, ne na komandi. Opoziv mora da
     * važi ODMAH — a ne tek kad uređaj sam odluči da prestane.
     */
    const posle = await preuzmiKomandu(ctx);
    assert.equal(posle.ishod, "odbijeno", JSON.stringify(posle));
    assert.equal(await brojFaktura(), 0);
  } finally {
    store.zatvori();
    await rm(okr.baza, { recursive: true, force: true });
  }
});

test("dokument za pregled daje `completed_with_review`, ne `completed`", async (t) => {
  if (guard(t)) return;
  const { otvoriStore } = await import(D("store.mjs"));
  const { izvrsiKomandu, preuzmiKomandu } = await import(D("commands.mjs"));
  const { zakaziKomandu } = await import("@/lib/sync/commands/service");

  const uredjaj = await aktivanUredjaj();
  /*
   * Kupac se NAMERNO ne mapira.
   *
   * Dokument tada ide na ljudski pregled. Da se to prijavi kao `completed`,
   * ekran bi tvrdio da je sve knjiženo — a nijedna faktura nije.
   */
  const okr = await okruzenje();
  const store = otvoriStore({ putanja: okr.redPutanja, identitet: identitet(uredjaj.deviceCode) });

  try {
    const { commandId } = await zakaziKomandu({ deviceId: uredjaj.deviceId }, office);
    const ctx = komandniKontekst(store, okr.izvor, uredjaj);
    const preuzeta = await preuzmiKomandu(ctx);
    const rez = await izvrsiKomandu({ ...ctx, komanda: preuzeta.komanda });

    assert.equal(rez.stanje, "completed_with_review", JSON.stringify(rez));
    assert.equal(await brojFaktura(), 0, "nemapiran kupac je ipak knjižen");

    const [red] = await db.sql<{ status: string; posted_count: number; review_count: number }[]>`
      SELECT status, posted_count, review_count FROM sync_commands WHERE id = ${commandId}`;
    assert.equal(red.status, "completed_with_review");
    assert.equal(red.posted_count, 0);
    assert.ok(red.review_count >= 1);
  } finally {
    store.zatvori();
    await rm(okr.baza, { recursive: true, force: true });
  }
});

test("sa isključenim komandama `run-once` i termin u 09:00 rade kao pre", async (t) => {
  if (guard(t)) return;
  const { otvoriStore } = await import(D("store.mjs"));
  const { skenirajURed, posaljiIzReda } = await import(D("pipeline.mjs"));
  const { preuzmiKomandu } = await import(D("commands.mjs"));
  const { odlukaOCiklusu } = await import(D("schedule.mjs"));

  const uredjaj = await aktivanUredjaj();
  await mapiranKupac();
  const okr = await okruzenje();
  const store = otvoriStore({ putanja: okr.redPutanja, identitet: identitet(uredjaj.deviceCode) });

  delete process.env.FEATURE_SYNC_OPERATIONS;
  try {
    const k = konfiguracija(okr.izvor, uredjaj.deviceCode);

    // 1. Poll je 404 — ali to je „nema komandi“, ne kvar.
    const ctx = komandniKontekst(store, okr.izvor, uredjaj);
    assert.equal((await preuzmiKomandu(ctx)).ishod, "iskljuceno");

    // 2. Redovan posao ide dalje, nedirnut.
    assert.equal((await skenirajURed({ store, konfiguracija: k })).novo, 1);
    const slanje = await posaljiIzReda({
      store, konfiguracija: k, kljuc: uredjaj.privateKeyPkcs8Der,
      lokalniDatum: "2026-03-10", dozvoliHttp: true,
    });
    assert.equal(slanje.potvrdjeno, 1, JSON.stringify(slanje));
    assert.equal(await brojFaktura(), 1);

    // 3. Odluka o terminu ne zna ni da komande postoje.
    const odluka = odlukaOCiklusu({
      // Posle 09:00 po lokalnom vremenu; 08:05 bi tačno dalo „čekaj“.
      now: new Date("2026-03-10T09:05:00+01:00"),
      poslednjiIzvrsenDatum: null,
      dodatnaZatvaranja: [],
    });
    assert.equal(odluka.akcija, "pokreni", JSON.stringify(odluka));
  } finally {
    process.env.FEATURE_SYNC_OPERATIONS = "1";
    store.zatvori();
    await rm(okr.baza, { recursive: true, force: true });
  }
});

/* =========================================================================
 * Oporavak posle privremenih grešaka — ISTI red, bez pomeranja queue.db
 * ====================================================================== */

/** Lažni odgovor 429 (server se ne dodiruje). `retryAfter` ide u zaglavlje. */
const odgovor429 = (retryAfter: number | null) =>
  new Response(JSON.stringify({ ok: false, code: "rate_limited", requestId: "x" }), {
    status: 429,
    headers: { "content-type": "application/json", ...(retryAfter === null ? {} : { "retry-after": String(retryAfter) }) },
  });

/** Propušta zahteve do pravog servera; zahteve sa rednim brojem iz `blokiraj` zamenjuje sa 429. */
function sa429(blokiraj: Set<number>, retryAfter: number | null) {
  let n = 0;
  return (async (...args: Parameters<typeof fetch>) => {
    n += 1;
    if (blokiraj.has(n)) return odgovor429(retryAfter);
    return fetch(...args);
  }) as typeof fetch;
}

const TRI = ["vise-stavki.pdf", "jedna-stavka.pdf", "dve-strane-ponovljeno-zaglavlje.pdf"];
/** Sintetički partneri ova tri računa (09002, 09001, 09003). */
const mapirajTri = async () => {
  for (const sifra of ["09002", "09001", "09003"]) await mapiranKupac(sifra);
};
const brojStavki = async () => {
  const [{ n }] = await db.sql<{ n: number }[]>`SELECT count(*)::int AS n FROM invoice_lines`;
  return n;
};

test("deo uspe, stigne 429 sa Retry-After, ostatak posle čekanja — u istom ciklusu", async (t) => {
  if (guard(t)) return;
  const { otvoriStore } = await import(D("store.mjs"));
  const { skenirajURed, posaljiIzReda } = await import(D("pipeline.mjs"));
  const uredjaj = await aktivanUredjaj();
  await mapirajTri();
  const okr = await okruzenje(TRI);
  const k = konfiguracija(okr.izvor, uredjaj.deviceCode);
  const store = otvoriStore({ putanja: okr.redPutanja, identitet: identitet(uredjaj.deviceCode) });
  const cekanja: number[] = [];
  try {
    assert.equal((await skenirajURed({ store, konfiguracija: k })).novo, 3);
    const rez = await posaljiIzReda({
      store, konfiguracija: k, kljuc: uredjaj.privateKeyPkcs8Der, lokalniDatum: "2026-03-10", dozvoliHttp: true,
      fetchImpl: sa429(new Set([2]), 7), cekaj: async (ms: number) => { cekanja.push(ms); },
    });
    assert.deepEqual(cekanja, [7_000], "Retry-After nije poštovan");
    assert.equal(rez.potvrdjeno, 3, `neočekivano: ${JSON.stringify(rez)}`);
    assert.equal(rez.odlozeno, 0, "ništa ne sme ići na sledeći radni dan");
    assert.equal(rez.zaustavljeno, null);
    assert.equal(await brojFaktura(), 3);
    const stavki = await brojStavki();
    // Ponovo isti red: ništa novo za slanje.
    const ponovo = await posaljiIzReda({ store, konfiguracija: k, kljuc: uredjaj.privateKeyPkcs8Der, lokalniDatum: "2026-03-10", dozvoliHttp: true });
    assert.equal(ponovo.poslato, 0);
    assert.equal(await brojFaktura(), 3);
    assert.equal(await brojStavki(), stavki, "stavke su udvostručene");
  } finally {
    store.zatvori();
    await rm(okr.baza, { recursive: true, force: true });
  }
});

test("dug Retry-After: ciklus staje, novi proces sa ISTIM queue.db čeka pa nastavlja bez duplikata", async (t) => {
  if (guard(t)) return;
  const { otvoriStore } = await import(D("store.mjs"));
  const { skenirajURed, posaljiIzReda } = await import(D("pipeline.mjs"));
  const uredjaj = await aktivanUredjaj();
  await mapirajTri();
  const okr = await okruzenje(TRI);
  const k = konfiguracija(okr.izvor, uredjaj.deviceCode);
  const t0 = Date.parse("2026-03-10T10:00:00Z");
  try {
    /* --- Proces 1: jedan uspe, pa 429 sa 15 minuta čekanja. ------------- */
    const prvi = otvoriStore({ putanja: okr.redPutanja, identitet: identitet(uredjaj.deviceCode) });
    await skenirajURed({ store: prvi, konfiguracija: k });
    const r1 = await posaljiIzReda({
      store: prvi, konfiguracija: k, kljuc: uredjaj.privateKeyPkcs8Der, lokalniDatum: "2026-03-10", dozvoliHttp: true,
      fetchImpl: sa429(new Set([2]), 900), cekaj: async () => { throw new Error("ne sme da čeka 15 min u ciklusu"); },
      sada: () => t0,
    });
    assert.equal(r1.potvrdjeno, 1);
    assert.equal(r1.zaustavljeno, "rate_limited");
    assert.equal(r1.nastaviPosle, new Date(t0 + 900_000).toISOString());
    assert.equal(r1.odlozeno, 0);
    assert.deepEqual(prvi.zbir(), { potvrdjeno: 1, spremno: 2 }, "stanje reda posle prekida");
    prvi.zatvori(); // prekid talasa

    /* --- Proces 2, isti fajl, pre isteka: ništa se ne šalje. ------------ */
    const drugi = otvoriStore({ putanja: okr.redPutanja, identitet: identitet(uredjaj.deviceCode) });
    try {
      const rano = await posaljiIzReda({
        store: drugi, konfiguracija: k, kljuc: uredjaj.privateKeyPkcs8Der, lokalniDatum: "2026-03-10", dozvoliHttp: true,
        sada: () => t0 + 60_000,
      });
      assert.equal(rano.zaustavljeno, "ceka_server");
      assert.equal(rano.poslato, 0);
      assert.equal(await brojFaktura(), 1);

      /* --- Posle isteka, isti dan: preostala dva. ------------------------ */
      const kasnije = await posaljiIzReda({
        store: drugi, konfiguracija: k, kljuc: uredjaj.privateKeyPkcs8Der, lokalniDatum: "2026-03-10", dozvoliHttp: true,
        sada: () => t0 + 901_000,
      });
      assert.equal(kasnije.potvrdjeno, 2, `neočekivano: ${JSON.stringify(kasnije)}`);
      assert.equal(kasnije.zaustavljeno, null);
      assert.deepEqual(drugi.zbir(), { potvrdjeno: 3 });
      assert.equal(await brojFaktura(), 3, "duplikat ili gubitak");
      const [{ n }] = await db.sql<{ n: number }[]>`SELECT count(*)::int AS n FROM source_documents`;
      assert.equal(n, 3);
    } finally {
      drugi.zatvori();
    }
  } finally {
    await rm(okr.baza, { recursive: true, force: true });
  }
});

test("429 bez Retry-After: postepeno čekanje; stavke koje je stara verzija odložila do sutra se oslobađaju", async (t) => {
  if (guard(t)) return;
  const { otvoriStore } = await import(D("store.mjs"));
  const { skenirajURed, posaljiIzReda } = await import(D("pipeline.mjs"));
  const uredjaj = await aktivanUredjaj();
  await mapirajTri();
  const okr = await okruzenje(TRI);
  const k = konfiguracija(okr.izvor, uredjaj.deviceCode);
  const store = otvoriStore({ putanja: okr.redPutanja, identitet: identitet(uredjaj.deviceCode) });
  const cekanja: number[] = [];
  try {
    await skenirajURed({ store, konfiguracija: k });
    // Kao posle starije verzije: dve stavke odložene do sledećeg radnog dana zbog 429.
    const [a, b] = store.zaSlanje({ lokalniDatum: "2026-03-10" });
    store.odlozi({ id: a.id, odlozenoDo: "2026-03-11", razlog: "rate_limited" });
    store.odlozi({ id: b.id, odlozenoDo: "2026-03-11", razlog: "transport:timeout" });
    const rez = await posaljiIzReda({
      store, konfiguracija: k, kljuc: uredjaj.privateKeyPkcs8Der, lokalniDatum: "2026-03-10", dozvoliHttp: true,
      fetchImpl: sa429(new Set([1, 2]), null), cekaj: async (ms: number) => { cekanja.push(ms); },
    });
    assert.equal(rez.oslobodjeno, 2, "stara odlaganja nisu oslobođena");
    assert.deepEqual(cekanja, [5_000, 10_000], "postepeno čekanje");
    assert.equal(rez.potvrdjeno, 3);
    assert.equal(await brojFaktura(), 3);
  } finally {
    store.zatvori();
    await rm(okr.baza, { recursive: true, force: true });
  }
});

test("trajna greška ostaje izdvojena i ne ponavlja se (za pregled)", async (t) => {
  if (guard(t)) return;
  const { otvoriStore } = await import(D("store.mjs"));
  const { skenirajURed, posaljiIzReda } = await import(D("pipeline.mjs"));
  const uredjaj = await aktivanUredjaj();
  // Bez mapiranja kupca: server čuva za pregled (`awaiting_customer_mapping`).
  const okr = await okruzenje(["vise-stavki.pdf"]);
  const k = konfiguracija(okr.izvor, uredjaj.deviceCode);
  const store = otvoriStore({ putanja: okr.redPutanja, identitet: identitet(uredjaj.deviceCode) });
  try {
    await skenirajURed({ store, konfiguracija: k });
    const rez = await posaljiIzReda({
      store, konfiguracija: k, kljuc: uredjaj.privateKeyPkcs8Der, lokalniDatum: "2026-03-10", dozvoliHttp: true,
      cekaj: async () => { throw new Error("trajna greška ne sme da čeka i ponavlja"); },
    });
    assert.equal(rez.zaPregled, 1);
    assert.equal(rez.ponovljeno, 0);
    assert.deepEqual(store.zbir(), { za_pregled: 1 });
  } finally {
    store.zatvori();
    await rm(okr.baza, { recursive: true, force: true });
  }
});

/* =========================================================================
 * Izveštaj ciklusa u heartbeat-u (0034, konektor 0.3.9)
 * ====================================================================== */

const izvestaj = (o: Record<string, unknown>) => ({
  ishod: "obradjeno",
  razlog: "raspored",
  skeniranjeZavrseno: true,
  pocetak: "2026-10-07T13:02:00+02:00",
  pregledano: 10,
  novo: 0,
  poslato: 0,
  potvrdjeno: 0,
  zaPregled: 0,
  preostalo: 0,
  trajanjeMs: 1200,
  verzija: "0.3.9",
  sledeciTermin: "2026-10-07T14:02:00+02:00",
  ...o,
});

test("heartbeat: prazno telo (0.3.8) i izveštaj ciklusa (0.3.9) se beleže odvojeno", async (t) => {
  if (guard(t)) return;
  const { posaljiHeartbeat } = await import(D("client.mjs"));
  const uredjaj = await aktivanUredjaj();
  const posalji = (telo?: unknown) =>
    posaljiHeartbeat({ origin, deviceCode: uredjaj.deviceCode, keyId: "k1", privateKeyPkcs8Der: uredjaj.privateKeyPkcs8Der, dozvoliHttp: true, telo });
  const stanje = async () => (await db.sql<{ last_seen_at: Date | null; last_cycle_at: Date | null; last_cycle_outcome: string | null; last_scan_completed_at: Date | null; next_expected_cycle_at: Date | null }[]>`
    SELECT last_seen_at, last_cycle_at, last_cycle_outcome::text, last_scan_completed_at, next_expected_cycle_at FROM sync_devices WHERE id = ${uredjaj.deviceId}`)[0];
  const ciklusa = async () => (await db.sql<{ n: number }[]>`SELECT count(*)::int AS n FROM sync_device_cycles WHERE device_id = ${uredjaj.deviceId}`)[0].n;

  // 0.3.8: prazno telo — samo javljanje.
  const prazno = await posalji();
  assert.equal(prazno.httpStatus, 200);
  let s = await stanje();
  assert.ok(s.last_seen_at);
  assert.equal(s.last_cycle_at, null, "prazno telo ne sme izmisliti ciklus");
  assert.equal(await ciklusa(), 0);

  // Preskočen ciklus: računar radi, skeniranja nije bilo.
  const now = new Date();
  const iso = (d: Date) => d.toISOString().replace("Z", "+00:00");
  const t1 = new Date(now.getTime() - 60 * 60_000);
  const r1 = await posalji({ ciklus: izvestaj({ ishod: "preskoceno", razlog: "ceka_sledeci_ciklus", skeniranjeZavrseno: false, pocetak: iso(t1), pregledano: undefined }) });
  assert.equal(r1.httpStatus, 200);
  s = await stanje();
  assert.equal(s.last_cycle_outcome, "preskoceno");
  assert.equal(s.last_scan_completed_at, null, "preskočen ciklus nije skeniranje");
  assert.ok(s.next_expected_cycle_at);

  // Obrađen ciklus sa punim popisom pomera i poslednje uspešno skeniranje.
  const t2 = new Date(now.getTime() - 5 * 60_000);
  assert.equal((await posalji({ ciklus: izvestaj({ pocetak: iso(t2) }) })).httpStatus, 200);
  s = await stanje();
  assert.equal(s.last_cycle_outcome, "obradjeno");
  assert.equal(s.last_scan_completed_at?.getTime(), t2.getTime());

  // Ponovljen isti izveštaj ne pravi drugi red; zakasneli stariji ne vraća stanje unazad.
  assert.equal(await ciklusa(), 2);
  await posalji({ ciklus: izvestaj({ pocetak: iso(t2) }) });
  await posalji({ ciklus: izvestaj({ ishod: "greska", skeniranjeZavrseno: false, kodGreske: "mreza", pocetak: iso(new Date(now.getTime() - 30 * 60_000)) }) });
  assert.equal(await ciklusa(), 3);
  s = await stanje();
  assert.equal(s.last_cycle_at?.getTime(), t2.getTime(), "stariji izveštaj je pomerio poslednji ciklus unazad");
  assert.equal(s.last_cycle_outcome, "obradjeno");

  // Neispravno: vreme bez zone, skeniranje uz preskočen ciklus, nepoznat ishod, putanja u kodu.
  for (const los of [
    izvestaj({ pocetak: "2026-10-07T13:02:00" }),
    izvestaj({ ishod: "preskoceno", skeniranjeZavrseno: true, pocetak: iso(now) }),
    izvestaj({ ishod: "uspeh", pocetak: iso(now) }),
    izvestaj({ kodGreske: "C:\\Users\\x", pocetak: iso(now) }),
    izvestaj({ pocetak: iso(new Date(now.getTime() + 60 * 60_000)) }),
  ]) {
    const r = await posalji({ ciklus: los });
    assert.equal(r.httpStatus, 400, JSON.stringify(los));
    assert.match(String(r.code), /^cycle_(invalid|time_out_of_range)$/);
  }
  assert.equal(await ciklusa(), 3, "neispravan izveštaj je upisan");
  assert.equal(await brojFaktura(), 0, "izveštaj ciklusa ne sme da pravi dokumente");
});

/** Pokreće CLI konektora iz paketa, sa sopstvenim folderom stanja. */
async function cli(argv: string[], env: Record<string, string>) {
  const { main } = await import(D("cli.mjs"));
  const izlaz: string[] = [];
  const pisi = process.stdout.write.bind(process.stdout);
  const stare: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(env)) { stare[k] = process.env[k]; process.env[k] = v; }
  (process.stdout as unknown as { write: (c: unknown) => boolean }).write = (c: unknown) => { izlaz.push(String(c)); return true; };
  try {
    const kod = await main(argv, process.env);
    return { kod, izlaz: izlaz.join("") };
  } finally {
    (process.stdout as unknown as { write: typeof pisi }).write = pisi;
    for (const [k, v] of Object.entries(stare)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  }
}

test("ciklus konektora šalje izveštaj; neuspeh heartbeat-a ne menja red i ne izaziva ponovno slanje", async (t) => {
  if (guard(t)) return;
  const { writeFile, readFile } = await import("node:fs/promises");
  const { otvoriStore } = await import(D("store.mjs"));
  const { registerDevice, activateDevice } = await import("@/lib/sync/device/registry");
  await mapiranKupac();
  const okr = await okruzenje(["vise-stavki.pdf"]);
  const stanje = join(okr.baza, "stanje");
  const deviceCode = `dev-${randomUUID().slice(0, 8)}`;
  const konfig = join(okr.baza, "config.json");
  await writeFile(konfig, JSON.stringify({ ...konfiguracija(okr.izvor, deviceCode), ciklus: { od: "08:00", do: "19:00", svakihMinuta: 60 } }));
  const env = {
    CS_CONNECTOR_STATE_DIR: stanje,
    CS_CONNECTOR_CONFIG: konfig,
    CS_CONNECTOR_INSECURE_KEYSTORE: "1",
    CS_CONNECTOR_ALLOW_LOOPBACK_HTTP: "1",
  };
  heartbeatTela.length = 0;
  heartbeatPokvaren = false;
  try {
    assert.equal((await cli(["init"], env)).kod, 0);
    const javni = JSON.parse((await cli(["export-key"], env)).izlaz);
    const out = await registerDevice({ deviceCode, label: "QA ciklus", sourceSystem: "biznisoft", issuerCode: ISSUER, keyId: "k1", publicKeySpki: javni.javniKljucSpkiBase64 }, owner);
    await activateDevice({ deviceId: out.deviceId, keyId: "k1", expectedFingerprint: out.fingerprint }, owner);

    // 1) Ručni ciklus: šalje fakturu i posle toga izveštaj „obrađen".
    const prvi = await cli(["run-once"], env);
    assert.equal(prvi.kod, 0, prvi.izlaz);
    assert.equal(await brojFaktura(), 1);
    const posleSlanja = ingestZahteva;
    const [c1] = await db.sql<{ outcome: string; scan_completed: boolean; sent: number; next_expected_at: Date | null; connector_version: string }[]>`
      SELECT outcome::text, scan_completed, sent, next_expected_at, connector_version FROM sync_device_cycles WHERE device_id = ${out.deviceId}`;
    assert.equal(c1.outcome, "obradjeno");
    assert.equal(c1.scan_completed, true);
    assert.equal(c1.sent, 1);
    assert.ok(c1.next_expected_at, "uređaj nije najavio sledeći ciklus");
    assert.match(c1.connector_version, /^\d+\.\d+\.\d+$/);

    // 2) Zakazani ciklus odmah posle: preskočen po rasporedu — računar radi.
    const drugi = await cli(["auto"], env);
    assert.equal(drugi.kod, 0, drugi.izlaz);
    const ishodi = (await db.sql<{ outcome: string }[]>`SELECT outcome::text FROM sync_device_cycles WHERE device_id = ${out.deviceId} ORDER BY cycle_at`).map((r) => r.outcome);
    assert.deepEqual(ishodi, ["obradjeno", "preskoceno"]);

    // 3) Server odbija heartbeat dok ciklus šalje NOVU fakturu: slanje i potvrda
    //    prolaze, izlazni kod ostaje 0, a sledeći ciklus ništa ne šalje ponovo.
    await mapiranKupac("09001");
    await cp(new URL("fixtures/dev/biznisoft/jedna-stavka.pdf", KOREN).pathname, join(okr.izvor, "Faktura jedna-stavka.pdf"));
    heartbeatPokvaren = true;
    const treci = await cli(["run-once"], env);
    assert.equal(treci.kod, 0, `neuspeh heartbeat-a je promenio izlazni kod: ${treci.izlaz}`);
    assert.equal(ingestZahteva, posleSlanja + 1, "nova faktura nije poslata tačno jednom");
    assert.equal(await brojFaktura(), 2);
    const store = otvoriStore({ putanja: join(stanje, "queue.db"), identitet: identitet(deviceCode) });
    const zbirPosle = JSON.stringify(store.zbir());
    store.zatvori();
    assert.match(zbirPosle, /"potvrdjeno":2/, `stanje reda posle neuspelog heartbeat-a: ${zbirPosle}`);
    const dnevnik = await readFile(join(stanje, "connector.log"), "utf8").catch(() => "");
    assert.match(dnevnik, /heartbeat/, "neuspeh heartbeat-a nije zabeležen u dnevniku");

    heartbeatPokvaren = false;
    const cetvrti = await cli(["run-once"], env);
    assert.equal(cetvrti.kod, 0, cetvrti.izlaz);
    assert.equal(ingestZahteva, posleSlanja + 1, "posle neuspelog heartbeat-a faktura je poslata ponovo");
    assert.equal(await brojFaktura(), 2);
    const store3 = otvoriStore({ putanja: join(stanje, "queue.db"), identitet: identitet(deviceCode) });
    assert.equal(JSON.stringify(store3.zbir()), zbirPosle, "drugi ciklus je promenio red");
    store3.zatvori();

    // Telo heartbeat-a nosi samo brojeve i vremena sa zonom — bez imena fajlova i putanja.
    assert.ok(heartbeatTela.length >= 3);
    for (const telo of heartbeatTela) {
      assert.doesNotMatch(telo, /Faktura|\.pdf|Moj Folder|fakture/i);
      const c = JSON.parse(telo).ciklus;
      assert.match(c.pocetak, /[+-]\d{2}:\d{2}$/, "vreme bez zone");
    }
  } finally {
    heartbeatPokvaren = false;
    await rm(okr.baza, { recursive: true, force: true });
  }
});
