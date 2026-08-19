#!/usr/bin/env node
/**
 * Phase 5 — NORBIN dossier, manifest and expert package.
 *
 * NORBIN is the smallest corpus so far (24 products, 100 documents), so the
 * expert package can afford to show every product in full rather than sampling.
 * It is grouped by family, then product, then variant/component, with shared
 * documents and ambiguous mappings called out separately.
 *
 * Output:
 *   data/knowledge/brands/norbin.manifest.generated.json
 *   docs/seo/EXPERT_REVIEW_NORBIN.md
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";

const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));
const readJsonIf = (file) => (existsSync(file) ? readJson(file) : undefined);

const catalog = readJson("data/knowledge/norbin-catalog.generated.json");
const match = readJson("data/knowledge/norbin-match.generated.json");
const documents = readJson("data/knowledge/norbin-documents.generated.json");
const tds = readJsonIf("data/knowledge/norbin-tds-claims.generated.json");

const generatedAt = new Date().toISOString();

const FIELD_SR = {
  intendedUse: "Namena", keyFeatures: "Ključne osobine", storageTemperature: "Temperatura skladištenja",
  shelfLife: "Rok trajanja", mixingRatio: "Odnos mešanja", sprayViscosity: "Viskozitet prskanja",
  potLife: "Vreme upotrebljivosti", sprayPressure: "Pritisak", nozzlePressure: "Pritisak na dizni",
  nozzleSize: "Dizna", sprayCoats: "Broj slojeva", flashOffTime: "Razmak između slojeva",
  filmThickness: "Debljina sloja", dryingTime: "Sušenje", sandability: "Brušenje",
  substrate: "Podloge", hardness: "Tvrdoća", voc: "VOC", colour: "Boja",
  note: "Napomena", otherSpecification: "Ostala specifikacija",
};

/**
 * Family from the code prefix — the manufacturer's own grouping.
 * N15 clearcoats · N55 primers/fillers · N60 body fillers · N75 hardeners
 * N85 thinners · N95 cleaners
 */
const FAMILY_SR = {
  N15: "Bezbojni lakovi", N55: "Prajmeri i fileri", N60: "Kitovi",
  N75: "Očvršćivači", N85: "Razređivači", N95: "Sredstva za čišćenje",
};
const familyOf = (code) => code?.slice(0, 3);

const tdsByCode = new Map();
for (const record of tds?.records ?? []) {
  if (!record.code) continue;
  const bucket = tdsByCode.get(record.code) ?? [];
  bucket.push(record);
  tdsByCode.set(record.code, bucket);
}

const docsByCode = new Map();
for (const entry of documents.documents) {
  if (!entry.code || entry.error) continue;
  const bucket = docsByCode.get(entry.code) ?? [];
  bucket.push(entry);
  docsByCode.set(entry.code, bucket);
}

/** A document linked from more than one product code is shared. */
const sharedDocuments = documents.documents.filter((entry) => {
  if (entry.error || !entry.sha256) return false;
  const codes = new Set(
    documents.documents.filter((other) => other.sha256 === entry.sha256).map((other) => other.code).filter(Boolean),
  );
  return codes.size > 1;
});

const matchByCode = new Map();
for (const row of match.matches) {
  for (const candidate of row.candidates) {
    const bucket = matchByCode.get(candidate.code) ?? [];
    bucket.push(row);
    matchByCode.set(candidate.code, bucket);
  }
}

/* -------------------------------------------------------------------------- */
/* Manifest                                                                   */
/* -------------------------------------------------------------------------- */

