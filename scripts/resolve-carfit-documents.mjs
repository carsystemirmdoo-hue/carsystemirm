#!/usr/bin/env node
/**
 * C.A.R.FIT Phase 2, step 2 — document → product resolution.
 *
 * Article number first. It is the only identifier both the sheets and the
 * catalogue print explicitly, and 231 of 302 documents carry one; the file name,
 * which Phase 1 leaned on, resolved 25.
 *
 * Association is many-to-many by design. One sheet legitimately covers several
 * pack sizes, several colours, a whole family, or a product together with its
 * hardener. Forcing one-to-one would either drop article numbers or invent a
 * precision the document does not have.
 *
 * Component awareness is the safety property. A sheet whose identity is
 * "Härter für 2K HS Acryl Grundierfüller" must attach to the hardener variants,
 * not to the filler, or the filler's density would be read as the hardener's.
 *
 * Every document ends in exactly one state:
 *   EXACT_PRODUCT        article numbers resolve to one product
 *   EXACT_COMPONENT      … and to one component within it
 *   MULTI_PRODUCT        article numbers span several products
 *   FAMILY_LEVEL         covers a family/system rather than a single product
 *   PROBABLE             name evidence only, confidence recorded
 *   UNRESOLVED           no defensible association
 *   IMAGE_ONLY_SCAN      identity known, technical content unreadable
 *   UNRESOLVED_SCAN      unreadable and unidentifiable
 *   NON_PRODUCT          not product documentation
 *   DUPLICATE            same bytes as another file; not independent evidence
 *
 * Output: data/knowledge/carfit-document-resolution.generated.json
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const identity = JSON.parse(readFileSync("data/knowledge/carfit-document-identity.generated.json", "utf8"));
const registry = JSON.parse(readFileSync("data/knowledge/carfit-article-registry.generated.json", "utf8"));
const catalog = JSON.parse(readFileSync("data/knowledge/carfit-catalog.generated.json", "utf8"));

const generatedAt = new Date().toISOString();

/* -------------------------------------------------------------------------- */
/* Indexes                                                                    */
/* -------------------------------------------------------------------------- */

/** article number → every (product, variant) pair on the website. */
const websiteByArticle = new Map();
for (const product of catalog.products) {
  for (const variant of product.variants) {
    const bucket = websiteByArticle.get(variant.articleNumber) ?? [];
    bucket.push({ product, variant });
    websiteByArticle.set(variant.articleNumber, bucket);
  }
}

/** article number → catalogue rows (family + component role). */
const catalogueByArticle = new Map();
for (const row of registry.rows) {
  const bucket = catalogueByArticle.get(row.articleNumber) ?? [];
  bucket.push(row);
  catalogueByArticle.set(row.articleNumber, bucket);
}

/**
 * A component word on the *variant* — the website encodes it as the h3 block
 * ("Klarlack", "Härter"), the catalogue as the description ("Hardener, 1L").
 */
const COMPONENT_ROLES = [
  { role: "hardener", re: /\b(härter|haerter|hardener|durcisseur|activator|aktivator)\b/i },
  { role: "thinner", re: /\b(verdünner|verduenner|thinner|diluant|beispritzverdünnung)\b/i },
  { role: "additive", re: /\b(additiv|additive|beschleuniger|accelerator|elastifizierer)\b/i },
];
const roleOf = (text) => COMPONENT_ROLES.find((entry) => entry.re.test(text ?? ""))?.role ?? "main";

const variantRole = (entry) =>
  roleOf(`${entry.variant.component ?? ""} ${entry.variant.descriptor ?? ""}`);

/* -------------------------------------------------------------------------- */
/* English → German bridge                                                    */
/* -------------------------------------------------------------------------- */

const normaliseName = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const websiteProducts = catalog.products.map((product) => ({
  product,
  tokens: normaliseName(product.officialName).split(" ").filter((token) => token.length > 2),
}));

/**
 * Half the corpus is English while every product page is German, so an English
 * sheet's own title ("Rapid Air Clear Coat VOC") matches nothing on the site.
 * The catalogue prints the EN and DE family names side by side, which is the
 * manufacturer's own translation rather than ours.
 */
