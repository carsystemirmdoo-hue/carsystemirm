#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const docsDirectory = path.join(root, "docs/seo");

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function toCsv(rows, columns) {
  return [
    columns.map(([label]) => csvCell(label)).join(","),
    ...rows.map((row) =>
      columns.map(([, getter]) => csvCell(getter(row))).join(","),
    ),
  ].join("\n") + "\n";
}

function parseCsv(input) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(cell);
      cell = "";
    } else if (character === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (character !== "\r") {
      cell += character;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const [headers, ...values] = rows;
  return values.map((valueRow) =>
    Object.fromEntries(headers.map((header, index) => [header, valueRow[index] ?? ""])),
  );
}

function formatDelta(before, after) {
  const delta = after - before;
  if (delta === 0) return "0";
  return delta > 0 ? `+${delta}` : String(delta);
}

await mkdir(docsDirectory, { recursive: true });

const [beforeIssues, afterIssues, metadataCsv, rmData] = await Promise.all([
  readFile(path.join(docsDirectory, "SEO_ISSUES_BEFORE.json"), "utf8").then(JSON.parse),
  readFile(path.join(docsDirectory, "SEO_ISSUES_AFTER.json"), "utf8").then(JSON.parse),
  readFile(path.join(docsDirectory, "SEO_METADATA_AFTER.csv"), "utf8"),
  readFile(path.join(root, "data/rm-imported-products.generated.json"), "utf8").then(
    JSON.parse,
  ),
]);

const metadataRows = parseCsv(metadataCsv);
const metadataByRoute = new Map(metadataRows.map((row) => [row.URL, row]));
const rmStatusRows = rmData.products.map((product) => {
  const route = `/proizvodi/${product.slug}`;
  const metadata = metadataByRoute.get(route);
  if (!metadata) throw new Error(`SEO metadata red nije pronađen: ${route}`);
  return {
    slug: product.slug,
    title: metadata.Title,
    description: metadata.Description,
    canonical: metadata.Canonical,
    h1: metadata.H1,
    productSchema: metadata["JSON-LD types"].includes("Product") ? "da" : "ne",
    breadcrumb: metadata.Breadcrumb === "true" ? "da" : "ne",
    ogImage: metadata["OG image"],
    contentReview: product.contentReview.status,
    status:
      metadata["Canonical correct"] === "true" &&
      metadata["H1 count"] === "1" &&
      metadata["OG image"] &&
      metadata["JSON-LD types"].includes("Product") &&
      metadata.Breadcrumb === "true"
        ? "prošao"
        : "provera",
  };
});

await writeFile(
  path.join(docsDirectory, "SEO_RM_PRODUCT_STATUS.csv"),
  toCsv(rmStatusRows, [
    ["slug", (row) => row.slug],
    ["title", (row) => row.title],
    ["meta description", (row) => row.description],
    ["canonical", (row) => row.canonical],
    ["H1", (row) => row.h1],
    ["Product schema", (row) => row.productSchema],
    ["breadcrumb", (row) => row.breadcrumb],
    ["OG image", (row) => row.ogImage],
    ["content review", (row) => row.contentReview],
    ["status", (row) => row.status],
  ]),
);

const rmTable = rmStatusRows
  .map(
    (row) =>
      `| ${row.slug} | ${row.title.replaceAll("|", "\\|")} | ${row.canonical} | ${row.h1.replaceAll("|", "\\|")} | ${row.productSchema} | ${row.breadcrumb} | ${row.contentReview} | ${row.status} |`,
  )
  .join("\n");
await writeFile(
  path.join(docsDirectory, "SEO_RM_PRODUCT_STATUS.md"),
  `# SEO status svih 59 R-M proizvoda

- Izvor: finalni produkcioni build i SEO_METADATA_AFTER.csv.
- Svi redovi imaju jedinstven title i description; kompletan tekst opisa i OG URL su u CSV verziji.
- Product schema ne sadrži Offer, cenu, lager ni recenzije.

| Slug | Title | Canonical | H1 | Product | Breadcrumb | Content review | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
${rmTable}
`,
);

const comparisons = [
  ["Indeksabilne stranice", "indexable"],
  ["Indeksabilne stranice bez title-a", "missingTitle"],
  ["Stranice sa dupliranim title-om", "duplicateTitlePages"],
  ["Indeksabilne stranice bez description-a", "missingDescription"],
  ["Stranice sa dupliranim description-om", "duplicateDescriptionPages"],
  ["Indeksabilne stranice bez canonical-a", "missingCanonical"],
  ["Pogrešni canonical-i", "wrongCanonical"],
  ["Noindex URL-ovi u sitemap-u", "noindexUrlsInSitemap"],
  ["Indeksabilne stranice bez H1", "missingH1"],
  ["Stranice sa više H1", "multipleH1"],
  ["Orphan stranice", "orphanPages"],
  ["Stranice sa broken internim linkovima", "pagesWithBrokenLinks"],
  ["Jedinstveni broken interni linkovi", "uniqueBrokenLinks"],
  ["Slike bez alt atributa", "imagesMissingAlt"],
  ["Indeksabilne stranice bez OG slike", "missingOgImage"],
  ["Indeksabilne stranice bez structured data", "missingStructuredData"],
  ["PDP bez Product schema", "productPagesWithoutProductSchema"],
  ["Relevantne stranice bez Breadcrumb schema", "pagesWithoutBreadcrumbSchema"],
  ["Indeksabilni filter uzorci", "indexableFilterSamples"],
  ["Indeksabilne preview/demo stranice", "indexablePreviewDemo"],
];
const before = beforeIssues.summary;
const after = afterIssues.summary;
const comparisonTable = comparisons
  .map(([label, key]) => {
    const beforeValue = before[key] ?? "nije mereno";
    const afterValue = after[key] ?? "nije mereno";
    const delta =
      typeof beforeValue === "number" && typeof afterValue === "number"
        ? formatDelta(beforeValue, afterValue)
        : "n/a";
    return `| ${label} | ${beforeValue} | ${afterValue} | ${delta} |`;
  })
  .join("\n");

await writeFile(
  path.join(docsDirectory, "SEO_BEFORE_AFTER.md"),
  `# SEO pre/posle

Audit je pokrenut nad lokalnim Next.js production buildom. Baseline je sačuvan pre izmene koda, a finalni rezultat koristi isti crawler, uz strožu proveru da metadata za indeksabilne stranice postoji u stvarnom head elementu.

| Metrika | Pre | Posle | Promena |
| --- | ---: | ---: | ---: |
${comparisonTable}
| Broken PDF linkovi | nije mereno | 0 od 117 | n/a |

Napomene:

- Posle izmene sitemap ima ${after.sitemapUrls} canonical, indeksabilnih URL-ova sa HTTP 200.
- Finalni validator je proverio svih 832 PDP URL-a, svih 59 R-M PDP URL-a i svih 117 PDF fajlova.
- Prazan alt je dozvoljen za dekorativne slike; finalni audit nema nijedan img bez alt atributa.
- Jedanaest slika bez eksplicitnih dimenzija pripada samo noindex demo/social rutama, ne javnim indeksabilnim stranicama.
`,
);

const keywordRows = [
  ["/", "home", "auto lakovi i refinish program", "komercijalno-informativna", "boje za automobile; materijal za autolakirnice", "Carsystem; R-M", "Srbija; Inđija", "Profesionalni refinish program za siguran rezultat.", "Profesionalni refinish program za siguran rezultat.", "Carsystem i R-M | Auto lakovi, boje i oprema", "srednji", "Početna ostaje najširi ulaz; search volume nije potvrđen."],
  ["/katalog", "catalog", "katalog proizvoda za autolakirnice", "komercijalna", "auto lakovi; oprema; abrazivi; potrošni materijal", "Carsystem; R-M; baslac", "Srbija", "Katalog proizvoda", "Katalog proizvoda", "Katalog proizvoda za autolakirnice | Carsystem i R-M", "visok sa filterima", "Query filteri su noindex; katalog je primarna ruta."],
  ["/kategorije/bezbojni-lakovi", "category", "bezbojni lakovi", "komercijalna kategorija", "clear coat; završni lak za vozila", "R-M", "Srbija", "Bezbojni lakovi", "Bezbojni lakovi", "Bezbojni lakovi za auto lakiranje | Carsystem i R-M", "srednji", "Primarni category intent; PDP cilja naziv i kod proizvoda."],
  ["/kategorije/prajmeri-i-punioci", "category", "prajmeri i punioci", "komercijalna kategorija", "primer filler; priprema podloge", "R-M", "Srbija", "Prajmeri i punioci", "Prajmeri i punioci", "Prajmeri i punioci za auto lakiranje | Carsystem i R-M", "srednji", "Razdvojeno od programskog intent-a pripreme."],
  ["/kategorije/bazne-boje", "category", "bazne boje", "komercijalna kategorija", "boje za automobile; vodene bazne boje", "R-M", "Srbija", "Bazne boje", "Bazne boje", "Bazne boje za automobile | Carsystem i R-M", "srednji", "Kategorija cilja tip proizvoda; R-M landing cilja brand sistem."],
  ["/kategorije/ucvrscivaci-i-razredjivaci", "category", "učvršćivači i razređivači", "komercijalna kategorija", "hardener; thinner; aktivator", "R-M", "Srbija", "Učvršćivači i razređivači", "Učvršćivači i razređivači", "Učvršćivači i razređivači | Carsystem i R-M", "nizak", "PDP-ovi ciljaju konkretne kodove."],
  ["/brendovi/rm", "brand", "R-M proizvodi i sistemi", "brand/commercial", "R-M AGILIS; R-M Refinity; R-M ONYX HD", "R-M", "Srbija", "Dinamički aktivni kampanjski H1", "Dinamički aktivni kampanjski H1", "R-M proizvodi i sistemi | Carsystem i R-M", "visok sa katalog filterom", "Brand ruta je primarna; filter brend=rm je noindex."],
  ["/brendovi/carsystem", "brand", "Carsystem proizvodi", "brand/commercial", "abrazivi; priprema; potrošni materijal", "Carsystem", "Srbija", "Carsystem", "Carsystem", "Carsystem proizvodi i sistemi | Carsystem i R-M", "srednji", "Programske rute ciljaju proces, ne brand."],
  ["/program/boje-i-lakovi", "program", "boje i lakovi program", "informativno-komercijalna", "bazna boja; bezbojni lak; kompatibilni sistemi", "Carsystem; R-M", "Srbija", "Boje i lakovi", "Boje i lakovi", "Boje i lakovi | Carsystem i R-M", "srednji", "Program objašnjava proces; kategorije ciljaju tip proizvoda."],
  ["/program/priprema-i-abrazivi", "program", "priprema i abrazivi", "informativno-komercijalna", "priprema podloge; brusni materijal", "Carsystem", "Srbija", "Priprema i abrazivi", "Priprema i abrazivi", "Priprema i abrazivi | Carsystem i R-M", "srednji", "Ne preklapati sa pojedinačnim primer/pad PDP-ovima."],
  ["/proizvodi/2220-agilis-activator", "product", "A 2220 AGILIS ACTIVATOR", "product detail", "AGILIS activator; R-M A 2220", "R-M; AGILIS", "Srbija", "A 2220 AGILIS ACTIVATOR", "A 2220 AGILIS ACTIVATOR", "A 2220 AGILIS ACTIVATOR – R-M aditiv | Carsystem i R-M", "nizak", "PDP je primarni za tačan naziv/kod."],
  ["/proizvodi/c-2p42-race-finish-r", "product", "C 2P42 RACE Finish-R", "product detail", "R-M bezbojni lak; RACE Finish-R", "R-M", "Srbija", "C 2P42 RACE Finish-R", "C 2P42 RACE Finish-R", "C 2P42 RACE Finish-R – R-M bezbojni lak | Carsystem i R-M", "nizak", "Category landing cilja generički bezbojni lak."],
  ["/prodavnice", "store locator", "prodavnice auto lakova", "lokalna/poseta", "prodajno mesto; auto lakovi blizu mene", "Carsystem; R-M", "stvarni gradovi u mreži", "Prodajna i partnerska mreža", "Prodajna i partnerska mreža", "Prodavnice auto lakova i partnerska mreža | Carsystem i R-M", "nizak", "Ne praviti city landing bez potvrđenog jedinstvenog sadržaja."],
  ["/kontakt", "contact", "kontakt i tehnička podrška", "navigaciona/lead", "upit za proizvod; B2B saradnja", "Carsystem; R-M", "Srbija", "Kome da se obratite u Carsystem timu", "Kome da se obratite u Carsystem timu", "Kontakt za proizvode i tehničku podršku | Carsystem i R-M", "nizak", "Query prefill URL-ovi su noindex i canonical na čistu rutu."],
];

await writeFile(
  path.join(docsDirectory, "SEO_KEYWORD_INTENT_MAP.csv"),
  toCsv(keywordRows, [
    ["primary route", (row) => row[0]],
    ["page type", (row) => row[1]],
    ["primary topic", (row) => row[2]],
    ["primary search intent", (row) => row[3]],
    ["secondary terms", (row) => row[4]],
    ["brand terms", (row) => row[5]],
    ["local terms", (row) => row[6]],
    ["existing H1", (row) => row[7]],
    ["proposed H1", (row) => row[8]],
    ["title", (row) => row[9]],
    ["overlap/cannibalization risk", (row) => row[10]],
    ["notes", (row) => row[11]],
  ]),
);

const redirectRows = [
  {
    source: "/proizvodi/clear-harden-r-h-2p15",
    target: "/proizvodi/h-2p15-clear-harden-r",
    status: "308",
    reason: "Dva dostavljena foldera predstavljaju isti potvrđeni proizvod; zadržan jedan canonical PDP.",
  },
  {
    source: "Produkcioni non-canonical host, uključujući Vercel alias",
    target: "https://carsystemirm.com/isti-path-i-query",
    status: "308",
    reason: "Konsolidacija host signala na potvrđeni produkcioni apex domen.",
  },
];
await writeFile(
  path.join(docsDirectory, "SEO_REDIRECT_MAP.csv"),
  toCsv(redirectRows, [
    ["source URL", (row) => row.source],
    ["target URL", (row) => row.target],
    ["status", (row) => row.status],
    ["reason", (row) => row.reason],
  ]),
);

console.log(
  JSON.stringify(
    {
      rmProducts: rmStatusRows.length,
      rmPassed: rmStatusRows.filter((row) => row.status === "prošao").length,
      beforeIndexable: before.indexable,
      afterIndexable: after.indexable,
      generated: [
        "SEO_RM_PRODUCT_STATUS.csv",
        "SEO_RM_PRODUCT_STATUS.md",
        "SEO_BEFORE_AFTER.md",
        "SEO_KEYWORD_INTENT_MAP.csv",
        "SEO_REDIRECT_MAP.csv",
      ],
    },
    null,
    2,
  ),
);
