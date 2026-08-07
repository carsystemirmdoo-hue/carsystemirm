#!/usr/bin/env node
/*
 * ZADATAK 7: frame timing kroz prelaz, plus brojanje React rerendera i
 * aktivnih rAF callbackova. Meri, ne procenjuje.
 *
 *   node scripts/audit-takeover-perf.mjs --port 3000 [--no-filters]
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

const CHROME = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean).find((p) => existsSync(p));

const portArg = process.argv.indexOf("--port");
const port = portArg > -1 ? process.argv[portArg + 1] : "3000";
const noFilters = process.argv.includes("--no-filters");

const browser = await chromium.launch({
  executablePath: CHROME,
  args: ["--enable-gpu-rasterization"],
});
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});
const page = await ctx.newPage();

// Instrumentacija mora da postoji pre nego što stranica izvrši svoj JS.
await page.addInitScript(() => {
  window.__rafCount = 0;
  const realRaf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => {
    window.__rafCount += 1;
    return realRaf(cb);
  };
  window.__scrollListeners = 0;
  const realAdd = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (type, ...rest) {
    if (type === "scroll") window.__scrollListeners += 1;
    return realAdd.call(this, type, ...rest);
  };
  window.__frames = [];
});

await page.goto(`http://localhost:${port}/`, { waitUntil: "networkidle", timeout: 60000 });

if (noFilters) {
  await page.addStyleTag({
    content: `[data-paint-entry-bridge] * { filter: none !important; }`,
  });
}

await page.waitForTimeout(1200);

const geo = await page.evaluate(() => {
  const s = document.querySelector("#paint-takeover");
  return { top: s.offsetTop, range: s.offsetHeight - innerHeight, vh: innerHeight };
});

// Snimi trajanje frejmova dok skrolujemo kroz ceo prelaz realnim tempom.
const result = await page.evaluate(async ({ top, range, vh }) => {
  const frames = [];
  let last = performance.now();
  let running = true;
  const tick = (now) => {
    frames.push(now - last);
    last = now;
    if (running) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  const startY = top - vh;
  const endY = top + range;
  const steps = 140;
  const rafBefore = window.__rafCount;
  for (let i = 0; i <= steps; i += 1) {
    window.scrollTo({ top: startY + ((endY - startY) * i) / steps, behavior: "instant" });
    await new Promise((r) => requestAnimationFrame(r));
  }
  // i nazad
  for (let i = steps; i >= 0; i -= 1) {
    window.scrollTo({ top: startY + ((endY - startY) * i) / steps, behavior: "instant" });
    await new Promise((r) => requestAnimationFrame(r));
  }
  running = false;
  const rafAfter = window.__rafCount;

  const body = frames.slice(5);
  const sorted = [...body].sort((a, b) => a - b);
  const pct = (p) => sorted[Math.floor(sorted.length * p)];
  return {
    frameCount: body.length,
    meanMs: +(body.reduce((a, b) => a + b, 0) / body.length).toFixed(2),
    medianMs: +pct(0.5).toFixed(2),
    p95Ms: +pct(0.95).toFixed(2),
    maxMs: +Math.max(...body).toFixed(2),
    over20ms: body.filter((f) => f > 20).length,
    over33ms: body.filter((f) => f > 33).length,
    rafCallbacksDuringScroll: rafAfter - rafBefore,
    scrollListeners: window.__scrollListeners,
  };
}, geo);

// Površina koju filteri rasterizuju
const area = await page.evaluate(() => {
  const c = document.querySelector("[data-paint-entry-bridge] > *");
  if (!c) return null;
  const r = c.getBoundingClientRect();
  return { w: Math.round(r.width), h: Math.round(r.height), px: Math.round(r.width * r.height) };
});

console.log(JSON.stringify({ mode: noFilters ? "BEZ FILTERA" : "PUN", ...result, canvasArea: area }, null, 1));

await browser.close();
