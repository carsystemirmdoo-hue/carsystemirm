#!/usr/bin/env node
/**
 * Mašinska provera SR lokalizacije za R-M (isti kriterijumi koje koristi validate).
 *
 *   node scripts/rm-sync/check-localization.mjs [fajl.json …]
 *
 * Glavna provera je PROTIV IZMIŠLJANJA: svaki broj, svaka mera i svaka R-M oznaka u
 * tekstu mora postojati u zvaničnom ulazu (`.cache/rm-sync/localization-input/*.json`).
 * Druga provera je terminološka: uloga proizvoda se ne sme pomešati (učvršćivač nije
 * razređivač, kit nije prajmer), jer je upravo to najskuplja greška u refinish katalogu.
 */

import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

import { readJson } from "../carsystem-sync/lib/http.mjs";
import { PATHS } from "./lib/config.mjs";

const BANNED = [/zvani[čc]n\w* distributer/i, /ovla[šs][ćc]en/i, /ekskluzivn/i, /najbolj/i, /revolucionar/i, /vrhunsk/i, /savr[šs]en/i, /\b(rsd|eur|din\.?|cena|cene|cenu)\b/i, /na stanju|rok isporuke/i];
const LIMITS = { shortDescription: 170, longDescription: 700, purpose: 90 };

/** Uloga → reč koja MORA i reči koje NE SMEJU stajati u `productType`. */
const ROLE_TERMS = {
  clearcoat: { must: /bezbojni lak|lak\b/i, forbidden: /u[čc]vr[šs][ćc]iva[čc]|razre[đd]iva[čc]|kit\b|prajmer|punilo/i },
  hardener: { must: /u[čc]vr[šs][ćc]iva[čc]|aktivator/i, forbidden: /razre[đd]iva[čc]|bezbojni lak|kit\b/i },
  thinner: { must: /razre[đd]iva[čc]/i, forbidden: /u[čc]vr[šs][ćc]iva[čc]|kit\b|prajmer/i },
  additive: { must: /aditiv|sredstvo|dodatak/i, forbidden: /u[čc]vr[šs][ćc]iva[čc]|kit\b/i },
  bodyfiller: { must: /kit\b|kit /i, forbidden: /razre[đd]iva[čc]|bezbojni lak|prajmer/i },
  cleaner: { must: /sredstvo za [čc]i[šs][ćc]enje|odma[šs][ćc]iva[čc]|maramice|krpe/i, forbidden: /u[čc]vr[šs][ćc]iva[čc]|kit\b/i },
  undercoat: { must: /prajmer|punilo|podloga|temeljn/i, forbidden: /bezbojni lak|razre[đd]iva[čc]/i },
  "basecoat-topcoat": { must: /bazn|boja|premaz|sistem|topcoat|blender/i, forbidden: /bezbojni lak|kit\b/i },
};

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
    for (const field of ["facts", "applications", "benefits"]) if (!Array.isArray(entry[field])) fail(`${field} mora biti niz`);
    for (const fact of entry.facts ?? []) if (!fact?.label || !fact?.value) fail("fact bez label/value");
    for (const benefit of entry.benefits ?? []) if (!benefit?.title || !benefit?.description) fail("benefit bez title/description");
    if (entry.advice !== null && typeof entry.advice !== "string") fail("advice mora biti string ili null");
    if ("relations" in entry || "documents" in entry) fail("odnose i dokumente gradi sync, ne pišu se ručno");

    const text = JSON.stringify({ ...entry, sourceHash: undefined });
    for (const pattern of BANNED) if (pattern.test(text)) fail(`zabranjen izraz ${pattern}`);
    if (/[Ѐ-ӿ]/.test(text)) fail("ćirilica u tekstu (sajt je na latinici)");

    const terms = ROLE_TERMS[source.role];
    if (terms) {
      if (!terms.must.test(entry.productType ?? "")) fail(`productType „${entry.productType}” ne odgovara ulozi ${source.role}`);
      if (terms.forbidden.test(entry.productType ?? "")) fail(`productType „${entry.productType}” koristi termin druge uloge`);
    }
    /*
     * Naziv linije/serije se ne prevodi. Traži se POSRBLJENI oblik; `AGILIS` ovde nema
     * unos jer se piše isto na oba jezika, pa bi svaki pomen originala bio lažna greška.
     */
    const TRANSLATED = { "ONYX HD": /oniks/i, DIAMONT: /dijamont/i, "GRAPHITE HD": /grafit hd/i, "Pioneer Series": /pionirsk\w* serij/i, "Advance Series": /napredn\w* serij/i };
    for (const [word, translated] of Object.entries(TRANSLATED)) {
      if (!JSON.stringify(source).includes(word)) continue;
      if (translated.test(text)) fail(`naziv „${word}” je preveden — zvanični nazivi linija i serija ostaju u originalu`);
    }

    // Svaki broj (≥ 2 cifre) i svaka R-M oznaka u tekstu mora postojati u zvaničnom ulazu.
    const sourceText = JSON.stringify(source).replace(/[\s.]/g, "").toLowerCase();
    for (const match of text.matchAll(/\d+(?:[.,]\d+)?\s?(?:[A-Za-zμ°%]{1,4})?/g)) {
      const token = match[0].replace(/[\s.,]/g, "").toLowerCase();
      if (token.length < 2) continue;
      if (!sourceText.includes(token) && !sourceText.includes(token.replace(/[a-zμ°%]+$/, ""))) fail(`broj/oznaka „${match[0].trim()}” ne postoji u zvaničnom ulazu`);
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
