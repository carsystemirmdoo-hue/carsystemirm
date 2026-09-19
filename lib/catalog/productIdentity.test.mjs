/**
 * Testovi pravila identiteta proizvoda.
 *
 * Sve se dokazuje IZVRŠAVANJEM stvarnih funkcija — `auditProductIdentity`,
 * `internalCodeRejectionReason`, runtime loader kataloga. Nigde se ne proverava
 * tekst izvornog fajla regexom: takva provera prolazi i kad se ponašanje
 * pokvari, i pada kad se promeni samo formatiranje.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  INTERNAL_CODE_PATTERN,
  auditProductIdentity,
  classifySkuSemantics,
  internalCodeRejectionReason,
  isValidInternalCode,
  manufacturerCodeRejectionReason,
} from "./product-identity.mjs";
import {
  loadCatalogRuntime,
  summarizeCatalogRuntime,
} from "../../scripts/lib/catalog-runtime.mjs";

/* -------------------------------------------------------------------------- */
/* Interna šifra — string sa vodećim nulama                                   */
/* -------------------------------------------------------------------------- */

test('"005500" je validna interna šifra i zadržava vodeće nule', () => {
  const code = "005500";
  assert.equal(isValidInternalCode(code), true);
  assert.equal(internalCodeRejectionReason(code), null);
  // Vrednost se ne normalizuje ni ne skraćuje ni na jednom koraku.
  assert.equal(code, "005500");
  assert.equal(code.length, 6);
  assert.equal(code.startsWith("00"), true);
  assert.match(code, INTERNAL_CODE_PATTERN);
});

test("interna šifra kao broj je odbijena — vodeće nule su izgubljene", () => {
  assert.equal(isValidInternalCode(5500), false);
  assert.match(internalCodeRejectionReason(5500), /broj/);
  // I sam broj koji „izgleda" kao šestocifrena šifra ostaje odbijen: tip nosi
  // pravilo, ne slučajna dužina.
  assert.equal(isValidInternalCode(123456), false);
  assert.match(internalCodeRejectionReason(123456), /broj/);
});

test("Number() nad internom šifrom menja identitet — zato je broj zabranjen", () => {
  assert.notEqual(String(Number("005500")), "005500");
  assert.equal(String(Number("005500")), "5500");
  // Dve različite šifre kolabiraju u isti broj.
  assert.equal(Number("005500"), Number("5500"));
  assert.notEqual("005500", "5500");
});

test("neispravni oblici interne šifre su odbijeni", () => {
  const invalid = [
    ["5500", /šest cifara/],
    ["005500.00", /šest cifara/],
    ["", /prazan string/],
    [" 005500", /razmak/],
    ["005500 ", /razmak/],
    ["00550", /šest cifara/],
    ["0055000", /šest cifara/],
    ["00A500", /šest cifara/],
    [null, /mora biti string/],
    [true, /mora biti string/],
    [["005500"], /mora biti string/],
  ];

  for (const [value, expected] of invalid) {
    assert.equal(isValidInternalCode(value), false, `očekivano odbijanje: ${String(value)}`);
    assert.match(internalCodeRejectionReason(value), expected);
  }
});

/* -------------------------------------------------------------------------- */
/* Šifra proizvođača — string | null | undefined                              */
/* -------------------------------------------------------------------------- */

test("manufacturerCode prihvata string, null i undefined", () => {
  assert.equal(manufacturerCodeRejectionReason("53224337"), null);
  assert.equal(manufacturerCodeRejectionReason("35-M214"), null);
  // `null` = provereno pa nije potvrđena.
  assert.equal(manufacturerCodeRejectionReason(null), null);
  // `undefined` = još nije provereno.
  assert.equal(manufacturerCodeRejectionReason(undefined), null);
});

test("manufacturerCode odbija prazan string i ne-string vrednosti", () => {
  assert.match(manufacturerCodeRejectionReason(""), /prazan string/);
  assert.match(manufacturerCodeRejectionReason("   "), /prazan string/);
  assert.match(manufacturerCodeRejectionReason(53224337), /mora biti string/);
});

