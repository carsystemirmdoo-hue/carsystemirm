import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { loadCatalogRuntime } from "../scripts/lib/catalog-runtime.mjs";

const families = await readFile(new URL("./product-families.ts", import.meta.url), "utf8");
const route = await readFile(
  new URL("../app/proizvodi/grupa/[slug]/page.tsx", import.meta.url),
  "utf8",
);
const options = await readFile(
  new URL("../components/product/ProductVariantOptions.tsx", import.meta.url),
  "utf8",
);
const provider = await readFile(
  new URL("../components/product/ProductVariantProvider.tsx", import.meta.url),
  "utf8",
);

test("presentation je izveden, ne slug-specific hack", () => {
  assert.match(families, /presentation: "variant-pdp" \| "collection"/);
  assert.match(families, /function resolvePresentation/);
  // Nijedna porodica ne sme biti prepoznata po slugu.
  assert.doesNotMatch(families, /slug === "cosmos-lac-easy-max"/);
  assert.doesNotMatch(route, /slug === "cosmos-lac-easy-max"/);
});

test("variant porodice ne renderuju genericki group UI", () => {
  const variantBranch = route.slice(
    route.indexOf('if (family.presentation === "variant-pdp")'),
    route.indexOf("  return (\n    <div className={styles.catalogShell}>"),
  );
  assert.ok(variantBranch.length > 0, "variant grana postoji");
  // Genericki hero, CTA i mreza kartica su izvan te grane.
  assert.doesNotMatch(variantBranch, /Grupa proizvoda/);
  assert.doesNotMatch(variantBranch, /Otvorite \{brand\.name\} program/);
  assert.doesNotMatch(variantBranch, /CatalogStaticProductGrid/);
  // Grana se vraca pre generickog listinga — nije CSS skrivanje.
  assert.match(variantBranch, /return \(/);
});

test("variant selektor bira u mestu i sinhronizuje URL", () => {
  // Selektor i dalje odlucuje IZMEDU izbora u mestu i odlaska na variant URL.
  assert.match(options, /selectInPlace\?: boolean/);
  assert.match(options, /!selectInPlace && candidate\.slug/);
  // Izbor u mestu je dugme koje menja zajednicki kontekst, ne link.
  assert.match(options, /onClick=\{\(\) => chooseVariant\(candidate\)\}/);
  assert.match(options, /useProductVariant\(\)/);

  /*
   * Sinhronizacija URL-a je preseljena u `ProductVariantProvider`.
   *
   * Dok je zivela ovde, izbor je bio lokalno stanje selektora — kartica se
   * menjala, a naslov, sifra, slika i grafit su ostajali na varijanti koju je
   * izabrao server. Ugovor je isti, vlasnik je drugi.
   */
  assert.match(provider, /url\.searchParams\.set\(VARIANT_QUERY_PARAM/);
  assert.match(provider, /VARIANT_QUERY_PARAM/);
  assert.match(provider, /window\.history\.pushState/);
  assert.match(provider, /addEventListener\("popstate"/);
  // Selektor vise ne sme sam da pise URL — dva pisca bi se razisla.
  assert.doesNotMatch(options, /history\.(push|replace)State/);
});

test("stari variant URL vodi na family rutu sa varijantom", () => {
  assert.match(families, /export function variantRedirectTarget/);
  assert.match(families, /\?varijanta=\$\{encodeURIComponent\(code\)\}/);
  assert.match(families, /family\.presentation !== "variant-pdp"/);
});

test("canonical ostaje family ruta, query nije u sitemapu", () => {
  assert.match(families, /familyPath/);
  assert.doesNotMatch(families, /sitemap[\s\S]{0,200}varijanta=/);
});

/* -------------------------------------------------------------------------- *
 * Kanonski ključ varijante — izvršavanje, ne tekst izvora
 *
 * Raniji test je proveravao redosled regexom koji je prihvatao oba rasporeda
 * `sku` i `variantId`, pa je prolazio dok su preusmerenje i izbor davali
 * različite adrese za istu varijantu. Ovde se obe strane STVARNO pozivaju.
 * -------------------------------------------------------------------------- */

const { products, families: runtimeFamilies, productVariantKey, requireModule } =
  loadCatalogRuntime();
const { canonicalVariantKey } = requireModule("lib/catalog/variant-key.ts");
const { variantRedirectTarget, familyPath } = requireModule("lib/product-families.ts");

/** Zapis u kome su sve četiri oznake različite, pa redosled ima posledicu. */
const fixture = ({ cosmosCode, sku, variantId, slug }) => ({
  slug,
  sku,
  variantId,
  catalogMetadata: cosmosCode === undefined ? {} : { cosmosCode },
  packages: [],
});

test("kanonski ključ ide cosmosCode → sku → variantId → slug", () => {
  const sve = fixture({
    cosmosCode: "CL-810",
    sku: "SKU-RAZLICIT",
    variantId: "VID-RAZLICIT",
    slug: "slug-razlicit",
  });
  assert.equal(canonicalVariantKey(sve), "CL-810");

  // Bez šifre artikla pobeđuje `sku`, NE `variantId` — tačno tačka razilaženja.
  const bezCosmos = fixture({
    cosmosCode: undefined,
    sku: "SKU-RAZLICIT",
    variantId: "VID-RAZLICIT",
    slug: "slug-razlicit",
  });
  assert.equal(canonicalVariantKey(bezCosmos), "SKU-RAZLICIT");

  const samoVariantId = fixture({
    cosmosCode: undefined,
    sku: null,
    variantId: "VID-RAZLICIT",
    slug: "slug-razlicit",
  });
  assert.equal(canonicalVariantKey(samoVariantId), "VID-RAZLICIT");

  const samoSlug = fixture({
    cosmosCode: undefined,
    sku: null,
    variantId: null,
    slug: "slug-razlicit",
  });
  assert.equal(canonicalVariantKey(samoSlug), "slug-razlicit");
});

test("PDP i preusmerenje čitaju istu formulu", () => {
  // `productVariantKey` je javno ime koje PDP koristi; mora biti isti izlaz.
  for (const zapis of [
    fixture({ cosmosCode: "CL-800", sku: "S", variantId: "V", slug: "sl" }),
    fixture({ cosmosCode: undefined, sku: "S", variantId: "V", slug: "sl" }),
    fixture({ cosmosCode: undefined, sku: null, variantId: "V", slug: "sl" }),
    fixture({ cosmosCode: undefined, sku: null, variantId: null, slug: "sl" }),
  ]) {
    assert.equal(productVariantKey(zapis), canonicalVariantKey(zapis));
  }
});

test("nijedna varijanta u katalogu nema dve adrese", () => {
  /*
   * Ovo je tvrdnja nad STVARNIM katalogom, ne nad izmišljenim zapisom.
   *
   * Pre ispravke je padala na 56 varijanti `cosmos-lac-fast-acrylic` porodice:
   * preusmerenje je pisalo `?varijanta=<variantId>`, a izbor na strani
   * `?varijanta=<sku>`. Zahtev nije pucao, jer `findVariantByKey` prihvata obe
   * oznake kao alias — kvar se video tek kao dve adrese za isti sadržaj.
   */
  const varijantne = runtimeFamilies.filter((f) => f.presentation === "variant-pdp");
  assert.ok(varijantne.length > 0, "nema nijedne variant-pdp porodice");

  const razlike = [];
  let provereno = 0;
  for (const family of varijantne) {
    for (const variant of family.variants) {
      provereno += 1;
      const izPreusmerenja = variantRedirectTarget(variant);
      const izIzbora = `${familyPath(family)}?varijanta=${encodeURIComponent(
        productVariantKey(variant),
      )}`;
      if (izPreusmerenja !== izIzbora) {
        razlike.push({ slug: variant.slug, izPreusmerenja, izIzbora });
      }
    }
  }

  assert.ok(provereno > 100, `očekivano preko 100 varijanti, provereno ${provereno}`);
  assert.deepEqual(
    razlike,
    [],
    `${razlike.length} varijanti ima dve adrese, npr. ${JSON.stringify(razlike[0])}`,
  );
});

test("varijanta bez ijedne šifre i dalje dobija adresu", () => {
  // `canonicalVariantKey` uvek vraća vrednost, pa preusmerenje ne sme da vrati
  // `null` samo zato što zapis nema `cosmosCode`, `sku` ni `variantId`.
  const bezSifara = products.filter(
    (p) => !p.catalogMetadata?.cosmosCode && !p.sku && !p.variantId,
  );
  for (const p of bezSifara) {
    const family = runtimeFamilies.find((f) =>
      f.variants.some((v) => v.slug === p.slug),
    );
    if (!family || family.presentation !== "variant-pdp") continue;
    assert.equal(
      variantRedirectTarget(p),
      `${familyPath(family)}?varijanta=${encodeURIComponent(p.slug)}`,
    );
  }
});
