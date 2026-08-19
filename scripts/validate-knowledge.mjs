#!/usr/bin/env node
/**
 * Validates the knowledge layer and the ProductGroup consolidation against the
 * *built* output, not against the source.
 *
 * Source-level checks pass trivially; what matters is what a crawler receives.
 * This reads `.next/server/app/**.html` plus the generated sitemap and asserts
 * the invariants the Phase 2 design depends on:
 *
 *   1. Every consolidated variant canonicalises to its family page.
 *   2. No consolidated variant appears in the sitemap.
 *   3. Every family page is self-canonical and carries ProductGroup schema.
 *   4. No unpublished guide produced a URL.
 *   5. Every emitted JSON-LD block is parseable.
 *
 * Exits non-zero on any failure so it can gate a deploy.
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";

const APP_DIR = ".next/server/app";
const failures = [];
const notes = [];

function fail(message) {
  failures.push(message);
}

function readHtml(routePath) {
  const file = path.join(APP_DIR, `${routePath}.html`);
  return existsSync(file) ? readFileSync(file, "utf8") : undefined;
}

function canonicalOf(html) {
  return html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
}

function robotsOf(html) {
  return html.match(/<meta name="robots" content="([^"]+)"/)?.[1];
}

function jsonLdBlocks(html, label) {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map((match) => {
      try {
        return JSON.parse(match[1]);
      } catch {
        fail(`${label}: neispravan JSON-LD blok`);
        return undefined;
      }
    })
    .filter(Boolean);
}

function typesOf(node) {
  if (Array.isArray(node["@graph"])) return node["@graph"].map((item) => item["@type"]);
  return [node["@type"]];
}

/* -------------------------------------------------------------------------- */

if (!existsSync(APP_DIR)) {
  console.error("Nema build izlaza. Pokrenite `npm run build` pre validacije.");
  process.exit(1);
}

// -- Discover families from the built family pages ---------------------------
const familyDir = path.join(APP_DIR, "proizvodi/grupa");
if (!existsSync(familyDir)) {
  fail("Ruta /proizvodi/grupa nije generisana.");
}

const familySlugs = existsSync(familyDir)
  ? readdirSync(familyDir)
      .filter((file) => file.endsWith(".html"))
      .map((file) => file.replace(/\.html$/, ""))
  : [];

notes.push(`Generisano ${familySlugs.length} stranica grupa proizvoda.`);

