#!/usr/bin/env node
/**
 * Mašinska provera SR lokalizacije za BEFAR (isti kriterijumi koje koristi validate).
 *
 *   node scripts/befar-sync/check-localization.mjs [fajl.json …]
 *
 * Befar ne objavljuje opise, pa je glavna provera PROTIV IZMIŠLJANJA: svaki broj i
 * svaka šifra u tekstu mora postojati u zvaničnom ulazu.
 */

import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

import { readJson } from "../carsystem-sync/lib/http.mjs";
import { PATHS } from "./lib/config.mjs";

const BANNED = [/zvani[čc]n\w* distributer/i, /ovla[šs][ćc]en/i, /ekskluzivn/i, /najbolj/i, /revolucionar/i, /vrhunsk/i, /savr[šs]en/i, /izuzetn/i, /\b(rsd|eur|din\.?|cena|cene|cenu)\b/i, /na stanju|rok isporuke/i];
const LIMITS = { shortDescription: 160, longDescription: 600, purpose: 90 };

export function checkLocalization(entries, input) {
  const errors = [];
  for (const [sourceKey, entry] of Object.entries(entries)) {
    const source = input[sourceKey];
    const fail = (message) => errors.push(`${sourceKey}: ${message}`);
    if (!source) { fail("sourceKey ne postoji u ulazu"); continue; }
    if (entry.sourceHash !== source.sourceHash) fail(`sourceHash ${entry.sourceHash} ≠ ulaz ${source.sourceHash}`);
    for (const field of ["productType", "subtype", "shortDescription", "longDescription", "purpose"]) if (typeof entry[field] !== "string" || !entry[field].trim()) fail(`nedostaje ${field}`);
    for (const [field, limit] of Object.entries(LIMITS)) if ((entry[field] ?? "").length > limit) fail(`${field} ima ${entry[field].length} znakova (najviše ${limit})`);
    if ((entry.productType ?? "").split(/\s+/).length > 7) fail("productType je duži od 7 reči");
    for (const field of ["facts", "applications", "benefits", "setContents"]) if (!Array.isArray(entry[field])) fail(`${field} mora biti niz`);
    for (const fact of entry.facts ?? []) if (!fact?.label || !fact?.value) fail("fact bez label/value");
    for (const benefit of entry.benefits ?? []) if (!benefit?.title || !benefit?.description) fail("benefit bez title/description");
    if (entry.advice !== null && typeof entry.advice !== "string") fail("advice mora biti string ili null");
    if ("variants" in entry) fail("oznake varijanti se ne pišu ručno (sync ih gradi sam)");

    const text = JSON.stringify({ ...entry, sourceHash: undefined });
    for (const pattern of BANNED) if (pattern.test(text)) fail(`zabranjen izraz ${pattern}`);
    if (/[Ѐ-ӿ]/.test(text)) fail("ćirilica u tekstu (sajt je na latinici)");

    // Svaki broj (≥ 2 cifre) i svaka šifra u tekstu mora postojati u zvaničnom ulazu.
    const sourceText = JSON.stringify(source).replace(/[\s.]/g, "").toLowerCase();
    const counts = new Set([source.variants.length, new Set(source.variants.map((v) => v.colour).filter(Boolean)).size, new Set(source.variants.map((v) => v.size).filter(Boolean)).size].map(String));
    for (const match of text.matchAll(/\d+(?:[.,]\d+)?[A-Z]{0,4}/g)) {
      const token = match[0].replace(",", "").replace(".", "").toLowerCase();
      if (token.length < 2 || counts.has(match[0])) continue;
      if (/^\d\/5$/.test(text.slice(match.index, match.index + 3))) continue;
      if (!sourceText.includes(token)) fail(`broj/šifra „${match[0]}” ne postoji u zvaničnom ulazu`);
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
