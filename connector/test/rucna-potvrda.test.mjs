import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

/**
 * Zatvaranje podsetnika za dokument koji je već ručno obrađen (npr. storno
 * Fak.1169.pdf otpremljen ručno). Testira izgrađen paket (dist), isti kod koji
 * ide na kancelarijski računar.
 */
const D = (p) => new URL(`../dist/connector/src/${p}`, import.meta.url).href;
const { otvoriStore } = await import(D("store.mjs"));
const { potvrdiRucno } = await import(D("cli.mjs"));
const IDENTITET = { origin: "https://carsystemirm.invalid", deviceCode: "KANC-01", sourceSystem: "biznisoft", issuerCode: "CSRM", contractVersion: 1 };
const sha = (b) => createHash("sha256").update(b).digest("hex");

async function priprema() {
  const baza = await mkdtemp(join(tmpdir(), "cs-rucno-"));
  const folder = join(baza, "Stanje ČĆŽ");
  const putanja = join(folder, "queue.db");
  const fajl1169 = join(baza, "Fak.1169.pdf");
  const fajlKasni = join(baza, "Fak.0999.pdf");
  await writeFile(fajl1169, "%PDF storno 1169");
  await writeFile(fajlKasni, "%PDF kasni izvoz");
  const store = otvoriStore({ putanja, identitet: IDENTITET });
  store.dodajNepodrzano({ sourceHash: sha("%PDF storno 1169"), putanja: fajl1169, velicina: 16, razlog: "storno_rucni_upload" });
  store.dodajNepodrzano({ sourceHash: sha("%PDF kasni izvoz"), putanja: fajlKasni, velicina: 16, razlog: "kasni_izvoz_rucna_provera" });
  const potvrdjena = store.dodajSpremno({ sourceHash: "a".repeat(64), putanja: join(baza, "x.pdf"), velicina: 1, telo: Buffer.from("{}"), semanticHash: "s" }).id;
  store.zavrsi({ id: potvrdjena, stanje: "potvrdjeno", serverKod: "imported" });
  store.zatvori();
  const p = { folder, baza: putanja, kljuc: join(folder, "device-key.bin"), log: join(folder, "log"), konfiguracija: join(folder, "config.json") };
  await writeFile(p.konfiguracija, JSON.stringify({ serverOrigin: IDENTITET.origin, deviceCode: "KANC-01", keyId: "k1", sourceSystem: "biznisoft", issuerCode: "CSRM", izvorniFolder: baza }));
  return { baza, putanja, p, fajl1169, otisak1169: sha("%PDF storno 1169") };
}

async function uhvati(fn) {
  const staro = process.stdout.write;
  const deo = [];
  process.stdout.write = (x) => (deo.push(String(x)), true);
  try {
    const kod = await fn();
    return { kod, izlaz: JSON.parse(deo.join("")) };
  } finally {
    process.stdout.write = staro;
  }
}

