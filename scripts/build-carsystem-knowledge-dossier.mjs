#!/usr/bin/env node
/**
 * Carsystem Phase 2 — knowledge dossier, expert package and AEO readiness.
 *
 * Consolidates every evidence stream acquired for Carsystem into one
 * machine-readable dossier, then produces a review document sized for a human.
 *
 * The deduplication is the point of the expert package. 1,911 TDS claims plus
 * 1,909 website claims is not a reviewable document; but the same specification
 * repeats across article variants and shared TDS, so technically identical
 * decisions collapse into one.
 *
 * Output:
 *   data/knowledge/brands/carsystem.manifest.generated.json  (extended)
 *   data/knowledge/carsystem-aeo-readiness.generated.json
 *   docs/seo/EXPERT_REVIEW_CARSYSTEM.md
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";

const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
const readJsonIf = (file) => (existsSync(file) ? readJson(file) : undefined);

const catalog = readJson("data/knowledge/carsystem-catalog.generated.json");
const match = readJson("data/knowledge/carsystem-match.generated.json");
const website = readJson("data/knowledge/carsystem-website-claims.generated.json");
const tds = readJson("data/knowledge/carsystem-tds-claims.generated.json");
const crosscheck = readJsonIf("data/knowledge/carsystem-source-crosscheck.generated.json");
const documents = readJsonIf("data/knowledge/carsystem-documents.generated.json");
const images = readJsonIf("data/knowledge/carsystem-images.generated.json");
const inventory = readJson("docs/seo/BRAND_INVENTORY.json");

const generatedAt = new Date().toISOString();

const websiteBySlug = new Map(website.records.map((r) => [r.slug, r]));
const imageBySlug = new Map(
  (images?.images ?? []).filter((i) => !i.error).map((i) => [i.productSlug, i]),
);

const tdsBySlug = new Map();
for (const record of tds.records) {
  for (const slug of record.appliesToProducts) {
    const bucket = tdsBySlug.get(slug) ?? [];
    bucket.push(record);
    tdsBySlug.set(slug, bucket);
  }
}

const docsBySlug = new Map();
for (const document of documents?.documents ?? []) {
  if (document.error || document.resolved === false) continue;
  const bucket = docsBySlug.get(document.productSlug) ?? [];
  bucket.push(document);
  docsBySlug.set(document.productSlug, bucket);
}

const CATEGORY_SR = {
  schleifen: "Brušenje",
  lackieren: "Lakiranje",
  finish: "Finiš i poliranje",
  spachteln: "Kitovi i špahtlovanje",
  lackierbedarf: "Lakirerski pribor",
  "kleben-beschichten": "Lepljenje i zaptivanje",
  abdecken: "Maskiranje",
  arbeitsschutz: "Zaštita na radu",
  reinigen: "Čišćenje",
  werbemittel: "Reklamni materijal",
};

const FIELD_SR = {
  abrasiveGrainType: "Vrsta zrna",
  abrasiveGrit: "Granulacija",
  holePattern: "Perforacija",
  backingMaterial: "Nosač",
  dimensions: "Dimenzije",
  thickness: "Debljina",
  weight: "Težina",
  density: "Gustina",
  colour: "Boja / nijansa",
  consistency: "Konzistencija",
  material: "Materijal",
  temperatureResistance: "Temperaturna otpornost",
  processingTemperature: "Temperatura obrade",
  voc: "VOC",
  nozzleSize: "Dizna",
  sprayPressure: "Pritisak",
  filmThickness: "Debljina sloja",
  mixingRatio: "Odnos mešanja",
  potLife: "Vreme upotrebljivosti",
  dryingTime: "Vreme sušenja",
  sandability: "Brusivost",
  overcoating: "Prelakiranje",
  coverage: "Izdašnost",
  solidsByVolume: "Sadržaj suve materije",
  sprayViscosity: "Viskozitet prskanja",
  shelfLife: "Rok trajanja",
  packaging: "Pakovanje",
  odour: "Miris",
  tensileStrength: "Zatezna čvrstoća",
  composition: "Sastav / baza",
  substrate: "Podloga",
  restriction: "Ograničenje",
  otherSpecification: "Ostala specifikacija",
};

/* -------------------------------------------------------------------------- */
/* Local product resolution — family vs variant collection                    */
/* -------------------------------------------------------------------------- */

