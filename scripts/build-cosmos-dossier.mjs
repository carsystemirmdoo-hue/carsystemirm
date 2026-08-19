#!/usr/bin/env node
/**
 * Phase 5 — Cosmos Lac dossier: manifest, gap report and expert package.
 *
 * Organised by ProductGroup (family), not by shade. The existing 41
 * ProductGroups already model "one product, many colours"; attaching a
 * family-level official description to each of 134 shades would fabricate 134
 * separate documents from one source.
 *
 * The expert package is written to read like a product catalogue — image,
 * name, code, description, documents, source — not like a technical report.
 *
 * Output:
 *   data/knowledge/brands/cosmos-lac.manifest.generated.json
 *   docs/seo/EXPERT_REVIEW_COSMOS_LAC.md
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));

const catalog = readJson("data/knowledge/cosmos-catalog.generated.json");
const match = readJson("data/knowledge/cosmos-match.generated.json");
const images = readJson("data/knowledge/cosmos-images.generated.json");
const websiteClaims = readJson("data/knowledge/cosmos-website-claims.generated.json");
const local = readJson("data/cosmos-lac-products.generated.json");
const inventory = readJson("docs/seo/BRAND_INVENTORY.json");

const generatedAt = new Date().toISOString();

const officialByUrl = new Map(catalog.products.map((p) => [p.sourceUrl, p]));
const imageBySlug = new Map(images.images.filter((i) => !i.error).map((i) => [i.slug, i]));
const matchByLocal = new Map(match.matches.map((m) => [m.localSlug, m]));
const claimsBySlug = new Map(websiteClaims.records.map((r) => [r.slug, r]));
const familyAnalysisByFamily = new Map(
  websiteClaims.familyAnalysis.map((f) => [f.family, f]),
);

/** Deduplicate claims that repeat across sentences of one description. */
function dedupeClaims(claims) {
  const seen = new Set();
  const out = [];
  for (const claim of claims) {
    const key =
      claim.field === "substrates"
        ? `substrates:${claim.value.substrate}:${claim.value.suitability}`
        : `${claim.field}:${String(claim.value).toLowerCase().slice(0, 60)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(claim);
  }
  return out;
}

/* -- Group by our existing ProductGroup (baseProductSlug) ------------------- */

const groups = new Map();
for (const record of local) {
  const key = record.baseProductSlug;
  const bucket = groups.get(key) ?? { key, line: record.line, members: [] };
  bucket.members.push(record);
  groups.set(key, bucket);
}

const groupRows = [];
for (const group of groups.values()) {
  const matches = group.members.map((m) => matchByLocal.get(m.slug)).filter(Boolean);
  const applied = matches.filter((m) => m.applied);
  const officialFamilies = [
    ...new Set(applied.map((m) => m.officialFamily).filter(Boolean)),
  ];

  // One official product stands in for the family's description; it is the same
  // text across the family, so it is recorded once here rather than copied.
  const representative = applied
    .map((m) => officialByUrl.get(m.officialUrl))
    .find((p) => p?.officialDescription);

  const withImages = group.members.filter((m) => {
    const matched = matchByLocal.get(m.slug);
    return matched?.applied && imageBySlug.has(officialByUrl.get(matched.officialUrl)?.slug);
  }).length;

  // Claims for every matched variant in this group, so family-level facts can
  // be distinguished from facts stated on only one variant's page.
  const memberClaimSets = applied
    .map((m) => officialByUrl.get(m.officialUrl))
    .filter(Boolean)
    .map((product) => ({
      product,
      claims: dedupeClaims(claimsBySlug.get(product.slug)?.claims ?? []),
    }))
    .filter((entry) => entry.claims.length);

  const claimKey = (claim) =>
    claim.field === "substrates"
      ? `substrates:${claim.value.substrate}:${claim.value.suitability}`
      : `${claim.field}:${String(claim.value).toLowerCase().slice(0, 60)}`;

  const occurrences = new Map();
  for (const entry of memberClaimSets) {
    for (const claim of entry.claims) {
      const key = claimKey(claim);
      const bucket = occurrences.get(key) ?? { claim, count: 0, examples: [] };
      bucket.count += 1;
      if (bucket.examples.length < 2) bucket.examples.push(entry.product.officialName);
      occurrences.set(key, bucket);
    }
  }

  const describedCount = memberClaimSets.length;
  const familyLevelClaims = [];
  const variantSpecificClaims = [];
  for (const bucket of occurrences.values()) {
    // Family-level only when every described variant states it, and there is
    // more than one variant to corroborate it.
    const isFamilyLevel = describedCount > 1 && bucket.count === describedCount;
    (isFamilyLevel ? familyLevelClaims : variantSpecificClaims).push({
      field: bucket.claim.field,
      label: bucket.claim.label,
      value: bucket.claim.value,
      rawText: bucket.claim.rawText,
      sourceType: bucket.claim.sourceType,
      sourceUrl: bucket.claim.sourceUrl,
      variantsStating: bucket.count,
      ofDescribedVariants: describedCount,
      examples: bucket.examples,
    });
  }

  const singleVariantOnly = describedCount === 1;

  groupRows.push({
    productGroup: group.key,
    line: group.line,
    localVariants: group.members.length,
    matchedVariants: applied.length,
    probable: matches.filter((m) => m.confidence === "probable").length,
    unmatched: matches.filter((m) => m.confidence === "unmatched").length,
    officialFamilies,
    officialFamilyUrl: officialFamilies.length
      ? `https://cosmoslac.com/products/${officialByUrl.get(applied[0]?.officialUrl)?.category}/${officialFamilies[0]}/`
      : undefined,
    descriptionSourceUrl: representative?.sourceUrl,
    variantsWithOfficialImage: withImages,
    describedVariants: describedCount,
    // A single described variant cannot establish a family fact; its claims stay
    // variant-specific and are flagged as representative-only.
    representativeOnly: singleVariantOnly,
    familyLevelClaims: singleVariantOnly ? [] : familyLevelClaims,
    variantSpecificClaims: singleVariantOnly
      ? [...familyLevelClaims, ...variantSpecificClaims]
      : variantSpecificClaims,
    familyAnalysis: officialFamilies.length
      ? familyAnalysisByFamily.get(officialFamilies[0])
      : undefined,
  });
}

