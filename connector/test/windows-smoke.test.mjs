import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

/**
 * Windows smoke test nad SPAKOVANIM konektorom.
 *
 * Skoro svi testovi ovde dokazuju ono što macOS/Linux prolaz ne može: stvarni
 * DPAPI `Protect`/`Unprotect` pod predviđenim nalogom, Windows putanje,
 * zaključavanje fajla drugim procesom i registraciju zadatka. VAN WINDOWS-a se
 * ti testovi preskaču sa izričitim razlogom. Prolaz na drugoj platformi NIJE
 * zamena i ne sme se tako prikazati u izveštaju.
 *
 * JEDINI izuzetak je grupa „W13 poziv" ispod — čista statička provera
 * IZVORNOG teksta `run-smoke.mjs`-a, bez pokretanja ičega. Izvršava se SVUDA
 * (uključujući dirty macOS stablo, bez build-a), jer `connector:build` nije
 * potreban da bi se pročitao tekst fajla.
 */

const naWindowsu = process.platform === "win32";
const RAZLOG = `Zahteva Windows; tekuća platforma je ${process.platform}. NIJE IZVRŠENO.`;

const guard = (t) => {
  if (!naWindowsu) {
    t.skip(RAZLOG);
    return true;
  }
  return false;
};

/** Ocena poziva .ps1: tačan izlaz + oznaka skripte, vreme za poređenje sa antivirusom. */
const { oceniPozivSkripte } = await import(new URL("./task-poziv.mjs", import.meta.url).href);

const D = (p) => new URL(`../dist/connector/src/${p}`, import.meta.url).href;

/**
 * Bezbedan sažetak PowerShell greške: identifikator, kategorija, skripta i red.
 *
 * Bez poruke i bez putanje — poruka može da nosi korisničko ime iz putanje
 * paketa. Isti oblik koristi `run-smoke.mjs` u `W13`.
 */
function powershellSazetak(tekst) {
  const id = /FullyQualifiedErrorId\s*:\s*([A-Za-z0-9_.,-]+)/.exec(tekst)?.[1];
  const kategorija = /CategoryInfo\s*:\s*([A-Za-z]+)/.exec(tekst)?.[1];
  const mesto = /[\\/]([A-Za-z0-9_-]+\.ps1):(\d+)\s+char:(\d+)/.exec(tekst);
  const delovi = [
    id && `id=${id}`,
    kategorija && `kategorija=${kategorija}`,
    mesto && `mesto=${mesto[1]}:${mesto[2]}:${mesto[3]}`,
  ].filter(Boolean);
  return delovi.length > 0 ? delovi.join(" ") : "bez PowerShell identifikatora greške";
}

/* =========================================================================
 * W13 poziv — statička provera IZVORNOG run-smoke.mjs, cross-platform.
 *
 * WIN-INSTALL-01 korekcija je učinila `-Mode` obaveznim za
 * `task.ps1 -Action install`. W13 je jedini poziv `task.ps1` u smoke toku;
 * ako mu nedostaje `-Mode`, `task.ps1` baca grešku PRE [dry-run] izlaza koji
 * W13 očekuje, i pravi Windows smoke nikad ne bi mogao da dostigne
 * `SMOKE PASS`. Ovaj test pregleda TAČNO `W13_TASK_ARGS` — imenovanu,
 * usku konstantu u `run-smoke.mjs` — ne ceo tekst fajla, jer komentari i
 * sažeci legitimno pominju "-Apply"/"Production" bez da ih pozivaju.
 *
 * `run-smoke.mjs` živi na DVA različita mesta u zavisnosti od konteksta:
 * `connector/smoke/run-smoke.mjs` u izvornom stablu, ali `smoke/run-smoke.mjs`
 * (koren paketa, van `connector/`) u spakovanom paketu — `package-smoke.mjs`
 * ga namerno premešta tamo (`cilj: "smoke/run-smoke.mjs"`). Test mora naći
 * pravi fajl u OBA konteksta, jer se paketovana kopija ovog istog test fajla
 * pokreće iz raspakovanog paketa.
 * ====================================================================== */

