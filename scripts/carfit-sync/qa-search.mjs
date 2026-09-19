#!/usr/bin/env node
/**
 * C.A.R.FIT sync — QA pretrage nad STVARNIM search indeksom pokrenutog sajta.
 *
 * Za SVAKU zvaničnu šifru iz dataseta: upit po šifri mora vratiti njen proizvod
 * kao PRVI rezultat. Uz to reprezentativni upiti po nazivu, pakovanju,
 * granulaciji i varijanti. Skript ne pokreće server.
 *
 *   node scripts/carfit-sync/qa-search.mjs [--base-url=http://localhost:3220]
 */

import { buildSearchIndex, searchIndex } from "../../lib/search/engine.mjs";
import { readJson, writeJson } from "../carsystem-sync/lib/http.mjs";
import path from "node:path";
import { PATHS } from "./lib/config.mjs";

const baseUrl = process.argv.find((arg) => arg.startsWith("--base-url="))?.split("=")[1] ?? "http://localhost:3220";
const response = await fetch(`${baseUrl}/katalog/search-index.json`).catch(() => null);
if (!response?.ok) {
  console.error(`Search indeks nije dostupan na ${baseUrl}. Pokreni preview server pa ponovi.`);
  process.exit(1);
}
const index = buildSearchIndex((await response.json()).records);
const dataset = readJson(PATHS.siteDataset);

const expected = [];
for (const product of dataset.products) {
  for (const variant of product.variants) {
    expected.push({ query: variant.articleNumber, slug: product.slug, kind: "article" });
    // Alternativni zvanični zapis iste varijante (PDF 4-204-3600 uz sajt 4-304-3600) mora naći isti proizvod.
    for (const alternate of variant.alternateArticleNumbers ?? []) expected.push({ query: alternate.articleNumber, slug: product.slug, kind: "article (alternativni zapis)" });
  }
}
for (const [slug, enrichment] of Object.entries(dataset.enrichments)) for (const variant of enrichment.variants) expected.push({ query: variant.articleNumber, slug, kind: "article (dopuna ručnog zapisa)" });

const NAMED = [
  { query: "gold paper disc", slug: "carfit-gold-paper-disc", kind: "naziv" },
  { query: "rapid air clear coat", slug: "carfit-rapid-air-clear-coat-voc", kind: "naziv" },
  { query: "perfect multi green putty", slug: "carfit-perfect-multi-green-putty", kind: "naziv" },
  { query: "car fit red film", slug: "carfit-red-film-abrasive-discs", kind: "naziv" },
  { query: "purple ceramic film", slug: "carfit-purple-ceramic-film", kind: "naziv" },
  { query: "fast paint system", slug: "carfit-fast-paint-system", kind: "naziv" },
  { query: "ozone generator", slug: "carfit-ozone-generators", kind: "naziv" },
  { query: "car fit bezbojni lak", slugPrefix: "carfit-", kind: "tip proizvoda (SR)" },
  { query: "car fit git", slugPrefix: "carfit-", kind: "tip proizvoda (SR)" },
  { query: "car fit maskirna traka", slugPrefix: "carfit-", kind: "tip proizvoda (SR)" },
];

const failures = [];
const rankOf = (query, slug) => searchIndex(index, query, { limit: 50 }).findIndex((hit) => hit.record.id === slug || hit.record.href === `/proizvodi/${slug}`);

let articleFirst = 0;
for (const test of expected) {
  const rank = rankOf(test.query, test.slug);
  if (rank === 0) articleFirst += 1;
  else failures.push({ ...test, rank });
}
const named = NAMED.map((test) => {
  const hits = searchIndex(index, test.query, { limit: 10 });
  const top = hits[0]?.record.id ?? null;
  const ok = test.slug ? top === test.slug : Boolean(top?.startsWith(test.slugPrefix));
  if (!ok) failures.push({ ...test, top });
  return { ...test, top, ok };
});

const result = { baseUrl, articleQueries: expected.length, articleFirstResult: articleFirst, namedQueries: named, failures };
writeJson(path.join(PATHS.dataDir, "reports/search-qa.generated.json"), result);
console.log(JSON.stringify({ articleQueries: expected.length, articleFirstResult: articleFirst, named: named.map((test) => `${test.ok ? "✓" : "✖"} ${test.query} → ${test.top}`), failures: failures.slice(0, 15) }, null, 2));
if (failures.length) process.exitCode = 1;
