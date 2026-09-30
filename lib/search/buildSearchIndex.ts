/**
 * Generator jedinstvenog search indeksa.
 *
 * Jedan izvor podataka: `getCatalogListingData()` — ista funkcija iz koje
 * katalog gradi svoje entitete. Nema paralelnog, ručno održavanog product
 * modela; proizvod koji ne postoji u katalogu ne može da postoji u pretrazi, i
 * obrnuto (`scripts/validate-catalog-search-index.mjs` obara build ako se ta
 * dva skupa raziđu u bilo kom smeru).
 *
 * Zapis nosi samo ono što treba za PRETRAGU i za PRIKAZ REZULTATA. Sve što je
 * PDP sadržaj — duži opisi, dokumenti, specifikacije, preporuke, galerije, cela
 * `packages` struktura, SEO opisi i metapodaci o izvoru/verifikaciji — ostaje
 * van asseta i čuva ga `FORBIDDEN_SEARCH_FIELDS` guard u validatoru.
 *
 * Indeks obuhvata i podatke koje katalog koristi za crtanje kartice varijante
 * (`card`), pa je ovaj asset u potpunosti zamenio raniji
 * `/katalog/variant-index.json`: jedan lazy asset umesto dva, jedan generator,
 * jedan engine.
 */

import "server-only";

import {
  getAllCarsystemProducts,
  getCarsystemBrandBySlug,
  type CarsystemProduct,
} from "@/lib/carsystem-data";
import {
  expandVariant,
  getCatalogListingData,
  type CatalogListingEntity,
} from "@/lib/catalog-listing";
import { getFamilyForProduct, type ProductFamily } from "@/lib/product-families";
import type { ProductSizeClass, ProductVolumeStatus } from "@/lib/product-scale";
import { isMeasureToken, tokenize } from "@/lib/search/normalize.mjs";

/** Verzija sheme asseta. Menja se kad se promeni oblik zapisa. */
export const SEARCH_INDEX_SCHEMA_VERSION = 1;

export type ProductSearchRecordKind = "family" | "standalone" | "variant";

/**
 * Vizuelni podaci kartice varijante u katalogu.
 *
 * Postoje samo na `variant` zapisima i samo zato što katalog, kada korisnik
 * pretražuje, mora da nacrta karticu konkretne varijante. Sve ostalo o toj
 * kartici (brend, program, faza, bedževi) nasleđuje se od porodice preko
 * `expandVariant()`, pa se ne ponavlja 715 puta.
 */
export type ProductSearchCard = {
  accent: string;
  /** Stvarna nijansa varijante; izostavljena kada je nema (boja brenda na kartici). */
  shade?: string;
  sizeClass: ProductSizeClass;
  volumeStatus: ProductVolumeStatus;
  imageAlt: string;
  finish?: string;
};

export type ProductSearchRecord = {
  id: string;
  kind: ProductSearchRecordKind;
  href: string;
  name: string;
  brandSlug: string;
  brandName: string;
  productCode?: string;
  categorySlugs?: string[];
  technicalLine?: string;
  quantityLabel?: string | null;
  familySlug?: string;
  familyName?: string;
  variantName?: string;
  imageSrc?: string;
  /** Tokeni koji se ne mogu izvesti iz prikazanih polja (šifra boje, RAL, linija). */
  terms?: string[];
  /**
   * CELE šifre artikala varijanti (i prethodne šifre). Token „0450” iz
   * `1-201-0450” nalazi proizvod, ali ga ne rangira: upit po celoj šifri mora
   * da pogodi kao `productCode`, a to se iz razloženih tokena ne može izvesti.
   */
  codes?: string[];
  card?: ProductSearchCard;
};

export type ProductSearchIndexPayload = {
  schemaVersion: number;
  counts: {
    family: number;
    standalone: number;
    variant: number;
    total: number;
  };
  records: ProductSearchRecord[];
};

/**
 * Polja koja asset NE SME da sadrži. Duplirano u validatoru namerno: ovde je
 * dokumentacija namere, tamo je provera koja pada.
 */
export const FORBIDDEN_SEARCH_FIELDS = [
  "longDescription",
  "shortDescription",
  "purpose",
  "detail",
  "documents",
  "specifications",
  "recommendations",
  "relatedProductSlugs",
  "galleryImages",
  "packages",
  "catalogMetadata",
  "sourceReference",
  "verificationStatus",
  "seoDescription",
  "search",
];

