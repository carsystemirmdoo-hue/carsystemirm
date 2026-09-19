#!/usr/bin/env node
/**
 * Mašinska provera SR lokalizacije (isti kriterijumi koje koristi i validate).
 *
 *   node scripts/carfit-sync/check-localization.mjs [fajl.json …]
 *
 * Bez argumenata proverava ceo `data/carfit-sync/localization/`. Ulaz za poređenje
 * je `.cache/carfit-sync/localization-input/` (nastaje u `carfit:sync:plan`).
 */

import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

import { readJson } from "../carsystem-sync/lib/http.mjs";
import { PATHS } from "./lib/config.mjs";

const BANNED = [/zvani[čc]n\w* distributer/i, /ovla[šs][ćc]en/i, /ekskluzivn/i, /najbolj/i, /revolucionar/i, /vrhunsk/i, /savr[šs]en/i, /\b(rsd|eur|din\.?|cena|cene|cenu)\b/i, /na stanju|rok isporuke/i];
const LIMITS = { shortDescription: 160, longDescription: 600, purpose: 90 };

export function checkLocalization(entries, input) {
  const errors = [];
  for (const [sourceKey, entry] of Object.entries(entries)) {
    const source = input[sourceKey];
    const fail = (message) => errors.push(`${sourceKey}: ${message}`);
    if (!source) { fail("sourceKey ne postoji u ulazu"); continue; }
    if (entry.sourceHash !== source.sourceHash) fail(`sourceHash ${entry.sourceHash} ≠ ulaz ${source.sourceHash}`);
    for (const field of ["productType", "subtype", "shortDescription", "longDescription", "purpose"]) {
      if (typeof entry[field] !== "string" || !entry[field].trim()) fail(`nedostaje ${field}`);
    }
    for (const [field, limit] of Object.entries(LIMITS)) {
      if ((entry[field] ?? "").length > limit) fail(`${field} ima ${entry[field].length} znakova (najviše ${limit})`);
    }
    if ((entry.productType ?? "").split(/\s+/).length > 6) fail("productType je duži od 6 reči");
    for (const field of ["facts", "applications", "benefits", "substrates"]) {
      if (!Array.isArray(entry[field])) fail(`${field} mora biti niz`);
    }
    for (const fact of entry.facts ?? []) if (!fact?.label || !fact?.value) fail("fact bez label/value");
    for (const benefit of entry.benefits ?? []) if (!benefit?.title || !benefit?.description) fail("benefit bez title/description");
    if (entry.advice !== null && typeof entry.advice !== "string") fail("advice mora biti string ili null");

    const expected = source.variants.map((variant) => variant.articleNumber);
    const given = Object.keys(entry.variants ?? {});
    const missing = expected.filter((article) => !given.includes(article));
    const extra = given.filter((article) => !expected.includes(article));
    if (missing.length) fail(`nedostaju oznake varijanti: ${missing.join(", ")}`);
    if (extra.length) fail(`nepostojeće šifre: ${extra.join(", ")}`);
    const labels = Object.values(entry.variants ?? {});
    if (labels.some((label) => typeof label !== "string" || !label.trim())) fail("prazna oznaka varijante");
    const repeated = labels.filter((label, index) => labels.indexOf(label) !== index);
    if (repeated.length) fail(`oznake varijanti nisu jedinstvene: ${[...new Set(repeated)].join(" | ")}`);

    const text = JSON.stringify(entry);
    for (const pattern of BANNED) if (pattern.test(text)) fail(`zabranjen izraz ${pattern}`);
    if (/[Ѐ-ӿ]/.test(text)) fail("ćirilica u tekstu (sajt je na latinici)");
    // Svaka temperatura i svaki VOC/gustina broj iz fakata mora postojati u izvoru.
    const sourceText = JSON.stringify(source).replace(/\s/g, "");
    for (const match of text.matchAll(/(\d+(?:[.,]\d+)?)\s?°\s?C/g)) {
      const number = match[1].replace(",", ".");
      if (!sourceText.includes(number) && !sourceText.includes(number.replace(".", ","))) fail(`temperatura ${match[0]} ne postoji u izvoru`);
    }
  }
  return errors;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const input = {};
  for (const file of readdirSync(PATHS.localizationInputDir)) Object.assign(input, readJson(path.join(PATHS.localizationInputDir, file), {}));
  const files = process.argv.slice(2).length
    ? process.argv.slice(2)
    : existsSync(PATHS.localizationDir) ? readdirSync(PATHS.localizationDir).filter((name) => name.endsWith(".json")).map((name) => path.join(PATHS.localizationDir, name)) : [];
  let total = 0;
  let failed = 0;
  for (const file of files) {
    const entries = readJson(file, {});
    const errors = checkLocalization(entries, input);
    total += Object.keys(entries).length;
    failed += errors.length;
    for (const error of errors) console.log(`✖ ${path.basename(file)} · ${error}`);
  }
  console.log(`${total} unosa, ${failed} grešaka`);
  if (failed) process.exitCode = 1;
}
