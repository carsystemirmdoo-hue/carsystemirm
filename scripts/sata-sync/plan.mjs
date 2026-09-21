#!/usr/bin/env node
/**
 * SATA sync, korak 5 — PLAN (faza 1: „SATA EMEA REFINISH FAMILY SCOPE”).
 *
 * Jedna zvanična SATA porodica = jedna kartica. Brojevi artikala su REDOVI tabele varijanti te
 * kartice (postojeći row model), jer porodicu i artikal vezuje isti Shopware parent.
 *
 * Plan takođe zaključava opseg: broj porodica, broj artikala i kompletnu podelu samostalnih
 * artikala poredi sa `scope-lock.json`. Ako se broj promeni, plan PADA — i kada se izvor nije
 * promenio (greška u pravilima) i kada jeste (opseg traži novo odobrenje).
 *
 * Faza 2 (samostalan pribor i pribor vezan za porodicu) se evidentira kao
 * `CURRENT_OUT_OF_SCOPE_PHASE_2`: aktuelno kod proizvođača, ne uvozi se, ne računa se kao „nedostaje”.
 *
 * Slike: izvor ih ima, ali pravo korišćenja nije potvrđeno → runtime dobija placeholder sajta, a
 * adrese zvaničnih slika ostaju samo u izveštaju (`image-availability`), nikad u datasetu sajta.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { readJson, writeJson } from "../carsystem-sync/lib/http.mjs";
import { loadCatalogRuntime } from "../lib/catalog-runtime.mjs";
import { PATHS, SCOPE_NAME } from "./lib/config.mjs";
import { europeVariants, mapOf, partitionStandalone, PHASE_2_BUCKETS, splitFamilies } from "./lib/scope.mjs";
import { createTranslator } from "./lib/terms.mjs";

const source = readJson(PATHS.source);
const rawFamilies = readJson(PATHS.rawFamilies);
const rawArticles = readJson(PATHS.rawArticles);
const taxonomy = JSON.parse(readFileSync(PATHS.taxonomy, "utf8"));
const localization = JSON.parse(readFileSync(PATHS.localizationFamilies, "utf8")).families;
const translate = createTranslator(JSON.parse(readFileSync(PATHS.localizationTerms, "utf8")));
const registry = readJson(PATHS.identityRegistry, { products: {} });
const lock = readJson(PATHS.scopeLock, null);
if (!source || !rawFamilies || !rawArticles) throw new Error("Nedostaje izvor — `npm run sata:sync:acquire`.");

const sha = (value) => createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
const norm = (text) => String(text ?? "").toLowerCase().replace(/[\u2012-\u2015]/g, "-").replace(/\s+/g, " ").trim();
const byNumber = (a, b) => String(a).localeCompare(String(b), "en", { numeric: true });
const slugify = (text) => text.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const rawFamilyById = new Map(rawFamilies.families.map((family) => [family.id, family]));
const articleByNumber = new Map(rawArticles.articles.map((article) => [article.articleNumber, article]));
const planErrors = { scopeDrift: [], missingLocalization: [], staleLocalization: [], duplicateSlug: [], duplicateArticleNumber: [], emptyFamily: [], unknownCategory: [], undecidedSourceTerm: [] };

/* ── 1. Opseg i zaključavanje ─────────────────────────────────────────────────────────────── */
const { current, inScope, outOfScope } = splitFamilies(source, taxonomy);
const standalone = partitionStandalone(source, inScope);
const inScopeArticles = inScope.flatMap((family) => europeVariants(family).map((variant) => variant.articleNumber));

// Otisak izvora: šta je SATA objavila (brojevi, pripadnost, kategorija, region) — bez vremena preuzimanja.
const sourceFingerprint = sha(
  [
    ...source.families.map((family) => [family.id, family.parentId, family.primaryCategory, family.variants.map((variant) => [variant.articleNumber, variant.region])]),
    ...source.unlistedFamilies.map((family) => [family.parentId, family.variants.map((variant) => [variant.articleNumber, variant.region])]),
    ...source.standalone.map((article) => [article.articleNumber, article.name, article.officialCategory, article.region]),
  ],
);

