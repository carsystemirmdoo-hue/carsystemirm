import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  CANONICALIZATION_VERSION,
  SCHEMA_VERSION,
  SUPPORTED_PARSER_VERSIONS,
  canonicalJson,
  canonicalText,
  identitet,
  semanticHash,
  sourceHash,
} from "./canonical.mjs";
import { canonicalDecimal, DecimalError, decimalFromPrinted } from "./decimal.mjs";
import { SchemaError, validateAgainstSchema } from "./jsonSchema.mjs";
import { ContractRejection, SCHEMA, SUPPORTED, validateCanonicalInvoice } from "./validate.mjs";

/**
 * Ugovor: čista logika, sintetički podaci.
 *
 * Referentni vektori stoje u `fixtures/dev/sync/*.canonical.json`. Očekivani
 * hash se u ovom fajlu računa NEZAVISNOM implementacijom (`nezavisniHash`
 * ispod), ne produkcijskom funkcijom — inače bi test tvrdio samo da funkcija
 * radi ono što radi, i greška u samim pravilima normalizacije bi prošla.
 */

const KORENSKI = new URL("../../../", import.meta.url);
const ISSUER = "QA01";

const vektor = async (ime) =>
  JSON.parse(await readFile(new URL(`fixtures/dev/sync/${ime}.canonical.json`, KORENSKI), "utf8"));

const klon = (v) => JSON.parse(JSON.stringify(v));

/* =========================================================================
 * Nezavisna implementacija hash-a
 * ====================================================================== */

/**
 * Drugi put do istog broja, napisan ručno.
 *
 * Redosled ključeva je ovde ISPISAN i zatim sortiran lokalnim sortom; polja se
 * čitaju eksplicitno, jedno po jedno. Ne poziva `semanticContent` ni
 * `canonicalJson`. Ako se pravila normalizacije promene a ovaj kod ne, test
 * pada — što je i svrha.
 */
function nezavisniHash(p) {
  const sadrzaj = {
    schema_version: p.schema_version,
    canonicalization_version: p.canonicalization_version,
    source_system: p.source_system,
    issuer_code: p.issuer.code,
    document_kind: p.document.kind,
    document_number: p.document.number,
    issued_on: p.document.issued_on,
    trade_date: p.document.trade_date,
    date_basis: p.document.date_basis,
    currency: p.document.currency,
    partner_external_code: p.partner.external_code,
    printed_gross_total: p.totals.printed_gross_total,
    lines: p.lines.map((l) => ({
      line_number: l.line_number,
      article_code: l.article_code,
      description: l.description,
      unit: l.unit,
      quantity: l.quantity,
      unit_price: l.unit_price,
      discount_percent: l.discount_percent,
      tax_percent: l.tax_percent,
      tax_amount: l.tax_amount,
      gross_amount: l.gross_amount,
    })),
  };

  const ispisi = (v) => {
    if (v === null) return "null";
    if (Array.isArray(v)) return `[${v.map(ispisi).join(",")}]`;
    if (typeof v === "object") {
      const k = Object.keys(v).sort();
      return `{${k.map((key) => `${JSON.stringify(key)}:${ispisi(v[key])}`).join(",")}}`;
    }
    return JSON.stringify(v);
  };

  const ulaz = `carsystem/invoice-ingest/semantic/v${p.canonicalization_version}\n${ispisi(sadrzaj)}`;
  return `sha256:${createHash("sha256").update(ulaz, "utf8").digest("hex")}`;
}

/* =========================================================================
 * 1. Referentni vektori
 * ====================================================================== */

test("referentni vektori nose hash koji nezavisna implementacija potvrđuje", async () => {
  for (const ime of ["jedna-stavka", "vise-stavki", "vodeca-nula-partner"]) {
    const p = await vektor(ime);
    assert.equal(
      p.semantic_hash,
      nezavisniHash(p),
      `vektor „${ime}“ nosi hash koji nezavisna implementacija ne potvrđuje`,
    );
    // I produkcijska funkcija mora dati isti broj.
    assert.equal(semanticHash(p), p.semantic_hash, `produkcijski hash se razlikuje za „${ime}“`);
  }
});

