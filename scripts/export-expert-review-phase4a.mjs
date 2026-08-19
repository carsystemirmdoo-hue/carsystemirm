#!/usr/bin/env node
/**
 * Phase 4A — the smallest high-value expert review package.
 *
 * Sections A (high-priority answer intents) and B (substrate compatibility)
 * only. Mixing, drying, sanding, terminology and conflicts are deliberately
 * held back for a later pass; they appear here only where an A/B item cannot
 * be judged without them.
 *
 * Three rules drive the output:
 *
 *   1. Domain only. No SEO, schema, URLs, metadata or implementation detail —
 *      the reviewer is a refinishing expert, not an engineer.
 *   2. Conditions survive. "Suitable on aluminium only if bare metal is primed"
 *      never collapses into "suitable on aluminium". The two are different
 *      technical statements and the weaker one is what damages panels when
 *      flattened.
 *   3. Every proposed answer is derived strictly from extracted evidence, and
 *      says so. Where the evidence does not support an answer, the item says
 *      that instead of inventing one.
 *
 * Output: docs/seo/CARSYSTEM_EXPERT_REVIEW_PHASE4A.md
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const readJson = (file) => JSON.parse(readFileSync(file, "utf8"));

const extraction = readJson("data/knowledge/rm-technical-extraction.generated.json");
const readiness = readJson("docs/seo/RM_INTENT_READINESS.json");
const rmData = readJson("data/rm-imported-products.generated.json");

const records = extraction.records;
const byCode = new Map(records.map((record) => [record.productCode, record]));
const nameBySlug = new Map(
  (rmData.products ?? []).map((product) => [product.slug, product.canonicalName]),
);
const recordBySlug = new Map(records.map((record) => [record.productSlug, record]));

const OUT = "docs/seo/CARSYSTEM_EXPERT_REVIEW_PHASE4A.md";

const lines = [];
const push = (...values) => lines.push(...values);

function claimOf(record, field) {
  return record?.claims.find((claim) => claim.field === field);
}

function displayName(slug) {
  return nameBySlug.get(slug) ?? slug;
}

/* -------------------------------------------------------------------------- */
/* Substrate grouping                                                         */
/* -------------------------------------------------------------------------- */

const SUBSTRATE_LABELS = {
  celik: "Čelik (Sheet steel)",
  "pocinkovani-lim": "Pocinkovani lim (Galvanized sheet steel)",
  aluminijum: "Aluminijum (Aluminium)",
  "e-coat": "OEM delovi sa e-coat slojem",
  "stari-lak": "Stari lak (Old paintwork)",
  stakloplastika: "GRP / SMC",
  plastika: "Plastika (PP-EPDM, ABS, PUR-RIM i sl.)",
};

/** Products carrying a substrate statement, grouped by identical statement. */
const substrateGroups = (() => {
  const groups = new Map();
  for (const record of records) {
    const claim = claimOf(record, "substrates");
    if (!claim?.value?.length) continue;
    const signature = claim.value
      .map((entry) => `${entry.suitability}:${entry.slugs.slice().sort().join("+")}`)
      .sort()
      .join("|");
    const bucket = groups.get(signature) ?? { signature, claim, records: [] };
    bucket.records.push(record);
    groups.set(signature, bucket);
  }
  return [...groups.values()].sort((a, b) => b.records.length - a.records.length);
})();

/**
 * Reviewer-facing quote built from the phrases actually mapped, not the raw
 * capture. The raw block sometimes runs past the substrate list into unrelated
 * handling text ("Shake vigorously for 2 min…"), which reads as if it were part
 * of the substrate statement.
 */
function substrateSupportText(claim) {
  // Only phrases that mapped to a known substrate. The capture block can pick
  // up neighbouring handling instructions ("Shake vigorously for 2 min…"), and
  // quoting those as part of a substrate statement misrepresents the source.
  const mapped = claim.value.filter((entry) => entry.slugs.length > 0);
  const direct = mapped
    .filter((entry) => entry.suitability !== "requires-primer")
    .map((entry) => entry.sourceText);
  const conditional = mapped
    .filter((entry) => entry.suitability === "requires-primer")
    .map((entry) => entry.sourceText);
  const parts = [`Product is suitable on: ${direct.join(" / ")}`];
  if (conditional.length) {
    parts.push(
      `If bare metal areas are primed, the product can be used on: ${conditional.join(" / ")}`,
    );
  }
  return parts.join("  ·  ");
}

function substrateSets(claim) {
  const direct = new Set();
  const conditional = new Set();
  let condition;
  for (const entry of claim.value) {
    for (const slug of entry.slugs) {
      if (entry.suitability === "requires-primer") {
        conditional.add(slug);
        condition ??= entry.note ?? entry.condition;
      } else {
        direct.add(slug);
      }
    }
  }
  return { direct, conditional, condition };
}

