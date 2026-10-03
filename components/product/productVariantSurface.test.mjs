import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  findVariantByKey,
  resolveActiveVariant,
  toCartPayload,
  variantAliases,
  variantInquiryHref,
  variantQueryValue,
  withVariantQuery,
  VARIANT_QUERY_PARAM,
} from "./productVariantState.mjs";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

/**
 * Izvor bez komentara.
 *
 * Tvrdnje se proveravaju nad KODOM. Komentar sme da pomene `router.push` ili
 * `useState` da bi objasnio zašto ih tu nema — i to objašnjenje ne sme da obori
 * test koji brani baš to odsustvo.
 */
const codeOf = (source) => source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

/**
 * Izmišljene varijante, oblikovane po Cosmos Easy Max porodici.
 *
 * Namerno se ne uvozi stvarni katalog: test dokazuje PRAVILO izbora, a ne
 * sadržaj podataka. Šifre CL-808/CL-810 su ovde ulaz u funkciju, ne uslov u
 * implementaciji — u kodu nema nijedne šifre.
 */
const cl808 = {
  key: "CL-808",
  id: "easy-max-808-cement-grey",
  slug: "cosmos-lac-easy-max-cl-808-cement-grey",
  sku: "CL-808",
  name: "Cosmos Lac Easy Max CL 808 RAL 7033 Cement Grey",
  shadeLabel: "Cement Grey",
  ralLabel: "RAL 7033",
  images: [{ src: "/products/cl-808.webp", alt: "CL 808", contrastMode: "balanced" }],
  volume: "400 ml",
  brandSlug: "cosmos-lac",
  familySlug: "cosmos-lac-easy-max",
};

const cl810 = {
  key: "CL-810",
  id: "easy-max-810-purple-red",
  slug: "cosmos-lac-easy-max-cl-810-purple-red",
  sku: "CL-810",
  name: "Cosmos Lac Easy Max CL 810 RAL 3004 Purple Red",
  shadeLabel: "Purple Red",
  ralLabel: "RAL 3004",
  images: [{ src: "/products/cl-810.webp", alt: "CL 810", contrastMode: "dark-product" }],
  volume: "400 ml",
  brandSlug: "cosmos-lac",
  familySlug: "cosmos-lac-easy-max",
};

/** Varijanta bez slike — pokriva definisani fallback. */
const noImage = {
  key: "CL-999",
  id: "easy-max-999",
  slug: "cosmos-lac-easy-max-cl-999",
  sku: "CL-999",
  name: "Cosmos Lac Easy Max CL 999",
  images: [],
  brandSlug: "cosmos-lac",
  familySlug: "cosmos-lac-easy-max",
};

const variants = [cl808, cl810, noImage];

/* -------------------------------------------------------------------------
 * 1–5: pravila izbora
 * ---------------------------------------------------------------------- */

test("varijanta se prepoznaje po sifri, id-u i slugu, bez obzira na velicinu slova", () => {
  assert.deepEqual(variantAliases(cl810), [
    "cl-810",
    "easy-max-810-purple-red",
    "cl-810",
    "cosmos-lac-easy-max-cl-810-purple-red",
  ]);

  for (const alias of ["CL-810", "cl-810", "  CL-810  ", cl810.id, cl810.slug]) {
    assert.equal(findVariantByKey(variants, alias), cl810, `promasaj za "${alias}"`);
  }
});

test("izbor CL-808 -> CL-810 menja ceo zapis koji potrosaci citaju", () => {
  const before = resolveActiveVariant(variants, "CL-808", "CL-808");
  const after = resolveActiveVariant(variants, "CL-810", "CL-808");

  assert.equal(before, cl808);
  assert.equal(after, cl810);

  // Naziv, sifra, oznaka nijanse, slika i njen `alt` — sve prati izbor.
  assert.notEqual(after.name, before.name);
  assert.notEqual(after.sku, before.sku);
  assert.notEqual(after.shadeLabel, before.shadeLabel);
  assert.notEqual(after.ralLabel, before.ralLabel);
  assert.notEqual(after.images[0].src, before.images[0].src);
  assert.notEqual(after.images[0].alt, before.images[0].alt);
  // Stage/grafit stanje: izmereni kontrast je deo istog zapisa.
  assert.notEqual(after.images[0].contrastMode, before.images[0].contrastMode);

  // Query parametar i CTA prate isti izbor.
  assert.equal(variantQueryValue(after), "CL-810");
  assert.match(
    variantInquiryHref(`/kontakt?tema=proizvod&proizvod=${after.slug}`, after),
    /proizvod=cosmos-lac-easy-max-cl-810-purple-red&varijanta=CL-810/,
  );

  // Portal payload nosi stabilan identitet aktivne varijante — i nijednu cenu.
  const payload = toCartPayload({ ...after, image: after.images[0].src });
  assert.equal(payload.sku, "CL-810");
  assert.equal(payload.productSlug, cl810.slug);
  assert.equal(payload.variantId, cl810.id);
  assert.equal(payload.image, "/products/cl-810.webp");
  assert.equal("price" in payload, false);
  assert.equal("cena" in payload, false);
});

