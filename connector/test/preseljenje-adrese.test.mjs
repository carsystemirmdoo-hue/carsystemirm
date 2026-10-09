import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { STANJA } from "../src/outcomes.mjs";
import { otvoriStore, preseliIdentitetReda, StoreError } from "../src/store.mjs";

/**
 * Preseljenje reda na novu adresu ISTOG servera (pilot Preview → carsystemirm.com).
 * Potvrde poslatih faktura, neposlate stavke, komande i ključ ostaju; menja se
 * samo `origin` u identitetu, posle dosledne kopije reda.
 */
const STARI = { origin: "https://pilot.invalid", deviceCode: "KANC-01", sourceSystem: "biznisoft", issuerCode: "CSRM", contractVersion: 1 };
const NOVI = { ...STARI, origin: "https://carsystemirm.invalid" };

async function redSaStavkama() {
  const baza = await mkdtemp(join(tmpdir(), "cs-preseljenje-"));
  const putanja = join(baza, "Folder ČĆŽ", "queue.db");
  const store = otvoriStore({ putanja, identitet: STARI });
  const dodaj = (i) => store.dodajSpremno({ sourceHash: `h${i}`, putanja: `/x/${i}.pdf`, velicina: i, telo: Buffer.from(`{"i":${i}}`), semanticHash: `s${i}` }).id;
  const potvrdjene = [dodaj(1), dodaj(2), dodaj(3)];
  for (const id of potvrdjene) store.zavrsi({ id, stanje: STANJA.POTVRDJENO, serverKod: "imported", serverRef: `ref-${id}` });
  dodaj(4); // neposlata
  store.zatvori();
  return { baza, putanja, rezerva: join(baza, "rezerve", "queue-pre-preseljenja.db") };
}

test("pre preseljenja: nova adresa daje identity_mismatch (uzrok kvara na KANC-01)", async () => {
  const { baza, putanja } = await redSaStavkama();
  try {
    assert.throws(() => otvoriStore({ putanja, identitet: NOVI }), (e) => e instanceof StoreError && e.code === "identity_mismatch");
  } finally {
    await rm(baza, { recursive: true, force: true });
  }
});

test("plan bez --potvrdi ne menja ništa; potvrda menja samo origin, čuva potvrde i neposlate stavke", async () => {
  const { baza, putanja, rezerva } = await redSaStavkama();
  try {
    const plan = preseliIdentitetReda({ putanja, novi: NOVI, rezervaPutanja: rezerva, vlasnik: "test", potvrdi: false });
    assert.equal(plan.status, "plan");
    assert.deepEqual(plan.brojevi.poStanju, { [STANJA.POTVRDJENO]: 3, [STANJA.SPREMNO]: 1 });
    assert.ok(!existsSync(rezerva), "plan ne pravi kopiju");
    assert.throws(() => otvoriStore({ putanja, identitet: NOVI }), (e) => e.code === "identity_mismatch");

    const r = preseliIdentitetReda({ putanja, novi: NOVI, rezervaPutanja: rezerva, vlasnik: "test", potvrdi: true });
    assert.equal(r.status, "preseljeno");
    assert.deepEqual(r.brojevi, plan.brojevi, "brojevi pre i posle su isti");

    // Rezervna kopija je dosledna i nosi STARI identitet.
    const k = new DatabaseSync(rezerva, { readOnly: true });
    assert.equal(k.prepare("SELECT vrednost FROM meta WHERE kljuc='identitet'").get().vrednost, JSON.stringify(STARI));
    assert.equal(k.prepare("SELECT count(*) AS n FROM stavke").get().n, 4);
    k.close();

    // Red se sada otvara sa NOVOM adresom; potvrđene se ne šalju ponovo, neposlata ostaje.
    const s = otvoriStore({ putanja, identitet: NOVI });
    const zaSlanje = s.zaSlanje({ limit: 50, lokalniDatum: "2026-10-09" });
    assert.equal(zaSlanje.length, 1);
    assert.equal(s.zbir()[STANJA.POTVRDJENO], 3);
    assert.ok(Object.keys(Object.fromEntries(s.db.prepare("SELECT kljuc, vrednost FROM meta").all().map((x) => [x.kljuc, x.vrednost]))).some((x) => x.startsWith("preseljenje_")));
    s.zatvori();
    // Stara adresa više ne prolazi (nema dvostrukog identiteta).
    assert.throws(() => otvoriStore({ putanja, identitet: STARI }), (e) => e.code === "identity_mismatch");

    // Ponovno pokretanje je bezopasno.
    assert.equal(preseliIdentitetReda({ putanja, novi: NOVI, rezervaPutanja: rezerva + "2", vlasnik: "test", potvrdi: true }).status, "vec_preseljeno");
  } finally {
    await rm(baza, { recursive: true, force: true });
  }
});