function brandNameOf(brandSlug: string) {
  return getCarsystemBrandBySlug(brandSlug)?.name ?? brandSlug;
}

/**
 * Tokeni koji dodaju nešto novo u odnosu na već indeksirana polja.
 *
 * Bez ovog filtera bi `terms` bio uglavnom kopija naziva: „Cosmos Lac Fast
 * Acrylic RAL 3002 Carmine Red" već nosi i boju i RAL broj. Zadržavaju se samo
 * termini koje korisnik može da otkuca a koji nigde drugde ne postoje — npr.
 * interna šifra boje ili naziv linije koji se ne vidi u nazivu proizvoda.
 */
function extraTerms(sources: (string | null | undefined)[], derived: Set<string>) {
  const terms: string[] = [];
  const seen = new Set<string>();

  for (const source of sources) {
    if (!source) continue;
    for (const token of tokenize(source)) {
      // Jedan znak nikada nije koristan termin, a rečnik bi napunio šumom.
      if (token.length < 2 || derived.has(token) || seen.has(token)) continue;
      seen.add(token);
      terms.push(token);
    }
  }

  return terms;
}

/** Šifre varijanti i prethodne šifre proizvoda, bez vodeće (ona je `productCode`). */
function productCodes(product: CarsystemProduct) {
  const codes = [
    ...(product.detail?.variants?.content.rows.map((row) => row.id) ?? []),
    ...(product.legacyManufacturerCodes ?? []),
    ...(product.variantManufacturerCodes ?? []),
    /*
     * Šifra proizvođača kada se razlikuje od `sku`. Zapisi uvezeni pre nego što je
     * zvanična šifra bila poznata nose interni `sku` („RM-DIA-BASE”), a pravu oznaku
     * („DIAMONT”) tek u `manufacturerCode` — bez ovoga upit po zvaničnoj šifri ne bi
     * pogađao tačan zapis nego bilo koji koji je pominje u nazivu.
     */
    product.manufacturerCode,
  ].filter((code): code is string => Boolean(code) && code !== product.sku);
  return [...new Set(codes)];
}

function derivedTokens(parts: (string | null | undefined)[]) {
  const tokens = new Set<string>();
  for (const part of parts) {
    if (!part) continue;
    for (const token of tokenize(part)) tokens.add(token);
  }
  return tokens;
}

function productTerms(product: CarsystemProduct, derived: Set<string>) {
  const metadata = product.catalogMetadata;
  return extraTerms(
    [
      product.sku,
      metadata?.officialName,
      metadata?.displayNameSr,
      metadata?.colorName,
      metadata?.ralCode ? `ral ${metadata.ralCode}` : null,
      metadata?.cosmosCode,
      metadata?.line,
      metadata?.technicalCategory,
      metadata?.finish,
      metadata?.volume,
      product.rmMetadata?.system,
      product.rmMetadata?.series,
      product.rmMetadata?.category,
      /*
       * „Na upit" je status dostupnosti, ne osobina proizvoda: kao termin bi
       * dodao „na" i „upit" na stotine zapisa i zagadio rečnik, a filter za
       * dostupnost već postoji u katalogu.
       */
      product.badges.filter((badge) => badge !== "Na upit").join(" "),
      /*
       * Šifre artikala varijanti (Carsystem: jedna šifra po granulaciji ili
       * pakovanju). Kupac koji ima šifru sa kutije mora da nađe proizvod, a
       * `sku` nosi samo vodeću šifru.
       */
      product.detail?.variants?.content.rows.map((row) => row.id).join(" "),
      product.legacyManufacturerCodes?.join(" "),
      // Oznake varijanti koje je uvoz izdvojio (granulacija, pakovanje, komponenta).
      product.searchTerms?.join(" "),
    ],
    derived,
  );
}

/**
 * Deo naziva varijante koji je razlikuje od porodice („RAL 3002 Carmine Red").
 *
 * Prikazuje se kao druga linija rezultata i nosi sopstvenu težinu u rangiranju,
 * pa upit za konkretnu nijansu ne mora da se takmiči sa 40 varijanti iste
 * porodice po zajedničkom delu naziva.
 */
function variantNameOf(name: string, familyName: string) {
  if (!familyName || !name.startsWith(familyName)) return undefined;
  const remainder = name.slice(familyName.length).trim();
  return remainder || undefined;
}

