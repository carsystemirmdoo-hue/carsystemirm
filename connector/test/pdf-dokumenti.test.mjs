import assert from "node:assert/strict";
import { createHash, generateKeyPairSync } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

/**
 * 0.3.14: storno i knjižno odobrenje se šalju sami, kao PDF, na `/api/sync/document`.
 *
 * - storno (`FAK…`) i knjižno odobrenje (`k.o …`) ulaze u red kao PDF telo;
 * - slanje bira putanju po telu (faktura i dalje ide na `/api/sync/ingest`);
 * - redovi koje je 0.3.13 ostavio po strani (storno za ručni upload) jednom se ponovo čitaju;
 * - `posaljiOdDatuma` i dalje važi: arhiva se ne šalje.
 *
 * Svi dokumenti su sintetički (`fixtures/dev/biznisoft`).
 */

const D = (p) => new URL(`../dist/connector/src/${p}`, import.meta.url).href;
const DL = (p) => new URL(`../dist/lib/${p}`, import.meta.url).href;
const FIXTURES = fileURLToPath(new URL("../../fixtures/dev/biznisoft/", import.meta.url));

let m = null;
try {
  await import("node:sqlite");
  m = {
    pipeline: await import(D("pipeline.mjs")),
    store: await import(D("store.mjs")),
    doc: await import(DL("sync/contract/deviceDocument.mjs")),
  };
} catch {
  m = null;
}
const guard = (t) => {
  if (m) return false;
  t.skip(`Konektor traži node:sqlite (Node 22+) i build (npm run connector:build); runtime ${process.version}.`);
  return true;
};

const IDENTITET = { origin: "https://smoke.invalid", deviceCode: "test-pc", sourceSystem: "biznisoft", issuerCode: "TEST", contractVersion: 1 };
const BRZE = { maxBajtova: 20 * 1024 * 1024, maxNovihPoCiklusu: 200, maxPopisa: 200_000, stabilnostMs: 5, stabilnostPokusaja: 3 };

async function okruzenje(dodatno = {}) {
  const baza = await mkdtemp(join(tmpdir(), "cs-pdfdok-"));
  const koren = join(baza, "FAKTURE");
  await mkdir(join(koren, "FAKTURE 2026"), { recursive: true });
  const store = m.store.otvoriStore({ putanja: join(baza, "queue.db"), identitet: IDENTITET });
  const konfiguracija = {
    ...IDENTITET, serverOrigin: IDENTITET.origin, keyId: "k1", izvorniFolder: koren,
    dodatnaZatvaranja: [], maxPoCiklusu: 50, timeoutMs: 30_000, ...dodatno,
  };
  const stavi = async (ime, izvor) => {
    const put = join(koren, "FAKTURE 2026", ime);
    await cp(join(FIXTURES, izvor), put);
    return put;
  };
  return {
    store, konfiguracija, stavi,
    ciklus: () => m.pipeline.skenirajURed({ store, konfiguracija, granice: BRZE }),
    zatvori: async () => { store.zatvori(); await rm(baza, { recursive: true, force: true }); },
  };
}

const sha = async (ime) => createHash("sha256").update(await readFile(join(FIXTURES, ime))).digest("hex");

