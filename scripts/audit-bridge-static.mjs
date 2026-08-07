#!/usr/bin/env node
/*
 * ZADATAK 4: statička pozicija linije mora biti tačna PRE animacije.
 * Skript gasi masku/opacity (reveal) i meri gde artwork stvarno stoji u
 * odnosu na donju granicu prethodne sekcije — na svim viewportima.
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

const CHROME = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean).find((p) => existsSync(p));

const portArg = process.argv.indexOf("--port");
const port = portArg > -1 ? process.argv[portArg + 1] : "3000";
const shots = process.argv.includes("--shots");

const VIEWPORTS = [
  { label: "1536x1024", width: 1536, height: 1024 },
  { label: "1440x900", width: 1440, height: 900 },
  { label: "1280x800", width: 1280, height: 800 },
  { label: "1024x768", width: 1024, height: 768 },
  { label: "390x844", width: 390, height: 844 },
];

const PROBE = `() => {
  const net = document.querySelector('#prodavnice-mreza');
  const bridge = document.querySelector('[data-paint-entry-bridge]');
  const canvas = bridge && bridge.firstElementChild;
  const svg = canvas && canvas.querySelector('svg');
  const map = document.querySelector('[data-map-wrapper]');
  const card = document.querySelector('[data-locator-card]');
  const takeover = document.querySelector('#paint-takeover');
  const abs = (el) => { const r = el.getBoundingClientRect(); return { top: r.top + scrollY, bottom: r.bottom + scrollY, h: r.height, w: r.width, left: r.left }; };

  const nb = abs(net), cb = abs(canvas), sb = abs(svg);
  const boundary = nb.bottom;
  const cs = getComputedStyle(canvas);

  // bbox artworka u px, preslikan iz viewBox koordinata
  const vb = svg.getAttribute('viewBox').split(/\\s+/).map(Number);
  const bb = svg.getBBox();
  const sx = sb.w / vb[2], sy = sb.h / vb[3];

  return {
    boundaryY: Math.round(boundary),
    wrapperHeight: bridge.offsetHeight,
    wrapperBottomVsBoundary: Math.round(abs(bridge).bottom - boundary),
    canvas: { top: Math.round(cb.top), bottom: Math.round(cb.bottom), w: Math.round(cb.w), h: Math.round(cb.h) },
    canvasTopRelBoundary: Math.round(cb.top - boundary),
    canvasBottomRelBoundary: Math.round(cb.bottom - boundary),
    scale: { x: +sx.toFixed(3), y: +sy.toFixed(3), anisotropy: +(sy / sx).toFixed(3) },
    artworkPx: {
      top: Math.round(sb.top + bb.y * sy),
      bottom: Math.round(sb.top + (bb.y + bb.height) * sy),
      thicknessOfCoreStroke: Math.round(66 * sy),
    },
    artworkTopRelBoundary: Math.round(sb.top + bb.y * sy - boundary),
    artworkBottomRelBoundary: Math.round(sb.top + (bb.y + bb.height) * sy - boundary),
    crossesMap: map ? (() => { const m = abs(map); const at = sb.top + bb.y * sy, ab2 = sb.top + (bb.y + bb.height) * sy; return at < m.bottom && ab2 > m.top; })() : null,
    crossesCard: card ? (() => { const m = abs(card); const at = sb.top + bb.y * sy, ab2 = sb.top + (bb.y + bb.height) * sy; return at < m.bottom && ab2 > m.top; })() : null,
    crossesBoundary: (sb.top + (bb.y + bb.height) * sy) > boundary,
    reachesIntoTakeover: Math.round((sb.top + (bb.y + bb.height) * sy) - abs(takeover).top),
    horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    maskImage: cs.maskImage === 'none' ? 'none' : 'set',
  };
}`;

const browser = await chromium.launch({ executablePath: CHROME });
for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${port}/`, { waitUntil: "networkidle", timeout: 60000 });
  // ZADATAK 4: ugasi reveal — statička pozicija se meri bez animacije.
  await page.addStyleTag({
    content: `[data-paint-entry-bridge] > * { mask-image: none !important; opacity: 1 !important; }`,
  });
  await page.waitForTimeout(400);
  const r = await page.evaluate(`(${PROBE})()`);
  console.log(`\n=== ${vp.label} ===`);
  console.log(JSON.stringify(r, null, 1));
  if (shots) {
    const y = await page.evaluate(() => {
      const n = document.querySelector('#prodavnice-mreza').getBoundingClientRect();
      return Math.round(n.top + scrollY + n.height - innerHeight * 0.72);
    });
    await page.evaluate((t) => scrollTo({ top: t, behavior: 'instant' }), y);
    await page.waitForTimeout(250);
    await page.screenshot({ path: `review-screenshots/paint-takeover/static-${vp.label}.png` });
  }
  await ctx.close();
}
await browser.close();
