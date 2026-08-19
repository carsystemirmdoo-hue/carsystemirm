#!/usr/bin/env node
/**
 * Phase 5 — consolidate everything known per brand into one manifest, and
 * produce the gap report.
 *
 * Merges three inputs that were gathered separately:
 *   - local inventory (what Carsystem already has)
 *   - verified official source profiles (where the rest lives)
 *   - acquired documents + extracted claims (what has actually been obtained)
 *
 * The gap report is the deliverable: for each brand it states what exists on
 * our site, what exists at the manufacturer, and precisely what is missing.
 *
 * Nothing here promotes a discovered product into the Carsystem catalogue.
 * Products found only at the manufacturer stay `manufacturer-catalog-candidate`
 * until a human decides otherwise.
 *
 * Output:
 *   data/knowledge/brands/{slug}.manifest.generated.json
 *   docs/seo/BRAND_GAP_REPORT.md
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";

const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
const readJsonIf = (file) => (existsSync(file) ? readJson(file) : undefined);

const inventory = readJson("docs/seo/BRAND_INVENTORY.json");

/* -- Source profiles, parsed from the TypeScript registry ------------------- */

const sourceSrc = readFileSync("data/knowledge/brand-sources.ts", "utf8");
const sourceProfiles = {};
for (const block of sourceSrc.split(/\n  "?([a-z-]+)"?: \{/).slice(1)) {
  // split() yields [key, body, key, body, ...]
  if (!sourceProfiles.__pendingKey) {
    sourceProfiles.__pendingKey = block;
    continue;
  }
  const key = sourceProfiles.__pendingKey;
  delete sourceProfiles.__pendingKey;
  const pick = (field) => block.match(new RegExp(`${field}:\\s*\\n?\\s*"([^"]+)"`))?.[1];
  const notes = [...(block.match(/notes:\s*\[([\s\S]*?)\]/)?.[1] ?? "").matchAll(/"([^"]+)"/g)].map(
    (m) => m[1],
  );
  sourceProfiles[key] = {
    officialWebsite: pick("officialWebsite"),
    technicalPortal: pick("technicalPortal"),
    tdsUrlPattern: pick("tdsUrlPattern"),
    cataloguePdf: pick("cataloguePdf"),
    acquisitionFeasibility: pick("acquisitionFeasibility"),
    verifiedAt: pick("verifiedAt"),
    notes,
  };
}
delete sourceProfiles.__pendingKey;

/* -- Acquired data ---------------------------------------------------------- */

const acquired = {
  baslac: {
    documents: readJsonIf("data/knowledge/baslac-documents.generated.json"),
    extraction: readJsonIf("data/knowledge/baslac-technical-extraction.generated.json"),
  },
  rm: {
    documents: undefined, // already in-repo before this phase
    extraction: readJsonIf("data/knowledge/rm-technical-extraction.generated.json"),
  },
};

/* -- Build manifests -------------------------------------------------------- */

const generatedAt = new Date().toISOString();
mkdirSync("data/knowledge/brands", { recursive: true });

const rows = [];

/**
 * Brands with a dedicated dossier builder own their manifest.
 *
 * The generic builder here has no notion of product groups, image manifests or
 * match confidence, so re-running it would silently flatten a richer manifest
 * back to a stub.
 */
const DEDICATED_BUILDERS = new Set(["cosmos-lac"]);

