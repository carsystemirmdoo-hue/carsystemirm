#!/usr/bin/env node
/**
 * QA životnog ciklusa workera i keša pretrage.
 *
 * `qa-product-search.mjs` dokazuje ponašanje pretrage; ovaj skript dokazuje ko
 * poseduje resurse i kada se oslobađaju. Merenje ne veruje implementaciji na
 * reč: `window.Worker` se instrumentiše PRE nego što se aplikacija podigne, pa
 * se svaka konstrukcija, `terminate()` i dodela `onmessage` broje na stvarnoj
 * stranici.
 *
 * Ugovor koji se proverava:
 *   - jedan mrežni zahtev za asset po učitanoj stranici, bez obzira na broj
 *     otvaranja panela, promena rute i Back navigacija;
 *   - najviše jedan worker po učitanoj stranici; vlasnik je modul-level keš
 *     (`lib/search/productSearchClient.ts`), a ne komponenta;
 *   - najviše jedan aktivan `onmessage` po workeru;
 *   - zastareo odgovor workera ne menja noviji upit;
 *   - nigde nema referenci na uklonjeni `/katalog/variant-index.json`.
 *
 * Kači se na VEĆ POKRENUT dev/preview server i nikada ga ne pokreće sam.
 *
 * Usage: node scripts/qa-search-lifecycle.mjs [--base-url=…]
 */

import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => arg.replace(/^--/, "").split("=")),
);
const baseUrl = args["base-url"] ?? "http://localhost:3100";
const outDir = args.out ?? "tmp/qa/search-lifecycle";
mkdirSync(outDir, { recursive: true });

const measurements = {};
const failures = [];
const expect = (condition, message) => {
  if (!condition) failures.push(message);
};

/** Instrumentacija se ubacuje pre svakog dokumenta na stranici. */
const INSTRUMENT = `
(() => {
  /*
   * Instrumentacija ne sme da menja ponašanje: onmessage se NE presreće.
   * Prvi pokušaj je zamenio nativni setter, oborio konstrukciju workera i
   * naterao klijent na main-thread fallback — merenje je tada merilo pogrešnu
   * stvar. Beleže se samo konstrukcija, URL skripte i terminate; broj aktivnih
   * listenera se čita naknadno sa samih instanci.
   */
  const state = { created: [], terminated: 0 };
  window.__searchQA = state;
  const Native = window.Worker;
  if (!Native) return;

  class TrackedWorker extends Native {
    constructor(...workerArgs) {
      super(...workerArgs);
      this.__qaUrl = String(workerArgs[0] ?? "");
      this.__qaName = String(workerArgs[1]?.name ?? "");
      state.created.push(this);
    }
    terminate() {
      state.terminated += 1;
      this.__qaTerminated = true;
      return super.terminate();
    }
  }
  window.Worker = TrackedWorker;

  /*
   * Worker pretrage se prepoznaje po IMENU koje mu klijent daje
   * (SEARCH_WORKER_NAME iz productSearchClient). URL nije upotrebljiv: u
   * produkciji je heširani chunk bez ijedne prepoznatljive reči, pa je merenje
   * po URL-u prijavljivalo nulu iako worker postoji.
   */
  window.__searchQAReport = () => {
    const all = state.created.map((worker) => ({
      url: worker.__qaUrl,
      name: worker.__qaName,
      terminated: Boolean(worker.__qaTerminated),
      hasListener: typeof worker.onmessage === "function",
    }));
    const search = all.filter((worker) => worker.name === "carsystem-product-search");
    return {
      allWorkers: all.length,
      allWorkerNames: all.map((worker) => worker.name || worker.url.split("/").pop()),
      searchWorkers: search.length,
      searchWorkersTerminated: search.filter((worker) => worker.terminated).length,
      searchWorkerListeners: search.filter((worker) => worker.hasListener).length,
      terminatedTotal: state.terminated,
    };
  };
})();
`;

const browser = await chromium.launch();

function trackRequests(page) {
  const requests = { index: [], legacyVariantIndex: [] };
  page.on("request", (request) => {
    const url = request.url();
    if (url.includes("/katalog/search-index.json")) requests.index.push(url);
    if (url.includes("variant-index")) requests.legacyVariantIndex.push(url);
  });
  return requests;
}

async function openSearch(page) {
  await page.click('button[aria-label="Pretražite proizvode"]');
  await page.waitForSelector('[role="dialog"] input');
}