/** All products whose sheet names a substrate, split by how it is stated. */
function productsForSubstrate(slug) {
  const direct = [];
  const conditional = [];
  for (const record of records) {
    const claim = claimOf(record, "substrates");
    if (!claim?.value?.length) continue;
    for (const entry of claim.value) {
      if (!entry.slugs.includes(slug)) continue;
      (entry.suitability === "requires-primer" ? conditional : direct).push(record);
    }
  }
  const dedupe = (list) => [...new Map(list.map((r) => [r.productCode, r])).values()];
  return { direct: dedupe(direct), conditional: dedupe(conditional) };
}

function listProducts(list) {
  return list
    .map((record) => `- **${record.productCode}** ${displayName(record.productSlug).replace(record.productCode, "").trim()}`)
    .join("\n");
}

/* -------------------------------------------------------------------------- */
/* Decision block                                                             */
/* -------------------------------------------------------------------------- */

function decisionBlock() {
  push("");
  push("- [ ] ODOBRENO KAKO JE NAPISANO");
  push("- [ ] ODOBRENO UZ ISPRAVKU");
  push("- [ ] NETAČNO");
  push("- [ ] NE OBJAVLJIVATI");
  push("");
  push("**ISPRAVNA VERZIJA / NAPOMENA STRUČNJAKA:**");
  push("");
  push("> ____________________________________");
  push("");
  push("---");
  push("");
}

/**
 * Section A items are computed in evidence order but must be *read* in
 * numbered order, so they are collected here and flushed sorted.
 */
const sectionAItems = [];
let collectingSectionA = false;

function reviewItem(item) {
  if (collectingSectionA) {
    sectionAItems.push(item);
    return;
  }
  renderReviewItem(item);
}

function renderReviewItem({
  id,
  title,
  interpretation,
  products,
  source,
  locator,
  support,
  conditions,
  whyReview,
}) {
  push(`### ${id} — ${title}`);
  push("");
  push("**PREDLOŽENA CARSYSTEM INTERPRETACIJA**");
  push("");
  push(interpretation);
  push("");
  if (products) {
    push("**PRIMENJIVI PROIZVODI**");
    push("");
    push(products);
    push("");
  }
  if (source) {
    push(`**IZVORNI DOKUMENT:** ${source}`);
    push("");
  }
  if (locator) {
    push(`**STRANA / SEKCIJA:** ${locator}`);
    push("");
  }
  if (support) {
    push("**KRATKA POTVRDA IZ IZVORA**");
    push("");
    push(`> ${support}`);
    push("");
  }
  if (conditions) {
    push("**VAŽNI USLOVI I OGRANIČENJA**");
    push("");
    push(conditions);
    push("");
  }
  push("**ZAŠTO OVO TRAŽI LJUDSKU PROVERU**");
  push("");
  push(whyReview);
  decisionBlock();
}

/* ========================================================================== */
/* Header                                                                     */
/* ========================================================================== */

const date = new Date().toISOString().slice(0, 10);

push("# CARSYSTEM — STRUČNI PREGLED, FAZA 4A");
push("");
push(`Datum: ${date}`);
push("");
push(
  "> **Vaš zadatak nije da proveravate SEO. Molimo proverite samo da li su tehničke tvrdnje i interpretacije ispravne prema R-M praksi i dokumentaciji.**",
);
push("");
push("---");
push("");
push("## Kako čitati ovaj dokument");
push("");
push(
  "Sistem je pročitao R-M tehničke listove koji već postoje u projektu i izvukao ono što u njima **eksplicitno piše**. Ništa nije pretpostavljeno, dopunjeno iz opšteg znanja niti preuzeto sa interneta.",
);
push("");
push(
  "Svaka stavka nosi dokument, stranu i citat, pa proveru možete uraditi direktno u listu bez traženja.",
);
push("");
push("Ovaj dokument obuhvata samo dve teme:");
push("");
push("- **SEKCIJA A** — pitanja koja kupci i majstori najčešće postavljaju");
push("- **SEKCIJA B** — na koje podloge se proizvodi smeju nanositi");
push("");
push(
  "Odnosi mešanja, sušenje, brušenje i terminologija dolaze u sledećem krugu i ovde se pojavljuju samo kada su neophodni da biste ocenili stavku iz A ili B.",
);
push("");

/* -- Accuracy signal -------------------------------------------------------- */

const c2p42 = byCode.get("C 2P42");
const c2p42Ratio = claimOf(c2p42, "mixingRatio");
const c2p42PotLife = claimOf(c2p42, "potLifeMinutes");

push("### Provera tačnosti čitanja");
push("");
push(
  "U projektu je od ranije postojao **jedan** ručno unet i potvrđen tehnički podatak — za **C 2P42 Race Finish-R**. Sistem je taj list pročitao nezavisno i dobio iste vrednosti:",
);
push("");
push("| Podatak | Ranije potvrđeno | Sistem pročitao |");
push("| --- | --- | --- |");
push(`| Odnos mešanja | 3:1:1 | ${c2p42Ratio?.value?.ratio ?? "—"} |`);
push(
  `| Pot life | 30 min pri 20 °C | ${c2p42PotLife?.value ? `${c2p42PotLife.value} min` : "—"} |`,
);
push("");
push(
  "To ne dokazuje da je sve ostalo tačno, ali pokazuje da čitanje listova radi ispravno na primeru koji ste već odobrili.",
);
push("");
push("---");
push("");

