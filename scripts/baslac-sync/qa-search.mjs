#!/usr/bin/env node
/**
 * baslac sync — QA pretrage nad STVARNIM search indeksom pokrenutog sajta.
 *
 * Za SVAKU aktuelnu zvaničnu oznaku: upit po oznaci mora vratiti njen zapis kao PRVI
 * rezultat, i u pisanom obliku sa crticom („40-40") i bez nje („4040"). Uz to upiti po
 * zvaničnim nazivima sistema i po nazivima vrsta proizvoda.
 *
 * Zapis koji je varijanta porodice u indeksu stoji pod slugom svoje porodice, pa se traži
 * ili sam zapis ili njegova porodica — to je ono što kupac i dobije kao rezultat.
 */

import { buildSearchIndex, searchIndex } from "../../lib/search/engine.mjs";
import { readJson, writeJson } from "../carsystem-sync/lib/http.mjs";
import { loadCatalogRuntime } from "../lib/catalog-runtime.mjs";
import { PATHS } from "./lib/config.mjs";

const baseUrl = process.argv.find((arg) => arg.startsWith("--base-url="))?.split("=")[1] ?? "http://localhost:3220";
const response = await fetch(`${baseUrl}/katalog/search-index.json`).catch(() => null);
if (!response?.ok) {
  console.error(`Search indeks nije dostupan na ${baseUrl}. Pokreni preview server pa ponovi.`);
  process.exit(1);
}
const index = buildSearchIndex((await response.json()).records);
const plan = readJson(PATHS.plan);
const runtime = loadCatalogRuntime();
const bySlug = new Map(runtime.products.map((product) => [product.slug, product]));

/**
 * Prihvatljiv pogodak: sam zapis ili porodica u koju je konsolidovan.
 * Porodica u indeksu stoji pod `family:<slug>` — to je ono što kupac i otvori.
 */
const acceptableFor = (slug) => {
  const product = bySlug.get(slug);
  const family = product ? runtime.getFamilyForProduct(product) : null;
  return new Set([slug, family?.slug, family ? `family:${family.slug}` : null].filter(Boolean));
};

const expected = plan.items
  .filter((item) => item.code && item.slug && (item.action === "IMPORT" || item.action === "ENRICH_EXISTING"))
  .flatMap((item) => [
    { kind: "oznaka", query: item.code, slug: item.slug },
    { kind: "oznaka bez crtice", query: item.code.replace(/-/g, ""), slug: item.slug },
  ]);

const NAMED = [
  { kind: "sistem", query: "Topcoat 30", sourceKey: "line-30" },
  { kind: "sistem", query: "Topcoat 30 CV", sourceKey: "line-30-cv" },
  { kind: "sistem", query: "Basecoat 35", sourceKey: "line-35" },
  { kind: "sistem", query: "Basecoat 45", sourceKey: "line-45" },
  { kind: "bezbojni lak", query: "Universal Clear", code: "40-40" },
  { kind: "kit", query: "Bodyfiller Universal", code: "12-20" },
  { kind: "washprimer", query: "Washprimer", code: "27-10" },
  { kind: "aditiv", query: "Additive Flex", code: "80-10" },
];
const slugByKey = new Map(plan.items.map((item) => [item.sourceKey, item.slug]));
const slugByCode = new Map(plan.items.filter((item) => item.code).map((item) => [item.code, item.slug]));

const failures = [];
let first = 0;
for (const test of expected) {
  const accept = acceptableFor(test.slug);
  const rank = searchIndex(index, test.query, { limit: 50 }).findIndex((hit) => accept.has(hit.record.id));
  if (rank === 0) first += 1;
  else failures.push({ ...test, rank });
}
const named = NAMED.map((test) => {
  const top = searchIndex(index, test.query, { limit: 10 })[0]?.record.id ?? null;
  const wanted = acceptableFor(test.code ? slugByCode.get(test.code) : slugByKey.get(test.sourceKey));
  const ok = wanted.has(top);
  if (!ok) failures.push({ ...test, want: [...wanted], top });
  return { ...test, want: [...wanted], top, ok };
});

writeJson(PATHS.searchQa, { codeQueries: expected.length, codeFirstResult: first, namedQueries: named, failures });
console.log(JSON.stringify({ codeQueries: expected.length, codeFirstResult: first, named: named.map((test) => `${test.ok ? "✓" : "✖"} [${test.kind}] ${test.query} → ${test.top}`), failures: failures.slice(0, 15) }, null, 2));
if (failures.length) process.exitCode = 1;
