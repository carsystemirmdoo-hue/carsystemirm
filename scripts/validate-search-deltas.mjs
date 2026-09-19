#!/usr/bin/env node
/**
 * Delta validator: zaključava rezultate pretrage na STVARNIM podacima.
 *
 * Unit testovi (`lib/search/*.test.mjs`) rade nad sintetičkim fixture-om i
 * dokazuju pravila. Ovaj skript dokazuje ISHOD na trenutnom katalogu — brojeve
 * koji su ručno pregledani i potvrđeni, plus zapise koji moraju (ili ne smeju)
 * da budu u rezultatu. Bez njega bi tiha promena podataka ili težina prošla kao
 * „testovi prolaze".
 *
 * Svaki broj ovde je ili potvrđen iz ranijeg ponašanja kataloga, ili je delta
 * sa dokumentovanim razlogom u `docs/PRODUCT_SEARCH.md`.
 *
 * Zahteva pokrenut dev/preview server; namerno ga ne pokreće sam.
 *
 * Usage: node scripts/validate-search-deltas.mjs [--base-url=…]
 */

import { buildSearchIndex, searchIndex } from "../lib/search/engine.mjs";
import { groupSearchHits } from "../lib/search/grouping.mjs";

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => arg.replace(/^--/, "").split("=")),
);
const baseUrl = args["base-url"] ?? "http://localhost:3100";

const failures = [];
const expect = (condition, message) => {
  if (!condition) failures.push(message);
};

const response = await fetch(`${baseUrl}/katalog/search-index.json`).catch(() => null);
if (!response?.ok) {
  console.error(
    `Search indeks nije dostupan na ${baseUrl}. Pokreni postojeći dev/preview server pa ponovi.`,
  );
  process.exit(1);
}

const payload = await response.json();
const index = buildSearchIndex(payload.records);
const familyIndexBySlug = new Map(
  payload.records.flatMap((record, position) =>
    record.kind === "family" && record.familySlug ? [[record.familySlug, position]] : [],
  ),
);

/** Katalog: ceo rangirani rezultat, pa filteri fasete — nikad obrnuto. */
function catalogResults(query, { brandSlug } = {}) {
  const hits = searchIndex(index, query, { limit: 5000 });
  return brandSlug ? hits.filter((hit) => hit.record.brandSlug === brandSlug) : hits;
}

function headerGroups(query) {
  return groupSearchHits(searchIndex(index, query, { limit: 60 }), {
    familyIndexBySlug,
    maxGroups: 8,
    maxMembers: 3,
  });
}

/* -------------------------------------------------------------------------- */
/* Potvrđeni brojevi                                                          */
/* -------------------------------------------------------------------------- */

const EXPECTED = [
  /*
   * `ral`: 140 → 126. Uklonjeno je 14 substring slučajnosti („coRAL blush",
   * „grey neutRAL", „natuRAL") koje stara `includes()` provera nije umela da
   * razlikuje od reči. Dve porodice koje JESU RAL linije (Fast Acrylic, Easy
   * Max) su zadržane kroz tokene zajedničke većini varijanti.
   */
  /*
   * 126 → 130 (Carsystem sync, katalog 2026/27): četiri zvanična proizvoda
   * „Rallye-Spray” (gloss, matt, Premium black glossy/matt). To je prefiks
   * reči („ral” → „rallye”), isto pravilo po kome upit nalazi i „RAL”, a ne
   * substring slučajnost kakve su uklonjene gore.
   */
  { query: "ral", count: 130 },
  { query: "600 ml", count: 4 },
  { query: "antichip", count: 8 },
  { query: "cosmos antichip", count: 8 },
  /*
   * `1l`: 4 → 50 → 61. Vrednost 4 (R-M 3 + Norbin 1) je zastarela još od
   * Baslac kataloga (b8d4b44): HEAD je vraćao 50, od čega 46 Baslac pakovanja
   * od 1 L. Carsystem sync dodaje 11 proizvoda sa JEDNOM varijantom čija je
   * zvanična specifikacija tačno „1 L” (KS-100/200/300.2/500.2/800/4000.2,
   * Activator, High Gloss Additive, Spotblender, Bumper Paint, Nano Carnauba
   * Wax). Pregledano 2026-09-18: svih 61 zapisa nosi pakovanje od 1 L u polju
   * volumena/varijante — 0 lažnih pogodaka.
   *
   * 61 → 68 (2026-09-19): C.A.R.FIT sync dodaje 7 proizvoda sa JEDNOM šifrom
   * čije je zvanično pakovanje „1 l” (Bitumen underbody protection 5-700-1000,
   * Cutting compound 5-100-1000, Finishing compound 5-100-1001, Fade Out Thinner
   * 7-557-1000, Plastic Primer 4-355-1000, Pump Spray 3-255-0001 i Express
   * Clearcoat 7-156-1500, set „lak 1 l + učvršćivač 0,5 l”). Svih 7 pregledano —
   * 0 lažnih pogodaka.
   *
   * 68 → 79: oznake varijanti C.A.R.FIT proizvoda su pojmovi pretrage
   * (`searchTerms`), pa „1 l” nalazi i 11 porodica koje pakovanje od 1 l imaju
   * kao JEDNU od varijanti (2K Fast Air Primer Filler, 2K HS Perfect clear, 2K HS
   * Scratch resistent, 2K MS Clearcoat, 2K Ultra HS Clearcoat, 2K US Filler,
   * Clearcoar matt, Rapid air clear coat VOC, Silicone Remover, Silicone Remover
   * „Strawberry”, Universal Thinner). Svaka je proverena u datasetu: nosi red
   * varijante sa merom tačno „1 l”.
   */
  { query: "1l", count: 79 },
  { query: "1 l", count: 79 },
  /*
   * `3,5 l`: 1 → 10. Isto zastarevanje od Baslac kataloga (HEAD = 10, svih 10
   * su Baslac pakovanja od 3,5 L). Carsystem sync ovde ne dodaje ništa.
   */
  { query: "3,5 l", count: 10 },
  { query: "3.5l", count: 10 },
  { query: "carmine", count: 2 },
  { query: "C 2E50", count: 1 },
  { query: "satajet", count: 1 },
];

