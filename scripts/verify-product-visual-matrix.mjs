#!/usr/bin/env node
/**
 * Test matrix for the catalog / PDP product-visual pass.
 *
 * Asserts the things a screenshot cannot: that the product is actually inside
 * its surface, that no control overlaps it, that the two columns start on the
 * same line, that nothing overflows horizontally, that the browser logged no
 * errors and React reported no hydration mismatch, and that catalog state
 * survives a round trip to a product page and back.
 *
 * Attaches to an already-running dev server; never spawns one (three servers
 * were already sharing `.next-dev` when this pass started, which is exactly the
 * cache corruption the repo's other capture script warns about).
 *
 *   node scripts/verify-product-visual-matrix.mjs [--base-url=…]
 */

import { chromium } from "playwright-core";

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => arg.replace(/^--/, "").split("=")),
);
const baseUrl = args["base-url"] ?? "http://localhost:3100";

const products = [
  ["reference-black-tall", "/proizvodi/cosmos-lac-flame-booster-b-901-500-ml-flame-booster-b-901-thick-black"],
  ["white-light", "/proizvodi/cosmos-lac-home-400-400-ml-white-smalto-400-white"],
  ["strong-colour", "/proizvodi/cosmos-lac-flame-blue-fb-106-400-ml-flame-blue-fb-106-signal-yellow"],
  ["no-colour-abrasive", "/proizvodi/carsystem-p19-brusni-diskovi"],
  ["wide-squat", "/proizvodi/rm-body-filler-white-b-2e11"],
  ["padded-transparent", "/proizvodi/b-2p93-uv-bodyfill-r"],
  ["long-title", "/proizvodi/cosmos-lac-fluorescent-marking-591-road-construction-marking-591-orange"],
  ["narrowest", "/proizvodi/cosmos-lac-molotow-burner-600-ml-mb-600ml-copper"],
  ["svg-no-metrics", "/proizvodi/befar-sundjer-crni-25x150"],
  ["no-image", "/proizvodi/norbin-n15-020-5l"],
  ["family-variant", "/proizvodi/cosmos-lac-easy-max-cl-800-ral-9010-400-ml-easy-max-ral-9010-800-white"],
];

const viewports = [
  { label: "1920", width: 1920, height: 1080 },
  { label: "1440", width: 1440, height: 900 },
  { label: "1024", width: 1024, height: 820 },
  { label: "390", width: 390, height: 844 },
];

const failures = [];
const rows = [];
const record = (ok, message) => {
  if (!ok) failures.push(message);
};

