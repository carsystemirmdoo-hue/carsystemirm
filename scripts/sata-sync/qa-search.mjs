#!/usr/bin/env node
/**
 * SATA sync — QA pretrage nad STVARNIM search indeksom pokrenutog sajta.
 *
 * Za SVAKI od zvaničnih brojeva artikala u opsegu: upit po broju mora vratiti karticu NJEGOVE
 * porodice kao prvi rezultat. Uz to upiti po nazivu porodice, zvaničnom (i nemačkom) nazivu i
 * konfiguraciji. Brojevi artikala faze 2 se NE računaju u pokrivenost. Skript ne pokreće server.
 *
 *   node scripts/sata-sync/qa-search.mjs [--base-url=http://localhost:3220]
 */

import { buildSearchIndex, searchIndex } from "../../lib/search/engine.mjs";
import { readJson, writeJson } from "../carsystem-sync/lib/http.mjs";
import { PATHS, SCOPE_NAME } from "./lib/config.mjs";

const baseUrl = process.argv.find((arg) => arg.startsWith("--base-url="))?.split("=")[1] ?? "http://localhost:3220";
const response = await fetch(`${baseUrl}/katalog/search-index.json`).catch(() => null);
if (!response?.ok) {
  console.error(`Search indeks nije dostupan na ${baseUrl}. Pokreni preview server pa ponovi.`);
  process.exit(1);
}
const index = buildSearchIndex((await response.json()).records);
const dataset = readJson(PATHS.siteDataset);
const entries = [...dataset.products, ...Object.values(dataset.enrichments)];
const slugOf = (familyId) => entries.find((entry) => entry.familyId === familyId)?.slug;

const expected = entries.flatMap((entry) => entry.variants.map((variant) => ({ query: variant.articleNumber, slug: entry.slug })));
const NAMED = [
  { kind: "postojeći naziv", query: "SATAjet X 5500", familyId: "CF1931072" },
  { kind: "postojeći naziv (malim slovima)", query: "satajet x 5500", familyId: "CF1931072" },
  { kind: "stara lokalna oznaka (legacy alias)", query: "SATA-X5500", familyId: "CF1931072" },
  { kind: "zvanični identifikator porodice", query: "CF1931072", familyId: "CF1931072" },
  { kind: "zvanična neprevedena vrednost ose", query: "Druckbecher BVD", familyId: "CF1931080" },
  { kind: "naziv porodice", query: "jet X", familyId: "CF1931336" },
  { kind: "naziv porodice", query: "SATAjet 5000 B", familyId: "CF1931074" },
  { kind: "naziv porodice", query: "SATAminijet 4400 B", familyId: "CF1931085" },
  { kind: "naziv porodice", query: "adam X pro", familyId: "CF1931340" },
  { kind: "naziv porodice", query: "air vision 5000", familyId: "CF1931121" },
  { kind: "naziv porodice", query: "SATA multi clean 2", familyId: "CF1931313" },
  { kind: "naziv porodice", query: "RPS the Original", familyId: "CF1931348" },
  { kind: "naziv porodice", query: "SATA filter 500 series", familyId: "CF1931293" },
  { kind: "naziv porodice", query: "SATA suit Basic", familyId: "CF1931345" },
  { kind: "nemački zvanični naziv", query: "Luftmikrometer", familyId: "CF1931351" },
  { kind: "srpski prikaz", query: "mikrometar vazduha", familyId: "CF1931351" },
  { kind: "nemački zvanični naziv", query: "Lackierpistolenkoffer", familyId: "CF1931357" },
  { kind: "zvanični identifikator porodice", query: "CF1931336", familyId: "CF1931336" },
  { kind: "alias porodice", query: "CF1931344", familyId: "CF1931343" },
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
  const want = slugOf(test.familyId);
  const ok = top === want;
  if (!ok) failures.push({ ...test, want, top });
  return { ...test, want, top, ok };
});

writeJson(PATHS.searchQa, { scope: SCOPE_NAME, articleNumberQueries: expected.length, articleNumberFirstResult: first, namedQueries: named, failures });
console.log(JSON.stringify({ scope: SCOPE_NAME, articleNumberQueries: expected.length, articleNumberFirstResult: first, named: named.map((test) => `${test.ok ? "✓" : "✖"} [${test.kind}] ${test.query} → ${test.top}`), failures: failures.slice(0, 15), failureCount: failures.length }, null, 2));
if (failures.length) process.exitCode = 1;
