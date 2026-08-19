#!/usr/bin/env node
/**
 * Phase 5 — C.A.R.FIT dossier, manifest and expert package.
 *
 * The expert package is organised by product category and family, not as a
 * dump of extracted fields: a reviewer works through "Füller" or "Abdeckmaterial"
 * as a body of work, and needs family and variant claims side by side to judge
 * whether a page-level value really applies to every article number under it.
 *
 * Technically identical decisions are grouped so the same question is not asked
 * repeatedly; every source document stays listed on the decision.
 *
 * Output:
 *   data/knowledge/brands/carfit.manifest.generated.json
 *   docs/seo/EXPERT_REVIEW_CARFIT.md
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";

const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
const readJsonIf = (file) => (existsSync(file) ? readJson(file) : undefined);

const catalog = readJson("data/knowledge/carfit-catalog.generated.json");
const match = readJson("data/knowledge/carfit-match.generated.json");
const website = readJson("data/knowledge/carfit-website-claims.generated.json");
const tds = readJsonIf("data/knowledge/carfit-tds-claims.generated.json");
const crosscheck = readJsonIf("data/knowledge/carfit-source-crosscheck.generated.json");
const documents = readJsonIf("data/knowledge/carfit-documents.generated.json");
const images = readJsonIf("data/knowledge/carfit-images.generated.json");
const resolution = readJsonIf("data/knowledge/carfit-document-resolution.generated.json");
const registry = readJsonIf("data/knowledge/carfit-article-registry.generated.json");

const generatedAt = new Date().toISOString();

const CATEGORY_SR = {
  schleifmittel: "Brusni materijali",
  spachtel: "Kitovi",
  fueller: "Fileri / prajmeri",
  klarlack: "Bezbojni lakovi",
  aerosole: "Sprejevi",
  poliermittel: "Politure",
  "verduenner-silikonentferner": "Razređivači i odmašćivači",
  "unterbodenschutz-klebstoffe": "Zaštita podvozja i lepkovi",
  "abdeckmaterial-abdeckklebeband": "Maskirne trake",
  "abdeckmaterial-abdeckfolien": "Maskirne folije",
  "abdeckmaterial-abdeckpapier": "Maskirni papir",
  "zubehoer-lackierzubehoer": "Lakirerski pribor",
  "zubehoer-mischbecher": "Čaše za mešanje",
  "zubehoer-ozongenerator": "Ozon generator",
};

const FIELD_SR = {
  colour: "Boja / nijansa", density: "Gustina", voc: "VOC", vocRegulation: "EU granična vrednost",
  flashPoint: "Tačka paljenja", packaging: "Pakovanje", composition: "Baza / sastav",
  temperatureResistance: "Temperaturna otpornost", processingTemperature: "Temperatura obrade",
  potLife: "Vreme upotrebljivosti", tensileStrength: "Zatezna čvrstoća", elongation: "Izduženje",
  adhesion: "Prianjanje", dimensions: "Dimenzije", thickness: "Debljina", weight: "Težina",
  material: "Materijal", abrasiveGrit: "Granulacija", grade: "Vrsta / tip", shelfLife: "Rok trajanja",
  viscosity: "Viskozitet", ignitionTemperature: "Temperatura paljenja", hardness: "Tvrdoća",
  coverage: "Izdašnost", gloss: "Stepen sjaja", saltSprayResistance: "Otpornost u slanoj komori",
  substrate: "Podloga", restriction: "OGRANIČENJE", property: "Svojstvo", intendedUse: "Namena",
  compatibility: "Kompatibilnost", flashOffTime: "Vreme razmaka između slojeva",
  mixingRatio: "Odnos mešanja", dryingTime: "Vreme sušenja", sandability: "Brusivost",
  nozzleSize: "Dizna", sprayPressure: "Pritisak", filmThickness: "Debljina sloja",
  featureSpecification: "Karakteristika", electricalSpecification: "Električna specifikacija",
  otherSpecification: "Ostala specifikacija",
};

const websiteBySlug = new Map(website.records.map((record) => [record.slug, record]));
const imageBySlug = new Map((images?.images ?? []).filter((image) => !image.error).map((image) => [image.productSlug, image]));

/**
 * Documents are attached from the Phase 2 resolution, not from the acquisition
 * guess. Only entries that count as evidence attach: a duplicate file, an
 * unreadable scan or a catalogue-only identity must not make a product look
 * documented.
 */