// -- Sitemap -----------------------------------------------------------------
const sitemapFile = path.join(APP_DIR, "sitemap.xml.body");
let sitemapUrls = [];
if (existsSync(sitemapFile)) {
  sitemapUrls = [...readFileSync(sitemapFile, "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)].map(
    (match) => match[1],
  );
} else {
  fail("sitemap.xml.body nije pronađen u build izlazu.");
}
const sitemapSet = new Set(sitemapUrls);
notes.push(`Sitemap sadrži ${sitemapUrls.length} URL-ova.`);

// -- 3. Family pages ---------------------------------------------------------
let familyGroupSchema = 0;
for (const slug of familySlugs) {
  const label = `/proizvodi/grupa/${slug}`;
  const html = readHtml(`proizvodi/grupa/${slug}`);
  if (!html) {
    fail(`${label}: nema HTML izlaza`);
    continue;
  }

  const canonical = canonicalOf(html);
  if (!canonical?.endsWith(label)) {
    fail(`${label}: canonical nije self-referencing (${canonical})`);
  }
  if (!sitemapSet.has(canonical)) {
    fail(`${label}: nije u sitemapu`);
  }

  const blocks = jsonLdBlocks(html, label);
  const hasGroup = blocks.some((node) => typesOf(node).includes("ProductGroup"));
  if (hasGroup) familyGroupSchema += 1;
  else fail(`${label}: nedostaje ProductGroup schema`);

  const groupNode = blocks.find((node) => node["@type"] === "ProductGroup");
  if (groupNode && !groupNode.hasVariant?.length) {
    fail(`${label}: ProductGroup nema hasVariant`);
  }
  if (groupNode?.offers) {
    fail(`${label}: ProductGroup ne sme sadržati offers bez potvrđene cene`);
  }
}
notes.push(`ProductGroup schema prisutna na ${familyGroupSchema}/${familySlugs.length} stranica grupa.`);

// -- 1 & 2. Variant consolidation -------------------------------------------
const productDir = path.join(APP_DIR, "proizvodi");
const productSlugs = readdirSync(productDir)
  .filter((file) => file.endsWith(".html"))
  .map((file) => file.replace(/\.html$/, ""));

let consolidated = 0;
let selfCanonical = 0;
let contradictoryNoindex = 0;
let variantIsVariantOf = 0;

for (const slug of productSlugs) {
  const html = readHtml(`proizvodi/${slug}`);
  if (!html) continue;
  const label = `/proizvodi/${slug}`;
  const canonical = canonicalOf(html);
  if (!canonical) {
    fail(`${label}: nema canonical`);
    continue;
  }

  const isConsolidated = /\/proizvodi\/grupa\//.test(canonical);
  if (isConsolidated) {
    consolidated += 1;

    // 2. must not be in the sitemap
    if (sitemapSet.has(`https://carsystemirm.com${label}`)) {
      fail(`${label}: konsolidovana varijanta je i dalje u sitemapu`);
    }

    // A cross-canonical combined with noindex is a contradictory signal.
    const robots = robotsOf(html) ?? "";
    if (robots.includes("noindex")) {
      contradictoryNoindex += 1;
      fail(`${label}: noindex uz cross-canonical je kontradiktoran signal`);
    }

    const blocks = jsonLdBlocks(html, label);
    const product = blocks.find((node) => node["@type"] === "Product" && node.name);
    if (product?.isVariantOf) variantIsVariantOf += 1;
    else fail(`${label}: Product schema nema isVariantOf`);
  } else {
    selfCanonical += 1;
    if (canonical !== `https://carsystemirm.com${label}`) {
      fail(`${label}: canonical ne pokazuje na sebe niti na grupu (${canonical})`);
    }
  }
}

notes.push(
  `Proizvodi: ${productSlugs.length} ukupno, ${consolidated} konsolidovano na grupe, ${selfCanonical} samostalnih.`,
);
notes.push(`isVariantOf prisutan na ${variantIsVariantOf}/${consolidated} varijanti.`);
if (!contradictoryNoindex) {
  notes.push("Nijedna konsolidovana varijanta nema kontradiktoran noindex.");
}

// -- 4. Guides ---------------------------------------------------------------
const guideDir = path.join(APP_DIR, "vodici");
const guidePages = existsSync(guideDir)
  ? readdirSync(guideDir).filter((file) => file.endsWith(".html"))
  : [];
notes.push(`Generisano ${guidePages.length} stranica vodiča (očekivano: samo objavljeni).`);

const guideIndex = readHtml("vodici");
if (guideIndex) {
  const robots = robotsOf(guideIndex) ?? "";
  const publishedGuideLinks = [...guideIndex.matchAll(/href="\/vodici\/([^"#?]+)"/g)];
  if (!publishedGuideLinks.length && !robots.includes("noindex")) {
    fail("/vodici: prazan indeks vodiča mora biti noindex");
  }
  if (!publishedGuideLinks.length && sitemapSet.has("https://carsystemirm.com/vodici")) {
    fail("/vodici: prazan indeks ne sme biti u sitemapu");
  }
}

/* -------------------------------------------------------------------------- */
/* Phase 3 safeguard — machine-extracted data must not be publicly visible    */
/* -------------------------------------------------------------------------- */

// The whole Phase 3 design rests on one guarantee: a value a script read out of
// a PDF cannot reach a page. This asserts it against the *built HTML*, not
// against the types, because only the built output proves what a crawler sees.

/**
 * Every acquired brand dataset must be non-publishable, not just R-M.
 * Phase 5 added baslac; this list grows as brands are acquired.
 */
const ACQUIRED_DATASETS = [
  "data/knowledge/rm-technical-extraction.generated.json",
  "data/knowledge/baslac-technical-extraction.generated.json",
];

/**
 * Brand manifests carry acquired claims too (Cosmos supplies official
 * descriptions rather than TDS values). They must be equally unpublishable.
 */
const BRAND_MANIFESTS = [
  "data/knowledge/brands/cosmos-lac.manifest.generated.json",
  "data/knowledge/brands/carsystem.manifest.generated.json",
];

/* -- Cosmos quality-pass invariants ---------------------------------------- */

const cosmosMatchPath = "data/knowledge/cosmos-match.generated.json";
if (existsSync(cosmosMatchPath)) {
  const cosmosMatch = JSON.parse(readFileSync(cosmosMatchPath, "utf8"));

  // 1. An unmatched local product must not shadow a manufacturer candidate that
  //    shares its code — that pairing is a match the matcher failed to make.
  if (cosmosMatch.summary.invariantViolations > 0) {
    fail(
      `Cosmos: ${cosmosMatch.summary.invariantViolations} nepoklopljenih lokalnih proizvoda deli šifru sa kandidatom kod proizvođača.`,
    );
  }
  notes.push(
    `Cosmos poklapanje: ${cosmosMatch.summary.applied} primenjeno, ${cosmosMatch.summary.requiringReview} za pregled, ${cosmosMatch.summary.invariantViolations} narušenih invarijanti.`,
  );

  // 2. Manufacturer code/name disagreements must be recorded, not corrected.
  const unrecorded = (cosmosMatch.codeNameDiscrepancies ?? []).filter(
    (entry) => !entry.classification,
  );
  if (unrecorded.length) {
    fail(`Cosmos: ${unrecorded.length} neklasifikovanih neslaganja šifre i naziva.`);
  }
  notes.push(
    `Cosmos: ${(cosmosMatch.codeNameDiscrepancies ?? []).length} neslaganja šifre/naziva kod proizvođača, sva klasifikovana.`,
  );
}

const cosmosClaimsPath = "data/knowledge/cosmos-website-claims.generated.json";
if (existsSync(cosmosClaimsPath)) {
  const cosmosClaims = JSON.parse(readFileSync(cosmosClaimsPath, "utf8"));
  const allWebsiteClaims = cosmosClaims.records.flatMap((record) => record.claims);

  // 3. A website claim must never be labelled as coming from a technical document.
  const mislabelled = allWebsiteClaims.filter(
    (claim) => claim.sourceType !== "manufacturer-website",
  );
  if (mislabelled.length) {
    fail(
      `Cosmos: ${mislabelled.length} tvrdnji sa sajta nema sourceType manufacturer-website.`,
    );
  }

  // 4. Nothing extracted may be publishable.
  const publishable = allWebsiteClaims.filter(
    (claim) => claim.status !== "machine-extracted",
  );
  if (publishable.length) {
    fail(`Cosmos: ${publishable.length} tvrdnji sa sajta nije machine-extracted.`);
  }

  notes.push(
    `Cosmos sajt-tvrdnje: ${allWebsiteClaims.length}, sve manufacturer-website i machine-extracted.`,
  );
}

/* -- Carsystem invariants --------------------------------------------------- */

const carsystemMatchPath = "data/knowledge/carsystem-match.generated.json";
if (existsSync(carsystemMatchPath)) {
  const carsystemMatch = JSON.parse(readFileSync(carsystemMatchPath, "utf8"));

  // An unmatched local product must not shadow a manufacturer candidate that
  // shares its article number or code.
  if (carsystemMatch.summary.invariantViolations > 0) {
    fail(
      `Carsystem: ${carsystemMatch.summary.invariantViolations} nepoklopljenih lokalnih proizvoda deli šifru sa kandidatom.`,
    );
  }
  notes.push(
    `Carsystem poklapanje: ${carsystemMatch.summary.applied} primenjeno, ${carsystemMatch.summary.ambiguous} višeznačnih, ${carsystemMatch.summary.invariantViolations} narušenih invarijanti.`,
  );
}

const carsystemClaimsPath = "data/knowledge/carsystem-website-claims.generated.json";
if (existsSync(carsystemClaimsPath)) {
  const carsystemClaims = JSON.parse(readFileSync(carsystemClaimsPath, "utf8"));
  const all = carsystemClaims.records.flatMap((record) => record.claims);

  const mislabelled = all.filter((claim) => claim.sourceType !== "manufacturer-website");
  if (mislabelled.length) {
    fail(`Carsystem: ${mislabelled.length} tvrdnji sa sajta nema sourceType manufacturer-website.`);
  }
  const publishable = all.filter((claim) => claim.status !== "machine-extracted");
  if (publishable.length) {
    fail(`Carsystem: ${publishable.length} tvrdnji nije machine-extracted.`);
  }
  // Every claim must carry provenance.
  const withoutProvenance = all.filter((claim) => !claim.sourceUrl || !claim.rawText);
  if (withoutProvenance.length) {
    fail(`Carsystem: ${withoutProvenance.length} tvrdnji bez izvora ili izvorne rečenice.`);
  }
  // Negative substrate claims must keep their polarity.
  const negatives = all.filter(
    (claim) => claim.field === "substrates" && claim.value?.suitability === "not-suitable",
  );
  const brokenPolarity = negatives.filter((claim) => !/nicht|kein|ungeeignet|außer|vermeiden/i.test(claim.rawText));
  if (brokenPolarity.length) {
    fail(`Carsystem: ${brokenPolarity.length} negativnih tvrdnji bez negacije u izvornoj rečenici.`);
  }

  // Relationships must be manufacturer-stated, never inferred.
  const inferred = carsystemClaims.records
    .flatMap((record) => record.relationships)
    .filter((relation) => relation.inferred === true);
  if (inferred.length) {
    fail(`Carsystem: ${inferred.length} izvedenih veza — dozvoljene su samo eksplicitne.`);
  }

  notes.push(
    `Carsystem sajt-tvrdnje: ${all.length}, sve manufacturer-website, ${negatives.length} negativnih sa očuvanim polaritetom.`,
  );
}

/* -- Carsystem leak safeguard ---------------------------------------------- */

const carsystemClaimsFile = "data/knowledge/carsystem-website-claims.generated.json";
if (existsSync(carsystemClaimsFile)) {
  const parsed = JSON.parse(readFileSync(carsystemClaimsFile, "utf8"));

  /**
   * Distinctive German source phrases. None of these exist anywhere in this
   * Serbian-language site, so an occurrence is unambiguously a leak from the
   * Carsystem acquisition rather than a coincidence.
   */
  const probes = new Set([
    "Technisches Merkblatt",
    "Sicherheitsdatenblatt",
    "EINSATZGEBIET",
    "Folienschleifmittel",
    "Temperaturbeständigkeit",
    "Überlackierbar mit",
  ]);
  for (const record of parsed.records) {
    for (const claim of record.claims) {
      // Long verbatim German sentences from the manufacturer's page.
      if (typeof claim.rawText === "string" && claim.rawText.length >= 45) {
        probes.add(claim.rawText.slice(0, 45));
      }
    }
  }

  /**
   * Phase 2 added a second, higher-risk body of text: verbatim excerpts lifted
   * out of technical data sheets. Those are precisely the sentences that must
   * never reach a page before an expert signs them off, so they are probed too.
   */
  const tdsClaimsFile = "data/knowledge/carsystem-tds-claims.generated.json";
  if (existsSync(tdsClaimsFile)) {
    const tdsParsed = JSON.parse(readFileSync(tdsClaimsFile, "utf8"));
    for (const record of tdsParsed.records) {
      for (const claim of record.claims) {
        if (typeof claim.excerpt === "string" && claim.excerpt.length >= 45) {
          probes.add(claim.excerpt.slice(0, 45));
        }
      }
    }
  }

  const pages = readdirSync(path.join(APP_DIR, "proizvodi")).filter((file) =>
    file.endsWith(".html"),
  );
  let leaks = 0;
  for (const file of pages) {
    const html = readFileSync(path.join(APP_DIR, "proizvodi", file), "utf8");
    for (const probe of probes) {
      if (html.includes(probe)) {
        leaks += 1;
        fail(
          `SIGURNOSNI PROPUST: Carsystem podatak "${probe.slice(0, 50)}" vidljiv na /proizvodi/${file.replace(/\.html$/, "")}`,
        );
      }
    }
  }
  notes.push(
    `Carsystem provera curenja: ${probes.size} markera × ${pages.length} stranica; propusta: ${leaks}.`,
  );
}

/* -- Carsystem Phase 2: TDS knowledge invariants ---------------------------- */

const carsystemTdsPath = "data/knowledge/carsystem-tds-claims.generated.json";
const carsystemInventoryPath = "data/knowledge/carsystem-tds-inventory.generated.json";

if (existsSync(carsystemTdsPath)) {
  const tdsParsed = JSON.parse(readFileSync(carsystemTdsPath, "utf8"));
  const claims = tdsParsed.records.flatMap((record) =>
    record.claims.map((claim) => ({ claim, record })),
  );

  // 1. Every TDS claim must be traceable to a file, a page and a verbatim
  //    excerpt. A value without a page cannot be checked by the expert.
  const withoutProvenance = claims.filter(
    ({ claim, record }) =>
      !record.documentFileName ||
      !record.documentSha256 ||
      typeof claim.page !== "number" ||
      !claim.excerpt,
  );
  if (withoutProvenance.length) {
    fail(
      `Carsystem TDS: ${withoutProvenance.length} tvrdnji bez pune provenijencije (fajl + sha256 + strana + citat).`,
    );
  }

  // 2. Nothing extracted by machine may claim expert status. `expert-verified`
  //    is the only status `publishedValue()` will release, so a TDS claim must
  //    never carry it before a human has signed it off.
  const overclaimed = claims.filter(
    ({ claim }) =>
      claim.status !== "machine-extracted" ||
      claim.sourceType !== "manufacturer-technical-document",
  );
  if (overclaimed.length) {
    fail(
      `Carsystem TDS: ${overclaimed.length} tvrdnji nije manufacturer-technical-document/machine-extracted.`,
    );
  }

  // 3. Polarity must survive extraction. A negative claim whose excerpt shows
  //    no negation is the failure mode that turns "not suitable for PE/PP" into
  //    a recommendation.
  const NEGATION =
    /\b(nicht|kein|keine|keinen|ungeeignet|nur für|frei von|vermeiden|vermieden|ohne|unverträglich)\b/i;
  const brokenPolarity = claims.filter(
    ({ claim }) => claim.negative === true && !NEGATION.test(claim.excerpt ?? ""),
  );
  if (brokenPolarity.length) {
    fail(
      `Carsystem TDS: ${brokenPolarity.length} negativnih tvrdnji bez negacije u citatu — polaritet izgubljen.`,
    );
  }

  // 4. A stated condition must still be present in the excerpt it came from;
  //    "80 °C" without "30 minuta" is a different instruction.
  const orphanedCondition = claims.filter(
    ({ claim }) =>
      claim.condition && !(claim.excerpt ?? "").toLowerCase().includes(
        String(claim.condition).toLowerCase().slice(0, 12),
      ),
  );
  if (orphanedCondition.length) {
    fail(`Carsystem TDS: ${orphanedCondition.length} uslova nema uporište u citatu.`);
  }

  // 5. Ranges and units must not be collapsed to a bare number.
  const collapsedRange = claims.filter(
    ({ claim }) => claim.range && !/[–—-]|\bbis\b|\bdo\b/i.test(String(claim.value)),
  );
  if (collapsedRange.length) {
    fail(`Carsystem TDS: ${collapsedRange.length} opsega svedeno na jednu vrednost.`);
  }

  /**
   * 6. SDS is a separate document class. Hazard text must not have entered the
   *    technical claim set under any field.
   *
   *    A bare `P\d{3}` cannot be the test: in an abrasives catalogue `P180`,
   *    `P320` and `P2000` are ISO grit designations, not GHS precautionary
   *    statements, and matching them flags the grit field of every sanding
   *    sheet. A GHS P-code only counts when hazard framing accompanies it.
   */
  const HAZARD_VOCABULARY = /\bH\d{3}\b|Gefahrenhinweis|Signalwort|GHS\d{2}|Sicherheitsdatenblatt/;
  const hazardLeak = claims.filter(({ claim }) => {
    const text = `${claim.excerpt ?? ""} ${String(claim.value ?? "")}`;
    return HAZARD_VOCABULARY.test(text) || (/\bP\d{3}\b/.test(text) && /Gefahr|Sicherheit|Warnung/i.test(text));
  });
  if (hazardLeak.length) {
    fail(
      `Carsystem TDS: ${hazardLeak.length} tvrdnji sadrži tekst opasnosti (SDS) — SDS mora ostati zasebna klasa.`,
    );
  }

  notes.push(
    `Carsystem TDS-tvrdnje: ${claims.length}, sve machine-extracted, ${
      claims.filter(({ claim }) => claim.negative).length
    } negativnih, ${claims.filter(({ claim }) => claim.condition).length} sa uslovom.`,
  );
}

if (existsSync(carsystemInventoryPath)) {
  const inventoryParsed = JSON.parse(readFileSync(carsystemInventoryPath, "utf8"));

  // 7. Files are not specifications. The inventory must have deduplicated by
  //    content hash and kept the many-to-many relation intact.
  if (inventoryParsed.summary.distinctDocuments > inventoryParsed.summary.tdsFiles) {
    fail("Carsystem TDS inventar: više jedinstvenih dokumenata nego fajlova — deduplikacija je pogrešna.");
  }
  const unlinked = inventoryParsed.records.filter((record) => record.productCount === 0);
  if (unlinked.length) {
    fail(`Carsystem TDS inventar: ${unlinked.length} dokumenata nije vezano ni za jedan proizvod.`);
  }
  if (inventoryParsed.summary.unreadable > 0) {
    // Not a failure — an unreadable PDF is a declared gap, not a silent zero.
    notes.push(
      `Carsystem TDS inventar: ${inventoryParsed.summary.unreadable} nečitljivih dokumenata prijavljeno kao praznina.`,
    );
  }
  notes.push(
    `Carsystem TDS inventar: ${inventoryParsed.summary.tdsFiles} fajlova → ${inventoryParsed.summary.distinctDocuments} jedinstvenih, ${inventoryParsed.summary.articleNumbersCovered} brojeva artikala.`,
  );
}

const carsystemCrosscheckPath = "data/knowledge/carsystem-source-crosscheck.generated.json";
if (existsSync(carsystemCrosscheckPath)) {
  const crosscheckParsed = JSON.parse(readFileSync(carsystemCrosscheckPath, "utf8"));

  // 8. No disagreement may be resolved by the machine.
  if (crosscheckParsed.summary.autoResolved !== 0) {
    fail("Carsystem unakrsna provera: neslaganje je automatski razrešeno — mora ići ekspertu.");
  }
  // 9. Both sides of a conflict must be preserved.
  const oneSided = (crosscheckParsed.comparisons ?? []).filter(
    (entry) =>
      entry.classification === "VALUE_CONFLICT" &&
      (entry.websiteValue === undefined || entry.tdsValue === undefined),
  );
  if (oneSided.length) {
    fail(`Carsystem unakrsna provera: ${oneSided.length} konflikata čuva samo jednu stranu.`);
  }
  notes.push(
    `Carsystem unakrsna provera: ${crosscheckParsed.summary.comparisons} poređenja, ${crosscheckParsed.summary.conflicts} konflikata, 0 automatski razrešenih.`,
  );
}

const carsystemAeoPath = "data/knowledge/carsystem-aeo-readiness.generated.json";
if (existsSync(carsystemAeoPath)) {
  const aeo = JSON.parse(readFileSync(carsystemAeoPath, "utf8"));

  // 10. Until an expert signs off, nothing about Carsystem is publishable.
  if (aeo.EXPERT_VERIFIED !== 0 || aeo.PUBLISHABLE !== 0) {
    fail("Carsystem AEO: postoji EXPERT_VERIFIED ili PUBLISHABLE namera pre stručne provere.");
  }
  if (!aeo.intents?.length) {
    fail("Carsystem AEO: nijedna namera nije klasifikovana.");
  }
  notes.push(
    `Carsystem AEO spremnost: ${aeo.EVIDENCE_AVAILABLE_NEEDS_REVIEW} namera čeka proveru, ${aeo.NO_EVIDENCE} bez dokaza, 0 objavljivih.`,
  );
}

/* -- C.A.R.FIT invariants --------------------------------------------------- */

const carfitCatalogPath = "data/knowledge/carfit-catalog.generated.json";
if (existsSync(carfitCatalogPath)) {
  const carfitCatalog = JSON.parse(readFileSync(carfitCatalogPath, "utf8"));

  // 1. Nothing discovered at manufacturer level may assert that we sell it.
  const overclaimedStatus = carfitCatalog.products.filter(
    (product) => product.catalogStatus !== "manufacturer-catalog-candidate" || product.published !== false,
  );
  if (overclaimedStatus.length) {
    fail(`C.A.R.FIT: ${overclaimedStatus.length} proizvoda nije manufacturer-catalog-candidate / neobjavljen.`);
  }

  // 2. A page listing several article numbers is a family page. If it were
  //    marked as a single variant, its values would silently narrow to one SKU.
  const misScoped = carfitCatalog.products.filter(
    (product) => product.variants.length > 1 && !product.isFamily,
  );
  if (misScoped.length) {
    fail(`C.A.R.FIT: ${misScoped.length} viševarijantnih stranica nije označeno kao porodica.`);
  }

  notes.push(
    `C.A.R.FIT katalog: ${carfitCatalog.summary.products} proizvoda, ${carfitCatalog.summary.articleNumbers} artikala, ${carfitCatalog.summary.families} porodica, svi kandidati.`,
  );
}

const carfitWebsitePath = "data/knowledge/carfit-website-claims.generated.json";
if (existsSync(carfitWebsitePath)) {
  const carfitWebsite = JSON.parse(readFileSync(carfitWebsitePath, "utf8"));
  const claims = carfitWebsite.records.flatMap((record) => record.claims);

  const mislabelled = claims.filter(
    (claim) => claim.sourceType !== "manufacturer-website" || claim.status !== "machine-extracted",
  );
  if (mislabelled.length) {
    fail(`C.A.R.FIT: ${mislabelled.length} sajt-tvrdnji nije manufacturer-website / machine-extracted.`);
  }

  const withoutProvenance = claims.filter((claim) => !claim.sourceUrl || !claim.rawText || !claim.section);
  if (withoutProvenance.length) {
    fail(`C.A.R.FIT: ${withoutProvenance.length} sajt-tvrdnji bez izvora, sekcije ili izvornog teksta.`);
  }

  /**
   * The polarity trap that matters most here. "kein Verstopfen" is a benefit
   * phrased as a negation, not a prohibition — if a grammatical negation were
   * promoted to a restriction, the review package would invent bans the
   * manufacturer never stated.
   */
  const inventedRestrictions = claims.filter(
    (claim) =>
      claim.restriction &&
      // A compatibility row states its prohibition as a plain "Nein" — the
      // polarity lives in the answer, not in a negating verb phrase.
      claim.compatible !== false &&
      !/\b(nicht geeignet|nicht für|nicht auf|ungeeignet|not suitable|do not|never|nein|no)\b/i.test(
        claim.rawText ?? "",
      ),
  );
  if (inventedRestrictions.length) {
    fail(`C.A.R.FIT: ${inventedRestrictions.length} ograničenja nema uporište u izvornom tekstu.`);
  }

  // A family-scoped claim must carry more than one article number, otherwise
  // the scope label is meaningless.
  const brokenScope = claims.filter(
    (claim) => String(claim.scope).startsWith("family") && (claim.appliesToArticleNumbers ?? []).length < 2,
  );
  if (brokenScope.length) {
    fail(`C.A.R.FIT: ${brokenScope.length} tvrdnji sa porodičnim opsegom pokriva manje od dva artikla.`);
  }

  notes.push(
    `C.A.R.FIT sajt-tvrdnje: ${claims.length}, ${carfitWebsite.summary.familyScoped} na nivou porodice, ${carfitWebsite.summary.restrictions} stvarnih ograničenja (uz ${carfitWebsite.summary.grammaticallyNegated} gramatičkih negacija).`,
  );
}

const carfitTdsPath = "data/knowledge/carfit-tds-claims.generated.json";
if (existsSync(carfitTdsPath)) {
  const carfitTds = JSON.parse(readFileSync(carfitTdsPath, "utf8"));
  const claims = carfitTds.records.flatMap((record) =>
    record.claims.map((claim) => ({ claim, record })),
  );

  const withoutProvenance = claims.filter(
    ({ claim, record }) =>
      !record.documentFileName || !record.documentSha256 || typeof claim.page !== "number" || !claim.excerpt,
  );
  if (withoutProvenance.length) {
    fail(`C.A.R.FIT TDS: ${withoutProvenance.length} tvrdnji bez pune provenijencije.`);
  }

  const overclaimed = claims.filter(
    ({ claim }) =>
      claim.status !== "machine-extracted" || claim.sourceType !== "manufacturer-technical-document",
  );
  if (overclaimed.length) {
    fail(`C.A.R.FIT TDS: ${overclaimed.length} tvrdnji nije manufacturer-technical-document / machine-extracted.`);
  }

  const collapsedRange = claims.filter(
    ({ claim }) => claim.range && !/[–—-]|\bbis\b|\bto\b/i.test(String(claim.value)),
  );
  if (collapsedRange.length) {
    fail(`C.A.R.FIT TDS: ${collapsedRange.length} opsega svedeno na jednu vrednost.`);
  }

  notes.push(
    `C.A.R.FIT TDS-tvrdnje: ${claims.length} iz ${carfitTds.summary.documentsWithClaims} listova, sve machine-extracted.`,
  );
}

const carfitMatchPath = "data/knowledge/carfit-match.generated.json";
if (existsSync(carfitMatchPath)) {
  const carfitMatch = JSON.parse(readFileSync(carfitMatchPath, "utf8"));

  // Nothing from matching is written into the public catalogue.
  if (carfitMatch.summary.appliedToPublicCatalogue !== 0) {
    fail("C.A.R.FIT: poklapanje je primenjeno na javni katalog pre stručne provere.");
  }
  if (carfitMatch.summary.bareNumericAcceptances !== 0) {
    fail("C.A.R.FIT: prihvaćeno je golo numeričko poklapanje bez potvrde nazivom.");
  }
  const undecided = carfitMatch.matches.filter((row) => !row.confidence);
  if (undecided.length) fail(`C.A.R.FIT: ${undecided.length} poklapanja bez klasifikacije pouzdanosti.`);

  notes.push(
    `C.A.R.FIT poklapanje: ${carfitMatch.summary.reliable} pouzdanih, ${carfitMatch.summary.ambiguous} višeznačnih, ${carfitMatch.summary.manufacturerOnlyCandidates} kandidata samo kod proizvođača, ${carfitMatch.summary.duplicateArticleNumbersInSource} duplih artikala u izvoru.`,
  );
}

const carfitCrosscheckPath = "data/knowledge/carfit-source-crosscheck.generated.json";
if (existsSync(carfitCrosscheckPath)) {
  const carfitCrosscheck = JSON.parse(readFileSync(carfitCrosscheckPath, "utf8"));
  if (carfitCrosscheck.summary.autoResolved !== 0) {
    fail("C.A.R.FIT unakrsna provera: neslaganje je automatski razrešeno.");
  }
  const oneSided = (carfitCrosscheck.comparisons ?? []).filter(
    (entry) =>
      entry.classification === "VALUE_CONFLICT" &&
      (entry.websiteValue === undefined || entry.tdsValue === undefined),
  );
  if (oneSided.length) {
    fail(`C.A.R.FIT unakrsna provera: ${oneSided.length} konflikata čuva samo jednu stranu.`);
  }
  notes.push(
    `C.A.R.FIT unakrsna provera: ${carfitCrosscheck.summary.comparisons} poređenja, ${carfitCrosscheck.summary.conflicts} konflikata, 0 automatski razrešenih.`,
  );
}

/* -- C.A.R.FIT leak safeguard ---------------------------------------------- */

if (existsSync(carfitWebsitePath)) {
  const carfitWebsite = JSON.parse(readFileSync(carfitWebsitePath, "utf8"));

  /**
   * Distinctive German source phrases plus verbatim excerpts from the pages and
   * the data sheets. None of this exists in this Serbian-language site, so any
   * occurrence is a leak rather than a coincidence.
   */
  const probes = new Set([
    "Weitere Produktinformation",
    "Zweckbestimmung",
    "Abdeckmaterial mit elektrostatischen",
    "Schwemmzinnersatz",
    "EU-Grenzwert",
  ]);
  for (const record of carfitWebsite.records) {
    for (const claim of record.claims) {
      if (typeof claim.rawText === "string" && claim.rawText.length >= 45) {
        probes.add(claim.rawText.slice(0, 45));
      }
    }
  }
  if (existsSync(carfitTdsPath)) {
    const carfitTds = JSON.parse(readFileSync(carfitTdsPath, "utf8"));
    for (const record of carfitTds.records) {
      for (const claim of record.claims) {
        if (typeof claim.excerpt === "string" && claim.excerpt.length >= 45) {
          probes.add(claim.excerpt.slice(0, 45));
        }
      }
    }
  }

  const pages = readdirSync(path.join(APP_DIR, "proizvodi")).filter((file) => file.endsWith(".html"));
  let leaks = 0;
  for (const file of pages) {
    const html = readFileSync(path.join(APP_DIR, "proizvodi", file), "utf8");
    for (const probe of probes) {
      if (html.includes(probe)) {
        leaks += 1;
        fail(
          `SIGURNOSNI PROPUST: C.A.R.FIT podatak "${probe.slice(0, 50)}" vidljiv na /proizvodi/${file.replace(/\.html$/, "")}`,
        );
      }
    }
  }
  notes.push(`C.A.R.FIT provera curenja: ${probes.size} markera × ${pages.length} stranica; propusta: ${leaks}.`);
}

const carfitImagesPath = "data/knowledge/carfit-images.generated.json";
if (existsSync(carfitImagesPath)) {
  const carfitImages = JSON.parse(readFileSync(carfitImagesPath, "utf8"));
  const inPublic = carfitImages.images.filter((image) => image.localPath?.startsWith("public/"));
  if (inPublic.length) fail(`C.A.R.FIT: ${inPublic.length} slika je u public/ pre odobrenja.`);
  const publishedImages = carfitImages.images.filter((image) => image.published);
  if (publishedImages.length) fail(`C.A.R.FIT: ${publishedImages.length} slika je označeno kao objavljeno.`);
  notes.push(
    `C.A.R.FIT: ${carfitImages.summary.acquired} slika pripremljeno van public/, objavljeno: 0, zamenjeno na sajtu: ${carfitImages.summary.replacedSiteImagery}.`,
  );
}

const carfitDocsPath = "data/knowledge/carfit-documents.generated.json";
if (existsSync(carfitDocsPath)) {
  const carfitDocs = JSON.parse(readFileSync(carfitDocsPath, "utf8"));
  const inPublic = carfitDocs.documents.filter((entry) => entry.localPath?.startsWith("public/"));
  if (inPublic.length) fail(`C.A.R.FIT: ${inPublic.length} dokumenata je u public/ pre odobrenja.`);

  // Safety sheets stay a separate class; they must never be counted as TDS.
  const misfiled = carfitDocs.documents.filter(
    (entry) => entry.documentType === "tds" && /sicherheitsdatenblatt|safety-data-sheet/i.test(entry.fileName),
  );
  if (misfiled.length) {
    fail(`C.A.R.FIT: ${misfiled.length} bezbednosnih listova je klasifikovano kao tehnički list.`);
  }
  notes.push(
    `C.A.R.FIT dokumenti: ${carfitDocs.summary.byType?.tds ?? 0} TDS, ${carfitDocs.summary.byType?.sds ?? 0} SDS, ${carfitDocs.summary.unreadableScans ?? 0} skeniranih bez teksta, van public/.`,
  );
}

/* -- C.A.R.FIT Phase 2: document resolution invariants ---------------------- */

const carfitResolutionPath = "data/knowledge/carfit-document-resolution.generated.json";
if (existsSync(carfitResolutionPath)) {
  const carfitResolution = JSON.parse(readFileSync(carfitResolutionPath, "utf8"));
  const entries = carfitResolution.resolutions;

  const VALID_STATES = new Set([
    "EXACT_PRODUCT", "EXACT_COMPONENT", "MULTI_PRODUCT", "FAMILY_LEVEL", "PROBABLE",
    "UNRESOLVED", "UNRESOLVED_SCAN", "IMAGE_ONLY_SCAN", "NON_PRODUCT", "DUPLICATE",
  ]);

  // 13. Every document lands in exactly one known state.
  const badState = entries.filter((entry) => !VALID_STATES.has(entry.state));
  if (badState.length) fail(`C.A.R.FIT: ${badState.length} dokumenata nema važeće stanje razrešenja.`);

  /**
   * 14. Article-number association consistency. A document claiming resolution
   *     by article number must actually carry the numbers it resolved on.
   */
  const inconsistentArticles = entries.filter(
    (entry) => entry.confidence === "article-number" && !entry.articleNumbers?.length,
  );
  if (inconsistentArticles.length) {
    fail(`C.A.R.FIT: ${inconsistentArticles.length} dokumenata tvrdi poklapanje po broju artikla, a nema nijedan.`);
  }

  /**
   * 15. No document mapped to the wrong component. If a sheet is scoped to a
   *     component, every product it attaches to must actually have that
   *     component block — otherwise the hardener's values land on the product.
   */
  const carfitCatalogForComponents = existsSync(carfitCatalogPath)
    ? JSON.parse(readFileSync(carfitCatalogPath, "utf8"))
    : undefined;
  if (carfitCatalogForComponents) {
    const productBySlug = new Map(carfitCatalogForComponents.products.map((product) => [product.slug, product]));
    const COMPONENT_WORDS = {
      hardener: /härter|haerter|hardener|aktivator|activator/i,
      thinner: /verdünner|verduenner|thinner/i,
      additive: /additiv|additive/i,
    };
    const crossComponent = entries.filter((entry) => {
      if (!entry.component) return false;
      const pattern = COMPONENT_WORDS[entry.component];
      if (!pattern) return false;
      return entry.products.some((item) => {
        const product = productBySlug.get(item.slug);
        if (!product) return true;
        const hasComponent = product.variants.some((variant) =>
          pattern.test(`${variant.component ?? ""} ${variant.descriptor ?? ""}`),
        );
        return !hasComponent;
      });
    });
    if (crossComponent.length) {
      fail(
        `C.A.R.FIT: ${crossComponent.length} dokumenata je vezano za komponentu koju ciljni proizvod nema — rizik prelivanja vrednosti.`,
      );
    }
  }

  // 16. An unresolved document is never product evidence.
  const unresolvedAsEvidence = entries.filter(
    (entry) =>
      ["UNRESOLVED", "UNRESOLVED_SCAN", "NON_PRODUCT"].includes(entry.state) && entry.countsAsEvidence,
  );
  if (unresolvedAsEvidence.length) {
    fail(`C.A.R.FIT: ${unresolvedAsEvidence.length} nerazrešenih dokumenata se računa kao dokaz o proizvodu.`);
  }

  // 17. Duplicate files must not inflate coverage.
  const duplicatesAsEvidence = entries.filter((entry) => entry.state === "DUPLICATE" && entry.countsAsEvidence);
  if (duplicatesAsEvidence.length) {
    fail(`C.A.R.FIT: ${duplicatesAsEvidence.length} duplikata uvećava pokrivenost.`);
  }

  /**
   * 18. Knowing what a scan is does not mean knowing what it says. An
   *     identified scan may carry a product, but never technical evidence.
   */
  const scansAsEvidence = entries.filter(
    (entry) =>
      (entry.state === "IMAGE_ONLY_SCAN" || entry.state === "UNRESOLVED_SCAN") &&
      (entry.countsAsEvidence || entry.technicalExtraction !== "UNREADABLE_WITH_CURRENT_PIPELINE"),
  );
  if (scansAsEvidence.length) {
    fail(`C.A.R.FIT: ${scansAsEvidence.length} skeniranih dokumenata se tretira kao izvučen tehnički sadržaj.`);
  }

  // The catalogue resolves identity; its marketing prose is not a data sheet.
  const catalogueAsEvidence = entries.filter(
    (entry) => entry.documentType === "catalogue" && entry.countsAsEvidence,
  );
  if (catalogueAsEvidence.length) {
    fail("C.A.R.FIT: katalog se računa kao tehnički dokaz.");
  }

  notes.push(
    `C.A.R.FIT razrešenje dokumenata: ${carfitResolution.summary.resolved} razrešeno, ${carfitResolution.summary.probable} verovatno, ${carfitResolution.summary.unresolved} nerazrešeno, ${carfitResolution.summary.duplicates} duplikata, ${carfitResolution.summary.componentScoped} vezano za komponentu.`,
  );
}

const carfitManifestPath = "data/knowledge/brands/carfit.manifest.generated.json";
if (existsSync(carfitManifestPath)) {
  const carfitManifest = JSON.parse(readFileSync(carfitManifestPath, "utf8"));

  /**
   * 19. A family-level document must not silently document a variant it does
   *     not cover. Every product counted as documented must name the document.
   */
  const unsupported = (carfitManifest.products ?? []).filter(
    (product) => product.tdsClaims?.length && !product.tdsDocuments?.length,
  );
  if (unsupported.length) {
    fail(`C.A.R.FIT: ${unsupported.length} proizvoda ima TDS tvrdnje bez ijednog vezanog tehničkog lista.`);
  }

  const coverageTotal = Object.values(carfitManifest.coverage?.counts ?? {}).reduce((sum, count) => sum + count, 0);
  if (coverageTotal !== (carfitManifest.products ?? []).length) {
    fail("C.A.R.FIT: klasifikacija pokrivenosti ne obuhvata svaki proizvod tačno jednom.");
  }

  notes.push(
    `C.A.R.FIT pokrivenost: ${carfitManifest.completeness.withTds}/${carfitManifest.completeness.total} sa tehničkim listom, ${carfitManifest.completeness.withSds} sa bezbednosnim, ${carfitManifest.completeness.complete} kompletnih dosijea.`,
  );
}

/* -- NORBIN invariants ------------------------------------------------------ */

const norbinCatalogPath = "data/knowledge/norbin-catalog.generated.json";
if (existsSync(norbinCatalogPath)) {
  const norbinCatalog = JSON.parse(readFileSync(norbinCatalogPath, "utf8"));

  // 1. Nothing in the manufacturer catalogue asserts that we sell it.
  const overclaimed = norbinCatalog.products.filter(
    (product) => product.catalogStatus !== "manufacturer-catalog-candidate" || product.soldByCarsystem !== false || product.published !== false,
  );
  if (overclaimed.length) {
    fail(`NORBIN: ${overclaimed.length} proizvoda nije manufacturer-catalog-candidate / neprodavan / neobjavljen.`);
  }

  /**
   * 2. A product the manufacturer commented out of its own page is not part of
   *    the published offer. Availability must say so rather than defaulting to
   *    live, or a withdrawn product would read as current.
   */
  const badAvailability = norbinCatalog.products.filter(
    (product) => !["live", "unlinked-in-source"].includes(product.availability),
  );
  if (badAvailability.length) {
    fail(`NORBIN: ${badAvailability.length} proizvoda nema jasan status objavljenosti.`);
  }
  const liveWithoutRegion = norbinCatalog.products.filter(
    (product) => product.availability === "live" && !product.regions.length,
  );
  if (liveWithoutRegion.length) {
    fail(`NORBIN: ${liveWithoutRegion.length} „objavljenih" proizvoda nema nijedan region.`);
  }

  notes.push(
    `NORBIN katalog: ${norbinCatalog.summary.products} proizvoda (${norbinCatalog.summary.liveProducts} objavljenih, ${norbinCatalog.summary.unlinkedOnlyProducts} zakomentarisanih), ${norbinCatalog.summary.variants} varijanti, ${(norbinCatalog.summary.unpublishedRegions ?? []).length} neobjavljenih regiona.`,
  );
}

const norbinTdsPath = "data/knowledge/norbin-tds-claims.generated.json";
if (existsSync(norbinTdsPath)) {
  const norbinTds = JSON.parse(readFileSync(norbinTdsPath, "utf8"));
  const claims = norbinTds.records.flatMap((record) => record.claims.map((claim) => ({ claim, record })));

  // 3. Full provenance on every claim.
  const withoutProvenance = claims.filter(
    ({ claim, record }) =>
      !record.documentFileName || !record.documentSha256 || typeof claim.page !== "number" || !claim.excerpt,
  );
  if (withoutProvenance.length) fail(`NORBIN: ${withoutProvenance.length} tvrdnji bez pune provenijencije.`);

  // 4. Nothing is above machine-extracted.
  const overstated = claims.filter(
    ({ claim }) => claim.status !== "machine-extracted" || claim.sourceType !== "manufacturer-technical-document",
  );
  if (overstated.length) {
    fail(`NORBIN: ${overstated.length} tvrdnji nije manufacturer-technical-document / machine-extracted.`);
  }

  /**
   * 5. The legal boilerplate repeats in all 24 sheets and is longer than the
   *    technical content. If it ever reaches the claim set it swamps the review.
   */
  const boilerplate = claims.filter(({ claim }) =>
    /current knowledge and experience|supersedes all previous|responsibility of the recipient|JSON created/i.test(
      `${claim.value} ${claim.excerpt}`,
    ),
  );
  if (boilerplate.length) {
    fail(`NORBIN: ${boilerplate.length} tvrdnji potiče iz pravnog boilerplate-a ili oznake generatora.`);
  }

  /**
   * 6. The application table has one column per spray-gun type. A value may be
   *    scoped to one gun, or explicitly marked unscoped — but never silently
   *    applied to both.
   */
  const badEquipment = claims.filter(
    ({ claim }) =>
      ["sprayPressure", "nozzlePressure", "nozzleSize"].includes(claim.field) &&
      !claim.applicationEquipment &&
      !claim.equipmentScopeAmbiguous,
  );
  if (badEquipment.length) {
    fail(`NORBIN: ${badEquipment.length} tvrdnji o opremi nije ni vezano za tip pištolja ni označeno kao neodređeno.`);
  }

  // 7. Ranges keep both bounds.
  const collapsedRange = claims.filter(
    ({ claim }) => claim.range && !/[–—-]|\bto\b|\bbis\b/i.test(String(claim.value)),
  );
  if (collapsedRange.length) fail(`NORBIN: ${collapsedRange.length} opsega svedeno na jednu vrednost.`);

  /**
   * 8. A mixing-ratio relationship must name a partner other than the product
   *    itself, or a clearcoat would be recorded as mixing with itself.
   */
  const selfMixing = norbinTds.records.flatMap((record) =>
    record.relationships.filter((entry) => entry.partnerCode === record.code),
  );
  if (selfMixing.length) fail(`NORBIN: ${selfMixing.length} veza mešanja pokazuje na sam proizvod.`);

  notes.push(
    `NORBIN TDS-tvrdnje: ${claims.length} iz ${norbinTds.summary.documentsWithClaims} listova, ${norbinTds.summary.equipmentScoped} vezano za tip pištolja, ${norbinTds.summary.equipmentAmbiguous} označeno kao neodređeno, ${norbinTds.summary.relationships} deklarisanih veza.`,
  );
}

const norbinMatchPath = "data/knowledge/norbin-match.generated.json";
if (existsSync(norbinMatchPath)) {
  const norbinMatch = JSON.parse(readFileSync(norbinMatchPath, "utf8"));

  if (norbinMatch.summary.appliedToPublicCatalogue !== 0) {
    fail("NORBIN: poklapanje je primenjeno na javni katalog pre stručne provere.");
  }
  if (norbinMatch.summary.bareNumericAcceptances !== 0) {
    fail("NORBIN: prihvaćeno je golo numeričko poklapanje bez potvrde nazivom.");
  }

  /**
   * 9. A component must not be offered as its parent. "Clear Hardener" contains
   *    the word Clear, and an early version of the matcher paired our clearcoat
   *    with a hardener because of it.
   */
  const componentLeak = norbinMatch.matches.filter(
    (row) =>
      /lak|clear/i.test(row.localName ?? "") &&
      !/ocvrscivac|učvršćivač|hardener/i.test(row.localName ?? "") &&
      row.candidates.some((candidate) => /hardener|härter|thinner|reducer/i.test(candidate.officialName ?? "")),
  );
  if (componentLeak.length) {
    fail(`NORBIN: ${componentLeak.length} poklapanja nudi komponentu umesto osnovnog proizvoda.`);
  }

  notes.push(
    `NORBIN poklapanje: ${norbinMatch.summary.reliable} pouzdanih, ${norbinMatch.summary.ambiguous} višeznačnih, ${norbinMatch.summary.manufacturerOnlyCandidates} kandidata samo kod proizvođača.`,
  );
}

const norbinDocsPath = "data/knowledge/norbin-documents.generated.json";
if (existsSync(norbinDocsPath)) {
  const norbinDocs = JSON.parse(readFileSync(norbinDocsPath, "utf8"));

  const inPublic = norbinDocs.documents.filter((entry) => entry.localPath?.startsWith("public/"));
  if (inPublic.length) fail(`NORBIN: ${inPublic.length} dokumenata je u public/ pre odobrenja.`);

  // Safety sheets stay a separate class.
  const misfiled = norbinDocs.documents.filter(
    (entry) => entry.documentType === "tds" && /MSDS|safety[-_]data/i.test(entry.sourceUrl ?? ""),
  );
  if (misfiled.length) fail(`NORBIN: ${misfiled.length} bezbednosnih listova je klasifikovano kao tehnički list.`);

  notes.push(
    `NORBIN dokumenti: ${norbinDocs.summary.byType?.tds ?? 0} TDS, ${norbinDocs.summary.byType?.sds ?? 0} SDS, ${norbinDocs.summary.unlinkedInSource} zakomentarisanih u izvoru, ${norbinDocs.summary.failed} pokvarenih linkova, van public/.`,
  );
}

/* -- NORBIN leak safeguard -------------------------------------------------- */

if (existsSync(norbinTdsPath)) {
  const norbinTds = JSON.parse(readFileSync(norbinTdsPath, "utf8"));

  const probes = new Set(["NORBIN Clear", "Compliant gravity-feed", "MPV 4.0", "Potlife at 20°C"]);
  for (const record of norbinTds.records) {
    for (const claim of record.claims) {
      if (typeof claim.excerpt === "string" && claim.excerpt.length >= 45) {
        probes.add(claim.excerpt.slice(0, 45));
      }
    }
  }

  const pages = readdirSync(path.join(APP_DIR, "proizvodi")).filter((file) => file.endsWith(".html"));
  let leaks = 0;
  for (const file of pages) {
    const html = readFileSync(path.join(APP_DIR, "proizvodi", file), "utf8");
    for (const probe of probes) {
      if (html.includes(probe)) {
        leaks += 1;
        fail(
          `SIGURNOSNI PROPUST: NORBIN podatak "${probe.slice(0, 50)}" vidljiv na /proizvodi/${file.replace(/\.html$/, "")}`,
        );
      }
    }
  }
  notes.push(`NORBIN provera curenja: ${probes.size} markera × ${pages.length} stranica; propusta: ${leaks}.`);
}

const cosmosManifestPath = "data/knowledge/brands/cosmos-lac.manifest.generated.json";
if (existsSync(cosmosManifestPath)) {
  const cosmosManifest = JSON.parse(readFileSync(cosmosManifestPath, "utf8"));

  // 5. A family-level claim needs corroboration from more than one variant,
  //    unless the group is explicitly marked representative-only.
  let badFamilyClaims = 0;
  for (const group of cosmosManifest.productGroups ?? []) {
    if (group.representativeOnly) {
      if ((group.familyLevelClaims ?? []).length) badFamilyClaims += 1;
      continue;
    }
    for (const claim of group.familyLevelClaims ?? []) {
      if (claim.ofDescribedVariants <= 1 || claim.variantsStating < claim.ofDescribedVariants) {
        badFamilyClaims += 1;
      }
    }
  }
  if (badFamilyClaims) {
    fail(
      `Cosmos: ${badFamilyClaims} tvrdnji na nivou porodice nije potvrđeno na svim opisanim varijantama.`,
    );
  }
  notes.push(
    `Cosmos porodice: ${(cosmosManifest.productGroups ?? []).length} grupa, ${badFamilyClaims} neispravnih family-level tvrdnji.`,
  );

  // 6. No acquired image may sit under public/ or be marked published.
  const leakedAssets = cosmosManifest.products
    .flatMap((product) => product.assets ?? [])
    .filter(
      (asset) => asset.published === true || String(asset.localPath).startsWith("public/"),
    );
  if (leakedAssets.length) {
    fail(`Cosmos: ${leakedAssets.length} preuzetih slika je u public/ ili označeno objavljenim.`);
  }
  notes.push(`Cosmos assets: 0 u public/, 0 objavljenih.`);
}

for (const file of BRAND_MANIFESTS) {
  if (!existsSync(file)) continue;
  const manifest = JSON.parse(readFileSync(file, "utf8"));
  const manifestClaims = manifest.products.flatMap((product) => product.claims ?? []);
  const bad = manifestClaims.filter((claim) => claim.status !== "machine-extracted");
  if (bad.length) {
    fail(`${file}: ${bad.length} tvrdnji nema status machine-extracted.`);
  }

  // No acquired asset may be referenced from a public path.
  const publishedAssets = manifest.products
    .flatMap((product) => product.assets ?? [])
    .filter((asset) => asset.published === true || String(asset.localPath).startsWith("public/"));
  if (publishedAssets.length) {
    fail(`${file}: ${publishedAssets.length} preuzetih asseta je u public/ ili označeno kao objavljeno.`);
  }

  // Official descriptions are long and distinctive; a leak would be obvious.
  const descriptions = manifestClaims
    .filter((claim) => claim.field === "officialDescription" && typeof claim.value === "string")
    .map((claim) => claim.value.slice(0, 60))
    .filter((text) => text.length >= 40);
  const uniqueDescriptions = [...new Set(descriptions)];

  const pages = readdirSync(path.join(APP_DIR, "proizvodi")).filter((f) => f.endsWith(".html"));
  let leaks = 0;
  for (const pageFile of pages) {
    const html = readFileSync(path.join(APP_DIR, "proizvodi", pageFile), "utf8");
    for (const snippet of uniqueDescriptions) {
      if (html.includes(snippet)) {
        leaks += 1;
        fail(
          `SIGURNOSNI PROPUST: zvanični opis proizvođača vidljiv na /proizvodi/${pageFile.replace(/\.html$/, "")}`,
        );
      }
    }
  }
  notes.push(
    `${manifest.brandName}: ${manifestClaims.length} tvrdnji, ${uniqueDescriptions.length} opisa × ${pages.length} stranica; propusta: ${leaks}.`,
  );
  notes.push(
    `${manifest.brandName}: ${manifest.acquisition.imagesAcquired ?? 0} slika pripremljeno van public/, objavljeno: 0.`,
  );
}

for (const dataset of ACQUIRED_DATASETS.slice(1)) {
  if (!existsSync(dataset)) continue;
  const parsed = JSON.parse(readFileSync(dataset, "utf8"));
  const datasetClaims = parsed.records.flatMap((record) => record.claims ?? []);
  const bad = datasetClaims.filter((claim) => claim.status !== "machine-extracted");
  if (bad.length) {
    fail(`${dataset}: ${bad.length} tvrdnji nema status machine-extracted.`);
  }
  notes.push(
    `${parsed.summary.brand}: ${datasetClaims.length} tvrdnji, sve machine-extracted.`,
  );

  // No acquired brand's values may appear anywhere in the built site.
  const probes = new Set();
  for (const claim of datasetClaims) {
    if (claim.field === "voc" && typeof claim.value === "number") {
      probes.add(`${claim.value} g/l`);
    }
    if (claim.field === "potLife" && typeof claim.value === "string") {
      probes.add(claim.value);
    }
  }
  let brandLeaks = 0;
  const allProductPages = readdirSync(path.join(APP_DIR, "proizvodi")).filter((file) =>
    file.endsWith(".html"),
  );
  for (const file of allProductPages) {
    const html = readFileSync(path.join(APP_DIR, "proizvodi", file), "utf8");
    for (const probe of probes) {
      if (probe.length >= 6 && html.includes(probe)) {
        brandLeaks += 1;
        fail(
          `SIGURNOSNI PROPUST: ${parsed.summary.brand} vrednost "${probe}" vidljiva na /proizvodi/${file.replace(/\.html$/, "")}`,
        );
      }
    }
  }
  notes.push(
    `${parsed.summary.brand}: ${probes.size} vrednosti × ${allProductPages.length} stranica; propusta: ${brandLeaks}.`,
  );
}

const extractionPath = "data/knowledge/rm-technical-extraction.generated.json";
if (existsSync(extractionPath)) {
  const extraction = JSON.parse(readFileSync(extractionPath, "utf8"));
  const claims = extraction.records.flatMap((record) =>
    record.claims.map((claim) => ({ ...claim, productSlug: record.productSlug })),
  );
  notes.push(
    `Ekstrakcija sadrži ${claims.length} tvrdnji, sve sa statusom machine-extracted.`,
  );

  const badStatus = claims.filter(
    (claim) => claim.verificationStatus !== "machine-extracted",
  );
  if (badStatus.length) {
    fail(
      `${badStatus.length} izvučenih tvrdnji nema status machine-extracted — ekstrakcija ne sme sama da odobrava sadržaj.`,
    );
  }

  /**
   * Leak probes.
   *
   * An earlier version compared bare numeric values (e.g. the mixing ratio
   * "3:1:1") against the page text. That produced false positives for two
   * reasons worth recording:
   *
   *   - Substring collisions: "1:1" matches inside "3:1:1".
   *   - Cross-product payloads: a product's full record is serialised into the
   *     RSC payload of every page that lists it as a related product, so a
   *     value belonging to product A is findable in product B's HTML.
   *
   * It also flagged `c-2p42-race-finish-r`, which carries three hand-entered,
   * expert-`confirmed` technical facts in `lib/rm-imported-products.ts` that
   * predate Phase 3 and are legitimately published.
   *
   * So the probes below are distinctive English source phrases and extraction
   * markers instead. None of them exist anywhere in this Serbian-language site,
   * so any occurrence is unambiguously a leak from the extraction dataset.
   */
  const LEAK_PROBES = [
    "machine-extracted",
    "Product is suitable on",
    "Product suitable on",
    "Sheet steel",
    "Galvanized sheet steel",
    "OEM parts with e-coat",
    "Old paintwork",
    "Nozzle Size",
    "Flash Off at",
    "Mixing Ratio",
    "Potlife at",
    " g/l",
  ];

  const productHtmlFiles = readdirSync(path.join(APP_DIR, "proizvodi")).filter((file) =>
    file.endsWith(".html"),
  );

  let leaked = 0;
  for (const file of productHtmlFiles) {
    const html = readFileSync(path.join(APP_DIR, "proizvodi", file), "utf8");
    for (const probe of LEAK_PROBES) {
      if (html.includes(probe)) {
        leaked += 1;
        fail(
          `SIGURNOSNI PROPUST: izvučeni marker "${probe}" vidljiv na /proizvodi/${file.replace(/\.html$/, "")}`,
        );
      }
    }
  }
  notes.push(
    `Provera curenja: ${LEAK_PROBES.length} markera × ${productHtmlFiles.length} stranica; propusta: ${leaked}.`,
  );

  /**
   * Extracted substrate phrases must not appear on the R-M product pages.
   *
   * Two scoping rules, both learned from false positives:
   *
   *   - Only R-M pages. The extraction covers R-M products exclusively, so a
   *     match on a Cosmos page cannot be a leak from it.
   *   - Multi-word phrases only. "Aluminium" on its own is a legitimate part of
   *     Cosmos product names ("RAL 9007 Grey Aluminium", "Wheel Rim 326
   *     Aluminium") and says nothing about extraction leaking.
   */
  const rmSlugs = new Set(extraction.records.map((record) => record.productSlug));
  const substratePhrases = new Set();
  for (const claim of claims) {
    if (claim.field !== "substrates" || !Array.isArray(claim.value)) continue;
    for (const entry of claim.value) {
      if (entry.sourceText && entry.sourceText.trim().split(/\s+/).length >= 2) {
        substratePhrases.add(entry.sourceText);
      }
    }
  }

  let substrateLeaks = 0;
  let rmPagesChecked = 0;
  for (const slug of rmSlugs) {
    const html = readHtml(`proizvodi/${slug}`);
    if (!html) continue;
    rmPagesChecked += 1;
    for (const phrase of substratePhrases) {
      if (html.includes(phrase)) {
        substrateLeaks += 1;
        fail(
          `SIGURNOSNI PROPUST: izjava o podlozi "${phrase}" vidljiva na /proizvodi/${slug}`,
        );
      }
    }
  }
  notes.push(
    `Provera izjava o podlozi: ${substratePhrases.size} višerečnih formulacija × ${rmPagesChecked} R-M stranica; propusta: ${substrateLeaks}.`,
  );

  // Nothing extracted may appear in the sitemap-facing structured data either.
  const sampleSlugs = [...new Set(claims.map((claim) => claim.productSlug))].slice(0, 25);
  let schemaLeaks = 0;
  for (const slug of sampleSlugs) {
    const html = readHtml(`proizvodi/${slug}`);
    if (!html) continue;
    for (const node of jsonLdBlocks(html, `/proizvodi/${slug}`)) {
      const serialised = JSON.stringify(node);
      if (/machine-extracted|Product is suitable on|Sheet steel/.test(serialised)) {
        schemaLeaks += 1;
        fail(`SIGURNOSNI PROPUST: izvučeni podatak u JSON-LD na /proizvodi/${slug}`);
      }
    }
  }
  notes.push(`JSON-LD provera na ${sampleSlugs.length} stranica; propusta: ${schemaLeaks}.`);
} else {
  notes.push("Ekstrakcija nije pokrenuta — Phase 3 provere preskočene.");
}

/* -------------------------------------------------------------------------- */

console.log("\nVALIDACIJA ZNANJA I GRUPA PROIZVODA\n");
for (const note of notes) console.log(`  · ${note}`);

if (failures.length) {
  console.log(`\n  ${failures.length} GREŠAKA:\n`);
  for (const failure of failures) console.log(`  ✗ ${failure}`);
  process.exit(1);
}

console.log("\n  ✓ Sve provere prolaze.\n");