const bridge = (registry.nameBridge ?? []).map((entry) => ({
  enTokens: normaliseName(entry.en).split(" ").filter((token) => token.length > 2),
  de: entry.de,
  en: entry.en,
}));

function bridgeToGerman(title) {
  if (!title) return undefined;
  const haystack = normaliseName(title);
  const hits = bridge.filter(
    (entry) => entry.enTokens.length >= 2 && entry.enTokens.every((token) => haystack.includes(token)),
  );
  if (hits.length !== 1) return undefined;

  const germanTokens = normaliseName(hits[0].de).split(" ").filter((token) => token.length > 2);
  if (germanTokens.length < 2) return undefined;

  const products = websiteProducts.filter((candidate) => {
    const name = normaliseName(candidate.product.officialName);
    return germanTokens.every((token) => name.includes(token));
  });
  return products.length === 1 ? { product: products[0].product, via: hits[0] } : undefined;
}

/* -------------------------------------------------------------------------- */
/* Resolution                                                                 */
/* -------------------------------------------------------------------------- */

const resolutions = [];
const byFileName = new Map(identity.identities.map((entry) => [entry.fileName, entry]));

for (const document of identity.identities) {
  const evidence = [];
  const base = {
    fileName: document.fileName,
    sha256: document.sha256,
    sourceUrl: document.sourceUrl,
    documentType: document.documentType,
    componentRoleOfDocument: document.componentRole,
    languageFromContent: document.languageFromContent,
    revision: document.revision,
    previousLinkConfidence: document.linkConfidence,
    previousProducts: document.appliesToProducts,
  };

  // -- duplicates: same bytes, different name ------------------------------
  if (document.duplicateOfFileName) {
    const original = byFileName.get(document.duplicateOfFileName);
    resolutions.push({
      ...base,
      state: "DUPLICATE",
      duplicateOfFileName: document.duplicateOfFileName,
      products: [],
      articleNumbers: [],
      countsAsEvidence: false,
      evidence: [`Identičan sadržaj (SHA256) kao \`${document.duplicateOfFileName}\`.`],
      note: "Ne uvećava pokrivenost — isti dokument pod drugim imenom.",
      inheritedFrom: original?.fileName,
    });
    continue;
  }

  if (document.error) {
    resolutions.push({
      ...base,
      state: "UNRESOLVED",
      products: [],
      articleNumbers: [],
      countsAsEvidence: false,
      evidence: [`Preuzimanje nije uspelo: ${document.error}.`],
    });
    continue;
  }

  /**
   * The catalogue resolves entities; it is not technical evidence.
   *
   * It prints 201 article numbers spanning 87 products, so left in the normal
   * path it resolved as one enormous MULTI_PRODUCT document and made 43
   * products look as though they held a shared technical sheet. Its marketing
   * prose is not a TDS for any of them.
   */
  if (document.documentType === "catalogue") {
    resolutions.push({
      ...base,
      state: "NON_PRODUCT",
      products: [],
      articleNumbers: document.articleNumbers ?? [],
      countsAsEvidence: false,
      role: "entity-resolution-source",
      evidence: [
        `Zvanični katalog: ${document.articleNumbers?.length ?? 0} brojeva artikala korišćeno za razrešavanje identiteta.`,
        "Marketinški tekst iz kataloga se ne koristi kao tehnički dokaz.",
      ],
    });
    continue;
  }

  if (document.documentType === "administrative") {
    resolutions.push({
      ...base,
      state: "NON_PRODUCT",
      products: [],
      articleNumbers: [],
      countsAsEvidence: false,
      evidence: ["Dokument nije proizvodna dokumentacija (administrativni obrazac)."],
    });
    continue;
  }

  /* -- unreadable scans, decided before any association path --------------- */

  /**
   * Identity is not content. A scan may be perfectly identifiable — page-linked,
   * or named after its product — and still yield no readable technical data. It
   * is resolved for identity but must never count as technical evidence, or a
   * product would appear to "have a TDS" whose values nobody can read.
   */
  if (!document.readable) {
    const linkedProducts = (document.linkConfidence === "page-link" ? document.appliesToProducts : [])
      .map((slug) => catalog.products.find((product) => product.slug === slug))
      .filter(Boolean)
      .map((product) => ({ slug: product.slug, officialName: product.officialName }));

    /**
     * An internal PDF title is not automatically an identity. Four of the five
     * scans carry the authoring tool's leftover file name — "dsaas (1).pdf",
     * "Catalogue final 27 April.pdf", "CARFIT Catalogue 2020.pdf" — which says
     * nothing about which product the sheet describes. Identity requires a page
     * link or a product name, not merely a non-empty title.
     */
    const identified = linkedProducts.length || document.mentionedProducts.length;

    if (linkedProducts.length) {
      evidence.push("Identitet utvrđen preko linka sa stranice proizvoda kod proizvođača.");
    } else if (document.mentionedProducts.length) {
      evidence.push(`Identitet utvrđen preko naziva proizvoda: ${document.mentionedProducts.map((entry) => entry.officialName).join(", ")}.`);
    } else if (document.internalTitle) {
      evidence.push(
        `Interni naslov PDF-a je „${document.internalTitle}" — ostatak iz alata za izvoz, ne identitet proizvoda.`,
      );
    }

    resolutions.push({
      ...base,
      state: identified ? "IMAGE_ONLY_SCAN" : "UNRESOLVED_SCAN",
      confidence: identified ? "identity-only" : undefined,
      products: linkedProducts.length ? linkedProducts : document.mentionedProducts,
      articleNumbers: [],
      countsAsEvidence: false,
      technicalExtraction: "UNREADABLE_WITH_CURRENT_PIPELINE",
      evidence: evidence.length
        ? evidence
        : ["Skenirana slika bez teksta; identitet se ne može utvrditi iz naziva, metapodataka ni linka."],
    });
    continue;
  }

  /* -- the manufacturer's own page link ----------------------------------- */

  /**
   * A `Downloads` link is the manufacturer stating, on its own product page,
   * that this sheet belongs to this product. That outranks anything inferred.
   * Phase 1 established 117 of these and the first draft of this resolver
   * ignored them, which lost seven products that were already correct.
   */
  const pageLinked = document.linkConfidence === "page-link" ? document.appliesToProducts : [];

  /* -- article-number-first ---------------------------------------------- */

  const articleNumbers = document.articleNumbers ?? [];
  const articleHits = articleNumbers.flatMap((article) => websiteByArticle.get(article) ?? []);
  const catalogueHits = articleNumbers.flatMap((article) => catalogueByArticle.get(article) ?? []);

  // Page-linked products join the candidate set even when the sheet prints no
  // article number of its own.
  const linkedHits = pageLinked.flatMap((slug) => {
    const product = catalog.products.find((entry) => entry.slug === slug);
    return product ? product.variants.map((variant) => ({ product, variant })) : [];
  });
  const websiteHits = articleHits.length ? articleHits : linkedHits;
  if (pageLinked.length) {
    evidence.push(`Proizvođač na svojoj stranici proizvoda linkuje ovaj dokument (${pageLinked.length} proizvod/a).`);
  }

  if (articleNumbers.length) {
    evidence.push(`Brojevi artikala u tekstu dokumenta: ${articleNumbers.slice(0, 8).join(", ")}${articleNumbers.length > 8 ? " …" : ""}.`);
  }

  const products = [...new Map(websiteHits.map((hit) => [hit.product.slug, hit.product])).values()];

  if (products.length === 1 && websiteHits.length) {
    const product = products[0];
    const hitRoles = [...new Set(websiteHits.map(variantRole))];
    const documentRole = document.componentRole;

    /**
     * The sheet names a component and every article it cites is that component:
     * scope the association to the component, not the whole product.
     */
    const componentScoped =
      documentRole !== "main" && hitRoles.length === 1 && hitRoles[0] === documentRole;

    // The document names a component the cited articles do not support. Rather
    // than attach it to the wrong half of a two-part system, it is downgraded.
    const roleConflict = documentRole !== "main" && !hitRoles.includes(documentRole);

    if (componentScoped) {
      evidence.push(`Dokument se odnosi na komponentu „${documentRole}", i svi navedeni artikli pripadaju toj komponenti.`);
    } else if (roleConflict) {
      evidence.push(`Dokument imenuje komponentu „${documentRole}", ali navedeni artikli pripadaju: ${hitRoles.join(", ")}.`);
    }

    resolutions.push({
      ...base,
      state: roleConflict ? "PROBABLE" : componentScoped ? "EXACT_COMPONENT" : "EXACT_PRODUCT",
      confidence: roleConflict ? "role-conflict" : "article-number",
      products: [{ slug: product.slug, officialName: product.officialName }],
      component: componentScoped ? documentRole : undefined,
      articleNumbers: [...new Set(websiteHits.map((hit) => hit.variant.articleNumber))],
      catalogueFamilies: [...new Set(catalogueHits.map((row) => row.family).filter(Boolean))],
      countsAsEvidence: !roleConflict,
      evidence,
    });
    continue;
  }

  if (products.length > 1) {
    // Several products legitimately share one sheet — a system document.
    const sameCategory = new Set(products.map((product) => product.category)).size === 1;
    evidence.push(`Artikli iz dokumenta pripadaju ${products.length} proizvoda${sameCategory ? " iste kategorije" : " različitih kategorija"}.`);
    resolutions.push({
      ...base,
      state: sameCategory ? "FAMILY_LEVEL" : "MULTI_PRODUCT",
      confidence: "article-number",
      products: products.map((product) => ({ slug: product.slug, officialName: product.officialName })),
      articleNumbers: [...new Set(websiteHits.map((hit) => hit.variant.articleNumber))],
      catalogueFamilies: [...new Set(catalogueHits.map((row) => row.family).filter(Boolean))],
      countsAsEvidence: true,
      evidence,
    });
    continue;
  }

  /* -- catalogue-only articles ------------------------------------------- */

  if (catalogueHits.length) {
    const families = [...new Set(catalogueHits.map((row) => row.family).filter(Boolean))];
    evidence.push(
      `Artikli postoje u zvaničnom katalogu 2026 (${families.join(", ") || "porodica nije imenovana"}), ali ne i na stranicama proizvoda.`,
    );
    resolutions.push({
      ...base,
      state: "FAMILY_LEVEL",
      confidence: "catalogue-article-number",
      products: [],
      catalogueFamilies: families,
      catalogueDescriptions: catalogueHits.slice(0, 4).map((row) => row.description.slice(0, 90)),
      articleNumbers,
      // Identified, but it describes something the website does not list, so it
      // is not evidence about any product we hold.
      countsAsEvidence: false,
      note: "Identifikovano preko kataloga; odgovarajući proizvod nije na sajtu proizvođača.",
      evidence,
    });
    continue;
  }

  /* -- English sheet reached through the catalogue's own translation ------ */

  const bridged = bridgeToGerman(document.internalTitle ?? document.fileName);
  if (bridged && document.readable) {
    evidence.push(
      `Engleski naslov „${bridged.via.en}" povezan sa nemačkim „${bridged.via.de}" preko zvaničnog kataloga 2026.`,
    );
    resolutions.push({
      ...base,
      state: "PROBABLE",
      confidence: "catalogue-name-bridge",
      products: [{ slug: bridged.product.slug, officialName: bridged.product.officialName }],
      articleNumbers: [],
      // The bridge is the manufacturer's own translation, but it links families
      // rather than article numbers, so it never becomes exact on its own.
      countsAsEvidence: true,
      evidence,
    });
    continue;
  }

  /* -- name evidence only -------------------------------------------------- */

  if (document.mentionedProducts.length === 1) {
    evidence.push(`Naziv proizvoda „${document.mentionedProducts[0].officialName}" u potpunosti se pojavljuje u nazivu fajla / internom naslovu.`);
    if (document.internalTitle) evidence.push(`Interni naslov PDF-a: „${document.internalTitle}".`);
    resolutions.push({
      ...base,
      state: "PROBABLE",
      confidence: "name-only",
      products: document.mentionedProducts,
      articleNumbers: [],
      // Name evidence never becomes exact on its own.
      countsAsEvidence: true,
      evidence,
    });
    continue;
  }

  if (document.mentionedProducts.length > 1) {
    evidence.push(`Naziv odgovara za ${document.mentionedProducts.length} proizvoda; nijedan nije odlučujući.`);
    resolutions.push({
      ...base,
      state: "PROBABLE",
      confidence: "name-ambiguous",
      products: document.mentionedProducts,
      articleNumbers: [],
      countsAsEvidence: false,
      evidence,
    });
    continue;
  }

  if (document.internalTitle) evidence.push(`Interni naslov PDF-a: „${document.internalTitle}" — ne odgovara nijednom proizvodu sa sajta.`);
  if (document.pageHeader) evidence.push(`Zaglavlje prve strane: „${document.pageHeader.slice(0, 80)}".`);

  resolutions.push({
    ...base,
    state: "UNRESOLVED",
    products: [],
    articleNumbers: [],
    countsAsEvidence: false,
    evidence: evidence.length ? evidence : ["Nema brojeva artikala, naziva proizvoda ni upotrebljivog internog naslova."],
  });
}

