/**
 * Cross-sync determinizam: `<brand>:sync:check` jednog proizvođača ne sme da promeni
 * nijedan generisani fajl — ni svoj ni tuđi — samo zato što je u globalni katalog
 * kasnije dodat drugi proizvođač.
 *
 * Povod: Carfit plan je u svoj izveštaj upisivao veličinu CELOG kataloga
 * (`catalogProductsTotalBefore`), pa je Befar uvoz (+56) uprljao dva commitovana
 * Carfit fajla pri prvom sledećem `carfit:sync:check`.
 *
 * Test ne nabraja brendove: otkriva svaki `scripts/<brand>-sync/` koji ima
 * `<brand>:sync:check`, pa četvrti sync automatski ulazi u proveru. „Kasnije dodat
 * proizvođač” se simulira šavom `CATALOG_RUNTIME_FOREIGN_PRODUCTS` u
 * `scripts/lib/catalog-runtime.mjs`.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const scripts = JSON.parse(readFileSync(path.join(REPO_ROOT, "package.json"), "utf8")).scripts;

const brands = readdirSync(path.join(REPO_ROOT, "scripts"))
  .filter((name) => name.endsWith("-sync") && existsSync(path.join(REPO_ROOT, "scripts", name, "apply.mjs")))
  .map((name) => name.replace(/-sync$/, ""))
  .filter((brand) => scripts[`${brand}:sync:check`])
  .sort();

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

/** Svi generisani izlazi svih sync-eva: podaci, izveštaji, registri i dataset sajta. */
function outputFiles() {
  return brands
    .flatMap((brand) => [...walk(path.join(REPO_ROOT, "data", `${brand}-sync`)), path.join(REPO_ROOT, "data", `${brand}-catalog-products.generated.json`)])
    .filter((file) => existsSync(file))
    .sort();
}

const sha = (buffer) => createHash("sha256").update(buffer).digest("hex");

function snapshot() {
  return new Map(outputFiles().map((file) => [file, readFileSync(file)]));
}

function restore(before) {
  for (const file of outputFiles()) if (!before.has(file)) rmSync(file);
  for (const [file, content] of before) if (!existsSync(file) || sha(readFileSync(file)) !== sha(content)) writeFileSync(file, content);
}

function changedAgainst(before) {
  const now = snapshot();
  return [...new Set([...before.keys(), ...now.keys()])]
    .filter((file) => !before.has(file) || !now.has(file) || sha(before.get(file)) !== sha(now.get(file)))
    .map((file) => path.relative(REPO_ROOT, file));
}

function runCheck(brand, env = {}) {
  return execFileSync("npm", ["run", "-s", `${brand}:sync:check`], { cwd: REPO_ROOT, env: { ...process.env, ...env }, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
}

const filesChangedOf = (stdout) => JSON.parse(/"filesChanged":\s*(\[[^\]]*\])/.exec(stdout)?.[1] ?? "null");

test("otkriveno je svih osam brand sync-eva (i svaki budući ulazi sam)", () => {
  for (const brand of ["carsystem", "carfit", "befar", "rm", "baslac", "norbin", "sata", "cosmos-lac"]) assert.ok(brands.includes(brand), `nedostaje ${brand}:sync:check`);
});

for (const brand of brands) {
  test(`${brand}:sync:check ne menja nijedan generisani fajl nijednog brenda`, () => {
    const before = snapshot();
    try {
      assert.deepEqual(filesChangedOf(runCheck(brand)), [], `${brand}: apply --check prijavljuje izmene`);
      assert.deepEqual(changedAgainst(before), []);
    } finally {
      restore(before);
    }
  });

  test(`${brand}:sync:check daje isti izlaz i kada je u katalog dodat drugi proizvođač`, () => {
    const before = snapshot();
    try {
      assert.deepEqual(filesChangedOf(runCheck(brand, { CATALOG_RUNTIME_FOREIGN_PRODUCTS: "37" })), [], `${brand}: apply --check prijavljuje izmene`);
      assert.deepEqual(changedAgainst(before), [], `${brand}: izlaz zavisi od tuđih proizvoda u globalnom katalogu`);
    } finally {
      restore(before);
    }
  });
}
