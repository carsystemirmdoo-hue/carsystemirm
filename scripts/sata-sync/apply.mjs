#!/usr/bin/env node
/**
 * SATA sync, korak 6 — APPLY. Jedini korak koji menja katalog.
 *
 * Piše:
 *   - data/sata-catalog-products.generated.json  (čita ga lib/sata-catalog-products.ts)
 *   - data/sata-sync/identity-registry.json      (samo dopuna)
 *
 * Model (odobren, faza 1 — „SATA EMEA REFINISH FAMILY SCOPE”, NE ceo SATA katalog):
 *   jedna zvanična porodica = jedan zapis = jedna kartica; brojevi artikala su redovi tabele
 *   varijanti. Postojeći `satajet-x-5500` se DOPUNJUJE (slug, adresa i ime ostaju njegovi).
 *
 * Slike: dataset NE sadrži nijednu adresu SATA slike. Dok pravo korišćenja nije potvrđeno, runtime
 * koristi placeholder sajta; dostupnost zvaničnih slika živi samo u `reports/image-availability`.
 *
 * `--check`: ništa se ne piše; ispisuje koji bi se fajlovi promenili.
 */

import path from "node:path";

import { readJson, writeJson } from "../carsystem-sync/lib/http.mjs";
import { BRAND, PATHS, PHASE2_SCOPE_NAME, REPO_ROOT, SCOPE_NAME } from "./lib/config.mjs";

const checkOnly = process.argv.includes("--check");
const plan = readJson(PATHS.plan);
const registry = readJson(PATHS.identityRegistry, { products: {} });
if (!plan) throw new Error("Nedostaje plan — `npm run sata:sync:plan`.");
if (Object.values(plan.summary.planErrors).some((list) => list.length)) throw new Error(`Plan ima greške: ${JSON.stringify(plan.summary.planErrors).slice(0, 600)}`);

const plural = (count, one, few, many) => {
  const mod10 = count % 10;
  const mod100 = count % 100;
  return mod10 === 1 && mod100 !== 11 ? one : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? few : many;
};

function entryOf(item) {
  const count = item.variants.length;
  // Rečenica o konfiguracijama se sklapa iz zvaničnih vrednosti osa — bez ijednog novog podatka.
  const technologies = [...new Set(item.variants.map((row) => row.values["axis-nozzle-technology"]).filter((value) => value && value !== "—"))];
  const configurationSentence =
    count > 1
      ? `Porodica obuhvata ${count} ${plural(count, "zvaničnu konfiguraciju", "zvanične konfiguracije", "zvaničnih konfiguracija")}${technologies.length > 1 ? ` (${technologies.join(" i ")})` : ""}; svaka ima svoj SATA broj artikla, a tačna konfiguracija i dostupnost potvrđuju se kroz upit.`
      : `Zvanični SATA broj artikla: ${item.variants[0].articleNumber}. Dostupnost se potvrđuje kroz upit.`;

  return {
    slug: item.slug,
    name: item.name,
    officialName: item.officialName,
    familyId: item.familyId,
    sourceAliases: item.sourceAliases.map((alias) => alias.id),
    sourceUrl: item.sourceUrl,
    sataCategory: item.sataCategory,
    taxonomy: item.taxonomy,
    content: {
      productType: item.content.productType,
      shortDescription: item.content.shortDescription,
      longDescription: `${item.content.shortDescription} ${configurationSentence}`,
      purpose: item.content.purpose,
    },
    facts: item.facts.map(({ label, value }) => ({ label, value })),
    variantColumns: item.variantColumns,
    variants: item.variants.map((row) => ({ articleNumber: row.articleNumber, config: row.config, officialName: row.officialName, values: row.values })),
    // Sirove zvanične vrednosti osa (EN/DE) koje su na kartici prevedene — da original ostane pretraživ.
    sourceAxisTerms: item.sourceAxisTerms,
    documents: item.documents.map(({ kind, title, href, language }) => ({ kind, title, href, language })),
    // Stanje slike je ČINJENICA o izvoru, ne adresa: nijedna SATA slika ne ulazi u runtime.
    imageStatus: item.imageStatus,
    sourceHash: item.sourceHash,
  };
}

/*
 * ── FAZA 2: samostalan i vezan pribor (`plan-phase2.mjs`) ──
 * Zaseban ključ dataseta: 66 porodica / 655 artikala faze 1 ostaju bajt-identični. Višečlana kartica je
 * LOCAL_CATALOG_GROUPING (kataloška grupa sajta), nikad zvanična SATA porodica. Bez slika, dokumenata i cena.
 */
const plan2 = readJson(PATHS.phase2Plan);
if (!plan2) throw new Error("Nedostaje plan faze 2 — `npm run sata:sync:plan`.");
if (Object.values(plan2.summary.planErrors).some((list) => list.length)) throw new Error(`Plan faze 2 ima greške: ${JSON.stringify(plan2.summary.planErrors).slice(0, 600)}`);
const phase2Products = plan2.cards.map((card) => ({
  slug: card.slug, name: card.name, nameSource: card.nameSource, officialName: card.officialName,
  grouping: card.grouping, groupingTier: card.groupingTier, classification: card.classification, duplicateOfficialNames: card.duplicateOfficialNames,
  functionalClass: card.functionalClass, productType: card.productType, taxonomy: card.taxonomy, axes: card.axes,
  relatedFamilySlugs: card.relatedFamilies.map((family) => family.slug),
  variants: card.variants.map((row) => ({ articleNumber: row.articleNumber, label: row.label, officialName: row.officialName, values: row.values, compat: row.compat, soldByMeter: row.soldByMeter, notice: row.notice })),
  imageStatus: card.imageStatus, sourceHash: card.sourceHash,
}));