const scope = {
  name: SCOPE_NAME,
  families: inScope.length,
  articleNumbers: inScopeArticles.length,
  currentOutOfScopeFamilies: outOfScope.length,
  standaloneTotal: standalone.rows.length,
  standalonePartition: standalone.partition,
  phase2: {
    STANDALONE_CUSTOMER_FACING_PHASE_2: standalone.partition.STANDALONE_CUSTOMER_FACING_PHASE_2,
    ACCESSORY_TIED_TO_APPROVED_FAMILY: standalone.partition.ACCESSORY_TIED_TO_APPROVED_FAMILY,
  },
};
if (!lock) planErrors.scopeDrift.push("Nedostaje data/sata-sync/scope-lock.json — opseg nije odobren.");
else {
  const expected = JSON.stringify({ ...lock.scope });
  const actual = JSON.stringify(scope);
  if (expected !== actual) {
    planErrors.scopeDrift.push(
      lock.sourceFingerprint === sourceFingerprint
        ? "SCOPE_DRIFT_WITHOUT_SOURCE_CHANGE: brojevi opsega su se promenili, a zvanični izvor nije — greška u pravilima."
        : "SCOPE_CHANGED_WITH_SOURCE: izvor se promenio i opseg više ne odgovara odobrenom — traži novo odobrenje (`scope-lock.json`).",
    );
    planErrors.scopeDrift.push({ locked: lock.scope, measured: scope });
  }
}

/* ── 2. Postojeći zapisi (samo oni koje sync NIJE sam napravio) ───────────────────────────── */
const runtime = loadCatalogRuntime();
// Kartice faze 2 je takođe napravio sync (`registry.phase2`) — nisu „postojeći ručni zapisi” za matching faze 1.
const ownSlugs = new Set([...Object.keys(registry.products ?? {}), ...Object.keys(registry.phase2 ?? {})]);
const foreign = runtime.products.filter((product) => product.brandSlug === "sata" && !ownSlugs.has(product.slug));
const existingByName = new Map(foreign.map((product) => [norm(product.name), product]));

/* ── 3. Stavke plana ──────────────────────────────────────────────────────────────────────── */
const DESIGNATION_AXES = ["Nozzle Technology", "Nozzle Size", "Nozzle type", "Spray fan", "Digital unit version", "Clothing size", "Cup capacity"];
const FACT_LABELS = ["Air connection thread", "Air consumption", "Recommended spraying distance", "Air inlet pressure field of application", "Recommended dynamic inlet air pressure (compliant / HVLP)", "Max. recommended material inlet pressure (static)", "Material connection thread", "Cup connection type", "Max. air flow", "Max. inlet air pressure", "Max. air outlet pressure", "Thread connection inlet side", "Thread connection outlet side", "Max. volumetric delivery", "Pump ratio", "Max. operating pressure", "Noise level", "Installation type", "Place of installation", "Color"];

const DOCUMENT_KINDS = [
  ["declaration", /KONFORMIT|DECLARATION-OF-CONFORMITY/i, "Izjava o usaglašenosti"],
  ["manual", /^BAL[-_]|BETRIEBSANLEITUNG|OPERATING-MANUAL|^MANUAL/i, "Uputstvo za upotrebu"],
  ["brochure", /PROSPEKT|PROSPETT|OPUSCOLO|LEAFLET|BROCHURE/i, "Brošura"],
];
function documentsOf(family) {
  const raw = rawFamilyById.get(family.id)?.downloads ?? [];
  const shown = [];
  const mismatches = [];
  for (const href of raw) {
    const file = decodeURIComponent(href.split("?")[0].split("/").pop());
    const kind = DOCUMENT_KINDS.find(([, pattern]) => pattern.test(file));
    if (!kind) { mismatches.push({ file, reason: "UNRECOGNISED_DOCUMENT_KIND" }); continue; }
    const language = /^MULTILINGUAL/i.test(file) ? "multilingual" : /(?:^|[-_])EN(?:[-_]|$)/.test(file.replace(/\.PDF/gi, "")) ? "en" : /^(DE|IT|FR|ES)[-_]|[-_](DE|IT|FR|ES)$/i.exec(file.replace(/\.PDF/gi, ""))?.slice(1).find(Boolean)?.toLowerCase() ?? null;
    // Brošura samo na prihvatljivom jeziku; IT/DE/FR brošura sa EN stranice se beleži, ne prikazuje.
    if (kind[0] === "brochure" && language !== "en" && language !== "multilingual") {
      mismatches.push({ file, reason: "SOURCE_DOCUMENT_LANGUAGE_MISMATCH", language, sourcePage: family.url });
      continue;
    }
    // Zvanična adresa se čuva DOSLOVNO, zajedno sa `?ts=` tokenom.
    shown.push({ kind: kind[0], title: kind[2], href, file, language });
  }
  const order = { manual: 0, declaration: 1, brochure: 2 };
  return { shown: shown.sort((a, b) => order[a.kind] - order[b.kind] || a.file.localeCompare(b.file)), mismatches };
}

