#!/usr/bin/env node
/**
 * V1 vs V2 evidence for the icon rain → pile scene.
 *
 * The point is a fair comparison, so every capture pairs the two
 * implementations on the same product, the same seed, the same frame ratio, the
 * same theme and the same viewport — the only difference in a pair is the
 * implementation.
 *
 * Produces:
 *   · side-by-side start / mid / end stills per case
 *   · a side-by-side filmstrip
 *   · desktop and mobile WebM of V2 playing
 *   · GIF per V2 variant
 *   · the settled pile with no animation at all (reduced motion)
 *   · a check that nothing is left holding `will-change` once the pile lands
 *
 * Attaches to an already-running dev server; never spawns one.
 *
 *   node scripts/capture-icon-rain-v2-evidence.mjs [--base-url=…] [--out=…]
 */

import { chromium } from "playwright-core";
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => arg.replace(/^--/, "").split("=")),
);

const baseUrl = args["base-url"] ?? "http://localhost:3100";
const outDir = args.out ?? "docs/audit-screenshots/icon-rain-v2-2026-08";
const videoDir = join(outDir, "video");
const stripDir = join(outDir, "filmstrip");
const labPath = "/interaction-demo/product-visual-lab";

/** V1's own budget; V2's is the same, so one seek scale covers both. */
const TOTAL_MS = 1040;
const SEEKS = [
  { label: "01-start", time: 0 },
  { label: "02-mid", time: Math.round(TOTAL_MS * 0.5) },
  { label: "03-end", time: TOTAL_MS },
];

/**
 * All four have genuine alpha transparency. The Car Fit masking film is
 * deliberately excluded — it is a JPG with a baked white background and would
 * prove nothing about the scene behind it.
 */
const CASES = [
  {
    slug: "cosmos-lac-flame-booster-b-901-500-ml-flame-booster-b-901-thick-black",
    name: "tall-black",
  },
  { slug: "carsystem-p19-brusni-diskovi", name: "round-mid" },
  { slug: "carsystem-f19-brusni-diskovi", name: "round-black" },
  { slug: "cosmos-lac-home-400-400-ml-white-smalto-400-white", name: "light" },
];

const VARIANTS = ["cascade", "precise"];
const viewports = [
  { label: "1440", width: 1440, height: 900 },
  { label: "390", width: 390, height: 844 },
];

const failures = [];
const notes = [];
const record = (ok, message) => {
  if (!ok) failures.push(message);
};

async function disableSmoothScroll(page) {
  await page.addStyleTag({
    content: "html, body, * { scroll-behavior: auto !important; }",
  });
}

/*
 * Scoped to the comparison section on purpose. The V2 showcase in section 8
 * renders the same cards in a narrower auto-fill grid, and an unscoped
 * `.first()` picked a 245 px V2 card to sit beside a 505 px V1 card — which is
 * not a comparison, it is two different frames.
 */
const selectorFor = ({ version, variant, theme, slug }) =>
  `#icon-rain-compare [data-rain-version="${version}"][data-rain-showcase="${variant}"]` +
  `[data-rain-theme="${theme}"][data-rain-case="${slug}"]`;

/** Waits for a card's scene to report that it started, then freezes it. */
async function freezeCard(page, selector) {
  await page.locator(selector).first().scrollIntoViewIfNeeded();
  await page.waitForFunction(
    (cardSelector) => {
      const phase = document
        .querySelector(cardSelector)
        ?.querySelector("[data-rain-variant]")?.dataset.phase;
      return phase === "playing" || phase === "complete";
    },
    selector,
    { timeout: 20_000 },
  );
  await page.evaluate((cardSelector) => {
    const scope = document.querySelector(cardSelector);
    for (const animation of document.getAnimations()) {
      if (scope?.contains(animation.effect?.target)) animation.pause();
    }
  }, selector);
}

async function seekCard(page, selector, time) {
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
  await page.waitForTimeout(140);
}