test("referentni vektori prolaze autoritativnu šemu i punu proveru", async () => {
  for (const ime of ["jedna-stavka", "vise-stavki", "vodeca-nula-partner"]) {
    const p = await vektor(ime);
    assert.equal(validateAgainstSchema(p, SCHEMA).ok, true, `„${ime}“ ne prolazi šemu`);
    const out = validateCanonicalInvoice(p, { issuerCode: ISSUER });
    assert.equal(out.semanticHash, p.semantic_hash);
  }
});

test("vektor sa vodećom nulom čuva šifru partnera kao tekst", async () => {
  const p = await vektor("vodeca-nula-partner");
  assert.equal(p.partner.external_code, "00042");
  assert.notEqual(p.partner.external_code, "42");
});

test("vektor sa više stavki čuva redosled i sve stavke", async () => {
  const p = await vektor("vise-stavki");
  assert.equal(p.lines.length, 7);
  assert.deepEqual(
    p.lines.map((l) => l.line_number),
    [1, 2, 3, 4, 5, 6, 7],
  );
  assert.equal(p.parser_meta.line_count, 7);
});

/* =========================================================================
 * 3. Source hash vs semantic hash
 * ====================================================================== */

test("drugi bajtovi uz isti poslovni sadržaj: drugi source hash, ISTI semantic", async () => {
  const p = await vektor("vise-stavki");

  const drugi = klon(p);
  // Isti posao, drugi fajl: reprint, druga verzija čitača, druga strana.
  drugi.source_hash = sourceHash(new TextEncoder().encode("drugi bajtovi"));
  drugi.parser_meta.page_count = p.parser_meta.page_count + 1;

  assert.notEqual(drugi.source_hash, p.source_hash);
  assert.equal(
    semanticHash(drugi),
    semanticHash(p),
    "raspored po stranama i otisak fajla su ušli u semantic hash",
  );
});

test("parser verzija ne menja semantic hash", async () => {
  const p = await vektor("vise-stavki");
  const drugi = klon(p);
  drugi.parser_version = "biznisoft-pdf-9";
  assert.equal(semanticHash(drugi), semanticHash(p));
});

test("semantic hash ne uključuje sam sebe", async () => {
  const p = await vektor("vise-stavki");
  const drugi = klon(p);
  drugi.semantic_hash = `sha256:${"f".repeat(64)}`;
  assert.equal(semanticHash(drugi), semanticHash(p));
});

test("promena bilo koje poslovne vrednosti menja semantic hash", async () => {
  const p = await vektor("vise-stavki");
  const osnovni = semanticHash(p);

  const izmene = [
    ["količina", (d) => (d.lines[0].quantity = "9.000")],
    ["cena", (d) => (d.lines[0].unit_price = "999.0000")],
    ["rabat", (d) => (d.lines[0].discount_percent = "5.000")],
    ["zbir", (d) => (d.totals.printed_gross_total = "1.00")],
    ["kupac", (d) => (d.partner.external_code = "09999")],
    ["izdavalac", (d) => (d.issuer.code = "QA99")],
    ["broj dokumenta", (d) => (d.document.number = "99-RN000000000")],
    ["datum", (d) => (d.document.issued_on = "2026-02-02")],
    ["valuta", (d) => (d.document.currency = "EUR")],
    ["šifra artikla", (d) => (d.lines[0].article_code = "900999")],
    ["naziv", (d) => (d.lines[0].description = "DRUGI NAZIV")],
    ["verzija normalizacije", (d) => (d.canonicalization_version = 2)],
  ];

  for (const [sta, izmeni] of izmene) {
    const d = klon(p);
    izmeni(d);
    assert.notEqual(semanticHash(d), osnovni, `promena „${sta}“ nije promenila semantic hash`);
  }
});

