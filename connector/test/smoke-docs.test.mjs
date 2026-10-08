import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  HANDOFF_ZAGLAVLJE,
  SENTINEL,
  dokumentovaneProvere,
  pomenutiIdevi,
  proveriHandoff,
  proveriRunbook,
  rucneProvere,
  proveriStartHere,
  razorneNaredbe,
  runnerProvere,
} from "../scripts/smoke-docs-contract.mjs";

/**
 * Ugovor između runnera i papira.
 *
 * Dva sloja, oba obavezna:
 *
 *  1. ugovor hvata tačno ono što je jednom već prošlo — hardkodovan hash,
 *     „10/10", brisanje prave fakture. Test to dokazuje nad UMETNUTIM lošim
 *     tekstom, jer provera koja nikad ne prijavi nalaz izgleda isto kao provera
 *     koja radi;
 *  2. STVARNI fajlovi u repozitorijumu prolaze taj ugovor. Bez toga bi ugovor
 *     bio tačan, a dokumenti i dalje pogrešni.
 */

const OVDE = dirname(fileURLToPath(import.meta.url));
const KOREN = resolve(OVDE, "..", "..");

const citaj = (rel) => readFileSync(join(KOREN, rel), "utf8");

const RUN_SMOKE = "connector/smoke/run-smoke.mjs";
const START_HERE = "connector/smoke/START-HERE.md";
const RUNBOOK = "docs/b2b/recommendation-office-validation-runbook.md";

const runnerIdevi = runnerProvere(citaj(RUN_SMOKE));

/* =========================================================================
 * Izvor istine
 * ====================================================================== */

test("ID-jevi provera se čitaju iz KODA runnera, ne iz komentara", () => {
  assert.ok(runnerIdevi.length >= 16, `nađeno samo ${runnerIdevi.length} provera`);
  assert.equal(runnerIdevi[0], "W01");
  assert.ok(runnerIdevi.includes("W15-win"), "nedostaje W15-win");
  // Bez duplikata — dva puta isti ID bi značilo da jedan rezultat gazi drugi.
  assert.equal(new Set(runnerIdevi).size, runnerIdevi.length);
});

test("tabela u dokumentu se čita samo iz prve kolone, ne iz rečenice", () => {
  const md = [
    "Rečenica koja pominje `W99` u tekstu.",
    "",
    "| ID | Šta |",
    "|---|---|",
    "| `W01` | prva |",
    "| `W15-win` | poslednja |",
  ].join("\n");
  assert.deepEqual(dokumentovaneProvere(md), ["W01", "W15-win"]);
  assert.deepEqual(pomenutiIdevi(md).sort(), ["W01", "W15-win", "W99"]);
});

/* =========================================================================
 * Ugovor hvata ono što je jednom već prošlo
 * ====================================================================== */

test("START-HERE: hardkodovan hash se odbija", () => {
  const nalazi = proveriStartHere({
    tekst: "Paket odgovara izvornom stanju `90374b1`.\nwindows-smoke-result-<shortHead>.md\nsmoke/package-meta.json",
    runnerIdevi,
  });
  assert.ok(nalazi.some((n) => n.includes("90374b1")), nalazi.join(" | "));
});

test("START-HERE: obična reč od heks slova NIJE hash", () => {
  /*
   * `defaced` je sedam znakova i svi su heksadecimalni. Bez zahteva za cifrom
   * bi provera padala nad ispravnim uputstvom — a provera koja lupa se
   * isključuje, pa više ništa ne hvata.
   */
  const nalazi = proveriStartHere({
    tekst:
      "Nijedan fajl nije defaced.\nwindows-smoke-result-<shortHead>.md\nsmoke/package-meta.json\n" +
      "RUCNO-DPAPI-NALOG i RUCNO-TASK-APPLY su MANUAL_NOT_EXECUTED.",
    runnerIdevi,
  });
  assert.deepEqual(nalazi, []);
});

test("START-HERE: hardkodovano ime rezultata se odbija", () => {
  const nalazi = proveriStartHere({
    tekst: "Pošalji windows-smoke-result-2ffb15b.md\nsmoke/package-meta.json",
    runnerIdevi,
  });
  assert.ok(nalazi.some((n) => n.includes("hardkodovano")), nalazi.join(" | "));
});

test("START-HERE: zastarela grana se odbija", () => {
  const nalazi = proveriStartHere({
    tekst: "grana feature/biznisoft-sync-operations\nwindows-smoke-result-<shortHead>.md\nsmoke/package-meta.json",
    runnerIdevi,
  });
  assert.ok(nalazi.some((n) => n.includes("biznisoft-sync-operations")));
});

