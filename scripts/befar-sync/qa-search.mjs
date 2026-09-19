#!/usr/bin/env node
/**
 * BEFAR sync — QA pretrage nad STVARNIM search indeksom pokrenutog sajta.
 *
 * Za SVAKU zvaničnu šifru: upit po šifri mora vratiti njen proizvod kao PRVI rezultat.
 * Uz to upiti po nazivu, liniji, boji, dimenziji, prečniku i broju rupa. Skript ne pokreće server.
 *
 *   node scripts/befar-sync/qa-search.mjs [--base-url=http://localhost:3220]
 */

import { buildSearchIndex, searchIndex } from "../../lib/search/engine.mjs";
import { readJson, writeJson } from "../carsystem-sync/lib/http.mjs";
import { PATHS } from "./lib/config.mjs";

const baseUrl = process.argv.find((arg) => arg.startsWith("--base-url="))?.split("=")[1] ?? "http://localhost:3220";
const response = await fetch(`${baseUrl}/katalog/search-index.json`).catch(() => null);
if (!response?.ok) {
  console.error(`Search indeks nije dostupan na ${baseUrl}. Pokreni preview server pa ponovi.`);
  process.exit(1);
}
const index = buildSearchIndex((await response.json()).records);
const dataset = readJson(PATHS.siteDataset);
const bySourceKey = new Map(dataset.products.map((product) => [product.sourceKey, product.slug]));

const expected = dataset.products.flatMap((product) => product.variants.map((variant) => ({ query: variant.code, slug: product.slug })));
const NAMED = [
  { kind: "naziv", query: "befar liquid compound", sourceKey: "liquid-compound" },
  { kind: "naziv", query: "anti hologram", sourceKey: "anti-hologram" },
  { kind: "naziv", query: "waffle velcro polishing pad", sourceKey: "waffle-velcro-polishing-pad" },
  { kind: "linija", query: "leo hamburger", sourceKey: "leo-hamburger-pad" },
  { kind: "linija", query: "turkuaz polish", sourceKey: "turkuaz-polish" },
  { kind: "linija", query: "leo", slugPrefix: "befar-leo" },
  { kind: "set", query: "headlight cleaning set", sourceKey: "headlight-cleaning-set" },
  { kind: "boja + dimenzija", query: "befar narandžasta 220 × 35 mm", sourceKey: "carved-velcro-polishing-pad" },
  { kind: "prečnik", query: "soft velcro backing pad 170 mm", sourceKey: "soft-velcro-backing-pad" },
  { kind: "broj rupa", query: "befar 62 rupa", sourceKey: "backing-pad" },
  { kind: "veličina", query: "befar 1000 g", slugPrefix: "befar-" },
  { kind: "turski naziv", query: "maskeleme folyosu", slugPrefix: "befar-" },
];

const failures = [];
let first = 0;
for (const test of expected) {
  const rank = searchIndex(index, test.query, { limit: 50 }).findIndex((hit) => hit.record.id === test.slug);
  if (rank === 0) first += 1;
  else failures.push({ ...test, rank });
}
const named = NAMED.map((test) => {
  const top = searchIndex(index, test.query, { limit: 10 })[0]?.record.id ?? null;
  const want = test.sourceKey ? bySourceKey.get(test.sourceKey) : null;
  const ok = test.sourceKey ? top === want : Boolean(top?.startsWith(test.slugPrefix));
  if (!ok) failures.push({ ...test, want, top });
  return { ...test, want, top, ok };
});

writeJson(PATHS.searchQa, { codeQueries: expected.length, codeFirstResult: first, namedQueries: named, failures });
console.log(JSON.stringify({ codeQueries: expected.length, codeFirstResult: first, named: named.map((test) => `${test.ok ? "✓" : "✖"} [${test.kind}] ${test.query} → ${test.top}`), failures: failures.slice(0, 15) }, null, 2));
if (failures.length) process.exitCode = 1;