/* -------------------------------------------------------------------------- */
/* Summary                                                                    */
/* -------------------------------------------------------------------------- */

const byState = {};
for (const entry of resolutions) byState[entry.state] = (byState[entry.state] ?? 0) + 1;

const RESOLVED_STATES = ["EXACT_PRODUCT", "EXACT_COMPONENT", "MULTI_PRODUCT", "FAMILY_LEVEL"];

const associatedProducts = new Set(
  resolutions
    .filter((entry) => entry.countsAsEvidence)
    .flatMap((entry) => entry.products.map((product) => product.slug)),
);

const tdsByProduct = new Map();
for (const entry of resolutions) {
  if (entry.documentType !== "tds" || !entry.countsAsEvidence) continue;
  for (const product of entry.products) {
    const bucket = tdsByProduct.get(product.slug) ?? [];
    bucket.push(entry.fileName);
    tdsByProduct.set(product.slug, bucket);
  }
}
const sdsByProduct = new Map();
for (const entry of resolutions) {
  if (entry.documentType !== "sds" || !entry.countsAsEvidence) continue;
  for (const product of entry.products) {
    const bucket = sdsByProduct.get(product.slug) ?? [];
    bucket.push(entry.fileName);
    sdsByProduct.set(product.slug, bucket);
  }
}