test("START-HERE: pomen provere koju runner nema se odbija", () => {
  const nalazi = proveriStartHere({
    tekst: "Provera `W42` pokriva sve.\nwindows-smoke-result-<shortHead>.md\nsmoke/package-meta.json",
    runnerIdevi,
  });
  assert.ok(nalazi.some((n) => n.includes("W42")));
});

test("ručne provere: „jedan preskočen [WIN] je očekivan“ se odbija", () => {
  /*
   * Kancelarijski smoke 45a3460: tu rečenicu su nosili START-HERE, runbook i
   * handoff, a paket je imao dva bezuslovna preskoka — `SMOKE PASS` nije bio
   * dostižan ni na ispravnoj mašini.
   */
  for (const tekst of [
    "tačno jedan preskočen [WIN] test je očekivan",
    "W15-win zato prihvata tačno jedan preskočen test",
    "ne brojati testove; jedan preskočen [WIN] je očekivan",
  ]) {
    const nalazi = rucneProvere(`${tekst}\nMANUAL_NOT_EXECUTED RUCNO-DPAPI-NALOG RUCNO-TASK-APPLY`);
    assert.ok(nalazi.some((n) => n.includes("očekivan")), `prošlo: ${tekst}`);
  }
});

test("ručne provere moraju biti imenovane kao MANUAL_NOT_EXECUTED", () => {
  assert.equal(rucneProvere("RUCNO-DPAPI-NALOG RUCNO-TASK-APPLY MANUAL_NOT_EXECUTED").length, 0);
  const nalazi = rucneProvere("Dve provere su ručne.");
  assert.ok(nalazi.some((n) => n.includes("MANUAL_NOT_EXECUTED")));
  assert.ok(nalazi.some((n) => n.includes("RUCNO-TASK-APPLY")));
});

test("runbook: `10/10` se odbija", () => {
  const nalazi = proveriRunbook({ tekst: "Uslov: SMOKE PASS, 10/10.", runnerIdevi });
  assert.ok(nalazi.some((n) => n.includes("10/10")), nalazi.join(" | "));
});

test("runbook: tvrdnja da smoke ima 10 testova se odbija", () => {
  const nalazi = proveriRunbook({ tekst: "## Svih 10 Windows smoke testova", runnerIdevi });
  assert.ok(nalazi.some((n) => n.includes("16 provera")), nalazi.join(" | "));
});

test("runbook: spisak provera koji odstupa od runnera se odbija", () => {
  const tekst = [
    "SMOKE PASS", "SMOKE INCOMPLETE", "WINDOWS-HANDOFF", SENTINEL,
    "| ID | Šta |", "|---|---|", "| `W01` | a |", "| `W02` | b |",
  ].join("\n");
  const nalazi = proveriRunbook({ tekst, runnerIdevi });
  assert.ok(nalazi.some((n) => n.includes("odstupa od runnera")), nalazi.join(" | "));
});

test("runbook: SHA-256 u dokumentu se odbija — hash pripada handoff-u", () => {
  const tekst = `SMOKE PASS SMOKE INCOMPLETE WINDOWS-HANDOFF ${SENTINEL} ${"a1".repeat(32)}`;
  const nalazi = proveriRunbook({ tekst, runnerIdevi });
  assert.ok(nalazi.some((n) => n.includes("SHA-256")), nalazi.join(" | "));
});

test("runbook: nalog da se paket pravi u kancelariji se odbija", () => {
  const tekst = `SMOKE PASS SMOKE INCOMPLETE WINDOWS-HANDOFF ${SENTINEL}\nnpm run connector:smoke:package`;
  const nalazi = proveriRunbook({ tekst, runnerIdevi });
  assert.ok(nalazi.some((n) => n.includes("ponovno pakovanje")), nalazi.join(" | "));
});

/* =========================================================================
 * Razorne naredbe nad pravom fakturom
 * ====================================================================== */

test("razorna naredba nad PDF-om se odbija", () => {
  for (const cmdlet of ["Add-Content", "Set-Content", "Rename-Item", "Remove-Item", "Move-Item", "Clear-Content"]) {
    const nalazi = razorneNaredbe(`${cmdlet} "<folder>\\faktura.pdf"`);
    assert.equal(nalazi.length, 1, `${cmdlet} je prošao`);
    assert.ok(nalazi[0].includes(cmdlet));
  }
});

