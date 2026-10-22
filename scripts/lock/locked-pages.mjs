#!/usr/bin/env node
/**
 * Zaključane stranice (2026-10-22) — referentni snimci i provera uticaja.
 *
 *   node scripts/lock/locked-pages.mjs add <ruta> --naziv "…" --odobrio "…"   upis (samo na zahtev vlasnika)
 *   node scripts/lock/locked-pages.mjs snimi [ruta] --base http://localhost:3508    referentni snimci
 *   node scripts/lock/locked-pages.mjs uticaj [--od company/main]                   koje zaključane stranice menja diff
 *   node scripts/lock/locked-pages.mjs uporedi --base http://localhost:3508         novi snimci vs referentni (piksel)
 *
 * Snimci: desktop 1440 i telefon 390, svetla i tamna tema, cela strana. Čuvaju se van repozitorijuma
 * (javni repo, sajt u pripremi) u LOCK_SNAPSHOT_DIR; u data/locked-pages.json ide samo sha256.
 * Zavisnosti stranice se računaju iz grafa importa (app ruta → komponente, CSS, podaci), pa „uticaj“
 * pokazuje posledicu promene zajedničke komponente PRE objave.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const REGISTRY = path.join(ROOT, "data/locked-pages.json");
const SNAP_DIR = process.env.LOCK_SNAPSHOT_DIR ?? path.join(os.homedir(), "Carsystem/zakljucane-stranice");
const VIEWPORTS = [["desktop", 1440, 1000], ["telefon", 390, 844]];
const SCHEMES = ["light", "dark"];

const arg = (name, fallback = null) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const load = () => JSON.parse(fs.readFileSync(REGISTRY, "utf8"));
const save = (data) => fs.writeFileSync(REGISTRY, `${JSON.stringify(data, null, 2)}\n`);

/** app ruta („/proizvodi/rm-diamont-bazna-boja“) → fajl stranice u app/ (dinamički segmenti). */
function routeFile(route) {
  const parts = route.split("?")[0].split("/").filter(Boolean);
  let dir = path.join(ROOT, "app");
  for (const part of parts) {
    const exact = path.join(dir, part);
    if (fs.existsSync(exact)) { dir = exact; continue; }
    const dynamic = fs.readdirSync(dir).find((name) => /^\[.+\]$/.test(name));
    if (!dynamic) throw new Error(`ruta ${route}: nema segmenta za „${part}“`);
    dir = path.join(dir, dynamic);
  }
  for (const name of ["page.tsx", "page.ts"]) if (fs.existsSync(path.join(dir, name))) return path.join(dir, name);
  throw new Error(`ruta ${route}: nema page.tsx`);
}

/** Stranica + svi layout fajlovi na putanji rute (header, footer, okvir). */
function pageEntries(route) {
  const page = routeFile(route);
  const entries = [page];
  let dir = path.dirname(page);
  while (dir.startsWith(path.join(ROOT, "app"))) {
    for (const name of ["layout.tsx", "template.tsx"]) if (fs.existsSync(path.join(dir, name))) entries.push(path.join(dir, name));
    dir = path.dirname(dir);
  }
  return entries;
}

/** Zatvorenje importa (lokalni fajlovi, alias @/), uključujući CSS i JSON. */
function dependencies(entries) {
  const seen = new Set();
  const exts = ["", ".tsx", ".ts", ".mjs", ".js", "/index.tsx", "/index.ts"];
  const stack = [...entries];
  while (stack.length) {
    const file = stack.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    if (!/\.(tsx?|mjs|js|css)$/.test(file)) continue;
    const source = fs.readFileSync(file, "utf8");
    for (const m of source.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)) {
      const spec = m[1];
      if (!spec.startsWith(".") && !spec.startsWith("@/")) continue;
      const base = spec.startsWith("@/") ? path.join(ROOT, spec.slice(2)) : path.resolve(path.dirname(file), spec);
      const hit = exts.map((ext) => base + ext).find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
      if (hit) stack.push(hit);
    }
  }
  return [...seen].map((file) => path.relative(ROOT, file)).sort();
}

