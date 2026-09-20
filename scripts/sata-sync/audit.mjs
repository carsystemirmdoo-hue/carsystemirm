#!/usr/bin/env node
/**
 * SATA sync — REVIZIJA IZVORA I MODELA (dry run). Ništa ne uvozi i ne menja runtime.
 *
 * Svi brojevi se računaju iz generisanih fajlova (`raw/*`, `source-products`, `local-inventory`) —
 * nijedan nije upisan rukom. Predlog opsega dolazi iz `taxonomy-map.json` (`scope`).
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

import { readJson, writeJson } from "../carsystem-sync/lib/http.mjs";
import { PATHS, REPO_ROOT } from "./lib/config.mjs";
import { mapOf as scopeMapOf, splitFamilies } from "./lib/scope.mjs";

const source = readJson(PATHS.source);
const inventory = readJson(PATHS.inventory);
const locales = readJson(PATHS.rawLocales);
const taxonomy = JSON.parse(readFileSync(path.join(REPO_ROOT, "data/sata-sync/taxonomy-map.json"), "utf8"));
if (!source || !inventory || !locales) throw new Error("Nedostaje ulaz — build-source i inventory-local.");

const sum = (rows, pick) => rows.reduce((total, row) => total + pick(row), 0);
const slugify = (text) => text.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/ü/g, "u").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const slugOf = (family) => {
  const base = slugify(family.officialName);
  return base.startsWith("sata") ? base : `sata-${base}`;
};

/* ── Opseg (jedino mesto odluke: `lib/scope.mjs`) ── */
const mapOf = (family) => scopeMapOf(taxonomy, family);
const { current, inScope, outOfScope } = splitFamilies(source, taxonomy);
const europeVariants = (family) => family.variants.filter((variant) => variant.region === "CURRENT");

const standaloneBy = (role) => source.standalone.filter((article) => article.role === role && article.region === "CURRENT").length;
const unlistedBy = (role) => sum(source.unlistedFamilies.filter((family) => family.role === role), (family) => family.variantCountEurope);
const familyArticlesBy = (scope) => sum(current.filter((family) => family.scope === scope), (family) => family.variantCountEurope);

/* ── Slike ── */
const allVariants = [...source.families.flatMap((family) => family.variants), ...source.unlistedFamilies.flatMap((family) => family.variants), ...source.standalone];
const officialImages = allVariants.filter((variant) => variant.image).length;
const uniquePackshots = new Set(allVariants.filter((variant) => variant.imageIsArticleSpecific).map((variant) => variant.image)).size;
const siblingImages = allVariants.filter((variant) => variant.image && !variant.imageIsArticleSpecific).length;
const familyHasImage = (family) => europeVariants(family).some((variant) => variant.imageIsArticleSpecific);
const withImage = inScope.filter(familyHasImage);
const missingImage = inScope.filter((family) => !familyHasImage(family));
const variantsInScope = inScope.flatMap(europeVariants);

/* ── Dokumenti ── */
const kindOf = (href) => {
  const name = href.split("/").pop();
  if (/BETRIEBSANLEITUNG|^BAL|_BAL_|MANUAL|BEDIENUNG|OPERATING/i.test(name)) return "MANUAL";
  if (/KONFORMIT|^EG[-_]|DECLARATION/i.test(name)) return "DECLARATION_OF_CONFORMITY";
  if (/PROSPEKT|PROSPETT|BROCH|FLYER|LEAFLET|OPUSCOLO/i.test(name)) return "BROCHURE";
  return "OTHER";
};
const docStats = { MANUAL: 0, DECLARATION_OF_CONFORMITY: 0, BROCHURE: 0, OTHER: 0 };
const familiesWithManual = [];
const familiesWithoutDocs = [];
const wrongLanguage = [];
for (const family of inScope) {
  const kinds = new Set();
  for (const href of family.downloads) {
    const kind = kindOf(href);
    docStats[kind] += 1;
    kinds.add(kind);
    if (/\/(IT|DE|FR|ES)[-_]/i.test(href) && !/MULTILINGUAL/i.test(href)) wrongLanguage.push({ family: family.officialName, file: href.split("/").pop() });
  }
  if (kinds.has("MANUAL")) familiesWithManual.push(family.id);
  if (!family.downloads.length) familiesWithoutDocs.push(family.officialName);
}
const technicalDataVariants = variantsInScope.filter((variant) => variant.technicalDataRows > 0).length;