/**
 * Our generic records may legitimately denote a whole manufacturer family
 * rather than one SKU. Forcing them onto a single article number would raise
 * the "exact match" percentage while making the data wrong, so the resolution
 * type is recorded instead.
 */
const localResolution = match.matches.map((row) => {
  const candidates = row.candidates ?? [];
  let resolutionType;

  if (row.applied && row.candidateCount === 1) {
    resolutionType = "exact-product";
  } else if (row.resolvedByCategoryFallback) {
    resolutionType = "requires-expert-decision";
  } else if (candidates.length > 1) {
    // Several candidates sharing one code/name family — our record most likely
    // denotes the family, not one of its variants.
    const sharedCode = candidates.every((entry) => entry.matchedOnCode === candidates[0].matchedOnCode);
    resolutionType = sharedCode ? "family-with-variants" : "ambiguous";
  } else {
    resolutionType = "ambiguous";
  }

  const articleNumbers = [
    ...new Set(candidates.flatMap((entry) => entry.articleNumbers ?? [])),
  ];

  return {
    localSlug: row.localSlug,
    localName: row.localName,
    confidence: row.confidence,
    resolutionType,
    candidateCount: row.candidateCount,
    manufacturerFamily:
      resolutionType === "family-with-variants"
        ? candidates[0]?.matchedOnCode ?? candidates[0]?.officialName
        : undefined,
    articleVariants: articleNumbers,
    candidates,
  };
});

const resolutionCounts = {};
for (const entry of localResolution) {
  resolutionCounts[entry.resolutionType] = (resolutionCounts[entry.resolutionType] ?? 0) + 1;
}

/* -------------------------------------------------------------------------- */
/* Dossier                                                                    */
/* -------------------------------------------------------------------------- */

function dossierFor(product) {
  const tdsRecords = tdsBySlug.get(product.slug) ?? [];
  const websiteRecord = websiteBySlug.get(product.slug);
  const productDocs = docsBySlug.get(product.slug) ?? [];
  const image = imageBySlug.get(product.slug);

  return {
    officialProductUrl: product.sourceUrl,
    officialDescription: product.officialDescription,
    officialImage: image
      ? { localPath: image.localPath, sourceUrl: image.imageUrl, width: image.width, height: image.height, published: false }
      : undefined,
    articleNumbers: product.articleNumbers,
    variants: product.variants,
    tdsDocuments: productDocs.filter((d) => d.documentType === "tds").map((d) => ({
      fileName: d.fileName, sha256: d.sha256, revision: d.revision, sourceUrl: d.sourceUrl,
    })),
    sdsDocuments: productDocs.filter((d) => d.documentType === "sds").map((d) => ({
      fileName: d.fileName, sha256: d.sha256, articleNumber: d.articleNumber, sourceUrl: d.sourceUrl,
    })),
    websiteClaims: websiteRecord?.claims ?? [],
    tdsClaims: tdsRecords.flatMap((record) => record.claims),
    relationships: websiteRecord?.relationships ?? [],
  };
}

/** Value plus its qualifier, without repeating a qualifier already in the text. */
function renderScalar(decision) {
  const text = String(decision.value).slice(0, 60);
  const qualifier = decision.qualifier;
  if (!qualifier) return text;
  return text.toLowerCase().startsWith(qualifier.toLowerCase()) ? text : `${qualifier} ${text}`;
}

