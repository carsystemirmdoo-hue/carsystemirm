#!/usr/bin/env node
/**
 * Generates CARSYSTEM_TECHNICAL_CONTENT_REVIEW — the document the Carsystem
 * technical expert fills in.
 *
 * Two governing constraints:
 *
 *   1. Domain knowledge only. No canonical URLs, sitemap entries, metadata,
 *      JSON-LD or SEO configuration. The reviewer is a refinishing expert, and
 *      every line of engineering noise costs their attention.
 *
 *   2. Deduplicated. After Phase 3 there are ~470 extracted claims, but many
 *      are the *same statement from the same kind of source* repeated across
 *      products — 13 primers share one substrate list, dozens share a drying
 *      profile shape. Those are grouped into a single review item listing the
 *      affected products, so the expert makes one decision instead of thirteen.
 *
 * Usage: node scripts/export-technical-review.mjs [--out <path>]
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const outIndex = process.argv.indexOf("--out");
const OUT =
  outIndex > -1
    ? process.argv[outIndex + 1]
    : "docs/seo/CARSYSTEM_TECHNICAL_CONTENT_REVIEW.md";

const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));

const extraction = readJson("data/knowledge/rm-technical-extraction.generated.json");
const conflicts = readJson("docs/seo/RM_EXTRACTION_CONFLICTS.json");
const readiness = readJson("docs/seo/RM_INTENT_READINESS.json");
const inventory = readJson("docs/seo/RM_SOURCE_INVENTORY.json");
const rmData = readJson("data/rm-imported-products.generated.json");

const records = extraction.records;
const nameBySlug = new Map(
  (rmData.products ?? []).map((product) => [product.slug, product.canonicalName]),
);
const codeBySlug = new Map(
  (rmData.products ?? []).map((product) => [product.slug, product.productCode]),
);

/**
 * Display label for a product.
 *
 * `canonicalName` in the R-M import already begins with the product code
 * ("P 2A41 PerformFILLER White"), so prefixing the code again would print it
 * twice.
 */
function labelFor(slug) {
  const name = nameBySlug.get(slug) ?? slug;
  const code = codeBySlug.get(slug);
  if (!code || name.startsWith(code)) return name;
  return `${code} ${name}`;
}

const lines = [];
const push = (...values) => lines.push(...values);
let itemCount = 0;

function checkboxes() {
  push("");
  push("- [ ] TAČNO");
  push("- [ ] TAČNO UZ IZMENE");
  push("- [ ] NETAČNO");
  push("- [ ] NE OBJAVLJIVATI");
  push("");
  push("**NAPOMENA STRUČNJAKA:**");
  push("");
  push("> ");
  push("");
  push("---");
  push("");
}

/** One review item. `products` may be one entry or a deduplicated group. */
function reviewItem({ title, proposed, products, source, page, support, note }) {
  itemCount += 1;
  push(`### ${itemCount}. ${title}`);
  push("");
  if (proposed !== undefined) {
    push("**PREDLOŽENA VREDNOST**");
    push("");
    push(proposed);
    push("");
  }
  if (products?.length) {
    push(`**PRIMENJIVI PROIZVODI (${products.length})**`);
    push("");
    const shown = products.slice(0, 20);
    for (const slug of shown) {
      push(`- ${labelFor(slug)}`);
    }
    if (products.length > shown.length) {
      push(`- …i još ${products.length - shown.length}`);
    }
    push("");
  }
  if (source) {
    push(`**IZVOR:** ${source}`);
    if (page) push(`  ·  **STRANA:** ${page}`);
    push("");
  }
  if (support) {
    push("**POTVRDA IZ IZVORA**");
    push("");
    push(`> ${support}`);
    push("");
  }
  if (note) {
    push(`**NAPOMENA SISTEMA:** ${note}`);
    push("");
  }
  checkboxes();
}

/** Group claims of one field by a stable signature so identical work merges. */
function groupClaims(field, signature) {
  const groups = new Map();
  for (const record of records) {
    const claim = record.claims.find((item) => item.field === field);
    if (!claim) continue;
    const key = signature(claim, record);
    if (key === undefined) continue;
    const bucket = groups.get(key) ?? { key, claim, records: [] };
    bucket.records.push(record);
    groups.set(key, bucket);
  }
  return [...groups.values()].sort((a, b) => b.records.length - a.records.length);
}