function rowsOf(family) {
  const variants = europeVariants(family).sort((a, b) => byNumber(a.articleNumber, b.articleNumber));
  const axisNames = [...new Set(variants.flatMap((variant) => Object.keys(variant.selection)))];
  const varying = axisNames.filter((axis) => new Set(variants.map((variant) => variant.selection[axis] ?? "")).size > 1);
  const designation = DESIGNATION_AXES.filter((axis) => varying.includes(axis));
  const untranslated = new Set();
  const documentedUntranslated = new Map();
  // Zvanične (sirove) vrednosti osa koje se na kartici prikazuju prevedene — ostaju pojmovi pretrage.
  const sourceAxisTerms = new Set();

  const stripFamily = (name) => {
    const text = String(name ?? "");
    const at = text.toLowerCase().indexOf(family.officialName.toLowerCase());
    const rest = at === 0 ? text.slice(family.officialName.length).replace(/^[\s,:\-–]+/, "") : text;
    return (rest || text).length > 90 ? `${(rest || text).slice(0, 88).replace(/\s+\S*$/, "")}…` : rest || text;
  };

  const columns = [
    { key: "config", label: "Konfiguracija" },
    ...varying.filter((axis) => axis !== "Description").map((axis) => ({ key: `axis-${slugify(axis)}`, label: translate.axis(axis) ?? axis, axis })),
    { key: "article", label: "Broj artikla" },
    { key: "status", label: "Javni status" },
  ];
  const rows = variants.map((variant) => {
    const values = {};
    for (const column of columns.filter((entry) => entry.axis)) {
      const result = translate.value(variant.selection[column.axis]);
      const raw = variant.selection[column.axis];
      if (result.documented) documentedUntranslated.set(`${column.axis} = ${raw}`, result.documented);
      else if (!result.translated && !result.omitted) untranslated.add(`${column.axis} = ${raw}`);
      if (raw && result.text && raw !== result.text) sourceAxisTerms.add(raw);
      values[column.key] = result.text ?? "—";
    }
    return { articleNumber: variant.articleNumber, officialName: variant.name, url: variant.url, config: "", values, selection: variant.selection };
  });

  /*
   * Oznaka konfiguracije mora biti jedinstvena u porodici — inače birač ne razlikuje redove.
   * Kreće se od osa-oznaka (RP · 1,3 · I), pa se dodaje po jedna preostala osa dok redovi ne
   * postanu različiti. Tek ako ni sve ose ne razlikuju redove, razlikuje ih zvanični naziv artikla,
   * a na samom kraju broj artikla.
   */
  const unique = (list) => new Set(list).size === list.length && list.every(Boolean);
  const others = varying.filter((axis) => axis !== "Description" && !designation.includes(axis));
  const labelWith = (axes) => rows.map((row) => axes.map((axis) => (DESIGNATION_AXES.includes(axis) ? row.selection[axis] : translate.value(row.selection[axis]).text)).filter(Boolean).join(" · "));
  let chosen = null;
  for (let extra = 0; extra <= others.length && !chosen; extra += 1) {
    const axes = [...designation, ...others.slice(0, extra)];
    if (axes.length && unique(labelWith(axes))) chosen = labelWith(axes);
  }
  if (!chosen) {
    const named = rows.map((row) => stripFamily(row.officialName));
    if (unique(named)) chosen = named;
    else {
      const base = designation.length ? labelWith([...designation, ...others]) : named;
      const times = new Map();
      for (const label of base) times.set(label, (times.get(label) ?? 0) + 1);
      chosen = base.map((label, index) => (label && times.get(label) === 1 ? label : `${label ? `${label} · ` : ""}art. ${rows[index].articleNumber}`));
    }
  }
  rows.forEach((row, index) => { row.config = chosen[index]; delete row.selection; });
  return {
    columns: columns.map(({ key, label }) => ({ key, label })),
    rows,
    axes: varying,
    untranslated: [...untranslated].sort(),
    documentedUntranslated: [...documentedUntranslated].sort(([a], [b]) => a.localeCompare(b)).map(([term, reason]) => ({ term, status: "SOURCE_TERM_UNTRANSLATED", reason })),
    sourceAxisTerms: [...sourceAxisTerms].sort(),
  };
}