const imports = plan.items.filter((item) => item.action === "IMPORT").sort((a, b) => a.slug.localeCompare(b.slug));
const enrich = plan.items.filter((item) => item.action === "ENRICH_EXISTING").sort((a, b) => a.slug.localeCompare(b.slug));
const products = imports.map(entryOf);
const enrichments = Object.fromEntries(enrich.map((item) => [item.slug, entryOf(item)]));
const all = [...products, ...Object.values(enrichments)];

const dataset = {
  meta: {
    generator: "scripts/sata-sync/apply.mjs",
    brand: BRAND.name,
    manufacturer: BRAND.manufacturer,
    scope: SCOPE_NAME,
    scopeNote: "Odobrene aktuelne porodice za auto-reparaturu. Nije ceo SATA katalog: industrijski program, reklamni artikli, rezervni delovi i samostalan pribor (faza 2) su aktuelni kod proizvođača, ali van ovog opsega.",
    website: plan.meta.reference,
    sourceFingerprint: plan.meta.sourceFingerprint,
    families: all.length,
    products: products.length,
    enrichedExisting: Object.keys(enrichments).length,
    articleNumbers: all.reduce((sum, entry) => sum + entry.variants.length, 0),
    documents: all.reduce((sum, entry) => sum + entry.documents.length, 0),
    images: {
      OFFICIAL_IMAGE_AVAILABLE_NOT_APPROVED_FOR_RUNTIME: all.filter((entry) => entry.imageStatus === "OFFICIAL_IMAGE_AVAILABLE_NOT_APPROVED_FOR_RUNTIME").length,
      OFFICIAL_IMAGE_NOT_PUBLISHED: all.filter((entry) => entry.imageStatus === "OFFICIAL_IMAGE_NOT_PUBLISHED").length,
      APPROVED_RUNTIME_IMAGES: 0,
    },
    phase2: plan.summary.scope.phase2,
    note: "Cene se ne uvoze. Brojevi artikala su zvanični SATA brojevi sa stranica artikala; interna oznaka zapisa nije broj artikla.",
  },
  products,
  enrichments,
  phase2: {
    meta: {
      scope: PHASE2_SCOPE_NAME,
      scopeNote: "Samostalan i vezan SATA pribor. Višečlane kartice su LOCAL_CATALOG_GROUPING — kataloške grupe sajta po zvaničnom nazivu, NE zvanične SATA porodice. Isključeni artikli ostaju aktuelni zapisi izvora.",
      sourceFingerprint: plan2.meta.sourceFingerprint,
      measured: plan2.summary.measured,
      images: { ...plan2.summary.images, note: "Dostupnost zvanične slike je činjenica o izvoru; nijedna adresa slike nije u datasetu." },
      documents: plan2.summary.documents,
      excluded: Object.fromEntries(Object.entries(plan2.articles).filter(([, entry]) => entry.status !== "VISIBLE").map(([articleNumber, entry]) => [articleNumber, { status: entry.status, runtimeStatus: entry.runtimeStatus ?? null, officialName: entry.officialName, ...(entry.sameOfficialNameAs ? { sameOfficialNameAs: entry.sameOfficialNameAs, provenance: entry.provenance } : {}) }])),
    },
    products: phase2Products,
    // Porodica faze 1 → kartice pribora (postojeći odeljak PDP-a „Koristi se zajedno sa”).
    links: plan2.links,
  },
};

const nextRegistry = { ...registry, products: { ...registry.products }, enriched: {} };
for (const item of imports) nextRegistry.products[item.slug] = { familyId: item.familyId, parentId: item.parentId, firstSeen: registry.products?.[item.slug]?.firstSeen ?? plan.meta.registryDate ?? new Date().toISOString().slice(0, 10) };
for (const item of enrich) nextRegistry.enriched[item.slug] = { familyId: item.familyId, parentId: item.parentId, owner: "lib/carsystem-data.ts (ručni zapis)" };

// Slugovi faze 2 se zaključavaju pri prvom apply-u (append-only): kasnija promena naziva ne menja adresu.
nextRegistry.phase2 = { ...(registry.phase2 ?? {}) };
for (const card of plan2.cards) nextRegistry.phase2[card.slug] = { articleNumbers: [...new Set([...(registry.phase2?.[card.slug]?.articleNumbers ?? []), ...card.variants.map((row) => row.articleNumber)])].sort(), grouping: card.grouping, firstSeen: registry.phase2?.[card.slug]?.firstSeen ?? plan.meta.registryDate ?? new Date().toISOString().slice(0, 10) };
nextRegistry.phase2 = Object.fromEntries(Object.entries(nextRegistry.phase2).sort(([a], [b]) => a.localeCompare(b)));

const targets = [[PATHS.siteDataset, dataset], [PATHS.identityRegistry, nextRegistry]];
const filesChanged = targets.filter(([file, value]) => JSON.stringify(readJson(file, null)) !== JSON.stringify(value)).map(([file]) => path.relative(REPO_ROOT, file));
if (!checkOnly) for (const [file, value] of targets) writeJson(file, value);

console.log(JSON.stringify({
  scope: SCOPE_NAME,
  families: all.length,
  imported: products.length,
  enrichedExisting: Object.keys(enrichments).length,
  articleNumbers: dataset.meta.articleNumbers,
  documents: dataset.meta.documents,
  images: dataset.meta.images,
  phase2: { ...plan2.summary.measured, linkedPhase1Families: Object.keys(plan2.links).length },
  filesChanged,
}, null, 1));
