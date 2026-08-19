#!/usr/bin/env node
/**
 * Phase 5 — Carsystem dossier: machine-readable manifest + expert package.
 *
 * Two datasets stay separate throughout, because conflating them would put
 * products in our catalogue that nobody can order:
 *
 *   carsystem-offered              the 9 records we actually sell
 *   manufacturer-catalog-candidate the rest of the official catalogue
 *
 * The expert package is organised by manufacturer category rather than by
 * product, because 462 individual questions is not a reviewable document while
 * 10 categories is.
 *
 * Output:
 *   data/knowledge/brands/carsystem.manifest.generated.json
 *   docs/seo/EXPERT_REVIEW_CARSYSTEM.md
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";

const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
const readJsonIf = (file) => (existsSync(file) ? readJson(file) : undefined);

const catalog = readJson("data/knowledge/carsystem-catalog.generated.json");
const match = readJson("data/knowledge/carsystem-match.generated.json");
const claims = readJson("data/knowledge/carsystem-website-claims.generated.json");
const documents = readJsonIf("data/knowledge/carsystem-documents.generated.json");
const images = readJsonIf("data/knowledge/carsystem-images.generated.json");
const inventory = readJson("docs/seo/BRAND_INVENTORY.json");

const generatedAt = new Date().toISOString();

const claimsBySlug = new Map(claims.records.map((record) => [record.slug, record]));
const imageBySlug = new Map(
  (images?.images ?? []).filter((image) => !image.error).map((image) => [image.productSlug, image]),
);

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
  "kleben-beschichten": "Lepljenje i zaštitni premazi",
  abdecken: "Maskiranje",
  arbeitsschutz: "Zaštita na radu",
  reinigen: "Čišćenje",
  werbemittel: "Reklamni materijal",
};

/* -------------------------------------------------------------------------- */
/* Manifest                                                                   */
/* -------------------------------------------------------------------------- */

const localMatches = new Map(match.matches.map((row) => [row.localSlug, row]));
const claimedUrls = new Set(
  match.matches.filter((row) => row.applied).flatMap((row) => row.candidates.map((c) => c.sourceUrl)),
);

const products = [];

// Our own records first — these are the only ones Carsystem i R-M sells.
for (const [slug, row] of localMatches) {
  const applied = row.applied ? row.candidates[0] : undefined;
  const official = applied
    ? catalog.products.find((product) => product.sourceUrl === applied.sourceUrl)
    : undefined;

  products.push({
    key: slug,
    manufacturer: "Vosschemie GmbH",
    brand: "Carsystem",
    officialProductName: official?.officialName ?? row.localName,
    localName: row.localName,
    productCode: row.localSku,
    articleNumbers: official?.articleNumbers ?? row.localArticleNumbers,
    manufacturerCategory: official?.category ?? row.expectedCategory,
    catalogStatus: "carsystem-offered",
    carsystemProductSlug: slug,
    matchConfidence: row.confidence,
    matchApplied: row.applied,
    candidateCount: row.candidateCount,
    officialSourceUrl: official?.sourceUrl,
    assets: official
      ? [
          ...(imageBySlug.has(official.slug)
            ? [{ kind: "primary-image", ...imageBySlug.get(official.slug), published: false }]
            : []),
          ...(docsBySlug.get(official.slug) ?? []).map((document) => ({
            kind: document.documentType,
            ...document,
          })),
        ]
      : [],
    claims: official ? (claimsBySlug.get(official.slug)?.claims ?? []) : [],
    relationships: official ? (claimsBySlug.get(official.slug)?.relationships ?? []) : [],
    discoveredAt: generatedAt,
    discoverySourceUrl: catalog.summary.officialWebsite,
  });
}

