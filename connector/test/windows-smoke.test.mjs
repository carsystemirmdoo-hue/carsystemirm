import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

/**
 * Windows smoke test nad SPAKOVANIM konektorom.
 *
 * Ovo je jedini test koji dokazuje ono što macOS/Linux prolaz ne može:
 * stvarni DPAPI `Protect`/`Unprotect` pod predviđenim nalogom, Windows putanje,
 * zaključavanje fajla drugim procesom i registraciju zadatka.
 *
 * VAN WINDOWS-a se SVI testovi ovde preskaču sa izričitim razlogom. Prolaz na
 * drugoj platformi NIJE zamena i ne sme se tako prikazati u izveštaju.
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
  /*
   * Materijal ide kao red na `stdin`. Interpolacija u argumente bi ga ostavila
   * u `Win32_Process` i u alatima za nadzor procesa.
   */
  assert.match(izvor, /stdin\.write/);
  assert.match(izvor, /"-Command", "-"/);
  assert.doesNotMatch(izvor, /-Command["']?\s*\+/, "komanda se sastavlja spajanjem stringova");
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
      new URL("../../fixtures/dev/biznisoft/vise-stavki.pdf", import.meta.url).pathname,
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
        maxFajlovaPoCiklusu: 5,
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

test("[WIN] skripta zadatka je podrazumevano dry-run", async (t) => {
  if (guard(t)) return;
  const skripta = new URL("../windows/task.ps1", import.meta.url).pathname;

  /*
   * BEZ `-Apply` — ne sme napraviti nijednu trajnu izmenu na sistemu.
   *
   * Izlaz mora nositi `[dry-run]`, i posle poziva zadatak ne sme postojati.
   */
  const izlaz = execFileSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", skripta,
     "-Action", "install", "-PackagePath", new URL("../dist/", import.meta.url).pathname],
    { encoding: "utf8" },
  );
  assert.match(izlaz, /\[dry-run\]/);

  const postoji = execFileSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command",
     "if (Get-ScheduledTask -TaskName CarsystemConnector -TaskPath '\\Carsystem\\' -ErrorAction SilentlyContinue) { 'DA' } else { 'NE' }"],
    { encoding: "utf8" },
  ).trim();
  assert.equal(postoji, "NE", "dry-run je registrovao zadatak");
});

test("[WIN] registracija i uklanjanje zadatka", async (t) => {
  if (guard(t)) return;
  t.skip(
    "Menja Task Scheduler na mašini; pokreće se ručno na izolovanom Windows " +
      "okruženju: `task.ps1 -Action install -Apply`, pa `-Action uninstall -Apply`.",
  );
});

/* =========================================================================
 * Paket
 * ====================================================================== */

test("[WIN] spakovan konektor se pokreće preko connector.cmd", async (t) => {
  if (guard(t)) return;
  const cmd = new URL("../dist/connector.cmd", import.meta.url).pathname;
  const izlaz = execFileSync("cmd.exe", ["/c", cmd, "--help"], { encoding: "utf8" });
  assert.match(izlaz, /Carsystem konektor/);
});

test("[WIN] spakovan konektor odbija test skladište ključa", async (t) => {
  if (guard(t)) return;
  const cmd = new URL("../dist/connector.cmd", import.meta.url).pathname;
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
