/**
 * Sanacija Baslac duplikata (korak 2B-1).
 *
 * Testovi izvršavaju stvarni runtime katalog i stvarni enrichment sloj — ne
 * proveravaju tekst izvornog koda, osim tamo gde je predmet provere doslovno
 * konfiguracija (`next.config.ts` redirect), koja se ne može izvršiti bez
 * pokretanja Next-a.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { loadCatalogRuntime } from "../../scripts/lib/catalog-runtime.mjs";
import { auditProductIdentity } from "./product-identity.mjs";

const { products, families, productVariantKey, requireModule } = loadCatalogRuntime();

const bySlug = (slug) => products.filter((product) => product.slug === slug);
const one = (slug) => {
  const hits = bySlug(slug);
  assert.equal(hits.length, 1, `Očekivan tačno jedan zapis za "${slug}", pronađeno ${hits.length}.`);
  return hits[0];
};

/* -------------------------------------------------------------------------- */
/* Jedan artikal — jedan zapis                                                */
/* -------------------------------------------------------------------------- */

test("baslac-35-m214 postoji tačno jednom i to je generisani zapis", () => {
  const product = one("baslac-35-m214");
  assert.equal(product.sku, "35-M214");
  assert.equal(product.externalSku, "53224337");
  assert.equal(product.variantId, "35-M214");
});

test("baslac-35-m331 postoji tačno jednom i to je generisani zapis", () => {
  const product = one("baslac-35-m331");
  assert.equal(product.sku, "35-M331");
  assert.equal(product.variantId, "35-M331");
});

test("uklonjeni ručni zapisi više ne postoje", () => {
  assert.equal(bySlug("baslac-35-m331-pasta").length, 0);
  assert.equal(
    products.filter((product) => product.sku === "BASLAC-35-M214").length,
    0,
    "Ručni `BASLAC-35-M214` je i dalje u katalogu.",
  );
  assert.equal(products.filter((product) => product.sku === "BASLAC-35-M331").length, 0);
});

/* -------------------------------------------------------------------------- */
/* Canonical zapis zadržava ono zbog čega je izabran                          */
/* -------------------------------------------------------------------------- */

test("canonical zapisi zadržavaju potvrđeno pakovanje", () => {
  assert.equal(one("baslac-35-m214").catalogMetadata?.volume, "3,5 L");
  assert.deepEqual(one("baslac-35-m214").packages, [{ label: "3,5 L" }]);
  assert.equal(one("baslac-35-m331").catalogMetadata?.volume, "0,5 L");
  assert.deepEqual(one("baslac-35-m331").packages, [{ label: "0,5 L" }]);
});

test("canonical M214 zadržava stvarnu sliku, ne placeholder", () => {
  const image = one("baslac-35-m214").productImage;
  assert.ok(image, "Zapis nema sliku.");
  assert.ok(
    !image.src.includes("placeholder-product"),
    `Slika je degradirana na placeholder: ${image.src}`,
  );
  assert.match(image.src, /baslac--line-35-3\.5l-family-packshot\.webp$/);
});

test("canonical zapisi zadržavaju tehnički sadržaj generatora", () => {
  for (const slug of ["baslac-35-m214", "baslac-35-m331"]) {
    const product = one(slug);
    const labels = product.specifications.map((spec) => spec.label);
    assert.deepEqual(labels, ["Sistem", "Šifra", "Završnica", "Pakovanje", "Primena"]);
    assert.equal(product.catalogMetadata?.line, "Line 35");
    assert.ok(product.seoTitle, `${slug} je izgubio seoTitle.`);
    // Ranija ručna specifikacija je tvrdila fazu „Lak / završni sloj"; oznaka
    // 35-M je basecoat. Generator to nosi ispravno.
    assert.equal(product.phaseSlug, "boja");
  }
});

test("oba canonical zapisa ostaju članovi porodice baslac-line-35", () => {
  const line35 = families.find((family) => family.slug === "baslac-line-35");
  assert.ok(line35, "Porodica baslac-line-35 ne postoji.");
  const variantSlugs = new Set(line35.variants.map((variant) => variant.slug));
  assert.ok(variantSlugs.has("baslac-35-m214"));
  assert.ok(variantSlugs.has("baslac-35-m331"));
});

/* -------------------------------------------------------------------------- */
/* Preneti podaci                                                             */
/* -------------------------------------------------------------------------- */

test("validne preporuke sa uklonjenog zapisa su sačuvane i sve postoje", () => {
  const product = one("baslac-35-m214");
  assert.deepEqual(product.relatedProductSlugs, [
    "baslac-30-s510-s-serija",
    "baslac-60-20-razredjivac",
    "satajet-x-5500",
  ]);
  const known = new Set(products.map((item) => item.slug));
  for (const slug of product.relatedProductSlugs) {
    assert.ok(known.has(slug), `Preporuka "${slug}" ne postoji u katalogu.`);
  }
});