/**
 * Screenshot a frame by clipping the viewport rather than by asking Playwright
 * for an element screenshot.
 *
 * An element screenshot runs actionability checks, and "waiting for element to
 * be stable" never resolves here: the page carries other scenes that are still
 * animating, and the two cards under measurement are deliberately frozen
 * mid-flight. Clipping skips all of that and photographs exactly the box.
 */
async function shoot(page, locator) {
  await locator.scrollIntoViewIfNeeded();
  await page.waitForTimeout(120);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const box = await locator.boundingBox();
    if (box && box.width > 1 && box.height > 1) {
      const clip = {
        x: Math.max(0, Math.round(box.x)),
        y: Math.max(0, Math.round(box.y)),
        width: Math.round(box.width),
        height: Math.round(box.height),
      };
      const buffer = await page.screenshot({ clip });
      if (buffer.length >= 4_000) return buffer;
    }
    await page.waitForTimeout(250);
  }

  return page.screenshot({ clip: (await locator.boundingBox()) ?? undefined });
}

/** Glues two PNG buffers side by side with a divider, using raw canvas in the
 *  page so the script needs no image library. */
async function sideBySide(page, left, right, label) {
  return page.evaluate(
    async ({ leftData, rightData, caption }) => {
      const load = (data) =>
        new Promise((resolve) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.src = data;
        });
      const [a, b] = await Promise.all([load(leftData), load(rightData)]);
      const gap = 12;
      const header = 26;
      const canvas = document.createElement("canvas");
      canvas.width = a.width + b.width + gap;
      canvas.height = Math.max(a.height, b.height) + header;
      const context = canvas.getContext("2d");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(a, 0, header);
      context.drawImage(b, a.width + gap, header);
      context.fillStyle = "#111111";
      context.font = "600 13px ui-sans-serif, system-ui, sans-serif";
      context.fillText(`V1 — ${caption}`, 4, 17);
      context.fillText(`V2 — ${caption}`, a.width + gap + 4, 17);
      return canvas.toDataURL("image/png");
    },
    { leftData: left, rightData: right, caption: label },
  );
}

const toBuffer = (dataUrl) => Buffer.from(dataUrl.split(",")[1], "base64");
const toDataUrl = (buffer) => `data:image/png;base64,${buffer.toString("base64")}`;

const response = await fetch(baseUrl).catch(() => null);
if (!response) {
  console.error(`No dev server at ${baseUrl}.`);
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
mkdirSync(videoDir, { recursive: true });
mkdirSync(stripDir, { recursive: true });

const browser = await chromium.launch({ channel: "chrome" });

/* -------------------------------------------------------------------- */
/* 1. Side-by-side stills, per case / variant / theme / viewport        */
/* -------------------------------------------------------------------- */

for (const viewport of viewports) {
  for (const theme of ["light", "dark"]) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
    });
    const page = await context.newPage();
    const consoleErrors = [];
    page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
    page.on("pageerror", (error) => consoleErrors.push(String(error)));

    await page.goto(`${baseUrl}${labPath}?rain=compare`, {
      waitUntil: "networkidle",
      timeout: 180_000,
    });
    await disableSmoothScroll(page);

    for (const variant of VARIANTS) {
      // The dark comparison block only carries the two black products.
      const cases =
        theme === "dark"
          ? CASES.filter((entry) => entry.name.includes("black"))
          : CASES;
      if (theme === "dark" && variant !== "cascade") continue;

      for (const entry of cases) {
        const v1Selector = selectorFor({
          version: "v1",
          variant,
          theme,
          slug: entry.slug,
        });
        const v2Selector = selectorFor({
          version: "v2",
          variant,
          theme,
          slug: entry.slug,
        });

        if ((await page.locator(v1Selector).count()) === 0) continue;

        await freezeCard(page, v1Selector);
        await freezeCard(page, v2Selector);

        for (const seek of SEEKS) {
          await seekCard(page, v1Selector, seek.time);
          await seekCard(page, v2Selector, seek.time);

          const left = await shoot(
            page,
            page.locator(v1Selector).first().locator("[data-rain-variant]").first(),
          );
          const right = await shoot(
            page,
            page.locator(v2Selector).first().locator("[data-rain-variant]").first(),
          );
          record(
            left.length > 4_000 && right.length > 4_000,
            `${entry.name}/${variant}/${viewport.label}/${theme}/${seek.label}: blank capture`,
          );

          const merged = await sideBySide(
            page,
            toDataUrl(left),
            toDataUrl(right),
            `${entry.name} · ${variant} · ${seek.label}`,
          );
          writeFileSync(
            join(
              outDir,
              `v1-vs-v2-${variant}--${entry.name}--${seek.label}--${viewport.label}--${theme}.png`,
            ),
            toBuffer(merged),
          );
        }
      }
    }

    const pageErrors = consoleErrors.filter((t) => !/Failed to load resource/.test(t));
    record(
      pageErrors.length === 0,
      `${viewport.label}/${theme}: console error — ${pageErrors[0] ?? ""}`,
    );

    await context.close();
  }
}

