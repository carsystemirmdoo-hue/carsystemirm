import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

/**
 * Pokretač mora da vrati izlazni kod konektora.
 *
 * ZAŠTO POSTOJI
 * =============
 * `connector.cmd` je završavao sa `endlocal`, koji uspeva uvek. Batch fajl vraća
 * ERRORLEVEL POSLEDNJE naredbe, pa je `cmd.exe /c connector.cmd` vraćao 0 i kad
 * je konektor pao.
 *
 * Posledice su bile tihe i ozbiljne:
 *
 *  - Task Scheduler čita izlazni kod (vidi komentar u `bin/connector.mjs`) —
 *    neuspeo noćni ciklus bi bio prijavljen kao uspešan;
 *  - `watch` koji STAJE zbog neispravne konfiguracije izgledao bi kao uredan
 *    završetak, umesto kao zaustavljanje koje traži čoveka.
 *
 * Prvi stvarni Windows smoke je to i izmerio: `W12` je dobio `watch_wrong_exit`,
 * jer je očekivao 1, a dobio 0. Ta jedna provera je bila jedina koja je uopšte
 * tvrdila NEnulti kod kroz `cmd.exe` lanac.
 *
 * `connector.sh` koristi `exec` i nikada nije imao ovaj problem — zato se
 * ponašanje meri na njemu, a oblik `.cmd` fajla zaključava ugovorom.
 */

const cmdPut = fileURLToPath(new URL("../dist/connector.cmd", import.meta.url));
const shPut = fileURLToPath(new URL("../dist/connector.sh", import.meta.url));

/** Nepoznata komanda: `main()` vraća 2. Najjeftiniji nenulti kod za merenje. */
const NEPOZNATA = "ova-komanda-ne-postoji";
const OCEKIVAN_KOD = 2;

/**
 * Ponašanje se meri samo na runtime-u koji konektor uopšte prihvata.
 *
 * Ispod Node 22 entrypoint izlazi kodom 3 PRE nego što stigne do `main()` — to
 * je ispravno, ali meri runtime guard, ne pokretač. Test bi tada padao iz
 * razloga koji nema veze sa onim što tvrdi.
 */
async function runtimeNosiKonektor() {
  if (Number(process.versions.node.split(".")[0]) < 22) return false;
  try {
    await import("node:sqlite");
    return true;
  } catch {
    return false;
  }
}

test("connector.cmd prenosi izlazni kod kroz endlocal", () => {
  const tekst = readFileSync(cmdPut, "utf8");

  /*
   * Ugovor nad OBLIKOM, jer se ponašanje `.cmd` fajla ne može izmeriti van
   * Windows-a. `endlocal & exit /b %VAR%` je jedini ispravan oblik: cela linija
   * se parsira pre izvršavanja, pa se promenljiva proširi dok još postoji.
   */
  assert.match(
    tekst,
    /set CS_RC=%ERRORLEVEL%/i,
    "izlazni kod se ne hvata pre endlocal",
  );
  assert.match(
    tekst,
    /endlocal\s*&\s*exit \/b %CS_RC%/i,
    "endlocal nije spojen sa `exit /b` — kod se gubi",
  );

  // Hvatanje mora doći POSLE poziva node-a, inače hvata kod `set` naredbe.
  const pozivNode = tekst.indexOf("connector.mjs");
  const hvatanje = tekst.indexOf("CS_RC=%ERRORLEVEL%");
  assert.ok(pozivNode > 0 && hvatanje > pozivNode, "kod se hvata pre poziva konektora");
});

test("connector.cmd i dalje postavlja produkcijski režim", () => {
  // Bez ovoga bi spakovan konektor mogao da izabere test skladište ključa.
  assert.match(readFileSync(cmdPut, "utf8"), /set CS_CONNECTOR_PACKAGED=1/i);
});

test("pokretač STVARNO vraća nenulti kod (POSIX ekvivalent)", async (t) => {
  if (process.platform === "win32") {
    t.skip("Na Windowsu isto meri [WIN] test nad connector.cmd.");
    return;
  }
  if (!(await runtimeNosiKonektor())) {
    t.skip(`Konektor traži Node 22+ sa node:sqlite; tekući runtime je ${process.version}.`);
    return;
  }
  const r = spawnSync("sh", [shPut, NEPOZNATA], { encoding: "utf8" });
  assert.equal(
    r.status,
    OCEKIVAN_KOD,
    `pokretač je progutao izlazni kod: dobijeno ${r.status}`,
  );
});

test("pokretač vraća nulu za uspešnu komandu", async (t) => {
  if (process.platform === "win32") {
    t.skip("Na Windowsu isto meri [WIN] test nad connector.cmd.");
    return;
  }
  if (!(await runtimeNosiKonektor())) {
    t.skip(`Konektor traži Node 22+ sa node:sqlite; tekući runtime je ${process.version}.`);
    return;
  }
  const r = spawnSync("sh", [shPut, "--help"], { encoding: "utf8" });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /Carsystem konektor/);
});
