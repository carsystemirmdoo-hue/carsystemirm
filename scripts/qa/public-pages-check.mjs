/**
 * Glavne javne stranice: računar i telefon, svetla i tamna tema (provera pre objave).
 *   node scripts/qa/public-pages-check.mjs <izlazni-folder> [http://127.0.0.1:3481]
 * Proverava HTTP status, horizontalno pomeranje strane, primenjenu temu i greške u konzoli;
 * pravi snimke za vizuelni pregled. Ništa ne menja.
 */
import { mkdirSync } from "node:fs";
const ROOT = new URL("../../", import.meta.url).pathname;
const { chromium } = await import(ROOT + "/node_modules/playwright-core/index.mjs");
const OUT = process.argv[2];
const B = process.argv[3] ?? "http://127.0.0.1:3481";
mkdirSync(OUT, { recursive: true });
const PAGES = ["/", "/brendovi", "/brendovi/carsystem", "/katalog", "/proizvodi/c-2e50-clear-coat", "/prodavnice", "/kontakt", "/katalozi"];
const VIEWS = { racunar: { viewport: { width: 1440, height: 900 } }, telefon: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } };
let ok = 0;
let total = 0;
const b = await chromium.launch();
for (const [view, opts] of Object.entries(VIEWS)) {
  for (const theme of ["light", "dark"]) {
    const ctx = await b.newContext({ ...opts, reducedMotion: "reduce", colorScheme: theme });
    await ctx.addInitScript((t) => { try { localStorage.setItem("theme", t); } catch {} }, theme);
    for (const path of PAGES) {
      const p = await ctx.newPage();
      const errors = [];
      p.on("pageerror", (e) => errors.push(String(e.message).slice(0, 120)));
      p.on("console", (m) => { if (m.type() === "error" && !/favicon|Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 120)); });
      const res = await p.goto(B + path, { waitUntil: "load", timeout: 120000 });
      await p.waitForTimeout(800);
      const m = await p.evaluate(() => ({ over: document.documentElement.scrollWidth - window.innerWidth, dark: document.documentElement.classList.contains("dark") }));
      const good = res?.status() === 200 && m.over <= 1 && m.dark === (theme === "dark") && errors.length === 0;
      total++;
      if (good) ok++;
      console.log(`${good ? "PROLAZ" : "PAD   "} ${view}/${theme} ${path} :: ${res?.status()} višak=${m.over}px tema=${m.dark ? "dark" : "light"}${errors.length ? " greške=" + errors.join(" | ") : ""}`);
      await p.screenshot({ path: `${OUT}/${view}-${theme}${path.replace(/\//g, "_") || "_"}.png`, fullPage: false });
      await p.close();
    }
    await ctx.close();
  }
}
await b.close();
console.log(`UKUPNO: ${ok}/${total}`);