/* ── Slugovi ── */
const existingSlug = new Map(inventory.records.filter((record) => record.officialFamily).map((record) => [record.officialFamily.id, record.slug]));
const planned = inScope.map((family) => ({ id: family.id, slug: existingSlug.get(family.id) ?? slugOf(family), preserved: existingSlug.has(family.id) }));
const collisions = Object.entries(planned.reduce((acc, row) => ({ ...acc, [row.slug]: [...(acc[row.slug] ?? []), row.id] }), {})).filter(([, ids]) => ids.length > 1);

/* ── Brojevi ── */
const matched = inScope.filter((family) => existingSlug.has(family.id));
const numbers = {
  SCOPE: "APPROVED_SATA_EMEA_REFINISH_SCOPE",
  CURRENT_OUT_OF_SCOPE_FAMILIES: outOfScope.length,
  CURRENT_PRODUCT_FAMILIES: current.length,
  CURRENT_PRODUCT_FAMILIES_IN_PROPOSED_SCOPE: inScope.length,
  CURRENT_OFFICIAL_ARTICLE_NUMBERS: source.meta.articles,
  CURRENT_OFFICIAL_ARTICLE_NUMBERS_EUROPE: source.meta.articles - source.meta.regionOnlyArticles,
  CURRENT_VARIANT_MEMBERS: sum(current, (family) => family.variantCountEurope),
  CURRENT_VARIANT_MEMBERS_IN_PROPOSED_SCOPE: variantsInScope.length,
  CURRENT_ACCESSORIES: familyArticlesBy("ACCESSORY") + unlistedBy("ACCESSORY") + standaloneBy("ACCESSORY"),
  CURRENT_SPARE_PARTS: familyArticlesBy("SPARE_PART") + unlistedBy("SPARE_PART") + standaloneBy("SPARE_PART"),
  CURRENT_PART_OR_ACCESSORY_UNSPLIT: standaloneBy("PART_OR_ACCESSORY"),
  CURRENT_CONSUMABLES: familyArticlesBy("CONSUMABLE") + unlistedBy("CONSUMABLE") + standaloneBy("CONSUMABLE"),
  CURRENT_INDUSTRIAL_DEVICE_ARTICLES: familyArticlesBy("COMPLETE_DEVICE_INDUSTRIAL"),
  CURRENT_MERCHANDISE_ARTICLES: familyArticlesBy("MERCHANDISE") + standaloneBy("MERCHANDISE"),
  CURRENT_REGION_ONLY: source.meta.regionOnlyArticles,
  UNCERTAIN_NOT_CUSTOMER_FACING:
    source.families.filter((family) => family.region === "UNCERTAIN").length +
    source.meta.deadFamilyRefs.length +
    standaloneBy("UNCLASSIFIED") +
    unlistedBy("UNCLASSIFIED"),
  EXISTING_LOCAL_RECORDS: inventory.summary.underlyingRecords,
  EXACT_MATCH: inventory.summary.records.EXACT_MATCH,
  HIGH_CONFIDENCE: inventory.summary.records.HIGH_CONFIDENCE,
  PROBABLE: inventory.summary.records.PROBABLE,
  LEGACY_LOCAL_ONLY: inventory.summary.records.LEGACY_LOCAL_ONLY,
  DUPLICATES: inventory.summary.records.DUPLICATE,
  NEW_PRODUCT_FAMILIES_TO_IMPORT: inScope.length - matched.length,
  EXISTING_PRODUCTS_TO_ENRICH: matched.length,
  OFFICIAL_PRODUCT_IMAGES: officialImages,
  UNIQUE_USABLE_PACKSHOTS: uniquePackshots,
  SIBLING_IMAGES_NOT_ATTRIBUTABLE: siblingImages,
  CURRENT_PRODUCTS_WITH_IMAGE: withImage.length,
  MISSING_OFFICIAL_ASSETS: missingImage.length,
  UNDERLYING_SATA_RECORDS: inventory.summary.underlyingRecords,
  VARIANT_FAMILY_MEMBERS: inventory.summary.variantFamilyMembers,
  REDIRECT_ONLY_RECORDS: inventory.summary.redirectOnlyRecords,
  VISIBLE_CUSTOMER_FACING_CARDS_BEFORE: inventory.summary.visibleCards,
  EXPECTED_VISIBLE_CUSTOMER_FACING_CARDS_AFTER: inScope.length,
  EXPECTED_UNDERLYING_RECORDS_AFTER: inScope.length,
  EXPECTED_ROW_VARIANTS_AFTER: variantsInScope.length,
};