/* ========================================================================== */

const date = new Date().toISOString().slice(0, 10);

push("# CARSYSTEM — PREGLED TEHNIČKOG SADRŽAJA");
push("");
push(`Datum izvoza: ${date}`);
push("");
push(
  "Ovaj dokument sadrži isključivo tvrdnje iz oblasti autolakirerstva koje čekaju vašu potvrdu.",
);
push("");
push("**Šta je novo u ovoj verziji**");
push("");
push(
  `Sistem je pročitao ${inventory.summary.extractionEligible} R-M tehničkih listova i izvukao ${extraction.summary.claimsExtracted} tvrdnji, svaku sa brojem strane i citatom iz izvora.`,
);
push("");
push(
  "Ništa od toga nije objavljeno na sajtu i neće biti dok ne označite. Sve izvučeno nosi status `machine-extracted`, što sistem tretira kao neobjavljivo.",
);
push("");
push(
  "Tvrdnje koje se ponavljaju kroz više proizvoda su spojene u jednu stavku, pa jednom odlukom potvrđujete ceo skup.",
);
push("");
push("---");
push("");

/* -- SECTION A -------------------------------------------------------------- */

push("## SEKCIJA A — PITANJA VISOKOG PRIORITETA");
push("");
const highRows = readiness.rows.filter((row) => row.priority === "high");
push(
  `${highRows.length} pitanja sa najvećom poslovnom vrednošću. Za ${highRows.filter((r) => r.hasEvidence).length} od njih dokumentacija sada sadrži dokaze — nedostaje samo vaša potvrda i formulacija.`,
);
push("");

for (const row of highRows) {
  itemCount += 1;
  push(`### ${itemCount}. ${row.question}`);
  push("");
  push(
    row.hasEvidence
      ? "**STATUS:** dokazi postoje u dokumentaciji, čeka se vaša potvrda."
      : "**STATUS:** dokumentacija ne sadrži dokaze. Potreban je vaš odgovor iz iskustva.",
  );
  push("");
  if (row.evidenceDetails.length) {
    push("**ŠTA JE SISTEM NAŠAO**");
    push("");
    for (const detail of row.evidenceDetails) push(`- ${detail}`);
    push("");
    push(
      "> Sistem ne predlaže odgovor. Brojevi iznad pokazuju koliko dokaza postoji, ne šta je tačno.",
    );
    push("");
  }
  push("**VAŠ ODGOVOR**");
  push("");
  push("> ");
  push("");
  checkboxes();
}

/* -- SECTION B -------------------------------------------------------------- */

push("## SEKCIJA B — KOMPATIBILNOST PODLOGA");
push("");
const substrateGroups = groupClaims("substrates", (claim) =>
  (claim.value ?? [])
    .map((entry) => `${entry.suitability}:${entry.slugs.join("+")}`)
    .sort()
    .join("|"),
);
const substrateProducts = new Set(
  substrateGroups.flatMap((group) => group.records.map((r) => r.productSlug)),
);
push(
  `${substrateProducts.size} od ${records.length} proizvoda ima eksplicitnu izjavu o podlozi u tehničkom listu. Grupisano u ${substrateGroups.length} različitih kombinacija.`,
);
push("");
push(
  "**Važno:** proizvod koji ovde nije naveden nema izjavu o podlozi u svom listu. To **nije** podatak da je nekompatibilan.",
);
push("");

for (const group of substrateGroups) {
  const entries = group.claim.value ?? [];
  const direct = entries.filter((e) => e.suitability === "suitable");
  const primed = entries.filter((e) => e.suitability === "requires-primer");
  const describe = (list) => list.map((e) => e.sourceText).join(", ");

  const proposedLines = [];
  if (direct.length) proposedLines.push(`**Podržano:** ${describe(direct)}`);
  if (primed.length) {
    proposedLines.push(
      `**Podržano samo ako je prethodno temeljeno:** ${describe(primed)}`,
    );
  }

  reviewItem({
    title:
      group.records.length > 1
        ? `Podloge — ista izjava za ${group.records.length} proizvoda`
        : `Podloge — ${codeBySlug.get(group.records[0].productSlug) ?? ""}`.trim(),
    proposed: proposedLines.join("\n\n"),
    products: group.records.map((r) => r.productSlug),
    source: group.records[0].documentHref,
    page: group.claim.page,
    support: group.claim.rawText,
    note: primed.length
      ? "Uslovna izjava iz lista je zadržana odvojeno od bezuslovne. Potvrdite da je razlika ispravno pročitana."
      : undefined,
  });
}