const manifestProducts = [];
const appliedUrls = new Set(
  match.matches.filter((row) => row.applied).flatMap((row) => row.candidates.map((c) => c.sourceUrl)),
);

for (const row of localResolution) {
  const primary = row.candidates[0];
  const resolved = catalog.products.find((p) => p.sourceUrl === primary?.sourceUrl);

  manifestProducts.push({
    key: row.localSlug,
    manufacturer: "Vosschemie GmbH",
    brand: "Carsystem",
    localName: row.localName,
    officialProductName: resolved?.officialName,
    catalogStatus: "carsystem-offered",
    carsystemProductSlug: row.localSlug,
    matchConfidence: row.confidence,
    resolutionType: row.resolutionType,
    articleVariants: row.articleVariants,
    dossier: resolved ? dossierFor(resolved) : undefined,
    discoveredAt: generatedAt,
  });
}

for (const product of catalog.products) {
  if (appliedUrls.has(product.sourceUrl)) continue;
  manifestProducts.push({
    key: product.slug,
    manufacturer: "Vosschemie GmbH",
    brand: "Carsystem",
    officialProductName: product.officialName,
    subtitle: product.subtitle,
    manufacturerCategory: product.category,
    catalogStatus: "manufacturer-catalog-candidate",
    matchConfidence: "unmatched",
    dossier: dossierFor(product),
    discoveredAt: generatedAt,
  });
}

const offered = manifestProducts.filter((p) => p.catalogStatus === "carsystem-offered");
const candidates = manifestProducts.filter(
  (p) => p.catalogStatus === "manufacturer-catalog-candidate",
);

const completeness = (list) => {
  const has = (entry, key) => Boolean(entry.dossier?.[key]?.length ?? entry.dossier?.[key]);
  return {
    total: list.length,
    withImage: list.filter((entry) => entry.dossier?.officialImage).length,
    withDescription: list.filter((entry) => entry.dossier?.officialDescription).length,
    withTds: list.filter((entry) => has(entry, "tdsDocuments")).length,
    withSds: list.filter((entry) => has(entry, "sdsDocuments")).length,
    withWebsiteClaims: list.filter((entry) => has(entry, "websiteClaims")).length,
    withTdsClaims: list.filter((entry) => has(entry, "tdsClaims")).length,
    complete: list.filter(
      (entry) =>
        entry.dossier?.officialImage &&
        entry.dossier?.officialDescription &&
        entry.dossier?.tdsDocuments?.length &&
        entry.dossier?.tdsClaims?.length,
    ).length,
  };
};

const brandInventory = inventory.brands.find((brand) => brand.brandSlug === "carsystem");

const manifest = {
  brandSlug: "carsystem",
  brandName: "Carsystem",
  manufacturer: "Vosschemie GmbH",
  generatedAt,
  source: {
    officialWebsite: catalog.summary.officialWebsite,
    technicalPortal: `${catalog.summary.officialWebsite}/produkte`,
    discoveryMethod: catalog.summary.discoveryMethod,
    acquisitionFeasibility: "product-pages",
    notes: [
      "Carsystem je brend kompanije Vosschemie GmbH.",
      "TDS koristi dva šablona (VELIKA SLOVA i Title Case); tehnički podaci su Labela: vrednost parovi.",
      "435 različitih labela u korpusu — fiksna shema bi odbacila većinu.",
      "SDS se drži kao zaseban tip dokumenta i ne koristi se za javne tvrdnje.",
    ],
  },
  localInventory: {
    productsInCarsystemCatalogue: brandInventory?.productCount ?? 0,
    localImages: brandInventory?.localImages ?? 0,
    localDocuments: brandInventory?.localDocuments ?? 0,
  },
  acquisition: {
    officialProductsDiscovered: catalog.products.length,
    officialCategories: catalog.categories.length,
    officialArticleNumbers: catalog.summary.totalArticleNumbers,
    imagesAcquired: images?.summary?.productsWithOwnImage ?? 0,
    tdsAcquired: documents?.summary?.byType?.tds ?? 0,
    sdsAcquired: documents?.summary?.byType?.sds ?? 0,
    uniqueTdsDocuments: tds.summary.documentsProcessed,
    websiteClaimsExtracted: website.summary.totalClaims,
    tdsClaimsExtracted: tds.summary.totalClaims,
    technicalClaimsExtracted: website.summary.totalClaims + tds.summary.totalClaims,
    relationships: website.summary.relationships,
    productsMatchedToCarsystemCatalogue: offered.filter(
      (entry) => entry.resolutionType === "exact-product",
    ).length,
    manufacturerCandidateProducts: candidates.length,
  },
  localResolution: { byType: resolutionCounts, records: localResolution },
  crosscheck: crosscheck?.summary,
  completeness: {
    ourProducts: completeness(offered),
    manufacturerCatalogue: completeness(candidates),
  },
  products: manifestProducts,
};

