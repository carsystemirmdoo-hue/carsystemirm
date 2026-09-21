#!/usr/bin/env node
/**
 * SATA faza 2 — search QA nad STVARNIM indeksom sajta.
 *
 *   npm run build:check && npm run start:check      # u drugom terminalu
 *   npm run sata:sync:qa-search-phase2
 *
 * Svaki vidljivi broj artikla mora pronaći TAČNU karticu; zvanični naziv, srpski naziv i kompatibilnost takođe.
 * Isključeni artikli ne smeju imati pogodak po broju. Faza 1 mora i dalje raditi po broju artikla.
 */
import { buildSearchIndex, searchIndex } from "../../lib/search/engine.mjs";
import { readJson, writeJson } from "../carsystem-sync/lib/http.mjs";
import { PATHS } from "./lib/config.mjs";

const baseUrl = process.env.QA_BASE_URL ?? "http://localhost:3220";
const response = await fetch(`${baseUrl}/katalog/search-index.json`).catch(() => null);
if (!response?.ok) { console.error(`Search indeks nije dostupan na ${baseUrl}.`); process.exit(1); }
const payload = await response.json();
const index = buildSearchIndex(payload.records);
const ids = new Set(payload.records.map((record) => record.id));
const plan = readJson(PATHS.phase2Plan);
const dataset = readJson(PATHS.siteDataset);
const top = (query, limit) => searchIndex(index, query, { limit }).map((hit) => hit.record.id);
const stats = { articleNumber: [0, 0], officialBaseName: [0, 0], serbianName: [0, 0] };
// Zajednički početak zvaničnih naziva redova = zvanični naziv proizvoda bez atributa („SATA quick coupling”).
function commonPrefix(names) {
  let prefix = names[0];
  for (const name of names) while (!name.toLowerCase().startsWith(prefix.toLowerCase())) prefix = prefix.slice(0, -1);
  // Na granici reči: prepolovljena poslednja reč se odbacuje; naziv se seče pre prvog atributa (cifra, zagrada, „G”, „Ø”).
  const whole = names.every((name) => name.length === prefix.length || /[\s,(]/.test(name[prefix.length]));
  const words = (whole ? prefix : prefix.replace(/\S*$/, "")).split(/\s+/).filter(Boolean);
  const stop = words.findIndex((word) => /\d|\(|^[GØ]$/.test(word));
  return (stop === -1 ? words : words.slice(0, stop)).join(" ").replace(/[\s,]+$/, "");
}
let fullNameTop8 = 0, fullNameTotal = 0;
const failures = [];
const check = (kind, query, slug, limit) => { stats[kind][1] += 1; if (top(query, limit).includes(slug)) stats[kind][0] += 1; else failures.push({ kind, query: query.slice(0, 90), slug, top: top(query, 3) }); };

for (const card of plan.cards) {
  if (!ids.has(card.slug)) { failures.push({ slug: card.slug, problem: "NOT_IN_INDEX" }); continue; }
  check("serbianName", card.name, card.slug, 5);
  const base = card.variants.length > 1 ? commonPrefix(card.variants.map((row) => row.officialName)) : card.variants[0].officialName;
  if (base.length >= 4) check("officialBaseName", base, card.slug, 8);
  for (const row of card.variants) {
    check("articleNumber", row.articleNumber, card.slug, 3);
    // Pun zvanični naziv REDA je metrika, ne uslov: kartice sa zvaničnim nazivom u polju naziva ga legitimno prestižu.
    fullNameTotal += 1; if (top(row.officialName, 8).includes(card.slug)) fullNameTop8 += 1;
  }
}
// Isključeni broj artikla ne sme postojati NIGDE u indeksu (šifra, pojam, naziv) — 0 rezultata za kupca.
const indexText = JSON.stringify(payload.records.filter((record) => record.brandSlug === "sata"));
const excludedFound = Object.entries(plan.articles).filter(([, entry]) => entry.status !== "VISIBLE").filter(([number]) => new RegExp(`(^|[^0-9])${number}([^0-9]|$)`).test(indexText) || searchIndex(index, number, { limit: 5 }).some((hit) => hit.record.brandSlug === "sata" && (hit.record.codes ?? []).concat(hit.record.productCode ?? []).includes(number))).map(([number]) => number);
for (const number of excludedFound) failures.push({ kind: "excludedArticleFound", number });

// Price gate nad STVARNIM indeksom: nijedan SATA zapis ne nosi formulaciju o ceni, valutu ni iznos.
const phase2Ids = new Set(plan.cards.map((card) => card.slug));
const pricingInIndex = payload.records.filter((record) => record.brandSlug === "sata" && /\bprice\b|€|\b(?:EUR|RSD|USD|CHF)\b/i.test(JSON.stringify(record))).map((record) => record.id);
for (const id of pricingInIndex) failures.push({ kind: "pricingWordingInIndex", id, phase2: phase2Ids.has(id) });
const perMeter = plan.cards.filter((card) => card.variants.some((row) => row.soldByMeter));
const perMeterFound = perMeter.filter((card) => top("na metar", 20).includes(card.slug)).length;
if (perMeterFound !== perMeter.length) failures.push({ kind: "naMetar", found: perMeterFound, expected: perMeter.length });

const cardOf = (number) => plan.cards.find((card) => card.variants.some((row) => row.articleNumber === number)).slug;
const NAMED = [
  ["red grupe po broju", "53090", cardOf("53090")], ["srpski naziv", "SATA crevo za vazduh", "sata-air-hose"], ["zvanični naziv", "SATA air hose", "sata-air-hose"],
  ["odeća", "SATA suit space", "sata-suit-space"], ["kompatibilnost", "air cap protector jet X", cardOf("1054006")], ["broj adaptera", "RPS adapter No. 10", cardOf("135798")],
  ["vezani pribor", "154211", cardOf("154211")], ["pumpa", "63974", cardOf("63974")], ["termin proizvođača", "SGE", cardOf("27722")], ["isti naziv, dva broja", "1110527", cardOf("1110527")],
].map(([kind, query, slug]) => { const hits = top(query, 8); const ok = hits.includes(slug); if (!ok) failures.push({ kind, query, slug, top: hits.slice(0, 3) }); return { kind, query, slug, ok }; });

// Faza 1 i dalje radi po broju artikla.
const phase1 = dataset.products.find((entry) => entry.variants.length > 5);
const phase1Ok = top(phase1.variants[3].articleNumber, 3).includes(phase1.slug);
if (!phase1Ok) failures.push({ kind: "phase1ArticleNumber", query: phase1.variants[3].articleNumber, slug: phase1.slug });

const summary = { indexRecords: payload.records.length, cards: plan.cards.length, ...Object.fromEntries(Object.entries(stats).map(([kind, [hit, total]]) => [kind, `${hit}/${total}`])), fullRowOfficialNameInTop8: `${fullNameTop8}/${fullNameTotal}`, excludedArticlesFound: excludedFound.length, pricingWordingInIndex: pricingInIndex.length, soldByMeterFoundByNeutralTerm: `${perMeterFound}/${perMeter.length}`, phase1ArticleNumberStillFound: phase1Ok };
writeJson(PATHS.phase2SearchQa, { summary, named: NAMED, failures });
console.log(JSON.stringify({ summary, named: NAMED.map((entry) => `${entry.ok ? "✓" : "✖"} [${entry.kind}] ${entry.query} → ${entry.slug}`), failureCount: failures.length, failures: failures.slice(0, 15) }, null, 1));
if (failures.length) process.exitCode = 1;