writeJson(path.join(REPO_ROOT, "data/sata-sync/reports/source-model-audit.generated.json"), {
  numbers,
  locales: locales.meta,
  documents: { byKind: docStats, inScopeFamiliesWithManual: familiesWithManual.length, inScopeFamiliesWithoutDocuments: familiesWithoutDocs, nonEnglishFilesOnEnglishPage: wrongLanguage, variantsWithTechnicalData: technicalDataVariants },
  slugPlan: { planned, collisions },
  inScope: inScope.map((family) => ({ id: family.id, name: family.officialName, sataCategory: family.primaryCategory, category: mapOf(family).category, variants: family.variantCountEurope, axes: Object.keys(family.axes), image: familyHasImage(family), documents: family.downloads.length })),
  outOfScope: outOfScope.map((family) => ({ id: family.id, name: family.officialName, scope: family.scope, variants: family.variantCountEurope, reason: mapOf(family).reason ?? family.scope })),
  missingImage: missingImage.map((family) => family.officialName),
});

/* ── Markdown ── */
const row = (cells) => `| ${cells.join(" | ")} |`;
const lines = [];
lines.push("# SATA — revizija izvora i modela (dry run)", "");
lines.push("> Generisano: `node scripts/sata-sync/audit.mjs`. Ništa nije uvezeno; runtime, slike i dokumenti nisu menjani. Cene se ne čitaju.", "");
lines.push("## Brojevi", "", "```", ...Object.entries(numbers).map(([key, value]) => `${key}: ${value}`), "```", "");
lines.push("## Regionalna pokrivenost (brojevi artikala po sitemap-u lokala)", "", row(["lokal", "artikala"]), row(["---", "---"]), ...Object.entries(locales.meta.counts).map(([locale, count]) => row([locale, count])), "");
lines.push(`Referenca je \`/en\` (nadskup). Artikal iz \`/en\` koga nema ni u \`${locales.meta.europeLocales.join("`, `")}\` je \`CURRENT_REGION_SPECIFIC\`: ${locales.meta.referenceRegionOnly}.`, "");
lines.push("## APPROVED_SATA_EMEA_REFINISH_SCOPE — 1 porodica = 1 kartica (ovo NIJE ceo SATA katalog)", "", row(["CF", "zvanični naziv", "SATA kategorija", "naša kategorija", "varijanti (EU)", "ose", "slika", "dok."]), row(Array(8).fill("---")));
for (const family of inScope) lines.push(row([family.id, family.officialName, family.primaryCategory, mapOf(family).category, family.variantCountEurope, Object.keys(family.axes).join(", ") || "—", familyHasImage(family) ? "da" : "NE", family.downloads.length]));
lines.push("", "## CURRENT_OUT_OF_SCOPE — aktuelno kod proizvođača, ne prikazujemo (nije discontinued)", "", row(["CF", "zvanični naziv", "uloga", "artikala (EU)", "razlog"]), row(Array(5).fill("---")));
for (const family of outOfScope) lines.push(row([family.id, family.officialName, family.scope, family.variantCountEurope, mapOf(family).reason ?? "—"]));
lines.push("", "## Porodice bez javne CF stranice (Shopware parent postoji, SATA ga ne izlaže kao porodicu)", "", row(["artikala (EU)", "uloga", "zajednički početak naziva", "ose"]), row(Array(4).fill("---")));
for (const family of source.unlistedFamilies) lines.push(row([`${family.variantCount} (${family.variantCountEurope})`, family.role, family.commonNamePrefix || family.variants[0]?.name?.slice(0, 60) || "—", family.axes.join(", ")]));
lines.push("", "## Lokalni inventar", "", "```json", JSON.stringify(inventory.summary, null, 1), "```", "");
lines.push(row(["naziv na brend stranici", "klasifikacija", "zvanično"]), row(["---", "---", "---"]), ...inventory.brandFamilies.map((entry) => row([entry.name, entry.classification, Array.isArray(entry.official) ? entry.official.join("; ") || "—" : entry.official])), "");
lines.push("## Slugovi", "", `Sačuvan postojeći: ${planned.filter((entry) => entry.preserved).map((entry) => `\`${entry.slug}\``).join(", ") || "—"}. Kolizija u predlogu: ${collisions.length}.`, "");

mkdirSync(path.dirname(PATHS.audit), { recursive: true });
// Bez prazne linije na kraju: `git diff --check` je tretira kao grešku.
writeFileSync(PATHS.audit, `${lines.join("\n").trimEnd()}\n`);
console.log(JSON.stringify(numbers, null, 1));
console.log("dokumenti:", docStats, "| bez dokumenata:", familiesWithoutDocs.length, "| sa uputstvom:", familiesWithManual.length, "| varijanti sa teh. podacima:", technicalDataVariants, "/", variantsInScope.length);
console.log("bez slike:", missingImage.map((family) => family.officialName));
console.log("kolizije:", collisions, "| ne-EN fajlovi:", wrongLanguage.length);
