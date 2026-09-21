/**
 * Search QA za proizvode drugih proizvođača iz Carsystem kataloga (RUPES) — nad STVARNIM indeksom sajta.
 *
 *   npm run build:check && npm run start:check      # u drugom terminalu
 *   npm run carsystem:sync:qa-search-third-party
 *
 * Svaka kartica mora da se nađe po: brendu, postojećem nazivu, svakom Carsystem broju artikla i svakoj
 * oznaci modela (uključujući osnovni model). Pogodak nosi brend proizvođača, ne „Carsystem”.
 */

import path from "node:path";

import { buildSearchIndex, searchIndex } from "../../lib/search/engine.mjs";
import { PATHS } from "./lib/config.mjs";
import { readJson, writeJson } from "./lib/http.mjs";

const baseUrl = process.env.QA_BASE_URL ?? "http://localhost:3220";
const response = await fetch(`${baseUrl}/katalog/search-index.json`).catch(() => null);
if (!response?.ok) { console.error(`Search indeks nije dostupan na ${baseUrl}.`); process.exit(1); }
const payload = await response.json();
const index = buildSearchIndex(payload.records);
const byId = new Map(payload.records.map((record) => [record.id, record]));
const dataset = readJson(PATHS.siteDataset);
const entries = dataset.products.filter((entry) => entry.manufacturer);

const top = (query, limit = 8) => searchIndex(index, query, { limit }).map((hit) => hit.record.id);
const stats = { name: [0, 0], articleNumber: [0, 0], modelCode: [0, 0], modelAlias: [0, 0] };
const failures = [];
const check = (kind, query, slug, limit) => { stats[kind][1] += 1; if (top(query, limit).includes(slug)) stats[kind][0] += 1; else failures.push({ kind, query, slug, top: top(query, 3) }); };

for (const entry of entries) {
  const record = byId.get(entry.slug);
  if (!record) { failures.push({ slug: entry.slug, problem: "NOT_IN_INDEX" }); continue; }
  if (record.brandSlug !== entry.manufacturer.brandSlug) failures.push({ slug: entry.slug, problem: "WRONG_BRAND_IN_INDEX", brandSlug: record.brandSlug });
  check("name", entry.name, entry.slug);
  for (const variant of entry.variants) check("articleNumber", variant.articleNumber, entry.slug, 3);
  for (const model of Object.values(entry.manufacturer.articleModelCodes)) {
    check("modelCode", model.modelCode, entry.slug);
    for (const alias of model.aliases) check("modelAlias", alias, entry.slug);
  }
}

// Brend: svi proizvodi opsega, i nijedan pod brendom Carsystem.
const brandHits = searchIndex(index, "rupes", { limit: 100 }).map((hit) => hit.record);
const brandMissing = entries.filter((entry) => !brandHits.some((record) => record.id === entry.slug)).map((entry) => entry.slug);
for (const slug of brandMissing) failures.push({ kind: "brand", query: "rupes", slug });
const brandUnderCarsystem = brandHits.filter((record) => record.brandSlug === "carsystem").map((record) => record.id);
for (const id of brandUnderCarsystem) failures.push({ kind: "brandUnderCarsystem", id });

const NAMED = [
  ["oznaka modela iz reda", "RX253A", "carsystem-rupes-skorpio-e-rx"],
  ["osnovni model (rupes.com)", "RX253", "carsystem-rupes-skorpio-e-rx"],
  ["oznaka modela iz reda", "HR81M", "carsystem-rupes-ibrid-nano"],
  ["oznaka modela iz reda", "S145EPM", "carsystem-rupes-vacuum-cleaner-s145"],
  ["oznaka pribora", "981.500", "carsystem-rupes-back-pad"],
  ["Carsystem broj artikla", "157.331", "carsystem-rupes-angle-polishing-machine-lh76p"],
  ["porodica", "BigFoot", "carsystem-rupes-polishing-machine-lh19e"],
  ["porodica", "iBrid", "carsystem-rupes-ibrid-nano"],
  ["porodica", "Skorpio", "carsystem-rupes-skorpio-iii-rh"],
  ["postojeći naziv", "RUPES Vacuum Cleaner S145", "carsystem-rupes-vacuum-cleaner-s145"],
].map(([kind, query, slug]) => { const hits = top(query, 10); const ok = hits.includes(slug); if (!ok) failures.push({ kind, query, slug, top: hits.slice(0, 3) }); return { kind, query, slug, ok, brandOfHit: byId.get(slug)?.brandSlug ?? null }; });

// Carsystem-ov sopstveni artikal i dalje radi po broju artikla.
const ownSample = dataset.products.find((entry) => !entry.manufacturer && entry.variants.length > 1);
const ownOk = top(ownSample.variants[1].articleNumber, 3).includes(ownSample.slug);
if (!ownOk) failures.push({ kind: "ownArticleNumber", query: ownSample.variants[1].articleNumber, slug: ownSample.slug });

const summary = { indexRecords: payload.records.length, products: entries.length, brandQueryHits: brandHits.length, brandUnderCarsystem: brandUnderCarsystem.length, ...Object.fromEntries(Object.entries(stats).map(([kind, [hit, total]]) => [kind, `${hit}/${total}`])), ownCarsystemArticleNumberStillFound: ownOk };
writeJson(path.join(path.dirname(PATHS.plan), "search-qa-third-party.generated.json"), { summary, named: NAMED, failures });
console.log(JSON.stringify({ summary, named: NAMED.map((entry) => `${entry.ok ? "✓" : "✖"} [${entry.kind}] ${entry.query} → ${entry.slug} (${entry.brandOfHit})`), failureCount: failures.length, failures: failures.slice(0, 15) }, null, 1));
if (failures.length) process.exitCode = 1;