/* -------------------------------------------------------------------------- */
/* Audit nad kontrolisanim fixtureom                                          */
/* -------------------------------------------------------------------------- */

const product = (overrides) => ({
  slug: "x",
  sku: "X-1",
  brandSlug: "test",
  badges: [],
  ...overrides,
});

test("čist fixture nema nijedan konflikt", () => {
  const report = auditProductIdentity({
    products: [
      product({ slug: "a", sku: "A-1", internalCode: "005500", manufacturerCode: "M1" }),
      product({ slug: "b", sku: "B-1", internalCode: "005501", manufacturerCode: null }),
      product({ slug: "c", sku: "C-1" }),
    ],
  });

  assert.equal(report.hasConflicts, false);
  assert.deepEqual(report.conflicts, []);
  assert.equal(report.totals.products, 3);
  assert.equal(report.totals.withInternalCode, 2);
  assert.equal(report.totals.withManufacturerCode, 1);
  assert.equal(report.totals.manufacturerCodeCheckedAndAbsent, 1);
  assert.equal(report.totals.manufacturerCodeUnchecked, 1);
});

test("duplirana popunjena interna šifra se otkriva", () => {
  const report = auditProductIdentity({
    products: [
      product({ slug: "a", internalCode: "005500" }),
      product({ slug: "b", internalCode: "005500" }),
      product({ slug: "c" }),
    ],
  });

  const duplicates = report.conflicts.filter((c) => c.kind === "duplicate-internal-code");
  assert.equal(duplicates.length, 1);
  assert.equal(duplicates[0].detail.internalCode, "005500");
  assert.deepEqual(duplicates[0].detail.slugs, ["a", "b"]);
});

test("prazna interna šifra ne pravi lažni duplikat", () => {
  const report = auditProductIdentity({
    products: [product({ slug: "a" }), product({ slug: "b" }), product({ slug: "c" })],
  });

  assert.equal(
    report.conflicts.filter((c) => c.kind === "duplicate-internal-code").length,
    0,
  );
});

test("interna šifra upisana kao broj se prijavljuje kao neispravan tip", () => {
  const report = auditProductIdentity({
    products: [product({ slug: "a", internalCode: 5500 })],
  });

  const invalid = report.conflicts.filter((c) => c.kind === "invalid-internal-code");
  assert.equal(invalid.length, 1);
  assert.equal(invalid[0].detail.valueType, "number");
  assert.match(invalid[0].message, /broj/);
});

test("duplirani slug se otkriva", () => {
  const report = auditProductIdentity({
    products: [
      product({ slug: "baslac-35-m214", sku: "35-M214" }),
      product({ slug: "baslac-35-m214", sku: "BASLAC-35-M214" }),
    ],
  });

  const duplicates = report.conflicts.filter((c) => c.kind === "duplicate-slug");
  assert.equal(duplicates.length, 1);
  assert.deepEqual(duplicates[0].detail.skus, ["35-M214", "BASLAC-35-M214"]);
});

test("sudar selekcionog ključa se meri samo u variant-pdp porodicama", () => {
  const grey = product({ slug: "p-01-grey", sku: "01" });
  const white = product({ slug: "p-01-white", sku: "01" });
  const variantKeyOf = (item) => item.sku;

  const collision = auditProductIdentity({
    products: [grey, white],
    families: [{ slug: "f", presentation: "variant-pdp", variants: [grey, white] }],
    variantKeyOf,
  });
  const found = collision.conflicts.filter((c) => c.kind === "variant-key-collision");
  assert.equal(found.length, 1);
  assert.equal(found[0].detail.key, "01");

  // Ista porodica kao `collection` ne bira varijantu kroz `?varijanta=`.
  const ignored = auditProductIdentity({
    products: [grey, white],
    families: [{ slug: "f", presentation: "collection", variants: [grey, white] }],
    variantKeyOf,
  });
  assert.equal(
    ignored.conflicts.filter((c) => c.kind === "variant-key-collision").length,
    0,
  );
});