/* -- SECTION C -------------------------------------------------------------- */

push("## SEKCIJA C — ODNOSI U SISTEMU PROIZVODA");
push("");

const hardenerGroups = groupClaims("hardenerProductSlugs", (claim) =>
  claim.value ? claim.value.join("+") : undefined,
);
const thinnerGroups = groupClaims("thinnerProductSlugs", (claim) =>
  claim.value ? claim.value.join("+") : undefined,
);

push(
  `Veze proizvod → učvršćivač / razređivač, izvučene iz sekcija „Hardener" i „Thinner" u listovima. Nijedna nije izvedena iz naziva ni iz redosleda u katalogu.`,
);
push("");

for (const group of hardenerGroups) {
  reviewItem({
    title: `Učvršćivač: ${group.claim.value.map((slug) => codeBySlug.get(slug) ?? slug).join(", ")} — za ${group.records.length} proizvoda`,
    proposed: group.claim.value.map((slug) => `- ${labelFor(slug)}`).join("\n"),
    products: group.records.map((r) => r.productSlug),
    source: group.records[0].documentHref,
    page: group.claim.page,
    support: group.claim.rawText,
    note: group.claim.note,
  });
}

for (const group of thinnerGroups) {
  reviewItem({
    title: `Razređivač: ${group.claim.value.map((slug) => codeBySlug.get(slug) ?? slug).join(", ")} — za ${group.records.length} proizvoda`,
    proposed: group.claim.value.map((slug) => `- ${labelFor(slug)}`).join("\n"),
    products: group.records.map((r) => r.productSlug),
    source: group.records[0].documentHref,
    page: group.claim.page,
    support: group.claim.rawText,
    note: group.claim.note,
  });
}

const sequencingRecords = records.filter((record) =>
  record.claims.some((claim) => claim.field === "sequencing"),
);
for (const record of sequencingRecords) {
  const claim = record.claims.find((item) => item.field === "sequencing");
  for (const entry of claim.value) {
    reviewItem({
      title:
        entry.relation === "preceded-by"
          ? `Prethodni proizvod: ${entry.targetText} pre ${codeBySlug.get(record.productSlug) ?? record.productSlug}`
          : `Zabranjeno prekrivanje: ${codeBySlug.get(record.productSlug) ?? record.productSlug}`,
      proposed:
        entry.relation === "preceded-by"
          ? `Površinu očistiti sa **${entry.targetText}** pre nanošenja ovog proizvoda.`
          : `Ovaj proizvod se **ne sme** direktno prekrivati sa: ${entry.targetText}`,
      products: [record.productSlug],
      source: record.documentHref,
      page: entry.page,
      support: entry.contextText,
    });
  }
}

/* -- SECTION D -------------------------------------------------------------- */

push("## SEKCIJA D — MEŠANJE I NANOŠENJE");
push("");

const ratioGroups = groupClaims("mixingRatio", (claim) => claim.value?.ratio);
push(
  `Odnosi mešanja izvučeni iz sekcije „Mixing Ratio". Grupisano po odnosu: ${ratioGroups.length} različitih vrednosti kroz ${ratioGroups.reduce((sum, g) => sum + g.records.length, 0)} proizvoda.`,
);
push("");

for (const group of ratioGroups) {
  reviewItem({
    title: `Odnos mešanja ${group.claim.value.ratio} — ${group.records.length} proizvoda`,
    proposed: `**${group.claim.value.ratio}** (po zapremini)`,
    products: group.records.map((r) => r.productSlug),
    source: group.records[0].documentHref,
    page: group.claim.page,
    support: group.claim.rawText,
  });
}

const gunAmbiguous = records.filter((record) =>
  record.claims.some((claim) => claim.field === "sprayGun" && claim.ambiguous),
);
const gunClear = groupClaims("sprayGun", (claim) =>
  claim.value
    ? `${claim.value.nozzleMm?.min}-${claim.value.nozzleMm?.max}@${claim.value.pressureBar?.min}`
    : undefined,
);