const manifestProducts = catalog.products.map((product) => {
  const productDocs = docsByCode.get(product.code) ?? [];
  const sheets = tdsByCode.get(product.code) ?? [];
  const ourMatches = matchByCode.get(product.code) ?? [];

  return {
    key: product.code,
    manufacturer: "BASF Coatings GmbH",
    brand: "NORBIN",
    code: product.code,
    officialProductName: product.officialName,
    family: familyOf(product.code),
    // Existing in the manufacturer catalogue is not an offer.
    catalogStatus: ourMatches.length ? "matched-candidate" : "manufacturer-catalog-candidate",
    soldByCarsystem: false,
    availability: product.availability,
    regions: product.regions,
    variants: product.variants,
    tdsDocuments: productDocs.filter((entry) => entry.documentType === "tds").map((entry) => ({
      fileName: entry.fileName, sha256: entry.sha256, sourceUrl: entry.sourceUrl,
      availability: entry.availability, regions: entry.regions,
      classificationConfidence: entry.classificationConfidence,
    })),
    sdsDocuments: productDocs.filter((entry) => entry.documentType === "sds").map((entry) => ({
      fileName: entry.fileName, sha256: entry.sha256, sourceUrl: entry.sourceUrl,
      packSize: entry.packSize, availability: entry.availability,
    })),
    tdsClaims: sheets.flatMap((record) => record.claims),
    relationships: sheets.flatMap((record) => record.relationships),
    ourProducts: ourMatches.map((row) => ({
      slug: row.localSlug, name: row.localName, confidence: row.confidence,
    })),
    // The site publishes neither product pages nor product photography.
    officialProductUrl: undefined,
    officialImage: undefined,
    officialDescription: undefined,
    websiteClaims: [],
    published: false,
  };
});

const completeness = {
  total: manifestProducts.length,
  withOfficialName: manifestProducts.filter((entry) => entry.officialProductName).length,
  withTds: manifestProducts.filter((entry) => entry.tdsDocuments.length).length,
  withSds: manifestProducts.filter((entry) => entry.sdsDocuments.length).length,
  withTdsClaims: manifestProducts.filter((entry) => entry.tdsClaims.length).length,
  withVariants: manifestProducts.filter((entry) => entry.variants.length).length,
  withImage: 0,
  withManufacturerDescription: 0,
  complete: manifestProducts.filter((entry) => entry.officialProductName && entry.tdsDocuments.length && entry.tdsClaims.length).length,
};

const manifest = {
  brandSlug: "norbin",
  brandName: "NORBIN",
  manufacturer: "BASF Coatings GmbH",
  generatedAt,
  source: catalog.summary.source,
  sourceArchitecture: catalog.summary.sourceArchitecture,
  brandOwnerVerifiedFrom: catalog.summary.brandOwnerVerifiedFrom,
  acquisition: {
    products: catalog.summary.products,
    liveProducts: catalog.summary.liveProducts,
    unlinkedOnlyProducts: catalog.summary.unlinkedOnlyProducts,
    variants: catalog.summary.variants,
    documents: documents.summary.discovered,
    tds: documents.summary.byType?.tds ?? 0,
    sds: documents.summary.byType?.sds ?? 0,
    brochures: (documents.summary.byType?.brochure ?? 0) + (documents.summary.byType?.["technical-poster"] ?? 0),
    tdsClaims: tds?.summary.totalClaims ?? 0,
    relationships: tds?.summary.relationships ?? 0,
    // Neither exists on this source; recorded as zero rather than omitted.
    productPages: 0,
    productImages: 0,
    websiteClaims: 0,
  },
  regionStatus: catalog.summary.regionStatus,
  matching: match.summary,
  completeness,
  sharedDocuments: sharedDocuments.length,
  products: manifestProducts,
};

mkdirSync("data/knowledge/brands", { recursive: true });
writeFileSync("data/knowledge/brands/norbin.manifest.generated.json", `${JSON.stringify(manifest, null, 2)}\n`);

/* -------------------------------------------------------------------------- */
/* Expert package                                                             */
/* -------------------------------------------------------------------------- */

const lines = [];
const push = (line = "") => lines.push(line);
const ACTIONS = "[ ] POTVRDI  [ ] ISPRAVI  [ ] ODBACI  [ ] DODATI U NAŠU PONUDU";