const summary = {
  generatedAt,
  brand: "C.A.R.FIT",
  documents: resolutions.length,
  byState,
  resolved: resolutions.filter((entry) => RESOLVED_STATES.includes(entry.state)).length,
  probable: resolutions.filter((entry) => entry.state === "PROBABLE").length,
  unresolved: resolutions.filter((entry) => entry.state === "UNRESOLVED" || entry.state === "UNRESOLVED_SCAN").length,
  duplicates: resolutions.filter((entry) => entry.state === "DUPLICATE").length,
  nonProduct: resolutions.filter((entry) => entry.state === "NON_PRODUCT").length,
  imageOnlyScans: resolutions.filter((entry) => entry.state === "IMAGE_ONLY_SCAN").length,
  // Only documents that count as evidence may raise coverage.
  countingAsEvidence: resolutions.filter((entry) => entry.countsAsEvidence).length,
  componentScoped: resolutions.filter((entry) => entry.state === "EXACT_COMPONENT").length,
  roleConflicts: resolutions.filter((entry) => entry.confidence === "role-conflict").length,
  productsWithTds: tdsByProduct.size,
  productsWithSds: sdsByProduct.size,
  productsAssociated: associatedProducts.size,
  manufacturerProducts: catalog.products.length,
};

mkdirSync("data/knowledge", { recursive: true });
writeFileSync(
  "data/knowledge/carfit-document-resolution.generated.json",
  `${JSON.stringify({ summary, resolutions }, null, 2)}\n`,
);

console.log(JSON.stringify(summary, null, 2));
