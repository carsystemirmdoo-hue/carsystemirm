#!/usr/bin/env node
/**
 * Odobreni manifesti dostave slika — provera i zaključavanje.
 *
 *   data/catalog/image-supply/MISSING_PRODUCT_IMAGES.csv
 *   data/catalog/image-supply/USER_IMAGE_SUPPLY_QUEUE.csv
 *   data/catalog/image-supply/IMAGE_RIGHTS_REVIEW.csv
 *   data/catalog/image-supply/OWNER_SUPPLY_BATCH_01_CANDIDATES.csv   (radni fajl vlasnika — NIJE u lock-u)
 *   data/catalog/image-supply/manifest-lock.json
 *
 * Ovo su workflow manifesti, ne izlaz generatora: menjaju se samo odobrenom izmenom, a lock čuva njihov
 * SHA-256 i otisak identiteta kataloga iz kog su nastali. Runtime sajta ih NE čita.
 *
 * Bez argumenata (ili `--check`): ništa se ne piše; izlaz 1 ako se bilo šta ne slaže sa lock-om ili runtime-om.
 * `--write-lock [--inventory <IMAGE_IDENTITY_INVENTORY.csv>]`: piše lock. Vreme (`approvedAt`) je samo metapodatak:
 * postojeća vrednost se čuva, pa ponovljeno pisanje nad istim stanjem daje bajt-identičan lock.
 *
 * Ništa se ne uvozi, ne preuzima i ne menja u katalogu. Importer slika još ne postoji.
 */

import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadCatalogRuntime } from "../lib/catalog-runtime.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const DIR = "data/catalog/image-supply";
const LOCK = `${DIR}/manifest-lock.json`;
const MANIFESTS = { missing: "MISSING_PRODUCT_IMAGES.csv", userSupply: "USER_IMAGE_SUPPLY_QUEUE.csv", rightsReview: "IMAGE_RIGHTS_REVIEW.csv" };
const BATCH = "OWNER_SUPPLY_BATCH_01_CANDIDATES.csv";
const OWNER_ANSWERS = new Set(["", "YES", "NO", "NEED_TO_CHECK"]);
const SOURCE_UPLOAD = {
  targetExtension: ".webp",
  allowedSourceExtensions: [".png", ".jpg", ".jpeg", ".webp"],
  matching: "basename(source) === basename(suggested_filename), znak-po-znak; ekstenzija izvora je bilo koja dozvoljena (bez razlike velika/mala slova); tačno jedan izvorni fajl po basename-u; nepoznat basename se ne uvozi",
};

const args = process.argv.slice(2);
const writeLock = args.includes("--write-lock");
const inventoryPath = args.includes("--inventory") ? args[args.indexOf("--inventory") + 1] : null;

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const abs = (file) => path.join(REPO_ROOT, file);

/** RFC 4180: navodnici, udvojeni navodnik, zarez i novi red unutar polja. */
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (char !== "\r") field += char;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  const [header, ...body] = rows;
  return body.map((cells) => Object.fromEntries(header.map((name, column) => [name, cells[column] ?? ""])));
}

const readManifest = (name) => {
  const raw = readFileSync(abs(`${DIR}/${name}`));
  return { sha256: sha256(raw), rows: parseCsv(raw.toString("utf8")) };
};
const countBy = (rows, key) => Object.fromEntries(Object.entries(rows.reduce((out, row) => ({ ...out, [row[key]]: (out[row[key]] ?? 0) + 1 }), {})).sort(([a], [b]) => a.localeCompare(b)));
const duplicates = (rows, key) => Object.entries(countBy(rows.filter((row) => row[key]), key)).filter(([, total]) => total > 1).map(([value]) => value);

/** Otisak identiteta kataloga: brend + kartica + zapisi koji joj pripadaju. Ne zavisi od redosleda ni od vremena. */
function catalogIdentity() {
  const runtime = loadCatalogRuntime();
  const data = runtime.requireModule("lib/carsystem-data.ts");
  const families = new Map(runtime.families.map((family) => [`family:${family.slug}`, family]));
  const lines = runtime.listing.canonical
    .map((card) => `${card.brandSlug}\t${card.id}\t${(families.get(card.id)?.variants.map((record) => record.slug) ?? [card.id]).sort().join(",")}`)
    .sort();
  return {
    catalogIdentityFingerprint: sha256(lines.join("\n")),
    activeBrands: data.brands.map((brand) => brand.slug).sort(),
    totalCards: lines.length,
    cardsByBrand: countBy(runtime.listing.canonical, "brandSlug"),
  };
}