test("storno i knjižno odobrenje ulaze u red kao PDF; faktura ostaje canonical", async (t) => {
  if (guard(t)) return;
  const o = await okruzenje();
  try {
    await o.stavi("FAK 10 storno.pdf", "storno.pdf");
    await o.stavi("k.o sinteticki kupac 11.01.26.pdf", "knjizno-odobrenje.pdf");
    await o.stavi("FAK 1.pdf", "jedna-stavka.pdf");
    const z = await o.ciklus();
    assert.equal(z.novo, 3, JSON.stringify(z));
    const red = o.store.zaSlanje({ limit: 10, lokalniDatum: "2099-01-01" });
    const pdf = red.filter((s) => m.doc.isDeviceDocumentBody(s.telo));
    assert.equal(pdf.length, 2);
    const vrste = pdf.map((s) => JSON.parse(Buffer.from(s.telo).toString("utf8")).kind).sort();
    assert.deepEqual(vrste, ["knjizno_odobrenje", "storno"]);
    for (const s of pdf) {
      const telo = JSON.parse(Buffer.from(s.telo).toString("utf8"));
      assert.equal(m.doc.parseDeviceDocumentBody(telo).ok, true, "server bi prihvatio telo");
      assert.equal(s.semantic_hash, null);
    }
    assert.equal(red.filter((s) => !m.doc.isDeviceDocumentBody(s.telo)).length, 1, "faktura ostaje canonical");
  } finally {
    await o.zatvori();
  }
});

test("slanje bira putanju po telu; storno → /api/sync/document, odgovor `quarantined` je za pregled", async (t) => {
  if (guard(t)) return;
  const o = await okruzenje();
  try {
    await o.stavi("FAK 10 storno.pdf", "storno.pdf");
    await o.stavi("FAK 1.pdf", "jedna-stavka.pdf");
    await o.ciklus();
    const { privateKey } = generateKeyPairSync("ed25519");
    const putanje = [];
    const fetchImpl = async (url, init) => {
      const p = new URL(url).pathname;
      putanje.push(p);
      const telo = JSON.parse(Buffer.from(init.body).toString("utf8"));
      const code = p === "/api/sync/document" ? (telo.kind === "storno" ? "quarantined" : "ingested") : "ingested";
      return new Response(JSON.stringify({ ok: true, code, requestId: "r1" }), { status: 200, headers: { "content-type": "application/json" } });
    };
    const z = await m.pipeline.posaljiIzReda({
      store: o.store, konfiguracija: o.konfiguracija, lokalniDatum: "2026-11-12",
      kljuc: privateKey.export({ type: "pkcs8", format: "der" }), fetchImpl,
    });
    assert.deepEqual(putanje.sort(), ["/api/sync/document", "/api/sync/ingest"]);
    assert.equal(z.potvrdjeno, 1);
    assert.equal(z.zaPregled, 1);
  } finally {
    await o.zatvori();
  }
});

test("storno koji je 0.3.13 ostavio za ručni upload ponovo se čita i šalje — jednom", async (t) => {
  if (guard(t)) return;
  const o = await okruzenje();
  try {
    const put = await o.stavi("FAK 10 storno.pdf", "storno.pdf");
    o.store.dodajNepodrzano({ sourceHash: await sha("storno.pdf"), putanja: put, velicina: 1, razlog: m.pipeline.RAZLOG_STORNO });
    const prvi = await o.ciklus();
    assert.equal(prvi.novo, 1, "stari storno nije ponovo pročitan");
    assert.equal(o.store.zaSlanje({ limit: 10, lokalniDatum: "2099-01-01" }).length, 1);

    // Druga procena se ne ponavlja: nov podsetnik za ručni upload ostaje netaknut.
    o.store.dodajNepodrzano({ sourceHash: "f".repeat(64), putanja: put, velicina: 1, razlog: m.pipeline.RAZLOG_STORNO });
    await o.ciklus();
    assert.equal(o.store.brojPoRazlogu(m.pipeline.RAZLOG_STORNO), 1);
  } finally {
    await o.zatvori();
  }
});

test("posaljiOdDatuma i dalje važi: storno iz arhive se ne šalje", async (t) => {
  if (guard(t)) return;
  const o = await okruzenje({ posaljiOdDatuma: "2026-06-01" });
  try {
    await o.stavi("FAK 10 storno.pdf", "storno.pdf"); // datum 10.01.2026
    const z = await o.ciklus();
    assert.equal(z.novo, 0);
    assert.equal(z.nepodrzano, 1);
  } finally {
    await o.zatvori();
  }
});