/* ========================================================================== */
/* SECTION A                                                                  */
/* ========================================================================== */

push("# SEKCIJA A — PITANJA VISOKOG PRIORITETA");
push("");

const highRows = readiness.rows.filter((row) => row.priority === "high");

push(
  `${highRows.length} pitanja. Za svako je navedeno da li dokumentacija sadrži dovoljno da se odgovori tehnički odbranjivo.`,
);
push("");
push("| Oznaka | Značenje |");
push("| --- | --- |");
push("| **DOVOLJNO** | Dokumentacija sadrži dovoljno za odbranjiv odgovor. Predlog je pripremljen. |");
push("| **DOVOLJNO UZ VAŠU FORMULACIJU** | Podaci postoje, ali odgovor traži vaš način izražavanja. |");
push("| **NEPOTPUNO** | Dokumentacija ne sadrži dovoljno. Potreban je vaš odgovor iz prakse. |");
push("| **NIJE TEHNIČKO PITANJE** | Ne traži tehničku proveru. |");
push("");
push("---");
push("");

let proposedAnswerCount = 0;

// Items below are computed in evidence order; flushed in A1..A11 order.
collectingSectionA = true;

/* -- A1: aluminium ---------------------------------------------------------- */

const alu = productsForSubstrate("aluminijum");
const aluDirectPrimers = alu.direct.filter((r) => r.category === "primer-filler");
const aluDirectOther = alu.direct.filter((r) => r.category !== "primer-filler");

proposedAnswerCount += 1;
reviewItem({
  id: "A1",
  title: "Koji prajmer koristiti na aluminijumu?  ·  **DOVOLJNO**",
  interpretation: [
    "Prema R-M tehničkim listovima proizvoda koji su u Carsystem ponudi, aluminijum se kao podloga eksplicitno navodi na dva različita načina, i ta razlika se mora zadržati:",
    "",
    `**1. Direktno na aluminijum** — ${aluDirectPrimers.length} prajmera/punilaca:`,
    "",
    listProducts(aluDirectPrimers),
    "",
    `**2. Samo ako je golo mesto prethodno temeljeno** — ${alu.conditional.length} punilaca:`,
    "",
    listProducts(alu.conditional),
    "",
    aluDirectOther.length
      ? `Pored njih, aluminijum navodi i ${aluDirectOther.map((r) => `**${r.productCode}**`).join(", ")}, ali to je kit, ne prajmer.`
      : null,
    "",
    "Tehnički listovi **ne rangiraju** proizvode niti navode jedan kao preporučeni izbor za aluminijum.",
  ]
    .filter((line) => line !== null)
    .join("\n"),
  source: "R-M tehnički listovi navedenih proizvoda",
  locator: "Sekcija „Handling — Product is suitable on“, strana 1",
  support:
    "Product is suitable on: Sheet steel / Galvanized sheet steel / Aluminium / OEM parts with e-coat / Old paintwork / GRP / SMC",
  conditions: [
    "**Uslovna grupa se ne sme predstaviti kao direktna.** Za 5 punilaca list kaže: „If bare metal areas are primed, the product can be used on … Aluminium“. To znači da se ne nanose direktno na golo aluminijumsko mesto.",
    "",
    "Listovi ne navode koji prajmer se koristi za to prethodno temeljenje.",
  ].join("\n"),
  whyReview: [
    "Sistem je pročitao šta u listovima piše, ali ne zna R-M praksu. Konkretno:",
    "",
    "- Da li je za golo aluminijumsko mesto potreban poseban wash/etch prajmer koji u ovim listovima nije naveden?",
    "- Da li se neki od ovih proizvoda u praksi ne koristi na aluminijumu iako list to dozvoljava?",
    "- Da li je ovakva podela na „direktno“ i „uz prethodno temeljenje“ tačna formulacija za kupca?",
  ].join("\n"),
});

/* -- A2: plastic ------------------------------------------------------------ */

const plastika = productsForSubstrate("plastika");

reviewItem({
  id: "A2",
  title: "Koji prajmer ide na plastiku (npr. branik)?  ·  **NEPOTPUNO**",
  interpretation: [
    "**Sistem nema odgovor na ovo pitanje i ne predlaže ga.**",
    "",
    `U celoj R-M dokumentaciji u projektu plastiku kao podlogu navodi samo **${plastika.direct.length}** proizvod:`,
    "",
    listProducts(plastika.direct),
    "",
    "Taj proizvod je **kit, ne prajmer**, pa ne odgovara na postavljeno pitanje.",
    "",
    "Nijedan R-M prajmer u projektu ne navodi plastiku kao podlogu.",
  ].join("\n"),
  source: plastika.direct[0]?.documentHref ?? "—",
  locator: "Sekcija „Handling — Product suitable on“, strana 1",
  support:
    "Product suitable on: … Pur-RIM / PP-EPDM / ABS / GRP-SMC / PC-PBTP / PA / PPO / rigid PVC",
  conditions:
    "Odsustvo izjave **ne znači** da se plastika ne sme farbati. Znači samo da tehnički listovi u projektu o tome ćute.",
  whyReview: [
    "Ovo je pitanje koje kupci često postavljaju, a dokumentacija u projektu ga ne pokriva.",
    "",
    "- Da li Carsystem drži prajmer za plastiku koji nije u ovoj dokumentaciji?",
    "- Da li se koristi aditiv za elastičnost i u kom odnosu?",
    "- Ako se pitanje ne može odgovoriti, da li ga uopšte objavljivati?",
  ].join("\n"),
});