test("preopterećena semantika sku se prepoznaje po izvoru zapisa", () => {
  assert.equal(
    classifySkuSemantics({ sku: "A 2210", externalSku: "A 2210" }),
    "manufacturer-code-mirrored",
  );
  assert.equal(classifySkuSemantics({ sku: "35-M214" }), "manufacturer-code");
  assert.equal(
    classifySkuSemantics({ sku: "CL-AUTOMOTIVE-030-400-ML" }),
    "derived-id",
  );
  assert.equal(classifySkuSemantics({ sku: "BEFAR-PAD-OR-25X150" }), "invented");
});

/* -------------------------------------------------------------------------- */
/* Stvarni runtime katalog                                                    */
/* -------------------------------------------------------------------------- */

test("runtime zbir zadovoljava svoje invarijante", () => {
  const summary = summarizeCatalogRuntime();
  const { products, listing, families } = loadCatalogRuntime();

  assert.equal(summary.total, products.length);
  assert.equal(summary.variants + summary.standalone, summary.total);
  assert.equal(summary.families, families.length);
  assert.equal(listing.canonical.length, summary.families + summary.standalone);
  assert.equal(listing.variants.length, summary.variants);

  const brandTotal = Object.values(summary.byBrand).reduce((sum, n) => sum + n, 0);
  assert.equal(brandTotal, summary.total);

  const presentationTotal = Object.values(summary.familiesByPresentation).reduce(
    (sum, n) => sum + n,
    0,
  );
  assert.equal(presentationTotal, summary.families);
});

test("audit režim nad stvarnim katalogom prijavljuje zatečene konflikte", () => {
  const { products, families, productVariantKey } = loadCatalogRuntime();
  const report = auditProductIdentity({
    products,
    families,
    variantKeyOf: productVariantKey,
  });

  // Ovaj test NE tvrdi koliko konflikata ima — taj broj se menja kad se u
  // koraku 2B reše. Tvrdi da ih audit vidi i da ih ne skriva.
  assert.equal(report.hasConflicts, true);
  assert.ok(report.conflicts.length > 0);
  assert.ok(
    report.conflicts.every((conflict) => typeof conflict.message === "string"),
    "Svaki konflikt mora imati čitljivu poruku.",
  );

  // Nijedan zapis još ne nosi INTERNU šifru — korak 2A uvodi model, ne podatke.
  assert.equal(report.totals.withInternalCode, 0);
  // Šifru proizvođača za sada potvrđuju samo sync uvozi — Carsystem i
  // C.A.R.FIT (iz zvaničnih izvora; `null` kada šifre pripadaju varijantama,
  // ne proizvodu). Svi ostali zapisi su i dalje „nije provereno”.
  const checked = products.filter((product) => product.manufacturerCode !== undefined);
  assert.ok(checked.every((product) => product.brandSlug === "carsystem" || product.brandSlug === "carfit"));
  assert.equal(report.totals.manufacturerCodeUnchecked, products.length - checked.length);
});

test("strict režim pada na kontrolisanom fixtureu sa konfliktom", async () => {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const run = promisify(execFile);

  // Fixture konflikt: ista interna šifra na dva sluga. Provera se radi kroz
  // isti kod koji CLI zove, pa dokazuje ugovor o izlaznom kodu.
  const conflicted = auditProductIdentity({
    products: [product({ slug: "a", internalCode: "005500" }), product({ slug: "b", internalCode: "005500" })],
  });
  assert.equal(conflicted.hasConflicts, true);

  // A CLI u strict režimu nad stvarnim katalogom mora izaći različito od nule.
  await assert.rejects(
    () => run(process.execPath, ["scripts/validate-product-identity.mjs", "--strict"]),
    (error) => {
      assert.equal(error.code, 1);
      return true;
    },
  );

  // Isti CLI u audit režimu mora proći.
  const audit = await run(process.execPath, ["scripts/validate-product-identity.mjs"]);
  assert.match(audit.stdout, /"mode": "audit"/);
});