mkdirSync("data/knowledge/brands", { recursive: true });
writeFileSync(
  "data/knowledge/brands/carsystem.manifest.generated.json",
  `${JSON.stringify(manifest, null, 2)}\n`,
);

/* -------------------------------------------------------------------------- */
/* Expert decisions — deduplicated                                            */
/* -------------------------------------------------------------------------- */

/**
 * One decision per distinct (field, value, condition, source document).
 *
 * A specification repeated across every article variant of a product, or shared
 * through one TDS serving several products, is one technical fact — asking
 * about it once per occurrence would produce thousands of identical questions.
 */
const decisionMap = new Map();
for (const record of tds.records) {
  for (const claim of record.claims) {
    const valueKey =
      typeof claim.value === "object"
        ? `${claim.value.substrate}:${claim.value.suitability}`
        : String(claim.value).toLowerCase().slice(0, 60);
    /**
     * Key deliberately excludes the document.
     *
     * "Lagerstabilität: 12 Monate" is one technical fact whether it appears in
     * three sheets or thirty; asking about it once per document would put the
     * same question in front of the expert repeatedly. Every source document is
     * still listed on the decision.
     */
    const key = `${claim.field}|${valueKey}|${claim.condition ?? ""}|${record.category}`;
    const entry = decisionMap.get(key) ?? {
      field: claim.field,
      sourceLabel: claim.sourceLabel,
      value: claim.value,
      unit: claim.unit,
      qualifier: claim.qualifier,
      condition: claim.condition,
      negative: claim.negative,
      exclusive: claim.exclusive,
      excerpt: claim.excerpt,
      section: claim.section,
      page: claim.page,
      documentFileName: record.documentFileName,
      documentRevision: record.documentRevision,
      category: record.category,
      products: new Set(),
      articleNumbers: new Set(),
      documents: new Set(),
    };
    for (const slug of record.appliesToProducts) entry.products.add(slug);
    for (const article of record.appliesToArticleNumbers) entry.articleNumbers.add(article);
    entry.documents.add(record.documentFileName);
    decisionMap.set(key, entry);
  }
}

const decisions = [...decisionMap.values()].map((entry) => ({
  ...entry,
  products: [...entry.products],
  articleNumbers: [...entry.articleNumbers],
  documents: [...entry.documents],
  documentCount: entry.documents.size,
}));

const decisionsByCategory = new Map();
for (const decision of decisions) {
  const bucket = decisionsByCategory.get(decision.category) ?? [];
  bucket.push(decision);
  decisionsByCategory.set(decision.category, bucket);
}

/* -------------------------------------------------------------------------- */
/* AEO readiness                                                              */
/* -------------------------------------------------------------------------- */

const substrateClaims = tds.records
  .flatMap((record) => record.claims)
  .filter((claim) => claim.field === "substrate");

const fieldCount = (field) =>
  tds.records.flatMap((record) => record.claims).filter((claim) => claim.field === field).length;