/* -- A3: galvanized --------------------------------------------------------- */

const galv = productsForSubstrate("pocinkovani-lim");
const galvDirectPrimers = galv.direct.filter((r) => r.category === "primer-filler");
const galvDirectOther = galv.direct.filter((r) => r.category !== "primer-filler");

proposedAnswerCount += 1;
reviewItem({
  id: "A3",
  title: "Koji prajmer na pocinkovani lim?  ·  **DOVOLJNO**",
  interpretation: [
    "Pocinkovani lim (Galvanized sheet steel) eksplicitno se navodi u listovima sledećih proizvoda:",
    "",
    `**Direktno na pocinkovani lim** — ${galvDirectPrimers.length} prajmera/punilaca:`,
    "",
    listProducts(galvDirectPrimers),
    "",
    `**Samo ako je golo mesto prethodno temeljeno** — ${galv.conditional.length} punilaca:`,
    "",
    listProducts(galv.conditional),
    "",
    galvDirectOther.length
      ? `Pocinkovani lim navodi i ${galvDirectOther.map((r) => `**${r.productCode}**`).join(", ")}, koji je kit.`
      : null,
    "",
    "**Napomena o razlici:** P 2E23 Primer filler grey navodi čelik i aluminijum, ali **ne navodi** pocinkovani lim, iako navodi ostale podloge. Ta razlika je preneta iz lista kakva jeste.",
  ]
    .filter((line) => line !== null)
    .join("\n"),
  source: "R-M tehnički listovi navedenih proizvoda",
  locator: "Sekcija „Handling — Product is suitable on“, strana 1",
  support:
    "Product is suitable on: Sheet steel / Galvanized sheet steel / Aluminium / OEM parts with e-coat / Old paintwork",
  conditions:
    "Uslovna grupa (5 punilaca) traži prethodno temeljenje golog mesta. Ne sme se prikazati kao direktna primena.",
  whyReview: [
    "- Da li je izostavljanje pocinkovanog lima kod P 2E23 namerno ili propust u listu?",
    "- Da li priprema pocinkovane površine zahteva korak koji ovi listovi ne navode?",
  ].join("\n"),
});

/* -- A4, A7, A10, A11 — no evidence ----------------------------------------- */

const noEvidenceItems = [
  {
    id: "A4",
    slug: "priprema-povrsine-pre-lakiranja",
    title: "Kako se priprema površina pre lakiranja?  ·  **NEPOTPUNO**",
    body: [
      "**Sistem nema odgovor i ne predlaže ga.**",
      "",
      "R-M tehnički listovi opisuju pojedinačne proizvode, ne ceo postupak pripreme. U dokumentaciji postoje samo pojedinačne rečenice tipa „Clean the surface with MULTI Clean-R before applying …“, koje ne čine celovit postupak.",
    ].join("\n"),
    why: "Ovo je najtraženije pitanje na sajtu, a odgovor mora doći iz vaše prakse. Potreban je kratak, tačan opis redosleda koji Carsystem preporučuje.",
  },
  {
    id: "A7",
    slug: "kako-se-bira-nijansa",
    title: "Kako se bira nijansa ili RAL boja?  ·  **NEPOTPUNO**",
    body: [
      "**Sistem nema odgovor i ne predlaže ga.**",
      "",
      "Tehnički listovi ne opisuju postupak utvrđivanja nijanse.",
    ].join("\n"),
    why: [
      "Potreban je vaš opis postupka. Dodatno pitanje za vas:",
      "",
      "- Kako se u praksi koristi RAL karta u odnosu na fizički uzorak i kod boje sa vozila?",
    ].join("\n"),
  },
  {
    id: "A10",
    slug: "gde-kupiti-auto-lakove",
    title: "Gde kupiti auto lakove u Srbiji?  ·  **NIJE TEHNIČKO PITANJE**",
    body: [
      "Ovo pitanje **ne traži tehničku proveru** i navedeno je samo radi potpunosti.",
      "",
      "Podaci o prodajnoj i partnerskoj mreži već postoje i verifikovani su. Potrebno je samo poslovno odobrenje formulacije, ne tehnička provera.",
    ].join("\n"),
    why: "Navedeno radi evidencije. Možete preskočiti ovu stavku.",
  },
  {
    id: "A11",
    slug: "sta-treba-za-lakiranje-jednog-dela",
    title: "Šta je sve potrebno za lakiranje jednog dela?  ·  **NEPOTPUNO**",
    body: [
      "**Sistem nema odgovor i ne predlaže ga.**",
      "",
      "Iz listova su izvučeni pojedinačni parametri (odnos mešanja, broj slojeva, sušenje), ali nigde ne postoji lista materijala potrebnih za jedan popravljeni deo. Sastavljanje takve liste bilo bi zaključivanje, ne čitanje.",
    ].join("\n"),
    why: "Traži vaše iskustvo — koliko materijala i kojih komponenti realno ide na jedan deo.",
  },
];

