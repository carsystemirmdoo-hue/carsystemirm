#!/usr/bin/env node
/**
 * Proverava prerenderovan HTML posle builda: povučeni ili šablonski kontakti
 * i `tel:` van međunarodnog oblika ne smeju da stignu do strane.
 *
 *   npm run build && npm run content:check:html
 *   NEXT_DIST_DIR=.next-verify npm run content:check:html
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scanRenderedHtml } from "../lib/content-qa/contentCopyGuard.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appDir = path.join(root, process.env.NEXT_DIST_DIR || ".next", "server/app");
if (!fs.existsSync(appDir)) {
  console.error(`Nema prerenderovanog HTML-a u ${appDir}. Prvo pokrenite build.`);
  process.exit(1);
}
const { pages, findings } = scanRenderedHtml(appDir);
if (findings.length) {
  console.error(`Rendered contact check: ${findings.length} nalaz(a) na ${pages} strana.\n`);
  for (const finding of findings.slice(0, 50)) console.error(`  ${finding.page}  [${finding.rule}]  ${finding.value}`);
  process.exit(1);
}
console.log(`Rendered contact check: ${pages} strana, 0 nalaza.`);
