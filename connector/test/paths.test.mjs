import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * Razrešavanje putanja iz `import.meta.url`.
 *
 * Ovo je regresija na kvar koji se u repozitorijumu NE VIDI: projekat stoji na
 * putanji bez razmaka i bez srpskih slova, pa je `new URL(...).pathname` godinu
 * dana izgledao ispravno. Puklo bi tek u spakovanom obliku, na kancelarijskom
 * računaru, u folderu „Carsystem Smoke ČĆŽŠĐ“ — dakle na mestu gde je najskuplje.
 *
 * Testovi ne porede samo nizove: prave stvarne foldere sa razmacima i srpskim
 * slovima i čitaju stvarne fajlove iz njih.
 */

/* =========================================================================
 * Vektor koji je pukao
 * ====================================================================== */

test("`.pathname` procenat-kodira, `fileURLToPath` ne", async () => {
  const baza = await mkdtemp(join(tmpdir(), "cs-put-"));
  const folder = join(baza, "Provera Paketa ČĆŽŠĐ");
  await mkdir(folder, { recursive: true });
  const fajl = join(folder, "ulaz.txt");
  await writeFile(fajl, "sadržaj");

  const url = pathToFileURL(fajl);

  /*
   * Kontrola same provere: ako `.pathname` ovde NIJE kodiran, test bi bio
   * zelen bez ičega — a upravo kodiranje je uzrok kvara.
   */
  assert.match(url.pathname, /%20/, "vektor nije reprodukovan: nema %20");
  assert.match(url.pathname, /%C4%8C/, "vektor nije reprodukovan: nema %C4%8C");

  const ispravna = fileURLToPath(url);
  assert.equal(ispravna, fajl);
  assert.doesNotMatch(ispravna, /%20|%C4%8C|%C5%BD/);

  await rm(baza, { recursive: true, force: true });
});