groupRows.sort((a, b) => b.localVariants - a.localVariants);

/* -- Manifest --------------------------------------------------------------- */

const brandInventory = inventory.brands.find((b) => b.brandSlug === "cosmos-lac");

const products = [];
for (const record of local) {
  const matched = matchByLocal.get(record.slug);
  const officialProduct = matched?.applied ? officialByUrl.get(matched.officialUrl) : undefined;
  const image = officialProduct ? imageBySlug.get(officialProduct.slug) : undefined;

  products.push({
    key: record.slug,
    manufacturer: "Cosmos Lac S.A.",
    brand: "Cosmos Lac",
    officialProductName: officialProduct?.officialName ?? record.officialName,
    productCode: record.cosmosCode ?? officialProduct?.productCode,
    family: record.baseProductSlug,
    manufacturerFamily: officialProduct?.family,
    category: record.primaryCategory,
    catalogStatus: "carsystem-offered",
    carsystemProductSlug: record.slug,
    matchConfidence: matched?.confidence ?? "unmatched",
    matchApplied: Boolean(matched?.applied),
    officialSourceUrl: officialProduct?.sourceUrl,
    assets: image
      ? [
          {
            kind: "primary-image",
            role: "primary-packshot",
            sourceUrl: image.imageUrl,
            localPath: image.localPath,
            bytes: image.bytes,
            sha256: image.sha256,
            width: image.width,
            height: image.height,
            accessedAt: image.accessedAt,
            published: false,
          },
        ]
      : [],
    // Official description plus every claim extracted from it. All carry
    // sourceType `manufacturer-website`, never `manufacturer-technical-document`.
    claims: officialProduct
      ? [
          ...(officialProduct.officialDescription
            ? [
                {
                  field: "officialDescription",
                  value: officialProduct.officialDescription,
                  rawText: officialProduct.officialDescription.slice(0, 200),
                  sourceType: "manufacturer-website",
                  sourceUrl: officialProduct.sourceUrl,
                  accessedAt: officialProduct.accessedAt,
                  status: "machine-extracted",
                  extractionConfidence: "high",
                  ambiguous: false,
                },
              ]
            : []),
          ...dedupeClaims(claimsBySlug.get(officialProduct.slug)?.claims ?? []),
        ]
      : [],
    documentStatus: { tds: "not-available", sds: "not-available" },
    discoveredAt: generatedAt,
    discoverySourceUrl: "https://cosmoslac.com/sitemap_index.xml",
  });
}