// Everything else the manufacturer makes — explicitly NOT ours.
for (const product of catalog.products) {
  if (claimedUrls.has(product.sourceUrl)) continue;
  const record = claimsBySlug.get(product.slug);
  products.push({
    key: product.slug,
    manufacturer: "Vosschemie GmbH",
    brand: "Carsystem",
    officialProductName: product.officialName,
    subtitle: product.subtitle,
    articleNumbers: product.articleNumbers,
    manufacturerCategory: product.category,
    catalogStatus: "manufacturer-catalog-candidate",
    matchConfidence: "unmatched",
    matchApplied: false,
    officialSourceUrl: product.sourceUrl,
    variants: product.variants,
    assets: [
      ...(imageBySlug.has(product.slug)
        ? [{ kind: "primary-image", ...imageBySlug.get(product.slug), published: false }]
        : []),
      ...(docsBySlug.get(product.slug) ?? []).map((document) => ({
        kind: document.documentType,
        ...document,
      })),
    ],
    claims: record?.claims ?? [],
    relationships: record?.relationships ?? [],
    discoveredAt: generatedAt,
    discoverySourceUrl: catalog.summary.officialWebsite,
  });
}

const offered = products.filter((p) => p.catalogStatus === "carsystem-offered");
const candidates = products.filter((p) => p.catalogStatus === "manufacturer-catalog-candidate");

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
    sitemaps: catalog.summary.sitemaps,
    notes: [
      "Carsystem je brend kompanije Vosschemie GmbH (info@vosschemie.de).",
      "Zvanični sitemap nabraja sve stranice proizvoda; nema API-ja za proizvode.",
      "TDS („Technisches Merkblatt“) postoji samo za hemijske kategorije; abrazivi, maskiranje i zaštita na radu ga nemaju.",
      "SDS se razrešava po broju artikla kroz endpoint sa cHash-om koji se ne može pogoditi.",
      "Sadržaj je na nemačkom; naši lokalni nazivi su na srpskom, što onemogućava leksičko poklapanje.",
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
    imagesAcquired: images?.summary?.downloaded ?? 0,
    imagesTotal: images?.summary?.productsWithOwnImage ?? 0,
    documentsAcquiredThisPhase:
      (documents?.documents ?? []).filter((d) => !d.error && d.resolved !== false).length,
    tdsAcquired: documents?.summary?.byType?.tds ?? 0,
    sdsAcquired: documents?.summary?.byType?.sds ?? 0,
    websiteClaimsExtracted: claims.summary.totalClaims,
    substrateClaimsFromWebsite: claims.summary.substrateClaims,
    relationships: claims.summary.relationships,
    technicalClaimsExtracted: claims.summary.totalClaims,
    productsMatchedToCarsystemCatalogue: offered.filter((p) => p.matchApplied).length,
    manufacturerCandidateProducts: candidates.length,
  },
  categoryAnalysis: claims.categoryAnalysis,
  conflicts: {
    invariantViolations: match.summary.invariantViolations,
    ambiguousLocalRecords: match.summary.ambiguous,
    sdsEndpointsUnresolved: documents?.summary?.sdsEndpointsRecordedAsGaps ?? 0,
  },
  products,
};

mkdirSync("data/knowledge/brands", { recursive: true });
writeFileSync(
  "data/knowledge/brands/carsystem.manifest.generated.json",
  `${JSON.stringify(manifest, null, 2)}\n`,
);

/* -------------------------------------------------------------------------- */
/* Expert package                                                             */
/* -------------------------------------------------------------------------- */

const lines = [];
const push = (...values) => lines.push(...values);