test("izvorni listing proizvođača je prenet na oba canonical zapisa", () => {
  assert.match(
    one("baslac-35-m214").visualIdentity?.imageSourceUrl ?? "",
    /baslac\.de\/basislack\/35-m214-/,
  );
  assert.match(
    one("baslac-35-m331").visualIdentity?.imageSourceUrl ?? "",
    /baslac\.de\/basislack\/35-m331-/,
  );
});

test("preporuke sa M331 nisu prenete jer su izvedene iz pogrešne klasifikacije", () => {
  // Ručni zapis je proizvod vodio kao pastu za poliranje i preporučivao sunđer
  // i paste. Canonical je mixing toner; te preporuke bi bile netačne.
  const related = one("baslac-35-m331").relatedProductSlugs;
  for (const slug of ["befar-sundjer-beli-50x150", "rm-pasta-190-1l", "carsystem-finish-serija"]) {
    assert.ok(!related.includes(slug), `Netačna preporuka "${slug}" je preneta.`);
  }
});

/* -------------------------------------------------------------------------- */
/* Enrichment sloj ne sme da dodirne identitet                                */
/* -------------------------------------------------------------------------- */

test("enrichment odbija nepoznat slug", () => {
  const { assertBaslacEnrichmentKeys } = requireModule("lib/baslac-enrichment.ts");
  assert.doesNotThrow(() =>
    assertBaslacEnrichmentKeys(["baslac-35-m214", "baslac-35-m331", "baslac-45-w00"]),
  );
  assert.throws(
    () => assertBaslacEnrichmentKeys(["baslac-45-w00"]),
    /nepostojeće Baslac zapise/,
  );
});

test("enrichment ne prepisuje identitet, pakovanje ni postojeće preporuke", () => {
  const { applyBaslacEnrichment } = requireModule("lib/baslac-enrichment.ts");
  const base = {
    slug: "baslac-35-m214",
    name: "Original",
    sku: "35-M214",
    externalSku: "53224337",
    variantId: "35-M214",
    packages: [{ label: "3,5 L" }],
    catalogMetadata: { volume: "3,5 L" },
    productImage: { src: "/real.webp", alt: "x" },
    relatedProductSlugs: ["vec-postoji"],
    visualIdentity: { packshotKind: "family", imageSourceUrl: "https://postojeci" },
  };
  const out = applyBaslacEnrichment(base, () => true);

  assert.equal(out.slug, base.slug);
  assert.equal(out.name, base.name);
  assert.equal(out.sku, base.sku);
  assert.equal(out.externalSku, base.externalSku);
  assert.equal(out.variantId, base.variantId);
  assert.deepEqual(out.packages, base.packages);
  assert.deepEqual(out.catalogMetadata, base.catalogMetadata);
  assert.deepEqual(out.productImage, base.productImage);
  // Postojeće vrednosti se ne prepisuju — enrichment samo popunjava prazninu.
  assert.deepEqual(out.relatedProductSlugs, ["vec-postoji"]);
  assert.equal(out.visualIdentity.imageSourceUrl, "https://postojeci");
});

test("enrichment odbacuje preporuku na slug koji ne postoji", () => {
  const { applyBaslacEnrichment } = requireModule("lib/baslac-enrichment.ts");
  const out = applyBaslacEnrichment(
    { slug: "baslac-35-m214", relatedProductSlugs: [], visualIdentity: { packshotKind: "family" } },
    (slug) => slug === "baslac-60-20-razredjivac",
  );
  assert.deepEqual(out.relatedProductSlugs, ["baslac-60-20-razredjivac"]);
});

/* -------------------------------------------------------------------------- */
/* Legacy slug                                                                */
/* -------------------------------------------------------------------------- */

test("legacy mapa se izvodi iz catalogSlug i nosi samo stvarne preimenovane slugove", () => {
  const { BASLAC_LEGACY_SLUGS } = requireModule("lib/baslac-catalog-products.ts");
  assert.deepEqual(BASLAC_LEGACY_SLUGS, { "baslac-35-m331-pasta": "baslac-35-m331" });
  // `35-M214` ima isti `catalogSlug` i generisani slug — nema šta da se preusmeri.
  assert.ok(!("baslac-35-m214" in BASLAC_LEGACY_SLUGS));
  // `30-S510` je UNVERIFIED, ne proizvodi zapis, pa njegov `catalogSlug` ne sme
  // da ugasi živ ručno pisan proizvod.
  assert.ok(!("baslac-30-s510-s-serija" in BASLAC_LEGACY_SLUGS));
});

