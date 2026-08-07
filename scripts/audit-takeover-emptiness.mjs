#!/usr/bin/env node
/*
 * Provera zahteva: NE SME postojati faza u kojoj se skroluje kroz potpuno
 * praznu belu ploču takeovera.
 *
 * Za svaki korak skrola meri koliko je VIDLJIVOG dela takeover ploče već
 * "obojeno" (tamna površina ili painterly sloj), pa prijavljuje najduži niz
 * uzastopnih koraka u kojima je ploča vidljiva a potpuno prazna.
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

const CHROME = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean).find((p) => existsSync(p));

const portArg = process.argv.indexOf("--port");
const port = portArg > -1 ? process.argv[portArg + 1] : "3000";

const VIEWPORTS = [
  { label: "1536x1024", width: 1536, height: 1024 },
  { label: "1440x900", width: 1440, height: 900 },
  { label: "1280x800", width: 1280, height: 800 },
  { label: "1024x768", width: 1024, height: 768 },
  { label: "390x844", width: 390, height: 844 },
];

const browser = await chromium.launch({ executablePath: CHROME });

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${port}/`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(700);

  const geo = await page.evaluate(() => {
    const s = document.querySelector("#paint-takeover");
    return { top: s.offsetTop, h: s.offsetHeight, vh: innerHeight };
  });

  const rows = [];
  const STEPS = 46;
  // Od trenutka kad gornja ivica scene uđe u dno kadra, do pinovanja.
  const startY = geo.top - geo.vh;
  const endY = geo.top + (geo.h - geo.vh);
  for (let i = 0; i <= STEPS; i += 1) {
    const y = startY + ((endY - startY) * i) / STEPS;
    await page.evaluate((t) => window.scrollTo({ top: t, behavior: "instant" }), y);
    await page.waitForTimeout(70);

    const m = await page.evaluate(() => {
      const s = document.querySelector("#paint-takeover");
      const r = s.getBoundingClientRect();
      // Vidljivi deo ploče u kadru
      const visTop = Math.max(0, r.top);
      const visBottom = Math.min(innerHeight, r.bottom);
      return {
        visibleH: Math.max(0, visBottom - visTop),
        visTop,
        visBottom,
        surfaceOffset: getComputedStyle(s).getPropertyValue("--surface-offset").trim(),
        bg: parseFloat(getComputedStyle(s).getPropertyValue("--background-opacity")) || 0,
      };
    });

    if (m.visibleH < 8) { rows.push({ y: Math.round(y), skip: true }); continue; }

    // Uzorkuj piksele samo unutar vidljivog dela ploče.
    const shot = await page.screenshot({
      clip: { x: 0, y: m.visTop, width: vp.width, height: m.visibleH },
    });
    const stats = await page.evaluate(async (b64) => {
      const img = new Image();
      img.src = "data:image/png;base64," + b64;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = Math.min(200, img.width);
      c.height = Math.min(200, img.height);
      const g = c.getContext("2d");
      g.drawImage(img, 0, 0, c.width, c.height);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let dark = 0, total = 0;
      for (let p = 0; p < d.length; p += 4) {
        const lum = 0.2126 * d[p] + 0.7152 * d[p + 1] + 0.0722 * d[p + 2];
        total += 1;
        if (lum < 170) dark += 1; // sve što nije svetla ploča
      }
      return { paintedPct: +((dark / total) * 100).toFixed(1) };
    }, shot.toString("base64"));

    rows.push({
      y: Math.round(y),
      visibleH: Math.round(m.visibleH),
      paintedPct: stats.paintedPct,
      offset: m.surfaceOffset,
    });
  }

  // Najduži niz uzastopnih koraka gde je ploča jasno vidljiva a praktično prazna
  let run = 0, worst = 0, worstAt = null;
  for (const r of rows) {
    if (r.skip) continue;
    const empty = r.visibleH > vp.height * 0.25 && r.paintedPct < 2;
    if (empty) { run += 1; if (run > worst) { worst = run; worstAt = r.y; } }
    else run = 0;
  }
  const stepPx = (endY - startY) / STEPS;
  console.log(`\n=== ${vp.label} ===`);
  console.log(`ukupan prelaz: ${Math.round(endY - startY)}px | korak ${Math.round(stepPx)}px`);
  console.log(`najduza prazna faza: ${worst} koraka = ${Math.round(worst * stepPx)}px${worstAt ? ` (oko y=${worstAt})` : ""}`);
  console.log("profil (visibleH/painted%):", rows.filter((r) => !r.skip).map((r) => `${r.visibleH}:${r.paintedPct}`).slice(0, 24).join("  "));

  await ctx.close();
}
await browser.close();