test("šifra sa vodećom nulom se razlikuje od iste bez nje", async () => {
  const p = await vektor("vise-stavki");
  const a = klon(p);
  const b = klon(p);
  a.lines[0].article_code = "001234";
  b.lines[0].article_code = "1234";
  assert.notEqual(semanticHash(a), semanticHash(b));
});

test("stavke se ne sortiraju i ne agregiraju radi hash-a", async () => {
  const p = await vektor("vise-stavki");

  // Isti skup stavki u drugom redosledu je DRUGI dokument.
  const obrnut = klon(p);
  obrnut.lines = [...p.lines].reverse().map((l, i) => ({ ...l, line_number: i + 1 }));
  assert.notEqual(semanticHash(obrnut), semanticHash(p));

  // Ista šifra u dva reda ostaje dva reda.
  const dvaReda = klon(p);
  dvaReda.lines = [
    { ...p.lines[0], line_number: 1, quantity: "1.000" },
    { ...p.lines[0], line_number: 2, quantity: "1.000" },
  ];
  const jedanRed = klon(p);
  jedanRed.lines = [{ ...p.lines[0], line_number: 1, quantity: "2.000" }];
  assert.notEqual(
    semanticHash(dvaReda),
    semanticHash(jedanRed),
    "dva reda po 1 i jedan red od 2 daju isti otisak — stavke su agregirane",
  );
});

test("ekvivalentni decimalni zapisi daju ISTI canonical oblik", async () => {
  const p = await vektor("jedna-stavka");
  const osnovni = semanticHash(p);

  const isti = klon(p);
  isti.lines[0].quantity = "1.5"; // isto što i "1.500"
  isti.lines[0].unit_price = "110"; // isto što i "110.0000"
  assert.equal(semanticHash(isti), osnovni, "ekvivalentan decimalni zapis je dao drugi hash");
});

/* =========================================================================
 * 4. Decimale
 * ====================================================================== */

test("decimalna normalizacija dopunjuje nulama, a NE zaokružuje", () => {
  assert.equal(canonicalDecimal("1", "quantity"), "1.000");
  assert.equal(canonicalDecimal("1.5", "quantity"), "1.500");
  assert.equal(canonicalDecimal("1.500", "quantity"), "1.500");
  assert.equal(canonicalDecimal("007", "quantity"), "7.000");
  assert.equal(canonicalDecimal("-0.000", "quantity"), "0.000");
  assert.equal(canonicalDecimal("110", "unit_price"), "110.0000");

  // Količina ima TRI decimale — provereno u db/schema/sales.ts, ne u dokumentaciji.
  assert.equal(canonicalDecimal("1.234", "quantity"), "1.234");
  assert.throws(() => canonicalDecimal("1.2345", "quantity"), DecimalError);
});

test("decimalni tekst odbija sve što nije strogi oblik", () => {
  for (const los of ["1,5", "1e3", "+1", " 1", "1 ", "", "abc", "1.2.3", "0x10", "Infinity"]) {
    assert.throws(
      () => canonicalDecimal(los, "quantity"),
      DecimalError,
      `„${los}“ je propušten kao decimalni tekst`,
    );
  }
  // Broj se ne prima ni kada je ceo — JSON broj je već prošao kroz float.
  assert.throws(() => canonicalDecimal(1.5, "quantity"), DecimalError);
});

test("granice iznosa se odbijaju pre nego što ih baza odbije", () => {
  assert.throws(() => canonicalDecimal("1".repeat(12), "quantity"), DecimalError);
  assert.throws(() => canonicalDecimal("1000", "tax_percent"), DecimalError);
  assert.equal(canonicalDecimal("999.999", "tax_percent"), "999.999");
});

