#!/usr/bin/env node
/**
 * Proverava korisnički tekst u runtime izvorima (app, components, features,
 * lib). Pravila i izuzeci: lib/content-qa/contentCopyGuard.mjs.
 *
 *   npm run content:check
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { formatFinding, scanRepository } from "../lib/content-qa/contentCopyGuard.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { scanned, findings } = scanRepository(root);

if (findings.length) {
  console.error(`Content copy guard: ${findings.length} nalaz(a) u ${scanned} fajlova.\n`);
  for (const finding of findings) console.error(`  ${formatFinding(finding)}`);
  console.error(
    "\nIspravite tekst ili, ako je slučaj stvarno legitiman, dodajte izuzetak sa razlogom u RULE_EXCEPTIONS.",
  );
  process.exit(1);
}
console.log(`Content copy guard: ${scanned} fajlova, 0 nalaza.`);
