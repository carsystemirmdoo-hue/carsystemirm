import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { parseBiznisoftPdf } from "../../pdf/parseDocument";
import { semanticHash, sourceHash } from "./canonical.mjs";
import {
  CanonicalBuildError,
  canonicalFromParsedDocument,
  SOURCE_CURRENCY,
} from "./fromParsedDocument.mjs";
import { CANONICAL_TOP_LEVEL_KEYS } from "./types";
import { SCHEMA, validateCanonicalInvoice } from "./validate.mjs";

/**
 * Lokalni adapter: sintetički PDF → canonical payload.
 *
 * Ovo NIJE Windows agent — nema skeniranja foldera, trajnog stanja, slanja ni
 * rasporeda. Dokazuje se samo da isti dokument, pročitan istim parserom, daje
 * canonical zapis koji serverska provera prihvata, i da se poklapa sa
 * referentnim vektorom koji stoji u repou.
 *
 * Pokreće se kroz `tsx` jer uvozi `parseDocument.ts` — isti modul koji bi
 * pokrenuo i lokalni proces. Prolazak ovde NE dokazuje Windows kompatibilnost;
 * to ostaje prihvatna provera P3.
 */

const ISSUER = "QA01";
const KORENSKI = new URL("../../../", import.meta.url);

const bajtovi = async (ime: string) =>
  new Uint8Array(await readFile(new URL(`fixtures/dev/biznisoft/${ime}`, KORENSKI)));

const vektor = async (ime: string) =>
  JSON.parse(await readFile(new URL(`fixtures/dev/sync/${ime}.canonical.json`, KORENSKI), "utf8"));

/** Isti poslovni dokument, drugi bajtovi — „ponovna štampa istog računa“. */
const drugiBajtovi = (b: Uint8Array) =>
  new Uint8Array([...b, ...new TextEncoder().encode("\n% ponovna stampa\n")]);

/** Podržani fixtures imaju referentni vektor; nepodržani ga NEMAJU. */
const PODRZANI = ["jedna-stavka", "vise-stavki", "vodeca-nula-partner"] as const;

/**
 * Namerno nepodržani uzorci i razlog zbog koga to jesu.
 *
 * Ne pretvaraju se u uspešan uvoz. Svaki od njih dokazuje jednu granu koja
 * mora ostati zatvorena — nastavak tabele, nepoklopljen zbir, dokument bez
 * zaglavlja.
 */
const NEPODRZANI: Record<string, string> = {
  "nastavak-tabele.pdf": "unsupported_requires_sample",
  "zbir-se-ne-poklapa.pdf": "totals_mismatch",
  "neispravan-bez-zaglavlja.pdf": "unparsable",
};

/* =========================================================================
 * 2. Lokalni adapter i server daju isto
 * ====================================================================== */

test("lokalni adapter daje TAČNO referentni vektor iz repoa", async () => {
  for (const ime of PODRZANI) {
    const b = await bajtovi(`${ime}.pdf`);
    const parsed = await parseBiznisoftPdf(b);
    const napravljen = canonicalFromParsedDocument(parsed, b, { issuerCode: ISSUER });

    assert.deepEqual(
      napravljen,
      await vektor(ime),
      `„${ime}“ se razlikuje od referentnog vektora`,
    );
  }
});

test("serverska provera prihvata payload lokalnog adaptera i računa isti hash", async () => {
  for (const ime of PODRZANI) {
    const b = await bajtovi(`${ime}.pdf`);
    const parsed = await parseBiznisoftPdf(b);
    const payload = canonicalFromParsedDocument(parsed, b, { issuerCode: ISSUER });

    /*
     * Server NE veruje dostavljenom hash-u: računa svoj i poredi. Ovde se to i
     * dokazuje — vraćena vrednost dolazi iz serverskog računanja.
     */
    const out = validateCanonicalInvoice(payload, { issuerCode: ISSUER });
    assert.equal(out.semanticHash, payload.semantic_hash);
    assert.equal(out.semanticHash, (await vektor(ime)).semantic_hash);
  }
});

test("ključne poslovne vrednosti se poklapaju sa pročitanim dokumentom", async () => {
  const b = await bajtovi("vise-stavki.pdf");
  const parsed = await parseBiznisoftPdf(b);
  const p = canonicalFromParsedDocument(parsed, b, { issuerCode: ISSUER });

  assert.equal(p.document.number, parsed.header.documentNumber.value);
  assert.equal(p.document.issued_on, parsed.header.documentDate.value);
  assert.equal(p.partner.external_code, parsed.header.partnerCode.value);
  assert.equal(p.lines.length, parsed.lines.length);
  assert.equal(p.parser_version, parsed.parserVersion);

  for (const [i, l] of p.lines.entries()) {
    assert.equal(l.article_code, parsed.lines[i].articleCode);
    assert.equal(l.description, parsed.lines[i].description);
    // Decimalni tekst mora biti brojno jednak pročitanoj vrednosti.
    assert.equal(Number(l.quantity), parsed.lines[i].quantity);
    assert.equal(Number(l.unit_price), parsed.lines[i].unitPrice);
    assert.equal(Number(l.gross_amount), parsed.lines[i].grossAmount);
  }
});

/* =========================================================================
 * 3. Isti sadržaj, drugi bajtovi
 * ====================================================================== */

test("ponovna štampa istog računa: drugi source hash, ISTI semantic hash", async () => {
  const b = await bajtovi("vise-stavki.pdf");
  const drugi = drugiBajtovi(b);

  const a = canonicalFromParsedDocument(await parseBiznisoftPdf(b), b, { issuerCode: ISSUER });
  const c = canonicalFromParsedDocument(await parseBiznisoftPdf(drugi), drugi, {
    issuerCode: ISSUER,
  });

  assert.notEqual(a.source_hash, c.source_hash, "otisak fajla se nije promenio");
  assert.equal(a.semantic_hash, c.semantic_hash, "poslovni otisak se promenio bez promene posla");
  assert.equal(sourceHash(b), a.source_hash);
});