for (const brand of inventory.brands) {
  const slug = brand.brandSlug;
  const source = sourceProfiles[slug] ?? {
    acquisitionFeasibility: "no-official-source-found",
    notes: ["Izvor nije evidentiran."],
  };
  const brandAcquired = acquired[slug] ?? {};

  const products = [];

  /**
   * Decide whether a product found at the manufacturer is one Carsystem
   * actually stocks.
   *
   * This is the safety property of the whole phase: a manufacturer product is
   * NOT a Carsystem product. Matching is by product code appearing in a local
   * product slug, plus the R-M case where extraction records already carry the
   * catalogue slug directly.
   */
  const localSlugs = brand.productSlugs ?? [];
  const normalise = (value) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const localNormalised = localSlugs.map(normalise);

  function resolveCatalogStatus(record) {
    if (record.productSlug && localSlugs.includes(record.productSlug)) {
      return { status: "carsystem-offered", slug: record.productSlug };
    }
    const code = normalise(record.productCode);
    if (code.length >= 4) {
      const index = localNormalised.findIndex((slug) => slug.includes(code));
      if (index !== -1) {
        return { status: "carsystem-offered", slug: localSlugs[index] };
      }
    }
    return { status: "manufacturer-catalog-candidate", slug: undefined };
  }

  // Products discovered at the manufacturer during this phase.
  if (brandAcquired.extraction?.records) {
    for (const record of brandAcquired.extraction.records) {
      const resolved = resolveCatalogStatus(record);
      products.push({
        key: record.productCode ?? record.officialProductName,
        manufacturer: brandAcquired.extraction.summary.manufacturer,
        brand: brand.brandName,
        officialProductName: record.officialProductName,
        productCode: record.productCode,
        variants: [],
        catalogStatus: resolved.status,
        carsystemProductSlug: resolved.slug,
        // R-M records carry `documentHref` (already in-repo before this phase);
        // baslac records carry `documentLocalPath` from acquisition.
        assets: (() => {
          const localPath = record.documentLocalPath ?? record.documentHref;
          if (!localPath) return [];
          return [
            {
              kind: "tds",
              sourceUrl: record.documentSourceUrl ?? record.documentHref,
              localPath,
              accessedAt: brandAcquired.documents?.summary?.generatedAt ?? generatedAt,
              version: record.documentVersion ?? record.revision,
            },
          ];
        })(),
        claims: record.claims ?? [],
        discoveredAt: generatedAt,
        discoverySourceUrl: source.technicalPortal ?? source.officialWebsite ?? "",
      });
    }
  }

  const claimCount = products.reduce((sum, product) => sum + product.claims.length, 0);
  const offered = products.filter((product) => product.catalogStatus === "carsystem-offered");
  const candidates = products.filter(
    (product) => product.catalogStatus === "manufacturer-catalog-candidate",
  );
  // Total acquired for this brand, not just newly downloaded on the last run —
  // a re-run that reuses files on disk must not report the corpus as empty.
  const docsAcquired = brandAcquired.documents?.documents?.filter((doc) => !doc.error).length ?? 0;

  if (DEDICATED_BUILDERS.has(slug)) {
    const existing = readJsonIf(`data/knowledge/brands/${slug}.manifest.generated.json`);
    if (existing) {
      rows.push({
        slug,
        name: brand.brandName,
        status: brand.status,
        onOurSite: brand.productCount,
        localImages: brand.localImages,
        localDocs: brand.localDocuments,
        feasibility: existing.source?.acquisitionFeasibility ?? source.acquisitionFeasibility,
        officialSource: existing.source?.officialWebsite ?? source.officialWebsite ?? null,
        docsAcquired: existing.acquisition?.documentsAcquiredThisPhase ?? 0,
        claims: existing.acquisition?.technicalClaimsExtracted ?? 0,
        matched: existing.acquisition?.productsMatchedToCarsystemCatalogue ?? 0,
        candidates: existing.acquisition?.manufacturerCandidateProducts ?? 0,
        imagesAcquired: existing.acquisition?.imagesAcquired ?? 0,
      });
      continue;
    }
  }

  const manifest = {
    brandSlug: slug,
    brandName: brand.brandName,
    manufacturer:
      brandAcquired.extraction?.summary?.manufacturer ?? "nije utvrđen",
    generatedAt,
    source,
    localInventory: {
      productsInCarsystemCatalogue: brand.productCount,
      localImages: brand.localImages,
      localDocuments: brand.localDocuments,
    },
    acquisition: {
      documentsAcquiredThisPhase: docsAcquired,
      technicalClaimsExtracted: claimCount,
      productsMatchedToCarsystemCatalogue: offered.length,
      manufacturerCandidateProducts: candidates.length,
    },
    families: [],
    products,
  };

  writeFileSync(
    `data/knowledge/brands/${slug}.manifest.generated.json`,
    `${JSON.stringify(manifest, null, 2)}\n`,
  );

  rows.push({
    slug,
    name: brand.brandName,
    status: brand.status,
    onOurSite: brand.productCount,
    localImages: brand.localImages,
    localDocs: brand.localDocuments,
    feasibility: source.acquisitionFeasibility,
    officialSource: source.officialWebsite ?? source.technicalPortal ?? null,
    docsAcquired,
    claims: claimCount,
    matched: offered.length,
    candidates: candidates.length,
    imagesAcquired: 0,
  });
}

/* -- Gap report ------------------------------------------------------------- */

const lines = [];
lines.push("# Carsystem — GAP report po brendu");
lines.push("");
lines.push(`Datum: ${generatedAt.slice(0, 10)}`);
lines.push("");
lines.push(
  "Šta imamo, šta postoji kod proizvođača i šta konkretno nedostaje. Ništa pronađeno kod proizvođača nije dodato u katalog — sve stoji kao kandidat dok Carsystem ne potvrdi.",
);
lines.push("");

