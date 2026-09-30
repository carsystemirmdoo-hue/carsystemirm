/**
 * Writes `data/catalog/image-remaster/DERIVATIVES.md`: every reviewed display
 * derivative, its untouched original, the operations applied and EVERY active
 * product (and role) that draws it. Read-only over the catalogue runtime.
 *
 *   node scripts/catalog/image-remaster/report.mjs [--check]
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { loadCatalogRuntime } from "../../lib/catalog-runtime.mjs";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "data/catalog/image-remaster/DERIVATIVES.md");
const plan = JSON.parse(readFileSync(path.join(ROOT, "data/catalog/image-remaster/plan.json"), "utf8"));
const map = JSON.parse(readFileSync(path.join(ROOT, "data/catalog/image-remaster/display-map.json"), "utf8")).images;
const data = loadCatalogRuntime().requireModule("lib/carsystem-data.ts");

const users = new Map();
const note = (src, slug, role) => {
  if (!src) return;
  const list = users.get(src) ?? [];
  if (!list.some((entry) => entry.slug === slug && entry.role === role)) list.push({ slug, role });
  users.set(src, list);
};
for (const product of data.getAllCarsystemProducts()) {
  note(product.productImage?.src, product.slug, "glavna");
  for (const image of product.galleryImages ?? []) note(image?.src, product.slug, "galerija");
  for (const variant of data.getProductVariantSelector(product)?.variants ?? []) {
    if (variant && !variant.slug && variant.image) note(variant.image, product.slug, `red ${variant.label ?? variant.id}`);
  }
}

const LABEL = {
  "shadow-premultiply": "senka za beli papir → tamna",
  "clear-edge-frame": "okvir platna uklonjen",
  "antialias-mask": "stepenasta alfa izglađena",
  defringe: "svetao rub očišćen",
};
const byOp = {};
for (const entry of plan.images) for (const step of entry.operations) byOp[step.op] = (byOp[step.op] ?? 0) + 1;
const combos = {};
for (const entry of plan.images) {
  const key = entry.operations.map((step) => step.op).join(" + ");
  combos[key] = (combos[key] ?? 0) + 1;
}

const lines = [
  "# Derivati za prikaz — tačan spisak",
  "",
  "GENERISANO: `node scripts/catalog/image-remaster/report.mjs`. Original se NIKAD ne menja;",
  "PDP scena i kartice crtaju derivat iz `public/remastered/` (`lib/productImageDisplay.ts`).",
  "",
  `Fajlova: **${plan.images.length}**, mapiranih derivata: **${Object.keys(map).length}**, operacija ukupno: **${Object.values(byOp).reduce((a, b) => a + b, 0)}**.`,
  "",
  "| operacija | broj fajlova |",
  "| --- | --- |",
  ...Object.entries(byOp).map(([op, count]) => `| ${LABEL[op]} (\`${op}\`) | ${count} |`),
  "",
  "Kombinacije (zbir = broj fajlova; preklapanje objašnjava zašto je zbir po operacijama veći):",
  "",
  "| kombinacija | fajlova |",
  "| --- | --- |",
  ...Object.entries(combos).map(([key, count]) => `| ${key} | ${count} |`),
  "",
  "| # | derivat | original | operacije | proizvodi (uloga) |",
  "| --- | --- | --- | --- | --- |",
];
plan.images.forEach((entry, index) => {
  const who = (users.get(entry.src) ?? []).map((user) => `\`${user.slug}\` (${user.role})`).join(", ") || "— (nije u aktivnom katalogu)";
  lines.push(
    `| ${index + 1} | \`${map[entry.src] ?? "— nije mapiran"}\` | \`${entry.src}\` | ${entry.operations.map((step) => LABEL[step.op]).join("; ")} | ${who} |`,
  );
});
const text = lines.join("\n") + "\n";
if (process.argv.includes("--check")) {
  const current = readFileSync(OUT, "utf8");
  if (current !== text) {
    console.error("DERIVATIVES.md nije ažuran — pokreni report.mjs");
    process.exit(1);
  }
  console.log("DERIVATIVES.md ok");
} else {
  writeFileSync(OUT, text);
  console.log(`wrote ${path.relative(ROOT, OUT)}: ${plan.images.length} derivata`);
}
