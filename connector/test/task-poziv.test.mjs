import assert from "node:assert/strict";
import test from "node:test";

import { oceniPozivSkripte, satnica } from "./task-poziv.mjs";

/**
 * Ocena poziva .ps1 — svaki ishod koji NIJE rad same skripte mora biti
 * imenovan, nikad „prošlo“. Kancelarija d5e03d1: Avast je prijavio blokadu
 * `task.ps1`, a smoke je bio zelen i bez vremena poziva.
 */

const P = new Date(2026, 9, 7, 8, 13, 50);
const K = new Date(2026, 9, 7, 8, 13, 51, 250);
const DRY = { ocekivanKod: 0, oznaka: /\[dry-run\]/, pocetak: P, kraj: K };
const ODBIJ = { ocekivanKod: 1, oznaka: /-Mode je obavezan/, pocetak: P, kraj: K };

test("ispravan dry-run: ok, detalj nosi vreme i izlaz", () => {
  const o = oceniPozivSkripte({ ...DRY, kod: 0, stdout: "[WARN] x\n[dry-run] Registrujem ..." });
  assert.equal(o.ishod, "ok");
  assert.equal(o.detalj, "08:13:50–08:13:51 (1250 ms), izlaz 0");
});

test("ispravno odbijanje: tačno izlaz 1 i poruka skripte", () => {
  const o = oceniPozivSkripte({ ...ODBIJ, kod: 1, stderr: "-Mode je obavezan za -Action install\nFullyQualifiedErrorId : RuntimeException" });
  assert.equal(o.ishod, "ok");
});

test("proces ubijen spolja (null kod ili tišina) NIJE odbijanje", () => {
  for (const r of [
    { kod: null, signal: "SIGTERM" },
    { kod: 1, stdout: "", stderr: "" },
    { kod: -1073741510, stdout: "" },
    { kod: 3221225786, stdout: "" },
  ]) {
    const o = oceniPozivSkripte({ ...ODBIJ, ...r });
    assert.equal(o.ishod, "prekinuto", JSON.stringify(r));
    assert.equal(o.kod, "task_script_blocked_or_killed");
  }
  // Isto i za dry-run: izlaz 0 bez oznake je nedovršen rad, ne PASS.
  assert.equal(oceniPozivSkripte({ ...DRY, kod: 1, stdout: "" }).ishod, "prekinuto");
});

test("AMSI/antivirus i politika izvršavanja dobijaju svoje kodove", () => {
  assert.equal(
    oceniPozivSkripte({ ...DRY, kod: 1, stderr: "This script contains malicious content and has been blocked by your antivirus software.\nFullyQualifiedErrorId : ScriptContainedMaliciousContent" }).kod,
    "task_script_blocked_by_antivirus",
  );
  assert.equal(
    oceniPozivSkripte({ ...DRY, kod: 1, stderr: "FullyQualifiedErrorId : UnauthorizedAccess" }).kod,
    "task_script_blocked_by_policy",
  );
});

test("odbijanje iz POGREŠNOG razloga ili pogrešan izlaz ne prolazi", () => {
  assert.equal(
    oceniPozivSkripte({ ...ODBIJ, kod: 1, stderr: "Ne postoji connector.cmd\nFullyQualifiedErrorId : RuntimeException" }).kod,
    "task_script_marker_missing",
  );
  assert.equal(oceniPozivSkripte({ ...DRY, kod: 2, stdout: "[dry-run] x" }).kod, "task_script_wrong_exit");
  assert.equal(oceniPozivSkripte({ ...DRY, kod: 0, stdout: "Registrovano." }).kod, "task_script_marker_missing");
});

test("detalj ne nosi putanje ni poruke skripte", () => {
  const o = oceniPozivSkripte({
    ...ODBIJ, kod: 1,
    stderr: "C:\\Users\\Korisnik\\Desktop\\x\\task.ps1 : -Mode je obavezan\nFullyQualifiedErrorId : RuntimeException",
  });
  assert.doesNotMatch(o.detalj, /Users|Korisnik|obavezan/);
  assert.equal(satnica(new Date(2026, 0, 1, 7, 5, 9)), "07:05:09");
});
