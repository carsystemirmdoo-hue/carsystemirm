#!/usr/bin/env node
/**
 * Norbin sync, korak 4 — APPLY. Jedini korak koji menja katalog.
 *
 * Piše:
 *   - data/norbin-catalog-products.generated.json  (čita ga lib/norbin-catalog-products.ts)
 *   - data/norbin-sync/identity-registry.json      (samo dopuna)
 *
 * Model (odobren):
 *   13 aktuelnih EMEA proizvoda = 13 kartica. Identitet dolazi isključivo sa zvaničnog
 *   izvora; ERP odlučuje samo lokalni `availability`, a javni status je uvek „Na upit".
 *   Dva postojeća zapisa (`N15-020` 1 L i 5 L) čuvaju svoje adrese i postaju varijante
 *   jedne `variant-pdp` porodice. Slike proizvođač ne objavljuje — 0/13.
 *
 * `--check`: ništa se ne piše; ispisuje koji bi se fajlovi promenili.
 */

import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

import { readJson, writeJson } from "../carsystem-sync/lib/http.mjs";
import { BRAND, PATHS, REPO_ROOT, SOURCES } from "./lib/config.mjs";

const checkOnly = process.argv.includes("--check");

const plan = readJson(PATHS.plan);
const source = readJson(PATHS.source);
const registry = readJson(PATHS.identityRegistry, { products: {} });
if (!plan || !source) throw new Error("Nedostaje plan/source — pokrenuti `npm run norbin:sync:plan`.");
if (Object.values(plan.summary.planErrors).some((list) => list.length)) throw new Error(`Plan ima greške: ${JSON.stringify(plan.summary.planErrors)}`);

const localization = {};
if (existsSync(PATHS.localizationDir)) for (const file of readdirSync(PATHS.localizationDir).filter((name) => name.endsWith(".json")).sort()) Object.assign(localization, readJson(path.join(PATHS.localizationDir, file), {}));

const byCode = new Map(source.products.map((product) => [product.code, product]));
const imports = plan.items.filter((item) => item.action === "IMPORT").sort((a, b) => a.slug.localeCompare(b.slug));
const enrichments = plan.items.filter((item) => item.action === "ENRICH_EXISTING");

/** Slug po šifri — samo za zapise koje katalog zaista ima, da odnos ne pokazuje u prazno. */
const slugByCode = new Map();
for (const item of [...imports, ...enrichments]) {
  if (!item.code) continue;
  slugByCode.set(item.code, item.family ? item.family.slug : item.slug);
}

const RELATION_BY_ROLE = { hardener: "USES_HARDENER", reducer: "USES_REDUCER", additive: "USES_ADDITIVE" };

function relationsOf(record) {
  const relations = record.relations.map((relation) => ({
    code: relation.partnerCode,
    relation: RELATION_BY_ROLE[relation.partnerRole] ?? "COMPATIBLE_WITH",
    ratio: relation.ratio ?? null,
    slug: slugByCode.get(relation.partnerCode) ?? null,
    name: byCode.get(relation.partnerCode)?.officialName ?? relation.partnerCode,
    /*
     * Komponenta koju tehnički list imenuje, a izvor je nigde ne objavljuje (N85-025), ostaje
     * u modelu kao nerazrešena zvanična referenca — bez sluga, pa ne može da napravi karticu.
     */
    officialIdentity: Boolean(byCode.get(relation.partnerCode)),
  }));
  const usedBy = record.usedBy.map((entry) => ({
    code: entry.code,
    relation: "USED_BY",
    ratio: entry.ratio ?? null,
    slug: slugByCode.get(entry.code) ?? null,
    name: byCode.get(entry.code)?.officialName ?? entry.code,
    officialIdentity: true,
  }));
  return { relations, usedBy };
}

/**
 * Dokumenti: isključivo reference na zvanični izvor. URL se prenosi DOSLOVNO, sa tokenom.
 *
 * `pack` sužava skup na JEDNO pakovanje: bezbednosni list je vezan za pakovanje, pa zapis
 * pakovanja od 1 L ne sme da nosi list za 5 L. Tehnički list važi za proizvod nezavisno od
 * pakovanja i zato ostaje na svakom zapisu — tako se prirodno ponaša kao zajednički dokument.
 */
function documentsOf(record, pack = null) {
  const tds = record.documents.tds
    ? [{
        kind: "tds",
        title: `Tehnički list — ${record.officialName}`,
        href: record.documents.tds.href,
        language: record.documents.tds.region === "en" ? "en" : record.documents.tds.region,
        note: `Zvanični dokument na ${new URL(record.documents.tds.href).host}`,
        tokenizedUrl: Boolean(record.documents.tds.tokenizedUrl),
      }]
    : [];
  const sds = record.documents.sds
    .filter((document) => document.region === "en")
    .filter((document) => !pack || document.pack === pack)
    .map((document) => ({
      kind: "sds",
      title: document.pack ? `Bezbednosni list — ${record.officialName}, ${document.pack}` : `Bezbednosni list — ${record.officialName}`,
      href: document.href,
      language: "en",
      pack: document.pack ?? null,
      note: `Zvanični dokument na ${new URL(document.href).host}`,
    }));
  return [...tds, ...sds];
}

function contentOf(sr) {
  return {
    productType: sr.productType,
    subtype: sr.subtype,
    shortDescription: sr.shortDescription,
    longDescription: sr.longDescription,
    purpose: sr.purpose,
    facts: sr.facts ?? [],
    applications: sr.applications ?? [],
    benefits: sr.benefits ?? [],
    advice: sr.advice ?? null,
  };
}