async function snapshot(route, base) {
  const { chromium } = await import(path.join(ROOT, "node_modules/playwright-core/index.mjs"));
  const browser = await chromium.launch();
  const date = new Date().toISOString().slice(0, 10);
  const slug = route.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "pocetna";
  const out = path.join(SNAP_DIR, slug, date);
  fs.mkdirSync(out, { recursive: true });
  const shots = [];
  for (const [kind, width, height] of VIEWPORTS) for (const scheme of SCHEMES) {
    const page = await browser.newPage({ viewport: { width, height }, colorScheme: scheme, isMobile: kind === "telefon", hasTouch: kind === "telefon", deviceScaleFactor: kind === "telefon" ? 2 : 1 });
    await page.goto(base + route, { waitUntil: "load" });
    await page.waitForTimeout(2500);
    const file = path.join(out, `${kind}-${scheme}.png`);
    await page.screenshot({ path: file, fullPage: true });
    shots.push({ kind, scheme, file, sha256: createHash("sha256").update(fs.readFileSync(file)).digest("hex") });
    await page.close();
  }
  await browser.close();
  return { date, shots };
}

const [command, routeArg] = process.argv.slice(2);
if (command === "add") {
  const data = load();
  if (data.pages.some((page) => page.route === routeArg)) throw new Error("već zaključano");
  data.pages.push({ route: routeArg, name: arg("--naziv", routeArg), lockedOn: new Date().toISOString().slice(0, 10), approvedBy: arg("--odobrio", "vlasnik"), dependencies: dependencies(pageEntries(routeArg)), references: [] });
  save(data);
  console.log(`upisano: ${routeArg} (${data.pages.at(-1).dependencies.length} zavisnih fajlova)`);
} else if (command === "snimi") {
  const data = load();
  const base = arg("--base", "http://localhost:3508");
  for (const page of data.pages.filter((entry) => !routeArg || routeArg.startsWith("--") || entry.route === routeArg)) {
    const result = await snapshot(page.route, base);
    page.references.push({ date: result.date, shots: result.shots.map(({ kind, scheme, file, sha256 }) => ({ kind, scheme, file: path.relative(SNAP_DIR, file), sha256 })) });
    console.log(`snimljeno: ${page.route} → ${path.join(SNAP_DIR)}`);
  }
  save(data);
} else if (command === "uticaj") {
  const from = arg("--od", "company/main");
  const changed = execFileSync("git", ["diff", "--name-only", `${from}...HEAD`], { cwd: ROOT, encoding: "utf8" }).split("\n").filter(Boolean);
  const data = load();
  let hits = 0;
  for (const page of data.pages) {
    const current = dependencies(pageEntries(page.route));
    const touched = changed.filter((file) => current.includes(file));
    if (touched.length) { hits += 1; console.log(`ZAKLJUČANA STRANICA POGOĐENA: ${page.name} (${page.route})\n  ${touched.join("\n  ")}`); }
  }
  console.log(hits ? `${hits} zaključanih stranica pogođeno — prikazati vlasniku pre objave.` : `Nijedna od ${data.pages.length} zaključanih stranica nije pogođena.`);
  process.exitCode = hits ? 2 : 0;
} else if (command === "uporedi") {
  const base = arg("--base", "http://localhost:3508");
  const data = load();
  for (const page of data.pages) {
    const reference = page.references.at(-1);
    if (!reference) { console.log(`${page.route}: nema referentnih snimaka`); continue; }
    const result = await snapshot(page.route, base);
    for (const shot of result.shots) {
      const ref = reference.shots.find((entry) => entry.kind === shot.kind && entry.scheme === shot.scheme);
      console.log(`${page.route} ${shot.kind}/${shot.scheme}: ${ref && ref.sha256 === shot.sha256 ? "isto" : "RAZLIKA — pogledati " + shot.file}`);
    }
  }
} else {
  console.log("komande: add <ruta>, snimi [ruta], uticaj [--od ref], uporedi");
}