test("promena poslovne vrednosti menja semantic hash i posle parsiranja", async () => {
  const b = await bajtovi("vise-stavki.pdf");
  const p = canonicalFromParsedDocument(await parseBiznisoftPdf(b), b, { issuerCode: ISSUER });

  const izmenjen = JSON.parse(JSON.stringify(p));
  izmenjen.lines[0].quantity = "99.000";
  assert.notEqual(semanticHash(izmenjen), p.semantic_hash);
});

/* =========================================================================
 * Nepodržani uzorci ostaju nepodržani
 * ====================================================================== */

test("nepodržan dokument NEMA canonical oblik", async () => {
  for (const [fajl, ocekivan] of Object.entries(NEPODRZANI)) {
    const b = await bajtovi(fajl);
    const parsed = await parseBiznisoftPdf(b);

    assert.equal(parsed.validationStatus, ocekivan, `„${fajl}“ je promenio status`);

    /*
     * Canonical zapis se ne pravi ni „sa oznakom da nije valjan“.
     *
     * Takav payload bi server morao da razlikuje od valjanog po polju koje
     * dolazi od pošiljaoca — a to je tačno polje kome se ne sme verovati.
     */
    assert.throws(
      () => canonicalFromParsedDocument(parsed, b, { issuerCode: ISSUER }),
      CanonicalBuildError,
      `„${fajl}“ je dobio canonical oblik`,
    );
  }
});

test("adapter odbija dokument bez izdavaoca", async () => {
  const b = await bajtovi("jedna-stavka.pdf");
  const parsed = await parseBiznisoftPdf(b);
  assert.throws(
    () => canonicalFromParsedDocument(parsed, b, { issuerCode: "" }),
    CanonicalBuildError,
  );
});

/* =========================================================================
 * Valuta: konfiguracija izvora, ne pročitan podatak
 * ====================================================================== */

test("valuta je podrazumevana vrednost izvora, a ne pročitana sa dokumenta", async () => {
  const b = await bajtovi("jedna-stavka.pdf");
  const parsed = await parseBiznisoftPdf(b);
  const p = canonicalFromParsedDocument(parsed, b, { issuerCode: ISSUER });

  assert.equal(p.document.currency, SOURCE_CURRENCY);
  assert.equal(SOURCE_CURRENCY, "RSD");

  /*
   * Dokaz da NIJE pročitana: zaglavlje dokumenta uopšte nema polje valute.
   * Ako se jednog dana pojavi, ovaj test pada i tera da se odluči šta je
   * izvor istine — umesto da tiho ostane pretpostavka.
   */
  assert.equal(
    Object.prototype.hasOwnProperty.call(parsed.header, "currency"),
    false,
    "čitač sada čita valutu — canonical je više ne sme podrazumevati",
  );
});

test("datum prometa se ne izmišlja: čitač poznaje samo datum izdavanja", async () => {
  const b = await bajtovi("jedna-stavka.pdf");
  const parsed = await parseBiznisoftPdf(b);
  const p = canonicalFromParsedDocument(parsed, b, { issuerCode: ISSUER });

  assert.equal(p.document.trade_date, null);
  assert.equal(p.document.date_basis, "issued_on");
  assert.equal(
    Object.prototype.hasOwnProperty.call(parsed.header, "tradeDate"),
    false,
    "čitač sada čita datum prometa — ugovor ga više ne sme slati kao null",
  );
});

/* =========================================================================
 * Privatnost payloada
 * ====================================================================== */

test("payload ne nosi ime fajla, putanju, sirov tekst ni PIB", async () => {
  const b = await bajtovi("vise-stavki.pdf");
  const parsed = await parseBiznisoftPdf(b);
  const p = canonicalFromParsedDocument(parsed, b, { issuerCode: ISSUER });

  const tekst = JSON.stringify(p);

  // PIB-ovi POSTOJE u pročitanom dokumentu, ali ne smeju ući u payload.
  const pib = parsed.header.customerPib.value;
  assert.ok(pib, "preduslov: uzorak ima PIB kupca");
  assert.doesNotMatch(tekst, new RegExp(pib), "PIB kupca je ušao u payload");

  assert.doesNotMatch(tekst, /\.pdf/i, "ime fajla je ušlo u payload");
  assert.doesNotMatch(tekst, /\/Users\/|[A-Z]:\\/, "putanja je ušla u payload");
  // `raw` je sirov tekst reda iz PDF-a; ne sme se prenositi.
  assert.doesNotMatch(tekst, /"raw"/, "sirov tekst je ušao u payload");
});

/* =========================================================================
 * Tip prati šemu
 * ====================================================================== */

test("TypeScript tip ne luta od autoritativne šeme", () => {
  /*
   * `types.ts` je pomoć pri prevođenju, ne validator — jedini ugovor je
   * `schema.json`. Ali tip koji tvrdi drugačiji oblik od šeme je gori od
   * nikakvog: pozivalac bi mu verovao. Ovde se skupovi polja porede, pa
   * promena sheme bez izmene tipa pada.
   */
  const uSemi = Object.keys((SCHEMA as { properties: Record<string, unknown> }).properties).sort();
  const uTipu = [...CANONICAL_TOP_LEVEL_KEYS].sort();
  assert.deepEqual(uTipu, uSemi, "tip i šema se razlikuju u poljima najvišeg nivoa");
});