/* -------------------------------------------------------------------- */
/* 2. Side-by-side filmstrip + GIF frames per V2 variant                */
/* -------------------------------------------------------------------- */

for (const variant of VARIANTS) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${baseUrl}${labPath}?rain=compare`, {
    waitUntil: "networkidle",
    timeout: 180_000,
  });
  await disableSmoothScroll(page);

  const entry = CASES[1]; // round product — the clearest read of the pile
  const v1Selector = selectorFor({ version: "v1", variant, theme: "light", slug: entry.slug });
  const v2Selector = selectorFor({ version: "v2", variant, theme: "light", slug: entry.slug });
  await freezeCard(page, v1Selector);
  await freezeCard(page, v2Selector);

  const frames = [];
  for (let step = 0; step <= 8; step += 1) {
    const time = Math.round((step / 8) * TOTAL_MS);
    await seekCard(page, v1Selector, time);
    await seekCard(page, v2Selector, time);

    const left = await shoot(
      page,
      page.locator(v1Selector).first().locator("[data-rain-variant]").first(),
    );
    const right = await shoot(
      page,
      page.locator(v2Selector).first().locator("[data-rain-variant]").first(),
    );
    const merged = await sideBySide(page, toDataUrl(left), toDataUrl(right), `${time} ms`);
    writeFileSync(
      join(stripDir, `v1-vs-v2-${variant}--${String(step).padStart(2, "0")}--${time}ms.png`),
      toBuffer(merged),
    );
    writeFileSync(
      join(stripDir, `v2-${variant}--${String(step).padStart(2, "0")}--${time}ms.png`),
      right,
    );
    frames.push(time);
  }
  notes.push(`filmstrip ${variant}: ${frames.length} paired frames`);
  await context.close();
}

/* -------------------------------------------------------------------- */
/* 3. Settled pile with no animation, and the will-change check         */
/* -------------------------------------------------------------------- */

{
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.goto(`${baseUrl}${labPath}?rain=v2`, {
    waitUntil: "networkidle",
    timeout: 180_000,
  });
  await disableSmoothScroll(page);
  await page.evaluate(() =>
    document.querySelector("#icon-rain-v2")?.scrollIntoView({ block: "start" }),
  );
  await page.waitForTimeout(1400);

  const state = await page.evaluate(() => ({
    phases: [...document.querySelectorAll('[data-rain-version="v2"] [data-rain-variant]')].map(
      (el) => el.dataset.phase,
    ),
    animations: document.getAnimations().length,
  }));
  record(
    state.phases.every((phase) => phase === "idle"),
    `reduced motion: a V2 scene left idle (${state.phases.find((p) => p !== "idle")})`,
  );
  record(state.animations === 0, `reduced motion: ${state.animations} animations scheduled`);
  notes.push(
    `reduced motion: ${state.phases.length} V2 scenes all idle, ${state.animations} animations scheduled`,
  );

  const card = page
    .locator('[data-rain-version="v2"][data-rain-showcase="cascade"]')
    .first()
    .locator("[data-rain-variant]")
    .first();
  writeFileSync(
    join(outDir, "v2-settled-pile-no-animation--1440--light.png"),
    await shoot(page, card),
  );
  await context.close();
}

{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${baseUrl}${labPath}?rain=v2`, {
    waitUntil: "networkidle",
    timeout: 180_000,
  });
  await disableSmoothScroll(page);
  await page.evaluate(() =>
    document.querySelector("#icon-rain-v2")?.scrollIntoView({ block: "start" }),
  );
  await page.waitForTimeout(2600);

  /*
   * The reason the `complete` phase exists: V1 never leaves `playing`, so every
   * glyph keeps `will-change: transform` and a compositor layer for the life of
   * the page. V2 must drop both once the pile has landed.
   */
  const hints = await page.evaluate(() => {
    const frames = [...document.querySelectorAll('[data-rain-version="v2"] [data-rain-variant]')];
    const onScreen = frames.filter((frame) => frame.dataset.phase === "complete");
    const stillHinted = onScreen.flatMap((frame) =>
      [...frame.querySelectorAll('[class*="glyph"]')].filter(
        (glyph) => getComputedStyle(glyph).willChange !== "auto",
      ),
    );
    return { completed: onScreen.length, stillHinted: stillHinted.length };
  });

  record(
    hints.completed > 0,
    "will-change check: no V2 scene reached the complete phase",
  );
  record(
    hints.stillHinted === 0,
    `will-change check: ${hints.stillHinted} glyphs still hold a compositor hint after completing`,
  );
  notes.push(
    `will-change: ${hints.completed} V2 scenes completed, ${hints.stillHinted} glyphs still hinted`,
  );

  // The same probe against V1, recorded as the contrast rather than as a failure.
  await page.goto(`${baseUrl}${labPath}?rain=v1`, {
    waitUntil: "networkidle",
    timeout: 180_000,
  });
  await disableSmoothScroll(page);
  await page.evaluate(() =>
    document.querySelector("#icon-rain")?.scrollIntoView({ block: "start" }),
  );
  await page.waitForTimeout(2600);
  const v1Hints = await page.evaluate(() => {
    const frames = [...document.querySelectorAll("[data-rain-variant]")].filter(
      (frame) => frame.dataset.phase === "playing",
    );
    return frames.flatMap((frame) =>
      [...frame.querySelectorAll('[class*="glyph"]')].filter(
        (glyph) => getComputedStyle(glyph).willChange !== "auto",
      ),
    ).length;
  });
  notes.push(`will-change: V1 still holds ${v1Hints} hinted glyphs after settling`);

  await context.close();
}