for (const group of gunClear) {
  const nozzle = group.claim.value.nozzleMm;
  const pressure = group.claim.value.pressureBar;
  reviewItem({
    title: `Dizna i pritisak — ${group.records.length} proizvoda`,
    proposed: [
      nozzle ? `**Dizna:** ${nozzle.min}–${nozzle.max} mm` : null,
      pressure ? `**Pritisak:** ${pressure.min} bar` : null,
    ]
      .filter(Boolean)
      .join("\n\n"),
    products: group.records.map((r) => r.productSlug),
    source: group.records[0].documentHref,
    page: group.claim.page,
    support: group.claim.rawText,
  });
}

if (gunAmbiguous.length) {
  reviewItem({
    title: `Dizna i pritisak — ${gunAmbiguous.length} proizvoda sa dva tipa pištolja`,
    proposed:
      "_Sistem nije dodelio vrednosti._ Ovi listovi navode dve kolone (Compliant Gravity i HVLP) čije se vrednosti pri automatskom čitanju spajaju, pa se ne može pouzdano odrediti koja vrednost pripada kom pištolju.",
    products: gunAmbiguous.map((r) => r.productSlug),
    source: "Više dokumenata — vidi RM_SOURCE_INVENTORY.md",
    note: "Zahteva ručno očitavanje iz PDF-a. Ovo je poznato ograničenje, ne greška u podacima.",
  });
}

/* -- SECTION E -------------------------------------------------------------- */

push("## SEKCIJA E — SUŠENJE I BRUŠENJE");
push("");

const dryingGroups = groupClaims("dryingProfile", (claim) =>
  (claim.value ?? [])
    .map((entry) => `${entry.temperatureC ?? "IR"}:${entry.minutes}`)
    .join("|"),
);
push(
  `Profili sušenja izvučeni iz sekcije „Drying". ${dryingGroups.length} različitih profila kroz ${dryingGroups.reduce((sum, g) => sum + g.records.length, 0)} proizvoda.`,
);
push("");

for (const group of dryingGroups) {
  const describe = (group.claim.value ?? [])
    .map((entry) =>
      entry.temperatureC
        ? `- Na ${entry.temperatureC}°C: ${entry.minutes} min`
        : `- ${entry.stage}: ${entry.minutes} min`,
    )
    .join("\n");
  reviewItem({
    title: `Sušenje — ${group.records.length} proizvoda`,
    proposed: describe,
    products: group.records.map((r) => r.productSlug),
    source: group.records[0].documentHref,
    page: group.claim.page,
    support: group.claim.rawText,
  });
}

const sandingGroups = groupClaims("sanding", (claim) =>
  claim.value ? `${claim.value.grits.join("+")}:${claim.value.method ?? "-"}` : undefined,
);
for (const group of sandingGroups) {
  reviewItem({
    title: `Brušenje ${group.claim.value.grits.join(", ")} — ${group.records.length} proizvoda`,
    proposed: `**Granulacije:** ${group.claim.value.grits.join(", ")}${group.claim.value.method ? `\n\n**Način:** ${group.claim.value.method}` : ""}`,
    products: group.records.map((r) => r.productSlug),
    source: group.records[0].documentHref,
    page: group.claim.page,
    support: group.claim.rawText,
  });
}

/* -- SECTION F -------------------------------------------------------------- */

push("## SEKCIJA F — SRPSKA TERMINOLOGIJA");
push("");

const terminologySource = readFileSync("data/knowledge/terminology.ts", "utf8");
const pendingTerms = [];
for (const block of terminologySource.split(/\n  \{\n/).slice(1)) {
  const canonical = block.match(/canonical: "([^"]+)"/)?.[1];
  if (!canonical) continue;
  for (const match of block.matchAll(
    /\{\s*term: "([^"]+)",\s*register: "([^"]+)",\s*status: "([^"]+)"(?:,\s*\n?\s*reviewNote:\s*\n?\s*"([\s\S]*?)")?/g,
  )) {
    if (match[3] === "expert-verified" || match[3] === "rejected") continue;
    pendingTerms.push({
      canonical,
      term: match[1],
      register: match[2],
      note: match[4]?.replace(/\s+/g, " ").trim(),
    });
  }
}