function pronadjiRunSmoke() {
  const kandidati = [
    new URL("../smoke/run-smoke.mjs", import.meta.url), // izvorno stablo
    new URL("../../smoke/run-smoke.mjs", import.meta.url), // spakovan paket (koren)
  ];
  for (const url of kandidati) {
    const p = fileURLToPath(url);
    if (existsSync(p)) return p;
  }
  throw new Error("run-smoke.mjs nije nađen ni u izvornom stablu ni u spakovanom rasporedu paketa.");
}

test("W13 poziva task.ps1 sa -Action install i -Mode Smoke, nikad -Apply ili Production", async () => {
  const tekst = await readFile(pronadjiRunSmoke(), "utf8");

  const m = tekst.match(/const W13_TASK_ARGS = (\[[^\]]*\]);/);
  assert.ok(m, "W13_TASK_ARGS niz argumenata nije nađen — da li je W13 preimenovan ili restrukturiran?");
  const argsNiz = m[1];

  assert.match(argsNiz, /["'`]-Action["'`]/, "W13 poziv ne sadrži -Action");
  assert.match(argsNiz, /["'`]install["'`]/, "W13 poziv ne sadrži 'install'");
  assert.match(
    argsNiz,
    /["'`]-Mode["'`]/,
    "W13 poziv NE sadrži -Mode — task.ps1 sada zahteva -Mode za -Action install i baciće grešku pre [dry-run] izlaza",
  );
  assert.match(argsNiz, /["'`]Smoke["'`]/, "W13 poziv ne sadrži 'Smoke' kao vrednost moda");
  assert.doesNotMatch(argsNiz, /["'`]Production["'`]/, "W13 poziv koristi Production mod — mora ostati Smoke");
  assert.doesNotMatch(argsNiz, /["'`]-Apply["'`]/, "W13 poziv sadrži -Apply — dry-run test ne sme praviti stvarnu izmenu");
  assert.match(argsNiz, /["'`]-PackagePath["'`],\s*DIST\b/, "W13 poziv ne cilja spakovan DIST folder");
});

/* =========================================================================
 * DPAPI
 * ====================================================================== */

/* =========================================================================
 * Ručne provere su IZVAN [WIN] skupa — statička provera, cross-platform.
 *
 * Kancelarijski smoke 45a3460 je imao dva `[WIN]` testa koji sami sebe
 * bezuslovno preskaču, a `W15-win` je dozvoljavao najviše jedan preskok.
 * Automatski prolaz tako nije mogao da bude `SMOKE PASS` ni na ispravnoj
 * mašini. Ručne provere sada žive u runneru i prijavljuju se odvojeno.
 * ====================================================================== */

test("nijedan [WIN] test ne preskače sam sebe bezuslovno", async () => {
  const tekst = await readFile(fileURLToPath(import.meta.url), "utf8");
  const obrazac = new RegExp("if \\(guard\\(t\\)\\) return;\\s*t\\." + "skip\\(");
  assert.doesNotMatch(tekst, obrazac, "ručna provera je ponovo maskirana kao [WIN] test");
});

test("runner prijavljuje ručne provere kao MANUAL_NOT_EXECUTED i ne dozvoljava [WIN] preskok", async () => {
  const tekst = await readFile(pronadjiRunSmoke(), "utf8");
  assert.match(tekst, /const RUCNO_NIJE_IZVRSENO = "MANUAL_NOT_EXECUTED";/);
  for (const id of ["RUCNO-DPAPI-NALOG", "RUCNO-TASK-APPLY"]) {
    assert.match(tekst, new RegExp(`id: "${id}"`), `nedostaje ručna provera ${id}`);
  }
  // Ručne provere se nikad ne izvršavaju kroz `provera(...)`.
  assert.doesNotMatch(tekst, /^provera\("RUCNO-/m);

  const w15win = tekst.slice(tekst.indexOf('provera("W15-win"'), tekst.indexOf("Rezultat\n"));
  assert.match(w15win, /preskoceniWin > 0/, "W15-win ponovo toleriše preskočen [WIN] test");
  assert.doesNotMatch(w15win, /preskoceniWin > 1/);
  // Ručne provere su u oba izveštaja.
  assert.match(tekst, /## Ručne provere — NISU izvršene/);
  assert.match(tekst, /rucneProvere: RUCNE_PROVERE\.map/);
});

/* =========================================================================
 * Kodiranje PowerShell skripti — statička provera, cross-platform.
 *
 * Kancelarijski smoke 45a3460: `task.ps1` je u PODRAZUMEVANOM dry-run režimu
 * izlazio sa 1 na Windows PowerShell 5.1, uz ispravnu politiku izvršavanja.
 *
 * Uzrok: skripta je UTF-8 BEZ BOM-a, a sadrži `—`, `ž`, `č`. Windows PowerShell
 * 5.1 takav fajl čita u ANSI kodnoj strani (cp1250/cp1252). Poslednji bajt
 * crte `—` (E2 80 94) tamo postaje `”` (U+201D), koji PowerShell tokenizer
 * prihvata kao ZAVRŠNI navodnik — pa `throw "Ne postoji $exe — proveri"`
 * prekida string usred poruke i cela skripta pada na parsiranju, pre ijedne
 * provere. PowerShell 7 čita UTF-8 podrazumevano, zato se ovo ne vidi van
 * Windows PowerShell-a.
 *
 * Ugovor: svaka `.ps1` skripta počinje UTF-8 BOM-om. Tada i 5.1 i 7 čitaju isti
 * tekst, bez obzira na jezik sistema.
 * ====================================================================== */

const SKRIPTE_DIR = fileURLToPath(new URL("../windows/", import.meta.url));
const BOM = Buffer.from([0xef, 0xbb, 0xbf]);

test("vektor je stvaran: `—` u ANSI kodnoj strani postaje navodnik", () => {
  for (const kodna of ["windows-1250", "windows-1252"]) {
    const tekst = new TextDecoder(kodna).decode(Buffer.from('"a — b"', "utf8"));
    assert.ok(tekst.includes("\u201d"), `${kodna}: vektor nije reprodukovan`);
  }
});

test("svaka .ps1 skripta počinje UTF-8 BOM-om", async () => {
  const { readdir } = await import("node:fs/promises");
  const skripte = (await readdir(SKRIPTE_DIR)).filter((f) => f.endsWith(".ps1"));
  assert.ok(skripte.includes("task.ps1") && skripte.includes("PathGuards.ps1"));

  const bezBoma = [];
  for (const ime of skripte) {
    const bajtovi = await readFile(join(SKRIPTE_DIR, ime));
    if (!bajtovi.subarray(0, 3).equals(BOM)) bezBoma.push(ime);
  }
  assert.deepEqual(bezBoma, [], `bez BOM-a (5.1 ih čita kao ANSI): ${bezBoma.join(", ")}`);
});

test("bez BOM-a nijedna .ps1 skripta ne bi čitala isti tekst u ANSI kodnoj strani", async () => {
  /*
   * Kontrola ugovora iznad: pokazuje da BOM ovde NIJE kozmetika. Svaka skripta
   * koja ima ne-ASCII znak menja značenje kada se pročita kao cp1250 — i bar
   * `task.ps1` i `PathGuards.ps1` time dobijaju „pametne“ navodnike u kodu.
   */
  const { readdir } = await import("node:fs/promises");
  const pogodjene = [];
  for (const ime of (await readdir(SKRIPTE_DIR)).filter((f) => f.endsWith(".ps1"))) {
    let bajtovi = await readFile(join(SKRIPTE_DIR, ime));
    if (bajtovi.subarray(0, 3).equals(BOM)) bajtovi = bajtovi.subarray(3);
    const ansi = new TextDecoder("windows-1250").decode(bajtovi);
    if (/[\u201c\u201d\u201e]/.test(ansi)) pogodjene.push(ime);
  }
  assert.ok(pogodjene.includes("task.ps1"), "task.ps1 više nema vektor — proveriti da li je test i dalje potreban");
  assert.ok(pogodjene.includes("PathGuards.ps1"));
});

test("[WIN] DPAPI Protect/Unprotect vraća isti ključ", async (t) => {
  if (guard(t)) return;
  const dpapi = await import(D("keystore/windows-dpapi.mjs"));
  assert.equal(dpapi.dostupan(), true);

  const baza = await mkdtemp(join(tmpdir(), "cs-dpapi-"));
  try {
    const { privateKey } = generateKeyPairSync("ed25519");
    const pkcs8 = new Uint8Array(privateKey.export({ type: "pkcs8", format: "der" }));
    const p = join(baza, "device-key.bin");

    await dpapi.sacuvaj({ putanja: p, privateKeyPkcs8Der: pkcs8 });
    const nazad = await dpapi.ucitaj({ putanja: p });
    assert.deepEqual(Buffer.from(nazad), Buffer.from(pkcs8), "ključ se ne vraća isti");

    /*
     * Fajl NE SME sadržati ključ u čitljivom obliku.
     *
     * DPAPI izlaz je base64 šifrovanog sadržaja; da se negde upisao plaintext,
     * ovde bi se pojavio isti base64 kao materijal ključa.
     */
    const { readFile } = await import("node:fs/promises");
    const sadrzaj = await readFile(p, "utf8");
    assert.doesNotMatch(
      sadrzaj,
      new RegExp(Buffer.from(pkcs8).toString("base64").slice(0, 32).replace(/[+/]/g, "\\$&")),
      "privatni ključ je u fajlu u čitljivom obliku",
    );
  } finally {
    await rm(baza, { recursive: true, force: true });
  }
});

test("[WIN] DPAPI bez procesa-deteta: nativni modul, tajna ne prolazi kroz komandnu liniju", async (t) => {
  if (guard(t)) return;
  const { readFile } = await import("node:fs/promises");
  const izvor = await readFile(
    new URL("../dist/connector/src/keystore/windows-dpapi.mjs", import.meta.url),
    "utf8",
  );
  const kod = izvor.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  /*
   * DPAPI ide kroz nativni modul u procesu konektora (Avast blokira
   * „PowerShell + ProtectedData"). Nema `powershell.exe`, nema stdin-a, nema
   * argumenata sa podatkom — nema procesa-deteta uopšte.
   */
  assert.match(kod, /process\.dlopen/);
  assert.doesNotMatch(kod, /child_process|spawn|powershell|EncodedCommand|ProtectedData/i);
});

test("[WIN] nativni modul: SHA-256, učitavanje, zastiti/otkljucaj i odbijanje izmenjenog bloba", async (t) => {
  if (guard(t)) return;
  const dpapi = await import(D("keystore/windows-dpapi.mjs"));
  const { createHash } = await import("node:crypto");
  const { readFile } = await import("node:fs/promises");
  const sha = createHash("sha256").update(await readFile(dpapi.NATIVNI_MODUL)).digest("hex");
  assert.equal(sha, dpapi.NATIVNI_MODUL_SHA256, "modul u paketu nije isporučena verzija");
  const v = await dpapi.ucitajNativni();
  assert.equal(typeof v.protectData, "function");

  /*
   * Podatak je sintetička konstanta. Isto što D05/D06 mere na kancelarijskom
   * računaru, kroz stvarni `dpapiOperacija`.
   */
  const podatak = Buffer.from("cs-kanal-proba-sinteticki");
  const blob = Buffer.from(await dpapi.dpapiOperacija("zastiti", podatak));
  assert.ok(!blob.includes(podatak), "blob sadrži čitljiv podatak");
  const nazad = await dpapi.dpapiOperacija("otkljucaj", blob);
  assert.deepEqual(Buffer.from(nazad), podatak, "DPAPI nije vratio isti podatak");

  blob[blob.length - 1] ^= 0xff;
  await assert.rejects(dpapi.dpapiOperacija("otkljucaj", blob), (e) => {
    assert.match(e.code, /^dpapi_unprotect_failed(_[0-9a-f]{8})?$/);
    assert.doesNotMatch(e.message, /[A-Za-z]:\\|Error code/);
    return true;
  });

  // proveri() — Protect i Unprotect nad konstantom.
  const rez = await dpapi.proveri();
  assert.equal(rez.ok, true);
  assert.equal(rez.kanal, "nativni");
});

test("[WIN] init dva puta: isti otisak, ključ nigde u izlazu", async (t) => {
  if (guard(t)) return;
  const cmd = fileURLToPath(new URL("../dist/connector.cmd", import.meta.url));
  const baza = await mkdtemp(join(tmpdir(), "cs-win-init-"));
  const env = {
    ...process.env,
    CS_CONNECTOR_STATE_DIR: join(baza, "stanje"),
    CS_CONNECTOR_CONFIG: join(baza, "nema-konfiguracije.json"),
  };
  const pokreni = (...args) => {
    const r = spawnSync("cmd.exe", ["/c", cmd, ...args], { encoding: "utf8", env, timeout: 120_000 });
    let json = {};
    try {
      json = JSON.parse(r.stdout ?? "");
    } catch {
      /* izlaz se ne prepisuje u poruku testa — mogao bi da nosi putanju */
    }
    return { kod: r.status, izlaz: `${r.stdout ?? ""}${r.stderr ?? ""}`, json };
  };

  try {
    const prvi = pokreni("init");
    const d1 = prvi.json;
    assert.equal(prvi.kod, 0, `init nije uspeo: kod=${d1.kod ?? "?"}`);
    assert.equal(d1.status, "napravljen");
    assert.match(d1.adapter, /dpapi/);

    const drugi = pokreni("init");
    assert.equal(drugi.json.status, "vec_postoji", "ponovljen init je zamenio ključ");
    assert.equal(drugi.kod, 1);

    // export-key čita ključ nazad kroz Unprotect (nativni DPAPI).
    const izvoz = pokreni("export-key");
    const d3 = izvoz.json;
    assert.equal(izvoz.kod, 0, `export-key nije uspeo: kod=${d3.kod ?? "?"}`);
    assert.equal(d3.fingerprint, d1.fingerprint, "otisak se promenio između poziva");

    /*
     * Nijedan izlaz ne nosi privatni materijal. Javni ključ (SPKI) sme da se
     * pojavi — on se predaje za registraciju — i zato se izuzima po vrednosti.
     */
    for (const [ime, r] of [["init", prvi], ["init ponovo", drugi], ["export-key", izvoz]]) {
      const bezJavnog = r.izlaz.split(d1.javniKljucSpkiBase64).join("").split(d1.fingerprint).join("");
      assert.doesNotMatch(bezJavnog, /-----BEGIN/, `${ime}: PEM u izlazu`);
      assert.doesNotMatch(bezJavnog, /[A-Za-z0-9+/]{40,}={0,2}/, `${ime}: dugačak base64 u izlazu`);
      assert.doesNotMatch(bezJavnog, /[A-Za-z]:\\|file:[/]{3}/, `${ime}: putanja u izlazu`);
      assert.doesNotMatch(bezJavnog, /\n\s+at\s/, `${ime}: stack trace u izlazu`);
    }

    const fajl = await readFile(join(baza, "stanje", "device-key.bin"), "utf8");
    assert.match(fajl, /^cs-dpapi-v1\n/, "fajl ključa nije u DPAPI obliku");
    assert.doesNotMatch(fajl, /BEGIN [A-Z ]*PRIVATE KEY/);
  } finally {
    await rm(baza, { recursive: true, force: true });
  }
});

/* =========================================================================
 * Windows putanje i zaključavanje
 * ====================================================================== */

test("[WIN] putanja sa razmacima, srpskim slovima i UNC oblikom", async (t) => {
  if (guard(t)) return;
  const skener = await import(D("scanner.mjs"));
  const { mkdir, cp } = await import("node:fs/promises");

  const baza = await mkdtemp(join(tmpdir(), "cs-win-"));
  try {
    const folder = join(baza, "Moj Folder ČĆŽŠĐ", "fakture ulaz");
    await mkdir(folder, { recursive: true });
    await cp(
      fileURLToPath(new URL("../../fixtures/dev/biznisoft/vise-stavki.pdf", import.meta.url)),
      join(folder, "Faktura 42.PDF"),
    );
    // PDF bez oznake fakture u istom folderu — na Windowsu se takođe ne uzima.
    await cp(
      fileURLToPath(new URL("../../fixtures/dev/biznisoft/jedna-stavka.pdf", import.meta.url)),
      join(folder, "Račun 43.PDF"),
    );

    const { koren } = await skener.proveriIzvor(folder);
    const { kandidati, folderi } = await skener.nadjiKandidate(koren);
    assert.equal(kandidati.length, 1);
    assert.ok(kandidati[0].putanja.endsWith("Faktura 42.PDF"));
    assert.equal(folderi[0].nijeFakturaPoNazivu, 1);

    /*
     * UNC / mrežni disk NIJE proglašen podržanim.
     *
     * Nije testiran, i ponašanje pri prekidu mreže se razlikuje od lokalnog
     * diska. Dok test ne postoji, dokumentacija ga vodi kao neproveren.
     */
  } finally {
    await rm(baza, { recursive: true, force: true });
  }
});

test("[WIN] junction ka putanji van korena NIJE praćen", async (t) => {
  if (guard(t)) return;
  const skener = await import(D("scanner.mjs"));
  const { mkdir, cp } = await import("node:fs/promises");
  const { execFileSync: exec } = await import("node:child_process");

  const baza = await mkdtemp(join(tmpdir(), "cs-win-junction-"));
  try {
    const koren = join(baza, "FAKTURE");
    const spolja = join(baza, "TUDJE");
    await mkdir(join(koren, "FAKTURE 2026"), { recursive: true });
    await mkdir(spolja, { recursive: true });

    const uzorak = fileURLToPath(
      new URL("../../fixtures/dev/biznisoft/vise-stavki.pdf", import.meta.url),
    );
    await cp(uzorak, join(koren, "FAKTURE 2026", "FAK nasa.pdf"));
    await cp(uzorak, join(spolja, "FAK tudja.pdf"));

    /*
     * `mklink /J` pravi junction — Windows reparse tačku koja ne traži
     * administratorska prava, za razliku od `/D` symlinka.
     *
     * Ovo je stvarni oblik koji bi na kancelarijskom računaru mogao da uvuče
     * tuđi folder u arhivu: neko napravi „prečicu" ka mrežnom disku unutar
     * `FAKTURE`, i skener bez provere počne da čita nešto što niko nije odobrio.
     */
    let junctionNapravljen = true;
    try {
      exec("cmd.exe", ["/c", "mklink", "/J", join(koren, "PRECICA"), spolja], {
        encoding: "utf8",
      });
    } catch {
      junctionNapravljen = false;
    }
    if (!junctionNapravljen) {
      t.skip("mklink /J nije uspeo na ovoj mašini; junction nije napravljen.");
      return;
    }

    const { koren: razresen } = await skener.proveriIzvor(koren);
    const { kandidati, preskoceno } = await skener.nadjiKandidate(razresen);
    const imena = kandidati.map((k) => k.putanja.split("\\").pop());

    assert.deepEqual(imena, ["FAK nasa.pdf"], "junction je uvukao dokument van korena");
    assert.ok(
      preskoceno.some((x) => x.razlog === "podfolder_symlink" || x.razlog === "podfolder_van_korena"),
      "junction nije prijavljen kao preskočen",
    );
  } finally {
    await rm(baza, { recursive: true, force: true });
  }
});

test("[WIN] fajl koji drži drugi proces se ODLAŽE, ne gubi", async (t) => {
  if (guard(t)) return;
  const skener = await import(D("scanner.mjs"));
  const { mkdir, writeFile } = await import("node:fs/promises");
  const { open } = await import("node:fs/promises");

  const baza = await mkdtemp(join(tmpdir(), "cs-lock-"));
  try {
    const folder = join(baza, "ulaz");
    await mkdir(folder, { recursive: true });
    const p = join(folder, "zauzet.pdf");
    await writeFile(p, "%PDF-1.4 test");

    /*
     * Na Windowsu otvoren fajl bez `FILE_SHARE_READ` daje `EBUSY`/`EPERM`.
     * Ishod mora biti `zakljucan` (odlaganje), ne trajna greška.
     */
    const drzi = await open(p, "r+");
    try {
      const rez = await skener.procitajStabilno(p, {
        stabilnostMs: 1,
        stabilnostPokusaja: 2,
        maxBajtova: 1024,
        maxNovihPoCiklusu: 5,
      });
      // Na nekim konfiguracijama čitanje ipak uspe; oba ishoda su prihvatljiva,
      // ali trajna greška nije.
      assert.ok(
        rez.ok === true || ["zakljucan", "nestabilan"].includes(rez.razlog),
        `neočekivan ishod: ${JSON.stringify(rez)}`,
      );
    } finally {
      await drzi.close();
    }
  } finally {
    await rm(baza, { recursive: true, force: true });
  }
});

/* =========================================================================
 * Red i restart
 * ====================================================================== */

test("[WIN] red preživljava restart procesa na Windows fajl sistemu", async (t) => {
  if (guard(t)) return;
  const { otvoriStore } = await import(D("store.mjs"));
  const { mkdir } = await import("node:fs/promises");

  const baza = await mkdtemp(join(tmpdir(), "cs-win-red-"));
  try {
    const folder = join(baza, "Stanje ČĆŽ");
    await mkdir(folder, { recursive: true });
    const putanja = join(folder, "queue.db");
    const identitet = {
      origin: "https://qa.invalid",
      deviceCode: "win-pc",
      sourceSystem: "biznisoft",
      issuerCode: "QA01",
      contractVersion: 1,
    };

    const prvi = otvoriStore({ putanja, identitet });
    prvi.dodajSpremno({
      sourceHash: "h", putanja: "C:\\Fakture\\a.pdf", velicina: 1,
      telo: Buffer.from("{}"), semanticHash: "s",
    });
    prvi.zatvori();

    const drugi = otvoriStore({ putanja, identitet });
    try {
      assert.equal(drugi.zaSlanje({ lokalniDatum: "2026-03-10" }).length, 1);
    } finally {
      drugi.zatvori();
    }
  } finally {
    await rm(baza, { recursive: true, force: true });
  }
});

/* =========================================================================
 * Autostart
 * ====================================================================== */

test("[WIN] skripta zadatka je podrazumevano dry-run (Smoke)", async (t) => {
  if (guard(t)) return;
  const skripta = fileURLToPath(new URL("../windows/task.ps1", import.meta.url));

  /*
   * BEZ `-Apply` — ne sme napraviti nijednu trajnu izmenu na sistemu.
   *
   * Izlaz mora nositi `[dry-run]`, i posle poziva zadatak ne sme postojati.
   * `-Mode Smoke` je obavezan od WIN-INSTALL-01 korekcije — bez njega skripta
   * baca grešku pre bilo koje provere.
   */
  const pocetak = new Date();
  const r = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", skripta,
     "-Action", "install", "-Mode", "Smoke", "-PackagePath", fileURLToPath(new URL("../dist/", import.meta.url))],
    { encoding: "utf8", timeout: 120_000 },
  );
  /*
   * Izlaz TAČNO 0 i oznaka `[dry-run]` koju piše skripta. Vreme i izlazni kod
   * idu u TAP dijagnostiku, da se prijava antivirusa poveže sa pozivom.
   */
  const o = oceniPozivSkripte({
    kod: r.status, signal: r.signal, stdout: r.stdout, stderr: r.stderr,
    ocekivanKod: 0, oznaka: /\[dry-run\]/, pocetak, kraj: new Date(),
  });
  t.diagnostic(`task.ps1 dry-run: ${o.detalj}`);
  assert.equal(o.ishod, "ok", `task.ps1 dry-run: ${o.kod}; ${o.detalj}; ${powershellSazetak(`${r.stdout}${r.stderr}`)}`);

  const postoji = execFileSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command",
     "if (Get-ScheduledTask -TaskName CarsystemConnectorSMOKE -TaskPath '\\Carsystem\\' -ErrorAction SilentlyContinue) { 'DA' } else { 'NE' }"],
    { encoding: "utf8" },
  ).trim();
  assert.equal(postoji, "NE", "dry-run je registrovao zadatak");
});

test("[WIN] install bez -Mode se odbija pre bilo koje provere", async (t) => {
  if (guard(t)) return;
  const skripta = fileURLToPath(new URL("../windows/task.ps1", import.meta.url));
  const pocetak = new Date();
  const r = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", skripta,
     "-Action", "install", "-PackagePath", fileURLToPath(new URL("../dist/", import.meta.url))],
    { encoding: "utf8", timeout: 120_000 },
  );
  /*
   * Odbijanje mora biti BAŠ ono zbog `-Mode`: izlaz TAČNO 1 (neuhvaćen
   * `throw` u -File režimu) i poruka skripte. Golo „nenulti izlaz" bi prošlo
   * i kada proces prekine antivirus (kancelarija d5e03d1).
   */
  const o = oceniPozivSkripte({
    kod: r.status, signal: r.signal, stdout: r.stdout, stderr: r.stderr,
    ocekivanKod: 1, oznaka: /-Mode je obavezan/, pocetak, kraj: new Date(),
  });
  t.diagnostic(`task.ps1 bez -Mode: ${o.detalj}`);
  assert.equal(o.ishod, "ok", `task.ps1 bez -Mode: ${o.kod}; ${o.detalj}; ${powershellSazetak(`${r.stdout}${r.stderr}`)}`);
});

/* =========================================================================
 * Paket
 * ====================================================================== */

test("[WIN] spakovan konektor se pokreće preko connector.cmd", async (t) => {
  if (guard(t)) return;
  const cmd = fileURLToPath(new URL("../dist/connector.cmd", import.meta.url));
  const izlaz = execFileSync("cmd.exe", ["/c", cmd, "--help"], { encoding: "utf8" });
  assert.match(izlaz, /Carsystem konektor/);
});

test("[WIN] connector.cmd vraća izlazni kod konektora, ne nulu", async (t) => {
  if (guard(t)) return;
  const cmd = fileURLToPath(new URL("../dist/connector.cmd", import.meta.url));
  /*
   * `endlocal` uspeva uvek, pa je batch fajl bez `exit /b` vraćao 0 i kad je
   * konektor pao. Task Scheduler čita upravo taj kod. Nepoznata komanda daje 2
   * — najjeftiniji nenulti kod koji ne dodiruje ni ključ ni red.
   */
  const r = spawnSync("cmd.exe", ["/c", cmd, "ova-komanda-ne-postoji"], { encoding: "utf8" });
  assert.equal(r.status, 2, `pokretač je progutao izlazni kod: dobijeno ${r.status}`);

  const ok = spawnSync("cmd.exe", ["/c", cmd, "--help"], { encoding: "utf8" });
  assert.equal(ok.status, 0, "uspešna komanda više ne vraća nulu");
});

test("[WIN] spakovan konektor odbija test skladište ključa", async (t) => {
  if (guard(t)) return;
  const cmd = fileURLToPath(new URL("../dist/connector.cmd", import.meta.url));
  /*
   * Na Windowsu je DPAPI dostupan, pa se test adapter ionako ne bira. Ovo
   * potvrđuje da ni izričita promenljiva ne menja izbor u paketu.
   *
   * Izolovano okruženje: ranije je `doctor` radio nad PRAVIM
   * `%LOCALAPPDATA%\CarsystemConnector` naloga (i pravio taj folder), a bez
   * konfiguracije izlazi sa 1 — `execFileSync` je to prijavio kao pad, iako
   * adapter nije ni pogledan.
   */
  const baza = await mkdtemp(join(tmpdir(), "cs-win-doctor-"));
  try {
    const r = spawnSync("cmd.exe", ["/c", cmd, "doctor"], {
      encoding: "utf8",
      timeout: 120_000,
      env: {
        ...process.env,
        CS_CONNECTOR_INSECURE_KEYSTORE: "1",
        CS_CONNECTOR_STATE_DIR: join(baza, "stanje"),
        CS_CONNECTOR_CONFIG: join(baza, "nema-konfiguracije.json"),
      },
    });
    let d = null;
    try {
      d = JSON.parse(r.stdout ?? "");
    } catch {
      /* izlaz se ne prepisuje u poruku — mogao bi da nosi putanju */
    }
    assert.ok(d, `doctor nije vratio JSON (izlaz ${r.status})`);
    assert.doesNotMatch(r.stdout, /test-insecure/, "paket je izabrao nebezbedno skladište");

    const skladiste = d.nalazi.find((n) => n.provera === "skladiste_kljuca");
    assert.equal(skladiste?.status, "ok", `skladište: ${skladiste?.detalj?.kod ?? skladiste?.status}`);
    assert.match(String(skladiste.detalj.adapter), /dpapi/i);

    // Jedini očekivani problem je namerno odsutna konfiguracija.
    const problemi = d.nalazi.filter((n) => n.status === "greska").map((n) => n.provera);
    assert.deepEqual(problemi, ["konfiguracija"]);
    assert.equal(r.status, 1);
  } finally {
    await rm(baza, { recursive: true, force: true });
  }
});