push("# Carsystem — stručni pregled proizvoda");
push("");
push(`Datum: ${generatedAt.slice(0, 10)}`);
push("");
push(
  "> **Vaš zadatak nije da proveravate SEO.** Ovo je pregled robe: proverite da li su naziv, šifra, opis i tehnički podaci ispravno vezani za proizvod.",
);
push("");
push(`**Proizvođač:** Vosschemie GmbH  ·  **Brend:** Carsystem`);
push(`**Zvanični sajt:** ${catalog.summary.officialWebsite}`);
push("");
push("| Stavka | Broj |");
push("| --- | ---: |");
push(`| Naših proizvoda | ${offered.length} |`);
push(`| Zvaničnih proizvoda proizvođača | ${catalog.products.length} |`);
push(`| Zvaničnih brojeva artikala | ${catalog.summary.totalArticleNumbers} |`);
push(`| Kategorija | ${catalog.categories.length} |`);
push(`| Preuzetih slika | ${images?.summary?.productsWithOwnImage ?? 0} |`);
push(`| Preuzetih TDS | ${documents?.summary?.byType?.tds ?? 0} |`);
push(`| Preuzetih SDS | ${documents?.summary?.byType?.sds ?? 0} |`);
push(`| Tvrdnji sa sajta proizvođača | ${claims.summary.totalClaims} |`);
push(`| **Kandidata koje NE prodajemo** | **${candidates.length}** |`);
push("");
push(
  "> Ništa od ovoga nije objavljeno. Kandidati **nisu** označeni kao nešto što Carsystem i R-M prodaje.",
);
push("");
push("---");
push("");

/* -- Part 1: our products --------------------------------------------------- */

push("# DEO 1 — NAŠI PROIZVODI");
push("");
push(
  `${offered.length} proizvoda iz našeg kataloga. Naši nazivi su na srpskom, a proizvođačevi na nemačkom, pa se većina ne može automatski povezati — potrebna je vaša potvrda.`,
);
push("");