test("odštampani srpski zapis prelazi u decimalni tekst bez prolaska kroz broj", () => {
  assert.equal(decimalFromPrinted("1.234,500"), "1234.500");
  assert.equal(decimalFromPrinted("20%"), "20");
  assert.equal(decimalFromPrinted("0,00"), "0.00");
  assert.equal(decimalFromPrinted(""), null);
  assert.equal(decimalFromPrinted(null), null);

  /*
   * Broj sa više cifara nego što float ume da predstavi.
   *
   * `Number("1234,5678901234567")` bi ga izmenio; tekstualni put ga prenosi
   * neizmenjenog. To je razlog zbog koga ovaj put uopšte postoji.
   */
  const dugacak = "1234,5678901234567";
  assert.equal(decimalFromPrinted(dugacak), "1234.5678901234567");
});

/* =========================================================================
 * Canonical serijalizacija i tekst
 * ====================================================================== */

test("canonical JSON je deterministički i bez decimalnih brojeva", () => {
  assert.equal(canonicalJson({ b: 1, a: 2 }), '{"a":2,"b":1}');
  assert.equal(canonicalJson({ a: null }), '{"a":null}');
  assert.equal(canonicalJson([1, 2]), "[1,2]");
  // Decimalni broj u canonical sadržaju je greška, ne vrednost.
  assert.throws(() => canonicalJson({ a: 1.5 }), /decimalni broj/);
});

test("normalizacija teksta ne spaja poslovno različite vrednosti", () => {
  assert.equal(canonicalText("  a   b  "), "a b");
  assert.equal(canonicalText(""), null);
  assert.equal(canonicalText(null), null);
  // Dijakritici se NE presavijaju, veličina slova se NE menja.
  assert.notEqual(canonicalText("BELA"), canonicalText("bela"));
  assert.notEqual(canonicalText("Šifra"), canonicalText("Sifra"));
  // Identitet zadržava vodeće nule i ne dira unutrašnjost.
  assert.equal(identitet("  00042 "), "00042");
});

/* =========================================================================
 * 5. Kontrolisano odbijanje
 * ====================================================================== */

const odbija = (p, kod) => {
  let uhvacena = null;
  try {
    validateCanonicalInvoice(p, { issuerCode: ISSUER });
  } catch (e) {
    uhvacena = e;
  }
  assert.ok(uhvacena, `očekivano odbijanje „${kod}“, a provera je prošla`);
  assert.ok(
    uhvacena instanceof ContractRejection,
    `odbijanje nije ContractRejection nego ${uhvacena?.name}: ${uhvacena?.message}`,
  );
  assert.equal(uhvacena.code, kod, `očekivan kod „${kod}“, dobijen „${uhvacena.code}“`);
  return uhvacena;
};

test("lažan semantic hash se odbija", async () => {
  const p = await vektor("vise-stavki");
  p.semantic_hash = `sha256:${"a".repeat(64)}`;
  odbija(p, "semantic_hash_mismatch");
});

test("promenjen zbir se odbija", async () => {
  const p = await vektor("vise-stavki");
  p.totals.printed_gross_total = "9999.00";
  p.semantic_hash = semanticHash(p); // hash je „ispravan“, sadržaj nije
  odbija(p, "totals_mismatch");
});

test("promenjena stavka pada na aritmetici, ne na hash-u", async () => {
  const p = await vektor("jedna-stavka");
  p.lines[0].gross_amount = "500.00";
  p.semantic_hash = semanticHash(p);
  odbija(p, "line_arithmetic_mismatch");
});

test("nemoguć datum se odbija", async () => {
  const p = await vektor("jedna-stavka");
  p.document.issued_on = "2026-02-30";
  p.semantic_hash = semanticHash(p);
  odbija(p, "issued_on_invalid");
});

test("nepodržana verzija ugovora, normalizacije i čitača se odbijaju", async () => {
  const osnov = await vektor("jedna-stavka");

  const a = klon(osnov);
  a.schema_version = 999;
  a.semantic_hash = semanticHash(a);
  odbija(a, "schema_version_unsupported");

  const b = klon(osnov);
  b.canonicalization_version = 999;
  b.semantic_hash = semanticHash(b);
  odbija(b, "canonicalization_version_unsupported");

  const c = klon(osnov);
  c.parser_version = "biznisoft-pdf-999";
  c.semantic_hash = semanticHash(c);
  odbija(c, "parser_version_unsupported");
});

