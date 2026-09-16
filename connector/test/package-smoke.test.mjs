import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

/**
 * P0-WIN-02A korekcija: `connector/scripts/package-smoke.mjs` je paketovao
 * `task.ps1` bez `PathGuards.ps1`, koji `task.ps1` (i `harden-install-dir.ps1`,
 * `verify-invoice-folder.ps1`) bezuslovno dot-source-uje. Spakovan `task.ps1`
 * NIJE mogao da se pokrene — ni `-Action status`, ni dry-run.
 *
 * Ovaj fajl dokazuje da je allowlista sada dependency-closed: STVARNIM
 * pokretanjem `package-smoke.mjs` (kad je stablo čisto) i inspekcijom
 * stvarno raspakovanog rezultata — ne pretpostavkom da tekst allowliste
 * dovoljno govori.
 */

const KOREN = fileURLToPath(new URL("../../", import.meta.url));
const PACKAGE_SCRIPT = join(KOREN, "connector/scripts/package-smoke.mjs");

function git(args) {
  return execFileSync("git", args, { cwd: KOREN, encoding: "utf8" }).trim();
}

function stabloCisto() {
  try {
    return git(["status", "--porcelain"]) === "";
  } catch {
    return false;
  }
}

/* =========================================================================
 * NEVAZECI — tek posle uspešne verifikacije
 * ====================================================================== */