let counter = 0;
for (const product of offered) {
  counter += 1;
  const row = localMatches.get(product.key);
  push(`### ${counter}. ${product.localName}`);
  push("");
  push(`**Naša šifra:** \`${product.productCode || "—"}\``);
  push(`**Naš zapis:** \`${product.key}\``);
  push("");

  const CONF_SR = {
    "exact-code": "**POUZDANO** — poklapanje po broju artikla",
    "normalized-code": "**POUZDANO** — poklapanje po šifri (F23 ↔ F.23)",
    "cross-family-exact": "**POUZDANO** — šifra se poklapa, kategorija se razlikuje",
    "exact-name": "**POUZDANO** — identičan naziv",
    probable: "VEROVATNO — samo po nazivu",
    ambiguous: "**VIŠE KANDIDATA** — sistem ne sme sam da izabere",
    unmatched: "NIJE PRONAĐENO",
  };
  push(`**POKLAPANJE:** ${CONF_SR[row.confidence] ?? row.confidence}`);
  if (row.resolvedByCategoryFallback) {
    push("");
    push(
      `> Naš naziv je na srpskom i nema zajedničkih reči sa nemačkim nazivima. Zato su prikazani proizvodi iz odgovarajuće kategorije (\`${row.expectedCategory}\`, ukupno ${row.categoryProductCount}). **Ovo nije dokaz da proizvod ne postoji** — treba izabrati tačan.`,
    );
  }
  push("");

  if (row.candidates.length) {
    push(`**ZVANIČNI PROIZVODI PROIZVOĐAČA (${row.candidateCount})**`);
    push("");
    push("| Zvanični naziv | Podnaslov | Br. artikla | Kategorija |");
    push("| --- | --- | --- | --- |");
    for (const candidate of row.candidates) {
      push(
        `| ${candidate.officialName} | ${candidate.subtitle ?? "—"} | ${(candidate.articleNumbers ?? []).slice(0, 3).join(", ") || "—"} | ${candidate.category} |`,
      );
    }
    push("");
  }

  const productClaims = product.claims;
  const substrates = productClaims.filter((claim) => claim.field === "substrates");
  const technical = productClaims.filter(
    (claim) => !["substrates", "applicationArea", "advantage"].includes(claim.field),
  );
  const application = productClaims.filter((claim) => claim.field === "applicationArea");

  push("| Izvor | Status |");
  push("| --- | --- |");
  push(
    `| PODACI SA SAJTA PROIZVOĐAČA | ${productClaims.length ? `**ima** (${productClaims.length})` : "nema — proizvod nije povezan"} |`,
  );
  push(
    `| TDS | ${product.assets.some((a) => a.kind === "tds") ? "**dostupan**" : "nije dostupan"} |`,
  );
  push(
    `| SDS | ${product.assets.some((a) => a.kind === "sds") ? "**dostupan**" : "nije dostupan"} |`,
  );
  push(
    `| Zvanična slika | ${product.assets.some((a) => a.kind === "primary-image") ? "**da**" : "ne"} |`,
  );
  push("");

  if (application.length) {
    push("**NAMENA (sa sajta proizvođača)**");
    push("");
    for (const claim of application.slice(0, 4)) push(`- ${claim.value}`);
    push("");
  }
  if (substrates.length) {
    push("**PODLOGE**");
    push("");
    for (const claim of substrates) {
      push(
        `- ${claim.value.label}${claim.value.suitability === "not-suitable" ? " — **NIJE dozvoljeno**" : ""}  \n  _„${claim.rawText.slice(0, 140)}"_`,
      );
    }
    push("");
  }
  if (technical.length) {
    push("**TEHNIČKI PARAMETRI**");
    push("");
    for (const claim of technical.slice(0, 8)) {
      push(`- **${claim.label ?? claim.field}:** ${String(claim.value).slice(0, 100)}`);
    }
    push("");
  }
  if (product.relationships.length) {
    push("**POVEZANI PROIZVODI**");
    push("");
    for (const relation of product.relationships) {
      push(`- ${relation.type} → br. artikla ${relation.targetArticleNumber}`);
    }
    push("");
  }

  push("**NEDOSTAJUĆI PODACI**");
  push("");
  const missing = [];
  if (!product.matchApplied) missing.push("potvrda kom zvaničnom proizvodu odgovara naš zapis");
  if (!product.assets.some((a) => a.kind === "tds")) missing.push("tehnički list");
  if (!product.assets.some((a) => a.kind === "sds")) missing.push("bezbednosni list");
  if (!substrates.length) missing.push("podaci o podlozi");
  push(missing.length ? missing.map((item) => `- ${item}`).join("\n") : "- nema");
  push("");

  push("- [ ] POTVRDI");
  push("- [ ] ISPRAVI");
  push("- [ ] ODBACI");
  push("");
  push("**NAPOMENA:**");
  push("");
  push("> ____________________________________");
  push("");
  push("---");
  push("");
}

/* -- Part 2: manufacturer catalogue by category ----------------------------- */

push("# DEO 2 — KATALOG PROIZVOĐAČA (NIJE U NAŠOJ PONUDI)");
push("");
push(
  `${candidates.length} zvaničnih Carsystem proizvoda koje trenutno ne prodajemo, po kategorijama.`,
);
push("");
push(
  "> Ovo **nije** tvrdnja da ih Carsystem i R-M prodaje. Označite kategorije ili pojedinačne proizvode koje želite u ponudi.",
);
push("");

const byCategory = new Map();
for (const candidate of candidates) {
  const bucket = byCategory.get(candidate.manufacturerCategory) ?? [];
  bucket.push(candidate);
  byCategory.set(candidate.manufacturerCategory, bucket);
}

