#!/usr/bin/env node
/**
 * Screenshot evidence for the catalog / PDP product-visual pass.
 *
 * Attaches to an ALREADY RUNNING dev server (default http://localhost:3100)
 * and never spawns one: two Next dev processes sharing a dist directory
 * corrupt each other's build cache, which is how `.next-dev` was already being
 * shared by three servers when this pass started. If nothing is listening the
 * script fails loudly instead.
 *
 * Usage:
 *   node scripts/capture-product-visual-evidence.mjs [--base-url=…] [--out=…]
 *                                                    [--only=pdp|katalog|lab]
 */

import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => arg.replace(/^--/, "").split("=")),
);

const baseUrl = args["base-url"] ?? "http://localhost:3100";
const outDir = args.out ?? "docs/audit-screenshots/product-visual-2026-08";
const only = args.only ?? null;

/**
 * The regression fixtures. Each one exists because it broke, or could break, a
 * different part of the geometry: see `docs/CATALOG_PDP_VISUAL_HANDOFF.md` for
 * why each product is in the set.
 */
const targets = [
  {
    group: "pdp",
    name: "pdp-reference-flame-booster-thick-black",
    path: "/proizvodi/cosmos-lac-flame-booster-b-901-500-ml-flame-booster-b-901-thick-black",
    note: "Referentni slučaj: crn proizvod, visok i uzak",
  },
  {
    group: "pdp",
    name: "pdp-white-smalto-400",
    path: "/proizvodi/cosmos-lac-home-400-400-ml-white-smalto-400-white",
    note: "Vrlo svetao proizvod",
  },
  {
    group: "pdp",
    name: "pdp-strong-colour-flame-blue-fb-106",
    path: "/proizvodi/cosmos-lac-flame-blue-fb-106-400-ml-flame-blue-fb-106-signal-yellow",
    note: "Potvrđena jaka boja, član porodice",
  },
  {
    group: "pdp",
    name: "pdp-abrasive-p19",
    path: "/proizvodi/carsystem-p19-brusni-diskovi",
    note: "Abraziv bez atributa boje, kvadratno platno",
  },
  {
    group: "pdp",
    name: "pdp-wide-body-filler-b-2e11",
    path: "/proizvodi/rm-body-filler-white-b-2e11",
    note: "Nizak i širok, JPG bez alfa kanala",
  },
  {
    group: "pdp",
    name: "pdp-padded-uv-bodyfill-r",
    path: "/proizvodi/b-2p93-uv-bodyfill-r",
    note: "Najveće transparentne margine u katalogu",
  },
  {
    group: "pdp",
    name: "pdp-long-title-marking-591",
    path: "/proizvodi/cosmos-lac-fluorescent-marking-591-road-construction-marking-591-orange",
    note: "Najduži naziv proizvoda",
  },
  {
    group: "pdp",
    name: "pdp-no-image-norbin",
    path: "/proizvodi/norbin-n15-020-5l",
    note: "Proizvod bez slike — fallback",
  },
  {
    group: "katalog",
    name: "katalog-grid",
    path: "/katalog",
    note: "Katalog grid",
    scrollTo: "a[data-product-card-motion]",
  },
  {
    group: "katalog",
    name: "katalog-family-flame-orange",
    path: "/proizvodi/grupa/cosmos-lac-flame-orange",
    note: "Multi-variant family stranica",
  },
  {
    group: "lab",
    name: "lab-full",
    path: "/interaction-demo/product-visual-lab",
    note: "Visual lab, cela stranica",
    fullPage: true,
  },
];

const viewports = [
  { label: "1920x1080", width: 1920, height: 1080 },
  { label: "1440x900", width: 1440, height: 900 },
  { label: "1024x820", width: 1024, height: 820 },
  { label: "390x844", width: 390, height: 844 },
];

const themes = [
  { label: "light", dark: false },
  { label: "dark", dark: true },
];

/**
 * A PNG whose pixel data compresses to almost nothing is a flat, unpainted
 * frame. Comparing byte size against the frame's area is enough to tell an
 * empty capture from a real page without decoding the image.
 */
function isBlank(buffer) {
  return buffer.length < 12_000;
}

const response = await fetch(baseUrl, { method: "GET" }).catch(() => null);
if (!response) {
  console.error(
    `No dev server at ${baseUrl}. Start one first (npm run dev) — this script never spawns one.`,
  );
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ channel: "chrome" });
const captured = [];

for (const viewport of viewports) {
  for (const theme of themes) {
    // 1920 and 1024 only need one theme each; the point of those widths is
    // layout, and doubling them would just double the review pile.
    if (theme.dark && viewport.label !== "1440x900" && viewport.label !== "390x844") {
      continue;
    }

    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 1,
      colorScheme: theme.dark ? "dark" : "light",
      reducedMotion: "reduce",
    });
    for (const target of targets) {
      if (only && target.group !== only) continue;
      // The lab is a fixed-width review surface; capturing it four times adds
      // nothing, so it is taken once at the reference width.
      if (target.group === "lab" && (viewport.label !== "1440x900" || theme.dark)) {
        continue;
      }

      /*
       * A fresh page per target. Reusing one page across eleven navigations
       * left Chromium handing back unpainted frames for a random third of the
       * run — the pages themselves render fine (verified independently by
       * scripts/verify-product-visual-matrix.mjs), the compositor simply stops
       * keeping up. A new page resets it, at the cost of a few seconds.
       */
      const page = await context.newPage();

      // A dev server compiling a route on demand occasionally drops the first
      // navigation (net::ERR_ABORTED). Retry rather than losing the whole run.
      let lastError = null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await page.goto(`${baseUrl}${target.path}`, {
            waitUntil: "networkidle",
            timeout: 120_000,
          });
          lastError = null;
          break;
        } catch (error) {
          lastError = error;
          await page.waitForTimeout(1500);
        }
      }
      if (lastError) {
        await page.close();
        throw lastError;
      }

      await page.evaluate((dark) => {
        document.documentElement.classList.toggle("dark", dark);
      }, theme.dark);

      if (target.scrollTo) {
        await page.evaluate((selector) => {
          document.querySelector(selector)?.scrollIntoView({ block: "start" });
          window.scrollBy(0, -140);
        }, target.scrollTo);
      }

      // A page that is not the front tab can have its compositor throttled, and
      // then `screenshot` returns a frame that was never painted. Fronting the
      // page and waiting for two animation frames guarantees a real paint.
      await page.bringToFront();
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(900);
      await page.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          ),
      );

      const file = join(
        outDir,
        `${target.name}--${viewport.label}--${theme.label}.png`,
      );

      /*
       * Chromium occasionally hands back a frame it has not painted yet, which
       * shows up as a single flat colour. The page is fine — measured with
       * scripts/verify-product-visual-matrix.mjs, every one of these routes
       * renders — so the fix is to notice the empty frame and take another.
       */
      let buffer = null;
      for (let attempt = 0; attempt < 4; attempt += 1) {
        buffer = await page.screenshot({ fullPage: Boolean(target.fullPage) });
        if (!isBlank(buffer)) break;
        await page.waitForTimeout(700);
      }
      if (isBlank(buffer)) {
        console.warn(`WARNING: ${file} still looks blank after 4 attempts`);
      }
      writeFileSync(file, buffer);
      captured.push(file);
      console.log(`captured ${file}`);
      await page.close();
    }

    await context.close();
  }
}

await browser.close();
console.log(`\n${captured.length} screenshots in ${outDir}`);