// Official products no local record claimed → not in our catalogue.
const candidates = match.unclaimedOfficialProducts.map((product) => ({
  key: product.sourceUrl,
  manufacturer: "Cosmos Lac S.A.",
  brand: "Cosmos Lac",
  officialProductName: product.officialName,
  productCode: product.productCode,
  manufacturerFamily: product.family,
  category: product.category,
  catalogStatus: "manufacturer-catalog-candidate",
  matchConfidence: "unmatched",
  assets: [],
  claims: [],
  discoveredAt: generatedAt,
  discoverySourceUrl: "https://cosmoslac.com/sitemap_index.xml",
}));

const manifest = {
  brandSlug: "cosmos-lac",
  brandName: "Cosmos Lac",
  manufacturer: "Cosmos Lac S.A.",
  generatedAt,
  source: {
    officialWebsite: "https://www.cosmoslac.com/",
    technicalPortal: "https://cosmoslac.com/products/",
    discoveryMethod: "Yoast sitemap (pran_products), 6 sitemap fajlova",
    acquisitionFeasibility: "product-pages",
    notes: [
      "Proizvodi nisu izloženi u WP REST API-ju; otkrivanje je išlo preko zvaničnog sitemap-a.",
      "Stranice proizvoda ne sadrže TDS ni SDS dokumente. Tehnički i aplikacioni podaci ipak postoje — u tekstu zvaničnih opisa — i izvučeni su kao manufacturer-website tvrdnje.",
      "Taksonomije product_descriptions / product_applications / product_features postoje u REST API-ju i sadrže zvanične tekstove.",
    ],
  },
  localInventory: {
    productsInCarsystemCatalogue: brandInventory?.productCount ?? local.length,
    localImages: brandInventory?.localImages ?? 0,
    localDocuments: brandInventory?.localDocuments ?? 0,
  },
  acquisition: {
    officialProductsDiscovered: catalog.products.length,
    officialFamilies: catalog.families.length,
    imagesAcquired: images.summary.downloaded,
    imagesDistinctByContent: images.summary.distinctByContent,
    documentsAcquiredThisPhase: 0,
    tdsAvailable: 0,
    sdsAvailable: 0,
    websiteClaimsExtracted: products.reduce(
      (sum, p) => sum + p.claims.filter((c) => c.field !== "officialDescription").length,
      0,
    ),
    substrateClaimsFromWebsite: products.reduce(
      (sum, p) => sum + p.claims.filter((c) => c.field === "substrates").length,
      0,
    ),
    technicalClaimsExtracted: products.reduce((sum, p) => sum + p.claims.length, 0),
    productsMatchedToCarsystemCatalogue: products.filter((p) => p.matchApplied).length,
    manufacturerCandidateProducts: candidates.length,
  },
  productGroups: groupRows,
  products: [...products, ...candidates],
};

mkdirSync("data/knowledge/brands", { recursive: true });
writeFileSync(
  "data/knowledge/brands/cosmos-lac.manifest.generated.json",
  `${JSON.stringify(manifest, null, 2)}\n`,
);

/* -- Expert package --------------------------------------------------------- */

const lines = [];
const push = (...values) => lines.push(...values);