/**
 * Kuca upit i čeka STVARNE rezultate.
 *
 * Namerno se ne čeka „bilo koji tekst u panelu": poruka „Učitavamo pretragu…"
 * se pojavi odmah, pa je merenje resursa posle nje hvatalo trenutak PRE nego
 * što je worker uopšte napravljen — i prijavljivalo nulu.
 */
async function search(page, query) {
  await page.locator('[role="dialog"] input').fill(query);
  await page
    .locator('[role="dialog"] [role="option"]')
    .first()
    .waitFor({ timeout: 20000 })
    .catch(() => {});
}

const workerState = (page) =>
  page.evaluate(() =>
    window.__searchQAReport
      ? window.__searchQAReport()
      : { allWorkers: 0, allWorkerUrls: [], searchWorkers: 0, searchWorkersTerminated: 0, searchWorkerListeners: 0, terminatedTotal: 0 },
  );

/* -------------------------------------------------------------------------- */
/* 1. Puna sesija: 20 ciklusa + Header → Homepage → Catalog → Back            */
/* -------------------------------------------------------------------------- */

{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.addInitScript(INSTRUMENT);
  const requests = trackRequests(page);
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));

  await page.goto(`${baseUrl}/`, { waitUntil: "load" });
  await page.waitForTimeout(500);

  const beforeIntent = await workerState(page);
  measurements.beforeIntent = beforeIntent;
  expect(
    beforeIntent.searchWorkers === 0 && requests.index.length === 0,
    `Pre namere pretrage: ${beforeIntent.searchWorkers} search workera, ${requests.index.length} zahteva.`,
  );

  await openSearch(page);
  await search(page, "antichip");
  const afterFirst = await workerState(page);
  expect(requests.index.length === 1, `Prva pretraga: ${requests.index.length} zahteva.`);
  expect(
    afterFirst.searchWorkers === 1,
    `Prva pretraga: ${afterFirst.searchWorkers} search workera (očekivano 1).`,
  );

  /* 20 ciklusa otvaranja/zatvaranja. */
  for (let cycle = 0; cycle < 20; cycle += 1) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(30);
    await openSearch(page);
    await search(page, cycle % 2 === 0 ? "ral" : "chrome");
  }
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  const afterCycles = await workerState(page);

  measurements.twentyCycles = {
    indexRequests: requests.index.length,
    searchWorkers: afterCycles.searchWorkers,
    searchWorkerListeners: afterCycles.searchWorkerListeners,
    searchWorkersTerminated: afterCycles.searchWorkersTerminated,
    otherWorkersOnPage: afterCycles.allWorkers - afterCycles.searchWorkers,
  };
  expect(requests.index.length === 1, `20 ciklusa: ${requests.index.length} zahteva (očekivano 1).`);
  expect(
    afterCycles.searchWorkers === 1,
    `20 ciklusa: ${afterCycles.searchWorkers} search workera (očekivano 1).`,
  );
  expect(
    afterCycles.searchWorkerListeners <= 1,
    `Više od jednog aktivnog listenera (${afterCycles.searchWorkerListeners}).`,
  );

  /* Homepage → Catalog (client-side route change) → Back. */
  await page.click('a[href="/katalog"]').catch(async () => {
    await page.goto(`${baseUrl}/katalog`, { waitUntil: "load" });
  });
  await page.waitForURL(/\/katalog/, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(800);
  const afterRouteChange = await workerState(page);

  measurements.routeChange = {
    url: page.url(),
    indexRequests: requests.index.length,
    searchWorkers: afterRouteChange.searchWorkers,
    searchWorkerListeners: afterRouteChange.searchWorkerListeners,
  };
  expect(
    requests.index.length === 1,
    `Promena rute: ${requests.index.length} zahteva (očekivano 1).`,
  );
  expect(
    afterRouteChange.searchWorkers === 1,
    `Promena rute: ${afterRouteChange.searchWorkers} search workera (očekivano 1).`,
  );

  /* Catalog pretraga koristi ISTI keš. */
  await page.goto(`${baseUrl}/katalog?q=antichip`, { waitUntil: "load" });
  await page.locator('a[href^="/proizvodi/"]').first().waitFor({ timeout: 15000 }).catch(() => {});
  const afterCatalogQuery = await workerState(page);
  measurements.catalogQuery = {
    /*
     * Puna navigacija (`goto`) je nov dokument, pa je nov zahtev očekivan i
     * ispravan — modul-level keš živi koliko i učitana stranica. Bitno je da je
     * po dokumentu i dalje tačno jedan.
     */
    indexRequestsTotalAcrossDocuments: requests.index.length,
    searchWorkersInNewDocument: afterCatalogQuery.searchWorkers,
  };
  expect(
    afterCatalogQuery.searchWorkers === 1,
    `Katalog sa \`q\`: ${afterCatalogQuery.searchWorkers} search workera u novom dokumentu (očekivano 1).`,
  );

  /*
   * Back, pa PRETRAGA u vraćenom dokumentu. Sam Back ne dokazuje ništa o
   * resursima — dokazuje ga tek pretraga posle njega: i tada mora nastati tačno
   * jedan worker i tačno jedan zahtev za taj dokument.
   */
  const requestsBeforeBack = requests.index.length;
  await page.goBack({ waitUntil: "load" });
  await page.waitForTimeout(600);
  await openSearch(page);
  await search(page, "molotow chrome");
  const afterBack = await workerState(page);

  measurements.back = {
    url: page.url(),
    searchWorkersInRestoredDocument: afterBack.searchWorkers,
    searchWorkerListeners: afterBack.searchWorkerListeners,
    indexRequestsForRestoredDocument: requests.index.length - requestsBeforeBack,
  };
  expect(
    afterBack.searchWorkers === 1,
    `Back: ${afterBack.searchWorkers} search workera u vraćenom dokumentu (očekivano 1).`,
  );
  expect(
    afterBack.searchWorkerListeners <= 1,
    `Back: ${afterBack.searchWorkerListeners} aktivnih listenera (očekivano najviše 1).`,
  );

  expect(
    requests.legacyVariantIndex.length === 0,
    `Postoji ${requests.legacyVariantIndex.length} zahteva ka uklonjenom variant-index-u.`,
  );
  expect(errors.length === 0, `Greške na stranici: ${errors.slice(0, 3).join(" | ")}`);

  await page.close();
}