const docsBySlug = new Map();
for (const entry of resolution?.resolutions ?? []) {
  if (!entry.countsAsEvidence) continue;
  for (const product of entry.products) {
    const bucket = docsBySlug.get(product.slug) ?? [];
    bucket.push(entry);
    docsBySlug.set(product.slug, bucket);
  }
}

const tdsBySlug = new Map();
for (const record of tds?.records ?? []) {
  for (const slug of record.appliesToProducts) {
    const bucket = tdsBySlug.get(slug) ?? [];
    bucket.push(record);
    tdsBySlug.set(slug, bucket);
  }
}

/* -------------------------------------------------------------------------- */
/* Manifest                                                                   */
/* -------------------------------------------------------------------------- */

const matchedUrls = new Set(match.matches.flatMap((row) => row.candidates.map((candidate) => candidate.sourceUrl)));

const manifestProducts = catalog.products.map((product) => {
  const productDocs = docsBySlug.get(product.slug) ?? [];
  const image = imageBySlug.get(product.slug);
  const site = websiteBySlug.get(product.slug);
  const sheets = tdsBySlug.get(product.slug) ?? [];

  return {
    key: product.slug,
    manufacturer: "August Handel GmbH",
    brand: "C.A.R.FIT",
    officialProductName: product.officialName,
    officialProductUrl: product.sourceUrl,
    category: product.category,
    // Being in our assortment is a separate question from existing in the
    // manufacturer's catalogue, and the two are never conflated.
    catalogStatus: matchedUrls.has(product.sourceUrl) ? "matched-candidate" : "manufacturer-catalog-candidate",
    soldByCarsystem: false,
    articleNumbers: product.articleNumbers,
    variants: product.variants,
    componentBlocks: product.componentBlocks,
    scope: site?.scope,
    officialDescription: product.officialDescription,
    officialImage: image
      ? { localPath: image.localPath, sourceUrl: image.imageUrl, width: image.width, height: image.height, published: false }
      : undefined,
    tdsDocuments: productDocs.filter((entry) => entry.documentType === "tds").map((entry) => ({
      fileName: entry.fileName, sha256: entry.sha256, sourceUrl: entry.sourceUrl,
      resolutionState: entry.state, resolutionConfidence: entry.confidence, component: entry.component,
    })),
    sdsDocuments: productDocs.filter((entry) => entry.documentType === "sds").map((entry) => ({
      fileName: entry.fileName, sha256: entry.sha256, sourceUrl: entry.sourceUrl,
      resolutionState: entry.state, component: entry.component,
    })),
    websiteClaims: site?.claims ?? [],
    tdsClaims: sheets.flatMap((record) => record.claims),
    published: false,
  };
});

const completeness = {
  total: manifestProducts.length,
  withImage: manifestProducts.filter((entry) => entry.officialImage).length,
  withDescription: manifestProducts.filter((entry) => entry.officialDescription).length,
  withWebsiteClaims: manifestProducts.filter((entry) => entry.websiteClaims.length).length,
  withTds: manifestProducts.filter((entry) => entry.tdsDocuments.length).length,
  withSds: manifestProducts.filter((entry) => entry.sdsDocuments.length).length,
  withTdsClaims: manifestProducts.filter((entry) => entry.tdsClaims.length).length,
  complete: manifestProducts.filter(
    (entry) => entry.officialImage && entry.officialDescription && entry.websiteClaims.length && entry.tdsDocuments.length,
  ).length,
};

/* -------------------------------------------------------------------------- */
/* Why a product has no technical data sheet                                  */
/* -------------------------------------------------------------------------- */

/**
 * A product is never counted as documented because a sibling in its category is.
 * Each one is placed in exactly one state, and the state names *why*.
 */
const familyDocs = (resolution?.resolutions ?? []).filter(
  (entry) => entry.countsAsEvidence && (entry.state === "FAMILY_LEVEL" || entry.state === "MULTI_PRODUCT"),
);

