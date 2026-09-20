#!/usr/bin/env node
/**
 * Mašinska provera SR lokalizacije za Norbin (isti kriterijumi koje koristi validate).
 *
 *   node scripts/norbin-sync/check-localization.mjs [fajl.json …]
 *
 * Glavna provera je PROTIV IZMIŠLJANJA: svaki broj i svaka mera u tekstu mora postojati u
 * zvaničnom ulazu (`.cache/norbin-sync/localization-input/*.json`). Druga je terminološka:
 * uloga se ne sme pomešati. Treća je specifična za Norbin: tekst ne sme tvrditi dostupnost,
 * jer izvor dostupnost uopšte ne objavljuje.
 */

import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

import { readJson } from "../carsystem-sync/lib/http.mjs";
import { PATHS } from "./lib/config.mjs";

/* „DIN 4" je metod merenja, ne valuta — zato `din` traži tačku ili nastavak. */
const BANNED = [
  /zvani[čc]n\w* distributer/i,
  /ovla[šs][ćc]en/i,
  /ekskluzivn/i,
  /najbolj/i,
  /revolucionar/i,
  /vrhunsk/i,
  /savr[šs]en/i,
  /\b(rsd|eur|din\.|dinar\w*|cena|cene|cenu)\b/i,
  /na stanju|na lageru|rok isporuke|odmah dostupno/i,
];
const LIMITS = { shortDescription: 170, longDescription: 700, purpose: 90 };

/** Uloga → reč koja MORA i reči koje NE SMEJU stajati u `productType`. */
const ROLE_TERMS = {
  clearcoat: { must: /bezbojni lak|lak\b/i, forbidden: /u[čc]vr[šs][ćc]iva[čc]|razre[đd]iva[čc]|kit\b|prajmer|punilo/i },
  hardener: { must: /u[čc]vr[šs][ćc]iva[čc]|aktivator/i, forbidden: /razre[đd]iva[čc]|bezbojni lak|kit\b/i },
  reducer: { must: /razre[đd]iva[čc]/i, forbidden: /u[čc]vr[šs][ćc]iva[čc]|kit\b|prajmer/i },
  undercoat: { must: /prajmer|punilo|podloga|temeljn/i, forbidden: /bezbojni lak|razre[đd]iva[čc]/i },
  bodyfiller: { must: /kit\b/i, forbidden: /razre[đd]iva[čc]|bezbojni lak|prajmer/i },
  cleaner: { must: /sredstvo za [čc]i[šs][ćc]enje|odma[šs][ćc]iva[čc]/i, forbidden: /u[čc]vr[šs][ćc]iva[čc]|kit\b/i },
};

/** Naš interni broj artikla (6 cifara) nikada ne sme da izađe u javni tekst. */
const INTERNAL_ARTICLE = /\b\d{6}\b/;

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
    if (INTERNAL_ARTICLE.test(text)) fail("interni broj artikla ne sme u javni tekst");
    // Proizvod bez ijedne zvanične tvrdnje ne sme dobiti tehničke činjenice.
    if (!source.technical && (entry.facts ?? []).length) fail("proizvod nema nijednu zvaničnu tvrdnju, a `facts` nije prazan");

    const terms = ROLE_TERMS[source.role];
    if (terms) {
      if (!terms.must.test(entry.productType ?? "")) fail(`productType „${entry.productType}” ne odgovara ulozi ${source.role}`);
      if (terms.forbidden.test(entry.productType ?? "")) fail(`productType „${entry.productType}” koristi termin druge uloge`);
    }

    /*
     * Svaki broj i svaka oznaka u tekstu mora postojati u zvaničnom ulazu.
     *
     * Obe strane se normalizuju ISTO. Ranije je izvor gubio samo tačku, a token i zarez, pa
     * „1,95 kg" iz teksta („195kg") nije pogađalo „1,95kg" iz izvora — i pisac je morao da
     * izostavi meru koju izvor uredno navodi.
     */
    const sourceText = JSON.stringify(source).replace(/[\s.,]/g, "").toLowerCase();
    for (const match of text.matchAll(/\d+(?:[.,]\d+)?\s?(?:[A-Za-zμ°%]{1,6})?/g)) {
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