for (const testCase of EXPECTED) {
  const actual = catalogResults(testCase.query).length;
  expect(
    actual === testCase.count,
    `Upit „${testCase.query}": očekivano ${testCase.count} rezultata, dobijeno ${actual}.`,
  );
}

/* -- Zapisi koji MORAJU biti u rezultatu ----------------------------------- */

const MUST_INCLUDE = [
  // Stvarne RAL linije: porodica se nalazi po pojmu koji opisuje njene varijante.
  { query: "ral", id: "family:cosmos-lac-fast-acrylic" },
  { query: "ral", id: "family:cosmos-lac-easy-max" },
  { query: "ral", id: "family:cosmos-lac-ral" },
  // Stvarna 1 L pakovanja koja stari haystack nije nosio (volumen je bio samo
  // u `packages`, ne u prednormalizovanom stringu).
  { query: "1 l", id: "rm-diamont-bazna-boja" },
  { query: "1l", id: "rm-diamont-bazna-boja" },
  // Šifra artikla VARIJANTE (P40 diska P.25) nalazi proizvod, ne samo vodeća šifra.
  { query: "160.273", id: "carsystem-sanding-disc-p-25-ceramic" },
  { query: "159.226", id: "carsystem-f23-brusni-diskovi" },
  // C.A.R.FIT: šifra granulacije, šifra učvršćivača sa stranice laka i šifra
  // dodata ručnom zapisu kroz dopunu nalaze SVOJ proizvod.
  { query: "6-300-0080", id: "carfit-gold-paper-disc" },
  { query: "7-336-1000", id: "carfit-rapid-air-clear-coat-voc" },
  { query: "1-201-0450", id: "carfit-maskirna-folija-4x5m" },
  // Befar: šifra pakovanja hemije, šifra sa slovnim sufiksom (linija Leo) i
  // šifra podloške po broju rupa nalaze SVOJ proizvod.
  { query: "75250", id: "befar-liquid-compound" },
  { query: "55401ADV", id: "befar-leo-plus-advance-velcro-compounding-pad" },
  { query: "93162", id: "befar-backing-pad" },
  // Alias: Antigravel je antichip, pa ga upit „antichip" mora naći.
  { query: "antichip", id: "family:cosmos-lac-master-mechanic-antigravel-paintable" },
];

for (const testCase of MUST_INCLUDE) {
  const found = catalogResults(testCase.query).some((hit) => hit.record.id === testCase.id);
  expect(found, `Upit „${testCase.query}" ne vraća zapis \`${testCase.id}\`.`);
}

/* -- Zapisi koji NE SMEJU biti u rezultatu --------------------------------- */

