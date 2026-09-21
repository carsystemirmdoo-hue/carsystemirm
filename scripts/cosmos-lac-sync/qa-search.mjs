#!/usr/bin/env node
/**
 * Cosmos Lac sync — QA pretrage nad STVARNIM search indeksom pokrenutog sajta.
 *
 * Za svaki aktuelni identitet: upit „zvanični naziv” i upit po zvaničnoj adresi moraju vratiti NJEGOV
 * zapis ili karticu njegove porodice među prvih pet, a upit „linija + šifra” kao prvi rezultat tamo
 * gde je šifra jedinstvena u liniji. Uz to: RAL, lokalni nazivi i legacy zapisi. Skript ne pokreće server.
 *
 *   node scripts/cosmos-lac-sync/qa-search.mjs [--base-url=http://localhost:3220]
 */

import { buildSearchIndex, searchIndex } from "../../lib/search/engine.mjs";
import { readJson, writeJson } from "../carsystem-sync/lib/http.mjs";
import { PATHS } from "./lib/config.mjs";

const baseUrl = process.argv.find((arg) => arg.startsWith("--base-url="))?.split("=")[1] ?? "http://localhost:3220";
const response = await fetch(`${baseUrl}/katalog/search-index.json`).catch(() => null);
if (!response?.ok) { console.error(`Search indeks nije dostupan na ${baseUrl}.`); process.exit(1); }
const payload = await response.json();
const index = buildSearchIndex(payload.records);
const ids = new Set(payload.records.map((record) => record.id));
const dataset = readJson(PATHS.siteDataset);
const local = new Map(readJson(PATHS.localDataset).map((record) => [record.slug, record]));
const entries = [...Object.entries(dataset.enrichments).map(([slug, sync]) => ({ slug, sync, record: local.get(slug) })), ...dataset.products.map((product) => ({ slug: product.slug, sync: product.sync, record: product }))];

// „Linija + šifra” jednoznačno pogađa zapis samo kada je šifra jedinstvena u liniji i nije ista kao mera pakovanja
// („Spray.Bike 400” uz „400 ml”; „High Heat 350” je i sprej i limenka). Takvi upiti se broje zasebno, ne kao promašaj.
const codeOf = (record) => record.cosmosCode ?? (record.ralCode ? `RAL ${record.ralCode}` : null);
const codeOwners = new Map();
for (const entry of entries) { const code = codeOf(entry.record); if (code) codeOwners.set(`${entry.record.line}|${code}`, (codeOwners.get(`${entry.record.line}|${code}`) ?? 0) + 1); }
const isAmbiguousCode = (record) => { const code = codeOf(record); return codeOwners.get(`${record.line}|${code}`) > 1 || String(record.volume ?? "").split(/\D+/).includes(String(code).replace(/\D/g, "")); };
let ambiguousCodeQueries = 0;

const run = (query, slug, limit) => searchIndex(index, query, { limit }).map((hit) => hit.record.id).includes(slug);
const stats = { officialName: [0, 0], officialSlug: [0, 0], lineAndCode: [0, 0], localName: [0, 0], legacyLocalName: [0, 0] };
const failures = [];
for (const entry of entries) {
  if (!ids.has(entry.slug)) { failures.push({ slug: entry.slug, problem: "NOT_IN_INDEX" }); continue; }
  const check = (kind, query, limit) => { stats[kind][1] += 1; if (run(query, entry.slug, limit)) stats[kind][0] += 1; else failures.push({ kind, query, slug: entry.slug }); };
  if (entry.sync.status === "LEGACY_LOCAL_ONLY") { check("legacyLocalName", entry.record.officialName, 5); continue; }
  check("localName", entry.record.officialName, 5);
  if (entry.sync.officialName) check("officialName", entry.sync.officialName, 5);
  if (entry.sync.officialSlug) check("officialSlug", entry.sync.officialSlug, 5);
  const code = entry.record.cosmosCode ?? (entry.record.ralCode ? `RAL ${entry.record.ralCode}` : null);
  if (code && isAmbiguousCode(entry.record)) ambiguousCodeQueries += 1;
  else if (code) check("lineAndCode", `${entry.record.line} ${code}`, 5);
}
const NAMED = [
  ["zvanična šifra", "FO-314", "cosmos-lac-flame-orange-fo-314-piglet-pink-dark"],
  ["RAL + završni sloj", "RAL 9003 matt", "cosmos-lac-ral-9003-matt-signal-white"],
  ["novi proizvod", "Acrylic Varnish 376", "cosmos-lac-acrylic-varnish-376-gloss"],
  ["novi proizvod", "High Heat Container", "cosmos-lac-high-heat-350-silver-container"],
  ["novi proizvod", "Chrome Effect 450 Container", "cosmos-lac-chrome-effect-450-container"],
  ["podeljena kartica", "Silicone Oil 203", [...local.values()].find((record) => /Silicone Oil 203/.test(record.officialName)).slug],
  ["podeljena kartica", "Copper Grease", [...local.values()].find((record) => /Copper Grease/i.test(record.officialName)).slug],
  ["drugi jezici sajta", "Antichip 250", [...local.values()].find((record) => /Antichip 250/.test(record.officialName)).slug],
  ["legacy", "Molotow Premium MP-001", [...local.values()].find((record) => record.cosmosCode === "MP-001").slug],
].map(([kind, query, slug]) => { const top = searchIndex(index, query, { limit: 5 }).map((hit) => hit.record.id); const ok = top.includes(slug); if (!ok) failures.push({ kind, query, slug, top }); return { kind, query, slug, ok, top: top[0] }; });

const summary = Object.fromEntries(Object.entries(stats).map(([kind, [hit, total]]) => [kind, `${hit}/${total}`]));
summary.lineAndCodeAmbiguousByDesign = ambiguousCodeQueries;
writeJson(PATHS.searchQa, { summary, named: NAMED, failures });
console.log(JSON.stringify({ indexRecords: payload.records.length, summary, named: NAMED.map((entry) => `${entry.ok ? "✓" : "✖"} [${entry.kind}] ${entry.query} → ${entry.top}`), failureCount: failures.length, failures: failures.slice(0, 12) }, null, 1));
if (failures.length) process.exitCode = 1;