test("[paket] pakovanje NE označava ranije pakete; verifikacija to radi tek kad prođe", async () => {
  const pakovanje = await readFile(PACKAGE_SCRIPT, "utf8");
  const bezKomentara = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(bezKomentara(pakovanje), /NEVAZECI-\$\{|oznaciRanijeNevazecim/, "package-smoke.mjs i dalje piše NEVAZECI");

  const provera = bezKomentara(
    await readFile(join(KOREN, "connector/scripts/verify-smoke-package.mjs"), "utf8"),
  );
  const poziv = provera.indexOf("oznaciRanijeNevazecim({");
  assert.ok(poziv > 0, "verifikacija ne označava ranije pakete");
  // Jedini poziv, unutar grane bez pada, posle svih koraka.
  assert.equal(provera.split("oznaciRanijeNevazecim({").length, 2);
  const grana = provera.lastIndexOf("if (palo === 0) {", poziv);
  assert.ok(grana > 0 && grana > provera.lastIndexOf("korak(", poziv), "označavanje nije posle svih koraka, u grani bez pada");
});

test("[paket] oznaciRanijeNevazecim označava samo ranije ZIP-ove i ništa ne briše", async () => {
  const { writeFile } = await import("node:fs/promises");
  const { oznaciRanijeNevazecim } = await import("../scripts/smoke-nevazeci.mjs");
  const izlaz = await mkdtemp(join(tmpdir(), "cs-nevazeci-"));
  try {
    for (const f of ["carsystem-windows-smoke-aaaaaaa.zip", "carsystem-windows-smoke-bbbbbbb.zip", "drugo.zip"]) {
      await writeFile(join(izlaz, f), "x");
    }
    // Bez novog ZIP-a nema proglašavanja.
    assert.throws(() =>
      oznaciRanijeNevazecim({ izlaz, zipIme: "carsystem-windows-smoke-ccccccc.zip", kratki: "ccccccc", handoffIme: "H.md" }),
    );
    assert.deepEqual((await readdir(izlaz)).filter((f) => f.startsWith("NEVAZECI")), []);

    const raniji = oznaciRanijeNevazecim({
      izlaz, zipIme: "carsystem-windows-smoke-bbbbbbb.zip", kratki: "bbbbbbb", handoffIme: "WINDOWS-HANDOFF-bbbbbbb.md",
    });
    assert.deepEqual(raniji, ["carsystem-windows-smoke-aaaaaaa.zip"]);
    const fajlovi = (await readdir(izlaz)).sort();
    assert.ok(fajlovi.includes("NEVAZECI-aaaaaaa.md"));
    assert.ok(!fajlovi.includes("NEVAZECI-bbbbbbb.md"), "novi paket je proglašen nevažećim");
    assert.ok(fajlovi.includes("carsystem-windows-smoke-aaaaaaa.zip"), "stari ZIP je obrisan");
    assert.match(await readFile(join(izlaz, "NEVAZECI-aaaaaaa.md"), "utf8"), /carsystem-windows-smoke-bbbbbbb\.zip/);
  } finally {
    await rm(izlaz, { recursive: true, force: true });
  }
});

/* =========================================================================
 * Statička provera allowliste — brza, bez pakovanja, dokazuje da je fix TU.
 * ====================================================================== */

test("[paket] ULAZI allowlista sadrži sve WIN-01 fajlove i njihove zavisnosti", async () => {
  const tekst = await readFile(PACKAGE_SCRIPT, "utf8");
  const ocekivano = [
    "connector/windows/task.ps1",
    "connector/windows/harden-state-dir.ps1",
    "connector/windows/PathGuards.ps1",
    "connector/windows/harden-install-dir.ps1",
    "connector/windows/verify-invoice-folder.ps1",
    "connector/windows/OFFICE-INSTALL.md",
    "connector/test/windows-install-hardening.test.mjs",
    "connector/bin/connector.mjs",
    "connector/README.md",
  ];
  for (const izvor of ocekivano) {
    const escaped = izvor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(tekst, new RegExp(`izvor:\\s*"${escaped}"`), `ULAZI ne sadrži: ${izvor}`);
  }
});

test("[paket] PREGLEDANO nosi izuzetak za svaki novi fajl koji stvarno sadrži primer C:\\ putanje", async () => {
  const tekst = await readFile(PACKAGE_SCRIPT, "utf8");
  // Ovo su fajlovi za koje je REGRESIJA (§2 zadatka) potvrdila da sadrže
  // `C:\...` primere u dokumentaciji/komentarima — moraju imati PREGLEDANO
  // unos, inače package-smoke.mjs odbija pakovanje kao "sumnjiv sadržaj".
  const zahtevaIzuzetak = [
    "connector/windows/PathGuards.ps1",
    "connector/windows/harden-install-dir.ps1",
    "connector/windows/verify-invoice-folder.ps1",
    "connector/windows/OFFICE-INSTALL.md",
    "connector/README.md",
  ];
  for (const fajl of zahtevaIzuzetak) {
    const escaped = fajl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(tekst, new RegExp(`fajl:\\s*"${escaped}"`), `PREGLEDANO nema izuzetak za: ${fajl}`);
  }
});

/* =========================================================================
 * Izvršiva provera — STVARNO pokretanje package-smoke.mjs, nad ČISTIM
 * stablom, u jednokratni izlazni folder (CS_SMOKE_OUT_DIR). Preskače se, sa
 * jasnim razlogom, ako stablo NIJE čisto — package-smoke.mjs to sam odbija
 * po dizajnu (mora odgovarati poznatom HEAD-u), pa test ne sme lažno pasti
 * zbog nepovezanih lokalnih izmena.
 * ====================================================================== */

let keširanPaket;
function izgradiPaket() {
  if (keširanPaket) return keširanPaket;
  keširanPaket = (async () => {
    if (!stabloCisto()) {
      return { preskoci: "Radno stablo nije čisto — package-smoke.mjs to sam odbija po dizajnu (mora odgovarati poznatom HEAD-u). Test se izvršava samo nad čistim stablom." };
    }

    /*
     * NE poziva se `connector:build` ovde.
     *
     * `connector/dist` je DELJEN resurs — `connector:test` (ceo glob) ga
     * gradi TAČNO JEDNOM pre nego što pokrene sve `*.test.mjs` fajlove, koji
     * potom SIMULTANO čitaju iz njega. Da ovaj fajl sam pozove
     * `npm run connector:build` (koji `dist` briše pa ponovo pravi), drugi
     * fajlovi bi u tom prozoru dobili `ERR_MODULE_NOT_FOUND` — tačno to se i
     * desilo prvi put kad je ovaj test pušten unutar celog `connector:test`
     * glob-a. `npm run test:package-smoke` (samostalna komanda) sam gradi
     * `dist` PRE ovog fajla — vidi `package.json`.
     */
    if (!existsSync(join(KOREN, "connector/dist/package.json"))) {
      throw new Error("connector/dist ne postoji — pokreni `npm run connector:build` pre ovog testa (ili koristi `npm run test:package-smoke`).");
    }

    const izlaz = await mkdtemp(join(tmpdir(), "cs-smoke-pkg-out-"));
    execFileSync("node", [PACKAGE_SCRIPT], {
      cwd: KOREN,
      env: { ...process.env, CS_SMOKE_OUT_DIR: izlaz },
      stdio: "pipe",
    });

    const head = git(["rev-parse", "HEAD"]);
    const kratki = head.slice(0, 7);
    const ime = `carsystem-windows-smoke-${kratki}`;
    const zip = join(izlaz, `${ime}.zip`);
    const handoff = join(izlaz, `WINDOWS-HANDOFF-${kratki}.md`);
    const stage = join(izlaz, ime);

    assert.ok(existsSync(zip), `ZIP nije napravljen: ${zip}`);
    assert.ok(existsSync(handoff), `Handoff nije napravljen: ${handoff}`);
    assert.ok(existsSync(stage), `Staged folder nije ostavljen: ${stage}`);

    const raspakovano = await mkdtemp(join(tmpdir(), "cs-smoke-pkg-extract-"));
    // Izvučeno je van svake veze sa repozitorijumom (pod os tmpdir) — ako
    // paketovani testovi ovde prođu, to je dokaz da se NE oslanjaju na
    // izvorni checkout, jer odavde ni ne postoji relativna putanja do njega.
    execFileSync("unzip", ["-q", zip, "-d", raspakovano]);

    return { preskoci: null, head, kratki, ime, zip, handoff, stage, izlaz, raspakovano };
  })();
  return keširanPaket;
}

test.after(async () => {
  const p = await keširanPaket;
  if (p && !p.preskoci) {
    await rm(p.izlaz, { recursive: true, force: true });
    await rm(p.raspakovano, { recursive: true, force: true });
  }
});

async function sviFajloviRekurzivno(koren) {
  const out = [];
  async function hodaj(d) {
    for (const e of await readdir(d, { withFileTypes: true })) {
      const put = join(d, e.name);
      if (e.isSymbolicLink()) {
        out.push({ put, simlink: true });
      } else if (e.isDirectory()) {
        await hodaj(put);
      } else {
        out.push({ put, simlink: false });
      }
    }
  }
  await hodaj(koren);
  return out;
}

test("[paket] task.ps1 i PathGuards.ps1 postoje ZAJEDNO u raspakovanom paketu", async (t) => {
  const p = await izgradiPaket();
  if (p.preskoci) return t.skip(p.preskoci);

  const koren = join(p.raspakovano, p.ime);
  assert.ok(existsSync(join(koren, "connector/windows/task.ps1")));
  assert.ok(existsSync(join(koren, "connector/windows/PathGuards.ps1")));
  assert.ok(existsSync(join(koren, "connector/windows/harden-install-dir.ps1")));
  assert.ok(existsSync(join(koren, "connector/windows/verify-invoice-folder.ps1")));
  assert.ok(existsSync(join(koren, "connector/windows/OFFICE-INSTALL.md")));
  assert.ok(existsSync(join(koren, "connector/test/windows-install-hardening.test.mjs")));
});

test("[paket] SVAKI $PSScriptRoot dot-source u raspakovanim .ps1 skriptama razrešava se na sused u istom folderu", async (t) => {
  const p = await izgradiPaket();
  if (p.preskoci) return t.skip(p.preskoci);

  const winDir = join(p.raspakovano, p.ime, "connector/windows");
  const ps1Fajlovi = (await readdir(winDir)).filter((f) => f.endsWith(".ps1"));
  assert.ok(ps1Fajlovi.length >= 4, "očekivano bar 4 .ps1 fajla u paketu");

  const DOT_SOURCE = /\.\s*\(Join-Path\s+\$PSScriptRoot\s+'([^']+)'\)/g;
  let proverenoBarJedan = false;
  for (const naziv of ps1Fajlovi) {
    const tekst = await readFile(join(winDir, naziv), "utf8");
    for (const m of tekst.matchAll(DOT_SOURCE)) {
      proverenoBarJedan = true;
      const zavisnost = join(winDir, m[1]);
      assert.ok(existsSync(zavisnost), `${naziv} dot-source-uje '${m[1]}', ali taj fajl NIJE u paketu pored njega`);
    }
  }
  assert.ok(proverenoBarJedan, "nijedan dot-source nije nađen — provera ništa nije proverila");
});

