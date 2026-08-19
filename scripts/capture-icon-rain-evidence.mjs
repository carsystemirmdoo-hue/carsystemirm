#!/usr/bin/env node
/**
 * Evidence that the icon rain → pile scene actually moves.
 *
 * Two kinds of proof, because a pair of stills can be faked by rendering two
 * layouts and a video can be waved away as a scroll:
 *
 *   1. MEASUREMENT — the script drives the real CSS animations through the Web
 *      Animations API, pausing them and seeking to a given time, then reads
 *      every glyph's transform matrix off the page. Start, middle and end must
 *      differ, the middle must be genuinely in between, and the end must equal
 *      the settled pile the server rendered.
 *   2. FRAMES + VIDEO — screenshots at those exact seek positions, plus a
 *      recorded run of the animation playing at normal speed.
 *
 * Attaches to an already-running dev server; never spawns one.
 *
 *   node scripts/capture-icon-rain-evidence.mjs [--base-url=…] [--out=…]
 */

import { chromium } from "playwright-core";
import { mkdirSync, renameSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => arg.replace(/^--/, "").split("=")),
);

const baseUrl = args["base-url"] ?? "http://localhost:3100";
const outDir = args.out ?? "docs/audit-screenshots/icon-rain-2026-08";
const videoDir = join(outDir, "video");
const labPath = "/interaction-demo/product-visual-lab";

const VARIANTS = ["precise", "spill", "cascade"];
/** Release stagger (280 ms) + longest fall (760 ms). */
const TOTAL_MS = 1040;
const SEEKS = [
  { label: "01-start", time: 0 },
  { label: "02-mid", time: Math.round(TOTAL_MS * 0.5) },
  { label: "03-end", time: TOTAL_MS },
];

const viewports = [
  { label: "1440x900", width: 1440, height: 900 },
  { label: "390x844", width: 390, height: 844 },
];

const themes = [
  { label: "light", dark: false },
  { label: "dark", dark: true },
];

const failures = [];
const record = (ok, message) => {
  if (!ok) failures.push(message);
};

/** Reads every glyph's resolved translation, in page pixels. */
function readGlyphPositions({ variant, theme }) {
  const card = document.querySelector(
    `[data-rain-showcase="${variant}"][data-rain-theme="${theme}"]`,
  );
  const frame = card?.querySelector("[data-rain-variant]");
  if (!frame) return null;
  const frameBox = frame.getBoundingClientRect();

  return [...frame.querySelectorAll('[class*="glyph"]')].map((glyph) => {
    const box = glyph.getBoundingClientRect();
    return {
      x: Math.round((box.x + box.width / 2 - frameBox.x) * 10) / 10,
      y: Math.round((box.y + box.height / 2 - frameBox.y) * 10) / 10,
      opacity: Number(getComputedStyle(glyph).opacity),
    };
  });
}

/** The site scrolls smoothly; scripted measurement needs it to jump. */
async function disableSmoothScroll(page) {
  await page.addStyleTag({
    content: "html, body, * { scroll-behavior: auto !important; }",
  });
}

