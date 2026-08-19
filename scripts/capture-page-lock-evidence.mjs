#!/usr/bin/env node
/**
 * Evidence capture for a page-lock pass.
 *
 * Attaches to an ALREADY RUNNING dev server (default http://localhost:3100)
 * instead of starting one. Two Next dev processes sharing a dist directory
 * corrupt each other's build cache, so this script deliberately never spawns a
 * server — if nothing is listening, it fails loudly rather than starting one.
 *
 * Usage:
 *   node scripts/capture-page-lock-evidence.mjs [--base-url=…] [--out=…]
 */

import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => arg.replace(/^--/, "").split("=")),
);

const baseUrl = args["base-url"] ?? "http://localhost:3100";
const outDir = args.out ?? "docs/audit-screenshots/page-lock-01";

/** The four surfaces this pass locks, plus the PDP cases that represent it. */
const targets = [
  { name: "pdp-rm-2210-onyx-activator", path: "/proizvodi/2210-onyx-activator" },
  { name: "pdp-baslac-60-20-razredjivac", path: "/proizvodi/baslac-60-20-razredjivac" },
  {
    name: "pdp-cosmos-antichip-250",
    path: "/proizvodi/cosmos-lac-automotive-250-400-ml-antichip-250-white",
  },
  { name: "pdp-norbin-no-image", path: "/proizvodi/norbin-n15-020-5l" },
  { name: "brand-cosmos-lac", path: "/brendovi/cosmos-lac" },
  { name: "brand-befar", path: "/brendovi/befar" },
  { name: "katalozi", path: "/katalozi" },
  { name: "katalozi-brand-baslac", path: "/katalozi?brand=baslac" },
];

const viewports = [
  { label: "1440x900", width: 1440, height: 900 },
  { label: "390x844", width: 390, height: 844 },
];

const response = await fetch(baseUrl, { method: "GET" }).catch(() => null);
if (!response?.ok) {
  console.error(
    `Nema servera na ${baseUrl}. Pokreni postojeći dev server pa ponovi — ovaj skript ga namerno ne pokreće.`,
  );
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const captured = [];

for (const viewport of viewports) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  for (const target of targets) {
    await page.goto(`${baseUrl}${target.path}`, { waitUntil: "networkidle" });
    // Lazy images below the fold only start once they scroll into view.
    await page.evaluate(async () => {
      const step = window.innerHeight;
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo({ top: y, behavior: "instant" });
        await new Promise((resolve) => setTimeout(resolve, 120));
      }
      window.scrollTo({ top: 0, behavior: "instant" });
    });
    await page.waitForTimeout(600);

    const file = join(outDir, `${target.name}-${viewport.label}.png`);
    await page.screenshot({ path: file, fullPage: true });
    captured.push(file);
    console.log(`  ✓ ${file}`);
  }

  await context.close();
}

await browser.close();
console.log(`\n${captured.length} snimaka u ${outDir}`);
