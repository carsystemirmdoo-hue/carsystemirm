import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { gzipSync, brotliCompressSync } from "node:zlib";

import { buildSearchIndex, searchIndex } from "./engine.mjs";
import { createSearchFixture } from "./fixture.mjs";

/**
 * Pragovi su namerno iznad izmerenih vrednosti, ali ne mnogo: cilj je da test
 * pukne kada pretraga postane red veličine sporija, a ne da šumi na svakom
 * zauzetom CI runneru. Merene vrednosti su u izveštaju uz zadatak.
 */
const WARM_QUERY_P95_MS = 20;
/*
 * Gradnja indeksa je JEDNOKRATNA i radi se u workeru, pa ne blokira unos — prag
 * je zato postavljen da hvata red veličine, ne da meri opterećenje mašine.
 * Izmereno: ~100 ms na neopterećenom Apple Silicon-u, ~350 ms uz paralelne dev
 * servere i headless browser.
 */
const INDEX_BUILD_MS = 900;
const ASSET_GZIP_LIMIT = 300 * 1024;

const QUERIES = [
  "a",
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
  "cosmos antichip 1 l",
];

function percentile(values, fraction) {
  const sorted = [...values].sort((first, second) => first - second);
  const position = Math.min(sorted.length - 1, Math.ceil(fraction * sorted.length) - 1);
  return sorted[Math.max(0, position)];
}

test("gradnja indeksa nad 3.500+ zapisa ostaje u budžetu", () => {
  const records = createSearchFixture(3500);
  const started = performance.now();
  const index = buildSearchIndex(records);
  const elapsed = performance.now() - started;

  assert.ok(
    elapsed < INDEX_BUILD_MS,
    `gradnja indeksa je trajala ${elapsed.toFixed(1)} ms (limit ${INDEX_BUILD_MS} ms)`,
  );
  assert.ok(index.vocabulary.length > 0);
  console.log(
    `  build: ${elapsed.toFixed(1)} ms · ${records.length} zapisa · ${index.vocabulary.length} tokena`,
  );
});

test("topao upit nad 3.500+ zapisa je p95 ispod praga", () => {
  const index = buildSearchIndex(createSearchFixture(3500));
  const durations = [];

  // Zagrevanje: prvi prolaz plaća JIT, ne meri se.
  for (const query of QUERIES) searchIndex(index, query, { limit: 200 });

  for (let round = 0; round < 20; round += 1) {
    for (const query of QUERIES) {
      const started = performance.now();
      searchIndex(index, query, { limit: 200 });
      durations.push(performance.now() - started);
    }
  }

  const p95 = percentile(durations, 0.95);
  const worst = Math.max(...durations);
  console.log(
    `  query p95: ${p95.toFixed(2)} ms · max ${worst.toFixed(2)} ms · ${durations.length} merenja`,
  );
  assert.ok(p95 < WARM_QUERY_P95_MS, `p95 je ${p95.toFixed(2)} ms (limit ${WARM_QUERY_P95_MS} ms)`);
});

test("po upitu se ne skenira ceo skup zapisa", () => {
  /*
   * Provera osobine, ne vremena: ako bi engine radio linearni scan, vreme bi
   * raslo približno linearno sa brojem zapisa. Uski upit nad četiri puta većim
   * skupom sme da poraste, ali ne proporcionalno.
   */
  const small = buildSearchIndex(createSearchFixture(900));
  const large = buildSearchIndex(createSearchFixture(3600));

  const measure = (index) => {
    for (let round = 0; round < 50; round += 1) searchIndex(index, "c2e50", { limit: 20 });
    const started = performance.now();
    for (let round = 0; round < 200; round += 1) searchIndex(index, "c2e50", { limit: 20 });
    return performance.now() - started;
  };

  const smallMs = measure(small);
  const largeMs = measure(large);
  console.log(
    `  uski upit: ${smallMs.toFixed(1)} ms na ~900 zapisa, ${largeMs.toFixed(1)} ms na ~3.600`,
  );
  assert.ok(
    largeMs < smallMs * 2.5,
    `vreme raste skoro linearno sa skupom (${smallMs.toFixed(1)} → ${largeMs.toFixed(1)} ms)`,
  );
});

test("veličina stvarnog asseta je u budžetu, ako je snimljen", (t) => {
  /*
   * Asset nastaje iz Next rute, pa ga ovaj test ne generiše; kada QA snimi
   * `tmp/search-index.json`, meri ga i proverava budžet. Bez fajla test se
   * preskače umesto da laže o veličini.
   */
  let raw;
  try {
    raw = readFileSync("tmp/search-index.json");
  } catch {
    t.skip("tmp/search-index.json nije snimljen (pokreni QA snimanje asseta)");
    return;
  }

  const gzip = gzipSync(raw).length;
  const brotli = brotliCompressSync(raw).length;
  console.log(
    `  asset: ${(raw.length / 1024).toFixed(1)} KB raw · ${(gzip / 1024).toFixed(1)} KB gzip · ${(brotli / 1024).toFixed(1)} KB brotli`,
  );
  assert.ok(gzip < ASSET_GZIP_LIMIT, `gzip ${gzip} B prelazi budžet ${ASSET_GZIP_LIMIT} B`);
});