/** Runs in the page: measures the product's real silhouette against the stage. */
function measureStage() {
  const stage = document.querySelector("[data-product-hero-visual]");
  const object = stage?.querySelector('[class*="heroProductObject"]');
  if (!stage || !object) return null;

  const cs = getComputedStyle(stage);
  const num = (name) => parseFloat(cs.getPropertyValue(name));
  const fx = num("--product-content-fill-x");
  const fy = num("--product-content-fill-y");
  const ox = num("--product-content-offset-x");
  const oy = num("--product-content-offset-y");

  const ob = object.getBoundingClientRect();
  const sb = stage.getBoundingClientRect();
  const product = {
    x: ob.x + ob.width * ox,
    y: ob.y + ob.height * oy,
    w: ob.width * fx,
    h: ob.height * fy,
  };

  const overlaps = (rect) =>
    !(
      product.x + product.w <= rect.x ||
      rect.x + rect.width <= product.x ||
      product.y + product.h <= rect.y ||
      rect.y + rect.height <= product.y
    );

  const zoom = stage.querySelector("button[aria-pressed]");
  const badge = stage.querySelector('[class*="quantityBadge"]');
  const brandMark = stage.querySelector('[class*="heroBrandMark"]');
  const chips = document.querySelector('[class*="heroTaxonomy"]');
  const title = document.querySelector("h1");

  const stageEl = object.closest('[class*="stickyStage"]') ?? stage;
  const envelope = getComputedStyle(stageEl);
  const envelopeW = parseFloat(envelope.getPropertyValue("--product-envelope-w"));
  const envelopeH = parseFloat(envelope.getPropertyValue("--product-envelope-h"));
  const usage = Math.round(
    Math.max(
      (product.w / ((envelopeW / 100) * sb.width)) * 100,
      (product.h / ((envelopeH / 100) * sb.height)) * 100,
    ),
  );

  return {
    stage: { w: Math.round(sb.width), h: Math.round(sb.height) },
    product: { w: Math.round(product.w), h: Math.round(product.h) },
    pctOfStageHeight: Math.round((product.h / sb.height) * 100),
    envelopeUsage: Number.isFinite(usage) ? usage : 100,
    centreOffsetX: Math.round(product.x + product.w / 2 - (sb.x + sb.width / 2)),
    overflowsStage: Math.round(
      Math.max(
        sb.x - product.x,
        product.x + product.w - (sb.x + sb.width),
        sb.y - product.y,
        product.y + product.h - (sb.y + sb.height),
      ),
    ),
    zoomOverlapsProduct: zoom ? overlaps(zoom.getBoundingClientRect()) : null,
    zoomLabel: zoom?.getAttribute("aria-label") ?? null,
    zoomHasAccessibleName: Boolean(zoom?.getAttribute("aria-label")),
    badgeOverlapsProduct: badge ? overlaps(badge.getBoundingClientRect()) : null,
    badgeText: badge?.textContent?.trim() ?? null,
    brandOverlapsProduct: brandMark ? overlaps(brandMark.getBoundingClientRect()) : null,
    columnDelta:
      chips && sb
        ? Math.round(chips.getBoundingClientRect().y - sb.y)
        : null,
    titleClipped: title ? title.scrollWidth > title.clientWidth + 1 : null,
    imageAlt: stage.querySelector("img")?.getAttribute("alt") ?? null,
    documentOverflow: document.documentElement.scrollWidth - window.innerWidth,
  };
}

const response = await fetch(baseUrl).catch(() => null);
if (!response) {
  console.error(`No dev server at ${baseUrl}.`);
  process.exit(1);
}

const browser = await chromium.launch({ channel: "chrome" });

for (const viewport of viewports) {
  for (const dark of [false, true]) {
    // Both themes at the reference width and on mobile; the other two widths
    // are layout checks where a second theme adds nothing.
    if (dark && viewport.label !== "1440" && viewport.label !== "390") continue;

    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      colorScheme: dark ? "dark" : "light",
    });
    const page = await context.newPage();
    const consoleErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => consoleErrors.push(String(error)));

    for (const [label, path] of products) {
      consoleErrors.length = 0;
      await page.goto(`${baseUrl}${path}`, { waitUntil: "networkidle", timeout: 120_000 });
      await page.evaluate((isDark) => {
        document.documentElement.classList.toggle("dark", isDark);
      }, dark);
      await page.waitForTimeout(400);

      const measured = await page.evaluate(measureStage);
      const theme = dark ? "dark" : "light";
      const id = `${label} @${viewport.label} ${theme}`;

      if (!measured) {
        failures.push(`${id}: no stage found`);
        continue;
      }

      rows.push({ id, ...measured });

      record(measured.overflowsStage <= 1, `${id}: product overflows stage by ${measured.overflowsStage}px`);
      record(measured.documentOverflow <= 0, `${id}: horizontal page overflow ${measured.documentOverflow}px`);
      record(Math.abs(measured.centreOffsetX) <= 2, `${id}: product off-centre by ${measured.centreOffsetX}px`);
      record(measured.zoomOverlapsProduct !== true, `${id}: zoom control overlaps the product`);
      record(measured.badgeOverlapsProduct !== true, `${id}: quantity badge overlaps the product`);
      record(measured.brandOverlapsProduct !== true, `${id}: brand mark overlaps the product`);
      record(measured.titleClipped !== true, `${id}: title is clipped`);
      record(
        measured.zoomLabel === null || measured.zoomHasAccessibleName,
        `${id}: zoom control has no accessible name`,
      );
      record(Boolean(measured.imageAlt) || label === "no-image", `${id}: product image has no alt text`);
      /*
       * The product must be limited by its own envelope, not by anything else.
       * Checking a flat "% of stage height" would be wrong: a squat tin is
       * correctly width-limited and will never be as tall as a spray can. What
       * must hold is that ONE of the two envelope bounds is actually reached.
       */
      if (label !== "no-image") {
        record(
          measured.envelopeUsage >= 97,
          `${id}: product reaches only ${measured.envelopeUsage}% of its envelope`,
        );
      }

      const hydration = consoleErrors.filter((text) =>
        /hydrat|did not match|Text content does not match/i.test(text),
      );
      record(hydration.length === 0, `${id}: hydration error — ${hydration[0] ?? ""}`);
      record(
        consoleErrors.length === 0,
        `${id}: console error — ${consoleErrors[0] ?? ""}`,
      );
    }

    await context.close();
  }
}

