/**
 * Rasterska verzija poteza „Boja nije sloj“ za telefone i tablete (2026-11-15).
 *
 * Zašto: SVG poteza ima feTurbulence/feDisplacementMap/feGaussianBlur filtere i stoji
 * unutar maske koja se menja na svaki pomeraj skrola. iOS Safari tada svaki kadar
 * ponovo crta filtere u punoj rezoluciji ekrana (DPR 3) i ubija stranicu zbog
 * memorije („A problem repeatedly occurred“). Maska nad gotovom slikom je jeftina.
 *
 *   node scripts/build-paint-takeover-raster.mjs
 *
 * Ulaz: public/art/paint-takeover/paint-takeover-hero-strokes-{final,light}.svg
 * Izlaz: isti folder, *-raster.webp (3200×1800, providna pozadina, isti viewBox).
 */
import { readFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";

const DIR = "public/art/paint-takeover";
const W = 3200;
const H = 1800;
const VARIANTS = [
  ["paint-takeover-hero-strokes-final.svg", "paint-takeover-hero-strokes-final-raster.webp"],
  ["paint-takeover-hero-strokes-light.svg", "paint-takeover-hero-strokes-light-raster.webp"],
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
for (const [src, out] of VARIANTS) {
  const svg = readFileSync(join(DIR, src), "utf8");
  const uri = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  await page.setContent(
    `<html><body style="margin:0;background:transparent"><img id="a" src="${uri}" width="${W}" height="${H}" style="display:block"></body></html>`,
  );
  await page.waitForFunction(() => document.getElementById("a").complete);
  const png = join(tmpdir(), `paint-raster-${process.pid}.png`);
  await page.screenshot({ path: png, omitBackground: true, clip: { x: 0, y: 0, width: W, height: H } });
  execFileSync("cwebp", ["-quiet", "-q", "82", "-alpha_q", "90", "-m", "6", png, "-o", join(DIR, out)]);
  rmSync(png);
  console.log(out);
}
await browser.close();
