#!/usr/bin/env node
/**
 * Phase 3, steps 5 & 7 — substrate matrix and contradiction detection.
 *
 * Two jobs:
 *
 *   1. Build the PRODUCT × SUBSTRATE matrix with four *distinct* states. The
 *      critical one is NOT STATED, which must never collapse into "not
 *      supported" — a sheet's silence about aluminium is not a prohibition.
 *
 *   2. Detect contradictions between claims without resolving them. A conflict
 *      record keeps both sources and is marked for expert review; a reason is
 *      stated only where the evidence itself supplies one.
 *
 * Output: docs/seo/RM_SUBSTRATE_MATRIX.md, docs/seo/RM_EXTRACTION_CONFLICTS.json
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const extraction = JSON.parse(
  readFileSync("data/knowledge/rm-technical-extraction.generated.json", "utf8"),
);
const records = extraction.records;

const SUBSTRATES = [
  { slug: "celik", name: "Čelik" },
  { slug: "pocinkovani-lim", name: "Pocinkovani lim" },
  { slug: "aluminijum", name: "Aluminijum" },
  { slug: "e-coat", name: "E-coat (OEM)" },
  { slug: "stari-lak", name: "Stari lak" },
  { slug: "stakloplastika", name: "GRP / SMC" },
  { slug: "plastika", name: "Plastika" },
  { slug: "poliesterski-kit", name: "Kit" },
  { slug: "temeljna-boja", name: "Temeljni sloj" },
];

/* -------------------------------------------------------------------------- */
/* Substrate matrix                                                           */
/* -------------------------------------------------------------------------- */

const STATE = {
  supported: "EXPLICITLY SUPPORTED",
  requiresPrimer: "SUPPORTED IF PRIMED",
  prohibited: "EXPLICITLY NOT SUPPORTED",
  ambiguous: "AMBIGUOUS — EXPERT REVIEW",
  notStated: "NOT STATED",
};

const matrix = [];
for (const record of records) {
  const claim = record.claims.find((item) => item.field === "substrates");
  const warningsClaim = record.claims.find((item) => item.field === "warnings");

  const row = {
    productSlug: record.productSlug,
    productCode: record.productCode,
    productName: record.productName,
    category: record.category,
    hasSubstrateStatement: Boolean(claim),
    documentHref: record.documentHref,
    page: claim?.page,
    cells: {},
    unmapped: [],
  };

  for (const substrate of SUBSTRATES) {
    row.cells[substrate.slug] = STATE.notStated;
  }

  if (claim) {
    for (const entry of claim.value ?? []) {
      if (entry.unmapped) {
        row.unmapped.push(entry.sourceText);
        continue;
      }
      for (const slug of entry.slugs) {
        row.cells[slug] =
          entry.suitability === "requires-primer"
            ? STATE.requiresPrimer
            : STATE.supported;
      }
    }
  }

  // An explicit substrate prohibition in the warnings, e.g. "Do not use on
  // blasted substrates." The substrate named there is outside the controlled
  // vocabulary, so it is recorded as an ambiguity for the expert rather than
  // forced onto a slug.
  const substrateProhibitions = (warningsClaim?.value ?? []).filter((warning) =>
    /\bsubstrate|\bmetal\b|\bsteel\b|\balumini/i.test(warning),
  );
  row.prohibitionStatements = substrateProhibitions;

  matrix.push(row);
}

const withStatement = matrix.filter((row) => row.hasSubstrateStatement);

/* -------------------------------------------------------------------------- */
/* Conflict detection                                                          */
/* -------------------------------------------------------------------------- */

const conflicts = [];

/**
 * Same product code appearing in more than one source document with different
 * values. The archive has one TDS per product, so this mainly guards against a
 * future second revision being added.
 */
const byCode = new Map();
for (const record of records) {
  const bucket = byCode.get(record.productCode) ?? [];
  bucket.push(record);
  byCode.set(record.productCode, bucket);
}
for (const [code, group] of byCode) {
  if (group.length < 2) continue;
  conflicts.push({
    type: "duplicate-source-document",
    productCode: code,
    detail: `${group.length} dokumenta za istu šifru proizvoda.`,
    sources: group.map((item) => ({ href: item.documentHref, revision: item.revision })),
    resolution: "EXPERT REVIEW REQUIRED",
  });
}