const intents = [
  { intent: "Na koje podloge sme ovaj kit / prajmer?", evidence: substrateClaims.length, field: "substrate" },
  { intent: "Koja granulacija za koju fazu brušenja?", evidence: fieldCount("abrasiveGrit"), field: "abrasiveGrit" },
  { intent: "Koja je temperaturna otpornost trake / lepka?", evidence: fieldCount("temperatureResistance"), field: "temperatureResistance" },
  { intent: "Koji odnos mešanja i vreme upotrebljivosti?", evidence: fieldCount("mixingRatio") + fieldCount("potLife"), field: "mixingRatio" },
  { intent: "Koliko se suši i kada se može brusiti?", evidence: fieldCount("dryingTime") + fieldCount("sandability"), field: "dryingTime" },
  { intent: "Koja dizna i pritisak za nanošenje?", evidence: fieldCount("nozzleSize") + fieldCount("sprayPressure"), field: "nozzleSize" },
  { intent: "Kolika je izdašnost / potrošnja?", evidence: fieldCount("coverage"), field: "coverage" },
  { intent: "Koji je VOC sadržaj?", evidence: fieldCount("voc"), field: "voc" },
  { intent: "Koje su dimenzije i debljina?", evidence: fieldCount("dimensions") + fieldCount("thickness"), field: "dimensions" },
  { intent: "Šta se NE sme koristiti na kojoj podlozi?", evidence: substrateClaims.filter((c) => c.negative).length, field: "substrate-negative" },
  { intent: "Koji pribor ide uz koji alat?", evidence: website.summary.relationships, field: "relationships" },
  { intent: "Koliki je rok trajanja i kako se skladišti?", evidence: fieldCount("shelfLife"), field: "shelfLife" },
];

const readiness = intents.map((entry) => ({
  ...entry,
  // Machine-extracted evidence can only reach "needs review"; nothing here is
  // publishable and nothing is expert-verified.
  status: entry.evidence > 0 ? "EVIDENCE_AVAILABLE_NEEDS_REVIEW" : "NO_EVIDENCE",
}));

const readinessSummary = {
  generatedAt,
  brand: "Carsystem",
  NO_EVIDENCE: readiness.filter((r) => r.status === "NO_EVIDENCE").length,
  EVIDENCE_AVAILABLE_NEEDS_REVIEW: readiness.filter(
    (r) => r.status === "EVIDENCE_AVAILABLE_NEEDS_REVIEW",
  ).length,
  EXPERT_VERIFIED: 0,
  PUBLISHABLE: 0,
  intents: readiness,
};

writeFileSync(
  "data/knowledge/carsystem-aeo-readiness.generated.json",
  `${JSON.stringify(readinessSummary, null, 2)}\n`,
);

/* -------------------------------------------------------------------------- */
/* Expert package                                                             */
/* -------------------------------------------------------------------------- */

const lines = [];
const push = (...values) => lines.push(...values);

push("# Carsystem — stručni pregled proizvoda i tehničkih podataka");
push("");
push(`Datum: ${generatedAt.slice(0, 10)}`);
push("");
push(
  "> **Vaš zadatak nije da proveravate SEO.** Proverite da li su tehničke tvrdnje i njihovo tumačenje ispravni prema dokumentaciji i praksi.",
);
push("");
push("**Proizvođač:** Vosschemie GmbH  ·  **Brend:** Carsystem");
push("");
push("| Stavka | Broj |");
push("| --- | ---: |");
push(`| Naših proizvoda | ${offered.length} |`);
push(`| Zvaničnih proizvoda proizvođača | ${catalog.products.length} |`);
push(`| Tehničkih listova (jedinstvenih) | ${tds.summary.documentsProcessed} |`);
push(`| Tvrdnji iz tehničkih listova | ${tds.summary.totalClaims} |`);
push(`| Tvrdnji sa sajta proizvođača | ${website.summary.totalClaims} |`);
push(`| **Odluka za vas (posle grupisanja)** | **${decisions.length}** |`);
push("");
push(
  `Sirovih tvrdnji je ${tds.summary.totalClaims + website.summary.totalClaims}. Tehnički istovetne odluke su spojene, pa je za pregled ostalo **${decisions.length}**.`,
);
push("");
push("Ništa nije objavljeno i neće biti dok ne označite.");
push("");
push("---");
push("");