const MUST_EXCLUDE = [
  // „coRAL", „neutRAL", „natuRAL" — reč `ral` se u njima ne pojavljuje.
  { query: "ral", id: "cosmos-lac-flame-orange-fo-307-400-ml-flame-orange-fo-307-coral" },
  { query: "ral", id: "cosmos-lac-flame-blue-fb-838-400-ml-flame-blue-fb-838-grey-neutral" },
  { query: "ral", id: "cosmos-lac-wood-putties-10-water-based-wood-putty-10-natural" },
  // Šifra FB 600 na pakovanju od 400 ml nije rezultat za „600 ml".
  {
    query: "600 ml",
    id: "cosmos-lac-flame-blue-fb-600-400-ml-flame-blue-fb-600-riviera-light",
  },
  // Pakovanje je osa varijacije porodice, ne njena osobina.
  { query: "600 ml", id: "family:cosmos-lac-molotow-burner" },
  // „mp-16**1 l**eaf" — substring, ne mera.
  { query: "1 l", id: "cosmos-lac-molotow-premium-mp-161-400-ml-mp-161-leaf-green" },
];

for (const testCase of MUST_EXCLUDE) {
  const found = catalogResults(testCase.query).some((hit) => hit.record.id === testCase.id);
  expect(!found, `Upit „${testCase.query}" vraća zapis koji ne bi smeo: \`${testCase.id}\`.`);
}

/* -- Svaki rezultat za meru mora stvarno imati to pakovanje ---------------- */

for (const query of ["600 ml", "1 l", "3,5 l"]) {
  for (const { record } of catalogResults(query)) {
    const packaging = `${record.technicalLine ?? ""} ${record.quantityLabel ?? ""}`;
    const compact = packaging.toLowerCase().replace(/[\s,]/g, (match) => (match === "," ? "." : ""));
    const wanted = query.toLowerCase().replace(/[\s,]/g, (match) => (match === "," ? "." : ""));
    // Porodica sa više pakovanja prikazuje „N varijanti”; mera je tada u oznakama
    // varijanti, koje su u indeksu kao pojmovi (`600ml`, `1l`, `3.5l`).
    const inVariantTerms = (record.terms ?? []).includes(wanted);
    expect(
      compact.includes(wanted) || inVariantTerms,
      `Upit „${query}" vraća \`${record.id}\` čije pakovanje je „${packaging.trim()}".`,
    );
  }
}

/* -- Brand filter mora da radi nad KOMPLETNIM rezultatom ------------------- */

for (const query of ["lak", "ral", "prajmer"]) {
  const all = catalogResults(query);
  const brands = new Set(all.map((hit) => hit.record.brandSlug));
  for (const brandSlug of brands) {
    const filtered = catalogResults(query, { brandSlug });
    const expected = all.filter((hit) => hit.record.brandSlug === brandSlug).length;
    expect(
      filtered.length === expected,
      `Upit „${query}" + brend=${brandSlug}: filtriranje nije nad kompletnim skupom (${filtered.length} ≠ ${expected}).`,
    );
    expect(
      filtered.every((hit) => hit.record.brandSlug === brandSlug),
      `Upit „${query}" + brend=${brandSlug}: rezultat sadrži drugi brend.`,
    );
  }
}

/* -- Header grupisanje ne sme da menja broj rezultata kataloga ------------- */

for (const query of ["ral", "antichip", "600 ml", "molotow chrome", "lak"]) {
  const catalogCount = catalogResults(query).length;
  const groups = headerGroups(query);
  expect(
    groups.length <= 8,
    `Upit „${query}": Header prikazuje ${groups.length} grupa (max 8).`,
  );
  expect(
    catalogResults(query).length === catalogCount,
    `Upit „${query}": grupisanje je promenilo rezultat engine-a.`,
  );
}

/* -- Sort nad kompletnim filtriranim skupom -------------------------------- */

{
  const all = catalogResults("lak");
  const sorted = [...all].sort((first, second) =>
    first.record.name.localeCompare(second.record.name, "sr-Latn"),
  );
  expect(
    sorted.length === all.length,
    "Sortiranje je promenilo veličinu skupa rezultata.",
  );
  expect(
    sorted[0].record.name.localeCompare(all[0].record.name, "sr-Latn") <= 0,
    "Sortiranje A–Z ne počinje od stvarno prvog zapisa kompletnog skupa.",
  );
}

/* -- Jednoslovni upit ------------------------------------------------------ */

expect(
  searchIndex(index, "c", { limit: 5000 }).length === 0,
  "Jednoslovni upit i dalje pokreće široku pretragu.",
);
expect(
  searchIndex(index, "cl", { limit: 5000 }).length > 0,
  "Dvoslovni upit ne vraća ništa — prefiks pretraga je previše sužena.",
);

if (failures.length) {
  console.error(`Delta validacija nije prošla (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      records: payload.records.length,
      queries: EXPECTED.map((testCase) => ({
        query: testCase.query,
        results: testCase.count,
        headerGroups: headerGroups(testCase.query).length,
      })),
      brandFilterOverFullSet: true,
      groupingKeepsCatalogCount: true,
      singleCharacterQueryBlocked: true,
    },
    null,
    2,
  ),
);