/**
 * A referenced hardener/thinner code that the sheet names but the Carsystem
 * catalogue does not stock. Not a contradiction in the source — a gap between
 * source and catalogue — but it needs a human decision either way.
 */
for (const record of records) {
  for (const field of ["hardenerProductSlugs", "thinnerProductSlugs"]) {
    const claim = record.claims.find((item) => item.field === field);
    if (!claim?.note) continue;
    if (!/nis[ue] u Carsystem katalogu|nije u katalogu/.test(claim.note)) continue;
    conflicts.push({
      type: "referenced-product-not-in-catalogue",
      productSlug: record.productSlug,
      productCode: record.productCode,
      field,
      detail: claim.note,
      sourceExcerpt: claim.rawText,
      documentHref: record.documentHref,
      page: claim.page,
      resolution: "EXPERT REVIEW REQUIRED",
    });
  }
}

/**
 * Products in the same R-M system that state different mixing ratios.
 *
 * Reported as an observation, never auto-resolved: different ratios across
 * products in one system are usually legitimate (different product types), so
 * this is a prompt for a human, not a defect.
 */
const rmData = JSON.parse(
  readFileSync("data/rm-imported-products.generated.json", "utf8"),
);
const systemBySlug = new Map(
  (rmData.products ?? []).map((product) => [product.slug, product.taxonomy?.system]),
);

const ratioByCategorySystem = new Map();
for (const record of records) {
  const claim = record.claims.find((item) => item.field === "mixingRatio");
  if (!claim?.value?.ratio) continue;
  const key = `${record.category}::${systemBySlug.get(record.productSlug) ?? "—"}`;
  const bucket = ratioByCategorySystem.get(key) ?? [];
  bucket.push({
    productCode: record.productCode,
    ratio: claim.value.ratio,
    documentHref: record.documentHref,
    page: claim.page,
  });
  ratioByCategorySystem.set(key, bucket);
}
for (const [key, entries] of ratioByCategorySystem) {
  const ratios = [...new Set(entries.map((entry) => entry.ratio))];
  if (ratios.length < 2) continue;
  conflicts.push({
    type: "differing-mixing-ratio-within-system",
    group: key,
    detail: `Ista kategorija i sistem, različiti odnosi mešanja: ${ratios.join(" / ")}.`,
    sources: entries,
    resolution: "EXPERT REVIEW REQUIRED",
    note:
      "Razlika je verovatno legitimna (različiti proizvodi), ali nije potvrđena izvorom. Ne razrešavati automatski.",
  });
}