function factsOf(family) {
  const variants = europeVariants(family);
  const facts = [];
  for (const label of FACT_LABELS) {
    const sr = translate.label(label);
    if (!sr) continue;
    const values = new Set();
    let unknown = false;
    for (const variant of variants) for (const entry of articleByNumber.get(variant.articleNumber)?.technicalData ?? []) {
      if (entry.label !== label) continue;
      const result = translate.value(entry.value);
      if (result.omitted) continue;
      if (!result.translated) { unknown = true; continue; }
      values.add(result.text);
    }
    // Činjenica porodice: najviše šest različitih zvaničnih vrednosti; više od toga je svojstvo varijante.
    if (unknown || !values.size || values.size > 6) continue;
    facts.push({ label: sr, value: [...values].sort(byNumber).join("; "), officialLabel: label });
  }
  return facts;
}

const items = [];
const localizationInput = {};
const imageAvailability = [];
for (const family of [...inScope].sort((a, b) => a.id.localeCompare(b.id))) {
  const map = mapOf(taxonomy, family);
  const raw = rawFamilyById.get(family.id) ?? {};
  const table = rowsOf(family);
  const documents = documentsOf(family);
  const existing = existingByName.get(norm(family.officialName));
  const sr = localization[family.id];

  const input = {
    officialName: family.officialName,
    tagline: raw.tagline ?? null,
    officialDescription: raw.officialDescription ?? "",
    defaultArticleName: raw.defaultArticleHeading ?? raw.defaultArticleName ?? null,
    articleNames: table.rows.map((row) => row.officialName),
  };
  const sourceHash = sha(input).slice(0, 16);
  localizationInput[family.id] = { sourceHash, ...input };

  if (!sr) planErrors.missingLocalization.push(family.id);
  else if (sr.sourceHash !== sourceHash) planErrors.staleLocalization.push({ family: family.id, expected: sourceHash, found: sr.sourceHash ?? null });
  if (!table.rows.length) planErrors.emptyFamily.push(family.id);
  // Nova neprevedena vrednost nije tiha: ili ulazi u rečnik, ili u `sourceTermsUntranslated` sa razlogom.
  for (const term of table.untranslated) planErrors.undecidedSourceTerm.push({ family: family.id, term });
  if (!map.category || !map.programSlug || !map.phaseSlug) planErrors.unknownCategory.push(family.id);

  const displayBase = sr?.displayName ?? family.officialName;
  const name = /^sata/i.test(displayBase) ? displayBase : `SATA ${displayBase}`;
  const base = slugify(family.officialName);
  const slug = existing?.slug ?? (base.startsWith("sata") ? base : `sata-${base}`);
  const aliases = source.familyAliases.filter((alias) => alias.aliasOf === family.id).map((alias) => ({ id: alias.id, url: alias.url }));

  const withOwnImage = europeVariants(family).filter((variant) => variant.imageIsArticleSpecific);
  const imageStatus = withOwnImage.length ? "OFFICIAL_IMAGE_AVAILABLE_NOT_APPROVED_FOR_RUNTIME" : "OFFICIAL_IMAGE_NOT_PUBLISHED";
  imageAvailability.push({ family: family.id, officialName: family.officialName, slug, status: imageStatus, sourcePage: family.url, articlesWithOwnImage: withOwnImage.length, articles: table.rows.length, sourceImages: withOwnImage.map((variant) => ({ articleNumber: variant.articleNumber, url: variant.image })) });

  items.push({
    action: existing ? "ENRICH_EXISTING" : "IMPORT",
    classification: existing ? "EXACT_MATCH" : "NEW",
    familyId: family.id,
    parentId: family.parentId,
    sourceAliases: aliases,
    slug,
    name: existing?.name ?? name,
    officialName: family.officialName,
    sourceUrl: family.url,
    sataCategory: family.primaryCategory,
    taxonomy: { category: map.category, programSlug: map.programSlug, phaseSlug: map.phaseSlug, visualType: map.visualType ?? "neutral" },
    content: sr ? { productType: sr.productType, shortDescription: sr.shortDescription, purpose: sr.purpose } : null,
    variantColumns: table.columns,
    variants: table.rows,
    variantAxes: table.axes,
    untranslatedAxisValues: table.untranslated,
    sourceTermsUntranslated: table.documentedUntranslated,
    sourceAxisTerms: table.sourceAxisTerms,
    facts: factsOf(family),
    documents: documents.shown,
    documentMismatches: documents.mismatches,
    imageStatus,
    sourceHash,
  });
}

