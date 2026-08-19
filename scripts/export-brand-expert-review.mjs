#!/usr/bin/env node
/**
 * Phase 5 — per-brand expert review package.
 *
 * One entry per product so the Carsystem expert can go product by product and
 * see: name, code, description, category, the technical values found, related
 * products, documents, and the source of every single line.
 *
 * Two things are kept visually separate because confusing them is expensive:
 *
 *   - Products we already stock ("U CARSYSTEM PONUDI")
 *   - Products found only at the manufacturer ("KANDIDAT — NIJE U PONUDI"),
 *     which must not be published as ours without a business decision.
 *
 * Usage: node scripts/export-brand-expert-review.mjs <brandSlug>
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";

const brandSlug = process.argv[2];
if (!brandSlug) {
  console.error("Upotreba: node scripts/export-brand-expert-review.mjs <brandSlug>");
  process.exit(1);
}

const manifestPath = `data/knowledge/brands/${brandSlug}.manifest.generated.json`;
if (!existsSync(manifestPath)) {
  console.error(`Nema manifesta: ${manifestPath}`);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const OUT = `docs/seo/EXPERT_REVIEW_${brandSlug.toUpperCase()}.md`;

const lines = [];
const push = (...values) => lines.push(...values);

const FIELD_LABELS = {
  officialDescription: "Zvanični opis",
  mixingRatio: "Odnos mešanja",
  hardener: "Učvršćivač",
  thinner: "Razređivač",
  potLife: "Vreme upotrebljivosti smeše",
  coats: "Broj slojeva",
  flashOff: "Odzračivanje",
  filmThickness: "Debljina sloja",
  drying: "Sušenje",
  nozzle: "Dizna i pritisak",
  voc: "VOC",
  substrates: "Podloge",
  warnings: "Upozorenja",
};

function renderValue(claim) {
  const value = claim.value;
  if (value === undefined || value === null) return "_(nije normalizovano)_";
  if (claim.field === "mixingRatio" && typeof value === "object") {
    const parts = [`**${value.ratio ?? "—"}**`];
    for (const component of value.components ?? []) {
      parts.push(
        `  - ${component.proportion} % ${component.basis === "weight" ? "po masi" : "po zapremini"}: ${component.codes?.join(", ") || component.codesText}`,
      );
    }
    return parts.join("\n");
  }
  if (claim.field === "nozzle" && typeof value === "object") {
    const gun = value.gunType === "hvlp" ? "HVLP" : "Compliant gravity-feed";
    return [
      `**${gun}**`,
      value.nozzleMm ? `  - Dizna: ${value.nozzleMm} mm` : null,
      value.applicationPressureBar ? `  - Pritisak nanošenja: ${value.applicationPressureBar} bar` : null,
      value.nozzlePressureBar ? `  - Pritisak na dizni: ${value.nozzlePressureBar} bar` : null,
    ]
      .filter(Boolean)
      .join("\n");
  }
  if (claim.field === "drying" && Array.isArray(value)) {
    return value
      .map((entry) =>
        entry.temperatureC
          ? `  - Na ${entry.temperatureC} °C: ${entry.duration} ${entry.unit}`
          : `  - ${entry.stage}: ${entry.duration} ${entry.unit}`,
      )
      .join("\n");
  }
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return `\`${JSON.stringify(value)}\``;
  return String(value);
}

/* -------------------------------------------------------------------------- */

const offered = manifest.products.filter((p) => p.catalogStatus === "carsystem-offered");
const candidates = manifest.products.filter(
  (p) => p.catalogStatus === "manufacturer-catalog-candidate",
);

push(`# ${manifest.brandName} — stručni pregled proizvoda`);
push("");
push(`Datum: ${manifest.generatedAt.slice(0, 10)}`);
push("");
push(
  "> **Vaš zadatak nije da proveravate SEO.** Molimo proverite samo da li su tehnički podaci i njihovo tumačenje ispravni prema dokumentaciji i praksi.",
);
push("");
push(`**Proizvođač:** ${manifest.manufacturer}`);
if (manifest.source.officialWebsite) {
  push(`**Zvanični izvor:** ${manifest.source.officialWebsite}`);
}
if (manifest.source.technicalPortal) {
  push(`**Tehnički portal:** ${manifest.source.technicalPortal}`);
}
push("");
push("| Stavka | Broj |");
push("| --- | ---: |");
push(`| Proizvoda u Carsystem katalogu | ${manifest.localInventory.productsInCarsystemCatalogue} |`);
push(`| Dokumenata prikupljeno | ${manifest.acquisition.documentsAcquiredThisPhase} |`);
push(`| Tehničkih tvrdnji izvučeno | ${manifest.acquisition.technicalClaimsExtracted} |`);
push(`| Poklopljeno sa našim katalogom | ${offered.length} |`);
push(`| Kandidata kod proizvođača | ${candidates.length} |`);
push("");
push(
  "Sve izvučeno ima status `machine-extracted` — sistem ga tretira kao neobjavljivo dok ga vi ne potvrdite. Ništa od ovoga trenutno nije vidljivo na sajtu.",
);
push("");
push("---");
push("");