/** Same substrate given two different states within one product. */
for (const row of matrix) {
  if (!row.hasSubstrateStatement) continue;
  const record = records.find((item) => item.productSlug === row.productSlug);
  const claim = record.claims.find((item) => item.field === "substrates");
  const seen = new Map();
  for (const entry of claim.value ?? []) {
    for (const slug of entry.slugs) {
      const previous = seen.get(slug);
      if (previous && previous !== entry.suitability) {
        conflicts.push({
          type: "conflicting-substrate-state",
          productSlug: row.productSlug,
          productCode: row.productCode,
          detail: `Podloga "${slug}" navedena i kao ${previous} i kao ${entry.suitability}.`,
          documentHref: row.documentHref,
          page: claim.page,
          resolution: "EXPERT REVIEW REQUIRED",
        });
      }
      seen.set(slug, entry.suitability);
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Output                                                                     */
/* -------------------------------------------------------------------------- */

mkdirSync("docs/seo", { recursive: true });
writeFileSync(
  "docs/seo/RM_EXTRACTION_CONFLICTS.json",
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      total: conflicts.length,
      byType: Object.fromEntries(
        [...new Set(conflicts.map((item) => item.type))].map((type) => [
          type,
          conflicts.filter((item) => item.type === type).length,
        ]),
      ),
      conflicts,
    },
    null,
    2,
  )}\n`,
);

const lines = [];
lines.push("# R-M matrica podloga (PROIZVOD × PODLOGA)");
lines.push("");
lines.push(`Datum: ${new Date().toISOString().slice(0, 10)}`);
lines.push("");
lines.push(
  "Izvedeno isključivo iz eksplicitnih izjava u R-M tehničkim listovima, sekcija „Product is suitable on”.",
);
lines.push("");
lines.push("**Legenda**");
lines.push("");
lines.push("| Oznaka | Značenje |");
lines.push("| --- | --- |");
lines.push("| `✓` | Eksplicitno navedena kao podržana |");
lines.push("| `P` | Podržana **samo ako je prethodno temeljena** (uslovna izjava u listu) |");
lines.push("| `✗` | Eksplicitno zabranjena |");
lines.push("| `–` | **Nije navedeno.** Ne znači da je nekompatibilna. |");
lines.push("");
lines.push(
  "> Razlika između `–` i `✗` je najvažnija stavka u ovom dokumentu. Tehnički list koji ne pominje aluminijum ne zabranjuje aluminijum; on o njemu ćuti.",
);
lines.push("");
lines.push(
  `Od ${matrix.length} proizvoda sa čitljivim tehničkim listom, **${withStatement.length}** sadrži eksplicitnu izjavu o podlozi.`,
);
lines.push("");

lines.push(`| Proizvod | Šifra | ${SUBSTRATES.map((s) => s.name).join(" | ")} | Strana |`);
lines.push(`| --- | --- | ${SUBSTRATES.map(() => ":---:").join(" | ")} | ---: |`);
const symbol = {
  [STATE.supported]: "✓",
  [STATE.requiresPrimer]: "P",
  [STATE.prohibited]: "✗",
  [STATE.ambiguous]: "?",
  [STATE.notStated]: "–",
};
for (const row of withStatement) {
  const cells = SUBSTRATES.map((s) => symbol[row.cells[s.slug]]).join(" | ");
  lines.push(`| ${row.productName} | ${row.productCode} | ${cells} | ${row.page} |`);
}
lines.push("");

const notStated = matrix.filter((row) => !row.hasSubstrateStatement);
lines.push("## Proizvodi bez ijedne izjave o podlozi");
lines.push("");
lines.push(
  `${notStated.length} proizvoda. Za svaki od njih matrica je u celosti „nije navedeno”. To **nije** podatak o nekompatibilnosti.`,
);
lines.push("");
lines.push("| Proizvod | Šifra | Kategorija |");
lines.push("| --- | --- | --- |");
for (const row of notStated) {
  lines.push(`| ${row.productName} | ${row.productCode} | ${row.category} |`);
}
lines.push("");

const prohibitions = matrix.filter((row) => row.prohibitionStatements?.length);
if (prohibitions.length) {
  lines.push("## Eksplicitna ograničenja vezana za podlogu");
  lines.push("");
  lines.push("| Proizvod | Izjava iz lista |");
  lines.push("| --- | --- |");
  for (const row of prohibitions) {
    for (const statement of row.prohibitionStatements) {
      lines.push(`| ${row.productCode} | ${statement} |`);
    }
  }
  lines.push("");
}

const unmapped = matrix.filter((row) => row.unmapped.length);
if (unmapped.length) {
  lines.push("## Formulacije van kontrolisanog rečnika");
  lines.push("");
  lines.push(
    "Ove izjave o podlozi nisu automatski mapirane jer nisu u rečniku iz Faze 2. Zahtevaju odluku stručnjaka.",
  );
  lines.push("");
  lines.push("| Proizvod | Formulacija iz lista |");
  lines.push("| --- | --- |");
  for (const row of unmapped) {
    for (const text of row.unmapped) {
      lines.push(`| ${row.productCode} | ${text} |`);
    }
  }
  lines.push("");
}

writeFileSync("docs/seo/RM_SUBSTRATE_MATRIX.md", `${lines.join("\n")}\n`);

const substrateCoverage = Object.fromEntries(
  SUBSTRATES.map((substrate) => [
    substrate.slug,
    {
      supported: matrix.filter((row) => row.cells[substrate.slug] === STATE.supported).length,
      requiresPrimer: matrix.filter(
        (row) => row.cells[substrate.slug] === STATE.requiresPrimer,
      ).length,
      notStated: matrix.filter((row) => row.cells[substrate.slug] === STATE.notStated).length,
    },
  ]),
);

console.log(
  JSON.stringify(
    {
      products: matrix.length,
      withSubstrateStatement: withStatement.length,
      withoutSubstrateStatement: notStated.length,
      substrateCoverage,
      conflicts: conflicts.length,
      conflictsByType: Object.fromEntries(
        [...new Set(conflicts.map((item) => item.type))].map((type) => [
          type,
          conflicts.filter((item) => item.type === type).length,
        ]),
      ),
    },
    null,
    2,
  ),
);