const coverage = manifestProducts.map((product) => {
  if (product.tdsDocuments.length) {
    return { slug: product.key, name: product.officialProductName, state: "HAS_TDS", detail: `${product.tdsDocuments.length} tehnički list(ova)` };
  }

  const sharedFamily = familyDocs.find((entry) => entry.products.some((item) => item.slug === product.key));
  if (sharedFamily) {
    return { slug: product.key, name: product.officialProductName, state: "B_FAMILY_LEVEL_TDS", detail: `Deli dokument \`${sharedFamily.fileName}\` sa porodicom.` };
  }

  const componentOnly = (resolution?.resolutions ?? []).find(
    (entry) => entry.component && entry.products.some((item) => item.slug === product.key),
  );
  if (componentOnly) {
    return { slug: product.key, name: product.officialProductName, state: "C_COMPONENT_TDS_ONLY", detail: `Postoji samo dokument za komponentu „${componentOnly.component}".` };
  }

  const scan = (resolution?.resolutions ?? []).find(
    (entry) => entry.state === "IMAGE_ONLY_SCAN" && entry.products.some((item) => item.slug === product.key),
  );
  if (scan) {
    return { slug: product.key, name: product.officialProductName, state: "G_AMBIGUOUS", detail: `Tehnički list postoji ali je skeniran i nečitljiv: \`${scan.fileName}\`.` };
  }

  // An unresolved document whose evidence points at this product's name.
  const candidate = (resolution?.resolutions ?? []).find(
    (entry) =>
      (entry.state === "UNRESOLVED" || entry.state === "PROBABLE") &&
      entry.documentType === "tds" &&
      entry.products.some((item) => item.slug === product.key),
  );
  if (candidate) {
    return { slug: product.key, name: product.officialProductName, state: "A_UNASSOCIATED_TDS_EXISTS", detail: `Mogući dokument: \`${candidate.fileName}\` (${candidate.state}).` };
  }

  if (product.sdsDocuments.length) {
    return { slug: product.key, name: product.officialProductName, state: "E_SDS_ONLY", detail: `${product.sdsDocuments.length} bezbednosni list, bez tehničkog.` };
  }
  if (product.websiteClaims.length) {
    return { slug: product.key, name: product.officialProductName, state: "D_WEBSITE_ONLY", detail: `${product.websiteClaims.length} tvrdnji sa sajta proizvođača.` };
  }
  return { slug: product.key, name: product.officialProductName, state: "F_NO_TECHNICAL_DOCUMENT", detail: "Nema ni tehničkog dokumenta ni tvrdnji sa sajta." };
});

const coverageCounts = {};
for (const entry of coverage) coverageCounts[entry.state] = (coverageCounts[entry.state] ?? 0) + 1;

const manifest = {
  brandSlug: "carfit",
  brandName: "C.A.R.FIT",
  manufacturer: "August Handel GmbH",
  generatedAt,
  source: catalog.summary.source,
  sourceArchitecture: catalog.summary.sourceArchitecture,
  acquisition: {
    officialProductsDiscovered: catalog.summary.products,
    officialArticleNumbers: catalog.summary.articleNumbers,
    documentsAcquired: documents?.summary.discoveredTotal ?? 0,
    tds: documents?.summary.byType?.tds ?? 0,
    sds: documents?.summary.byType?.sds ?? 0,
    catalogues: documents?.summary.byType?.catalogue ?? 0,
    imagesAcquired: images?.summary.acquired ?? 0,
    websiteClaims: website.summary.totalClaims,
    tdsClaims: tds?.summary.totalClaims ?? 0,
  },
  matching: match.summary,
  crosscheck: crosscheck?.summary,
  completeness,
  coverage: { counts: coverageCounts, products: coverage },
  documentResolution: resolution?.summary,
  articleRegistry: registry?.summary,
  products: manifestProducts,
};

mkdirSync("data/knowledge/brands", { recursive: true });
writeFileSync(
  "data/knowledge/brands/carfit.manifest.generated.json",
  `${JSON.stringify(manifest, null, 2)}\n`,
);

/* -------------------------------------------------------------------------- */
/* Expert package                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Group technically identical decisions. The key excludes the document: a
 * shelf life of 12 months is one fact whether three sheets state it or thirty.
 */