push("# NORBIN — stručni pregled proizvoda i tehničkih podataka");
push();
push(`Datum: ${generatedAt.slice(0, 10)}`);
push();
push("> **Vaš zadatak nije da proveravate SEO.** Proverite da li su tehničke tvrdnje i njihovo tumačenje ispravni prema dokumentaciji i praksi.");
push();
push("**Proizvođač:** BASF Coatings GmbH  ·  **Brend:** NORBIN®  ·  **Izvor:** norbin-paint.com");
push();
push("| Stavka | Broj |");
push("| --- | ---: |");
push(`| Naših proizvoda | ${match.summary.ourProducts} |`);
push(`| Proizvoda kod proizvođača | ${catalog.summary.products} |`);
push(`| — objavljenih | ${catalog.summary.liveProducts} |`);
push(`| — samo u zakomentarisanom kodu | ${catalog.summary.unlinkedOnlyProducts} |`);
push(`| Tehničkih listova | ${documents.summary.byType?.tds ?? 0} |`);
push(`| Bezbednosnih listova | ${documents.summary.byType?.sds ?? 0} |`);
push(`| Tehničkih tvrdnji | ${tds?.summary.totalClaims ?? 0} |`);
push(`| Deklarisanih veza proizvod↔komponenta | ${tds?.summary.relationships ?? 0} |`);
push();
push("> Proizvođač **ne objavljuje** stranice proizvoda ni fotografije. Slika i opisa sa sajta nema — to je stanje izvora, ne praznina u obradi.");
push();
push("Ništa nije objavljeno. Sve tvrdnje su `machine-extracted` / za proveru.");
push();
push("---");
push();

/* -- Part 1 --------------------------------------------------------------- */

push("# DEO 1 — NAŠI PROIZVODI");
push();
for (const row of match.matches) {
  const best = row.candidates[0];
  const sheets = best ? (tdsByCode.get(best.code) ?? []) : [];
  const claims = sheets.flatMap((record) => record.claims);
  const productDocs = best ? (docsByCode.get(best.code) ?? []) : [];

  push(`## ${row.localName}`);
  push();
  push("| Polje | Vrednost |");
  push("| --- | --- |");
  push(`| NAŠ PROIZVOD | ${row.localName} (\`${row.localSku ?? "—"}\`) |`);
  push(`| ZVANIČNI PROIZVOD | ${best?.officialName ?? "—"} |`);
  push(`| ŠIFRA | ${row.code ?? best?.code ?? "—"} |`);
  push(`| POKLAPANJE | **${row.confidence}** |`);
  push(`| ZVANIČNI OPIS | ${claims.find((claim) => claim.field === "intendedUse")?.value ?? "proizvođač ne objavljuje opis na sajtu"} |`);
  push(`| SLIKA | proizvođač ne objavljuje fotografije proizvoda |`);
  push(`| WEBSITE CLAIMS | nema — sajt nema stranice proizvoda |`);
  push(`| TDS | ${productDocs.filter((entry) => entry.documentType === "tds").length} |`);
  push(`| SDS | ${productDocs.filter((entry) => entry.documentType === "sds").length} |`);
  push(`| TEHNIČKE TVRDNJE | ${claims.length} |`);
  push(`| PODLOGE / NAMENA | ${claims.filter((claim) => claim.field === "substrate").map((claim) => claim.value).join("; ") || claims.find((claim) => claim.field === "intendedUse")?.value || "nije navedeno"} |`);
  push(`| POVEZANI PROIZVODI | ${sheets.flatMap((record) => record.relationships).map((entry) => `${entry.partnerCode}${entry.ratio ? ` (${entry.ratio})` : ""}`).join(", ") || "—"} |`);
  push(`| NESLAGANJA | ${row.confidence === "exact-code" && row.variantMatchesManufacturer === false ? "pakovanje se ne poklapa sa proizvođačem" : "nema"} |`);
  push(`| ŠTA NEDOSTAJE | ${[!productDocs.some((entry) => entry.documentType === "tds") && "tehnički list", !claims.length && "tehničke tvrdnje", "slika proizvođača", "opis sa sajta"].filter(Boolean).join(", ")} |`);
  push();
  for (const item of row.evidence ?? []) push(`- ${item}`);
  push();
  if (row.confidence !== "exact-code") {
    push("**Kandidati:**");
    push();
    for (const candidate of row.candidates.slice(0, 6)) {
      push(`- \`${candidate.code}\` ${candidate.officialName} — regioni: ${candidate.regions.join(", ") || "—"}`);
    }
    push();
  }
  push(ACTIONS);
  push();
}
push("---");
push();