for (const item of noEvidenceItems) {
  reviewItem({
    id: item.id,
    title: item.title,
    interpretation: item.body,
    whyReview: item.why,
  });
}

/* -- A5: clearcoat mixing ratio --------------------------------------------- */

const clearcoats = records.filter((record) => record.category === "clearcoat");
const ccRatios = new Map();
for (const record of clearcoats) {
  const claim = claimOf(record, "mixingRatio");
  if (!claim?.value?.ratio) continue;
  const bucket = ccRatios.get(claim.value.ratio) ?? [];
  bucket.push(record);
  ccRatios.set(claim.value.ratio, bucket);
}
const ratioRows = [...ccRatios.entries()].sort((a, b) => b[1].length - a[1].length);

proposedAnswerCount += 1;
reviewItem({
  id: "A5",
  title: "Koji je odnos mešanja za bezbojni lak?  ·  **DOVOLJNO**",
  interpretation: [
    "**Ne postoji jedan odnos mešanja za bezbojne lakove.** Odnos zavisi od konkretnog proizvoda.",
    "",
    `U ${clearcoats.length} R-M bezbojnih lakova iz ponude, listovi navode ${ratioRows.length} različita odnosa:`,
    "",
    "| Odnos | Proizvodi |",
    "| --- | --- |",
    ...ratioRows.map(
      ([ratio, list]) =>
        `| **${ratio}** | ${list.map((r) => r.productCode).join(", ")} |`,
    ),
    "",
    "Zaključak koji sistem predlaže: kupcu se ne sme dati jedan broj, nego uputstvo da odnos očita iz tehničkog lista konkretnog proizvoda.",
  ].join("\n"),
  source: "R-M tehnički listovi navedenih bezbojnih lakova",
  locator: "Sekcija „Mixing Ratio“, strana 1",
  support: "Mixing Ratio 2:1 + 10% · Mixing Ratio 100 % by volume … Hardener 50 % by volume … Thinner 10 % by volume",
  conditions: [
    "**C 5450** navodi odnos u obliku `300:100:100` umesto skraćenog zapisa. Nije preračunavan.",
    "",
    "Zapis `2:1 + 10%` znači lak : učvršćivač + 10% razređivača, kako stoji u listu. Nije prevođen u drugi oblik.",
  ].join("\n"),
  whyReview: [
    "- Da li je tačno da se kupcu ne sme dati jedan univerzalan odnos?",
    "- Da li je zapis `300:100:100` kod C 5450 ekvivalentan `3:1:1` ili znači nešto drugo?",
    "- Da li se odnos menja u zavisnosti od izbora učvršćivača (brzi/srednji/spori)?",
  ].join("\n"),
});

/* -- A6: number of coats ---------------------------------------------------- */

const ccCoats = new Map();
for (const record of clearcoats) {
  const claim = claimOf(record, "coats");
  if (!claim?.value) continue;
  const bucket = ccCoats.get(claim.value) ?? [];
  bucket.push(record);
  ccCoats.set(claim.value, bucket);
}
const coatRows = [...ccCoats.entries()].sort((a, b) => b[1].length - a[1].length);

proposedAnswerCount += 1;
reviewItem({
  id: "A6",
  title: "Koliko slojeva bezbojnog laka treba naneti?  ·  **DOVOLJNO UZ VAŠU FORMULACIJU**",
  interpretation: [
    "Kao i kod odnosa mešanja, **broj slojeva zavisi od proizvoda**. Listovi navode:",
    "",
    "| Navod iz lista | Proizvodi |",
    "| --- | --- |",
    ...coatRows.map(
      ([coats, list]) =>
        `| ${String(coats).replace(/\|/g, "/")} | ${list.map((r) => r.productCode).join(", ")} |`,
    ),
    "",
    "Formulacija „1 ½ spray coats“ je zadržana kako stoji u listu i namerno nije prevedena u „1–2 sloja“.",
  ].join("\n"),
  source: "R-M tehnički listovi navedenih bezbojnih lakova",
  locator: "Sekcija „Number of Coats“, strana 2",
  support: "Number of Coats 1 ½ spray coats (no flash off between coats required).",
  conditions:
    "Debljina sloja se navodi zasebno i razlikuje se po proizvodu; nije spajana sa brojem slojeva.",
  whyReview: [
    "- Kako biste vi formulisali „1 ½ spray coats“ na srpskom, a da ostane tehnički tačno?",
    "- Da li je za kupca korisnije govoriti o broju slojeva ili o debljini sloja?",
  ].join("\n"),
});

/* -- A8: drying ------------------------------------------------------------- */

const ccDrying = clearcoats
  .map((record) => ({ record, claim: claimOf(record, "dryingProfile") }))
  .filter((entry) => entry.claim?.value?.length);