function groupDecisions(claims) {
  const grouped = new Map();
  for (const { claim, product } of claims) {
    const valueKey = typeof claim.value === "object" ? JSON.stringify(claim.value) : String(claim.value);
    const key = `${claim.field}|${valueKey}|${claim.condition ?? ""}|${claim.scope ?? ""}`;
    const entry = grouped.get(key) ?? {
      field: claim.field,
      value: claim.value,
      unit: claim.unit,
      qualifier: claim.qualifier,
      condition: claim.condition,
      scope: claim.scope ?? "variant",
      restriction: claim.restriction,
      negated: claim.negated ?? claim.negative,
      compatible: claim.compatible,
      sourceType: claim.sourceType,
      rawText: claim.rawText ?? claim.excerpt,
      products: new Set(),
      articleNumbers: new Set(),
      documents: new Set(),
    };
    entry.products.add(product.officialName);
    for (const article of claim.appliesToArticleNumbers ?? product.articleNumbers ?? []) {
      entry.articleNumbers.add(article);
    }
    if (claim.documentFileName) entry.documents.add(claim.documentFileName);
    grouped.set(key, entry);
  }
  return [...grouped.values()].map((entry) => ({
    ...entry,
    products: [...entry.products],
    articleNumbers: [...entry.articleNumbers],
    documents: [...entry.documents],
  }));
}

const lines = [];
const push = (line = "") => lines.push(line);

push("# C.A.R.FIT — stručni pregled proizvoda i tehničkih podataka");
push();
push(`Datum: ${generatedAt.slice(0, 10)}`);
push();
push("> **Vaš zadatak nije da proveravate SEO.** Proverite da li su tehničke tvrdnje i njihovo tumačenje ispravni prema dokumentaciji i praksi.");
push();
push("**Proizvođač:** August Handel GmbH  ·  **Brend:** C.A.R.FIT  ·  **Izvor:** carfitrepair.com");
push();
push("| Stavka | Broj |");
push("| --- | ---: |");
push(`| Naših proizvoda | ${match.summary.ourProducts} |`);
push(`| Zvaničnih proizvoda proizvođača | ${catalog.summary.products} |`);
push(`| Brojeva artikala | ${catalog.summary.articleNumbers} |`);
push(`| Tehničkih listova | ${documents?.summary.byType?.tds ?? 0} |`);
push(`| Bezbednosnih listova | ${documents?.summary.byType?.sds ?? 0} |`);
push(`| Tvrdnji sa sajta proizvođača | ${website.summary.totalClaims} |`);
push(`| Tvrdnji iz tehničkih listova | ${tds?.summary.totalClaims ?? 0} |`);
push();
push("Ništa nije objavljeno i neće biti dok ne označite. Sve tvrdnje su `machine-extracted` / za proveru.");
push();
push("---");
push();

/* -- Part 1: our products --------------------------------------------------- */

push("# DEO 1 — NAŠI PROIZVODI I POKLAPANJA");
push();
push("| Naš proizvod | Naša šifra | Pouzdanost | Kandidat kod proizvođača | Artikal |");
push("| --- | --- | --- | --- | --- |");
for (const row of match.matches) {
  const best = row.candidates[0];
  push(
    `| ${row.localName} | ${row.localSku ?? "—"} | ${row.confidence} | ${best?.officialName ?? "—"} | ${best?.matchedArticleNumbers?.join(", ") || "—"} |`,
  );
}
push();
push("**Pouzdana poklapanja** su samo `exact-code`, `exact-name`, `normalized-code` i `cross-family-exact`. Sve ostalo traži vašu odluku.");
push();
for (const row of match.matches.filter((entry) => entry.confidence === "ambiguous" || entry.confidence === "unmatched")) {
  push(`### ${row.localName} — ${row.confidence}`);
  push();
  if (row.note) push(`> ${row.note}`);
  else push(`> ${row.candidateCount} kandidata; nijedan nije odlučujući. Molimo odaberite ili potvrdite da poklapanja nema.`);
  push();
  for (const candidate of row.candidates.slice(0, 6)) {
    push(`- ${candidate.officialName} — ${candidate.articleNumbers.slice(0, 6).join(", ")}${candidate.articleNumbers.length > 6 ? " …" : ""}`);
  }
  push();
}
push("---");
push();