/* -- Part 2: by family ----------------------------------------------------- */

push("# DEO 2 — KATALOG PROIZVOĐAČA PO PORODICI");
push();
push("> Svi zapisi imaju status `manufacturer-catalog-candidate`. To **nije** tvrdnja da ih Carsystem i R-M prodaje.");
push();

const families = new Map();
for (const product of manifestProducts) {
  const bucket = families.get(product.family) ?? [];
  bucket.push(product);
  families.set(product.family, bucket);
}

for (const [family, group] of [...families.entries()].sort()) {
  push(`## ${family} — ${FAMILY_SR[family] ?? family} (${group.length})`);
  push();
  for (const product of group.sort((a, b) => a.code.localeCompare(b.code))) {
    const claims = product.tdsClaims;
    push(`### \`${product.code}\` ${product.officialProductName ?? "(bez naziva)"}`);
    push();
    push(
      `Regioni: ${product.regions.join(", ") || "—"}${product.availability === "unlinked-in-source" ? " · **nije objavljen — zakomentarisan u izvoru**" : ""}`,
    );
    if (product.ourProducts.length) {
      push();
      push(`**U našoj ponudi:** ${product.ourProducts.map((entry) => `${entry.name} (${entry.confidence})`).join(", ")}`);
    }
    push();

    if (product.variants.length) {
      push(`**Varijante / pakovanja:** ${product.variants.map((entry) => entry.packSize).join(", ")}`);
      push();
    }
    if (product.relationships.length) {
      push(
        `**Komponente (deklarisano u tehničkom listu):** ${[...new Set(product.relationships.map((entry) => `${entry.partnerCode}${entry.ratio ? ` ${entry.ratio}` : ""}`))].join(", ")}`,
      );
      push();
    }

    if (claims.length) {
      push("| Polje | Vrednost | Uslov | Metod | Oprema | Str. |");
      push("| --- | --- | --- | --- | --- | ---: |");
      for (const claim of claims.slice(0, 25)) {
        push(
          `| ${FIELD_SR[claim.field] ?? claim.field} | ${String(claim.value).slice(0, 70)}${claim.unit && !String(claim.value).includes(claim.unit) ? ` ${claim.unit}` : ""} | ${claim.condition ?? "—"} | ${claim.measurementMethod ?? "—"} | ${claim.applicationEquipment ?? (claim.equipmentScopeAmbiguous ? "**neodređeno**" : "—")} | ${claim.page} |`,
        );
      }
      if (claims.length > 25) push(`| … | _još ${claims.length - 25} tvrdnji u manifestu_ | | | | |`);
    } else {
      push("_Nema tehničkih tvrdnji — proverite da li tehnički list postoji._");
    }
    push();
    push(`TDS: ${product.tdsDocuments.length} · SDS: ${product.sdsDocuments.length}`);
    push();
    push(ACTIONS);
    push();
  }
}

/* -- Part 3: shared, ambiguous, gaps --------------------------------------- */

