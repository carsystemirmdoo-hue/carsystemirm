#!/usr/bin/env node
/**
 * What the ONE animation that is already in production actually does.
 *
 * `ProductHeroSprayBackdrop` is the only decorative animation shipping on a
 * public page today. Before anything else joins it, its behaviour is measured
 * rather than inferred from the source: when it starts, whether it repeats,
 * what a return visit does, what changing gallery image or variant does, and
 * what happens under `prefers-reduced-motion`.
 *
 * Attaches to an already-running dev server; never spawns one.
 *
 *   node scripts/verify-spray-draw-behaviour.mjs [--base-url=…]
 */

import { chromium } from "playwright-core";

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => arg.replace(/^--/, "").split("=")),
);
const baseUrl = args["base-url"] ?? "http://localhost:3100";

/** A spray product (the backdrop is gated to spray/colour types). */
const SPRAY_PDP =
  "/proizvodi/cosmos-lac-flame-booster-b-901-500-ml-flame-booster-b-901-thick-black";
/** Same family, different variant — reached through the variant selector. */
const SPRAY_VARIANT_SIBLING =
  "/proizvodi/cosmos-lac-flame-booster-b-902-500-ml-flame-booster-b-902-ultra-chrome";
/** An abrasive: not a colour-bearing type, so it must get no spray at all. */
const NON_SPRAY_PDP = "/proizvodi/carsystem-p19-brusni-diskovi";

const failures = [];
const notes = [];
const record = (ok, message) => {
  if (!ok) failures.push(message);
};

const readPhase = () =>
  document.querySelector("[data-product-hero-spray]")?.dataset.phase ?? null;

const countRunning = () =>
  document.getAnimations().filter((a) => a.playState === "running").length;

const browser = await chromium.launch({ channel: "chrome" });

/* 1. Start, and reaching a settled end state ------------------------- */
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  /*
   * Poll for transitions rather than sampling at guessed offsets. The backdrop
   * deliberately waits for the product image's `load` event before its 300 ms
   * lead-in, so on a cold dev route "when it starts" depends on the image, not
   * on a fixed delay — an earlier version of this script sampled six times in
   * 1.5 s, saw `idle` throughout, and wrongly reported that it never ran.
   */
  const started = Date.now();
  await page.goto(`${baseUrl}${SPRAY_PDP}`, { waitUntil: "networkidle", timeout: 120_000 });

  const transitions = [];
  let previous = null;
  for (let tick = 0; tick < 80; tick += 1) {
    const phase = await page.evaluate(readPhase);
    if (phase !== previous) {
      transitions.push({ phase, at: Date.now() - started });
      previous = phase;
    }
    if (phase === "complete") break;
    await page.waitForTimeout(100);
  }

  const phases = transitions.map((entry) => entry.phase);
  notes.push(
    `phase timeline: ${transitions.map((t) => `${t.phase}@${t.at}ms`).join(" → ")}`,
  );

  record(phases.includes("running"), `spray never entered the running phase (${phases.join(",")})`);
  record(
    phases[phases.length - 1] === "complete",
    `spray did not settle: ended in ${phases[phases.length - 1]}`,
  );

  const runDuration =
    transitions.find((t) => t.phase === "complete")?.at -
    transitions.find((t) => t.phase === "running")?.at;
  if (Number.isFinite(runDuration)) {
    notes.push(`running → complete took ${runDuration} ms`);
  }

  // Once complete it must stay complete — no loop, no re-entry.
  await page.waitForTimeout(2500);
  const settled = await page.evaluate(readPhase);
  const stillRunning = await page.evaluate(countRunning);
  record(settled === "complete", `spray left the complete phase (now ${settled})`);
  notes.push(`2.5 s after completing: phase=${settled}, ${stillRunning} animations running`);

  /* 2. Changing gallery image must NOT replay it -------------------- */
  const thumbs = page.locator('[aria-label^="Prikažite sliku"]');
  const thumbCount = await thumbs.count();
  if (thumbCount > 1) {
    await thumbs.nth(1).click();
    await page.waitForTimeout(600);
    const afterThumb = await page.evaluate(readPhase);
    record(afterThumb === "complete", `gallery change restarted the spray (${afterThumb})`);
    notes.push(`gallery switch (${thumbCount} images): phase stayed ${afterThumb}`);
  } else {
    notes.push("gallery switch: this product has a single image, not exercised here");
  }

  /* 3. Scrolling away and back must NOT replay it ------------------- */
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(700);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(700);
  const afterScroll = await page.evaluate(readPhase);
  record(afterScroll === "complete", `scrolling replayed the spray (${afterScroll})`);
  notes.push(`scroll away and back: phase stayed ${afterScroll}`);

  await context.close();
}