test("direktan query bira trazenu varijantu, ne reprezentativnu", () => {
  assert.equal(resolveActiveVariant(variants, "CL-810", "CL-808"), cl810);
  assert.equal(resolveActiveVariant(variants, cl810.slug, "CL-808"), cl810);
});

test("nevazeci query pada na reprezentativnu varijantu, bez izuzetka", () => {
  for (const bad of ["CL-000", "", "   ", null, undefined, "<script>", 42]) {
    const resolved = resolveActiveVariant(variants, bad, "CL-808");
    assert.equal(resolved, cl808, `nije palo na reprezentativnu za ${String(bad)}`);
  }

  // Bez ijedne varijante nema ni izuzetka ni praznog stage-a — samo `null`,
  // koji PDP-u znaci „proizvod bez selektora".
  assert.equal(resolveActiveVariant([], "CL-810", "CL-808"), null);

  // Nepoznat i pocetni kljuc zajedno: i dalje postoji definisan izbor.
  assert.equal(resolveActiveVariant(variants, "CL-000", "CL-111"), cl808);
});

test("varijanta bez slike ne zadrzava sliku prethodne varijante", () => {
  const resolved = resolveActiveVariant(variants, "CL-999", "CL-808");
  assert.equal(resolved, noImage);
  // Prazan niz je definisan fallback: stage crta `heroProductFallback`.
  assert.deepEqual(resolved.images, []);
  assert.equal(toCartPayload({ ...resolved, image: resolved.images[0]?.src ?? null }).image, null);
});

test("upis varijante cuva ostale parametre i sidro", () => {
  assert.equal(
    withVariantQuery("/proizvodi/grupa/cosmos-lac-easy-max?utm_source=mail#opis", cl810),
    "/proizvodi/grupa/cosmos-lac-easy-max?utm_source=mail&varijanta=CL-810#opis",
  );
  // Ponovni upis ne gomila parametre.
  assert.equal(
    withVariantQuery("/proizvodi/grupa/x?varijanta=CL-808", cl810),
    "/proizvodi/grupa/x?varijanta=CL-810",
  );
  assert.equal(VARIANT_QUERY_PARAM, "varijanta");
});

/* -------------------------------------------------------------------------
 * 6–7: nacin promene — bez navigacije, bez DOM manipulacije
 * ---------------------------------------------------------------------- */

test("promena varijante koristi History API, nikad navigaciju", async () => {
  const provider = codeOf(await read("./ProductVariantProvider.tsx"));

  assert.match(provider, /window\.history\.pushState/);
  assert.match(provider, /window\.history\.replaceState/);
  assert.match(provider, /window\.addEventListener\("popstate", applyFromUrl\)/);
  assert.match(provider, /window\.removeEventListener\("popstate", applyFromUrl\)/);

  // Nijedan oblik RSC ili document navigacije. Skrol se cuva upravo zato sto
  // se ruta ne menja.
  assert.doesNotMatch(provider, /useRouter|router\.(push|replace|refresh)|next\/link/);
  assert.doesNotMatch(provider, /location\.(assign|replace|href\s*=)/);
  assert.doesNotMatch(provider, /window\.scrollTo|scrollIntoView/);
});

test("nijedan potrosac ne dira DOM niti drzi svoj izbor varijante", async () => {
  const sources = Object.fromEntries(
    await Promise.all(
      [
        "./ProductVariantProvider.tsx",
        "./ProductVariantOptions.tsx",
        "./ProductIdentity.tsx",
        "./ProductInquiryLink.tsx",
        "./ProductStickyStage.tsx",
        "./ProductMobileCta.tsx",
      ].map(async (path) => [path, codeOf(await read(path))]),
    ),
  );

  for (const [path, source] of Object.entries(sources)) {
    assert.doesNotMatch(
      source,
      /document\.querySelector|getElementById|innerHTML|innerText|\.textContent\s*=/,
      `${path} dira DOM`,
    );
  }

  // Selektor vise ne drzi aktivnu varijantu — to je bio uzrok razilazenja.
  const options = sources["./ProductVariantOptions.tsx"];
  assert.doesNotMatch(options, /useState/);
  assert.match(options, /const \{ activeKey, findVariant, inquiryHref: activeInquiryHref, selectVariant \}/);

  // Klik na varijantu je dugme, ne link — link bi bio navigacija.
  assert.match(options, /onClick=\{\(\) => chooseVariant\(candidate\)\}/);
  assert.match(options, /aria-pressed=\{isSelected\}/);
  assert.match(options, /type="button"/);
});