/* -- Part 2: by category ---------------------------------------------------- */

push("# DEO 2 — TEHNIČKE ODLUKE PO KATEGORIJI");
push();

const byCategory = new Map();
for (const product of catalog.products) {
  const bucket = byCategory.get(product.category) ?? [];
  bucket.push(product);
  byCategory.set(product.category, bucket);
}

let decisionTotal = 0;
let rawTotal = 0;
const categorySections = [];

for (const [category, products] of [...byCategory.entries()].sort((a, b) => b[1].length - a[1].length)) {
  const claims = [];
  for (const product of products) {
    const site = websiteBySlug.get(product.slug);
    for (const claim of site?.claims ?? []) claims.push({ claim, product });
    for (const record of tdsBySlug.get(product.slug) ?? []) {
      for (const claim of record.claims) claims.push({ claim, product });
    }
  }
  rawTotal += claims.length;
  const decisions = groupDecisions(claims);
  decisionTotal += decisions.length;
  categorySections.push({ category, products, decisions });
}

push(`${decisionTotal} odluka, grupisano po kategoriji. Sirovih tvrdnji je ${rawTotal}; tehnički istovetne odluke su spojene.`);
push();

const renderValue = (decision) => {
  if (typeof decision.value === "object" && decision.value?.label) {
    return `${decision.value.label} — ${decision.value.suitability === "not-suitable" ? "**NIJE dozvoljeno**" : "dozvoljeno"}`;
  }
  const text = String(decision.value).slice(0, 70);
  if (decision.compatible === false) return `${text} — **NE**`;
  if (decision.compatible === true) return `${text} — DA`;
  // The qualifier is left inside the value by the extractor; re-prefixing it
  // would print "bis bis 90°C".
  if (!decision.qualifier || text.toLowerCase().startsWith(decision.qualifier.toLowerCase())) return text;
  return `${decision.qualifier} ${text}`;
};

let sectionIndex = 0;
for (const section of categorySections) {
  sectionIndex += 1;
  push(`## ${sectionIndex}. ${CATEGORY_SR[section.category] ?? section.category} — ${section.decisions.length} odluka`);
  push();
  push(`Proizvoda proizvođača u kategoriji: ${section.products.length}.`);
  push();

  // Family-scope claims first: those are the ones a reviewer most often has to
  // narrow or reject.
  const family = section.decisions.filter((decision) => String(decision.scope).startsWith("family"));
  const variant = section.decisions.filter((decision) => !String(decision.scope).startsWith("family"));

  for (const [title, group] of [["Tvrdnje na nivou porodice", family], ["Tvrdnje na nivou varijante", variant]]) {
    if (!group.length) continue;
    push(`### ${title} (${group.length})`);
    push();
    if (title.startsWith("Tvrdnje na nivou porodice")) {
      push("> Ove vrednosti stoje na stranici koja pokriva više brojeva artikala. Potvrdite da li važe za **sve** navedene artikle ili samo za neke.");
      push();
    }
    push("| Polje | Vrednost | Uslov | Proizvoda | Artikala | Izvor |");
    push("| --- | --- | --- | ---: | ---: | --- |");
    for (const decision of group.slice(0, 40)) {
      const source = decision.documents.length
        ? decision.documents.length > 1
          ? `${decision.documents.length} dok.`
          : `\`${decision.documents[0]}\``
        : "sajt";
      push(
        `| ${FIELD_SR[decision.field] ?? decision.field} | ${renderValue(decision)} | ${decision.condition ?? "—"} | ${decision.products.length} | ${decision.articleNumbers.length} | ${source} |`,
      );
    }
    if (group.length > 40) push(`| … | _još ${group.length - 40} odluka u manifestu_ | | | | |`);
    push();
  }
}

push("---");
push();

/* -- Part 3: conflicts ------------------------------------------------------ */