test("razlika osim adrese (uređaj, izdavalac) se odbija bez ikakve izmene", async () => {
  const { baza, putanja, rezerva } = await redSaStavkama();
  try {
    for (const drugo of [{ ...NOVI, deviceCode: "DRUGI" }, { ...NOVI, issuerCode: "CS01" }]) {
      assert.throws(() => preseliIdentitetReda({ putanja, novi: drugo, rezervaPutanja: rezerva, vlasnik: "test", potvrdi: true }), (e) => e.code === "identity_mismatch");
    }
    assert.ok(!existsSync(rezerva));
    otvoriStore({ putanja, identitet: STARI }).zatvori();
  } finally {
    await rm(baza, { recursive: true, force: true });
  }
});

test("dok ciklus drži bravu, preseljenje se odbija i red ostaje netaknut", async () => {
  const { baza, putanja, rezerva } = await redSaStavkama();
  try {
    const s = otvoriStore({ putanja, identitet: STARI });
    assert.equal(s.uzmiZakljucavanje({ vlasnik: "ciklus" }).uzeto, true);
    assert.throws(() => preseliIdentitetReda({ putanja, novi: NOVI, rezervaPutanja: rezerva, vlasnik: "preseljenje", potvrdi: true }), (e) => e.code === "locked");
    s.otpustiZakljucavanje("ciklus");
    s.zatvori();
    assert.ok(!existsSync(rezerva));
    otvoriStore({ putanja, identitet: STARI }).zatvori();
  } finally {
    await rm(baza, { recursive: true, force: true });
  }
});

test("komanda preseli-adresu: bez prihvaćenog potpisanog zahteva na novoj adresi ne menja ništa", async () => {
  const { writeFile, readdir } = await import("node:fs/promises");
  // Kao ostali testovi komandi: iz izgrađenog paketa (dist), isti kod koji ide na računar.
  const { preseliAdresu } = await import(new URL("../dist/connector/src/cli.mjs", import.meta.url).href);
  const { otvoriStore: otvoriDist } = await import(new URL("../dist/connector/src/store.mjs", import.meta.url).href);
  const { baza, putanja } = await redSaStavkama();
  const folder = join(baza, "Folder ČĆŽ");
  const p = { folder, baza: putanja, kljuc: join(folder, "device-key.bin"), log: join(folder, "log"), konfiguracija: join(folder, "config.json") };
  await writeFile(p.konfiguracija, JSON.stringify({
    serverOrigin: NOVI.origin, deviceCode: "KANC-01", keyId: "k1", sourceSystem: "biznisoft", issuerCode: "CSRM", izvorniFolder: folder,
  }));
  const pisanje = process.stdout.write;
  const ispis = [];
  process.stdout.write = (x) => (ispis.push(String(x)), true);
  try {
    const poslato = [];
    const odbij = async (u) => (poslato.push(u.origin), { httpStatus: 401, code: "unauthorized" });
    assert.equal(await preseliAdresu(p, { potvrdi: true, posalji: odbij, ucitajKljuc: async () => Buffer.alloc(0) }), 1);
    assert.deepEqual(poslato, [NOVI.origin], "dokaz se traži na NOVOJ adresi");
    assert.ok(!existsSync(join(folder, "rezerve")), "odbijeno: nema kopije ni izmene");
    assert.throws(() => otvoriDist({ putanja, identitet: NOVI }), (e) => e.code === "identity_mismatch");

    const prihvati = async () => ({ httpStatus: 200, code: "acknowledged" });
    assert.equal(await preseliAdresu(p, { potvrdi: true, posalji: prihvati, ucitajKljuc: async () => Buffer.alloc(0) }), 0);
    const rez = await readdir(join(folder, "rezerve"));
    assert.ok(rez.some((f) => /^queue-pre-preseljenja-.*\.db$/.test(f)) && rez.some((f) => /^config-pre-preseljenja-.*\.json$/.test(f)));
    otvoriDist({ putanja, identitet: NOVI }).zatvori();
    assert.match(ispis.join(""), /"status": "preseljeno"/);
  } finally {
    process.stdout.write = pisanje;
    await rm(baza, { recursive: true, force: true });
  }
});