const errors = [];
const manifests = Object.fromEntries(Object.entries(MANIFESTS).map(([key, name]) => [key, readManifest(name)]));
const { missing, userSupply, rightsReview } = manifests;

// ── Strukturne provere manifesta ──
for (const [key, manifest] of Object.entries(manifests)) {
  for (const column of ["image_id", ...(key === "rightsReview" ? [] : ["suggested_filename", "target_path"])]) {
    const found = duplicates(manifest.rows, column);
    if (found.length) errors.push(`${MANIFESTS[key]}: dupli ${column}: ${found.slice(0, 5).join(", ")}`);
  }
  if (manifest.rows.some((row) => row.image_id.includes("varijanta="))) errors.push(`${MANIFESTS[key]}: image_id izveden iz ?varijanta= ključa`);
}
const missingById = new Map(missing.rows.map((row) => [row.image_id, row]));
const rightsIds = new Set(rightsReview.rows.map((row) => row.image_id));
const expectedSupplyIds = missing.rows.filter((row) => row.action_required === "USER_SUPPLY").map((row) => row.image_id).sort();
if (JSON.stringify(expectedSupplyIds) !== JSON.stringify(userSupply.rows.map((row) => row.image_id).sort())) errors.push("USER_IMAGE_SUPPLY_QUEUE nije tačno skup MISSING redova sa action_required = USER_SUPPLY");
for (const row of userSupply.rows) {
  const source = missingById.get(row.image_id);
  if (rightsIds.has(row.image_id)) errors.push(`USER_SUPPLY identitet je i pod rights review: ${row.image_id}`);
  if (source && (source.suggested_filename !== row.suggested_filename || source.target_path !== row.target_path)) errors.push(`naziv/putanja se razlikuju između MISSING i USER_SUPPLY: ${row.image_id}`);
  if (path.extname(row.suggested_filename) !== SOURCE_UPLOAD.targetExtension || path.basename(row.target_path) !== row.suggested_filename) errors.push(`target nije ${SOURCE_UPLOAD.targetExtension} ili se ne slaže sa suggested_filename: ${row.image_id}`);
}

// ── Owner Batch 01: podskup master queue-a; vlasnik sme da menja samo `owner_has_product` ──
const batch = existsSync(abs(`${DIR}/${BATCH}`)) ? readManifest(BATCH) : null;
if (!batch) errors.push(`nedostaje ${BATCH}`);
else {
  const supplyById = new Map(userSupply.rows.map((row) => [row.image_id, row]));
  if (duplicates(batch.rows, "image_id").length) errors.push(`${BATCH}: dupli image_id`);
  for (const row of batch.rows) {
    const master = supplyById.get(row.image_id);
    if (!master) { errors.push(`${BATCH}: ${row.image_id} nije u master USER_SUPPLY`); continue; }
    if (rightsIds.has(row.image_id)) errors.push(`${BATCH}: ${row.image_id} je pod rights review`);
    if (missingById.get(row.image_id)?.action_required !== "USER_SUPPLY") errors.push(`${BATCH}: ${row.image_id} nije USER_SUPPLY u MISSING manifestu`);
    for (const column of Object.keys(master)) if (master[column] !== row[column]) errors.push(`${BATCH}: ${row.image_id} — kolona ${column} odstupa od master queue-a`);
    if (!row.pilot_reason) errors.push(`${BATCH}: ${row.image_id} nema pilot_reason`);
    if (!OWNER_ANSWERS.has(row.owner_has_product)) errors.push(`${BATCH}: ${row.image_id} — owner_has_product mora biti prazno, YES, NO ili NEED_TO_CHECK`);
  }
}

const identity = catalogIdentity();
const measured = {
  ...identity,
  missingCount: missing.rows.length,
  userSupplyCount: userSupply.rows.length,
  rightsReviewCount: rightsReview.rows.length,
  userSupplyByBrand: countBy(userSupply.rows, "brand"),
  missingByAction: countBy(missing.rows, "action_required"),
  manifests: Object.fromEntries(Object.entries(MANIFESTS).map(([key, name]) => [name, { sha256: manifests[key].sha256, rows: manifests[key].rows.length }])),
};

const previous = existsSync(abs(LOCK)) ? JSON.parse(readFileSync(abs(LOCK), "utf8")) : null;