push("# Cosmos Lac — stručni pregled proizvoda");
push("");
push(`Datum: ${generatedAt.slice(0, 10)}`);
push("");
push(
  "> **Vaš zadatak nije da proveravate SEO.** Ovo je pregled robe: proverite da li su naziv, šifra, opis i slika ispravno vezani za proizvod.",
);
push("");
push(`**Proizvođač:** Cosmos Lac S.A.  ·  **Zvanični sajt:** https://www.cosmoslac.com/`);
push("");
push("| Stavka | Broj |");
push("| --- | ---: |");
push(`| Naših proizvoda | ${local.length} |`);
push(`| Zvaničnih proizvoda pronađeno | ${catalog.products.length} |`);
push(`| Zvaničnih porodica | ${catalog.families.length} |`);
push(`| Poklopljeno pouzdano | **${manifest.acquisition.productsMatchedToCarsystemCatalogue}** |`);
push(`| Traži proveru (probable + unmatched) | **${match.summary.requiringReview}** |`);
push(`| Zvaničnih slika preuzeto | ${images.summary.downloaded} |`);
push(`| Tehničkih dokumenata pronađeno | **0** |`);
push("");
push(
  "**Važno:** Cosmos ne objavljuje tehničke listove (TDS) ni bezbednosne listove (SDS) na stranicama proizvoda. Za tehničke podatke je potreban direktan kontakt sa proizvođačem.",
);
push("");
push("Ništa od ovoga nije objavljeno na sajtu. Postojeće slike i tekstovi nisu menjani.");
push("");
push("---");
push("");

/* Section 1 — product groups */

push("## DEO 1 — GRUPE PROIZVODA");
push("");
push(
  `${groupRows.length} grupa. Za svaku je razdvojeno šta važi za celu porodicu, a šta je navedeno samo kod pojedinačne varijante.`,
);
push("");
push("**Kako čitati oznake izvora**");
push("");
push("| Oznaka | Značenje |");
push("| --- | --- |");
push("| PODACI SA SAJTA PROIZVOĐAČA | Tvrdnja iz zvaničnog opisa proizvoda. Slabiji dokaz od tehničkog lista. |");
push("| TDS | Tehnički list proizvođača. |");
push("| SDS | Bezbednosni list proizvođača. |");
push("");
push(
  "> Tvrdnje sa sajta **nisu** iz tehničkog lista i tako su i označene. Nijedna nije objavljena.",
);
push("");

const SUBSTRATE_SR = {
  metal: "metal",
  celik: "gvožđe / čelik",
  "pocinkovani-lim": "pocinkovana površina",
  aluminijum: "aluminijum",
  plastika: "plastika",
  drvo: "drvo",
  zid: "zid / malter",
  beton: "beton",
  staklo: "staklo",
  "stari-lak": "prethodno farbane površine",
  tekstil: "tekstil / vinil",
  keramika: "keramika",
  kamen: "kamen / mermer",
  papir: "papir",
  glina: "glina",
};

function renderClaimList(claims, limit = 10) {
  const out = [];
  for (const claim of claims.slice(0, limit)) {
    if (claim.field === "substrates") continue;
    const label = claim.label ?? claim.field;
    out.push(
      `- **${label}:** ${String(claim.value).slice(0, 120)}  \n  _„${claim.rawText.slice(0, 180)}"_`,
    );
  }
  return out;
}