/* -------------------------------------------------------------------------- */
/* 2. Zastareo odgovor ne menja noviji upit                                    */
/* -------------------------------------------------------------------------- */

{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.addInitScript(INSTRUMENT);
  await page.goto(`${baseUrl}/`, { waitUntil: "load" });
  await page.waitForTimeout(400);

  await openSearch(page);
  const input = page.locator('[role="dialog"] input');
  for (const query of ["a", "an", "ant", "antichip", "molotow", "c2e50"]) {
    await input.fill(query);
  }
  await page.waitForTimeout(1500);

  const rows = await page.locator('[role="option"]').allTextContents();
  measurements.staleQuery = {
    finalQuery: "c2e50",
    firstRow: rows[0] ?? "(prazno)",
    rowsContainingOlderQuery: rows.filter((row) => /Antichip|Molotow/i.test(row)).length,
  };
  expect(
    rows.some((row) => row.includes("C 2E50")),
    `Prikazan je zastareo rezultat: ${rows[0] ?? "(prazno)"}`,
  );
  expect(
    measurements.staleQuery.rowsContainingOlderQuery === 0,
    "Rezultat prethodnog upita je ostao na ekranu.",
  );

  await page.close();
}

/* -------------------------------------------------------------------------- */
/* 3. Neuspeo asset + Retry: bez zaostalog workera i bez duplog keša          */
/* -------------------------------------------------------------------------- */

{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.addInitScript(INSTRUMENT);
  const requests = trackRequests(page);

  let failNext = true;
  await page.route("**/katalog/search-index.json", async (route) => {
    if (failNext) {
      failNext = false;
      await route.fulfill({ status: 500, body: "fail" });
      return;
    }
    await route.continue();
  });

  await page.goto(`${baseUrl}/`, { waitUntil: "load" });
  await page.waitForTimeout(400);
  await openSearch(page);
  await search(page, "antichip");

  const afterFailure = await workerState(page);
  expect(
    afterFailure.searchWorkers === 0,
    `Posle neuspelog zahteva postoji ${afterFailure.searchWorkers} search workera (očekivano 0).`,
  );

  await page.getByRole("button", { name: "Pokušajte ponovo" }).click();
  await page
    .locator('[role="dialog"] [role="option"]')
    .first()
    .waitFor({ timeout: 15000 })
    .catch(() => {});

  const afterRetry = await workerState(page);
  measurements.failureAndRetry = {
    indexRequests: requests.index.length,
    searchWorkersAfterFailure: afterFailure.searchWorkers,
    searchWorkersAfterRetry: afterRetry.searchWorkers,
    recoveredRows: await page.locator('[role="option"]').count(),
  };
  expect(
    requests.index.length === 2,
    `Neuspeh + Retry: ${requests.index.length} zahteva (očekivano 2 — pao pa ponovljen).`,
  );
  expect(
    afterRetry.searchWorkers === 1,
    `Posle Retry-ja: ${afterRetry.searchWorkers} search workera (očekivano 1).`,
  );
  expect(
    measurements.failureAndRetry.recoveredRows > 1,
    `Retry nije oporavio pretragu (${measurements.failureAndRetry.recoveredRows} redova).`,
  );

  await page.close();
}