test("[paket] paketovan windows-install-hardening.test.mjs STVARNO PROLAZI kad se pokrene IZ RASPAKOVANOG paketa", async (t) => {
  const p = await izgradiPaket();
  if (p.preskoci) return t.skip(p.preskoci);

  // `raspakovano` je pod os.tmpdir(), bez ijedne relativne putanje nazad ka
  // repozitorijumu — prolaz ovde dokazuje samodovoljnost paketa, ne slučajan
  // pad na izvorni checkout.
  const putanja = join(p.raspakovano, p.ime, "connector/test/windows-install-hardening.test.mjs");
  const r = spawnSync(process.execPath, ["--test", putanja], { encoding: "utf8", cwd: dirname(putanja) });
  assert.equal(r.status, 0, `paketovan test NIJE prošao iz raspakovanog paketa:\n${r.stdout}\n${r.stderr}`);
  assert.doesNotMatch(r.stdout + r.stderr, /ENOENT/, "test je pao na ENOENT — nešto nedostaje u paketu");
});

test("[paket] paketovani cross-platform connector testovi prolaze IZ RASPAKOVANOG paketa (bez izvornog checkout-a)", async (t) => {
  const p = await izgradiPaket();
  if (p.preskoci) return t.skip(p.preskoci);

  const testDir = join(p.raspakovano, p.ime, "connector/test");
  /*
   * `windows-smoke.test.mjs` je ovde NAMERNO uključen, iako su mu skoro svi
   * testovi Windows-only (samo se preskaču ovde): njegov jedini
   * cross-platform test ("W13 poziva task.ps1...") čita `run-smoke.mjs`
   * putanjom koja se RAZLIKUJE između izvornog stabla i spakovanog paketa —
   * tačno ta razlika je jednom već pukla (ENOENT) kad se test pokrenuo IZ
   * PAKETA, a ne iz izvora. `exit 0` ovde je jedini stvaran dokaz da fajl
   * ume da nađe `run-smoke.mjs` u OBA konteksta.
   */
  for (const naziv of ["pure.test.mjs", "paths.test.mjs", "scanner-store.test.mjs", "commands.test.mjs", "windows-smoke.test.mjs"]) {
    const putanja = join(testDir, naziv);
    const r = spawnSync(process.execPath, ["--test", putanja], { encoding: "utf8", cwd: testDir });
    assert.equal(r.status, 0, `${naziv} NIJE prošao iz raspakovanog paketa:\n${r.stdout}\n${r.stderr}`);
    assert.doesNotMatch(r.stdout + r.stderr, /ENOENT/, `${naziv}: ENOENT iz raspakovanog paketa — nešto se oslanja na izvorni raspored`);
  }
});

