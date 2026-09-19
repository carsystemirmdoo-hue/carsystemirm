#!/usr/bin/env node
/**
 * Čuvar veličine serverless funkcija — čita `*.nft.json` tragove POSTOJEĆEG builda.
 *
 * Vercel odbija deployment kada raspakovana funkcija pređe 250 MB. To se lokalno ne vidi:
 * `next build` prolazi, a pada tek korak „Deploying outputs”. Ovaj skript sabira fajlove
 * koje svaka ruta vuče u svoju funkciju i pada kada neka ruta MASOVNO vuče `public/`
 * (dinamička putanja → ceo direktorijum; statički fajlovi pripadaju CDN-u, ne funkciji) ili
 * pređe budžet. Ruta koja namerno čita nekoliko konkretnih fajlova ostaje dozvoljena.
 *
 *   NEXT_DIST_DIR=.next-verify node scripts/validate-function-trace.mjs
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const distDir = process.env.NEXT_DIST_DIR || ".next";
const appDir = path.join(distDir, "server", "app");
/** Vercel limit je 250 MB; budžet je namerno niži da rast ne iznenadi deployment. */
const BUDGET_BYTES = 150 * 1024 * 1024;
/** Iznad ovoga to više nije „nekoliko konkretnih fajlova” nego povučen direktorijum. */
const PUBLIC_BUDGET_BYTES = 5 * 1024 * 1024;

if (!existsSync(appDir)) {
  console.error(`Nema builda u ${distDir}. Pokreni \`npm run build:check\` pa ponovi.`);
  process.exit(1);
}

const walk = (dir) => readdirSync(dir).flatMap((name) => {
  const full = path.join(dir, name);
  return statSync(full).isDirectory() ? walk(full) : [full];
});

const routes = walk(appDir)
  .filter((file) => file.endsWith(".nft.json"))
  .map((file) => {
    const root = path.dirname(file);
    let bytes = 0;
    let publicBytes = 0;
    let publicFiles = 0;
    for (const relative of JSON.parse(readFileSync(file, "utf8")).files) {
      const resolved = path.normalize(path.join(root, relative));
      if (!existsSync(resolved)) continue;
      const size = statSync(resolved).size;
      bytes += size;
      if (resolved.split(path.sep)[0] === "public") {
        publicBytes += size;
        publicFiles += 1;
      }
    }
    return { route: path.relative(appDir, file).replace(/\.nft\.json$/, ""), bytes, publicBytes, publicFiles };
  })
  .sort((a, b) => b.bytes - a.bytes);

const mb = (bytes) => Number((bytes / 1024 / 1024).toFixed(1));
const failures = routes.filter((route) => route.publicBytes > PUBLIC_BUDGET_BYTES || route.bytes > BUDGET_BYTES);
console.log(JSON.stringify({
  distDir,
  routes: routes.length,
  budgetMB: mb(BUDGET_BYTES),
  publicBudgetMB: mb(PUBLIC_BUDGET_BYTES),
  largest: routes.slice(0, 5).map((route) => ({ route: route.route, MB: mb(route.bytes), publicMB: mb(route.publicBytes), publicFiles: route.publicFiles })),
  failures: failures.map((route) => ({ route: route.route, MB: mb(route.bytes), publicMB: mb(route.publicBytes), publicFiles: route.publicFiles })),
}, null, 2));
if (failures.length) process.exit(1);