function renderProduct(product, index, sectionLabel) {
  push(`### ${index}. ${product.officialProductName}`);
  push("");
  push(`**Šifra:** \`${product.productCode ?? "—"}\`  ·  **Status:** ${sectionLabel}`);
  if (product.carsystemProductSlug) {
    push(`**Naš proizvod:** \`${product.carsystemProductSlug}\``);
  }
  push("");

  const doc = product.assets.find((asset) => asset.kind === "tds");
  if (doc) {
    push(
      `**Tehnički list:** [${doc.localPath}](${doc.localPath})  ·  izvor: ${doc.sourceUrl}${doc.version ? `  ·  verzija ${doc.version}` : ""}`,
    );
    push("");
  } else {
    push("**Tehnički list:** _nije prikupljen_");
    push("");
  }

  push("**FOTOGRAFIJA:** _nije prikupljena sa izvora proizvođača_");
  push("");

  if (!product.claims.length) {
    push("_Nijedan tehnički podatak nije izvučen iz dokumenta._");
    push("");
  } else {
    push("| Podatak | Vrednost | Strana | Napomena |");
    push("| --- | --- | ---: | --- |");
    for (const claim of product.claims) {
      const label = FIELD_LABELS[claim.field] ?? claim.field;
      const value = renderValue(claim).replace(/\n/g, "<br>");
      const note = claim.ambiguous ? `⚠ ${claim.note ?? "zahteva proveru"}` : "";
      push(`| ${label} | ${value} | ${claim.page ?? "—"} | ${note} |`);
    }
    push("");

    const quotes = product.claims.filter((claim) => claim.rawText).slice(0, 3);
    if (quotes.length) {
      push("**Potvrda iz izvora**");
      push("");
      for (const claim of quotes) {
        push(`> ${FIELD_LABELS[claim.field] ?? claim.field}: _${claim.rawText}_`);
      }
      push("");
    }
  }

  push("- [ ] TAČNO");
  push("- [ ] TAČNO UZ ISPRAVKU");
  push("- [ ] NETAČNO");
  push("- [ ] NE OBJAVLJIVATI");
  if (sectionLabel.startsWith("KANDIDAT")) {
    push("- [ ] **DODATI U CARSYSTEM PONUDU**");
    push("- [ ] Ne držimo ovaj proizvod");
  }
  push("");
  push("**NAPOMENA STRUČNJAKA:**");
  push("");
  push("> ____________________________________");
  push("");
  push("---");
  push("");
}

let counter = 0;

push("# DEO 1 — PROIZVODI U CARSYSTEM PONUDI");
push("");
if (offered.length) {
  push(
    `${offered.length} proizvoda iz našeg kataloga za koje je pronađena zvanična dokumentacija.`,
  );
  push("");
  for (const product of offered) renderProduct(product, ++counter, "U CARSYSTEM PONUDI");
} else {
  push("_Nijedan proizvod iz našeg kataloga nije poklopljen sa zvaničnom dokumentacijom._");
  push("");
}

push("# DEO 2 — KANDIDATI KOD PROIZVOĐAČA");
push("");
push(
  `${candidates.length} proizvoda postoji kod proizvođača, a **nije** u Carsystem katalogu.`,
);
push("");
push(
  "> Ovi proizvodi **nisu** označeni kao nešto što Carsystem prodaje. Za svaki je potrebna vaša odluka: da li ga držimo ili ne.",
);
push("");
push(
  "Ako je lista preduga za jedan prolaz, dovoljno je da označite samo one koje prepoznajete kao deo naše ponude.",
);
push("");

for (const product of candidates) {
  renderProduct(product, ++counter, "KANDIDAT — NIJE U PONUDI");
}

push("# SAŽETAK");
push("");
push("| Stavka | Broj |");
push("| --- | ---: |");
push(`| Proizvoda za pregled | **${counter}** |`);
push(`| — u našoj ponudi | ${offered.length} |`);
push(`| — kandidata | ${candidates.length} |`);
push(`| Tehničkih tvrdnji | ${manifest.acquisition.technicalClaimsExtracted} |`);
push("");
push("**Šta nedostaje za ovaj brend**");
push("");
push("- Fotografije proizvoda nisu prikupljene sa izvora proizvođača.");
push("- SDS (bezbednosni listovi) nisu prikupljeni.");
for (const note of manifest.source.notes ?? []) push(`- ${note}`);
push("");

mkdirSync("docs/seo", { recursive: true });
writeFileSync(OUT, `${lines.join("\n")}\n`);

console.log(`Izvezeno: ${OUT}`);
console.log(`  proizvoda: ${counter} (u ponudi ${offered.length}, kandidata ${candidates.length})`);