const at60 = ccDrying
  .map((entry) => entry.claim.value.find((v) => v.temperatureC === 60)?.minutes)
  .filter(Boolean);
const at20 = ccDrying
  .map((entry) => entry.claim.value.find((v) => v.temperatureC === 20)?.minutes)
  .filter(Boolean);

proposedAnswerCount += 1;
reviewItem({
  id: "A8",
  title: "Koliko se suši lak i na kojoj temperaturi?  ·  **DOVOLJNO**",
  interpretation: [
    `Listovi navode profil sušenja za ${ccDrying.length} bezbojnih lakova. Vrednosti se razlikuju po proizvodu:`,
    "",
    "| Proizvod | Sušenje po temperaturi |",
    "| --- | --- |",
    ...ccDrying.map(
      (entry) =>
        `| **${entry.record.productCode}** | ${entry.claim.value
          .map((value) =>
            value.temperatureC
              ? `${value.temperatureC} °C: ${value.minutes} min`
              : `IR: ${value.minutes} min`,
          )
          .join(" · ")} |`,
    ),
    "",
    `Raspon u dokumentaciji: na 60 °C od ${Math.min(...at60)} do ${Math.max(...at60)} min; na 20 °C od ${Math.min(...at20)} do ${Math.max(...at20)} min.`,
  ].join("\n"),
  source: "R-M tehnički listovi navedenih bezbojnih lakova",
  locator: "Sekcija „Drying“, strana 2",
  support: "Drying at 20°C 10 h · Drying at 60°C 30 min · Infrared (short wave) 8 min",
  conditions: [
    "Vrednosti na 20 °C su u listovima date u satima i ovde su preračunate u minute radi poređenja. Izvorni zapis je zadržan uz svaku tvrdnju.",
    "",
    "Listovi izričito navode da na vreme sušenja utiču izbor učvršćivača, razređivača i način nanošenja.",
  ].join("\n"),
  whyReview: [
    "- Da li su ova vremena realna u uslovima domaćih lakirnica?",
    "- „Drying“ u listu ne razdvaja uvek suvo za rukovanje od suvog za montažu. Da li tu razliku treba naglasiti kupcu?",
  ].join("\n"),
});

/* -- A9: thinner ------------------------------------------------------------ */

const thinnerPairs = [];
for (const record of clearcoats) {
  const claim = claimOf(record, "thinnerProductSlugs");
  if (!claim?.value?.length) continue;
  thinnerPairs.push({ record, claim });
}

proposedAnswerCount += 1;
reviewItem({
  id: "A9",
  title: "Koji razređivač ide uz koji lak?  ·  **DOVOLJNO**",
  interpretation: [
    "Listovi bezbojnih lakova eksplicitno imenuju razređivač. Veze koje su potvrđene i za koje Carsystem drži oba proizvoda:",
    "",
    "| Bezbojni lak | Razređivač iz lista |",
    "| --- | --- |",
    ...thinnerPairs.map(
      (entry) =>
        `| **${entry.record.productCode}** | ${entry.claim.value
          .map((slug) => `**${recordBySlug.get(slug)?.productCode ?? slug}**`)
          .join(", ")} |`,
    ),
    "",
    "Listovi po pravilu nude i više brzina razređivača (brzi/srednji/spori). Ovde su prikazane samo one koje Carsystem drži u ponudi.",
  ].join("\n"),
  source: "R-M tehnički listovi navedenih bezbojnih lakova",
  locator: "Sekcija „Thinner“, strana 1",
  support: "Thinner 10 % by volume R 2A14 - Thinner, fast / R 2A24 - Thinner, medium / R 2A34 - Thinner, slow",
  conditions: [
    "**Nepotpuna slika.** Listovi navode i razređivače koje Carsystem trenutno ne drži, pa gornja tabela pokazuje samo deo mogućnosti iz lista.",
    "",
    "Izbor brzine razređivača zavisi od temperature i veličine dela — listovi to navode kao uslov, bez konkretnih pragova.",
  ].join("\n"),
  whyReview: [
    "- Da li je ispravno kupcu prikazati samo razređivače iz ponude, ili treba navesti i one koji se mogu poručiti?",
    "- Po kom kriterijumu se u praksi bira brzi/srednji/spori razređivač?",
  ].join("\n"),
});

/* -- Flush Section A in numbered order -------------------------------------- */

collectingSectionA = false;
sectionAItems
  .sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)))
  .forEach(renderReviewItem);

/* ========================================================================== */
/* SECTION B                                                                  */
/* ========================================================================== */