if (writeLock) {
  if (errors.length) { console.error(JSON.stringify({ errors }, null, 1)); process.exit(1); }
  // Inventar identiteta slika (1859 redova) se ne prati u repou; njegov otisak ulazi u lock samo kad je predat.
  let inventory = previous?.imageIdentityInventory ?? null;
  if (inventoryPath) {
    const raw = readFileSync(path.resolve(inventoryPath));
    const rows = parseCsv(raw.toString("utf8"));
    if (duplicates(rows, "image_id").length) { console.error("inventar ima duple image_id"); process.exit(1); }
    inventory = { tracked: false, sha256: sha256(raw), imageIdentityFingerprint: sha256(rows.map((row) => row.image_id).sort().join("\n")), brokenReferences: rows.filter((row) => row.classification === "BROKEN_IMAGE_REFERENCE").length, wrongSibling: rows.filter((row) => row.classification === "WRONG_SIBLING_IMAGE").length, rows: rows.length };
  }
  if (!inventory) { console.error("prvi lock traži --inventory <IMAGE_IDENTITY_INVENTORY.csv>"); process.exit(1); }
  const body = {
    schemaVersion: 1,
    status: "APPROVED_FOR_OWNER_IMAGE_SUPPLY",
    createdFromMainSha: previous?.createdFromMainSha ?? execSync("git merge-base HEAD origin/main", { cwd: REPO_ROOT }).toString().trim(),
    catalogIdentityFingerprint: measured.catalogIdentityFingerprint,
    activeBrands: measured.activeBrands,
    totalCards: measured.totalCards,
    cardsByBrand: measured.cardsByBrand,
    totalImageIdentities: inventory.rows,
    missingCount: measured.missingCount,
    userSupplyCount: measured.userSupplyCount,
    rightsReviewCount: measured.rightsReviewCount,
    userSupplyByBrand: measured.userSupplyByBrand,
    missingByAction: measured.missingByAction,
    manifests: measured.manifests,
    imageIdentityInventory: inventory,
    sourceUpload: SOURCE_UPLOAD,
    workingFiles: { [BATCH]: "radni fajl vlasnika (owner_has_product); namerno van SHA lock-a, proverava se strukturno" },
  };
  // Vreme je metapodatak: ne ulazi u identitet i ne osvežava se ako se sadržaj nije promenio.
  const unchanged = previous && JSON.stringify({ ...previous, metadata: undefined }) === JSON.stringify({ ...body, metadata: undefined });
  // Promenjen sadržaj = novo odobrenje: tada se beleži main iz kog je nastalo.
  if (previous && !unchanged) body.createdFromMainSha = execSync("git merge-base HEAD origin/main", { cwd: REPO_ROOT }).toString().trim();
  const lock = { ...body, metadata: unchanged ? previous.metadata : { approvedAt: new Date().toISOString().slice(0, 10), note: "approvedAt je samo metapodatak; nije deo identiteta manifesta" } };
  const text = `${JSON.stringify(lock, null, 2)}\n`;
  const changed = !previous || readFileSync(abs(LOCK), "utf8") !== text;
  if (changed) writeFileSync(abs(LOCK), text);
  console.log(JSON.stringify({ lock: LOCK, filesChanged: changed ? [LOCK] : [] }, null, 1));
  process.exit(0);
}

// ── CHECK ──
if (!previous) errors.push(`nedostaje ${LOCK} — pokrenuti sa --write-lock posle odobrenja`);
else {
  if (previous.status !== "APPROVED_FOR_OWNER_IMAGE_SUPPLY") errors.push(`status lock-a: ${previous.status}`);
  for (const key of ["catalogIdentityFingerprint", "activeBrands", "totalCards", "missingCount", "userSupplyCount", "rightsReviewCount", "userSupplyByBrand", "manifests"]) {
    if (JSON.stringify(previous[key]) !== JSON.stringify(measured[key])) errors.push(`${key}: lock ${JSON.stringify(previous[key]).slice(0, 160)} ≠ izmereno ${JSON.stringify(measured[key]).slice(0, 160)}`);
  }
}
console.log(JSON.stringify({
  status: previous?.status ?? null,
  totalCards: measured.totalCards,
  activeBrands: measured.activeBrands.length,
  totalImageIdentities: previous?.totalImageIdentities ?? null,
  missingCount: measured.missingCount,
  userSupplyCount: measured.userSupplyCount,
  rightsReviewCount: measured.rightsReviewCount,
  ownerBatch01: batch ? { candidates: batch.rows.length, answered: batch.rows.filter((row) => row.owner_has_product).length } : null,
  catalogIdentityMatchesLock: previous ? previous.catalogIdentityFingerprint === measured.catalogIdentityFingerprint : false,
  filesChanged: [],
  errors,
}, null, 1));
process.exit(errors.length ? 1 : 0);