test("nepodržana valuta se odbija PRE upisa", async () => {
  const p = await vektor("jedna-stavka");
  p.document.currency = "EUR";
  p.semantic_hash = semanticHash(p);
  odbija(p, "currency_unsupported");
});

test("datum prometa i njegov osnov se ne primaju dok nema gde da se sačuvaju", async () => {
  const a = await vektor("jedna-stavka");
  a.document.date_basis = "trade_date";
  a.document.trade_date = "2026-01-01";
  a.semantic_hash = semanticHash(a);
  odbija(a, "date_basis_unsupported");

  // I sam datum prometa, i kada osnov ostaje `issued_on`.
  const b = await vektor("jedna-stavka");
  b.document.trade_date = "2026-01-01";
  b.semantic_hash = semanticHash(b);
  odbija(b, "trade_date_unsupported");
});

test("korektivne vrste se odbijaju i kada stignu kao JSON", async () => {
  for (const vrsta of ["storno", "povrat_robe", "knjizno_odobrenje", "korekcija_cene"]) {
    const p = await vektor("jedna-stavka");
    p.document.kind = vrsta;
    p.semantic_hash = semanticHash(p);
    odbija(p, "document_kind_unsupported");
  }
});

test("poslovna godina se ne sme tiho svesti na godinu izdavanja", async () => {
  const p = await vektor("jedna-stavka");
  p.document.business_year = 2025; // izdato 2026-01-01
  p.semantic_hash = semanticHash(p);
  odbija(p, "business_year_mismatch");
});

test("pogrešan izdavalac se odbija — opseg dolazi iz konteksta", async () => {
  const p = await vektor("jedna-stavka");
  p.issuer.code = "TUDJ";
  p.semantic_hash = semanticHash(p);
  odbija(p, "issuer_mismatch");
});

test("previše stavki se odbija na šemi", async () => {
  const p = await vektor("jedna-stavka");
  p.lines = Array.from({ length: 501 }, (_, i) => ({ ...p.lines[0], line_number: i + 1 }));
  p.parser_meta.line_count = 501;
  odbija(p, "schema_invalid");
});

test("dodatna polja se odbijaju, ne ignorišu", async () => {
  const osnov = await vektor("jedna-stavka");

  for (const dodaj of [
    (d) => (d.valid = true),
    (d) => (d.validation_status = "valid"),
    (d) => (d.document.series = "A"),
    (d) => (d.lines[0].note = "bilo šta"),
    (d) => (d.parser_meta.source_path = "C:/Users/tajna"),
  ]) {
    const p = klon(osnov);
    dodaj(p);
    const e = odbija(p, "schema_invalid");
    assert.ok(e.details.some((x) => x.reason === "nepoznato polje"), "polje nije prijavljeno");
  }
});

test("klijentska oznaka ispravnosti ne postoji u ugovoru", () => {
  // Nema polja kojim bi pošiljalac tvrdio da je sadržaj valjan.
  const polja = Object.keys(SCHEMA.properties);
  for (const zabranjeno of ["valid", "validation_status", "status", "trusted", "signature"]) {
    assert.ok(!polja.includes(zabranjeno), `ugovor nosi polje „${zabranjeno}“`);
  }
});

test("neispravni redni brojevi stavki se odbijaju", async () => {
  const a = await vektor("vise-stavki");
  a.lines[2].line_number = 1;
  a.semantic_hash = semanticHash(a);
  odbija(a, "line_numbers_duplicated");

  const b = await vektor("vise-stavki");
  b.lines = b.lines.slice(0, 3).map((l, i) => ({ ...l, line_number: i + 2 }));
  b.parser_meta.line_count = 3;
  b.totals.printed_gross_total = "0.00";
  b.semantic_hash = semanticHash(b);
  odbija(b, "line_numbers_not_sequential");
});