test("Windows file URL: bez vodećeg `/` i bez procenata", () => {
  /*
   * Semantika `URL`-a je ista na svakoj platformi, pa se Windows vektor može
   * proveriti i odavde — bez Windows mašine.
   *
   * `.pathname` daje `/C:/Users/...`, sa vodećom kosom crtom ISPRED slova
   * diska. Takav niz `cmd.exe` i `powershell.exe` ne prihvataju.
   */
  const url = new URL(
    "file:///C:/Users/Vlasnik/Carsystem%20Smoke%20%C4%8C%C4%86%C5%BD/connector/dist/connector.cmd",
  );

  assert.match(url.pathname, /^\/C:/, "vektor nije reprodukovan: nema vodeći /C:");
  assert.match(url.pathname, /%20/);

  /*
   * `fileURLToPath` na ne-Windows hostu ne ume da napravi Windows putanju, pa
   * se tvrdnja deli: dekodiranje se proverava svuda, a oblik `C:\...` samo tamo
   * gde ima smisla. Bez ove podele test bi na macOS-u tvrdio nešto netačno.
   */
  const razresena = fileURLToPath(url);
  assert.doesNotMatch(razresena, /%20|%C4%8C|%C4%86|%C5%BD/, "procenti su preživeli");
  assert.match(razresena, /Carsystem Smoke ČĆŽ/, "srpska slova nisu dekodirana");

  if (process.platform === "win32") {
    assert.match(razresena, /^C:\\/, "Windows putanja nosi vodeći separator ispred diska");
    assert.doesNotMatch(razresena, /^\//);
  }
});

/* =========================================================================
 * Stvarni tok: fixtures se čitaju iz putanje sa razmakom i ČĆŽŠĐ
 * ====================================================================== */

test("testni fixtures se razrešavaju i iz Unicode putanje", async () => {
  /*
   * Isti izraz koji koriste `scanner-store` i `windows-smoke` testovi. Da se
   * negde vratio `.pathname`, ovaj `readdir` bi pao sa ENOENT čim se paket
   * raspakuje u folder sa razmakom.
   */
  const FIXTURES = fileURLToPath(new URL("../../fixtures/dev/biznisoft/", import.meta.url));
  const fajlovi = await readdir(FIXTURES);
  assert.ok(fajlovi.includes("vise-stavki.pdf"), "fixtures se ne vide");
  assert.ok(fajlovi.includes("jedna-stavka.pdf"));
});

test("spakovan izlaz se razrešava istim izrazom", async () => {
  const DIST = fileURLToPath(new URL("../dist/", import.meta.url));
  const fajlovi = await readdir(DIST);
  for (const ocekivan of ["connector.cmd", "connector.sh", "package.json"]) {
    assert.ok(fajlovi.includes(ocekivan), `paket nema ${ocekivan}`);
  }
});

test("Windows skripte se razrešavaju istim izrazom", async () => {
  const WINDOWS = fileURLToPath(new URL("../windows/", import.meta.url));
  const fajlovi = await readdir(WINDOWS);
  assert.ok(fajlovi.includes("task.ps1"));
  assert.ok(fajlovi.includes("harden-state-dir.ps1"));
});

/* =========================================================================
 * Zabrana obrasca
 * ====================================================================== */

test("nijedan test konektora ne razrešava putanju kodiranim oblikom", async () => {
  const TEST_DIR = fileURLToPath(new URL("./", import.meta.url));
  const { readFile } = await import("node:fs/promises");

  /*
   * Obrazac se SASTAVLJA u vremenu izvršavanja.
   *
   * Da stoji kao literal, ovaj fajl bi pronašao sam sebe — i jedini način da
   * test prođe bio bi izuzetak po imenu fajla, tj. rupa tačno u čuvaru.
   *
   * Traži se samo `.pathname` nad `import.meta.url`; šira zabrana bi oborila
   * legitimnu upotrebu istog svojstva nad HTTP adresom.
   */
  const OBRAZAC = new RegExp(["import", "meta", "url"].join("\\.") + "\\s*\\)\\s*\\." + "pathname");

  const krivci = [];
  for (const ime of await readdir(TEST_DIR)) {
    if (!ime.endsWith(".mjs")) continue;
    if (OBRAZAC.test(await readFile(join(TEST_DIR, ime), "utf8"))) krivci.push(ime);
  }
  assert.deepEqual(krivci, [], `kodirana putanja u: ${krivci.join(", ")}`);
});

test("nijedan test konektora ne seče putanju samo po `/`", async () => {
  const TEST_DIR = fileURLToPath(new URL("./", import.meta.url));
  const { readFile } = await import("node:fs/promises");

  /*
   * Kancelarijski smoke 45a3460: deljenje putanje po kosoj crti na Windowsu vraća
   * CELU putanju, jer je separator `\`. Test je pao, a skener je radio
   * ispravno. Ime fajla se uzima kroz `basename` ili `split(/[\\/]/)`.
   *
   * Obrazac se i ovde sastavlja u vremenu izvršavanja, da čuvar ne nađe sebe.
   */
  const OBRAZAC = new RegExp("\\.split\\(\\s*[\"']" + "/" + "[\"']\\s*\\)\\.pop\\(");

  const krivci = [];
  for (const ime of await readdir(TEST_DIR)) {
    if (!ime.endsWith(".mjs")) continue;
    if (OBRAZAC.test(await readFile(join(TEST_DIR, ime), "utf8"))) krivci.push(ime);
  }
  assert.deepEqual(krivci, [], `putanja se seče samo po "/" u: ${krivci.join(", ")}`);
  assert.ok(OBRAZAC.test('k.putanja.split("' + '/").pop()'), "čuvar ne prepoznaje obrazac");
  assert.ok(!OBRAZAC.test("k.putanja.split(/[\\\\/]/).pop()"));
});

test("čuvar zaista hvata obrazac kada se vrati", async () => {
  /*
   * Kontrola čuvara.
   *
   * Bez ovoga bi pogrešno sastavljen obrazac merio prazan skup i izgledao
   * zeleno zauvek — a to je isti oblik greške koji se ovim paketom popravlja.
   */
  const OBRAZAC = new RegExp(["import", "meta", "url"].join("\\.") + "\\s*\\)\\s*\\." + "pathname");
  const uzorak = 'const X = new URL("../x/", import' + ".meta.url).pathname;";
  assert.ok(OBRAZAC.test(uzorak), "čuvar ne prepoznaje obrazac koji treba da zabrani");
  assert.ok(!OBRAZAC.test('fileURLToPath(new URL("../x/", import.meta.url))'));
});