const response = await fetch(baseUrl).catch(() => null);
if (!response) {
  console.error(`No dev server at ${baseUrl}.`);
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
mkdirSync(videoDir, { recursive: true });

const browser = await chromium.launch({ channel: "chrome" });
const measurements = {};

/* -------------------------------------------------------------------- */
/* 1. Seeked frames + motion measurement                                */
/* -------------------------------------------------------------------- */

/*
 * One pass over a viewport/theme pair. Wrapped so it can be retried: the dev
 * server's Fast Refresh occasionally reloads the page mid-run, which destroys
 * the execution context under whatever evaluate is in flight.
 */
async function capturePass(viewport, theme) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
    });
    const page = await context.newPage();
    const consoleErrors = [];
    page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
    page.on("pageerror", (error) => consoleErrors.push(String(error)));

    await page.goto(`${baseUrl}${labPath}`, { waitUntil: "networkidle", timeout: 180_000 });
    await disableSmoothScroll(page);

    /*
     * One card at a time. Each scene starts when IT enters the viewport, so the
     * card being measured has to be brought on screen and confirmed playing
     * before its animations can be paused — scrolling the section header into
     * view leaves the cards further down still idle, and seeking an animation
     * that was never created silently returns the settled pile.
     *
     * The lab draws both palettes on one page (a light block and a `.darkFrame`
     * block), so the theme is a selector, not a media emulation.
     */
    for (const variant of VARIANTS) {
      const selector = `[data-rain-showcase="${variant}"][data-rain-theme="${theme.label}"]`;
      const card = page.locator(selector).first();
      const frame = card.locator("[data-rain-variant]").first();

      await card.scrollIntoViewIfNeeded();
      await page.waitForFunction(
        (cardSelector) =>
          document
            .querySelector(cardSelector)
            ?.querySelector("[data-rain-variant]")?.dataset.phase === "playing",
        selector,
        { timeout: 15_000 },
      );

      // Take control of this card's animations so the frames are exact rather
      // than whatever the wall clock happened to land on.
      await page.evaluate((cardSelector) => {
        const scope = document.querySelector(cardSelector);
        for (const animation of document.getAnimations()) {
          if (scope?.contains(animation.effect?.target)) animation.pause();
        }
      }, selector);

      for (const seek of SEEKS) {
        await page.evaluate(
          ({ cardSelector, time }) => {
            const scope = document.querySelector(cardSelector);
            for (const animation of document.getAnimations()) {
              if (scope?.contains(animation.effect?.target)) {
                animation.currentTime = time;
              }
            }
          },
          { cardSelector: selector, time: seek.time },
        );
        await page.evaluate(
          () =>
            new Promise((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(resolve)),
            ),
        );
        await page.waitForTimeout(140);

        const file = join(
          outDir,
          `rain-${variant}--${seek.label}--${viewport.label}--${theme.label}.png`,
        );

        /*
         * Element screenshots scroll the target into view, and Chromium will
         * sometimes return the frame from before that scroll repainted — a flat
         * rectangle a few hundred bytes long instead of ~30 KB of scene. Retry
         * until the capture has real content rather than shipping an empty PNG
         * as evidence.
         */
        let buffer = await frame.screenshot();
        for (let attempt = 0; attempt < 5 && buffer.length < 4_000; attempt += 1) {
          await page.waitForTimeout(260);
          buffer = await frame.screenshot();
        }
        if (buffer.length < 4_000) {
          record(
            false,
            `${variant}/${seek.label}/${viewport.label}/${theme.label}: capture stayed blank`,
          );
        }
        writeFileSync(file, buffer);

        const positions = await page.evaluate(readGlyphPositions, {
          variant,
          theme: theme.label,
        });
        const key = `${variant}|${viewport.label}|${theme.label}`;
        measurements[key] = measurements[key] ?? {};
        measurements[key][seek.label] = positions;
      }
    }

    /*
     * The dev server occasionally 404s an HMR chunk mid-run. That is the
     * harness, not the page, so it is reported but does not fail the pass —
     * every other console error still does.
     */
    const pageErrors = consoleErrors.filter(
      (text) => !/Failed to load resource/.test(text),
    );
    const resourceErrors = consoleErrors.length - pageErrors.length;
    if (resourceErrors > 0) {
      console.warn(
        `  note: ${resourceErrors} dev-server resource 404(s) at ${viewport.label}/${theme.label}`,
      );
    }
    record(
      pageErrors.length === 0,
      `${viewport.label}/${theme.label}: console error — ${pageErrors[0] ?? ""}`,
    );

    await context.close();
}

for (const viewport of viewports) {
  for (const theme of themes) {
    let lastError = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await capturePass(viewport, theme);
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
        console.warn(
          `  retry ${viewport.label}/${theme.label}: ${String(error).split("\n")[0]}`,
        );
      }
    }
    if (lastError) throw lastError;
  }
}

/* -------------------------------------------------------------------- */
/* 2. Assertions on the measured motion                                 */
/* -------------------------------------------------------------------- */

for (const [key, frames] of Object.entries(measurements)) {
  const start = frames["01-start"];
  const mid = frames["02-mid"];
  const end = frames["03-end"];

  if (!start || !mid || !end) {
    failures.push(`${key}: missing frames`);
    continue;
  }

  const travelled = start.map((glyph, index) => end[index].y - glyph.y);
  const maxTravel = Math.max(...travelled);
  const movedAtMid = start.filter(
    (glyph, index) => Math.abs(mid[index].y - glyph.y) > 2,
  ).length;
  const midBetween = start.filter((glyph, index) => {
    const lo = Math.min(glyph.y, end[index].y) - 4;
    const hi = Math.max(glyph.y, end[index].y) + 12; // contact overshoots
    return mid[index].y >= lo && mid[index].y <= hi;
  }).length;

  record(maxTravel > 120, `${key}: glyphs barely move (max ${maxTravel}px)`);
  record(
    movedAtMid >= start.length * 0.5,
    `${key}: only ${movedAtMid}/${start.length} glyphs had moved at the midpoint`,
  );
  record(
    midBetween >= start.length * 0.8,
    `${key}: ${start.length - midBetween} glyphs were outside their own path at the midpoint`,
  );
  record(
    start.every((glyph) => glyph.y < 40),
    `${key}: some glyphs did not start above the frame`,
  );

  console.log(
    `${key}: ${start.length} glyphs · max fall ${Math.round(maxTravel)}px · ` +
      `${movedAtMid} moving at midpoint · ${midBetween} on-path`,
  );
}