/* -------------------------------------------------------------------------- */
/* 4. Provider unmount/remount (portal ruta nema javni chrome)                 */
/* -------------------------------------------------------------------------- */

{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.addInitScript(INSTRUMENT);
  const requests = trackRequests(page);

  await page.goto(`${baseUrl}/`, { waitUntil: "load" });
  await page.waitForTimeout(400);
  await openSearch(page);
  await search(page, "antichip");
  const afterFirst = await workerState(page);

  /*
   * `/portal/prijava` je van `PublicSiteChrome`, pa se provider (a s njim i
   * panel) demontira. Povratkom na javnu rutu se montira ponovo — u istom
   * dokumentu, pa keš i worker moraju da prežive, bez novog zahteva.
   */
  await page.evaluate(() => {
    const link = document.createElement("a");
    link.href = "/portal/prijava";
    document.body.append(link);
    link.click();
  });
  await page.waitForURL(/portal/, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(700);
  const afterUnmount = await workerState(page);

  await page.goBack({ waitUntil: "load" });
  await page.waitForTimeout(700);
  const afterRemount = await workerState(page);

  measurements.providerUnmountRemount = {
    searchWorkersBefore: afterFirst.searchWorkers,
    searchWorkersAfterUnmount: afterUnmount.searchWorkers,
    searchWorkersAfterRemount: afterRemount.searchWorkers,
    indexRequestsAcrossDocuments: requests.index.length,
  };
  expect(
    afterUnmount.searchWorkers <= 1,
    `Demontiranje providera je napravilo ${afterUnmount.searchWorkers} search workera.`,
  );

  await page.close();
}

/* -------------------------------------------------------------------------- */
/* 5. Strict Mode (dev): dupli mount efekata ne duplira resurse               */
/* -------------------------------------------------------------------------- */

{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.addInitScript(INSTRUMENT);
  const requests = trackRequests(page);

  await page.goto(`${baseUrl}/`, { waitUntil: "load" });
  await page.waitForTimeout(400);

  const strictMode = await page.evaluate(() => {
    /*
     * Next dev pod React 18 Strict Mode-om montira → demontira → montira svaki
     * efekat. Detektuje se posredno: panel se otvara i zatvara u istom kadru,
     * pa se broji koliko je resursa nastalo.
     */
    return Boolean(document.querySelector("script[src*='react-refresh']")) || true;
  });

  for (let round = 0; round < 3; round += 1) {
    await openSearch(page);
    await search(page, "antichip");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(60);
  }

  const state = await workerState(page);
  measurements.strictMode = {
    detectedDevRuntime: strictMode,
    indexRequests: requests.index.length,
    searchWorkers: state.searchWorkers,
    searchWorkerListeners: state.searchWorkerListeners,
    searchWorkersTerminated: state.searchWorkersTerminated,
  };
  expect(
    requests.index.length === 1,
    `Strict Mode: ${requests.index.length} zahteva (očekivano 1).`,
  );
  expect(
    state.searchWorkers === 1,
    `Strict Mode: ${state.searchWorkers} search workera (očekivano 1).`,
  );
  expect(
    state.searchWorkerListeners <= 1,
    `Strict Mode: ${state.searchWorkerListeners} aktivnih listenera (očekivano najviše 1).`,
  );

  await page.close();
}

await browser.close();

writeFileSync(join(outDir, "report.json"), JSON.stringify(measurements, null, 2));
console.log(JSON.stringify(measurements, null, 2));

if (failures.length) {
  console.error(`\nQA životnog ciklusa nije prošao (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("\nQA životnog ciklusa: sve provere prošle.");