for (const [category, items] of [...byCategory.entries()].sort((a, b) => b[1].length - a[1].length)) {
  counter += 1;
  const analysis = claims.categoryAnalysis.find((entry) => entry.category === category);
  push(`### ${counter}. ${CATEGORY_SR[category] ?? category} — ${items.length} proizvoda`);
  push("");
  push(`**Zvanična kategorija:** \`${category}\``);
  push(
    `**Artikala:** ${items.reduce((sum, item) => sum + (item.articleNumbers?.length ?? 0), 0)}  ·  **Sa slikom:** ${items.filter((item) => item.assets.some((a) => a.kind === "primary-image")).length}  ·  **Sa TDS:** ${items.filter((item) => item.assets.some((a) => a.kind === "tds")).length}  ·  **Sa SDS:** ${items.filter((item) => item.assets.some((a) => a.kind === "sds")).length}`,
  );
  push("");

  if (analysis) {
    push(
      `**ČINJENICE NA NIVOU KATEGORIJE:** ${analysis.categoryLevelClaims.length ? `${analysis.categoryLevelClaims.length} tvrdnji koje navode svi proizvodi` : "_nema — svaka tvrdnja je specifična za proizvod_"}`,
    );
    push(
      `**ČINJENICE SPECIFIČNE ZA PROIZVOD:** ${analysis.productSpecificClaims}`,
    );
    push("");
  }

  push("| Zvanični naziv | Podnaslov | Br. artikla | Slika | TDS | SDS |");
  push("| --- | --- | --- | :---: | :---: | :---: |");
  for (const item of items.slice(0, 30)) {
    push(
      `| ${item.officialProductName} | ${(item.subtitle ?? "—").slice(0, 40)} | ${(item.articleNumbers ?? []).slice(0, 2).join(", ") || "—"} | ${item.assets.some((a) => a.kind === "primary-image") ? "✓" : "–"} | ${item.assets.some((a) => a.kind === "tds") ? "✓" : "–"} | ${item.assets.some((a) => a.kind === "sds") ? "✓" : "–"} |`,
    );
  }
  if (items.length > 30) push(`| _…i još ${items.length - 30} proizvoda_ | | | | | |`);
  push("");
  push("- [ ] DODATI CELU KATEGORIJU U NAŠU PONUDU");
  push("- [ ] DODATI POJEDINAČNE PROIZVODE (označiti gore)");
  push("- [ ] NE DRŽIMO OVU KATEGORIJU");
  push("");
  push("**NAPOMENA:**");
  push("");
  push("> ____________________________________");
  push("");
  push("---");
  push("");
}

push("## ŠTA NEDOSTAJE ZA CARSYSTEM");
push("");
push(
  `- **${match.summary.ambiguous} od ${offered.length} naših zapisa** ne može se automatski povezati sa zvaničnim proizvodom — naši nazivi su na srpskom, proizvođačevi na nemačkom.`,
);
push(
  `- **${catalog.products.length - (documents?.summary?.byType?.tds ?? 0)} proizvoda** nema tehnički list (abrazivi, maskiranje, zaštita na radu ga po pravilu nemaju).`,
);
push(
  `- **SDS** postoji samo za hemijske proizvode; ${documents?.summary?.sdsEndpointsRecordedAsGaps ?? 0} zahteva nije uspelo zbog ograničenja servera i zabeleženo je kao rupa.`,
);
push(
  `- **${images?.summary?.productsWithoutOwnImage ?? 0} proizvoda** nema sopstvenu sliku koja se može pouzdano prepoznati po broju artikla.`,
);
push("");

writeFileSync("docs/seo/EXPERT_REVIEW_CARSYSTEM.md", `${lines.join("\n")}\n`);

console.log(
  JSON.stringify(
    {
      officialProducts: catalog.products.length,
      officialArticleNumbers: catalog.summary.totalArticleNumbers,
      categories: catalog.categories.length,
      ourProducts: offered.length,
      applied: offered.filter((p) => p.matchApplied).length,
      ambiguous: match.summary.ambiguous,
      candidates: candidates.length,
      images: images?.summary?.productsWithOwnImage ?? 0,
      tds: documents?.summary?.byType?.tds ?? 0,
      sds: documents?.summary?.byType?.sds ?? 0,
      websiteClaims: claims.summary.totalClaims,
      relationships: claims.summary.relationships,
    },
    null,
    2,
  ),
);