/**
 * Prag „ovo opisuje porodicu, a ne jednu nijansu".
 *
 * Strogo „u svakoj varijanti" je previše usko i izmereno gubi tačne rezultate:
 * `Cosmos Lac Fast Acrylic` ima 27 od 29 varijanti sa RAL nijansom, a
 * `Cosmos Lac Easy Max` 30 od 52 — obe su stvarno RAL linije, ali nijedna nema
 * `RAL` u baš svakoj varijanti, pa bi upit „ral" prestao da nalazi same
 * porodice. Većina je granica koja te dve vraća, a i dalje odbacuje pojam koji
 * opisuje manjinu asortimana (jedna nijansa, jedno pakovanje).
 */
const FAMILY_TOKEN_SHARE = 0.5;

/**
 * Tokeni koje nosi VEĆINA varijanti porodice.
 *
 * Ovo je osobina grupe, ne jedne nijanse: varijante „Cosmos Lac Fast Acrylic"
 * se zovu „… RAL 1007 Daffodil Yellow", pa je `ral` tačan opis porodice.
 * Nasuprot tome, `white` postoji u jednoj varijanti Antichipa i ovde ispada.
 *
 * Skup se ne širi mnogo: dodaje se svega nekoliko tokena po porodici, i to
 * samo na 41 family zapis — varijante i samostalni proizvodi se ne diraju.
 */