let counter = 0;
for (const group of groupRows) {
  counter += 1;
  push(`### ${counter}. ${group.line} — ${group.localVariants} varijanti`);
  push("");
  push(`**Naša grupa:** \`${group.productGroup}\``);
  if (group.officialFamilies.length) {
    push(`**Zvanična porodica proizvođača:** ${group.officialFamilies.join(", ")}`);
  }
  push("");

  /* -- Status block -- */
  const substrateClaims = [
    ...group.familyLevelClaims,
    ...group.variantSpecificClaims,
  ].filter((claim) => claim.field === "substrates");
  const otherClaims = [
    ...group.familyLevelClaims,
    ...group.variantSpecificClaims,
  ].filter((claim) => claim.field !== "substrates");

  push("| Izvor podataka | Status |");
  push("| --- | --- |");
  push(
    `| PODACI SA SAJTA PROIZVOĐAČA | ${otherClaims.length + substrateClaims.length ? `**ima** (${otherClaims.length + substrateClaims.length} tvrdnji)` : "nema"} |`,
  );
  push(`| TDS | **nije dostupan** |`);
  push(`| SDS | **nije dostupan** |`);
  push("");

  push(
    `**POKRIVENOST POKLAPANJA:** ${group.matchedVariants}/${group.localVariants} pouzdano` +
      (group.probable ? `  ·  ${group.probable} verovatno` : "") +
      (group.unmatched ? `  ·  **${group.unmatched} nepoklopljeno**` : ""),
  );
  push(`**ZVANIČNIH SLIKA:** ${group.variantsWithOfficialImage}/${group.localVariants}`);
  push("");

  /* -- Family-level facts -- */
  push("**ZVANIČNE ČINJENICE NA NIVOU PORODICE**");
  push("");
  if (group.representativeOnly) {
    push(
      "> _Samo jedna varijanta ima opis, pa se nijedna tvrdnja ne može pripisati celoj porodici. Sve je navedeno kao specifično za varijantu._",
    );
    push("");
  } else if (group.familyLevelClaims.length) {
    push(
      `_Navedeno na svih ${group.describedVariants} opisanih varijanti._`,
    );
    push("");
    const familySubstrates = group.familyLevelClaims.filter(
      (claim) => claim.field === "substrates",
    );
    if (familySubstrates.length) {
      push(
        `- **Podloge:** ${familySubstrates.map((claim) => `${SUBSTRATE_SR[claim.value.substrate] ?? claim.value.substrate}${claim.value.suitability === "not-suitable" ? " — **NIJE dozvoljeno**" : ""}`).join(", ")}`,
      );
    }
    for (const line of renderClaimList(group.familyLevelClaims)) push(line);
    push("");
  } else {
    push("_Nijedna tvrdnja nije potvrđena na svim varijantama porodice._");
    push("");
  }

  /* -- Variant-specific -- */
  push("**ČINJENICE SPECIFIČNE ZA VARIJANTU**");
  push("");
  if (group.variantSpecificClaims.length) {
    const shown = group.variantSpecificClaims.slice(0, 8);
    for (const claim of shown) {
      const label =
        claim.field === "substrates"
          ? `Podloga: ${SUBSTRATE_SR[claim.value.substrate] ?? claim.value.substrate}${claim.value.suitability === "not-suitable" ? " — **NIJE dozvoljeno**" : ""}`
          : `${claim.label ?? claim.field}: ${String(claim.value).slice(0, 90)}`;
      push(
        `- ${label}  \n  _navodi ${claim.variantsStating}/${claim.ofDescribedVariants} varijanti, npr. ${claim.examples.join(", ")}_`,
      );
    }
    if (group.variantSpecificClaims.length > shown.length) {
      push(`- _…i još ${group.variantSpecificClaims.length - shown.length} tvrdnji_`);
    }
    push("");
  } else {
    push("_Nema._");
    push("");
  }

  /* -- Substrates -- */
  push("**PODLOGE NAVEDENE NA ZVANIČNOJ STRANICI PROIZVODA**");
  push("");
  if (substrateClaims.length) {
    push("| Podloga | Status | Navodi | Izvorna rečenica |");
    push("| --- | --- | ---: | --- |");
    for (const claim of substrateClaims.slice(0, 12)) {
      push(
        `| ${SUBSTRATE_SR[claim.value.substrate] ?? claim.value.substrate} | ${claim.value.suitability === "not-suitable" ? "**NIJE dozvoljeno**" : "navedeno kao pogodno"} | ${claim.variantsStating}/${claim.ofDescribedVariants} | _${claim.rawText.slice(0, 120)}_ |`,
      );
    }
    push("");
  } else {
    push("_Zvanični opisi ne pominju podlogu._");
    push("");
  }

  if (group.descriptionSourceUrl) {
    push(`**IZVOR:** ${group.descriptionSourceUrl}`);
    push("");
  }

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

/* Section 2 — items requiring review */

const review = match.matches.filter(
  (m) => m.confidence === "probable" || m.confidence === "unmatched",
);
const byLine = {};
for (const row of review) {
  byLine[row.localLine] = byLine[row.localLine] ?? [];
  byLine[row.localLine].push(row);
}

push("## DEO 2 — PROIZVODI KOJI TRAŽE VAŠU PROVERU");
push("");
push(`${review.length} naših proizvoda nije pouzdano poklopljeno sa zvaničnim katalogom.`);
push("");

for (const [line, rows] of Object.entries(byLine).sort((a, b) => b[1].length - a[1].length)) {
  push(`### ${line} — ${rows.length}`);
  push("");
  if (rows.every((row) => row.confidence === "unmatched")) {
    push(
      `**Nijedan od ovih ${rows.length} proizvoda nije pronađen u zvaničnom Cosmos katalogu.**`,
    );
    push("");
    if (/molotow/i.test(line)) {
      push(
        "> Molotow je zaseban nemački proizvođač, ne Cosmos Lac linija. Moguće je da su ovi proizvodi pogrešno svrstani pod Cosmos Lac u našem katalogu, ili da ih Cosmos više ne distribuira.",
      );
      push("");
      push("- [ ] Ovo jeste Cosmos proizvod");
      push("- [ ] Ovo je Molotow, treba ga voditi kao zaseban brend");
      push("- [ ] Više ne držimo ove proizvode");
      push("");
    } else {
      push("- [ ] I dalje ih držimo — proizvođač ih je povukao sa sajta");
      push("- [ ] Više ih ne držimo");
      push("");
    }
  }
  push("| Naš proizvod | Šifra | Predlog sa zvaničnog sajta | Pouzdanost |");
  push("| --- | --- | --- | --- |");
  for (const row of rows.slice(0, 40)) {
    push(
      `| ${row.localName} | ${row.localCode ?? "—"} | ${row.officialName ?? "_nije pronađen_"} | ${row.confidence} |`,
    );
  }
  if (rows.length > 40) push(`| _…i još ${rows.length - 40}_ | | | |`);
  push("");
  push("---");
  push("");
}

/* Section 3 — candidates */

push("## DEO 3 — KOD PROIZVOĐAČA, NIJE U NAŠOJ PONUDI");
push("");
push(
  `${candidates.length} zvaničnih Cosmos proizvoda nije poklopljeno ni sa jednim našim zapisom.`,
);
push("");
push("> Ovo **nije** tvrdnja da ih Carsystem prodaje. Označite one koje želite u ponudi.");
push("");
push("| Zvanični naziv | Porodica | Šifra |");
push("| --- | --- | --- |");
for (const candidate of candidates.slice(0, 60)) {
  push(
    `| ${candidate.officialProductName} | ${candidate.manufacturerFamily} | ${candidate.productCode ?? "—"} |`,
  );
}
if (candidates.length > 60) push(`| _…i još ${candidates.length - 60}_ | | |`);
push("");
push("- [ ] DODATI U CARSYSTEM PONUDU (označite pojedinačno iznad)");
push("");
push("---");
push("");

push("## ŠTA NEDOSTAJE ZA COSMOS LAC");
push("");
push(
  `- **Tehnički podaci sa sajta proizvođača:** ${websiteClaims.summary.totalClaims} tvrdnji izvučeno sa ${websiteClaims.summary.productsWithAnyClaim} stranica, od toga ${websiteClaims.summary.substrateClaims} o podlogama. Sve čeka vašu potvrdu.`,
);
push("- **TDS / tehnički listovi** — ne postoje na zvaničnom sajtu. Traži kontakt sa proizvođačem (support@cosmoslac.com).");
push("- **SDS / bezbednosni listovi** — isto.");
push("- **Podloge i tehnički parametri** — nema strukturiranih podataka na izvoru.");
push(`- **${match.summary.requiringReview} proizvoda** traži vašu potvrdu poklapanja.`);
push("");

writeFileSync("docs/seo/EXPERT_REVIEW_COSMOS_LAC.md", `${lines.join("\n")}\n`);

console.log(
  JSON.stringify(
    {
      productGroups: groupRows.length,
      localProducts: local.length,
      officialDiscovered: catalog.products.length,
      matched: manifest.acquisition.productsMatchedToCarsystemCatalogue,
      requiringReview: match.summary.requiringReview,
      candidates: candidates.length,
      imagesAcquired: images.summary.downloaded,
      documentsFound: 0,
      websiteClaims: manifest.acquisition.websiteClaimsExtracted,
      substrateClaims: manifest.acquisition.substrateClaimsFromWebsite,
      claims: manifest.acquisition.technicalClaimsExtracted,
    },
    null,
    2,
  ),
);