test("ista naredba nad SENTINELOM prolazi", () => {
  assert.deepEqual(razorneNaredbe(`Remove-Item "<folder>\\${SENTINEL}"`), []);
});

test("razorna naredba se hvata i bez pomena .pdf", () => {
  // Naredba bez sentinela je nalaz i kada meta nije imenovana — meta se ne pogađa.
  assert.equal(razorneNaredbe("Remove-Item $put").length, 1);
});

/* =========================================================================
 * Handoff
 * ====================================================================== */

const ZIP_IME = "carsystem-windows-smoke-abc1234.zip";
const ZIP_SHA = "b".repeat(63) + "1";

function handoff(dodaci = "") {
  return [
    `# Windows handoff`,
    `**${HANDOFF_ZAGLAVLJE}**`,
    `| Arhiva | \`${ZIP_IME}\` |`,
    `| SHA-256 | \`${ZIP_SHA}\` |`,
    dodaci,
  ].join("\n");
}

test("ispravan handoff prolazi", () => {
  assert.deepEqual(
    proveriHandoff({ tekst: handoff(), zipIme: ZIP_IME, zipSha: ZIP_SHA, runnerIdevi }),
    [],
  );
});

test("handoff bez imena ZIP-a se odbija", () => {
  const tekst = handoff().replace(ZIP_IME, "neki-drugi.zip");
  const nalazi = proveriHandoff({ tekst, zipIme: ZIP_IME, zipSha: ZIP_SHA, runnerIdevi });
  assert.ok(nalazi.some((n) => n.includes("ime ZIP-a")), nalazi.join(" | "));
});

test("handoff bez stvarnog SHA-256 se odbija", () => {
  const tekst = handoff().replace(ZIP_SHA, "c".repeat(63) + "2");
  const nalazi = proveriHandoff({ tekst, zipIme: ZIP_IME, zipSha: ZIP_SHA, runnerIdevi });
  assert.ok(nalazi.some((n) => n.includes("stvarni SHA-256")), nalazi.join(" | "));
});

test("handoff sa TUĐIM hash-om pored ispravnog se odbija", () => {
  const tekst = handoff(`Stari: ${"d".repeat(63)}3`);
  const nalazi = proveriHandoff({ tekst, zipIme: ZIP_IME, zipSha: ZIP_SHA, runnerIdevi });
  assert.ok(nalazi.some((n) => n.includes("tuđ SHA-256")), nalazi.join(" | "));
});

test("handoff bez „OFFLINE SMOKE ONLY“ se odbija", () => {
  const tekst = handoff().replace(HANDOFF_ZAGLAVLJE, "smoke");
  const nalazi = proveriHandoff({ tekst, zipIme: ZIP_IME, zipSha: ZIP_SHA, runnerIdevi });
  assert.ok(nalazi.some((n) => n.includes("OFFLINE SMOKE ONLY")), nalazi.join(" | "));
});

test("handoff koji traži brisanje fakture se odbija", () => {
  const tekst = handoff('Remove-Item "<folder>\\faktura.pdf"');
  const nalazi = proveriHandoff({ tekst, zipIme: ZIP_IME, zipSha: ZIP_SHA, runnerIdevi });
  assert.ok(nalazi.some((n) => n.includes("Remove-Item")), nalazi.join(" | "));
});

/* =========================================================================
 * STVARNI fajlovi u repozitorijumu
 * ====================================================================== */

test("STVARNI START-HERE.md prolazi ugovor", () => {
  const nalazi = proveriStartHere({ tekst: citaj(START_HERE), runnerIdevi });
  assert.deepEqual(nalazi, [], `\n  - ${nalazi.join("\n  - ")}`);
});

test("STVARNI office runbook prolazi ugovor", () => {
  const nalazi = proveriRunbook({ tekst: citaj(RUNBOOK), runnerIdevi });
  assert.deepEqual(nalazi, [], `\n  - ${nalazi.join("\n  - ")}`);
});

test("runbook nabraja TAČNO one provere koje runner izvršava", () => {
  assert.deepEqual(dokumentovaneProvere(citaj(RUNBOOK)), runnerIdevi);
});

test("nijedan handoff dokument ne traži izmenu prave fakture", () => {
  for (const rel of [START_HERE, RUNBOOK]) {
    assert.deepEqual(razorneNaredbe(citaj(rel)), [], `${rel} nosi razornu naredbu`);
  }
});