function sharedVariantTokens(family: ProductFamily, derived: Set<string>) {
  const counts = new Map<string, number>();

  for (const variant of family.variants) {
    for (const token of new Set(tokenize(variant.name))) {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }

  const threshold = family.variants.length * FAMILY_TOKEN_SHARE;
  return [...counts]
    .filter(
      ([token, count]) =>
        count > threshold &&
        token.length >= 2 &&
        !derived.has(token) &&
        /*
         * Mera nikada nije osobina porodice: porodica se upravo DELI na
         * varijante po volumenu (`variesBy`), pa bi „600 ml" na family zapisu
         * značilo da grupa ima jedno pakovanje — a ima ih tri. Bez ovog filtera
         * je upit „600 ml" vraćao i Molotow Burner porodicu, kojoj su 4 od 7
         * varijanti 600 ml.
         */
        !isMeasureToken(token),
    )
    .map(([token]) => token);
}

function familyRecord(
  entity: CatalogListingEntity,
  family: ProductFamily,
): ProductSearchRecord {
  const brandName = brandNameOf(entity.brandSlug);
  const derived = derivedTokens([entity.name, brandName]);

  return {
    id: entity.id,
    kind: "family",
    href: entity.href,
    name: entity.name,
    brandSlug: entity.brandSlug,
    brandName,
    categorySlugs: entity.categorySlugs.length ? entity.categorySlugs : undefined,
    // Za porodicu `technicalLine` je „N varijanti" i nema pretraživačku vrednost;
    // linija programa je ono što korisnik zaista kuca.
    technicalLine: entity.line,
    familySlug: entity.familySlug,
    imageSrc: entity.presentation.image?.src,
    terms: nonEmpty([
      ...extraTerms([entity.line, entity.technicalCategory, entity.finish], derived),
      ...sharedVariantTokens(family, derived),
    ]),
  };
}

function standaloneRecord(
  entity: CatalogListingEntity,
  product: CarsystemProduct | undefined,
): ProductSearchRecord {
  const brandName = brandNameOf(entity.brandSlug);
  const derived = derivedTokens([
    entity.name,
    brandName,
    // Interni `sku` ostaje pretraživ i kada se ne prikazuje kao šifra (`publicSkuOf`).
    entity.productCode || product?.sku,
    entity.technicalLine,
  ]);

  return {
    id: entity.id,
    kind: "standalone",
    href: entity.href,
    name: entity.name,
    brandSlug: entity.brandSlug,
    brandName,
    productCode: entity.productCode || undefined,
    categorySlugs: entity.categorySlugs.length ? entity.categorySlugs : undefined,
    technicalLine: entity.technicalLine || undefined,
    quantityLabel: entity.presentation.quantityLabel ?? undefined,
    imageSrc: entity.presentation.image?.src,
    terms: product ? nonEmpty(productTerms(product, derived)) : undefined,
    codes: product ? nonEmpty(productCodes(product)) : undefined,
  };
}

function variantRecord(
  product: CarsystemProduct,
  family: ProductFamily,
  entity: CatalogListingEntity,
): ProductSearchRecord {
  const brandName = brandNameOf(entity.brandSlug);
  const derived = derivedTokens([
    entity.name,
    brandName,
    entity.productCode || product.sku,
    entity.technicalLine,
    family.name,
  ]);
  const style = entity.presentation.style as Record<string, string>;

  return {
    id: entity.id,
    kind: "variant",
    href: entity.href,
    name: entity.name,
    brandSlug: entity.brandSlug,
    brandName,
    productCode: entity.productCode || undefined,
    categorySlugs: entity.categorySlugs.length ? entity.categorySlugs : undefined,
    technicalLine: entity.technicalLine || undefined,
    quantityLabel: entity.presentation.quantityLabel ?? undefined,
    familySlug: family.slug,
    familyName: family.name,
    variantName: variantNameOf(entity.name, family.name),
    imageSrc: entity.presentation.image?.src,
    terms: nonEmpty(productTerms(product, derived)),
    codes: nonEmpty(productCodes(product)),
    card: {
      accent:
        style["--product-visual-background-color"] ??
        style["--product-visual-accent"] ??
        "",
      shade: entity.presentation.shade ?? undefined,
      sizeClass: entity.presentation.sizeClass,
      volumeStatus: entity.presentation.volumeStatus,
      imageAlt: entity.presentation.image?.alt ?? entity.name,
      finish: entity.finish,
    },
  };
}

function nonEmpty<T>(list: T[]): T[] | undefined {
  return list.length > 0 ? list : undefined;
}

let cached: ProductSearchIndexPayload | undefined;

/**
 * Deterministički redosled: porodice i samostalni proizvodi u katalog redosledu
 * (isti niz koji katalog prikazuje), pa varijante u redosledu podataka. Isti
 * ulaz uvek daje bajt-identičan asset, pa validator može da poredi dva
 * uzastopna preuzimanja.
 */
export function getProductSearchIndex(): ProductSearchIndexPayload {
  if (cached) return cached;

  const { canonical } = getCatalogListingData();
  const productBySlug = new Map(
    getAllCarsystemProducts().map((product) => [product.slug, product]),
  );

  const records: ProductSearchRecord[] = [];
  let family = 0;
  let standalone = 0;
  let variant = 0;

  /** `familySlug → ProductFamily`, za tokene zajedničke svim varijantama. */
  const familyBySlug = new Map<string, ProductFamily>();
  for (const product of getAllCarsystemProducts()) {
    const productFamily = getFamilyForProduct(product);
    if (productFamily) familyBySlug.set(productFamily.slug, productFamily);
  }

  for (const entity of canonical) {
    if (entity.kind === "family") {
      const productFamily = entity.familySlug
        ? familyBySlug.get(entity.familySlug)
        : undefined;
      if (!productFamily) {
        throw new Error(
          `Family entitet ${entity.id} nema odgovarajuću ProductFamily — indeks bi ostao bez zajedničkih tokena.`,
        );
      }
      records.push(familyRecord(entity, productFamily));
      family += 1;
      continue;
    }
    records.push(standaloneRecord(entity, productBySlug.get(entity.id)));
    standalone += 1;
  }

  /*
   * Varijanta se vraća u pun listing entitet kroz javni `expandVariant()`
   * ugovor: šifra, tehnička linija i vizuelna prezentacija tako izlaze iz iste
   * formule kao katalog kartica, umesto da se ovde izvode drugi put.
   */
  const familyEntityById = new Map(
    canonical
      .filter((entity) => entity.kind === "family")
      .map((entity) => [entity.id, entity]),
  );

  for (const lean of getCatalogListingData().variants) {
    const familyEntity = familyEntityById.get(`family:${lean.familySlug}`);
    const product = productBySlug.get(lean.id);
    const productFamily = product ? getFamilyForProduct(product) : undefined;
    if (!familyEntity || !product || !productFamily) {
      throw new Error(
        `Varijanta ${lean.id} nema porodicu u catalog listing modelu — search indeks bi bio nepotpun.`,
      );
    }
    records.push(
      variantRecord(product, productFamily, expandVariant(lean, familyEntity)),
    );
    variant += 1;
  }

  cached = {
    schemaVersion: SEARCH_INDEX_SCHEMA_VERSION,
    counts: { family, standalone, variant, total: records.length },
    records,
  };
  return cached;
}