push("# DEO 3 — NESLAGANJA IZMEĐU IZVORA");
push();
const conflicts = (crosscheck?.comparisons ?? []).filter((entry) => entry.classification === "VALUE_CONFLICT");
if (conflicts.length) {
  push(`${conflicts.length} neslaganja. **Nijedno nije automatski razrešeno** — obe vrednosti su sačuvane.`);
  push();
  push("| Proizvod | Polje | Sajt proizvođača | Tehnički list | Dokument |");
  push("| --- | --- | --- | --- | --- |");
  for (const conflict of conflicts) {
    push(
      `| ${conflict.productSlug} | ${FIELD_SR[conflict.field] ?? conflict.field} | ${String(conflict.websiteValue).slice(0, 40)} | ${String(conflict.tdsValue).slice(0, 40)} | \`${conflict.tdsDocument}\` |`,
    );
  }
} else {
  push("Nema neslaganja sa nespojivim vrednostima.");
}
push();
const conditional = (crosscheck?.comparisons ?? []).filter((entry) => entry.classification === "CONDITIONAL_DIFFERENCE");
if (conditional.length) {
  push(`### Uslovne razlike (${conditional.length})`);
  push();
  push("Isti podatak, ali jedan izvor navodi uslov koji drugi izostavlja. Nisu konflikti.");
  push();
  for (const entry of conditional) {
    push(`- **${entry.productSlug}** · ${FIELD_SR[entry.field] ?? entry.field}: sajt „${String(entry.websiteValue).slice(0, 50)}" / list „${String(entry.tdsValue).slice(0, 50)}" (uslov: ${entry.tdsCondition ?? "—"})`);
  }
  push();
}

push("---");
push();

/* -- Part 4: gaps ----------------------------------------------------------- */

push("# DEO 4 — ŠTA NEDOSTAJE");
push();
push("| Praznina | Broj |");
push("| --- | ---: |");
push(`| Proizvoda bez tehničkog lista | ${completeness.total - completeness.withTds} |`);
push(`| Proizvoda bez bezbednosnog lista | ${completeness.total - completeness.withSds} |`);
push(`| Proizvoda bez ijedne tvrdnje sa sajta | ${completeness.total - completeness.withWebsiteClaims} |`);
push(`| Tehničkih listova koji su skenirani (bez teksta) | ${documents?.summary.unreadableScans ?? 0} |`);
push(`| Dokumenata klasifikovanih samo po nazivu fajla | ${documents?.summary.classifiedByFilenameFallback ?? 0} |`);
push(`| Neispravnih linkova ka dokumentima u izvoru | ${documents?.summary.malformedHrefsInSource ?? 0} |`);
push(`| Dokumenata koji vraćaju grešku | ${documents?.summary.failed ?? 0} |`);
push(`| Duplih brojeva artikala u izvoru proizvođača | ${match.summary.duplicateArticleNumbersInSource} |`);
push(`| Proizvoda gde naziv i URL slug ne odgovaraju | ${catalog.summary.slugNameMismatches} |`);
push();

if (match.duplicateArticles?.length) {
  push("### Dupli brojevi artikala kod proizvođača");
  push();
  push("Isti broj artikla stoji uz dva različita proizvoda. Nije ispravljano — potrebna je potvrda proizvođača.");
  push();
  for (const entry of match.duplicateArticles) {
    push(`- \`${entry.articleNumber}\` → ${entry.products.join("  /  ")}`);
  }
  push();
}

push("---");
push();

/* -- Documents not yet reliably associated ---------------------------------- */

push("# DEO 5 — DOKUMENTI KOJI JOŠ NISU POUZDANO POVEZANI");
push();

const unresolvedDocs = (resolution?.resolutions ?? []).filter((entry) =>
  ["UNRESOLVED", "UNRESOLVED_SCAN", "IMAGE_ONLY_SCAN", "PROBABLE"].includes(entry.state),
);

push(`${unresolvedDocs.length} dokumenata nije pouzdano vezano za proizvod. Za svaki je naveden dokaz koji je do sada pronađen — ne tražimo od vas da otvarate dokumente redom.`);
push();

const STATE_SR = {
  PROBABLE: "verovatno (nije potvrđeno)",
  UNRESOLVED: "nerazrešeno",
  UNRESOLVED_SCAN: "skeniran i neprepoznat",
  IMAGE_ONLY_SCAN: "skeniran — identitet poznat, sadržaj nečitljiv",
};

