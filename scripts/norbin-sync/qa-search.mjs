#!/usr/bin/env node
/**
 * Norbin sync — QA pretrage nad STVARNIM search indeksom pokrenutog sajta.
 *
 * Za SVAKU aktuelnu EMEA oznaku: upit po oznaci mora vratiti njen zapis kao PRVI rezultat,
 * i sa crticom („N15-020") i bez nje („n15020"). Uz to upiti po zvaničnim nazivima.
 * Komponenta bez zvaničnog identiteta (N85-025) ne sme da bude pronađiva.
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

/** Prihvatljiv pogodak: sam zapis ili porodica u koju je konsolidovan. */
const acceptableFor = (slugs) => {
  const out = new Set();
  for (const slug of slugs) {
    out.add(slug);
    const family = runtime.getFamilyForProduct(bySlug.get(slug));
    if (family) out.add(family.slug).add(`family:${family.slug}`);
  }
  return out;
};

const emea = plan.items.filter((item) => item.status === "CURRENT_EMEA");
const expected = emea.flatMap((item) => {
  const slugs = item.family ? item.family.members.map((member) => member.slug) : [item.slug];
  return [
    { kind: "oznaka", query: item.code, slugs },
    { kind: "oznaka bez crtice", query: item.code.replace(/-/g, ""), slugs },
  ];
});

const NAMED = emea.map((item) => ({ kind: "naziv", query: item.officialName, slugs: item.family ? item.family.members.map((member) => member.slug) : [item.slug] }));

const failures = [];
let first = 0;
for (const test of expected) {
  const accept = acceptableFor(test.slugs);
  const rank = searchIndex(index, test.query, { limit: 50 }).findIndex((hit) => accept.has(hit.record.id));
  if (rank === 0) first += 1;
  else failures.push({ ...test, rank });
}
const named = NAMED.map((test) => {
  const accept = acceptableFor(test.slugs);
  const top = searchIndex(index, test.query, { limit: 10 })[0]?.record.id ?? null;
  const ok = accept.has(top);
  if (!ok) failures.push({ ...test, top });
  return { query: test.query, top, ok };
});

/*
 * Komponenta koju izvor ne objavljuje ne sme da IMA zapis ni da bude pojam pretrage.
 *
 * Ne traži se prazan rezultat: upit „N85-025" prirodno izbaci najbližu postojeću oznaku
 * (`N85-021`), što je ponašanje pretrage, ne lažni proizvod. Meri se ono što jeste pravilo —
 * nijedan zapis ne nosi tu oznaku niti je ima među svojim pojmovima pretrage.
 */
const hidden = (plan.referencedOnly ?? []).map((entry) => {
  const owner = runtime.products.find((product) => product.manufacturerCode === entry.code || product.sku === entry.code);
  const inTerms = runtime.products.filter((product) => (product.searchTerms ?? []).some((term) => String(term).includes(entry.code)));
  if (owner) failures.push({ kind: "ima zapis, a nema zvanični identitet", query: entry.code, slug: owner.slug });
  for (const product of inTerms) failures.push({ kind: "ušao u pojmove pretrage", query: entry.code, slug: product.slug });
  const nearest = searchIndex(index, entry.code, { limit: 1 })[0]?.record.id ?? null;
  return { code: entry.code, hasRecord: Boolean(owner), inSearchTerms: inTerms.length, nearestHit: nearest };
});

writeJson(PATHS.searchQa, { codeQueries: expected.length, codeFirstResult: first, namedQueries: named, hidden, failures });
console.log(JSON.stringify({ codeQueries: expected.length, codeFirstResult: first, named: named.map((test) => `${test.ok ? "✓" : "✖"} ${test.query} → ${test.top}`), hidden, failures: failures.slice(0, 10) }, null, 2));
if (failures.length) process.exitCode = 1;