push(
  `${pendingTerms.length} izraza čeka potvrdu. Pitanje za svaki: odnosi li se ovaj izraz u praksi na isti proizvod kao zvanični naziv?`,
);
push("");
push("Ovo utiče na pretragu — pogrešan sinonim vodi kupca na pogrešan proizvod.");
push("");
push("| Zvanični naziv | Izraz u upotrebi | Tip | Isti proizvod? | Napomena sistema |");
push("| --- | --- | --- | --- | --- |");
for (const term of pendingTerms) {
  push(
    `| ${term.canonical} | **${term.term}** | ${term.register} | [ ] da  [ ] ne | ${term.note ?? ""} |`,
  );
}
push("");
push("---");
push("");

/* -- SECTION G -------------------------------------------------------------- */

push("## SEKCIJA G — KONFLIKTI I NEJASNOĆE");
push("");
push(
  `${conflicts.total} stavki gde sistem ne sme sam da odluči. Nijedna nije automatski razrešena.`,
);
push("");

const notInCatalogue = conflicts.conflicts.filter(
  (item) => item.type === "referenced-product-not-in-catalogue",
);
if (notInCatalogue.length) {
  const codes = new Map();
  for (const item of notInCatalogue) {
    const missing = item.detail.match(/\(([^)]+)\)/)?.[1] ?? item.detail;
    for (const code of missing.split(",").map((value) => value.trim())) {
      const bucket = codes.get(code) ?? [];
      bucket.push(item.productCode);
      codes.set(code, bucket);
    }
  }
  reviewItem({
    title: `Tehnički listovi navode ${codes.size} šifara koje nisu u Carsystem katalogu`,
    proposed: [...codes.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 40)
      .map(([code, users]) => `- **${code}** — navode ga: ${users.slice(0, 6).join(", ")}${users.length > 6 ? ` (+${users.length - 6})` : ""}`)
      .join("\n"),
    source: "R-M tehnički listovi, sekcije Hardener / Thinner",
    note:
      "R-M listovi po pravilu nude više brzina učvršćivača i razređivača. Carsystem drži deo njih. Potrebna odluka: da li se ove šifre nabavljaju, zamenjuju postojećim, ili se ne prikazuju.",
  });
}

for (const conflict of conflicts.conflicts.filter(
  (item) => item.type !== "referenced-product-not-in-catalogue",
)) {
  reviewItem({
    title: `Konflikt: ${conflict.type}`,
    proposed: conflict.detail,
    source: conflict.sources
      ? conflict.sources.map((s) => s.documentHref ?? s.href).filter(Boolean).join(", ")
      : conflict.documentHref,
    page: conflict.page,
    note: conflict.note ?? "Sistem ne predlaže razrešenje.",
  });
}

/* -- Summary ---------------------------------------------------------------- */

push("## SAŽETAK");
push("");
push("| Stavka | Broj |");
push("| --- | ---: |");
push(`| Pročitanih tehničkih listova | ${inventory.summary.extractionEligible} |`);
push(`| Izvučenih tvrdnji | ${extraction.summary.claimsExtracted} |`);
push(`| Tvrdnji sa strukturiranom vrednošću | ${extraction.summary.claimsWithStructuredValue} |`);
push(`| Nejasnih tvrdnji | ${extraction.summary.claimsAmbiguous} |`);
push(`| **Stavki za pregled u ovom dokumentu** | **${itemCount}** |`);
push(`| Izraza za potvrdu | ${pendingTerms.length} |`);
push("");
push(
  `Bez grupisanja bi ovaj dokument imao ${extraction.summary.claimsExtracted} stavki. Spajanjem istovetnih tvrdnji sveden je na ${itemCount} odluka plus ${pendingTerms.length} izraza.`,
);
push("");
push(
  "Ništa u ovom dokumentu nije vidljivo na sajtu i neće postati vidljivo bez vaše potvrde.",
);
push("");

mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(OUT, `${lines.join("\n")}\n`);

console.log(`Izvezeno: ${OUT}`);
console.log(`  stavki za pregled: ${itemCount}`);
console.log(`  izraza: ${pendingTerms.length}`);
console.log(`  izvučenih tvrdnji u pozadini: ${extraction.summary.claimsExtracted}`);