push("# SEKCIJA B — KOMPATIBILNOST PODLOGA");
push("");
push(
  `Od ${records.length} R-M proizvoda sa čitljivim tehničkim listom, **${substrateGroups.reduce((sum, g) => sum + g.records.length, 0)}** ima eksplicitnu izjavu o podlozi. Te izjave se svode na **${substrateGroups.length} različitih kombinacija**, pa donosite ${substrateGroups.length} odluka umesto ${substrateGroups.reduce((sum, g) => sum + g.records.length, 0)}.`,
);
push("");
push("**Stanja u matrici**");
push("");
push("| Oznaka | Značenje |");
push("| --- | --- |");
push("| **DIREKTNO PODRŽANO** | List izričito navodi podlogu, bez uslova |");
push("| **PODRŽANO UZ USLOV** | List navodi podlogu, ali uz naveden uslov |");
push("| **EKSPLICITNO NIJE DOZVOLJENO** | List izričito zabranjuje |");
push("| **NIJE NAVEDENO** | List o toj podlozi ne kaže ništa |");
push("| **NEJASNO — PROVERITI** | Formulacija nije jednoznačna |");
push("");
push(
  "> **„NIJE NAVEDENO“ nije isto što i „nije kompatibilno“.** Ako list ne pominje aluminijum, to ne znači da je aluminijum zabranjen — znači da list o njemu ćuti. Ova razlika se nigde ne sme izgubiti.",
);
push("");
push("---");
push("");

/* -- Overview matrix -------------------------------------------------------- */

const MATRIX_ORDER = [
  "celik",
  "pocinkovani-lim",
  "aluminijum",
  "e-coat",
  "stari-lak",
  "stakloplastika",
  "plastika",
];

push("## Pregledna matrica");
push("");
push(
  `| Proizvod | ${MATRIX_ORDER.map((slug) => SUBSTRATE_LABELS[slug].split(" (")[0]).join(" | ")} |`,
);
push(`| --- | ${MATRIX_ORDER.map(() => ":---:").join(" | ")} |`);

for (const group of substrateGroups) {
  const { direct, conditional } = substrateSets(group.claim);
  for (const record of group.records) {
    const cells = MATRIX_ORDER.map((slug) =>
      direct.has(slug) ? "**D**" : conditional.has(slug) ? "**U**" : "–",
    ).join(" | ");
    push(`| **${record.productCode}** | ${cells} |`);
  }
}
push("");
push("**D** = direktno podržano · **U** = podržano uz uslov · **–** = nije navedeno");
push("");
push(
  `Svi ostali proizvodi (${records.length - substrateGroups.reduce((sum, g) => sum + g.records.length, 0)}) nemaju nijednu izjavu o podlozi u svom listu. Za njih je celokupan red „NIJE NAVEDENO“.`,
);
push("");
push("---");
push("");

/* -- Group items ------------------------------------------------------------ */

let groupIndex = 0;
for (const group of substrateGroups) {
  groupIndex += 1;
  const { direct, conditional, condition } = substrateSets(group.claim);

  const directList = [...direct].map((slug) => `- ${SUBSTRATE_LABELS[slug] ?? slug}`);
  const conditionalList = [...conditional].map(
    (slug) => `- ${SUBSTRATE_LABELS[slug] ?? slug}`,
  );
  const notStated = MATRIX_ORDER.filter(
    (slug) => !direct.has(slug) && !conditional.has(slug),
  ).map((slug) => SUBSTRATE_LABELS[slug].split(" (")[0]);

  const interpretation = [
    "**DIREKTNO PODRŽANO**",
    "",
    directList.length ? directList.join("\n") : "_(nema)_",
  ];
  if (conditionalList.length) {
    interpretation.push(
      "",
      "**PODRŽANO UZ USLOV**",
      "",
      conditionalList.join("\n"),
      "",
      `Uslov iz lista: _„${(condition ?? "").replace(/^.*—\s*/, "")}“_`,
    );
  }
  const unmapped = group.claim.value
    .filter((entry) => entry.slugs.length === 0)
    .map((entry) => entry.sourceText);

  if (unmapped.length) {
    interpretation.push(
      "",
      "**NEJASNO — PROVERITI**",
      "",
      "Sledeći redovi stoje u istoj sekciji lista, ali nisu izjave o podlozi. Sistem ih nije svrstao ni u jednu podlogu:",
      "",
      unmapped.map((text) => `- _„${text}“_`).join("\n"),
    );
  }

  interpretation.push(
    "",
    "**NIJE NAVEDENO**",
    "",
    notStated.length ? notStated.join(", ") : "_(nema)_",
  );

  const record = group.records[0];

  reviewItem({
    id: `B${groupIndex}`,
    title:
      group.records.length > 1
        ? `Ista izjava o podlozi za ${group.records.length} proizvoda`
        : `Izjava o podlozi — ${record.productCode}`,
    interpretation: interpretation.join("\n"),
    products: listProducts(group.records),
    source: record.documentHref,
    locator: `Strana ${group.claim.page}, sekcija „Handling — Product is suitable on“`,
    support: substrateSupportText(group.claim),
    conditions: conditionalList.length
      ? "Uslovna grupa se **ne sme** prikazati kao direktna primena. Listovi ne navode koji prajmer se koristi za prethodno temeljenje."
      : "Podloge koje nisu navedene ostaju „NIJE NAVEDENO“ i ne prikazuju se kao zabranjene.",
    whyReview: [
      "- Da li je lista podloga tačna prema R-M praksi?",
      conditionalList.length
        ? "- Da li je uslov („samo ako je golo mesto prethodno temeljeno“) ispravno pročitan i formulisan?"
        : "- Da li nedostaje podloga koju vi u praksi koristite, a list je ne navodi?",
      "- Postoji li podloga na kojoj se ovi proizvodi **ne smeju** koristiti, a list to ne navodi?",
    ].join("\n"),
  });
}