function baseEntry(item) {
  const record = byCode.get(item.code);
  const { relations, usedBy } = relationsOf(record);
  return {
    sourceKey: item.sourceKey,
    code: item.code,
    officialName: record.officialName,
    officialNameSource: `${record.officialNameSource} (${record.officialNameRegion})`,
    role: record.role,
    status: "CURRENT_EMEA",
    /*
     * Dve ose se ne mešaju: `availability` je LOKALNI podatak iz dokaza o aktivnosti artikla,
     * a javni status je uvek „Na upit" — ni za jedan zapis ne tvrdimo da je na stanju.
     */
    availability: { status: item.availability, articles: item.availabilityArticles, publicStatus: "Na upit" },
    packs: record.packs,
    sourceUrls: [`${SOURCES.website.origin}/en/${SOURCES.website.page}`],
    taxonomy: item.taxonomy,
    relations,
    usedBy,
    technical: record.technical
      ? { documentFileName: record.technical.documentFileName, documentSha256: record.technical.documentSha256, claims: record.technical.claims }
      : null,
    documents: documentsOf(record),
    image: null,
    missingOfficialAsset: true,
  };
}

const products = imports.map((item) => {
  const sr = localization[item.sourceKey];
  const record = byCode.get(item.code);
  return {
    slug: item.slug,
    name: `${BRAND.name} ${record.officialName}`,
    ...baseEntry(item),
    family: null,
    content: contentOf(sr),
  };
});

/* -- Dopuna postojećih zapisa ------------------------------------------------------------- */

const enrichmentEntries = {};
for (const item of enrichments) {
  const record = byCode.get(item.code);
  const entry = baseEntry(item);
  for (const member of item.family?.members ?? [{ slug: item.slug, pack: record.packs[0] ?? null, variantId: item.sourceKey }]) {
    enrichmentEntries[member.slug] = {
      ...entry,
      documents: documentsOf(record, member.pack),
      /*
       * Porodica se zaključava na NOVU adresu, a oba postojeća sluga ostaju živa: `variant-pdp`
       * sloj ih preusmerava na porodicu sa izabranim pakovanjem.
       */
      family: item.family
        ? {
            baseProductSlug: item.family.slug,
            variantId: member.variantId,
            pack: member.pack,
            identity: member.slug === item.family.identityHolder ? { name: item.family.name, slug: item.family.slug } : null,
          }
        : null,
    };
  }
}

/* -- Upis --------------------------------------------------------------------------------- */

const dataset = {
  meta: {
    generator: "scripts/norbin-sync/apply.mjs",
    brand: BRAND.name,
    manufacturer: BRAND.manufacturer,
    brandingStatus: "CURRENT_BUT_LEGACY_BRANDING",
    website: `${SOURCES.website.origin}/en/${SOURCES.website.page}`,
    crawledAt: source.meta.crawledAt,
    referenceRegion: plan.meta.referenceRegion,
    products: products.length,
    enrichedExisting: Object.keys(enrichmentEntries).length,
    codes: new Set([...products.map((product) => product.code), ...Object.values(enrichmentEntries).map((entry) => entry.code)]).size,
    officialProductImages: 0,
    stockEvidence: plan.meta.stockEvidence,
    officialReferencedComponents: plan.referencedOnly ?? [],
    note: "Brojeva artikala nema na zvaničnom izvoru; pakovanje je varijanta. Proizvođač ne objavljuje slike proizvoda.",
  },
  products,
  enrichments: enrichmentEntries,
};

const nextRegistry = { ...registry, products: { ...registry.products }, enriched: {} };
for (const item of imports) nextRegistry.products[item.slug] = { sourceKey: item.sourceKey, code: item.code, firstSeen: registry.products[item.slug]?.firstSeen ?? new Date().toISOString().slice(0, 10) };
for (const [slug, entry] of Object.entries(enrichmentEntries)) nextRegistry.enriched[slug] = { sourceKey: entry.sourceKey, code: entry.code, owner: "lib/carsystem-data.ts (ručni zapis)" };

const targets = [[PATHS.siteDataset, dataset], [PATHS.identityRegistry, nextRegistry]];
const filesChanged = targets.filter(([file, value]) => JSON.stringify(readJson(file, null)) !== JSON.stringify(value)).map(([file]) => path.relative(REPO_ROOT, file));
if (!checkOnly) for (const [file, value] of targets) writeJson(file, value);

console.log(JSON.stringify({
  products: products.length,
  enrichedExisting: Object.keys(enrichmentEntries).length,
  codes: dataset.meta.codes,
  families: [...new Set(Object.values(enrichmentEntries).map((entry) => entry.family?.baseProductSlug).filter(Boolean))],
  availability: Object.fromEntries(["SELLABLE_CURRENT", "SELLABLE_CURRENT_ZERO_STOCK", "NOT_IN_OUR_PROGRAMME"].map((key) => [key, [...products, ...Object.values(enrichmentEntries)].filter((entry) => entry.availability.status === key).length])),
  withTds: [...products, ...Object.values(enrichmentEntries)].filter((entry) => entry.documents.some((document) => document.kind === "tds")).length,
  withSds: [...products, ...Object.values(enrichmentEntries)].filter((entry) => entry.documents.some((document) => document.kind === "sds")).length,
  relations: products.reduce((sum, product) => sum + product.relations.length, 0),
  officialProductImages: 0,
  filesChanged,
}, null, 1));