lines.push("## Zbirno stanje");
lines.push("");
lines.push(
  "| Brend | Na sajtu | Slika | Dok. | Zvanični izvor | Izvodljivost | Prikupljeno | Tvrdnji | Poklopljeno | Kandidata |",
);
lines.push("| --- | ---: | ---: | ---: | --- | --- | ---: | ---: | ---: | ---: |");
const FEASIBILITY_LABEL = {
  "structured-portal": "strukturiran portal",
  "product-pages": "stranice proizvoda",
  "catalogue-pdf-only": "samo katalog PDF",
  "brochure-only": "samo brošura",
  "no-official-source-found": "**izvor nije nađen**",
};
for (const row of rows.sort((a, b) => b.onOurSite - a.onOurSite)) {
  lines.push(
    `| **${row.name}** | ${row.onOurSite} | ${row.localImages} | ${row.localDocs} | ${row.officialSource ? `[link](${row.officialSource})` : "—"} | ${FEASIBILITY_LABEL[row.feasibility] ?? row.feasibility} | ${row.docsAcquired} | ${row.claims} | ${row.matched} | ${row.candidates} |`,
  );
}
lines.push("");

lines.push("## Rupe po brendu");
lines.push("");
for (const row of rows) {
  const source = sourceProfiles[row.slug] ?? {};
  lines.push(`### ${row.name}`);
  lines.push("");
  lines.push("| Stavka | Stanje |");
  lines.push("| --- | --- |");
  lines.push(`| Na našem sajtu | ${row.onOurSite} proizvoda |`);
  lines.push(
    `| Postoji kod proizvođača | ${
      row.feasibility === "no-official-source-found"
        ? "**nije utvrđeno — zvanični izvor nije pronađen**"
        : row.docsAcquired
          ? `${row.docsAcquired} dokumenata prikupljeno iz zvaničnog indeksa`
          : "izvor potvrđen, portfolio još nije popisan"
    } |`,
  );
  lines.push(
    `| Nedostaje slika | ${Math.max(0, row.onOurSite - row.localImages)} (${row.localImages} od ${row.onOurSite}) |`,
  );
  lines.push(
    `| Nedostaje TDS | ${row.localDocs === 0 && row.onOurSite > 0 ? "**svi — nema nijedan tehnički dokument**" : `${row.localDocs} dokumenata lokalno`} |`,
  );
  lines.push(`| Nedostaje SDS | **da — nijedan SDS nije prikupljen ni za jedan brend** |`);
  lines.push(
    `| Tehnički podaci pronađeni | ${row.claims ? `${row.claims} tvrdnji` : "0"} |`,
  );
  lines.push(
    `| Zahteva proveru | ${row.claims ? `svih ${row.claims} (machine-extracted)` : "—"} |`,
  );
  lines.push("");
  if (source.notes?.length) {
    lines.push("**Napomene o izvoru**");
    lines.push("");
    for (const note of source.notes) lines.push(`- ${note}`);
    lines.push("");
  }
}

const totals = {
  brands: rows.length,
  onSite: rows.reduce((sum, row) => sum + row.onOurSite, 0),
  docsAcquired: rows.reduce((sum, row) => sum + row.docsAcquired, 0),
  claims: rows.reduce((sum, row) => sum + row.claims, 0),
  images: rows.reduce((sum, row) => sum + (row.imagesAcquired ?? 0), 0),
  matched: rows.reduce((sum, row) => sum + row.matched, 0),
  candidates: rows.reduce((sum, row) => sum + row.candidates, 0),
  brandsWithoutSource: rows.filter(
    (row) => row.feasibility === "no-official-source-found",
  ).length,
  brandsWithoutDocs: rows.filter((row) => row.localDocs === 0 && row.onOurSite > 0).length,
};

lines.push("## Ukupno");
lines.push("");
lines.push("| Metrika | Vrednost |");
lines.push("| --- | ---: |");
lines.push(`| Brendova | ${totals.brands} |`);
lines.push(`| Proizvoda na sajtu | ${totals.onSite} |`);
lines.push(`| Dokumenata prikupljeno ove faze | **${totals.docsAcquired}** |`);
lines.push(`| Slika prikupljeno ove faze | **${totals.images}** |`);
lines.push(`| Tehničkih tvrdnji za pregled | **${totals.claims}** |`);
lines.push(`| Poklopljeno sa Carsystem katalogom | ${totals.matched} |`);
lines.push(
  `| **Kandidata kod proizvođača (NISU u ponudi)** | **${totals.candidates}** |`,
);
lines.push(`| Brendova bez pronađenog zvaničnog izvora | ${totals.brandsWithoutSource} |`);
lines.push(`| Brendova bez ijednog tehničkog dokumenta | ${totals.brandsWithoutDocs} |`);
lines.push("");

writeFileSync("docs/seo/BRAND_GAP_REPORT.md", `${lines.join("\n")}\n`);

console.log(JSON.stringify(totals, null, 2));