/* -------------------------------------------------------------------------
 * 8: zajednicki sistem, bez brendova u mehanizmu
 * ---------------------------------------------------------------------- */

test("mehanizam izbora ne poznaje nijedan brend ni sifru", async () => {
  const shared = await Promise.all(
    [
      "./productVariantState.mjs",
      "./ProductVariantProvider.tsx",
      "./productVariantView.ts",
      "./ProductIdentity.tsx",
      "./ProductInquiryLink.tsx",
      "./ProductVariantOptions.tsx",
      "./ProductStickyStage.tsx",
    ].map(async (path) => [path, codeOf(await read(path))]),
  );

  for (const [path, code] of shared) {
    // Nijedno grananje po brendu i nijedna sifra u kodu.
    assert.doesNotMatch(code, /brandSlug\s*===|brand\s*===\s*["']/, `${path}: grananje po brendu`);
    assert.doesNotMatch(code, /\bCL-\d{3}\b/, `${path}: hardkodovana sifra`);
    assert.doesNotMatch(
      code,
      /(cosmos|baslac|befar)[A-Za-z]*\s*(===|!==|\?\.includes|\.startsWith)/i,
      `${path}: uslov po brendu`,
    );
    // Cosmos-only kontekst ne sme da postoji naporedo sa zajednickim.
    assert.doesNotMatch(code, /CosmosVariant(Provider|Context)/, `${path}: brendirani kontekst`);
  }

  /*
   * Formula kljuca varijante sme da postoji na TACNO jednom mestu.
   *
   * Raniji test je proveravao redosled regexom koji je prihvatao i
   * `cosmosCode -> sku -> variantId` i `cosmosCode -> variantId -> sku`, pa je
   * prolazio dok su dve kopije davale razlicit rezultat. Umesto redosleda u
   * tekstu, ovde se proverava da kopije nema: oba pozivaoca uvoze
   * `canonicalVariantKey`, a nijedan ne gradi lanac sam.
   *
   * Sam redosled i saglasnost preusmerenja sa izborom dokazuju se izvrsavanjem,
   * u `lib/productFamilyPresentation.test.mjs`.
   */
  const view = codeOf(await read("./productVariantView.ts"));
  const families = codeOf(await read("../../lib/product-families.ts"));
  for (const [ime, izvor] of [["productVariantView.ts", view], ["product-families.ts", families]]) {
    assert.match(
      izvor,
      /import \{ canonicalVariantKey \} from "@\/lib\/catalog\/variant-key"/,
      `${ime} ne uvozi kanonski kljuc`,
    );
    assert.doesNotMatch(
      izvor,
      /cosmosCode \?\?[\s\S]{0,80}\?\?[\s\S]{0,80}\?\?/,
      `${ime} ponovo gradi lanac kljuca umesto da ga uveze`,
    );
  }
});

test("selektor porodice je brand-agnostican", async () => {
  const data = await read("../../lib/carsystem-data.ts");

  // Funkcija se vise ne zove po brendu i ne filtrira po Cosmos statusu.
  assert.match(data, /function getFamilyVariantSelector\(/);
  assert.doesNotMatch(data, /function getCosmosVariantSelector\(/);
  assert.match(data, /const SELECTABLE_VARIANT_STATUSES = new Set\(\[/);
  assert.match(data, /"verified-official-source",\s*\n\s*"ACTIVE_CONFIRMED",/);

  // Porodica se izvodi iz kataloga i kada proizvod nema pravi `family` blok, pa
  // Baslac pripremne porodice (isti artikal u 1 L i 4 L) dobijaju isti birac.
  assert.match(data, /const family: ProductFamilyIdentity = declaredFamily \?\? \{/);

  /*
   * Sintetizovani identitet iz `withCatalogArchitecture` (`id: slug`,
   * `label: name`) opisuje JEDAN proizvod, ne porodicu. Ako bi prosao kao
   * oznaka porodice, zaglavlje bi zauvek nosilo pakovanje reprezentativne
   * varijante — „… Grey 1 L" i kada je izabrano 4 L.
   */
  assert.match(
    data,
    /product\.family && product\.family\.id !== product\.slug \? product\.family : null/,
  );
  assert.match(data, /label: metadata\?\.officialName \?\? metadata\?\.line \?\? product\.name/);
});

/* -------------------------------------------------------------------------
 * 9: javne rute ostaju bez korpe
 * ---------------------------------------------------------------------- */

test("javni PDP nema nijednu cart kontrolu", async () => {
  const sources = await Promise.all([
    read("./ProductDetailPage.tsx"),
    read("./ProductVariantOptions.tsx"),
    read("./ProductIdentity.tsx"),
    read("./ProductInquiryLink.tsx"),
    read("./ProductStickyStage.tsx"),
    read("./ProductMobileCta.tsx"),
    read("../../app/proizvodi/[slug]/page.tsx"),
    read("../../app/proizvodi/grupa/[slug]/page.tsx"),
    read("../../app/layout.tsx"),
    read("../layout/Header.tsx"),
  ]);

  for (const source of sources) {
    assert.doesNotMatch(
      source,
      /CartProvider|CartDrawer|CartButton|useCart|Dodaj(?:te)? u korpu|Quick ?Add|quickAdd|cartBadge/,
    );
  }

  // Payload za portal korpu postoji kao ugovor, ali ga javna strana ne montira:
  // gradi ga kontekst, a trosi ga tek ovlascena portal povrsina.
  const provider = await read("./ProductVariantProvider.tsx");
  assert.match(provider, /cartPayload: toCartPayload\(/);
  assert.doesNotMatch(provider, /useCart|CartProvider/);
});

test("prelaz slike se pali samo na izbor na strani, ne pri ucitavanju", async () => {
  const provider = codeOf(await read("./ProductVariantProvider.tsx"));
  const stage = codeOf(await read("./ProductStickyStage.tsx"));
  const styles = await read("./ProductDetailExperience.module.css");

  // `interactive` je tacno „korisnik je izabrao na ovoj strani".
  assert.match(provider, /setInteractive\(true\)/);
  assert.match(provider, /setInteractive\(false\)/);
  assert.match(stage, /const crossfade = interactive;/);

  // Prva slika nosi LCP; prelaz na njoj bi odlozio najvece iscrtavanje.
  assert.match(stage, /data-variant-crossfade=\{crossfade \? "true" : undefined\}/);
  assert.match(styles, /\.heroProductImage\[data-variant-crossfade="true"\][\s\S]{0,120}animation: productVariantCrossfade/);
  assert.match(
    styles,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]{0,200}data-variant-crossfade="true"\][\s\S]{0,80}animation: none/,
  );
  // Prelaz menja iskljucivo neprozirnost — nista sto bi pomerilo raspored.
  assert.match(styles, /@keyframes productVariantCrossfade \{[\s\S]{0,120}opacity: 0;[\s\S]{0,120}opacity: 1;/);

  /*
   * Druga i svaka sledeca promena moraju ponovo pokrenuti prelaz.
   *
   * `interactive` posle prvog izbora ostaje `true`, pa atribut stoji trajno i
   * CSS animacija se ponovo pokrece iskljucivo pri remountu cvora. Kljuc zato
   * mora nositi identitet VARIJANTE — dok je bio samo `activeImage.src`,
   * remount je zavisio od toga da li dve varijante slucajno dele packshot.
   */
  assert.match(
    stage,
    /key=\{`\$\{activeVariant\.key\}:\$\{activeImage\.src\}`\}/,
    "kljuc <Image> ne nosi identitet varijante",
  );
  assert.doesNotMatch(
    stage,
    /key=\{activeImage\.src\}/,
    "kljuc zavisi samo od adrese slike",
  );
});

test("PDP montira jedan provider, bez promenljivog key-a i bez remounta", async () => {
  const page = await read("./ProductDetailPage.tsx");

  assert.match(page, /<ProductVariantProvider/);
  assert.doesNotMatch(page, /<ProductVariantProvider[^>]*\skey=/);
  // Skup varijanti se izvodi iz selektora, pa se kartica i kontekst ne mogu
  // razici ni za jednu varijantu.
  assert.match(page, /variantSelector\?\.variants \?\? \[\]/);
  assert.match(page, /const initialVariantKey = productVariantKey\(product\)/);
  // Format panela ostaje na nivou porodice — inace bi se okvir menjao pri
  // izboru boje i pomerio stranu.
  assert.match(page, /const stageFormat = getProductStageFormat\(/);
});