test("[paket] manifest pokriva SVAKI fajl u paketu, hash i veličina se poklapaju", async (t) => {
  const p = await izgradiPaket();
  if (p.preskoci) return t.skip(p.preskoci);

  const koren = join(p.raspakovano, p.ime);
  const manifest = await readFile(join(koren, "MANIFEST.md"), "utf8");

  const redovi = [...manifest.matchAll(/\|\s*`([0-9a-f]{64})`\s*\|\s*(\d+)\s*\|\s*`([^`]+)`\s*\|/g)]
    .map(([, sha, n, put]) => ({ sha, n: Number(n), put }));
  assert.ok(redovi.length > 10, "manifest izgleda prazan ili neparsiran");

  const stvarni = (await sviFajloviRekurzivno(koren))
    .filter((f) => !f.simlink)
    .map((f) => relative(koren, f.put).split(sep).join("/"))
    .filter((rel) => rel !== "MANIFEST.md");

  const uManifestu = new Set(redovi.map((r) => r.put));
  const naDisku = new Set(stvarni);

  const nedostajeUManifestu = stvarni.filter((r) => !uManifestu.has(r));
  const nedostajeNaDisku = redovi.filter((r) => !naDisku.has(r.put)).map((r) => r.put);
  assert.deepEqual(nedostajeUManifestu, [], "fajlovi na disku bez manifest unosa (nemanifestovan fajl)");
  assert.deepEqual(nedostajeNaDisku, [], "manifest unosi bez odgovarajućeg fajla na disku");

  for (const r of redovi) {
    const sadrzaj = await readFile(join(koren, r.put));
    assert.equal(sadrzaj.length, r.n, `${r.put}: veličina se ne poklapa sa manifestom`);
    const sha = createHash("sha256").update(sadrzaj).digest("hex");
    assert.equal(sha, r.sha, `${r.put}: SHA-256 se ne poklapa sa manifestom`);
  }
});

test("[paket] nema simlinkova, apsolutnih putanja ni ZIP traversal unosa", async (t) => {
  const p = await izgradiPaket();
  if (p.preskoci) return t.skip(p.preskoci);

  const koren = join(p.raspakovano, p.ime);
  const svi = await sviFajloviRekurzivno(koren);
  const simlinkovi = svi.filter((f) => f.simlink);
  assert.deepEqual(simlinkovi.map((f) => f.put), [], "paket sadrži symlink(ove)");

  const listaUZipu = execFileSync("unzip", ["-Z1", p.zip], { encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
  for (const unos of listaUZipu) {
    assert.ok(!unos.startsWith("/"), `ZIP unos je apsolutna putanja: ${unos}`);
    assert.ok(!unos.includes(".."), `ZIP unos sadrži traversal segment: ${unos}`);
  }
});

test("[paket] embedded Git SHA u handoff-u i package-meta.json odgovara STVARNOM HEAD-u", async (t) => {
  const p = await izgradiPaket();
  if (p.preskoci) return t.skip(p.preskoci);

  const handoffTekst = await readFile(p.handoff, "utf8");
  assert.match(handoffTekst, new RegExp(p.head), "handoff ne sadrži pun HEAD");
  assert.match(handoffTekst, new RegExp(`carsystem-windows-smoke-${p.kratki}\\.zip`));

  const metaTekst = await readFile(join(p.raspakovano, p.ime, "smoke/package-meta.json"), "utf8");
  const meta = JSON.parse(metaTekst);
  assert.equal(meta.sourceHead, p.head);
  assert.equal(meta.shortHead, p.kratki);
});

test("[paket] nema automatski Production install ni -Apply put u smoke pokretaču", async (t) => {
  const p = await izgradiPaket();
  if (p.preskoci) return t.skip(p.preskoci);

  const koren = join(p.raspakovano, p.ime);

  /*
   * Whole-file provera SAMO za `RUN-SMOKE.cmd` i `cleanup.mjs`: nijedan od
   * njih legitimno ne pominje "-Apply" ni "-Mode Production" ni u komentaru
   * ni u sažetku, pa je pomen = stvaran poziv.
   *
   * `run-smoke.mjs` NIJE ovde: on legitimno POMINJE oba stringa u
   * dokumentaciji (npr. "NIKAD `-Mode Production`", "namerno ručnih (Task
   * Scheduler -Apply)") — objašnjava šta se NE radi, ne poziva ih. Whole-file
   * regex bi tu lažno pao (i već je jednom pao na oba stringa u ovoj reviziji).
   * Stvaran dokaz da W13 (jedini poziv `task.ps1` u tom fajlu) ne koristi ni
   * Production ni -Apply dolazi iz uskog testa nad TAČNO argumentima koje W13
   * šalje PowerShell-u — vidi `connector/test/windows-smoke.test.mjs`,
   * "W13 poziva task.ps1 sa -Action install i -Mode Smoke...".
   */
  for (const rel of ["smoke/RUN-SMOKE.cmd", "smoke/cleanup.mjs"]) {
    const tekst = await readFile(join(koren, rel), "utf8");
    assert.doesNotMatch(tekst, /-Mode\s+Production/i, `${rel} pokreće Production mod`);
    assert.doesNotMatch(tekst, /-Apply\b/, `${rel} sadrži -Apply poziv`);
  }
});

test("[paket] pakovanje samo čita repozitorijum i piše van njega — ne menja tracked fajlove niti sistem", async (t) => {
  const p = await izgradiPaket();
  if (p.preskoci) return t.skip(p.preskoci);

  assert.equal(git(["status", "--porcelain"]), "", "package-smoke.mjs je ostavio repozitorijum prljavim");

  const tekst = await readFile(PACKAGE_SCRIPT, "utf8");
  // Statička provera nad IZVOROM skripte: ne sme postojati nijedan poziv koji
  // bi menjao Windows ACL/Task Scheduler/servis — ovaj alat samo kopira
  // fajlove i pravi ZIP, na bilo kojoj platformi.
  for (const zabranjen of [
    /Set-Acl/i, /Register-ScheduledTask/i, /New-LocalUser/i, /Set-MpPreference/i, /netsh\s+advfirewall/i,
  ]) {
    assert.doesNotMatch(tekst, zabranjen, `package-smoke.mjs sadrži poziv koji menja sistem: ${zabranjen}`);
  }
});