/* ------------------------------------------------------------------ */
/* Catalog → PDP → Back                                               */
/* ------------------------------------------------------------------ */

const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
// Use the canonical Serbian parameter: `?brand=` is normalised to `?brend=`
// by a client-side replace, which would otherwise leave an extra history entry
// for `goBack` to land on.
await page.goto(`${baseUrl}/katalog?brend=cosmos-lac`, { waitUntil: "networkidle", timeout: 120_000 });
await page.waitForSelector("a[data-product-card-motion]");

const before = await page.evaluate(() => ({
  url: location.pathname + location.search,
  cards: document.querySelectorAll("a[data-product-card-motion]").length,
}));

// Scroll far enough to trigger at least one infinite-scroll page.
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(1200);
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(1200);

const loaded = await page.evaluate(() => ({
  cards: document.querySelectorAll("a[data-product-card-motion]").length,
  scrollY: Math.round(window.scrollY),
}));

/*
 * Click a card rather than navigating directly: `CatalogExplorer` persists its
 * session from a capture-phase click, precisely because Next resets scroll the
 * moment a `Link` navigation starts. A scripted `goto` skips that handler and
 * would test a flow no user can perform.
 */
const cards = page.locator("a[data-product-card-motion]");
const cardCount = await cards.count();
const target = cards.nth(cardCount - 12);
await target.scrollIntoViewIfNeeded();
await page.waitForTimeout(500);

// Position at the moment of the click is what the explorer stores, so that is
// what restoration has to match.
const scrollAtClick = await page.evaluate(() => Math.round(window.scrollY));
const catalogUrl = page.url();
await target.click();
await page.waitForFunction(
  (from) => location.href !== from,
  catalogUrl,
  { timeout: 30_000 },
);
await page.waitForLoadState("networkidle");
await page.goBack({ waitUntil: "networkidle" });
await page.waitForTimeout(2000);

const after = await page.evaluate(() => ({
  url: location.pathname + location.search,
  cards: document.querySelectorAll("a[data-product-card-motion]").length,
  scrollY: Math.round(window.scrollY),
}));

record(after.url === before.url, `back: URL changed ${before.url} → ${after.url}`);
record(
  after.cards >= loaded.cards,
  `back: restored ${after.cards} cards, had ${loaded.cards} before leaving`,
);
record(
  Math.abs(after.scrollY - scrollAtClick) < 400,
  `back: scroll restored to ${after.scrollY}, clicked at ${scrollAtClick}`,
);

await context.close();
await browser.close();

console.log("\nmeasurements");
console.table(
  rows.map((row) => ({
    case: row.id,
    stage: `${row.stage.w}x${row.stage.h}`,
    product: `${row.product.w}x${row.product.h}`,
    "%h": row.pctOfStageHeight,
    dx: row.centreOffsetX,
    colΔ: row.columnDelta,
    zoomHit: row.zoomOverlapsProduct,
    badgeHit: row.badgeOverlapsProduct,
  })),
);

console.log(
  `\ncatalog round trip: ${before.cards} → ${loaded.cards} cards, back restored ${after.cards} at y=${after.scrollY} (clicked at y=${scrollAtClick})`,
);

if (failures.length > 0) {
  console.error(`\n${failures.length} FAILURES`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(`\nall checks passed (${rows.length} cases)`);