/* -------------------------------------------------------------------- */
/* 4. Video of V2 playing, desktop and mobile                           */
/* -------------------------------------------------------------------- */

for (const viewport of viewports) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    recordVideo: { dir: videoDir, size: { width: viewport.width, height: viewport.height } },
  });
  const page = await context.newPage();
  await page.goto(`${baseUrl}${labPath}?rain=v2`, {
    waitUntil: "networkidle",
    timeout: 180_000,
  });
  await disableSmoothScroll(page);
  await page.evaluate(() =>
    document.querySelector("#icon-rain-v2")?.scrollIntoView({ block: "start" }),
  );
  await page.waitForTimeout(2200);

  for (const variant of VARIANTS) {
    const button = page
      .locator(`[data-rain-version="v2"][data-rain-showcase="${variant}"] button`)
      .first();
    if ((await button.count()) === 0) continue;
    await button.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await button.click();
    await page.waitForTimeout(1900);
  }

  const video = page.video();
  await context.close();
  if (video) {
    const target = join(videoDir, `icon-rain-v2-cascade--${viewport.label}.webm`);
    renameSync(await video.path(), target);
    notes.push(`recorded ${target}`);
  }
}

await browser.close();

console.log("\nV2 evidence:");
for (const note of notes) console.log(`  · ${note}`);

if (failures.length > 0) {
  console.error(`\n${failures.length} FAILURES`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log("\nall V1/V2 comparison checks passed");
