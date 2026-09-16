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

const D = (p) => new URL(`../dist/connector/src/${p}`, import.meta.url).href;

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

test("[WIN] tajna ne prolazi kroz komandnu liniju", async (t) => {
  if (guard(t)) return;
  const { readFile } = await import("node:fs/promises");
  const izvor = await readFile(
    new URL("../dist/connector/src/keystore/windows-dpapi.mjs", import.meta.url),
    "utf8",
  );
  const kod = izvor.replace(/\/\*[\s\S]*?\*\//g, "");
  /*
   * Program ide kroz `-EncodedCommand`; podatak ISKLJUČIVO kroz stdin.
   *
   * Stari `-Command -` je slao oba kroz stdin, i PowerShell je red sa ključem
   * parsirao kao naredbu (kancelarijski D06: izlaz 1).
   */
  assert.match(kod, /"-EncodedCommand"/);
  assert.doesNotMatch(kod, /"-Command",\s*"-"/, "stari kanal program+podatak kroz stdin");
  assert.match(kod, /stdin\.write\(`\$\{ulaz\}\\n`\)/, "podatak ne ide kroz stdin");
});

test("[WIN] produkcijski kanal: program kroz -EncodedCommand, podatak kroz stdin", async (t) => {
  if (guard(t)) return;
  const dpapi = await import(D("keystore/windows-dpapi.mjs"));
  /*
   * Isto što D06 meri na kancelarijskom računaru, ali kroz stvarni
   * `pokreniPowerShell`. Podatak je sintetička konstanta, ne ključ.
   */
  const podatak = Buffer.from("cs-kanal-proba-sinteticki").toString("base64");
  const izlaz = await dpapi.pokreniPowerShell(
    "$ErrorActionPreference = 'Stop'; $ProgressPreference = 'SilentlyContinue'; [Console]::In.ReadLine()",
    podatak,
  );
  assert.equal(izlaz, podatak, "red sa stdin-a nije vraćen neizmenjen");

  // proveri() — Protect i Unprotect kroz isti kanal, nad konstantom.
  const rez = await dpapi.proveri();
  assert.equal(rez.ok, true);
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

    // export-key čita ključ nazad kroz Unprotect — dakle kroz stdin kanal.
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

test("[WIN] DPAPI drugog naloga ne otključava ključ", async (t) => {
  if (guard(t)) return;
  t.skip(
    "Traži drugi Windows nalog i ručno pokretanje pod njim. " +
      "Postupak je opisan u docs/b2b/21; automatski se ne izvršava.",
  );
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
      join(folder, "Račun 42.PDF"),
    );

    const { koren } = await skener.proveriIzvor(folder);
    const { kandidati } = await skener.nadjiKandidate(koren);
    assert.equal(kandidati.length, 1);

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
    await cp(uzorak, join(koren, "FAKTURE 2026", "nasa.pdf"));
    await cp(uzorak, join(spolja, "tudja.pdf"));

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

    assert.deepEqual(imena, ["nasa.pdf"], "junction je uvukao dokument van korena");
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
  const izlaz = execFileSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", skripta,
     "-Action", "install", "-Mode", "Smoke", "-PackagePath", fileURLToPath(new URL("../dist/", import.meta.url))],
    { encoding: "utf8" },
  );
  assert.match(izlaz, /\[dry-run\]/);

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
  assert.throws(() =>
    execFileSync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", skripta,
       "-Action", "install", "-PackagePath", fileURLToPath(new URL("../dist/", import.meta.url))],
      { encoding: "utf8" },
    ),
  );
});

test("[WIN] registracija i uklanjanje zadatka (Smoke i Production)", async (t) => {
  if (guard(t)) return;
  t.skip(
    "Menja Task Scheduler na mašini; pokreće se ručno na izolovanom Windows " +
      "okruženju: `task.ps1 -Action install -Mode Smoke -Apply` / `-Mode Production -Apply`, " +
      "pa odgovarajući `-Action uninstall -Mode ... -Apply`. Potvrditi da su registrovana " +
      "DVA različita imena zadatka (CarsystemConnectorSMOKE, CarsystemConnector) i da " +
      "uklanjanje jednog ne dira drugi.",
  );
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
   */
  const izlaz = execFileSync("cmd.exe", ["/c", cmd, "doctor"], {
    encoding: "utf8",
    env: { ...process.env, CS_CONNECTOR_INSECURE_KEYSTORE: "1" },
  });
  assert.doesNotMatch(izlaz, /test-insecure/, "paket je izabrao nebezbedno skladište");
});
