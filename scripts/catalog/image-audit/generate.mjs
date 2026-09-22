#!/usr/bin/env node
/**
 * Canonical manifesti dostave slika — JEDNA deterministička komanda.
 *
 *   npm run catalog:image-supply:generate
 *
 * Iz STVARNOG runtime kataloga (`loadCatalogRuntime()`) i praćenih dokaza ponovo gradi:
 *
 *   data/catalog/image-supply/MISSING_PRODUCT_IMAGES.csv
 *   data/catalog/image-supply/USER_IMAGE_SUPPLY_QUEUE.csv
 *   data/catalog/image-supply/IMAGE_RIGHTS_REVIEW.csv
 *   data/catalog/image-supply/OWNER_SUPPLY_BATCH_01_CANDIDATES.csv
 *   data/catalog/image-supply/manifest-lock.json
 *   data/catalog/image-quality/IMAGE_QUALITY_QUEUE.csv
 *   docs/catalog/FINAL_IMAGE_AUDIT.md
 *   docs/catalog/USER_IMAGE_SUPPLY_GUIDE.md
 *   docs/catalog/image-quality/CARSYSTEM_IMAGE_AUDIT_FULL_CONTEXT.md
 *
 * Zašto postoji: manifesti su praćeni, pa je i put do njih morao da bude praćen. Ranije je ceo
 * lanac živeo u gitignored `.cache/`, što znači da se odobreno stanje nije moglo reprodukovati na
 * drugoj mašini niti proveriti u pregledu izmena.
 *
 * Determinizam: nijedan korak ne čita mrežu, ne gleda sat i ne zavisi od redosleda fajlova na
 * disku. Drugo pokretanje nad istim ulazima daje bajt-identične izlaze — to čuva
 * `catalog:image-supply:check` i gate u `docs/catalog/FINAL_IMAGE_AUDIT.md`.
 *
 * Ulazi (praćeni):
 *   - runtime katalog (`lib/*`, `data/*-catalog-products.generated.json`, sync manifesti porekla)
 *   - `data/catalog/image-supply/shared-image-groups.json`
 *   - `data/catalog/removed-from-customer-catalog.json` (kroz runtime)
 *   - `data/catalog/image-quality/evidence/*` — merenja istorijskog Carsystem quality audita
 *
 * Međuizlazi (pun inventar od ~1800 identiteta i sažeci) idu u `.cache/image-audit/`: runtime ih
 * ne čita, a u repou bi bili šum. Njihov otisak ulazi u `manifest-lock.json`.
 *
 * Zahteva `python3` (bez dodatnih paketa) — isti alat koji već koristi
 * `scripts/extract-product-image-metrics.py`. `measure-edge-frames.py` je jedini korak koji traži
 * Pillow i NE pokreće se ovde: njegov rezultat je praćen kao dokaz.
 */

import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..", "..");
const WORK = process.env.IMAGE_AUDIT_WORK ?? path.join(REPO, ".cache/image-audit");
mkdirSync(WORK, { recursive: true });

const STEPS = [
  ["node", "inventory.mjs", "identiteti slika iz runtime-a → inventar, missing, supply, rights"],
  ["python3", "reconcile-quality.py", "quality queue usklađen sa istorijskim dokazima"],
  ["python3", "sync-quality-notes.py", "opisne `quality:` beleške u inventaru i rights listi"],
  ["python3", "build-supply-pack.py", "owner supply pack + vodič"],
  ["python3", "build-owner-batch.py", "Owner Batch 01 kandidati"],
  ["python3", "promote.py", "upis u praćene canonical fajlove"],
];

const env = { ...process.env, IMAGE_AUDIT_WORK: WORK };
for (const [runtime, script, label] of STEPS) {
  process.stdout.write(`• ${script.padEnd(24)} ${label}\n`);
  try {
    execFileSync(runtime, [path.join(HERE, script)], { cwd: REPO, env, stdio: ["ignore", "pipe", "inherit"] });
  } catch (error) {
    if (error.code === "ENOENT" && runtime === "python3") {
      console.error("\nNedostaje `python3`. Koraci kvaliteta i paketa za vlasnika su napisani u Pythonu (bez dodatnih paketa).");
    }
    process.exit(error.status ?? 1);
  }
}

// Lock se piše poslednji: pokriva SHA canonical manifesta i otisak identiteta kataloga.
process.stdout.write(`• manifest-lock.json       SHA manifesta + otisak identiteta kataloga\n`);
execFileSync("node", [path.join(REPO, "scripts/catalog/image-supply-manifests.mjs"), "--write-lock", "--inventory", path.join(WORK, "IMAGE_IDENTITY_INVENTORY.csv")], { cwd: REPO, env, stdio: ["ignore", "inherit", "inherit"] });
process.stdout.write(`\nRadni međuizlazi: ${path.relative(REPO, WORK)}\nProvera: npm run catalog:image-supply:check\n`);
