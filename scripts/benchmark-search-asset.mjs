#!/usr/bin/env node
/**
 * Stvarno merenje search asseta na 3.500+ zapisa.
 *
 * Raniji izveštaj je veličinu na 3.500 zapisa PROCENIO („~110 KB gzip"). Ovo je
 * ne procenjuje: generiše fixture u istoj shemi i istoj `schemaVersion` koju
 * servira `/katalog/search-index.json`, serijalizuje ga istim `JSON.stringify`
 * putem koji koristi `Response.json`, i meri sve što korisnik stvarno plaća —
 * prenos, parsiranje, gradnju indeksa u workeru, upite i cenu structured-clone
 * prelaza između UI-a i workera.
 *
 * Generisani fajl je veliki i namerno se piše u `tmp/` (gitignored) — ne ulazi
 * u repozitorijum.
 *
 * Usage:
 *   node --expose-gc scripts/benchmark-search-asset.mjs [--records=3500] [--out=tmp/search-index-fixture.json]
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { brotliCompressSync, gzipSync } from "node:zlib";

import { buildSearchIndex, searchIndex } from "../lib/search/engine.mjs";
import { createSearchIndexPayloadFixture } from "../lib/search/fixture.mjs";

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => arg.replace(/^--/, "").split("=")),
);
const target = Number(args.records ?? 3500);
const outPath = args.out ?? "tmp/search-index-fixture.json";

const QUERIES = [
  "ch",
  "chrome",
  "antichip",
  "antichp",
  "molotow chrome",
  "carmine red 400 ml",
  "1l",
  "3,5 l",
  "c2e50",
  "razredjivac",
  "clearcoat",
  "bezbojni lak premium",
  "cosmos antichip 1 l",
];

const collectGarbage = () => {
  if (typeof global.gc === "function") {
    global.gc();
    return true;
  }
  return false;
};

const heap = () => process.memoryUsage().heapUsed;

/* -- Generisanje i serijalizacija ------------------------------------------ */

const payload = createSearchIndexPayloadFixture(target);
const serialized = JSON.stringify(payload);
const buffer = Buffer.from(serialized);

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, serialized);

const gzip = gzipSync(buffer).length;
const brotli = brotliCompressSync(buffer).length;

/* -- Parsiranje ------------------------------------------------------------ */

const parseStart = performance.now();
const parsed = JSON.parse(serialized);
const parseMs = performance.now() - parseStart;

/* -- Gradnja indeksa ------------------------------------------------------- */

const gcAvailable = collectGarbage();
const heapBeforeBuild = heap();
const buildStart = performance.now();
const index = buildSearchIndex(parsed.records);
const buildMs = performance.now() - buildStart;
const heapAfterBuild = heap();

/* -- Structured clone (UI ↔ worker) ---------------------------------------- */

const cloneStart = performance.now();
const cloned = structuredClone(parsed.records);
const cloneMs = performance.now() - cloneStart;

/*
 * Odgovor workera nosi INDEKSE, ne zapise. Ovo meri koliko bi koštalo da nosi
 * pune zapise — razlika je razlog zašto protokol izgleda tako kako izgleda.
 */
const worstCaseHits = searchIndex(index, "chrome", { limit: 5000 });
const hitIndices = worstCaseHits.map((hit) => hit.index);
const indicesCloneStart = performance.now();
structuredClone(hitIndices);
const indicesCloneMs = performance.now() - indicesCloneStart;

const fullRecordsCloneStart = performance.now();
structuredClone(worstCaseHits.map((hit) => hit.record));
const fullRecordsCloneMs = performance.now() - fullRecordsCloneStart;

/* -- Upiti ----------------------------------------------------------------- */

for (const query of QUERIES) searchIndex(index, query, { limit: 200 });

const durations = [];
for (let round = 0; round < 20; round += 1) {
  for (const query of QUERIES) {
    const start = performance.now();
    searchIndex(index, query, { limit: 200 });
    durations.push(performance.now() - start);
  }
}
durations.sort((first, second) => first - second);
const percentile = (fraction) =>
  durations[Math.min(durations.length - 1, Math.ceil(fraction * durations.length) - 1)];

const kb = (bytes) => Number((bytes / 1024).toFixed(1));
const ms = (value) => Number(value.toFixed(2));

const report = {
  records: parsed.records.length,
  counts: parsed.counts,
  asset: {
    rawKB: kb(buffer.length),
    gzipKB: kb(gzip),
    brotliKB: kb(brotli),
    gzipBudgetKB: 300,
    withinBudget: gzip <= 300 * 1024,
  },
  timings: {
    jsonParseMs: ms(parseMs),
    workerIndexBuildMs: ms(buildMs),
    structuredCloneAllRecordsMs: ms(cloneMs),
    resultCloneIndicesMs: ms(indicesCloneMs),
    resultCloneFullRecordsMs: ms(fullRecordsCloneMs),
    resultSize: hitIndices.length,
  },
  query: {
    samples: durations.length,
    p50Ms: ms(percentile(0.5)),
    p95Ms: ms(percentile(0.95)),
    maxMs: ms(durations[durations.length - 1]),
    p95SlowDeviceMs: ms(percentile(0.95) * 4),
    maxSlowDeviceMs: ms(durations[durations.length - 1] * 4),
  },
  memory: gcAvailable
    ? {
        heapBeforeBuildMB: Number((heapBeforeBuild / 1024 / 1024).toFixed(1)),
        heapAfterBuildMB: Number((heapAfterBuild / 1024 / 1024).toFixed(1)),
        indexOverheadMB: Number(((heapAfterBuild - heapBeforeBuild) / 1024 / 1024).toFixed(1)),
      }
    : "pokreni sa `node --expose-gc` za pouzdano merenje memorije",
  vocabulary: index.vocabulary.length,
  clonedRecords: cloned.length,
  fixture: outPath,
};

console.log(JSON.stringify(report, null, 2));

const failures = [];
if (!report.asset.withinBudget) failures.push(`gzip ${report.asset.gzipKB} KB prelazi 300 KB`);
if (report.query.p95Ms > 20) failures.push(`warm p95 ${report.query.p95Ms} ms prelazi 20 ms`);
if (report.query.p95SlowDeviceMs > 50) {
  failures.push(`p95 na ×4 sporijem uređaju ${report.query.p95SlowDeviceMs} ms prelazi 50 ms`);
}
if (report.timings.resultCloneIndicesMs >= report.timings.resultCloneFullRecordsMs) {
  failures.push("protokol sa indeksima nije jeftiniji od slanja punih zapisa");
}

if (failures.length) {
  console.error(`\nBenchmark nije prošao (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
