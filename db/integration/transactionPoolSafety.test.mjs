import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

/**
 * Unutar transakcije nijedan upit ne sme ići preko druge veze iz pool-a.
 *
 * Regresija (revizija 2026-10-11, B0/B11): slanje zahteva je držalo
 * transakciju i usput čitalo cene preko `getDb()`; sa `DATABASE_POOL_MAX=1`
 * server je čekao sam sebe, sa većim pool-om — pri istovremenim slanjima.
 * Statička provera nad izvorom: (1) u telu `.transaction(async (tx) => …)` i
 * (2) u funkciji koja prima izvršioca (`tx`, `exec`, `q`, `executor`), svaki
 * poziv funkcije koja koristi `getDb()` mora proslediti tog izvršioca.
 * Dinamička provera istog: `orderRequestSingleConnection.integration.test.mts`.
 */
const ROOT = new URL("../../", import.meta.url);

async function walk(dir) {
  const out = [];
  for (const e of await readdir(new URL(dir, ROOT), { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (/\.(ts|mjs)$/.test(e.name) && !/\.test\./.test(e.name)) out.push(p);
  }
  return out;
}

function span(s, i, open, close) {
  let d = 1;
  while (d && i < s.length) {
    if (s[i] === open) d += 1;
    else if (s[i] === close) d -= 1;
    i += 1;
  }
  return i;
}

const files = [...(await walk("lib")), ...(await walk("app"))];
const sources = new Map(await Promise.all(files.map(async (f) => [f, await readFile(new URL(f, ROOT), "utf8")])));

/** Imena async funkcija čije telo zove `getDb()`. */
const usesDb = new Set();
const fnDefs = [];
for (const [f, s] of sources) {
  for (const m of s.matchAll(/async\s+function\s+(\w+)\s*(?:<[^>]*>)?\(/g)) {
    const pe = span(s, m.index + m[0].length, "(", ")");
    const bi = s.indexOf("{", pe);
    if (bi < 0) continue;
    const be = span(s, bi + 1, "{", "}");
    const body = s.slice(bi + 1, be);
    const params = s.slice(m.index + m[0].length, pe - 1);
    // I `q = getDb()` kao podrazumevani parametar: poziv bez izvršioca ide preko pool-a.
    if (body.includes("getDb()") || params.includes("getDb()")) usesDb.add(m[1]);
    fnDefs.push({ f, name: m[1], params, body, line: s.slice(0, m.index).split("\n").length });
  }
}

function unpassed(body, param, self) {
  const bad = [];
  for (const c of body.matchAll(/\b([A-Za-z_]\w*)\(/g)) {
    if (!usesDb.has(c[1]) || c[1] === self) continue;
    const start = c.index + c[0].length;
    const args = body.slice(start, span(body, start, "(", ")") - 1);
    if (!new RegExp(`\\b${param}\\b`).test(args)) bad.push(c[1]);
  }
  return [...new Set(bad)];
}

test("telo transakcije ne zove funkciju sa getDb() bez tx", () => {
  const found = [];
  for (const [f, s] of sources) {
    for (const m of s.matchAll(/\.transaction\(\s*async\s*\((\w+)\)\s*(?::[^=]*)?=>\s*\{/g)) {
      const start = m.index + m[0].length;
      const body = s.slice(start, span(s, start, "{", "}"));
      const bad = unpassed(body, m[1], null);
      if (body.includes("getDb()")) bad.push("getDb() direktno");
      if (bad.length) found.push(`${f}:${s.slice(0, m.index).split("\n").length} → ${bad.join(", ")}`);
    }
  }
  assert.deepEqual(found, []);
});

test("funkcija koja prima izvršioca prosleđuje ga dalje", () => {
  const found = [];
  for (const d of fnDefs) {
    const p = d.params.match(/\b(tx|exec|executor|q)\s*[:?=]/)?.[1];
    if (!p) continue;
    const bad = unpassed(d.body, p, d.name);
    if (bad.length) found.push(`${d.f}:${d.line} ${d.name}(${p}) → ${bad.join(", ")}`);
  }
  assert.deepEqual(found, []);
});

test("provera stvarno vidi poznate slučajeve (nije prazna)", () => {
  for (const name of ["customerPrices", "approvedPaymentOptions", "trialCustomerIds", "loadDatasetInfo"]) {
    assert.ok(usesDb.has(name), `${name} se ne prepoznaje kao funkcija sa getDb()`);
  }
});