for (const [slug, owners] of Object.entries(items.reduce((acc, item) => ({ ...acc, [item.slug]: [...(acc[item.slug] ?? []), item.familyId] }), {}))) if (owners.length > 1) planErrors.duplicateSlug.push({ slug, owners });
const numberOwners = new Map();
for (const item of items) for (const row of item.variants) numberOwners.set(row.articleNumber, [...(numberOwners.get(row.articleNumber) ?? []), item.familyId]);
for (const [number, owners] of numberOwners) if (owners.length > 1) planErrors.duplicateArticleNumber.push({ number, owners });

/* ── 4. Upis ──────────────────────────────────────────────────────────────────────────────── */
const count = (action) => items.filter((item) => item.action === action).length;
writeJson(PATHS.localizationInput, localizationInput);
writeJson(PATHS.imageAvailability, {
  note: "Samo evidencija izvora. Zvanične SATA slike se NE preuzimaju, ne hostuju i ne hotlinkuju dok pravo korišćenja nije potvrđeno.",
  OFFICIAL_SOURCE_IMAGES_AVAILABLE: imageAvailability.reduce((sum, entry) => sum + entry.articlesWithOwnImage, 0),
  familiesWithOfficialImage: imageAvailability.filter((entry) => entry.status === "OFFICIAL_IMAGE_AVAILABLE_NOT_APPROVED_FOR_RUNTIME").length,
  familiesWithoutOfficialImage: imageAvailability.filter((entry) => entry.status === "OFFICIAL_IMAGE_NOT_PUBLISHED").map((entry) => entry.officialName),
  APPROVED_RUNTIME_IMAGES: 0,
  families: imageAvailability,
});
writeJson(PATHS.scopeReport, {
  scope,
  sourceFingerprint,
  currentOutOfScopeFamilies: outOfScope.map((family) => ({ id: family.id, officialName: family.officialName, role: family.scope, articleNumbersEurope: family.variantCountEurope, status: "CURRENT_OUT_OF_SCOPE", reason: mapOf(taxonomy, family).reason ?? family.scope })),
  regionOnlyMembersOfInScopeFamilies: inScope.flatMap((family) => family.variants.filter((variant) => variant.region !== "CURRENT").map((variant) => ({ family: family.id, articleNumber: variant.articleNumber, status: "CURRENT_REGION_SPECIFIC" }))),
  phase2: standalone.rows.filter((row) => PHASE_2_BUCKETS.has(row.bucket)),
  consumableLikeWithinSpareParts: standalone.consumableLikeWithinSpareParts,
  standalone: standalone.rows,
});
writeJson(PATHS.plan, {
  meta: { scope: SCOPE_NAME, reference: "https://www.sata.com/en/", currentFamilies: current.length, sourceFingerprint },
  summary: {
    families: items.length,
    IMPORT: count("IMPORT"),
    ENRICH_EXISTING: count("ENRICH_EXISTING"),
    articleNumbers: inScopeArticles.length,
    documents: items.reduce((sum, item) => sum + item.documents.length, 0),
    documentLanguageMismatches: items.reduce((sum, item) => sum + item.documentMismatches.filter((entry) => entry.reason === "SOURCE_DOCUMENT_LANGUAGE_MISMATCH").length, 0),
    untranslatedAxisValues: [...new Set(items.flatMap((item) => item.untranslatedAxisValues))].length,
    SOURCE_TERM_UNTRANSLATED: [...new Map(items.flatMap((item) => item.sourceTermsUntranslated).map((entry) => [entry.term, entry])).values()],
    scope,
    planErrors,
  },
  items,
});

const hasErrors = Object.values(planErrors).some((list) => list.length);
console.log(JSON.stringify({ scope: SCOPE_NAME, families: items.length, IMPORT: count("IMPORT"), ENRICH_EXISTING: count("ENRICH_EXISTING"), articleNumbers: inScopeArticles.length, standalonePartition: standalone.partition, planErrors: Object.fromEntries(Object.entries(planErrors).map(([key, list]) => [key, list.length])) }, null, 1));
if (hasErrors) process.exitCode = 1;