test("next.config redirect se poklapa sa legacy mapom", () => {
  const { BASLAC_LEGACY_SLUGS } = requireModule("lib/baslac-catalog-products.ts");
  const config = readFileSync(new URL("../../next.config.ts", import.meta.url), "utf8");
  for (const [legacy, canonical] of Object.entries(BASLAC_LEGACY_SLUGS)) {
    assert.ok(
      config.includes(`source: "/proizvodi/${legacy}"`),
      `next.config.ts nema redirect za legacy slug "${legacy}".`,
    );
    assert.ok(
      config.includes(`destination: "/proizvodi/${canonical}"`),
      `next.config.ts ne vodi "${legacy}" na "${canonical}".`,
    );
  }
});

test("canonical cilj legacy sluga zaista postoji i vodi na svoju porodicu", () => {
  const { BASLAC_LEGACY_SLUGS } = requireModule("lib/baslac-catalog-products.ts");
  const { variantRedirectTarget } = requireModule("lib/product-families.ts");
  for (const canonical of Object.values(BASLAC_LEGACY_SLUGS)) {
    const product = one(canonical);
    const target = variantRedirectTarget(product);
    assert.ok(target, `Canonical "${canonical}" ne razrešava family rutu.`);
    assert.match(target, /^\/proizvodi\/grupa\/baslac-line-35\?varijanta=/);
  }
});

/* -------------------------------------------------------------------------- */
/* Determinizam i regresije                                                   */
/* -------------------------------------------------------------------------- */

test("generator dva puta daje identičan skup Baslac zapisa", () => {
  const { baslacCatalogProducts } = requireModule("lib/baslac-catalog-products.ts");
  const first = baslacCatalogProducts.map((product) => `${product.slug}|${product.sku}`);
  const second = requireModule("lib/baslac-catalog-products.ts").baslacCatalogProducts.map(
    (product) => `${product.slug}|${product.sku}`,
  );
  assert.deepEqual(first, second);
  assert.equal(new Set(first).size, first.length, "Generator proizvodi duplirane zapise.");
});

test("identity audit više ne prijavljuje duplicate-slug za Baslac", () => {
  const report = auditProductIdentity({
    products,
    families,
    variantKeyOf: productVariantKey,
  });
  const duplicates = report.conflicts.filter((conflict) => conflict.kind === "duplicate-slug");
  assert.deepEqual(
    duplicates,
    [],
    `I dalje postoji duplirani slug: ${duplicates.map((d) => d.detail.slug).join(", ")}`,
  );
});

test("nijedan drugi Baslac proizvod nije nestao", () => {
  const baslac = products.filter((product) => product.brandSlug === "baslac");
  // 163 pre sanacije, minus dva uklonjena ručna zapisa.
  assert.equal(baslac.length, 161);
  // 989 je ukupan broj u trenutku sanacije. Carsystem sync (`npm run
  // carsystem:sync`) legitimno dodaje proizvode, pa se ovde meri sve OSIM
  // njega — ova provera čuva Baslac sanaciju, ne veličinu Carsystem asortimana.
  const carsystemSync = JSON.parse(
    readFileSync(new URL("../../data/carsystem-catalog-products.generated.json", import.meta.url), "utf8"),
  ).products.length;
  assert.equal(products.length - carsystemSync, 989);
  // Ručno pisani Baslac zapisi koji NISU predmet sanacije moraju ostati.
  for (const slug of ["baslac-30-s510-s-serija", "baslac-60-20-razredjivac"]) {
    one(slug);
  }
  // Poznati konflikti pakovanja se u ovom koraku ne diraju.
  for (const slug of ["baslac-35-m1370", "baslac-35-m1420", "baslac-35-m391"]) {
    one(slug);
  }
});

/* -------------------------------------------------------------------------- */
/* Loader ne sme da izgubi generisane zapise                                  */
/* -------------------------------------------------------------------------- */

test("loader vidi Baslac proizvode iz runtime kataloga", () => {
  const baslac = products.filter((item) => item.brandSlug === "baslac");

  // Baslac zapisi ne postoje kao literali u izvoru — generiše ih
  // `lib/baslac-catalog-products.ts`. Ranija regex rekonstrukcija ih je zato
  // gubila u celini; ovaj test pada ako se to ponovi.
  //
  // Tvrdnja je namerno labava (`> 100`, a ne tačan broj): tačan broj brani test
  // „nijedan drugi Baslac proizvod nije nestao" iznad. Ovde je predmet provere
  // loader, ne katalog, pa prag ne sme da pada pri svakoj izmeni sadržaja.
  assert.ok(
    baslac.length > 100,
    `Očekivano preko 100 Baslac zapisa, pronađeno ${baslac.length}.`,
  );
  assert.ok(baslac.some((item) => item.slug.startsWith("baslac-35-m")));
  assert.ok(baslac.some((item) => item.slug.startsWith("baslac-20-")));
});