for (const [state, label] of Object.entries(STATE_SR)) {
  const group = unresolvedDocs.filter((entry) => entry.state === state);
  if (!group.length) continue;
  push(`## ${label} — ${group.length}`);
  push();
  if (state === "IMAGE_ONLY_SCAN") {
    push("> Identitet je utvrđen, ali tehnički sadržaj se ne može pročitati postojećim alatima. **Iz identiteta se ne izvodi nijedna tehnička tvrdnja.**");
    push();
  }
  push("| Dokument | Tip | Pretpostavljeni proizvod | Dokaz |");
  push("| --- | --- | --- | --- |");
  for (const entry of group.slice(0, 40)) {
    push(
      `| \`${entry.fileName.slice(0, 52)}\` | ${entry.documentType ?? "—"} | ${entry.products.map((product) => product.officialName).join(", ") || "—"} | ${(entry.evidence ?? []).join(" ").slice(0, 130)} |`,
    );
  }
  if (group.length > 40) push(`| … | | | _još ${group.length - 40} u manifestu_ |`);
  push();
}

/* -- Coverage --------------------------------------------------------------- */

push("---");
push();
push("# DEO 6 — ZAŠTO PROIZVOD NEMA TEHNIČKI LIST");
push();
push("Proizvod se **ne** računa kao dokumentovan zato što drugi proizvod iz iste kategorije ima dokument.");
push();
const COVERAGE_SR = {
  HAS_TDS: "Ima tehnički list",
  A_UNASSOCIATED_TDS_EXISTS: "A — postoji nepovezan tehnički list koji mu verovatno pripada",
  B_FAMILY_LEVEL_TDS: "B — deli dokument na nivou porodice",
  C_COMPONENT_TDS_ONLY: "C — postoji samo dokument za komponentu",
  D_WEBSITE_ONLY: "D — samo podaci sa sajta proizvođača",
  E_SDS_ONLY: "E — samo bezbednosni list",
  F_NO_TECHNICAL_DOCUMENT: "F — nema tehničkog dokumenta",
  G_AMBIGUOUS: "G — mapiranje ostaje neodređeno",
};
push("| Stanje | Proizvoda |");
push("| --- | ---: |");
for (const [state, count] of Object.entries(coverageCounts).sort((a, b) => b[1] - a[1])) {
  push(`| ${COVERAGE_SR[state] ?? state} | ${count} |`);
}
push();
for (const state of ["A_UNASSOCIATED_TDS_EXISTS", "G_AMBIGUOUS", "C_COMPONENT_TDS_ONLY", "B_FAMILY_LEVEL_TDS"]) {
  const group = coverage.filter((entry) => entry.state === state);
  if (!group.length) continue;
  push(`### ${COVERAGE_SR[state]}`);
  push();
  for (const entry of group.slice(0, 20)) push(`- **${entry.name}** — ${entry.detail}`);
  push();
}

push("---");
push();
push("# DEO 7 — PROIZVODI SAMO KOD PROIZVOĐAČA");
push();
push(`${match.summary.manufacturerOnlyCandidates} proizvoda postoji u zvaničnom katalogu, ali nije u našem asortimanu.`);
push();
push("> Ovi zapisi imaju status `manufacturer-catalog-candidate`. To **nije** tvrdnja da ih Carsystem i R-M prodaje, ima na stanju ili nudi.");
push();
const byCat = {};
for (const entry of match.manufacturerOnly ?? []) {
  byCat[entry.category] = (byCat[entry.category] ?? 0) + 1;
}
push("| Kategorija | Kandidata |");
push("| --- | ---: |");
for (const [category, count] of Object.entries(byCat).sort((a, b) => b[1] - a[1])) {
  push(`| ${CATEGORY_SR[category] ?? category} | ${count} |`);
}
push();

mkdirSync("docs/seo", { recursive: true });
writeFileSync("docs/seo/EXPERT_REVIEW_CARFIT.md", `${lines.join("\n")}\n`);

console.log(
  JSON.stringify(
    {
      manifestProducts: manifestProducts.length,
      rawClaims: rawTotal,
      expertDecisions: decisionTotal,
      completeness,
      conflicts: conflicts.length,
      manufacturerOnly: match.summary.manufacturerOnlyCandidates,
    },
    null,
    2,
  ),
);
