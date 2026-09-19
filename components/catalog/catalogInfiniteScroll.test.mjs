import assert from "node:assert/strict";
import test from "node:test";
import {
  CATALOG_BATCH_SIZE,
  CATALOG_PRELOAD_ROWS,
  getCatalogGridColumnCount,
  getCatalogNextVisibleCount,
  getCatalogPreloadTriggerIndex,
} from "./catalogInfiniteScroll.mjs";

test("catalog keeps a 48-product batch and a three-row preload window", () => {
  assert.equal(CATALOG_BATCH_SIZE, 48);
  assert.equal(CATALOG_PRELOAD_ROWS, 3);
});

test("preload trigger follows the actual responsive column count", () => {
  assert.equal(getCatalogPreloadTriggerIndex(48, 4), 36);
  assert.equal(getCatalogPreloadTriggerIndex(48, 3), 39);
  assert.equal(getCatalogPreloadTriggerIndex(48, 2), 42);
  assert.equal(getCatalogPreloadTriggerIndex(48, 1), 45);
  assert.equal(getCatalogPreloadTriggerIndex(2, 4), 0);
});

test("resolved CSS grid tracks are counted without breakpoint assumptions", () => {
  assert.equal(getCatalogGridColumnCount("280px 280px 280px 280px"), 4);
  assert.equal(getCatalogGridColumnCount("minmax(0px, 1fr) minmax(0px, 1fr)"), 2);
  assert.equal(getCatalogGridColumnCount("repeat(3, minmax(248px, 1fr))"), 3);
  assert.equal(getCatalogGridColumnCount("none"), 1);
});

test("the final batch is clamped without an empty follow-up group", () => {
  assert.equal(getCatalogNextVisibleCount(48, 773), 96);
  assert.equal(getCatalogNextVisibleCount(768, 773), 773);
  assert.equal(getCatalogNextVisibleCount(773, 773), 773);
  assert.equal(getCatalogNextVisibleCount(0, 0), 0);
});

import { readFileSync } from "node:fs";

test("beskonačni skrol: sentinel ispod mreže, ograničena gornja margina, re-arm posle svake grupe", () => {
  const explorer = readFileSync(new URL("./CatalogExplorer.tsx", import.meta.url), "utf8");
  const grid = readFileSync(new URL("./CatalogProductGrid.tsx", import.meta.url), "utf8");
  // sentinel je poslednji element mreže, observer ga posmatra uz okidač-karticu
  assert.match(grid, /data-catalog-load-sentinel/);
  assert.match(explorer, /if \(loadSentinelElement\) observer\.observe\(loadSentinelElement\)/);
  // skok preko okidača (End, skrol-traka): element iznad viewporta važi kao presečen, ali ograničeno
  assert.match(explorer, /rootMargin: "2400px 0px 400px 0px"/);
  // posle svakog dodavanja observer se ponovo pravi (lančano dok se dno ne popuni)
  assert.match(explorer, /visibleProductCount,\s*\]\);/);
  // nema numerisane navigacije koja ZAMENJUJE listu u interaktivnom katalogu
  assert.doesNotMatch(explorer, /<CatalogPaginationNav/);
  // nov upit/filter vraća pogled na vrh rezultata i resetuje skup
  assert.match(explorer, /setPagination\(\{ key: paginationKey, count: CATALOG_BATCH_SIZE \}\);[\s\S]{0,900}window\.scrollTo\(\{ top: Math\.max\(0, top\)/);
  // Back sa upitom: restauracija skrola se ponavlja kad lenjo učitane kartice stignu
  assert.match(explorer, /pendingRestoreScrollYRef/);
});