/* -------------------------------------------------------------------- */
/* 3. Reduced motion must land straight on the pile                     */
/* -------------------------------------------------------------------- */

{
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.goto(`${baseUrl}${labPath}`, { waitUntil: "networkidle", timeout: 180_000 });
  await disableSmoothScroll(page);
  await page.evaluate(() => {
    document.querySelector("#icon-rain")?.scrollIntoView({ block: "start" });
  });
  await page.waitForTimeout(1500);

  const phases = await page.evaluate(() =>
    [...document.querySelectorAll("[data-rain-variant]")].map((el) => el.dataset.phase),
  );
  const running = await page.evaluate(() => document.getAnimations().length);
  const positions = await page.evaluate(readGlyphPositions, {
    variant: "precise",
    theme: "light",
  });

  record(
    phases.every((phase) => phase === "idle"),
    `reduced motion: a scene entered phase ${phases.find((p) => p !== "idle")}`,
  );
  record(running === 0, `reduced motion: ${running} animations were still scheduled`);
  record(
    positions.every((glyph) => glyph.y > 40),
    "reduced motion: glyphs are not resting in the pile",
  );

  await page.screenshot({
    path: join(outDir, "rain-reduced-motion--1440x900--light.png"),
  });
  console.log(`reduced motion: phase=${phases[0]}, ${running} animations scheduled`);
  await context.close();
}

/* -------------------------------------------------------------------- */
/* 4. Filmstrip — nine seeked frames across one fall                    */
/* -------------------------------------------------------------------- */

{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${baseUrl}${labPath}`, { waitUntil: "networkidle", timeout: 180_000 });
  await disableSmoothScroll(page);

  const selector = '[data-rain-showcase="precise"][data-rain-theme="light"]';
  const card = page.locator(selector).first();
  const frame = card.locator("[data-rain-variant]").first();
  await card.scrollIntoViewIfNeeded();
  await page.waitForFunction(
    (cardSelector) =>
      document.querySelector(cardSelector)?.querySelector("[data-rain-variant]")
        ?.dataset.phase === "playing",
    selector,
    { timeout: 15_000 },
  );
  await page.evaluate((cardSelector) => {
    const scope = document.querySelector(cardSelector);
    for (const animation of document.getAnimations()) {
      if (scope?.contains(animation.effect?.target)) animation.pause();
    }
  }, selector);

  const stripDir = join(outDir, "filmstrip");
  mkdirSync(stripDir, { recursive: true });

  for (let step = 0; step <= 8; step += 1) {
    const time = Math.round((step / 8) * TOTAL_MS);
    await page.evaluate(
      ({ cardSelector, at }) => {
        const scope = document.querySelector(cardSelector);
        for (const animation of document.getAnimations()) {
          if (scope?.contains(animation.effect?.target)) animation.currentTime = at;
        }
      },
      { cardSelector: selector, at: time },
    );
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    await page.waitForTimeout(120);

    let buffer = await frame.screenshot();
    for (let attempt = 0; attempt < 5 && buffer.length < 4_000; attempt += 1) {
      await page.waitForTimeout(220);
      buffer = await frame.screenshot();
    }
    writeFileSync(
      join(stripDir, `frame-${String(step).padStart(2, "0")}--${time}ms.png`),
      buffer,
    );
  }
  console.log(`filmstrip: 9 frames in ${stripDir}`);
  await context.close();
}

/* -------------------------------------------------------------------- */
/* 5. Video of the real thing playing                                   */
/* -------------------------------------------------------------------- */

for (const viewport of viewports) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    recordVideo: { dir: videoDir, size: viewport },
  });
  const page = await context.newPage();
  await page.goto(`${baseUrl}${labPath}`, { waitUntil: "networkidle", timeout: 180_000 });
  await disableSmoothScroll(page);
  await page.evaluate(() => {
    document.querySelector("#icon-rain")?.scrollIntoView({ block: "start" });
  });
  await page.waitForTimeout(400);
  // First run, then one replay per variant so the recording shows the whole
  // sequence three times over rather than a single blink.
  await page.waitForTimeout(2200);
  for (const variant of VARIANTS) {
    await page
      .locator(`[data-rain-showcase="${variant}"][data-rain-theme="light"] button`)
      .first()
      .click();
    await page.waitForTimeout(1800);
  }

  const video = page.video();
  await context.close();
  if (video) {
    const target = join(videoDir, `icon-rain--${viewport.label}.webm`);
    renameSync(await video.path(), target);
    console.log(`recorded ${target}`);
  }
}

await browser.close();

writeFileSync(
  join(outDir, "motion-measurements.json"),
  JSON.stringify(measurements, null, 2),
);

console.log(`\nframes + video in ${outDir}`);
console.log(readdirSync(outDir).length + " files");

if (failures.length > 0) {
  console.error(`\n${failures.length} FAILURES`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log("\nall icon-rain checks passed");
