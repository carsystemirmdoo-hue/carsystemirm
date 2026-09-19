#!/usr/bin/env node
/**
 * R-M sync — QA pretrage nad STVARNIM search indeksom pokrenutog sajta.
 *
 * Za SVAKU zvaničnu oznaku: upit po oznaci mora vratiti njen proizvod kao PRVI rezultat,
 * i u pisanom obliku sa razmakom („C 2A64”) i bez nje („c2a64”). Uz to upiti po nazivu,
 * seriji, liniji i sistemskim komponentama.
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
const plan = readJson(PATHS.plan);

const expected = plan.items.filter((item) => item.code && item.slug).flatMap((item) => [
  { kind: "oznaka", query: item.code, slug: item.slug },
  { kind: "oznaka bez razmaka", query: item.code.replace(/\s+/g, ""), slug: item.slug },
]);

/*
 * Imenovani upiti se proveravaju po OZNACI, ne po obliku slug-a: zapisi koje već vodimo
 * (`rm:import`) zadržavaju svoj slug bez „rm-” prefiksa, pa bi provera po prefiksu merila
 * istoriju uvoza umesto rezultata pretrage. `anyOfCodes` = bilo koji član porodice po nazivu.
 */
const NAMED = [
  // „GlossTOP+” bez izgovorenog plusa je dvosmisleno (postoji i „GlossTOP”), pa se traži oblik koji kupac zaista razlikuje.
  { kind: "naziv", query: "GlossTOP plus", code: "C 2A64" },
  { kind: "naziv", query: "MultiPROTECT Grey", code: "P 2A63" },
  { kind: "sistem", query: "AGILIS eSense", code: "AGILIS eSense" },
  { kind: "sistem", query: "ONYX HD", code: "ONYX HD" },
  { kind: "učvršćivač", query: "CLEAR Harden-R", anyOfCodes: ["H 2P05", "H 2P15", "H 2P25", "H 2P35"] },
  { kind: "razređivač", query: "MultiTHINN", anyOfCodes: ["R 2A14", "R 2A24", "R 2A34"] },
  { kind: "kit", query: "PerformBODY", anyOfCodes: ["B 2A16", "B 2A16C", "B 2A16CL"] },
  { kind: "čistač", query: "SILICONE Remov-R", code: "PK 1P10" },
  { kind: "komponenta sistema", query: "AGILIS MIX", anyOfCodes: ["RA 040", "RA 050", "RA 050X", "RA 220"] },
];
const slugByCode = new Map(plan.items.filter((item) => item.code).map((item) => [item.code, item.slug]));

const failures = [];
let first = 0;
for (const test of expected) {
  const rank = searchIndex(index, test.query, { limit: 50 }).findIndex((hit) => hit.record.id === test.slug);
  if (rank === 0) first += 1;
  else failures.push({ ...test, rank });
}
const named = NAMED.map((test) => {
  const top = searchIndex(index, test.query, { limit: 10 })[0]?.record.id ?? null;
  const wanted = test.code ? [slugByCode.get(test.code)] : (test.anyOfCodes ?? []).map((code) => slugByCode.get(code));
  const ok = wanted.includes(top);
  if (!ok) failures.push({ ...test, want: wanted, top });
  return { ...test, want: wanted, top, ok };
});

writeJson(PATHS.searchQa, { codeQueries: expected.length, codeFirstResult: first, namedQueries: named, failures });
console.log(JSON.stringify({ codeQueries: expected.length, codeFirstResult: first, named: named.map((test) => `${test.ok ? "✓" : "✖"} [${test.kind}] ${test.query} → ${test.top}`), failures: failures.slice(0, 15) }, null, 2));
if (failures.length) process.exitCode = 1;