/* Part 1 — our products */

push("# DEO 1 — NAŠI PROIZVODI");
push("");
push("| Naš proizvod | Tip veze | Kandidata | Artikala |");
push("| --- | --- | ---: | ---: |");
const RESOLUTION_SR = {
  "exact-product": "tačan proizvod",
  "family-with-variants": "porodica sa varijantama",
  ambiguous: "višeznačno",
  "requires-expert-decision": "traži vašu odluku",
};
for (const entry of localResolution) {
  push(
    `| ${entry.localName} | ${RESOLUTION_SR[entry.resolutionType]} | ${entry.candidateCount} | ${entry.articleVariants.length} |`,
  );
}
push("");
push(
  "> Zapisi tipa „porodica sa varijantama“ namerno pokrivaju više brojeva artikala. Nisu greška i ne treba ih svoditi na jedan SKU.",
);
push("");
push("---");
push("");

/* Part 2 — technical decisions by category */

push("# DEO 2 — TEHNIČKE ODLUKE PO KATEGORIJI");
push("");
push(
  `${decisions.length} odluka, grupisano po kategoriji. Svaka pokriva sve proizvode i artikle koji dele istu specifikaciju iz istog tehničkog lista.`,
);
push("");

let counter = 0;
for (const [category, items] of [...decisionsByCategory.entries()].sort(
  (a, b) => b[1].length - a[1].length,
)) {
  counter += 1;
  push(`## ${counter}. ${CATEGORY_SR[category] ?? category} — ${items.length} odluka`);
  push("");

  const byField = new Map();
  for (const decision of items) {
    const bucket = byField.get(decision.field) ?? [];
    bucket.push(decision);
    byField.set(decision.field, bucket);
  }

  for (const [field, fieldDecisions] of [...byField.entries()].sort(
    (a, b) => b[1].length - a[1].length,
  )) {
    push(`### ${FIELD_SR[field] ?? field} (${fieldDecisions.length})`);
    push("");
    // The extractor deliberately leaves the qualifier inside the value ("bis
    // 90°C" stays whole), so prefixing it again would print "bis bis 90°C".
    push("| Vrednost | Uslov | Proizvoda | Dokument | Str. | Izvorni tekst |");
    push("| --- | --- | ---: | --- | ---: | --- |");
    for (const decision of fieldDecisions.slice(0, 25)) {
      const value =
        typeof decision.value === "object"
          ? `${decision.value.label} — ${decision.value.suitability === "not-suitable" ? "**NIJE dozvoljeno**" : "dozvoljeno"}${decision.exclusive ? " (isključivo)" : ""}`
          : renderScalar(decision);
      push(
        `| ${value} | ${decision.condition ?? "—"} | ${decision.products.length} | ${decision.documentCount > 1 ? `${decision.documentCount} dok.` : `\`${decision.documentFileName}\``} | ${decision.page} | _${decision.excerpt.slice(0, 70)}_ |`,
      );
    }
    if (fieldDecisions.length > 25) {
      push(`| _…i još ${fieldDecisions.length - 25}_ | | | | | |`);
    }
    push("");
    push("- [ ] POTVRDI");
    push("- [ ] ISPRAVI");
    push("- [ ] ODBACI");
    push("");
    push("**NAPOMENA:**");
    push("");
    push("> ____________________________________");
    push("");
  }
  push("---");
  push("");
}

/* Part 3 — conflicts */

if (crosscheck?.comparisons?.length) {
  const conflicts = crosscheck.comparisons.filter(
    (entry) => entry.classification === "VALUE_CONFLICT",
  );
  push("# DEO 3 — NESLAGANJA IZMEĐU IZVORA");
  push("");
  push(
    `${crosscheck.summary.comparisons} poređenja sajta i tehničkog lista. **${conflicts.length} stvarnih neslaganja.**`,
  );
  push("");
  push("| Klasifikacija | Broj |");
  push("| --- | ---: |");
  for (const [key, value] of Object.entries(crosscheck.summary.byClassification)) {
    push(`| ${key} | ${value} |`);
  }
  push("");
  if (conflicts.length) {
    push("### Neslaganja koja traže vašu odluku");
    push("");
    for (const conflict of conflicts) {
      push(`**${conflict.productSlug}** — ${FIELD_SR[conflict.field] ?? conflict.field}`);
      push("");
      push(
        `- **Sajt proizvođača:** ${typeof conflict.websiteValue === "object" ? JSON.stringify(conflict.websiteValue) : conflict.websiteValue}`,
      );
      push(
        `- **Tehnički list:** ${typeof conflict.tdsValue === "object" ? JSON.stringify(conflict.tdsValue) : conflict.tdsValue}  ·  \`${conflict.tdsDocument}\`, str. ${conflict.tdsPage}`,
      );
      push("");
      push("- [ ] Tačan je tehnički list");
      push("- [ ] Tačan je sajt");
      push("- [ ] Mere različite veličine (nije kontradikcija)");
      push("");
    }
  }
  push("---");
  push("");
}