test("plan ne menja ništa; potvrda zatvara samo taj podsetnik, bez slanja i bez brisanja", async () => {
  const { baza, putanja, p, otisak1169 } = await priprema();
  try {
    const prefiks = otisak1169.slice(0, 12);
    const plan = await uhvati(() => potvrdiRucno(p, ["--otisak", prefiks]));
    assert.equal(plan.izlaz.status, "plan");
    assert.equal(plan.izlaz.fajl, "Fak.1169.pdf");
    assert.match(plan.izlaz.fajlNaDisku, /proveren/);
    let s = otvoriStore({ putanja, identitet: IDENTITET });
    assert.equal(s.stornaZaRucniUpload().length, 1, "plan ne zatvara podsetnik");
    s.zatvori();

    const r = await uhvati(() => potvrdiRucno(p, ["--otisak", `sd:${prefiks}`, "--napomena", "storno 26-1169 otpremljen 06.10.", "--potvrdi"], new Date("2026-10-09T08:00:00Z")));
    assert.equal(r.kod, 0);
    assert.equal(r.izlaz.status, "potvrdjeno");
    assert.equal(r.izlaz.poslato, false);
    assert.equal(r.izlaz.potvrdjeno, "2026-10-09T08:00:00.000Z");

    s = otvoriStore({ putanja, identitet: IDENTITET });
    assert.equal(s.stornaZaRucniUpload().length, 0, "storno podsetnik zatvoren");
    assert.equal(s.zaRucnuProveru().length, 1, "drugi podsetnik (kasni izvoz) ostaje");
    assert.equal(s.brojPoRazlogu("storno_rucni_upload"), 0);
    assert.equal(s.zbir().nepodrzano, 2, "stavka i njeno stanje ostaju u redu");
    assert.equal(s.zaSlanje({ limit: 50, lokalniDatum: "2026-10-09" }).length, 0, "ništa nije pripremljeno za slanje");
    assert.deepEqual(s.rucnePotvrde().map((x) => [x.ref, x.razlog, x.fajlProveren, x.napomena]), [[`sd:${prefiks}`, "storno_rucni_upload", true, "storno 26-1169 otpremljen 06.10."]]);
    // Zapis potvrde se ne menja i ne briše.
    assert.throws(() => s.db.prepare("UPDATE rucne_potvrde SET napomena = 'x'").run(), /samo dodaju/);
    assert.throws(() => s.db.prepare("DELETE FROM rucne_potvrde").run(), /samo dodaju/);
    s.zatvori();

    const opet = await uhvati(() => potvrdiRucno(p, ["--otisak", prefiks, "--potvrdi"]));
    assert.equal(opet.izlaz.status, "vec_potvrdjeno");
    assert.equal(opet.izlaz.potvrdjeno, "2026-10-09T08:00:00.000Z", "vreme prve potvrde ostaje");
  } finally {
    await rm(baza, { recursive: true, force: true });
  }
});

test("pogrešan, kratak ili nejedinstven otisak i izmenjen fajl se odbijaju bez upisa", async () => {
  const { baza, putanja, p, fajl1169, otisak1169 } = await priprema();
  try {
    assert.equal((await uhvati(() => potvrdiRucno(p, ["--otisak", "a7ba188d", "--potvrdi"]))).izlaz.kod, "otisak_neispravan");
    assert.equal((await uhvati(() => potvrdiRucno(p, ["--otisak", "0".repeat(12), "--potvrdi"]))).izlaz.kod, "nema_podsetnika");
    // Već poslata (potvrđena) stavka nije podsetnik i ne može se „zatvoriti“.
    assert.equal((await uhvati(() => potvrdiRucno(p, ["--otisak", "a".repeat(12), "--potvrdi"]))).izlaz.kod, "nema_podsetnika");
    await writeFile(fajl1169, "%PDF IZMENJEN");
    const r = await uhvati(() => potvrdiRucno(p, ["--otisak", otisak1169.slice(0, 12), "--potvrdi"]));
    assert.equal(r.izlaz.kod, "fajl_promenjen");
    const s = otvoriStore({ putanja, identitet: IDENTITET });
    assert.equal(s.rucnePotvrde().length, 0);
    assert.equal(s.stornaZaRucniUpload().length, 1);
    s.zatvori();
  } finally {
    await rm(baza, { recursive: true, force: true });
  }
});

test("fajla više nema na disku: potvrda je moguća i beleži da fajl nije proveren", async () => {
  const { baza, putanja, p, fajl1169, otisak1169 } = await priprema();
  try {
    await unlink(fajl1169);
    const r = await uhvati(() => potvrdiRucno(p, ["--otisak", otisak1169.slice(0, 16), "--potvrdi"]));
    assert.equal(r.izlaz.status, "potvrdjeno");
    assert.match(r.izlaz.fajlNaDisku, /nije na disku/);
    const s = otvoriStore({ putanja, identitet: IDENTITET });
    assert.equal(s.rucnePotvrde()[0].fajlProveren, false);
    s.zatvori();
  } finally {
    await rm(baza, { recursive: true, force: true });
  }
});