/* 4. A return visit — back/forward navigation ------------------------ */
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${baseUrl}${SPRAY_PDP}`, { waitUntil: "networkidle", timeout: 120_000 });
  await page.waitForTimeout(2600);
  await page.goto(`${baseUrl}${NON_SPRAY_PDP}`, { waitUntil: "networkidle", timeout: 120_000 });

  const onAbrasive = await page.evaluate(readPhase);
  record(onAbrasive === null, `a non-colour product rendered a spray backdrop (${onAbrasive})`);
  notes.push(`abrasive PDP: spray backdrop present = ${onAbrasive !== null}`);

  await page.goBack({ waitUntil: "networkidle" });
  await page.waitForTimeout(200);
  const immediatelyBack = await page.evaluate(readPhase);
  await page.waitForTimeout(2600);
  const settledBack = await page.evaluate(readPhase);
  notes.push(
    `return visit: phase ${immediatelyBack} immediately after back, ${settledBack} once settled`,
  );
  record(
    settledBack === "complete",
    `after a return visit the spray did not settle (${settledBack})`,
  );

  await context.close();
}

/* 5. Changing variant is a route change, so it does replay ----------- */
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const sibling = await fetch(`${baseUrl}${SPRAY_VARIANT_SIBLING}`).catch(() => null);

  if (sibling && sibling.ok) {
    await page.goto(`${baseUrl}${SPRAY_PDP}`, { waitUntil: "networkidle", timeout: 120_000 });
    await page.waitForTimeout(2600);
    await page.goto(`${baseUrl}${SPRAY_VARIANT_SIBLING}`, {
      waitUntil: "domcontentloaded",
      timeout: 120_000,
    });
    await page.waitForTimeout(250);
    const early = await page.evaluate(readPhase);
    await page.waitForTimeout(2600);
    const late = await page.evaluate(readPhase);
    notes.push(
      `variant change (a route change): phase ${early} shortly after navigation, ${late} once settled`,
    );
    record(late === "complete", `after a variant change the spray did not settle (${late})`);
  } else {
    notes.push("variant change: sibling variant route not reachable, not exercised");
  }

  await context.close();
}

/* 6. Reduced motion --------------------------------------------------- */
{
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.goto(`${baseUrl}${SPRAY_PDP}`, { waitUntil: "networkidle", timeout: 120_000 });
  await page.waitForTimeout(1400);

  const phase = await page.evaluate(readPhase);
  const running = await page.evaluate(countRunning);
  record(phase === "static", `reduced motion did not use the static phase (${phase})`);
  record(running === 0, `reduced motion left ${running} animations running`);
  notes.push(`reduced motion: phase=${phase}, ${running} animations running`);

  await context.close();
}

/* 7. Mobile cost ------------------------------------------------------ */
{
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const client = await context.newCDPSession(page);
  // A 4x slowdown is a fair stand-in for a mid-range Android.
  await client.send("Emulation.setCPUThrottlingRate", { rate: 4 });

  await page.goto(`${baseUrl}${SPRAY_PDP}`, { waitUntil: "networkidle", timeout: 120_000 });
  await page.waitForTimeout(3200);

  const layoutShift = await page.evaluate(
    () =>
      new Promise((resolve) => {
        let total = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) total += entry.value;
          }
        }).observe({ type: "layout-shift", buffered: true });
        setTimeout(() => resolve(Math.round(total * 10_000) / 10_000), 800);
      }),
  );
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  const svgNodes = await page.evaluate(
    () => document.querySelectorAll("[data-product-hero-spray] svg *").length,
  );

  record(layoutShift < 0.02, `mobile CLS from the spray pass: ${layoutShift}`);
  record(overflow <= 0, `mobile horizontal overflow: ${overflow}px`);
  notes.push(
    `mobile (390 px, 4x CPU throttle): CLS ${layoutShift}, overflow ${overflow}px, ${svgNodes} SVG nodes in the backdrop`,
  );

  await context.close();
}

await browser.close();

console.log("\nspray-draw, measured:");
for (const note of notes) console.log(`  · ${note}`);

if (failures.length > 0) {
  console.error(`\n${failures.length} FAILURES`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log("\nall spray-draw checks passed");