/* Part 4 — assortment candidates */

push("# DEO 4 — KATALOG PROIZVOĐAČA (NIJE U NAŠOJ PONUDI)");
push("");
push(`${candidates.length} zvaničnih proizvoda koje ne prodajemo.`);
push("");
push("> Ovo **nije** tvrdnja da ih Carsystem i R-M prodaje.");
push("");
push("| Kategorija | Proizvoda | Sa slikom | Sa TDS | Sa SDS |");
push("| --- | ---: | ---: | ---: | ---: |");
const candByCat = new Map();
for (const candidate of candidates) {
  const bucket = candByCat.get(candidate.manufacturerCategory) ?? [];
  bucket.push(candidate);
  candByCat.set(candidate.manufacturerCategory, bucket);
}
for (const [category, items] of [...candByCat.entries()].sort((a, b) => b[1].length - a[1].length)) {
  push(
    `| ${CATEGORY_SR[category] ?? category} | ${items.length} | ${items.filter((i) => i.dossier?.officialImage).length} | ${items.filter((i) => i.dossier?.tdsDocuments?.length).length} | ${items.filter((i) => i.dossier?.sdsDocuments?.length).length} |`,
  );
}
push("");
push("- [ ] DODATI U NAŠU PONUDU (označiti kategorije)");
push("");

writeFileSync("docs/seo/EXPERT_REVIEW_CARSYSTEM.md", `${lines.join("\n")}\n`);

console.log(
  JSON.stringify(
    {
      tdsClaims: tds.summary.totalClaims,
      websiteClaims: website.summary.totalClaims,
      rawClaims: tds.summary.totalClaims + website.summary.totalClaims,
      expertDecisions: decisions.length,
      localResolution: resolutionCounts,
      crosscheck: crosscheck?.summary?.byClassification,
      completenessOurs: manifest.completeness.ourProducts,
      completenessCatalogue: manifest.completeness.manufacturerCatalogue,
      aeo: {
        NO_EVIDENCE: readinessSummary.NO_EVIDENCE,
        NEEDS_REVIEW: readinessSummary.EVIDENCE_AVAILABLE_NEEDS_REVIEW,
        EXPERT_VERIFIED: 0,
        PUBLISHABLE: 0,
      },
    },
    null,
    2,
  ),
);
