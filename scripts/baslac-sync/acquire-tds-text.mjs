#!/usr/bin/env node
/**
 * baslac sync — zvanični tehnički listovi kao ČINJENICE.
 *
 * 49 od 52 aktuelna lista već postoje u repozitorijumu (`public/documents/products/baslac`,
 * preuzeti sa zvaničnog indeksa); ostatak se dovlači sa `techinfo.baslac.com` u keš.
 * Rezultat se upisuje u `data/baslac-sync/raw/tds-facts.generated.json` i COMMITUJE se,
 * da čist checkout može da ponovi sync bez mreže i bez keša (ista pouka kao kod R-M synca).
 */

import { existsSync } from "node:fs";
import path from "node:path";

import { extractPdfBatch } from "../lib/rm-pdf-text.mjs";
import { cachedFetch, readJson, writeJson } from "../carsystem-sync/lib/http.mjs";
import { PATHS, REPO_ROOT, TDS_CACHE_DIR } from "./lib/config.mjs";
import { parseTds } from "./lib/parse-tds.mjs";

const refresh = process.argv.includes("--refresh");
const techinfo = readJson(PATHS.rawTechinfo);
if (!techinfo) throw new Error("Nedostaje techinfo RAW — `npm run baslac:sync:acquire`.");

const wanted = techinfo.documents.filter((document) => document.kind === "product");
const files = [];
for (const document of wanted) {
  const local = document.localPath ? path.join(REPO_ROOT, "public", document.localPath) : null;
  if (local && existsSync(local)) { files.push({ code: document.code, file: local, origin: "repozitorijum" }); continue; }
  const cached = path.join(TDS_CACHE_DIR, document.file);
  await cachedFetch(document.url, cached, { refresh });
  files.push({ code: document.code, file: cached, origin: "techinfo.baslac.com" });
}

const extracted = extractPdfBatch(files.map((entry) => entry.file));
const facts = {};
for (const [index, entry] of extracted.entries()) {
  const { code, origin } = files[index];
  if (!entry.ok) { facts[code] = { code, error: entry.error, origin }; continue; }
  facts[code] = { ...parseTds(entry.pages, code), origin, pages: entry.pages.length };
}

const list = Object.values(facts);
writeJson(PATHS.tdsFacts, {
  meta: {
    documents: list.length,
    fromRepository: files.filter((entry) => entry.origin === "repozitorijum").length,
    withOfficialName: list.filter((entry) => entry.officialName).length,
    withMixingRatio: list.filter((entry) => entry.facts?.mixingRatio).length,
    withDrying: list.filter((entry) => entry.drying?.length).length,
    withVoc: list.filter((entry) => entry.voc).length,
    withRelations: list.filter((entry) => entry.relatedCodes?.length).length,
    failures: list.filter((entry) => entry.error).map((entry) => entry.code),
    note: "Činjenice se čitaju doslovno iz lista; nijedna vrednost se ne izvodi računom.",
  },
  facts: Object.fromEntries(Object.entries(facts).sort(([a], [b]) => a.localeCompare(b))),
});
console.log(JSON.stringify(readJson(PATHS.tdsFacts).meta, null, 1));