push("---");
push();
push("# DEO 3 — DELJENI DOKUMENTI");
push();
if (sharedDocuments.length) {
  push("| Dokument | Šifre |");
  push("| --- | --- |");
  const seen = new Set();
  for (const entry of sharedDocuments) {
    if (seen.has(entry.sha256)) continue;
    seen.add(entry.sha256);
    const codes = [...new Set(documents.documents.filter((other) => other.sha256 === entry.sha256).map((other) => other.code).filter(Boolean))];
    push(`| \`${entry.fileName.slice(0, 55)}\` | ${codes.join(", ")} |`);
  }
} else {
  push("Nema dokumenata koji pokrivaju više šifara.");
}
push();

push("# DEO 4 — NEODREĐENA MAPIRANJA I PRAZNINE");
push();
push("| Praznina | Broj |");
push("| --- | ---: |");
push(`| Proizvoda bez tehničkog lista | ${completeness.total - completeness.withTds} |`);
push(`| Proizvoda bez bezbednosnog lista | ${completeness.total - completeness.withSds} |`);
push(`| Proizvoda bez tehničkih tvrdnji | ${completeness.total - completeness.withTdsClaims} |`);
push(`| Proizvoda samo u zakomentarisanom kodu | ${catalog.summary.unlinkedOnlyProducts} |`);
push(`| Tvrdnji gde tip pištolja nije određen | ${tds?.summary.equipmentAmbiguous ?? 0} |`);
push(`| Pokvarenih linkova ka dokumentima kod proizvođača | ${documents.summary.failed} |`);
push(`| Neobjavljenih regionalnih sajtova | ${(catalog.summary.unpublishedRegions ?? []).length} (${(catalog.summary.unpublishedRegions ?? []).join(", ")}) |`);
push(`| Slika proizvođača | 0 — izvor ih ne objavljuje |`);
push();

const ambiguousEquipment = (tds?.records ?? []).flatMap((record) =>
  record.claims.filter((claim) => claim.equipmentScopeAmbiguous).map((claim) => ({ record, claim })),
);
if (ambiguousEquipment.length) {
  push("### Tvrdnje gde tip pištolja nije određen");
  push();
  push("> Tehnički list prikazuje dve kolone (HVLP i Compliant), ali je u ovim redovima navedena samo jedna vrednost. Kojoj opremi pripada nije rečeno, pa nije pripisana nijednoj.");
  push();
  push("| Šifra | Polje | Vrednost | Dokument | Str. |");
  push("| --- | --- | --- | --- | ---: |");
  for (const { record, claim } of ambiguousEquipment.slice(0, 25)) {
    push(`| ${record.code ?? "—"} | ${FIELD_SR[claim.field] ?? claim.field} | ${String(claim.value).slice(0, 40)} | \`${record.documentFileName.slice(0, 40)}\` | ${claim.page} |`);
  }
  push();
}

push("---");
push();
push("# DEO 5 — PROIZVODI SAMO KOD PROIZVOĐAČA");
push();
push(`${match.summary.manufacturerOnlyCandidates} proizvoda postoji u zvaničnom katalogu, a nije u našoj ponudi.`);
push();
push("| Šifra | Naziv | Regioni | Status |");
push("| --- | --- | --- | --- |");
for (const entry of match.manufacturerOnly) {
  push(
    `| \`${entry.code}\` | ${entry.officialName ?? "—"} | ${entry.regions.join(", ") || "—"} | ${entry.availability === "live" ? "objavljen" : "zakomentarisan u izvoru"} |`,
  );
}
push();
push(ACTIONS);
push();

mkdirSync("docs/seo", { recursive: true });
writeFileSync("docs/seo/EXPERT_REVIEW_NORBIN.md", `${lines.join("\n")}\n`);

console.log(
  JSON.stringify(
    {
      manifestProducts: manifestProducts.length,
      completeness,
      sharedDocuments: sharedDocuments.length,
      relationships: tds?.summary.relationships ?? 0,
      manufacturerOnly: match.summary.manufacturerOnlyCandidates,
    },
    null,
    2,
  ),
);