test("prijavljen broj stavki mora odgovarati stvarnom", async () => {
  const p = await vektor("vise-stavki");
  p.parser_meta.line_count = 3;
  p.semantic_hash = semanticHash(p);
  odbija(p, "line_count_mismatch");
});

test("provera bez pouzdanog opsega je programerska greška, ne loš ulaz", async () => {
  const p = await vektor("jedna-stavka");
  assert.throws(() => validateCanonicalInvoice(p, { issuerCode: "" }), /pouzdanog opsega/);
  assert.throws(() => validateCanonicalInvoice(p, undefined), /pouzdanog opsega/);
});

/* =========================================================================
 * 7. Greške ne odaju sadržaj
 * ====================================================================== */

test("poruke o odbijanju ne nose vrednosti, putanje, SQL ni stack trace", async () => {
  const osnov = await vektor("vise-stavki");
  const slucajevi = [
    (d) => (d.totals.printed_gross_total = "9999.00"),
    (d) => (d.document.currency = "EUR"),
    (d) => (d.lines[0].article_code = "TAJNASIFRA"),
    (d) => (d.partner.external_code = "09999"),
    (d) => (d.lines[0].quantity = "1.23456"),
  ];

  for (const izmeni of slucajevi) {
    const p = klon(osnov);
    izmeni(p);
    try {
      p.semantic_hash = semanticHash(p);
    } catch {
      /* neka izmena je namerno neispravna za canonical oblik */
    }
    let poruka = "";
    try {
      validateCanonicalInvoice(p, { issuerCode: ISSUER });
      continue;
    } catch (e) {
      poruka = `${e.message} ${JSON.stringify(e.details ?? [])}`;
    }

    assert.doesNotMatch(poruka, /9999|TAJNASIFRA|09999|3538/, `poruka nosi vrednost: ${poruka}`);
    assert.doesNotMatch(poruka, /SELECT|INSERT|UPDATE|FROM |WHERE /i, "poruka nosi SQL");
    assert.doesNotMatch(poruka, /\/Users\/|[A-Z]:\\|node_modules/, "poruka nosi putanju");
    assert.doesNotMatch(poruka, /\bat \w+ \(/, "poruka nosi stack trace");
  }
});

/* =========================================================================
 * Validator ugovora
 * ====================================================================== */

test("validator odbija keyword koji ne sprovodi", () => {
  /*
   * Cela odbrana jedne definicije ugovora.
   *
   * Da validator ćutke preskoči nepoznat keyword, neko bi dodao ograničenje u
   * `schema.json` i ono bi postojalo samo u fajlu.
   */
  assert.throws(
    () => validateAgainstSchema({}, { type: "object", oneOf: [] }),
    SchemaError,
  );
  assert.throws(
    () => validateAgainstSchema("x", { type: "string", format: "email" }),
    SchemaError,
  );
});

test("autoritativna šema koristi samo keyword-e koje validator sprovodi", () => {
  // Prolazak nad referentnim vektorom bi bacio na prvom nepodržanom keyword-u.
  assert.doesNotThrow(() => validateAgainstSchema({}, SCHEMA));
});

test("verzije i podržani podskup su izričito zapisani", () => {
  assert.equal(SCHEMA_VERSION, 1);
  assert.equal(CANONICALIZATION_VERSION, 1);
  assert.deepEqual(SUPPORTED_PARSER_VERSIONS, ["biznisoft-pdf-1"]);
  assert.deepEqual(SUPPORTED.currencies, ["RSD"]);
  assert.deepEqual(SUPPORTED.dateBases, ["issued_on"]);
  assert.deepEqual(SUPPORTED.documentKinds, ["faktura"]);

  // Lista verzija čitača je NIZ: prelazni period sa dve verzije je normalan.
  assert.ok(Array.isArray(SUPPORTED_PARSER_VERSIONS));
});