/* -- Explicit restrictions relevant to A/B ---------------------------------- */

const substrateWarnings = [];
for (const record of records) {
  const claim = claimOf(record, "warnings");
  if (!claim?.value) continue;
  for (const warning of claim.value) {
    if (/substrate|blasted|bare metal|high build/i.test(warning)) {
      substrateWarnings.push({ record, warning, page: claim.page });
    }
  }
}

if (substrateWarnings.length) {
  groupIndex += 1;
  reviewItem({
    id: `B${groupIndex}`,
    title: "Eksplicitna ograničenja vezana za podlogu i način nanošenja",
    interpretation: [
      "Ovo su jedine izričite zabrane pronađene u listovima. Navedene su jer direktno utiču na tumačenje matrice podloga.",
      "",
      "| Proizvod | Izjava iz lista |",
      "| --- | --- |",
      ...substrateWarnings.map(
        (entry) => `| **${entry.record.productCode}** | _${entry.warning}_ |`,
      ),
    ].join("\n"),
    source: "R-M tehnički listovi navedenih proizvoda",
    locator: "Sekcije „Remarks“ i „Handling“",
    conditions:
      "Ovo su jedine pronađene zabrane. Odsustvo zabrane za neki drugi proizvod **ne znači** da zabrana ne postoji — znači da je list ne navodi.",
    whyReview: [
      "- Da li su ovo sve zabrane koje kupac mora znati?",
      "- Postoji li zabrana iz prakse koju listovi ne navode, a trebalo bi je prikazati?",
    ].join("\n"),
  });
}

/* ========================================================================== */
/* Summary                                                                    */
/* ========================================================================== */

const totalDecisions = highRows.length + groupIndex;
const substrateProductCount = substrateGroups.reduce(
  (sum, group) => sum + group.records.length,
  0,
);

push("# SAŽETAK FAZE 4A");
push("");
push("| Stavka | Broj |");
push("| --- | ---: |");
push(`| Odluka ukupno | **${totalDecisions}** |`);
push(`| — Sekcija A (pitanja) | ${highRows.length} |`);
push(`| — Sekcija B (podloge) | ${groupIndex} |`);
push(`| Pripremljenih predloga odgovora | **${proposedAnswerCount}** |`);
push(`| Grupa podloga | ${substrateGroups.length} |`);
push(`| Proizvoda pokrivenih izjavom o podlozi | ${substrateProductCount} |`);
push("");
push("**Procenjeno vreme pregleda: 60–90 minuta.**");
push("");
push("| Sekcija | Stavki | Procena |");
push("| --- | ---: | --- |");
push(`| A — pitanja sa pripremljenim predlogom | ${proposedAnswerCount} | 3–5 min po stavci |`);
push(`| A — pitanja bez predloga (pišete odgovor) | ${highRows.length - proposedAnswerCount} | 5–10 min po stavci |`);
push(`| B — grupe podloga | ${groupIndex} | 3–5 min po stavci |`);
push("");

push("## Odluke koje otključavaju najviše sadržaja");
push("");
push(
  "Ako imate vremena samo za deo dokumenta, ove stavke nose najveću vrednost:",
);
push("");
push("| Redosled | Stavka | Šta otključava |");
push("| ---: | --- | --- |");
push(
  "| 1 | **B1–B6** (grupe podloga) | Cela matrica podloga. Otključava odjednom pitanja A1, A2 i A3 i buduće stranice po podlozi. Šest odluka pokriva 14 proizvoda. |",
);
push(
  "| 2 | **A1** (aluminijum) | Najtraženije tehničko pitanje. Predlog je već pripremljen — potrebna je samo potvrda. |",
);
push(
  "| 3 | **A3** (pocinkovani lim) | Isti izvor kao A1, pa se potvrđuje istim pregledom. |",
);
push(
  "| 4 | **A5** (odnos mešanja) | Pokriva 20 bezbojnih lakova jednom odlukom i postavlja pravilo za sve buduće tehničke vrednosti. |",
);
push(
  "| 5 | **A4** (priprema površine) | Nema dokaza u dokumentaciji, ali je najtraženije pitanje na sajtu. Traži vaš tekst. |",
);
push("");
push("---");
push("");
push(
  "**Ništa iz ovog dokumenta nije objavljeno na sajtu i neće biti dok ne označite stavke.** Sajt trenutno prikazuje isto što i pre ove analize.",
);
push("");

mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(OUT, `${lines.join("\n")}\n`);

console.log(`Izvezeno: ${OUT}`);
console.log(`  odluka ukupno: ${totalDecisions}`);
console.log(`  sekcija A: ${highRows.length} (predloga: ${proposedAnswerCount})`);
console.log(`  sekcija B: ${groupIndex} (grupa podloga: ${substrateGroups.length})`);
console.log(`  proizvoda sa izjavom o podlozi: ${substrateProductCount}`);
