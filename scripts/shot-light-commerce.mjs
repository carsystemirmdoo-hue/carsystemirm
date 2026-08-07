#!/usr/bin/env node
/*
 * Snimci Light Commerce poglavlja (sekcije ispod paint takeovera) za poredjenje
 * sa dizajnom "Homepage Light Commerce — High Fidelity Redesign".
 *
 *   node scripts/shot-light-commerce.mjs --port 3000
 */
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";

const CHROME = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean).find((p) => existsSync(p));

const portArg = process.argv.indexOf("--port");
const port = portArg > -1 ? process.argv[portArg + 1] : "3000";
const out = "review-screenshots/light-commerce";
await mkdir(out, { recursive: true });

const VIEWPORTS = [
  { label: "1440", width: 1440, height: 900 },
  { label: "390", width: 390, height: 844 },
];

const browser = await chromium.launch({ executablePath: CHROME });

for (const vp of VIEWPORTS) {
  for (const theme of ["light", "dark"]) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

    await page.goto(`http://localhost:${port}/`, { waitUntil: "networkidle", timeout: 60000 });
    await page.evaluate((t) => {
      document.documentElement.classList.toggle("dark", t === "dark");
    }, theme);
    await page.waitForTimeout(600);

    // Ceo pojas: od kraja takeovera do kraja kontakt sekcije.
    const box = await page.evaluate(() => {
      const t = document.querySelector("#paint-takeover");
      const secs = [...document.querySelectorAll("main > section")];
      const idx = secs.findIndex((s) => s.id === "zavrsni-poziv");
      const last = secs[idx - 1];
      const top = t.offsetTop + t.offsetHeight;
      return { top, height: last.offsetTop + last.offsetHeight - top };
    });

    await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), box.top - 120);
    await page.waitForTimeout(400);

    await page.screenshot({
      path: `${out}/${vp.label}-${theme}-chapter.png`,
      clip: { x: 0, y: 0, width: vp.width, height: Math.min(vp.height, 900) },
    });

    // Puni pojas kao jedna slika (do 4000px)
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.waitForTimeout(200);
    await page.screenshot({
      path: `${out}/${vp.label}-${theme}-full.png`,
      fullPage: true,
      clip: { x: 0, y: box.top - 160, width: vp.width, height: Math.min(box.height + 200, 4200) },
    });

    console.log(`${vp.label}-${theme}: chapter height ${Math.round(box.height)}px | errors ${errors.length}`);
    if (errors.length) console.log("  ", errors.slice(0, 3));
    await ctx.close();
  }
}
await browser.close();
