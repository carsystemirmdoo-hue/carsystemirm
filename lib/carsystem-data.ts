import { withSerbianMeasureDisplay } from "@/lib/serbian-measure-display";
import { RM_CRYSTAL_BASE_SLUG, RM_PASTE_SLUG, withRmMixingBases } from "@/lib/rm-mixing-bases";
import { abrasiveBackingTerms } from "@/lib/search/abrasive-backing.mjs";
import { publicSkuOf } from "@/lib/catalog/public-code";
import removedFromCustomerCatalog from "@/data/catalog/removed-from-customer-catalog.json";
import categoryOverrides from "@/data/catalog/category-overrides.json";
import suppliedImages from "@/data/catalog/image-supply/supplied-images.json";
import { suppliedImageAllowed } from "@/lib/supplied-image-rights.mjs";
import { cosmosLacProducts } from "@/lib/cosmos-lac-data";
import { rmImportedProducts } from "@/lib/rm-imported-products";
import {
  applyBaslacSyncEnrichment,
  baslacCatalogProducts,
} from "@/lib/baslac-catalog-products";
import {
  applyNorbinSyncEnrichment,
  getNorbinCatalogProducts,
} from "@/lib/norbin-catalog-products";
import {
  applySataSyncEnrichment,
  getSataCatalogProducts,
} from "@/lib/sata-catalog-products";
import { getBefarCatalogProducts } from "@/lib/befar-catalog-products";
import {
  applyRmCatalogEnrichment,
  getRmCatalogProducts,
} from "@/lib/rm-catalog-products";
import {
  applyCarfitCatalogEnrichment,
  getCarfitCatalogProducts,
} from "@/lib/carfit-catalog-products";
import {
  applyCarsystemCatalogEnrichment,
  getCarsystemCatalogProducts,
} from "@/lib/carsystem-catalog-products";
import {
  applyBaslacEnrichment,
  assertBaslacEnrichmentKeys,
} from "@/lib/baslac-enrichment";
import type { ProductSize } from "@/lib/product-scale";
import type {
  ProductCatalogStrategy,
  ProductDetailContent,
  ProductFamilyIdentity,
  ProductRecommendation,
  ProductVariantColumn,
  ProductVariantSelectorSection,
} from "@/types/product-detail";

export type CarsystemBrand = {
  slug: string;
  name: string;
  /**
   * Odobren logo fajl u `public/brands/`. Izostavlja se kada takvog fajla nema: brend se tada
   * prikazuje tekstualno (`BrandLogoMark`). Logo se ne preuzima sa interneta bez provere prava.
   */
  logo?: string;
  description: string;
  overview?: string;
  programSlugs?: string[];
  /**
   * Zvanični brand lockup, kada se razlikuje od kanonskog naziva u katalogu.
   * Koristi se samo za tipografski prikaz na brend stranici; katalog, navigacija
   * i nazivi proizvoda i dalje koriste `name`.
   */
  wordmark?: string;
  /**
   * Program drugog proizvođača koji se nudi u okviru drugog brenda (RUPES u Carsystem
   * programu). Takav brend ostaje proizvođač na proizvodima, ali nema svoju brend stranicu
   * niti mesto u listama brendova; prikazuje se u okviru brenda `offeredWithin`.
   */
  offeredWithin?: string;
  catalogOrder: number;
  presentation: {
    accentColor: string;
    accentContrastColor: string;
    accentOnDarkColor: string;
    accentOnDarkContrastColor: string;
    heroKicker: string;
    productsCtaLabel: string;
    contactCtaLabel: string;
  };
  routes: {
    landing: string;
    catalog: string;
    contact: string;
  };
};

export type ProgramGroup = {
  slug: string;
  name: string;
  shortName: string;
  description: string;
};

export type FutureBrand = {
  slug: string;
  name: string;
  description: string;
  status: "placeholder";
};

export type BrandReference =
  | (CarsystemBrand & {
      status: "active";
    })
  | FutureBrand;

export type RefinishPhaseSlug =
  | "priprema"
  | "podloga"
  | "boja"
  | "lak"
  | "poliranje";

export type RefinishPhase = {
  slug: RefinishPhaseSlug;
  name: string;
  description: string;
  step: number;
};

export type PublicProgramGroup = {
  slug: string;
  name: string;
  shortName: string;
  description: string;
  badges: string[];
  internalProgramSlugs: string[];
  phaseSlugs: RefinishPhaseSlug[];
  brandSlugs: string[];
  guidanceTitle: string;
  guidanceText: string;
};

export type ProductImageAsset = {
  src: string;
  alt: string;
};

export type ProductPackage = {
  label: string;
  detail?: string;
};

export type ProductSpecification = {
  label: string;
  value: string;
  detail?: string;
};

export type ProductDocument = {
  title: string;
  kind: string;
  href?: string;
  status: "available" | "placeholder" | "disabled";
  note?: string;
};

export type ProductPublicStatus =
  | "Na upit"
  | "Na stanju"
  | "Proveriti telefonom"
  | "Po porudžbini"
  | "Trenutno nije dostupno";

export type ProductStockStatus =
  | "unknown"
  | "in_stock"
  | "check_by_phone"
  | "backorder"
  | "unavailable";

export type ProductCatalogMetadata = {
  id: string;
  baseProductSlug: string;
  variantId: string;
  line: string;
  officialName: string;
  displayNameSr: string;
  cosmosCode: string | null;
  /** Cosmos šifru deli više varijanti iste kartice — nije jedinstven `?varijanta=` ključ. */
  cosmosCodeShared?: boolean;
  ralCode: string | null;
  colorName: string | null;
  finish: string | null;
  volume: string | null;
  technicalCategory: string;
  verificationStatus: string;
  sourceReference: string | null;
  colorSource: ProductColorSource;
  colorConfidence: ProductColorConfidence;
  /**
   * Zapis koji nosi JAVNI identitet svoje porodice.
   *
   * Ime porodice se inače izvodi iz zajedničkog prefiksa naziva varijanti. To radi dok su
   * varijante isti proizvod u više nijansi ili pakovanja, ali ne radi za sistem za
   * nijansiranje: tamo su varijante mixing baze, pa porodica ostaje bez zvaničnog imena.
   * Kada jedan zapis nosi identitet sistema, on ga ovde i navodi — a `slug` zaključava
   * postojeću adresu porodice, da preimenovanje ne pomeri URL.
   */
  familyIdentity?: { name: string; slug: string };
  /**
   * Pakovanje za PRIKAZ KUPCU, kada se razlikuje od `volume`.
   *
   * `volume` je podatak kakav je ušao u katalog i na njega se oslanjaju razmera ambalaže, ose
   * varijanti i pretraga, pa se ne prepisuje. Kada sync potvrdi aktuelno pakovanje proizvođača, ono
   * ide ovde i samo ono se prikazuje kao „Pakovanje". `undefined` = prikaz ostaje `volume`, kao do sada.
   */
  customerPackage?: string | null;
};

/* R-M oznake žive u `lib/catalog-constants.ts`: klijentske komponente ih uvoze odatle,
   jer bi uvoz iz ovog modula u JavaScript pregledača uvukao ceo katalog (~6,7 MB JSON-a). */
export {
  rmCategorySlugs,
  rmSeriesSlugs,
  rmSystemSlugs,
  type RmCategorySlug,
  type RmSeriesSlug,
  type RmSystemSlug,
} from "@/lib/catalog-constants";
import type { RmCategorySlug, RmSeriesSlug, RmSystemSlug } from "@/lib/catalog-constants";

export type RmTechnologySlug =
  | "waterborne"
  | "solvent"
  | "2k"
  | "uv"
  | "air-drying"
  | "wet-on-wet"
  | "dtm";

export type RmFinishSlug =
  | "gloss"
  | "matte"
  | "satin"
  | "solid"
  | "metallic"
  | "pearl";

export type RmProductMetadata = {
  system: RmSystemSlug | null;
  series: RmSeriesSlug | null;
  category: RmCategorySlug;
  technology: RmTechnologySlug | null;
  finish: RmFinishSlug | null;
};

export type ProductVisualMode = "neutral" | "color-on-hover" | "always-color";

export type ProductVisualType =
  | "spray"
  | "color"
  | "abrasive"
  | "foam"
  | "filler"
  | "primer"
  | "clearcoat"
  | "neutral";

export type ProductColorSource =
  | "official-chart"
  | "ral"
  | "cap-sample"
  | "name-derived"
  | "manual-estimate";

export type ProductColorConfidence = "verified" | "derived" | "provisional";

export type ProductVisualTokens = {
  treatment: "paint" | "clearcoat" | "fabric" | "foam" | "matte" | "abrasive" | "polish";
  productType: ProductVisualType;
  visualMode: ProductVisualMode;
  backgroundColor: string;
  foregroundTone: "light" | "dark";
  colorSource: ProductColorSource;
};

export type CarsystemProduct = {
  slug: string;
  name: string;
  brandSlug: string;
  programSlug: string;
  phaseSlug: RefinishPhaseSlug;
  /** Dodatne faze u kojima se proizvod zvanično koristi (R-M komponente) — samo za filtere. */
  secondaryPhaseSlugs?: RefinishPhaseSlug[];
  shortDescription: string;
  longDescription: string;
  sku: string;
  /**
   * `true` = izvor izričito potvrđuje da zapis nema zvaničnu šifru proizvođača (R-M sistem objavljen
   * samo na sajtu, Baslac sistemska baza bez oznake), pa je `sku` samo interni ključ. Nijedan javni
   * prikaz ga ne predstavlja kao šifru (kartica, pretraga, PDP, SEO opis, JSON-LD) — pravilo je
   * `publicSkuOf` u `lib/catalog/public-code.ts`. Rute, `?varijanta=`, korpa i veze ga i dalje koriste.
   * Postavlja ga adapter izvora; izostavljeno = `sku` je javna šifra, kao do sada.
   */
  skuIsInternalOnly?: boolean;
  packages: ProductPackage[];
  purpose: string;
  badges: string[];
  publicStatus?: ProductPublicStatus;
  stockStatus?: ProductStockStatus;
  erpSku?: string;
  externalSku?: string;
  biznisSoftSku?: string;
  /**
   * Naša interna poslovna šifra artikla — glavni poslovni identifikator.
   *
   * UVEK string. Vodeća nula je deo šifre, ne formatiranje: `"005500"` i `5500`
   * nisu ista vrednost, a `Number("005500")` trajno gubi razliku. Nikad ne
   * pisati `Number(...)`, `parseInt(...)`, `+code` ni `JSON` numerički parser
   * nad ovom vrednošću, i nikad je ne koristiti kao ključ sortiranja po broju.
   *
   * U finalnom katalogu se očekuje tačno šest cifara (`/^\d{6}$/`). Polje je
   * opciono jer se popunjava postepeno — odsustvo znači „još nije povezano“,
   * ne grešku.
   *
   * Ne zamenjuje `sku`: `sku` je danas semantički preopterećen (šifra
   * proizvođača kod R-M i Baslac-a, izvedeni ID kod Cosmos Lac-a), pa se ovo
   * vodi kao zasebno polje.
   */
  internalCode?: string;
  /**
   * Potvrđena šifra proizvođača.
   *
   * `null` = provereno, proizvođač je ne daje ili nije potvrđena.
   * `undefined` = još nije provereno.
   * Nikada se ne izvodi iz naziva, sluga ni iz `internalCode`.
   */
  manufacturerCode?: string | null;
  /**
   * Šifra za JAVNI prikaz (kartica, meta opis) kada se razlikuje od `sku`.
   *
   * `sku` je interni ključ — `canonicalVariantKey` iz njega pravi `?varijanta=` adrese — pa se ne
   * menja kada zapis naknadno dobije zvanični identitet proizvođača. Tada `sku` ostaje interna,
   * pretraživa oznaka, a kupac vidi zvanični identifikator. Bez ovog polja prikaz je `sku`, kao i do sada.
   */
  publicCode?: string;
  /**
   * Ranije šifre proizvođača istog artikla (proizvođač ga je prenumerisao).
   * Nisu aktuelne šifre za poručivanje; služe da proizvod nađe i kupac koji
   * šifru čita iz starijeg štampanog kataloga.
   */
  legacyManufacturerCodes?: string[];
  /**
   * Šifre proizvođača pojedinih VARIJANTI, kada ih nosi red tabele a ne kartica (RUPES: kartica
   * „Skorpio E RX” ima redove RX253A i RX256A). Ne prikazuju se zasebno — stoje u nazivu reda;
   * pretraga ih tretira kao šifre, pa upit „RX253A” ili „9.DA40H” pogađa tačno tu karticu.
   */
  variantManufacturerCodes?: string[];
  /**
   * Dodatni pojmovi za pretragu koje uvoz izvodi iz zvaničnih podataka, a koji
   * nisu u nazivu ni u znački: oznake varijanti („P80”, „2,5 l”, „Učvršćivač
   * brzi”). Ne prikazuju se; čita ih samo `lib/search/buildSearchIndex.ts`.
   */
  searchTerms?: string[];
  stockManaged?: boolean;
  productImage: ProductImageAsset | null;
  /**
   * Kanonska adresa kartice, izračunata na serveru pre slanja liste klijentskoj komponenti
   * (vidi `withListingHref`). Klijent je ne izvodi sam, jer bi za to morao da učita katalog.
   */
  listingHref?: string;
  visualIdentity?: ProductVisualIdentity;
  galleryImages: ProductImageAsset[];
  specifications: ProductSpecification[];
  documents: ProductDocument[];
  relatedProductSlugs: string[];
  seoTitle?: string;
  seoDescription?: string;
  catalogMetadata?: ProductCatalogMetadata;
  /** Optional R-M-only taxonomy used by the brand landing and catalog deep links. */
  rmMetadata?: RmProductMetadata;
  /**
   * Platformska kategorija određena pri uvozu iz zvanične taksonomije
   * proizvođača (Carsystem sync, `data/carsystem-sync/taxonomy-map.json`).
   * Vrednost van 12 kategorija iz `lib/productTaxonomy.mjs` se ignoriše.
   */
  taxonomyCategory?: string;
  /**
   * Boja serije koju je sync potvrdio iz zvaničnog izvora (navedena boja ili
   * uzorak sa zvaničnog packshot-a), uvek sa `source`. Isti oblik kao unos u
   * `lib/productNamedColors.mjs`; ručna tabela ima prednost.
   */
  manufacturerColor?: { color: string; token?: string; series?: string; source: string };
  visual?: ProductVisualTokens;
  /** Commercial family shared by one or more selectable variants. */
  family?: ProductFamilyIdentity;
  /** Controls whether the public catalog lists a family, its variants, or both. */
  catalogStrategy?: ProductCatalogStrategy;
  /** Stable identity and option values for a concrete commercial variant. */
  variantId?: string;
  variantOptions?: Record<string, string>;
  /** Reviewed recommendation records; internal reasons are never rendered publicly. */
  recommendations?: ProductRecommendation[];
  /**
   * Fizička veličina pakovanja (foundation, Phase 1). Opciono — odsustvo znači
   * "unknown", ne grešku. Vidi lib/product-scale.ts za resolver koji ovo polje
   * kombinuje sa `catalogMetadata.volume` i `packages[]` bez izmišljanja podataka.
   */
  size?: ProductSize;
  /** Optional, reviewed content used by the canonical product-detail template. */
  detail?: ProductDetailContent;
  /**
   * Faza (`phaseSlug`) potiče samo iz kategorije izvora, a dokumentacija ne potvrđuje upotrebu u
   * toj fazi. Faza se tada ne prikazuje i filter `?faza=` ne prikazuje proizvod; `phaseSlug` ostaje
   * samo kao tehnički ključ (tipovi, rasporedi).
   */
  phaseUnconfirmed?: true;
};

import { getProductPublicStatus } from "@/lib/catalog-constants";
export { getProductPublicStatus };

type CarsystemBrandSeed = Omit<CarsystemBrand, "routes">;

function defineCarsystemBrand(brand: CarsystemBrandSeed): CarsystemBrand {
  return {
    ...brand,
    routes: {
      landing: `/brendovi/${brand.slug}`,
      catalog: `/katalog?brend=${brand.slug}`,
      contact: `/kontakt?tema=proizvod&brend=${brand.slug}`,
    },
  };
}

export const brands: CarsystemBrand[] = [
  defineCarsystemBrand({
    slug: "rm",
    name: "R-M",
    logo: "/brands/rm.svg",
    description:
      "Profesionalni refinish program za precizno usklađivanje nijanse, lakiranje i radioničku efikasnost.",
    overview:
      "R-M u Carsystem i R-M programu pokriva sisteme bojenja, bazne boje, završne lakove i tehničku podršku za izbor formule i refinish procesa.",
    programSlugs: ["boje-i-lakovi", "priprema-povrsine", "poliranje"],
    catalogOrder: 1,
    presentation: {
      // R-M crvena po zvaničnom sajtu: rmpaint.com CSS `rgba(227,0,15)` /
      // `#e3000f` (2026-09-10). Logotip (rm.svg) je srebrni gradijent bez
      // crvene; ranija vrednost #E31822 nije imala izvor.
      accentColor: "#E3000F",
      accentContrastColor: "#FAFAFA",
      accentOnDarkColor: "#E3000F",
      accentOnDarkContrastColor: "#FAFAFA",
      heroKicker: "R-M refinish program",
      productsCtaLabel: "Pogledajte R-M proizvode",
      contactCtaLabel: "Kontaktirajte nas",
    },
  }),
  defineCarsystemBrand({
    slug: "carsystem",
    name: "Carsystem",
    logo: "/brands/carsystem.svg",
    description:
      "Širok program pripreme, obrade i pratećeg materijala za karoserijske i lakirerske radionice.",
    overview:
      "Carsystem povezuje pripremu površine, abrazive, poliranje i potrošni materijal za svakodnevni rad u lakirnici.",
    programSlugs: ["priprema-povrsine", "abrazivi", "poliranje", "potrosni-materijal"],
    catalogOrder: 2,
    presentation: {
      accentColor: "#E30613",
      accentContrastColor: "#FFFFFF",
      accentOnDarkColor: "#E30613",
      accentOnDarkContrastColor: "#FFFFFF",
      heroKicker: "Carsystem radionički program",
      productsCtaLabel: "Pogledajte Carsystem proizvode",
      contactCtaLabel: "Kontaktirajte nas",
    },
  }),
  defineCarsystemBrand({
    slug: "sata",
    name: "SATA",
    logo: "/brands/sata.svg",
    description:
      "Pištolji, cup sistemi, priprema komprimovanog vazduha i merenje pritiska — oprema kojom se materijal nanosi.",
    overview:
      "SATA (Kornwestheim, Nemačka) proizvodi opremu za mokro nanošenje premaza, ne premaze. Program pokriva pištolje za završni sloj, prajmere i punila, male površine i rad pod pritiskom, cup sisteme, filtraciju vazduha, respiratornu zaštitu i digitalno merenje pritiska.",
    programSlugs: ["oprema"],
    catalogOrder: 8,
    presentation: {
      /*
       * `#E2001A` je boja SATA logotipa, potvrđena iz `public/brands/sata.svg`.
       * Namenska stranica koristi plavu kao ownership signal — to je naša UI
       * odluka i živi u `components/brand/sata/SataBrandPage.module.css`, ne
       * ovde, jer zvanični SATA HEX za plavu nije verifikovan.
       */
      accentColor: "#E2001A",
      accentContrastColor: "#FFFFFF",
      accentOnDarkColor: "#E2001A",
      accentOnDarkContrastColor: "#FFFFFF",
      heroKicker: "SATA oprema za nanošenje",
      productsCtaLabel: "Pogledajte SATA proizvode",
      contactCtaLabel: "Kontaktirajte nas",
    },
  }),
  defineCarsystemBrand({
    slug: "carfit",
    name: "Car Fit",
    wordmark: "C.A.R.FIT",
    logo: "/brands/carfit.svg",
    description:
      "Materijali za pripremu i podlogu, namenjeni svakodnevnom radu u profesionalnoj radionici.",
    overview:
      "Car Fit pokriva praktične materijale za pripremu, podlogu i stabilan radni tok pre nanošenja boje.",
    programSlugs: ["priprema-povrsine", "potrosni-materijal"],
    catalogOrder: 7,
    presentation: {
      accentColor: "#E20613",
      accentContrastColor: "#FFFFFF",
      accentOnDarkColor: "#E20613",
      accentOnDarkContrastColor: "#FFFFFF",
      heroKicker: "Car Fit program pripreme",
      productsCtaLabel: "Pogledajte Car Fit proizvode",
      contactCtaLabel: "Kontaktirajte nas",
    },
  }),
  defineCarsystemBrand({
    slug: "cosmos-lac",
    name: "Cosmos Lac",
    logo: "/brands/cosmos-spray.svg",
    description:
      "Aerosolne boje, tehnički sprejevi i specijalizovane linije za automobilsku, industrijsku i dekorativnu primenu.",
    overview:
      "Cosmos Lac program povezuje RAL i akrilne nijanse, prajmere, lakove, proizvode za automobile i specijalizovane linije kroz proverene šifre i varijante.",
    programSlugs: ["aerosoli", "boje-i-lakovi", "priprema-povrsine", "potrosni-materijal"],
    catalogOrder: 5,
    presentation: {
      accentColor: "#20242C",
      accentContrastColor: "#F7F8FA",
      accentOnDarkColor: "#F7F8FA",
      accentOnDarkContrastColor: "#20242C",
      heroKicker: "Cosmos Lac aerosolni program",
      productsCtaLabel: "Pogledajte Cosmos Lac proizvode",
      contactCtaLabel: "Kontaktirajte nas",
    },
  }),
  defineCarsystemBrand({
    slug: "baslac",
    name: "Baslac",
    logo: "/brands/baslac.svg",
    description:
      "Profesionalni refinish sistem za automobile koji povezuje pripremu podloge, vodene i solventne boje, bezbojne lakove i digitalnu koloristiku.",
    overview:
      "Baslac povezuje pripremu, boju, završni lak i pomoćne proizvode u pregledan sistem za radionice kojima su važni jednostavniji izbor i kontrolisan proces.",
    programSlugs: ["boje-i-lakovi", "poliranje"],
    catalogOrder: 3,
    presentation: {
      accentColor: "#21A0D2",
      accentContrastColor: "#14171C",
      accentOnDarkColor: "#21A0D2",
      accentOnDarkContrastColor: "#14171C",
      heroKicker: "Baslac refinish program",
      productsCtaLabel: "Pogledajte Baslac proizvode",
      contactCtaLabel: "Kontaktirajte nas",
    },
  }),
  defineCarsystemBrand({
    slug: "norbin",
    name: "Norbin",
    logo: "/brands/norbin.svg",
    description:
      "Kratak, zatvoren program bezbojnih lakova, punilaca i učvršćivača koji rade u tačno propisanim odnosima mešanja — bez sopstvenog sistema boje.",
    overview:
      "Norbin je deo Surventis refinish porodice (ranije BASF Coatings), pozicioniran uz Glasurit, R-M i Baslac kao vrednosno pristupačan pomoćni program za lakirnicu.",
    programSlugs: ["boje-i-lakovi"],
    catalogOrder: 4,
    presentation: {
      accentColor: "#0082BB",
      accentContrastColor: "#05080B",
      accentOnDarkColor: "#21A0D2",
      accentOnDarkContrastColor: "#14171C",
      heroKicker: "Pomoćni program za lakirnicu",
      productsCtaLabel: "Pogledajte Norbin proizvode",
      contactCtaLabel: "Kontaktirajte nas",
    },
  }),
  defineCarsystemBrand({
    slug: "befar",
    name: "Befar",
    logo: "/brands/befar.svg",
    description:
      "Pene i sunđeri za poliranje, podloške, paste i brusni blokovi za završnu obradu u lakirnici.",
    overview:
      "Befar u našem katalogu: pene i sunđeri za poliranje po tvrdoći, dimenziji i nameni, uz podloške i prateći materijal; dostupnost potvrđujemo kroz upit.",
    programSlugs: ["poliranje"],
    catalogOrder: 6,
    presentation: {
      accentColor: "#20242C",
      accentContrastColor: "#F7F8FA",
      accentOnDarkColor: "#F7F8FA",
      accentOnDarkContrastColor: "#20242C",
      heroKicker: "Befar program poliranja",
      productsCtaLabel: "Pogledajte Befar proizvode",
      contactCtaLabel: "Kontaktirajte nas",
    },
  }),
  defineCarsystemBrand({
    slug: "rupes",
    name: "RUPES",
    /*
     * Bez `logo`: odobren RUPES logo fajl ne postoji (RUPES_IMAGE_RIGHTS_REVIEW), pa se brend
     * prikazuje tekstualno. Opseg nije RUPES katalog nego RUPES_PRODUCTS_FROM_CARSYSTEM_PROGRAM —
     * proizvodi koje Carsystem vodi u svom katalogu (`data/carsystem-sync/third-party-manufacturers.json`).
     * Bez tvrdnji o statusu distribucije.
     */
    description:
      "RUPES proizvodi iz Carsystem programa — polirke, brusilice, usisivač i pribor za pripremu i završnu obradu.",
    overview:
      "RUPES proizvodi iz naše ponude: BigFoot polirke, iBrid Nano, Skorpio i orbitalne brusilice, usisivač S145 i prateći pribor.",
    programSlugs: ["oprema", "poliranje"],
    // Odluka vlasnika 2026-10-14: RUPES je deo Carsystem ponude (sekcija na /brendovi/carsystem#rupes).
    offeredWithin: "carsystem",
    catalogOrder: 9,
    presentation: {
      // Neutralna paleta sajta: zvanična RUPES boja nije verifikovana, pa se ne pretpostavlja.
      accentColor: "#20242C",
      accentContrastColor: "#F7F8FA",
      accentOnDarkColor: "#F7F8FA",
      accentOnDarkContrastColor: "#20242C",
      heroKicker: "RUPES proizvodi iz Carsystem programa",
      productsCtaLabel: "Pogledajte RUPES proizvode",
      contactCtaLabel: "Kontaktirajte nas",
    },
  }),  defineCarsystemBrand({
    slug: "yachtcare",
    name: "Yachtcare",
    /*
     * Bez `logo`: odobren Yachtcare logo fajl ne postoji, pa se brend prikazuje tekstualno.
     * Odluka vlasnika 2026-10-13: brend i kartica Epoxy Steelbond 125 g (identitet potvrđen u magacinu).
     * Bez tvrdnji o statusu distribucije.
     */
    description: "Yachtcare proizvodi iz naše ponude — dvokomponentna epoksi masa za popravke.",
    overview: "Yachtcare je brend proizvođača Vosschemie. U našoj ponudi je Epoxy Steelbond 125 g.",
    programSlugs: ["priprema-povrsine"],
    catalogOrder: 10,
    presentation: {
      // Neutralna paleta sajta: zvanična boja brenda nije verifikovana, pa se ne pretpostavlja.
      accentColor: "#20242C",
      accentContrastColor: "#F7F8FA",
      accentOnDarkColor: "#F7F8FA",
      accentOnDarkContrastColor: "#20242C",
      heroKicker: "Yachtcare iz naše ponude",
      productsCtaLabel: "Pogledajte Yachtcare proizvode",
      contactCtaLabel: "Kontaktirajte nas",
    },
  }),
];

/*
 * Trenutno nema nijednog najavljenog brenda. Brend ulazi ovde tek kada je proizvođač utvrđen iz
 * zvaničnog izvora — placeholder bez identiteta se ne drži.
 *
 * „A.U.T.O. Fit” je uklonjen 2026-09-21: audit nije našao ni proizvođača, ni zvanični izvor, ni
 * proizvod, a brend se ne pojavljuje ni na prethodnom sajtu klijenta. „Rupes” je istog dana postao
 * aktivan brend (`brands`).
 */
export const futureBrands: FutureBrand[] = [];

export const programGroups: ProgramGroup[] = [
  {
    slug: "boje-i-lakovi",
    name: "Boje i lakovi",
    shortName: "Boje i lakovi",
    description:
      "Bazne boje, bezbojni lakovi i sistemi za završni sloj u profesionalnom refinish procesu.",
  },
  {
    slug: "priprema-povrsine",
    name: "Priprema površine",
    shortName: "Priprema",
    description:
      "Kitovi, prajmeri, punila i pomoćni materijali za stabilnu osnovu pre bojenja.",
  },
  {
    slug: "abrazivi",
    name: "Abrazivi",
    shortName: "Abrazivi",
    description:
      "Brusni materijali za kontrolisanu obradu površine od grube pripreme do finalnog matiranja.",
  },
  {
    slug: "oprema",
    name: "Oprema za lakirnice",
    shortName: "Oprema",
    description:
      "Pištolji, dodaci i radionička oprema za precizno nanošenje materijala.",
  },
  {
    slug: "aerosoli",
    name: "Aerosol program",
    shortName: "Aerosoli",
    description:
      "Sprejevi i pomoćni aerosol proizvodi za manje popravke, probe i servisne intervencije.",
  },
  {
    slug: "poliranje",
    name: "Poliranje",
    shortName: "Poliranje",
    description:
      "Paste, podloške i prateći materijali za korekciju površine i završni sjaj.",
  },
  {
    slug: "potrosni-materijal",
    name: "Potrošni materijal",
    shortName: "Potrošni",
    description:
      "Maskiranje, pomoćni materijali i radionička potrošnja za stabilan refinish proces.",
  },
];

export const refinishPhases: RefinishPhase[] = [
  {
    slug: "priprema",
    name: "Priprema",
    description: "Čišćenje, brušenje, gitovanje i priprema površine.",
    step: 1,
  },
  {
    slug: "podloga",
    name: "Podloga",
    description: "Prajmeri, punila i izolacija podloge pre bojenja.",
    step: 2,
  },
  {
    slug: "boja",
    name: "Boja",
    description: "Bazni sloj i usklađivanje nijanse vozila.",
    step: 3,
  },
  {
    slug: "lak",
    name: "Lak",
    description: "Bezbojni lak, sjaj i završna zaštita.",
    step: 4,
  },
  {
    slug: "poliranje",
    name: "Poliranje",
    description: "Finalna dorada, korekcija i dubina sjaja.",
    step: 5,
  },
];

export const publicProgramGroups: PublicProgramGroup[] = [
  {
    slug: "boje-i-lakovi",
    name: "Boje i lakovi",
    shortName: "Boje i lakovi",
    description:
      "Sistemi bojenja, bazne boje i završni lakovi za profesionalni refinish rezultat.",
    badges: ["Bazni sloj", "Lak", "Nijansiranje"],
    internalProgramSlugs: ["boje-i-lakovi"],
    phaseSlugs: ["boja", "lak"],
    brandSlugs: ["rm", "baslac", "norbin", "cosmos-lac"],
    guidanceTitle: "Sistemi, finiš i podrška za nijansu",
    guidanceText:
      "Program boja i lakova povezuje bazni sloj, završni lak, izbor nijanse i tehničku podršku za stabilan rezultat u lakirnici.",
  },
  {
    slug: "priprema-i-abrazivi",
    name: "Priprema i abrazivi",
    shortName: "Priprema",
    description:
      "Gitovi, prajmeri, punila i abrazivi za stabilnu površinu pre bojenja.",
    badges: ["Git", "Prajmer", "Brušenje"],
    internalProgramSlugs: ["priprema-povrsine", "abrazivi"],
    phaseSlugs: ["priprema", "podloga"],
    brandSlugs: ["carsystem", "carfit", "rm", "cosmos-lac"],
    guidanceTitle: "Priprema površine bez preskakanja faza",
    guidanceText:
      "Ovaj program pokriva ravnanje, izolaciju, brušenje i završnu pripremu površine pre nanošenja baznog sloja.",
  },
  {
    slug: "pistolji-i-oprema",
    name: "Pištolji i oprema",
    shortName: "Oprema",
    description:
      "Profesionalna oprema za precizno nanošenje materijala i kontrolu rada u lakirnici.",
    badges: ["Pištolji", "Dizne", "Kontrola nanosa"],
    internalProgramSlugs: ["oprema"],
    phaseSlugs: ["boja", "lak"],
    brandSlugs: ["sata", "carsystem", "rupes"],
    guidanceTitle: "Precizna oprema i kontrola aplikacije",
    guidanceText:
      "Pištolji, dizne i prateća oprema pomažu radionici da kontroliše nanos, potrošnju materijala i ponovljivost završnog sloja.",
  },
  {
    slug: "poliranje",
    name: "Poliranje",
    shortName: "Poliranje",
    description:
      "Paste, podloške i rešenja za korekciju površine, dubinu sjaja i finalnu obradu.",
    badges: ["Korekcija", "Sjaj", "Finalna obrada"],
    internalProgramSlugs: ["poliranje"],
    phaseSlugs: ["poliranje"],
    brandSlugs: ["carsystem", "rm", "baslac", "befar", "rupes"],
    guidanceTitle: "Završna obrada, korekcija i sjaj",
    guidanceText:
      "Program poliranja je poslednji korak za uklanjanje tragova obrade, podizanje sjaja i usklađen finalni izgled površine.",
  },
  {
    slug: "potrosni-materijal",
    name: "Potrošni materijal",
    shortName: "Potrošni",
    description:
      "Maskiranje, sprejevi i radionički materijali za svakodnevni refinish proces.",
    badges: ["Maskiranje", "Sprejevi", "Radionica"],
    internalProgramSlugs: ["potrosni-materijal", "aerosoli"],
    phaseSlugs: ["priprema", "podloga", "poliranje"],
    brandSlugs: ["carsystem", "carfit", "cosmos-lac"],
    guidanceTitle: "Materijali za dnevni ritam radionice",
    guidanceText:
      "Potrošni program pokriva maskiranje, zaštitu, pomoćne sprejeve i artikle koji održavaju stabilan radni tok u radionici.",
  },
];

/**
 * Opisuje da li je slika proizvoda njegov sopstveni packshot ili generička
 * porodična ambalaža. Polje je opciono: postojeći zapisi ga ne moraju imati.
 *
 * Bez ovoga desetine Line 35/45 tonera izgledaju kao da svaki ima jedinstvenu
 * fotografiju, iako svi dele istu limenku.
 */
export type ProductVisualIdentity = {
  /** `specific` — tačna ambalaža ovog SKU-a. `family` — generička limenka linije. */
  packshotKind: "specific" | "family";
  /** Vizuelna porodica, npr. `baslac-line-35`. */
  visualFamily?: string;
  /** Nijansa za swatch prikaz varijante. */
  swatch?: string;
  finishType?: "solid" | "transparent" | "metallic" | "pearl" | "xirallic" | "mat";
  imageConfidence: "confirmed" | "family-only" | "unverified" | "conflicting";
  imageSource?: string;
  imageSourceUrl?: string;
  /** Npr. `basf-era` za staru „A brand of BASF" ambalažu. */
  packagingEra?: string;
};

const placeholderProductImage = "/images/products/placeholder-product.svg";

const legacyProducts: CarsystemProduct[] = [
  {
    slug: "rm-diamont-bazna-boja",
    name: "R-M DIAMONT bazna boja",
    brandSlug: "rm",
    programSlug: "boje-i-lakovi",
    phaseSlug: "boja",
    shortDescription:
      "Bazna boja za profesionalno usklađivanje nijanse u refinish procesu.",
    longDescription:
      "DIAMONT je pozicioniran kao bazni sistem za radionice koje traže pregledan radni tok, stabilnu reprodukciju nijanse i tehničku podršku pri izboru formule. Stranica prikazuje ključne informacije za upit i povezivanje sa zvaničnim tehničkim listovima.",
    sku: "rm-diamont-bazna-boja",
    // Oznaka zapisa, ne R-M šifra: kupcu se ne prikazuje (šifre su u redovima baza).
    skuIsInternalOnly: true,
    // Zapremine iz potvrđenih redova baza (`data/rm-sync/mixing-bases.json`), ne stari „3.5 L“.
    packages: [{ label: "4 L" }, { label: "1 L" }, { label: "0,5 L" }],
    purpose: "Usklađivanje nijanse i bazni sloj pre bezbojnog laka",
    badges: ["Bazna boja", "R-M sistem", "Na upit"],
    rmMetadata: {
      system: "diamont",
      series: null,
      category: "basecoat",
      technology: "solvent",
      finish: null,
    },
    productImage: {
      src: placeholderProductImage,
      alt: "R-M DIAMONT bazna boja, ilustrativni prikaz ambalaže",
    },
    galleryImages: [
      {
        src: placeholderProductImage,
        alt: "R-M DIAMONT bazna boja, detalj ambalaže",
      },
      {
        src: placeholderProductImage,
        alt: "R-M DIAMONT bazna boja, tehnički prikaz",
      },
    ],
    specifications: [
      { label: "Mešanje", value: "Prema formuli i tehničkom listu" },
      { label: "Viskozitet", value: "Podešava se po sistemu i uslovima rada" },
      { label: "Nanošenje", value: "Profesionalni pištolj za bazni sloj" },
      { label: "Sušenje", value: "Zavisno od sloja, temperature i protoka vazduha" },
      { label: "Pokrivnost", value: "Zavisno od nijanse i podloge" },
      { label: "Površina", value: "Pripremljena i odmašćena podloga" },
    ],
    documents: [
      {
        title: "Tehnički list",
        kind: "PDF",
        status: "placeholder",
        note: "Dokument se potvrđuje kroz upit",
      },
      {
        title: "Bezbednosni list",
        kind: "PDF",
        status: "placeholder",
        note: "Dokument se potvrđuje kroz upit",
      },
      {
        title: "Mešanje i nijanse",
        kind: "Baza formula",
        status: "disabled",
        note: "Dostupno kroz tehničku podršku",
      },
    ],
    relatedProductSlugs: [
      "rm-body-filler-white-b-2e11",
      "baslac-60-20-razredjivac",
      "satajet-x-5500",
    ],
    seoTitle: "R-M DIAMONT bazna boja",
    seoDescription:
      "R-M DIAMONT bazna boja u katalogu Carsystem i R-M, sa upitom, dokumentacijom i refinish fazom.",
  },
  {
    slug: "rm-diamont-bezbojni-lak",
    name: "R-M DIAMONT bezbojni lak",
    brandSlug: "rm",
    programSlug: "boje-i-lakovi",
    phaseSlug: "lak",
    shortDescription:
      "Bezbojni lak za završni sloj, sjaj i zaštitu farbane površine.",
    longDescription:
      "Bezbojni lak u DIAMONT programu je prikazan kao završni materijal za profesionalnu obradu nakon bazne boje. Stranica povezuje tehničke vrednosti po proizvodu, dokumentaciju i upit bez javnog naručivanja.",
    sku: "RM-DIA-CLEAR",
    packages: [
      { label: "1 L" },
      { label: "5 L" },
      { label: "Set", detail: "Lak i prateći učvršćivači po ponudi" },
    ],
    purpose: "Završni sloj, sjaj i zaštita nakon bazne boje",
    badges: ["Bezbojni lak", "Završni sloj", "Na upit"],
    rmMetadata: {
      system: "diamont",
      series: null,
      category: "clearcoat",
      technology: "2k",
      finish: "gloss",
    },
    productImage: {
      src: placeholderProductImage,
      alt: "R-M DIAMONT bezbojni lak, ilustrativni prikaz ambalaže",
    },
    galleryImages: [
      {
        src: placeholderProductImage,
        alt: "R-M DIAMONT bezbojni lak, detalj ambalaže",
      },
    ],
    specifications: [
      { label: "Mešanje", value: "Prema tehničkom listu" },
      { label: "Nanošenje", value: "2 sloja prema radioničkim uslovima" },
      { label: "Sušenje", value: "Zavisno od sistema, temperature i učvršćivača" },
      { label: "Pokrivnost", value: "Zavisno od debljine sloja" },
      { label: "Rok trajanja", value: "Prema deklaraciji na ambalaži" },
    ],
    documents: [
      {
        title: "Tehnički list",
        kind: "PDF",
        status: "placeholder",
        note: "Dokument se potvrđuje kroz upit",
      },
      {
        title: "Bezbednosni list",
        kind: "PDF",
        status: "placeholder",
        note: "Dokument se potvrđuje kroz upit",
      },
    ],
    relatedProductSlugs: [
      "rm-diamont-bazna-boja",
    ],
  },
  {
    slug: "carsystem-soft-plus-git",
    name: "Carsystem Soft Plus git",
    brandSlug: "carsystem",
    programSlug: "priprema-povrsine",
    phaseSlug: "priprema",
    shortDescription:
      "Poliesterski git za ravnanje površine u pripremi pre podloge.",
    longDescription:
      "Soft Plus git predstavlja proizvod iz pripremne faze. Stranica prikazuje namenu, pakovanja, tehničke parametre i povezane proizvode bez javnog prikaza privatnih komercijalnih uslova.",
    sku: "CS-SOFT-PLUS",
    packages: [
      { label: "1.8 kg" },
      { label: "3 kg" },
      { label: "Set", detail: "Pakovanje sa učvršćivačem" },
    ],
    purpose: "Ravnanje i popunjavanje pre nanošenja prajmera ili punila",
    badges: ["Priprema", "Git", "Na upit"],
    productImage: {
      src: placeholderProductImage,
      alt: "Carsystem Soft Plus git, ilustrativni prikaz ambalaže",
    },
    galleryImages: [
      {
        src: placeholderProductImage,
        alt: "Carsystem Soft Plus git, detalj ambalaže",
      },
      {
        src: placeholderProductImage,
        alt: "Carsystem Soft Plus git, radionički prikaz",
      },
    ],
    specifications: [
      { label: "Mešanje", value: "Sa učvršćivačem prema tehničkom listu" },
      { label: "Nanošenje", value: "Špahtlom na pripremljenu površinu" },
      { label: "Sušenje", value: "Zavisno od debljine sloja i temperature" },
      { label: "Površina", value: "Metal, stari premazi i pripremljene podloge" },
      { label: "Potrošnja", value: "Zavisno od neravnine i obima popravke" },
      { label: "Rok trajanja", value: "Prema deklaraciji na ambalaži" },
    ],
    documents: [
      {
        title: "Tehnički list",
        kind: "PDF",
        href: "/documents/placeholder-tds.pdf",
        status: "placeholder",
        note: "Dokument se potvrđuje kroz upit",
      },
      {
        title: "Bezbednosni list",
        kind: "PDF",
        href: "/documents/placeholder-msds.pdf",
        status: "placeholder",
        note: "Dokument se potvrđuje kroz upit",
      },
    ],
    relatedProductSlugs: [
      "carsystem-git-multi-green",
      "rm-diamont-bazna-boja",
      "carsystem-finish-serija",
    ],
    seoTitle: "Carsystem Soft Plus git",
    seoDescription:
      "Carsystem Soft Plus git u katalogu Carsystem i R-M, sa tehničkim specifikacijama i upitom.",
  },
  {
    slug: "carsystem-abraziv-p80-p2000",
    name: "Carsystem abraziv P80-P2000",
    brandSlug: "carsystem",
    programSlug: "abrazivi",
    phaseSlug: "priprema",
    shortDescription:
      "Abrazivni raspon za pripremu, oblikovanje i finalno matiranje površine.",
    longDescription:
      "Abrazivni program je prikazan kao modularan proizvod sa varijantama po granulaciji. Stranica podržava više pakovanja, jasnu namenu i veze ka proizvodima iz sledećih faza refinish procesa.",
    sku: "CS-ABR-P80-P2000",
    packages: [
      { label: "P80-P180", detail: "Gruba obrada" },
      { label: "P240-P600", detail: "Međufaze" },
      { label: "P800-P2000", detail: "Fina priprema" },
    ],
    purpose: "Brušenje, nivelisanje i priprema površine pre podloge i boje",
    badges: ["Abrazivi", "Više granulacija", "Na upit"],
    productImage: {
      src: placeholderProductImage,
      alt: "Carsystem abraziv P80-P2000, ilustrativni prikaz ambalaže",
    },
    galleryImages: [
      {
        src: placeholderProductImage,
        alt: "Carsystem abraziv P80-P2000, detalj pakovanja",
      },
    ],
    specifications: [
      { label: "Površina", value: "Kit, prajmer, lak i pripremljene podloge" },
      { label: "Granulacija", value: "P80-P2000 prema fazi obrade" },
      { label: "Nanošenje", value: "Ručno ili mašinski, prema tipu nosača" },
      { label: "Potrošnja", value: "Zavisno od površine i načina rada" },
    ],
    documents: [
      {
        title: "Uputstvo za upotrebu",
        kind: "PDF",
        status: "placeholder",
        note: "Dokument se potvrđuje kroz upit",
      },
    ],
    relatedProductSlugs: [
      "car-fit-prajmer",
      "rm-diamont-bazna-boja",
    ],
  },
  {
    /*
     * SATAjet X 5500 — jedini SATA artikal evidentiran u našem online katalogu.
     * Evidencija NIJE potvrda prodaje, zaliha ni komercijalnog statusa;
     * komercijalni status za SATA nije potvrđen (docs/SATA_RESEARCH.md §5).
     *
     * Očišćeno 2026-08-20. Uklonjeni su: placeholder slika i galerija (proizvod
     * sada koristi sistemski „nema slike" prikaz, isto kao Norbin 5 L), lažni
     * link na `placeholder-tds.pdf` i specifikacije koje nisu bile podatak nego
     * popuna. Ostale su samo tvrdnje potvrđene na zvaničnoj SATA stranici
     * porodice — vidi `docs/SATA_RESEARCH.md` §3, art. 1061564.
     *
     * `sku` ostaje interna kataloška referenca, ista konvencija kao kod svih
     * ostalih proizvoda. To NIJE SATA artikl-broj — SATA broji artikle po
     * konfiguraciji (tehnologija × mlaz × veličina mlaznice × čaša) i njeni
     * brojevi se ne mogu izvesti iz naziva porodice.
     */
    slug: "satajet-x-5500",
    name: "SATAjet X 5500",
    brandSlug: "sata",
    programSlug: "oprema",
    phaseSlug: "boja",
    shortDescription:
      "Premium pištolj sa X-nozzle sistemom, za bazne boje i lakove.",
    longDescription:
      "SATAjet X 5500 je premium gravitacioni pištolj sa X-nozzle sistemom, koji nudi izbor između I i O mlaznice u RP i u HVLP tehnologiji. Whisper mlaznice imaju optimizovanu geometriju toka koja, prema proizvođaču, smanjuje nivo buke. Konkretna konfiguracija — tehnologija, oznaka mlaza i veličina mlaznice — bira se prema materijalu i vazduhu u radionici i potvrđuje se kroz upit.",
    sku: "SATA-X5500",
    /*
     * Nemamo nijednu SATA fotografiju sa potvrđenim pravom korišćenja.
     * Ovo NIJE lažni packshot: `ProductVisualSurface` prepoznaje
     * `placeholder-product` i renderuje svoje „Vizuel u pripremi" stanje.
     * Ista konvencija koju koristi svaki proizvod bez slike (npr. Norbin 5 L);
     * `productImage: null` bi promašio metrics lookup i pomerio prikaz.
     */
    productImage: {
      src: placeholderProductImage,
      alt: "SATAjet X 5500 — vizuel u pripremi",
    },
    galleryImages: [],
    packages: [
      { label: "Konfiguracija po upitu", detail: "RP ili HVLP, mlaz I ili O" },
    ],
    purpose: "Nanošenje baznih boja i lakova u profesionalnoj lakirnici",
    badges: ["Oprema", "X-nozzle", "Na upit"],
    specifications: [
      { label: "Tip", value: "Gravitacioni pištolj za završni sloj" },
      { label: "Tehnologija", value: "RP ili HVLP" },
      { label: "Mlaz", value: "I za kontrolu, O za brzinu nanošenja" },
      { label: "Ulazni pritisak", value: "0,5 – 2,4 bar" },
      { label: "Preporučeno rastojanje", value: "17 – 21 cm" },
      { label: "Čaša", value: "RPS, QCC priključak bez adaptera" },
      { label: "Dostupnost", value: "Konfiguracija i dostupnost se potvrđuju kroz upit" },
    ],
    documents: [
      {
        title: "Tehnička dokumentacija",
        kind: "PDF",
        status: "disabled",
        note: "Uputstvo i deklaracija se vode po tačnom artiklu na sata.com",
      },
    ],
    relatedProductSlugs: [
      "rm-diamont-bazna-boja",
      "baslac-30-s510-s-serija",
      "cosmos-lac-ral-cl-304-ral-9005-sjaj-400-ml-500-ml-ral-9005-gloss-black",
    ],
    seoTitle: "SATAjet X 5500",
    seoDescription:
      "SATAjet X 5500 — premium pištolj sa X-nozzle sistemom, RP ili HVLP, mlaz I ili O. Konfiguracija i dostupnost na upit kod Carsystem i R-M.",
  },
  {
    slug: "car-fit-prajmer",
    name: "Car Fit prajmer",
    brandSlug: "carfit",
    programSlug: "priprema-povrsine",
    phaseSlug: "podloga",
    shortDescription:
      "Prajmer za stabilnu podlogu između pripreme površine i nanošenja boje.",
    longDescription:
      "Car Fit prajmer je proizvod iz faze podloge. Stranica prikazuje tehničke informacije za korisnike koji traže proizvod, podršku ili najbližu prodavnicu.",
    sku: "CF-PRIMER",
    packages: [
      { label: "1 L" },
      { label: "5 L" },
      { label: "Aerosol", detail: "Ako je dostupno u programu" },
    ],
    purpose: "Izolacija, prijanjanje i priprema podloge pre bazne boje",
    badges: ["Prajmer", "Podloga", "Na upit"],
    productImage: {
      src: placeholderProductImage,
      alt: "Car Fit prajmer, ilustrativni prikaz ambalaže",
    },
    galleryImages: [
      {
        src: placeholderProductImage,
        alt: "Car Fit prajmer, detalj ambalaže",
      },
    ],
    specifications: [
      { label: "Mešanje", value: "Prema tehničkom listu" },
      { label: "Nanošenje", value: "Pištoljem ili prema tipu proizvoda" },
      { label: "Sušenje", value: "Prema debljini sloja i uslovima" },
      { label: "Površina", value: "Pripremljene metalne i obrađene površine" },
      { label: "Rok trajanja", value: "Prema deklaraciji" },
    ],
    documents: [
      {
        title: "Tehnički list",
        kind: "PDF",
        href: "/documents/placeholder-tds.pdf",
        status: "placeholder",
        note: "Dokument se potvrđuje kroz upit",
      },
      {
        title: "Bezbednosni list",
        kind: "PDF",
        href: "/documents/placeholder-msds.pdf",
        status: "placeholder",
        note: "Dokument se potvrđuje kroz upit",
      },
    ],
    relatedProductSlugs: [
      "rm-diamont-bazna-boja",
    ],
  },
  {
    slug: "cosmos-spray-sprej",
    name: "Cosmos Spray sprej",
    brandSlug: "cosmos-lac",
    programSlug: "aerosoli",
    phaseSlug: "podloga",
    shortDescription:
      "Aerosol proizvod za brze popravke, pripremu i pomoćne radioničke zadatke.",
    longDescription:
      "Cosmos Spray je predstavljen kao aerosol artikl koji se u katalogu može povezati sa više namena. Template podržava status dokumentacije i jasnu CTA strukturu za upit ili pronalazak prodavnice.",
    sku: "COSMOS-SPRAY",
    packages: [
      { label: "400 ml" },
      { label: "Više nijansi", detail: "Po programu i dostupnosti" },
    ],
    purpose: "Brza intervencija, pomoćna priprema ili lokalna popravka",
    badges: ["Aerosol", "Servisna upotreba", "Na upit"],
    productImage: {
      src: placeholderProductImage,
      alt: "Cosmos Spray sprej, ilustrativni prikaz ambalaže",
    },
    galleryImages: [
      {
        src: placeholderProductImage,
        alt: "Cosmos Spray sprej, detalj ambalaže",
      },
    ],
    specifications: [
      { label: "Nanošenje", value: "Aerosol sprej, prema uputstvu na ambalaži" },
      { label: "Površina", value: "Zavisno od namene i pripreme podloge" },
      { label: "Sušenje", value: "Prema proizvodu i uslovima rada" },
      { label: "Rok trajanja", value: "Prema deklaraciji" },
    ],
    documents: [
      {
        title: "Bezbednosni list",
        kind: "PDF",
        href: "/documents/placeholder-msds.pdf",
        status: "placeholder",
        note: "Dokument se potvrđuje kroz upit",
      },
    ],
    relatedProductSlugs: [
      "car-fit-prajmer",
      "satajet-x-5500",
      "rm-diamont-bezbojni-lak",
    ],
  },
  {
    slug: "baslac-900-basecoat",
    name: "Baslac 900 basecoat",
    brandSlug: "baslac",
    programSlug: "boje-i-lakovi",
    phaseSlug: "boja",
    shortDescription:
      "Bazni sistem za refinish bojenje sa preglednom primenom u radionici.",
    longDescription:
      "Baslac 900 basecoat je proizvod iz iste faze refinish procesa. Struktura stranice omogućava poređenje po programu, fazi i dokumentaciji bez prikaza komercijalnih uslova.",
    sku: "BASLAC-900",
    packages: [
      { label: "0.5 L" },
      { label: "1 L" },
      { label: "3.5 L" },
    ],
    purpose: "Bazni sloj i izrada nijanse pre završnog laka",
    badges: ["Basecoat", "Boja", "Na upit"],
    productImage: {
      src: placeholderProductImage,
      alt: "Baslac 900 basecoat, ilustrativni prikaz ambalaže",
    },
    galleryImages: [
      {
        src: placeholderProductImage,
        alt: "Baslac 900 basecoat, detalj ambalaže",
      },
    ],
    specifications: [
      { label: "Mešanje", value: "Prema formuli i tehničkom listu" },
      { label: "Nanošenje", value: "Bazni sloj profesionalnim pištoljem" },
      { label: "Sušenje", value: "Zavisno od uslova u radionici" },
      { label: "Pokrivnost", value: "Zavisno od nijanse i podloge" },
      { label: "Površina", value: "Pripremljena podloga posle prajmera" },
    ],
    documents: [
      {
        title: "Tehnički list",
        kind: "PDF",
        href: "/documents/placeholder-tds.pdf",
        status: "placeholder",
        note: "Dokument se potvrđuje kroz upit",
      },
      {
        title: "Mešanje i nijanse",
        kind: "Baza formula",
        status: "disabled",
        note: "Dostupno kroz tehničku podršku",
      },
    ],
    relatedProductSlugs: [
      "rm-diamont-bazna-boja",
      "rm-diamont-bezbojni-lak",
      "satajet-x-5500",
    ],
  },
  {
    slug: "norbin-2k-bezbojni-lak",
    name: "Norbin 2K bezbojni lak",
    brandSlug: "norbin",
    programSlug: "boje-i-lakovi",
    phaseSlug: "lak",
    shortDescription:
      "Bezbojni lak za završni sloj i zaštitu u profesionalnoj obradi površine.",
    longDescription:
      "Norbin 2K bezbojni lak je deo Norbin programa u katalogu. Stranica povezuje upit, dokumentaciju i srodne refinish proizvode.",
    sku: "NORBIN-2K-CLEAR",
    packages: [
      { label: "1 L" },
      { label: "5 L" },
      { label: "Set", detail: "Lak i prateći učvršćivač po upitu" },
    ],
    purpose: "Završni sloj, sjaj i zaštita nakon baznog sistema",
    badges: ["Bezbojni lak", "Završni sloj", "Na upit"],
    productImage: {
      src: placeholderProductImage,
      alt: "Norbin 2K bezbojni lak, ilustrativni prikaz ambalaže",
    },
    galleryImages: [
      {
        src: placeholderProductImage,
        alt: "Norbin 2K bezbojni lak, detalj ambalaže",
      },
    ],
    specifications: [
      { label: "Mešanje", value: "Prema tehničkom listu" },
      { label: "Nanošenje", value: "Profesionalni pištolj za završni sloj" },
      { label: "Sušenje", value: "Zavisno od sistema i uslova u lakirnici" },
      { label: "Površina", value: "Bazni sloj spreman za lakiranje" },
      { label: "Rok trajanja", value: "Prema deklaraciji na ambalaži" },
    ],
    documents: [
      {
        title: "Tehnički list",
        kind: "PDF",
        href: "/documents/placeholder-tds.pdf",
        status: "placeholder",
        note: "Dokument se potvrđuje kroz upit",
      },
    ],
    relatedProductSlugs: [
      "rm-diamont-bezbojni-lak",
      "rm-diamont-bazna-boja",
      "satajet-x-5500",
    ],
  },
  {
    slug: "carsystem-finish-cut-polir-pasta",
    name: "Carsystem Finish Cut polir pasta",
    brandSlug: "carsystem",
    programSlug: "poliranje",
    phaseSlug: "poliranje",
    shortDescription:
      "Pasta za korekciju i završnu obradu lakirane površine posle refinish procesa.",
    longDescription:
      "Finish Cut je proizvod za poliranje u katalogu. Namenjen je završnoj fazi procesa, povezivanju sa tehničkom podrškom i dokumentima bez prikaza komercijalnih uslova.",
    sku: "CS-FINISH-CUT",
    packages: [
      { label: "250 ml" },
      { label: "1 L" },
      { label: "Set", detail: "Pasta i prateća podloška po upitu" },
    ],
    purpose: "Korekcija tragova obrade, završni sjaj i finalna dorada laka",
    badges: ["Poliranje", "Finalna obrada", "Na upit"],
    productImage: {
      src: placeholderProductImage,
      alt: "Carsystem Finish Cut polir pasta, ilustrativni prikaz ambalaže",
    },
    galleryImages: [
      {
        src: placeholderProductImage,
        alt: "Carsystem Finish Cut polir pasta, detalj ambalaže",
      },
    ],
    specifications: [
      { label: "Nanošenje", value: "Mašinski ili ručno, prema stanju površine" },
      { label: "Površina", value: "Očvrsli bezbojni lak i pripremljene površine" },
      { label: "Potrošnja", value: "Zavisno od površine i nivoa korekcije" },
      { label: "Rok trajanja", value: "Prema deklaraciji na ambalaži" },
    ],
    documents: [
      {
        title: "Tehnički list",
        kind: "PDF",
        href: "/documents/placeholder-tds.pdf",
        status: "placeholder",
        note: "Dokument se potvrđuje kroz upit",
      },
    ],
    relatedProductSlugs: [
      "rm-diamont-bezbojni-lak",
      "carsystem-maskirna-traka",
    ],
  },
  {
    slug: "carsystem-maskirna-traka",
    name: "Carsystem maskirna traka",
    brandSlug: "carsystem",
    programSlug: "potrosni-materijal",
    phaseSlug: "priprema",
    shortDescription:
      "Potrošni materijal za precizno maskiranje tokom pripreme i lakiranja.",
    longDescription:
      "Maskirna traka predstavlja potrošni materijal u katalogu. Stranica prikazuje namenu i osnovne informacije bez lagera ili naručivanja.",
    sku: "CS-MASK-TAPE",
    packages: [
      { label: "19 mm" },
      { label: "38 mm" },
      { label: "50 mm" },
    ],
    purpose: "Maskiranje ivica, zaštita površina i radionička priprema",
    badges: ["Potrošni materijal", "Maskiranje", "Na upit"],
    productImage: {
      src: placeholderProductImage,
      alt: "Carsystem maskirna traka, ilustrativni prikaz ambalaže",
    },
    galleryImages: [
      {
        src: placeholderProductImage,
        alt: "Carsystem maskirna traka, detalj pakovanja",
      },
    ],
    specifications: [
      { label: "Površina", value: "Pripremljene, čiste i suve radioničke površine" },
      { label: "Nanošenje", value: "Ručno maskiranje prema ivici popravke" },
      { label: "Potrošnja", value: "Zavisno od obima popravke i zone zaštite" },
      { label: "Rok trajanja", value: "Prema deklaraciji na ambalaži" },
    ],
    documents: [
    ],
    relatedProductSlugs: [
      "car-fit-prajmer",
      "cosmos-lac-ral-cl-330-ral-3000-sjaj-400-ml-500-ml-ral-3000-flame-red",
    ],
  },
];

type ProductSeed = Omit<CarsystemProduct, "badges" | "documents" | "galleryImages" | "productImage"> & {
  badges: string[];
  documents?: ProductDocument[];
  galleryImages?: ProductImageAsset[];
  productImage?: ProductImageAsset | null;
};

type ProductAssetUpdate = {
  documents?: ProductDocument[];
  galleryImages?: ProductImageAsset[];
  productImage: ProductImageAsset;
};

function archivedProduct(slug: string) {
  const product = legacyProducts.find((item) => item.slug === slug);
  if (!product) {
    throw new Error(`Missing archived product: ${slug}`);
  }

  return product;
}

function productAsset(src: string, alt: string): ProductImageAsset {
  return { src, alt };
}

function withProductAssets(
  product: CarsystemProduct,
  { documents, galleryImages = [], productImage }: ProductAssetUpdate,
): CarsystemProduct {
  return {
    ...product,
    productImage,
    galleryImages,
    documents: documents ?? product.documents,
  };
}

function tdsDocument(href: string): ProductDocument {
  return {
    title: "Tehnički list",
    kind: "PDF",
    href,
    status: "available",
    note: "Tehnički list proizvođača.",
  };
}

function documentsWithTds(productName: string, href: string): ProductDocument[] {
  return [
    tdsDocument(href),
    {
      title: "Bezbednosni list",
      kind: "PDF",
      status: "placeholder",
      note: `Dostupno na upit za ${productName}.`,
    },
  ];
}

function documentsOnRequest(productName: string): ProductDocument[] {
  return [
    {
      title: "Tehnički list",
      kind: "PDF",
      status: "placeholder",
      note: `Dostupno na upit za ${productName}.`,
    },
    {
      title: "Bezbednosni list",
      kind: "PDF",
      status: "placeholder",
      note: "Dostavlja se kada je primenljivo za potvrđen artikal.",
    },
  ];
}

function createProduct(seed: ProductSeed): CarsystemProduct {
  const image = seed.productImage ?? {
    src: placeholderProductImage,
    alt: `${seed.name} — fotografija proizvoda nije dostupna`,
  };

  return {
    ...seed,
    badges: seed.badges.includes("Na upit") ? seed.badges : [...seed.badges, "Na upit"],
    productImage: image,
    galleryImages: seed.galleryImages ?? [],
    documents: seed.documents ?? documentsOnRequest(seed.name),
  };
}

const befarPadColors = [
  {
    label: "narandžasti",
    labelTitle: "Narandžasti",
    slug: "narandzasti",
    sku: "OR",
    swatch: "oklch(0.72 0.17 55)",
    // Befarova zvanična hardness legenda (katalog, str. 4-20): ORANGE = ★★★★★,
    // najtvrđa pena u osnovnoj liniji, uz tečnu ili kremastu pastu. Prethodni
    // opis („srednja korekcija“) je bio netačan — ispravljeno 2026-08-09.
    role: "Najtvrđa izvedba: najagresivnija korekcija uz tečnu ili kremastu pastu.",
  },
  {
    label: "crni",
    labelTitle: "Crni",
    slug: "crni",
    sku: "BK",
    swatch: "oklch(0.2 0.01 255)",
    role: "Fina završna obrada i kontrola holograma.",
  },
  {
    label: "beli",
    labelTitle: "Beli",
    slug: "beli",
    sku: "WH",
    swatch: "oklch(0.94 0.01 255)",
    role: "Kontrolisana korekcija na pripremljenom laku.",
  },
  {
    label: "plavi",
    labelTitle: "Plavi",
    slug: "plavi",
    sku: "BL",
    swatch: "oklch(0.58 0.19 255)",
    role: "Završni sjaj i finalno ujednačavanje površine.",
  },
] as const;

const befarPadSizes = [
  {
    // Befar zapis: prečnik × debljina (kao u šiframa, npr. 04403 „150 × 25 mm”).
    label: "150 × 25 mm",
    slug: "25x150",
    detail: "Uska kontaktna površina",
  },
  {
    label: "150 × 50 mm",
    slug: "50x150",
    detail: "Šira kontaktna površina",
  },
] as const;

const befarPadProducts = befarPadColors.flatMap((color) =>
  befarPadSizes.map((size) =>
    createProduct({
      slug: `befar-sundjer-${color.slug}-${size.slug}`,
      name: `Befar sunđer ${color.label} ${size.slug}`,
      brandSlug: "befar",
      programSlug: "poliranje",
      phaseSlug: "poliranje",
      shortDescription: `Sunđer za poliranje, ${color.label} izvedba, dimenzija ${size.label}.`,
      longDescription:
        "Befar sunđeri su prikazani kao radionički potrošni program za korekciju, završnu obradu i kontrolu sjaja. Varijante su odvojene po boji i dimenziji kako bi upit bio precizan.",
      sku: `BEFAR-PAD-${color.sku}-${size.slug.toUpperCase()}`,
      packages: [{ label: size.label, detail: size.detail }],
      purpose: color.role,
      badges: ["Sunđer", color.labelTitle, "Poliranje", "Na upit"],
      productImage: productAsset(
        `/products/befar/befar-sundjer-${color.slug}-${size.slug}.svg`,
        `Befar sunđer ${color.label} ${size.label}`,
      ),
      specifications: [
        { label: "Boja", value: color.labelTitle },
        { label: "Dimenzija", value: size.label },
        { label: "Primena", value: "Mašinsko ili ručno poliranje prema nosaču" },
        { label: "Faza", value: "Završna obrada laka" },
      ],
      relatedProductSlugs: [
        `befar-sundjer-${color.slug}-${size.slug === "25x150" ? "50x150" : "25x150"}`,
        "carsystem-finish-serija",
        "rm-pasta-190-1l",
      ],
      family: {
        id: "befar-polishing-pads",
        label: "Befar sunđeri za poliranje",
        catalogStrategy: "hybrid",
      },
      catalogStrategy: "hybrid",
      variantId: `${color.slug}-${size.slug}`,
      variantOptions: {
        color: color.labelTitle,
        colorSwatch: color.swatch,
        role: color.role,
        size: size.label,
      },
    }),
  ),
);

const productRecords: CarsystemProduct[] = [
  ...rmImportedProducts,
  // Norbin: 13 aktuelnih EMEA proizvoda sa norbin-paint.com (`npm run norbin:sync`).
  ...getNorbinCatalogProducts(),
  // Baslac sistemske baze (samo ACTIVE_CONFIRMED) i pripremni proizvodi.
  // Generišu se iz `lib/baslac-systems.ts`; phase-out i UNVERIFIED ne ulaze.
  ...baslacCatalogProducts,
  withProductAssets(archivedProduct("rm-diamont-bazna-boja"), {
    productImage: productAsset(
      "/products/rm/rm-diamont-bazna-boja.webp",
      "R-M DIAMONT bazna boja u limenci",
    ),
  }),
  archivedProduct("rm-diamont-bezbojni-lak"),
  createProduct({
    slug: "rm-body-filler-white-b-2e11",
    name: "R-M Body Filler White B 2E11",
    brandSlug: "rm",
    programSlug: "priprema-povrsine",
    phaseSlug: "priprema",
    shortDescription: "Beli body filler za ravnanje i pripremu površine pre podloge.",
    longDescription:
      "R-M Body Filler White B 2E11 je pozicioniran kao pripremni proizvod za popunjavanje, ravnanje i stabilnu osnovu pre nanošenja prajmera ili punila.",
    sku: "RM-BF-WHITE-B-2E11",
    packages: [{ label: "Na upit", detail: "Pakovanje se potvrđuje kroz upit" }],
    purpose: "Gitovanje, ravnanje i lokalna priprema površine",
    badges: ["Body filler", "Git", "Priprema", "Na upit"],
    rmMetadata: {
      system: null,
      series: null,
      category: "bodyfiller",
      technology: null,
      finish: null,
    },
    productImage: productAsset(
      "/products/rm/rm-body-filler-white-b-2e11.webp",
      "R-M Body Filler White B 2E11 sa učvršćivačem",
    ),
    specifications: [
      { label: "Tip", value: "Body filler / git" },
      { label: "Boja", value: "Bela" },
      { label: "Nanošenje", value: "Špahtlom na pripremljenu površinu" },
      { label: "Sledeća faza", value: "Brušenje i podloga" },
    ],
    relatedProductSlugs: [
      "rm-diamont-bazna-boja",
    ],
  }),
  createProduct({
    slug: "rm-pasta-190-1l",
    name: "R-M Pasta 190 1 L",
    brandSlug: "rm",
    programSlug: "boje-i-lakovi",
    phaseSlug: "boja",
    shortDescription: "Pasta za poliranje u pakovanju 1 L za završnu obradu laka.",
    longDescription:
      "R-M Pasta 190 u pakovanju 1 L je prikazana kao profesionalna pasta za korekciju i završnu obradu nakon lakiranja, sa upitom za dostupnost i prateću dokumentaciju.",
    sku: "RM-PASTA-190-1L",
    packages: [{ label: "1 L" }],
    purpose: "Korekcija površine i priprema finalnog sjaja",
    badges: ["Pasta", "Poliranje", "Na upit"],
    rmMetadata: {
      system: null,
      series: null,
      // Identitet po šifri (2026-09-11): 190 = DIAMONT BC 190 „Dense white"
      // toner/mešna baza (carross.eu, ds-color.com), fotografija nosi BC 190.
      // Kategorija „pasta za poliranje" je bila pogrešna; naziv artikla je
      // ostavljen dok vlasnik ne potvrdi javni naziv.
      category: "basecoat",
      technology: null,
      finish: null,
    },
    productImage: productAsset(
      "/products/rm/rm-pasta-190-1l.webp",
      "R-M DIAMONT BC 190 proizvod u limenci",
    ),
    specifications: [
      { label: "Pakovanje", value: "1 L" },
      { label: "Primena", value: "Poliranje očvrslog laka" },
      { label: "Nanošenje", value: "Mašinski ili ručno prema stanju površine" },
      { label: "Faza", value: "Poliranje" },
    ],
    relatedProductSlugs: ["rm-pasta-190-5l", "befar-sundjer-crni-25x150", "carsystem-finish-serija"],
  }),
  createProduct({
    slug: "rm-pasta-190-5l",
    name: "R-M Pasta 190 5 L",
    brandSlug: "rm",
    programSlug: "boje-i-lakovi",
    phaseSlug: "boja",
    shortDescription: "Radioničko pakovanje paste za poliranje i završnu obradu laka.",
    longDescription:
      "R-M Pasta 190 u pakovanju 5 L namenjena je radionicama koje traže veće pakovanje za kontinuiran rad na korekciji i finalnom sjaju.",
    sku: "RM-PASTA-190-5L",
    packages: [{ label: "5 L" }],
    purpose: "Poliranje većeg obima i završna obrada lakirane površine",
    badges: ["Pasta", "Radioničko pakovanje", "Na upit"],
    rmMetadata: {
      system: null,
      series: null,
      // Identitet po šifri (2026-09-15): naziv i šifra nose 190 (DIAMONT BC 190
      // „Dense white"), ali FOTOGRAFIJA nosi BC 605 (BASF „Yellow Oxide" / EU
      // „Opaque yellow"). Oba su DIAMONT mešne baze (ne paste za poliranje),
      // pa je taksonomija basecoat; nijansa ostaje blokirana dok vlasnik ne
      // potvrdi koji artikal je 5 L zaista.
      category: "basecoat",
      technology: null,
      finish: null,
    },
    productImage: productAsset(
      "/products/rm/rm-pasta-190-5l.webp",
      "R-M DIAMONT BC 605 proizvod u limenci",
    ),
    specifications: [
      { label: "Pakovanje", value: "5 L" },
      { label: "Primena", value: "Korekcija i završni sjaj" },
      { label: "Površina", value: "Očvrsli bezbojni lak" },
      { label: "Status", value: "Dostupnost se potvrđuje kroz upit" },
    ],
    relatedProductSlugs: ["rm-pasta-190-1l", "befar-sundjer-crni-50x150", "carsystem-finish-serija"],
  }),
  createProduct({
    slug: "carsystem-git-multi-green",
    name: "Carsystem Git Multi Green",
    brandSlug: "carsystem",
    programSlug: "priprema-povrsine",
    phaseSlug: "priprema",
    shortDescription: "Višenamenski zeleni git za pripremu i ravnanje površine.",
    longDescription:
      "Carsystem Git Multi Green je deo pripremne faze za popunjavanje, ravnanje i stvaranje stabilne osnove pre brušenja i podloge.",
    sku: "CS-GIT-MULTI-GREEN",
    packages: [
      { label: "1.8 kg" },
      { label: "2 kg" },
    ],
    purpose: "Ravnanje površine i popunjavanje neravnina pre brušenja",
    badges: ["Git", "Priprema", "Na upit"],
    productImage: productAsset(
      "/products/carsystem/carsystem-git-multi-green.webp",
      "Carsystem Git Multi Green u limenci",
    ),
    documents: documentsWithTds(
      "Carsystem Git Multi Green",
      "/documents/products/carsystem/carsystem-git-multi-green-tds.pdf",
    ),
    specifications: [
      { label: "Tip", value: "Body filler / git" },
      { label: "Boja", value: "Zelena" },
      { label: "Pakovanje", value: "1.8 kg / 2 kg" },
      { label: "Nanošenje", value: "Špahtlom uz prateći učvršćivač" },
    ],
    relatedProductSlugs: [
      "rm-body-filler-white-b-2e11",
    ],
  }),
  createProduct({
    slug: "carsystem-git-elastic-weiss",
    name: "Carsystem Git Elastic Weiss",
    brandSlug: "carsystem",
    programSlug: "priprema-povrsine",
    phaseSlug: "priprema",
    shortDescription: "Elastični beli git za pripremne radove i finije ravnanje.",
    longDescription:
      "Carsystem Git Elastic Weiss je pozicioniran kao beli pripremni git za radionice kojima je potrebna kontrola ravnanja i stabilan nastavak procesa brušenja.",
    sku: "CS-GIT-ELASTIC-WEISS",
    packages: [
      { label: "1 kg" },
      { label: "1.8 kg" },
    ],
    purpose: "Elastično popunjavanje i ravnanje pre podloge",
    badges: ["Git", "Beli", "Priprema", "Na upit"],
    productImage: productAsset(
      "/products/carsystem/carsystem-git-elastic-weiss.png",
      "Carsystem Git Elastic Weiss u limenci",
    ),
    documents: documentsWithTds(
      "Carsystem Git Elastic Weiss",
      "/documents/products/carsystem/carsystem-git-elastic-weiss-tds.pdf",
    ),
    specifications: [
      { label: "Tip", value: "Elastični git" },
      { label: "Boja", value: "Bela" },
      { label: "Pakovanje", value: "1 kg / 1.8 kg" },
      { label: "Obrada", value: "Brušenje nakon sušenja prema tehničkom listu" },
    ],
    relatedProductSlugs: [
      "carsystem-git-multi-green",
      "carsystem-f19-brusni-diskovi",
    ],
  }),
  createProduct({
    slug: "carsystem-f19-brusni-diskovi",
    name: "Carsystem F19 brusni diskovi",
    brandSlug: "carsystem",
    programSlug: "abrazivi",
    phaseSlug: "priprema",
    shortDescription: "Brusni diskovi P80-P800 za kontrolisanu pripremu i međufaznu obradu.",
    longDescription:
      "Carsystem F19 brusni diskovi su deo abrazivnog programa za pripremu površine, od obrade gita do finije pripreme pre naredne faze.",
    sku: "CS-F19-DISC",
    // Zvanični podnaslov (carsystem.org): „Film abrasive - 150 mm - 25 holes” — film, ne papir.
    searchTerms: abrasiveBackingTerms("Film abrasive - 150 mm - 25 holes"),
    packages: [{ label: "P80-P800", detail: "Granulacije po izboru" }],
    purpose: "Međufazno brušenje i priprema za podlogu ili boju",
    badges: ["Abrazivi", "P80-P800", "Na upit"],
    productImage: productAsset(
      "/products/carsystem/carsystem-f19-brusni-diskovi.png",
      "Carsystem F19 brusni disk",
    ),
    galleryImages: [
      productAsset(
        "/products/carsystem/carsystem-f19-brusni-diskovi-detail.jpg",
        "Carsystem F19 brusni diskovi, dodatni prikaz",
      ),
    ],
    documents: documentsWithTds(
      "Carsystem F19 brusni diskovi",
      "/documents/products/carsystem/carsystem-f19-brusni-diskovi-tds.pdf",
    ),
    specifications: [
      { label: "Granulacija", value: "P80-P800" },
      { label: "Forma", value: "Brusni diskovi" },
      { label: "Nosač", value: "Prema varijanti proizvoda" },
      { label: "Primena", value: "Suvo brušenje u pripremi" },
    ],
    relatedProductSlugs: [
      "carsystem-f23-brusni-diskovi",
      "carsystem-git-elastic-weiss",
      "carsystem-finish-serija",
    ],
  }),
  createProduct({
    slug: "carsystem-f23-brusni-diskovi",
    name: "Carsystem Sanding Disc F.23 Ceramic",
    brandSlug: "carsystem",
    programSlug: "abrazivi",
    phaseSlug: "priprema",
    shortDescription:
      "Keramički filmski brusni disk prečnika 150 mm sa Carsystem rasporedom od 25 rupa.",
    longDescription:
      "F.23 Ceramic je filmski abraziv sa mešavinom mineralnog i keramičkog zrna. Namenjen je radovima brušenja od grube do fine obrade, uz izbor odgovarajuće granulacije za konkretnu fazu rada.",
    sku: "159.218–159.226",
    packages: [{ label: "50 kom.", detail: "Fabričko pakovanje po granulaciji" }],
    purpose: "Brušenje od grube obrade do fine pripreme površine",
    badges: ["Filmski abraziv", "P80–P800", "150 mm", "Na upit"],
    productImage: productAsset(
      "/products/carsystem/carsystem-f23-brusni-diskovi.png",
      "Carsystem F23 brusni disk",
    ),
    galleryImages: [
      productAsset(
        "/products/carsystem/carsystem-f23-brusni-diskovi-detail-1.jpg",
        "Carsystem F23 brusni diskovi, dodatni prikaz",
      ),
    ],
    documents: documentsWithTds(
      "Carsystem F23 brusni diskovi",
      "/documents/products/carsystem/carsystem-f23-brusni-diskovi-tds.pdf",
    ),
    specifications: [
      { label: "Prečnik", value: "150 mm" },
      { label: "Raspored rupa", value: "25 rupa i ovalni centralni otvor" },
      { label: "Nosač", value: "Poliesterski film" },
      { label: "Zrno", value: "Mešavina mineralnog zrna sa keramičkim sadržajem" },
      { label: "Granulacije", value: "P80, P120, P180, P240, P320, P400, P500, P600, P800" },
    ],
    relatedProductSlugs: [
      "carsystem-f19-brusni-diskovi",
      "carsystem-git-elastic-weiss",
    ],
    family: {
      id: "carsystem-f23",
      label: "Carsystem F.23",
      catalogStrategy: "family-card",
      visualIdentity: {
        accent: "oklch(0.52 0.15 300)",
        softAccent: "oklch(0.72 0.08 300 / 0.14)",
        optionShape: "pill",
      },
    },
    catalogStrategy: "family-card",
    detail: {
      reviewStatus: "confirmed",
      hero: {
        kicker: "Carsystem abrazivni program",
        subtype: "Filmski abraziv · 150 mm · 25 rupa",
        lead:
          "Keramičko zrno, stearatni premaz i otporan filmski nosač za kontrolisano brušenje od grube do fine obrade.",
      },
      quickFacts: {
        reviewStatus: "confirmed",
        content: [
          { label: "Prečnik", value: "150 mm", reviewStatus: "confirmed" },
          { label: "Raspored", value: "25 rupa", reviewStatus: "confirmed" },
          { label: "Granulacije", value: "P80–P800", reviewStatus: "confirmed" },
          { label: "Nosač", value: "Poliesterski film", reviewStatus: "confirmed" },
        ],
      },
      variants: {
        reviewStatus: "confirmed",
        content: {
          title: "Granulacije i šifre artikala",
          description:
            "Svaka granulacija ima zasebnu proizvođačku šifru. Dostupnost na domaćem tržištu proverava se kroz upit.",
          columns: [
            { key: "article", label: "Šifra artikla" },
            { key: "grit", label: "Granulacija" },
            { key: "pack", label: "Fabričko pakovanje" },
            { key: "status", label: "Javni status" },
          ],
          rows: [
            { id: "159.218", values: { article: "159.218", grit: "P80", pack: "50 kom.", status: "Na upit" }, reviewStatus: "confirmed" },
            { id: "159.219", values: { article: "159.219", grit: "P120", pack: "50 kom.", status: "Na upit" }, reviewStatus: "confirmed" },
            { id: "159.220", values: { article: "159.220", grit: "P180", pack: "50 kom.", status: "Na upit" }, reviewStatus: "confirmed" },
            { id: "159.221", values: { article: "159.221", grit: "P240", pack: "50 kom.", status: "Na upit" }, reviewStatus: "confirmed" },
            { id: "159.222", values: { article: "159.222", grit: "P320", pack: "50 kom.", status: "Na upit" }, reviewStatus: "confirmed" },
            { id: "159.223", values: { article: "159.223", grit: "P400", pack: "50 kom.", status: "Na upit" }, reviewStatus: "confirmed" },
            { id: "159.224", values: { article: "159.224", grit: "P500", pack: "50 kom.", status: "Na upit" }, reviewStatus: "confirmed" },
            { id: "159.225", values: { article: "159.225", grit: "P600", pack: "50 kom.", status: "Na upit" }, reviewStatus: "confirmed" },
            { id: "159.226", values: { article: "159.226", grit: "P800", pack: "50 kom.", status: "Na upit" }, reviewStatus: "confirmed" },
          ],
          note: "Šifre i fabričko pakovanje: Carsystem katalog proizvoda 2025.",
        },
      },
      benefits: {
        reviewStatus: "confirmed",
        content: {
          title: "Zašto F.23 Ceramic",
          description:
            "Prednosti koje direktno proizlaze iz konstrukcije abraziva.",
          items: [
            {
              title: "Brzo skidanje materijala",
              description: "Keramičko abrazivno zrno omogućava efikasno uklanjanje materijala.",
              reviewStatus: "confirmed",
            },
            {
              title: "Dug radni vek",
              description: "Keramički sadržaj doprinosi trajnosti i stabilnom radu diska.",
              reviewStatus: "confirmed",
            },
            {
              title: "Manje zapunjavanja",
              description: "Stearatni premaz smanjuje lepljenje prašine i zapunjavanje površine diska.",
              reviewStatus: "confirmed",
            },
            {
              title: "Ujednačen trag brušenja",
              description: "Otporan filmski nosač pomaže da rezultat brušenja ostane homogen.",
              reviewStatus: "confirmed",
            },
          ],
        },
      },
      process: {
        reviewStatus: "confirmed",
        content: {
          title: "Primena kroz više faza brušenja",
          description:
            "F.23 Ceramic nije vezan za samo jedan linearni korak. Granulacija se bira prema podlozi, cilju obrade i narednom materijalu u sistemu.",
          mode: "supporting-process",
          stages: [
            { label: "Gruba obrada", detail: "P80–P180", reviewStatus: "confirmed" },
            { label: "Međufazna priprema", detail: "P240–P400", reviewStatus: "confirmed" },
            { label: "Fina obrada", detail: "P500–P800", reviewStatus: "confirmed" },
          ],
        },
      },
      technology: {
        reviewStatus: "confirmed",
        content: {
          kicker: "Ključna tehnologija",
          title: "Keramičko zrno na otpornom filmskom nosaču",
          description:
            "Mešavina mineralnog zrna sa keramičkim sadržajem kombinuje reznu sposobnost sa dugotrajnošću, dok stearatni premaz pomaže kontroli zapunjavanja tokom rada.",
          facts: [
            { label: "Zrno", value: "Keramički sadržaj", reviewStatus: "confirmed" },
            { label: "Premaz", value: "Stearatni", reviewStatus: "confirmed" },
            { label: "Nosač", value: "Poliesterski film", reviewStatus: "confirmed" },
          ],
        },
      },
      technicalFacts: {
        reviewStatus: "confirmed",
        content: [
          { label: "Tip proizvoda", value: "Filmski abrazivni disk", reviewStatus: "confirmed" },
          { label: "Prečnik", value: "150 mm", reviewStatus: "confirmed" },
          { label: "Raspored rupa", value: "25 rupa i ovalni centralni otvor", reviewStatus: "confirmed" },
          { label: "Materijal nosača", value: "Poliester", reviewStatus: "confirmed" },
          { label: "Vrsta zrna", value: "Mešavina mineralnog zrna sa keramičkim sadržajem", reviewStatus: "confirmed" },
          { label: "Raspon granulacija", value: "P80–P800", reviewStatus: "confirmed" },
        ],
      },
      documents: {
        reviewStatus: "confirmed",
        content: [
          {
            id: "f23-tds-en-v01",
            title: "Tehnički list proizvođača",
            kind: "tds",
            availability: "available",
            href: "/documents/products/carsystem/carsystem-f23-brusni-diskovi-tds.pdf",
            language: "Engleski",
            version: "V01",
            publishedAt: "02/2024",
            reviewStatus: "confirmed",
          },
        ],
      },
      // Zvanična F.23 stranica (recommendedProductUrls u data/carsystem-sync/raw/website-en.generated.json)
      // preporučuje upravo ova dva zapisa: interface-pad-interface-pad-150-mm i excenter-back-pad-t19-back-pad-150-mm.
      compatibleProducts: {
        reviewStatus: "confirmed",
        content: {
          title: "Koristi se zajedno sa",
          description: "Pribor koji proizvođač preporučuje uz ovaj proizvod.",
          items: [
            {
              productSlug: "carsystem-interface-pad",
              note: "Zvanično preporučen uz F.23.",
              reviewStatus: "confirmed",
            },
            {
              productSlug: "carsystem-excenter-back-pad-t-19",
              note: "Zvanično preporučen uz F.23.",
              reviewStatus: "confirmed",
            },
          ],
        },
      },
      alternativeProducts: {
        reviewStatus: "confirmed",
        content: {
          title: "Alternative iz iste kategorije",
          description:
            "Drugi Carsystem abrazivni diskovi za grubu, međufaznu i finu obradu.",
          items: [
            { productSlug: "carsystem-f19-brusni-diskovi", reviewStatus: "confirmed" },
          ],
        },
      },
      finalCta: {
        title: "Niste sigurni koja granulacija odgovara Vašem procesu?",
        description:
          "Pošaljite nam podatke o podlozi i fazi rada. Pomoći ćemo Vam da preciznije definišete izbor pre kupovine.",
        inquiryLabel: "Zatražite savet za izbor",
        storeLabel: "Pronađite prodavnicu",
      },
    },
  }),
  createProduct({
    slug: "carsystem-finish-serija",
    name: "Carsystem Finish serija",
    brandSlug: "carsystem",
    programSlug: "poliranje",
    phaseSlug: "poliranje",
    shortDescription: "Finish serija za fino matiranje, korekciju i završnu pripremu sjaja.",
    longDescription:
      "Carsystem Finish serija povezuje fine granulacije i završnu obradu površine pre ili tokom poliranja, zavisno od radioničkog procesa.",
    sku: "CS-FINISH-SERIES",
    packages: [
      { label: "P1000" },
      { label: "P1200" },
      { label: "P1500" },
      { label: "P2000" },
    ],
    purpose: "Fina obrada i priprema površine za završni sjaj",
    badges: ["Finish", "Poliranje", "P1000-P2000", "Na upit"],
    productImage: productAsset(
      "/products/carsystem/carsystem-finish-serija.png",
      "Carsystem Finish serija brusni disk",
    ),
    galleryImages: [
      productAsset(
        "/products/carsystem/carsystem-finish-serija-packovanje.webp",
        "Carsystem Finish serija u pakovanju",
      ),
    ],
    documents: documentsWithTds(
      "Carsystem Finish serija",
      "/documents/products/carsystem/carsystem-finish-serija-tds.pdf",
    ),
    specifications: [
      { label: "Granulacija", value: "P1000 / P1200 / P1500 / P2000" },
      { label: "Primena", value: "Fina završna obrada" },
      { label: "Površina", value: "Lak i pripremljene površine" },
      { label: "Faza", value: "Poliranje ili fina priprema" },
    ],
    relatedProductSlugs: [
      "befar-sundjer-plavi-50x150",
      "rm-pasta-190-1l",
      "carsystem-f19-brusni-diskovi",
    ],
  }),
  createProduct({
    slug: "carsystem-zastitno-odelo",
    name: "Carsystem zaštitno odelo",
    brandSlug: "carsystem",
    programSlug: "potrosni-materijal",
    phaseSlug: "priprema",
    shortDescription: "Zaštitno odelo za rad u pripremi, lakirnici i završnoj obradi.",
    longDescription:
      "Carsystem zaštitno odelo je potrošni radionički artikal za uredniji i bezbedniji radni proces u pripremi i lakiranju.",
    sku: "CS-PROTECTIVE-SUIT",
    packages: [{ label: "Komad" }],
    purpose: "Zaštita korisnika i smanjenje kontaminacije radne zone",
    badges: ["Zaštita", "Potrošni materijal", "Na upit"],
    productImage: productAsset(
      "/products/carsystem/carsystem-zastitno-odelo.png",
      "Carsystem zaštitno odelo",
    ),
    galleryImages: [
      productAsset(
        "/products/carsystem/carsystem-zastitno-odelo-detail-1.jpg",
        "Carsystem zaštitno odelo, dodatni prikaz",
      ),
      productAsset(
        "/products/carsystem/carsystem-zastitno-odelo-detail-2.jpg",
        "Carsystem zaštitno odelo, detalj proizvoda",
      ),
    ],
    specifications: [
      { label: "Pakovanje", value: "Komad" },
      { label: "Primena", value: "Priprema, lakiranje i završna obrada" },
      { label: "Veličina", value: "Potvrđuje se kroz upit" },
      { label: "Status", value: "Dostupnost se potvrđuje kroz upit" },
    ],
    relatedProductSlugs: [
      // Zamena za uklonjenu ručnu foliju 4 x 150 m: stvarni C.A.R.FIT artikal iste namene.
      "carfit-maskirna-folija-4x5m",
      "cosmos-lac-ral-cl-330-ral-3000-sjaj-400-ml-500-ml-ral-3000-flame-red",
    ],
  }),
  /*
   * `baslac-35-m331-pasta` je uklonjen 2026-08-25.
   *
   * Bio je drugi runtime zapis za isti fizički artikal `35-M331 Red Xirallic
   * 0,5 L`, koji generator već proizvodi kao `baslac-35-m331` — sa potvrđenim
   * pakovanjem, `variantId`-jem i pripadnošću porodici `baslac-line-35`, čega
   * ovaj zapis nije imao. Stari slug ostaje dostupan kroz `BASLAC_LEGACY_SLUGS`
   * i preusmerenje u `next.config.ts`. Jedini podatak koji generator nije imao
   * (`imageSourceUrl`) prenet je u `lib/baslac-enrichment.ts`; tamošnji
   * komentar objašnjava zašto se `relatedProductSlugs` NISU preneli.
   */
  createProduct({
    slug: "baslac-30-s510-s-serija",
    visualIdentity: {
      packshotKind: "family",
      visualFamily: "baslac-line-30",
      imageConfidence: "conflicting",
    },
    // Oznaka `30-S510` nije pronađena u KLW katalogu (najbliže: 30-S511 Blue
    // Red, 30-S530 Blue). Naziv se ne pretpostavlja — vidi lib/baslac-systems.ts.
    name: "Baslac 30-S510",
    brandSlug: "baslac",
    programSlug: "boje-i-lakovi",
    phaseSlug: "boja",
    shortDescription:
      "2K završna boja linije 30. Tačna oznaka nijanse se potvrđuje pre isporuke.",
    longDescription:
      "Baslac 30-S510 S serija je prikazana kao proizvod iz programa boja i lakova, sa pakovanjem koje se potvrđuje kroz upit.",
    sku: "BASLAC-30-S510",
    packages: [{ label: "Na upit", detail: "Pakovanje se potvrđuje kroz upit" }],
    purpose: "Rad u sistemu boja i pratećih materijala",
    badges: ["Line 30", "2K završna boja", "Na upit"],
    // Etiketa na staroj slici čita `35-M1020` — drugi proizvod. Uklonjena.
    productImage: {
      src: placeholderProductImage,
      alt: "Baslac 30-S510 — fotografija u pripremi",
    },
    specifications: [
      { label: "Serija", value: "30-S510 S" },
      { label: "Program", value: "Boje i lakovi" },
      { label: "Pakovanje", value: "Na upit" },
      { label: "Primena", value: "Prema tehničkom listu i sistemu" },
    ],
    relatedProductSlugs: ["baslac-60-20-razredjivac", "baslac-35-m214", "rm-diamont-bazna-boja"],
  }),
  /*
   * `baslac-35-m214` (ručni, `sku: "BASLAC-35-M214"`) je uklonjen 2026-08-25.
   *
   * Nosio je ISTI slug kao generisani zapis, pa je katalog imao dva proizvoda
   * na jednoj adresi — `getCarsystemProductBySlug()` je vraćao samo prvi, a
   * search asset je nosio duplirani id. Generisani zapis je canonical: ima
   * potvrđeno pakovanje 3,5 L, `sku: "35-M214"`, `externalSku: "53224337"`,
   * stvarni Line 35 family packshot i pripada porodici `baslac-line-35`.
   *
   * `relatedProductSlugs` i `imageSourceUrl` odavde su preneti u
   * `lib/baslac-enrichment.ts`. Napomena o ranije pogrešnoj fotografiji
   * (limenka `45-W1120`) ostaje interna i namerno nije postala javni sadržaj.
   */
  createProduct({
    slug: "baslac-60-20-razredjivac",
    visualIdentity: {
      packshotKind: "specific",
      imageConfidence: "conflicting",
    },
    name: "Baslac 60-20 razređivač",
    brandSlug: "baslac",
    programSlug: "boje-i-lakovi",
    phaseSlug: "boja",
    shortDescription: "Razređivač u pakovanju 5 L za rad u Baslac sistemu.",
    longDescription:
      "Baslac 60-20 razređivač je pomoćni proizvod u programu boja i lakova, prikazan sa jasnim upitom za dostupnost.",
    sku: "BASLAC-60-20-5L",
    packages: [{ label: "5 L" }],
    purpose: "Podešavanje sistema prema tehničkom listu",
    badges: ["Razređivač", "5 L", "Na upit"],
    // Ista pogrešna fotografija kao kod 35-M214 (`45-W1120` limenka). Uklonjena.
    productImage: {
      src: placeholderProductImage,
      alt: "Baslac 60-20 razređivač — fotografija u pripremi",
    },
    // Jedini baslac artikal čija se zvanična oznaka (60-20) poklapa sa oznakom
    // dokumenta. Ostala tri artikla nose mixing kodove (35-M214, 35-M331,
    // 30-S510) za koje postoji samo tehnički list linije, ne artikla — vidi
    // docs/BASLAC_PDP_DOCUMENT_MAP.md i scripts/match-baslac-documents.mjs.
    documents: [
      {
        title: "Tehnički list",
        kind: "PDF",
        href: "/documents/products/baslac/60-20.pdf",
        status: "available",
        note: "Zvanični Baslac tehnički list za artikal 60-20 (Reducer Universal Normal).",
      },
      {
        title: "Bezbednosni list",
        kind: "PDF",
        status: "placeholder",
        note: "Dostupno na upit za Baslac 60-20 razređivač.",
      },
    ],
    specifications: [
      { label: "Pakovanje", value: "5 L" },
      { label: "Tip", value: "Razređivač" },
      { label: "Primena", value: "Prema Baslac tehničkom sistemu" },
      { label: "Faza", value: "Boja" },
    ],
    relatedProductSlugs: ["baslac-30-s510-s-serija", "rm-diamont-bazna-boja", "satajet-x-5500"],
  }),
  createProduct({
    slug: "norbin-n15-020-5l",
    name: "Norbin N15-020 5 L",
    brandSlug: "norbin",
    programSlug: "boje-i-lakovi",
    phaseSlug: "lak",
    shortDescription: "Norbin N15-020 u pakovanju 5 L za refinish program boja i lakova.",
    longDescription:
      "Norbin N15-020 5 L je prikazan kao radioničko pakovanje iz programa boja i lakova, sa upitom za potvrdu primene i dostupnosti.",
    sku: "NORBIN-N15-020-5L",
    packages: [{ label: "5 L" }],
    purpose: "Radionički refinish proces u programu boja i lakova",
    badges: ["5 L", "Boje i lakovi", "Na upit"],
    specifications: [
      { label: "Šifra", value: "N15-020" },
      { label: "Pakovanje", value: "5 L" },
      { label: "Program", value: "Boje i lakovi" },
      { label: "Status", value: "Dostupnost se potvrđuje kroz upit" },
    ],
    relatedProductSlugs: ["norbin-n15-020-1l", "baslac-35-m214", "rm-diamont-bazna-boja"],
  }),
  createProduct({
    slug: "norbin-n15-020-1l",
    name: "Norbin N15-020 1 L",
    brandSlug: "norbin",
    programSlug: "boje-i-lakovi",
    phaseSlug: "lak",
    shortDescription: "Norbin N15-020 u pakovanju 1 L za manje potrebe i dopunu programa.",
    longDescription:
      "Norbin N15-020 1 L dopunjuje istoimeni artikal u većem pakovanju i omogućava precizniji upit prema potrebama radionice.",
    sku: "NORBIN-N15-020-1L",
    packages: [{ label: "1 L" }],
    purpose: "Dopuna refinish programa u manjem pakovanju",
    badges: ["1 L", "Boje i lakovi", "Na upit"],
    productImage: productAsset(
      "/products/norbin/norbin-n15-020-1l.webp",
      "Norbin N15-020 proizvod u pakovanju 1 L",
    ),
    specifications: [
      { label: "Šifra", value: "N15-020" },
      { label: "Pakovanje", value: "1 L" },
      { label: "Program", value: "Boje i lakovi" },
      { label: "Status", value: "Dostupnost se potvrđuje kroz upit" },
    ],
    relatedProductSlugs: ["norbin-n15-020-5l", "baslac-60-20-razredjivac", "rm-diamont-bazna-boja"],
  }),
  createProduct({
    slug: "carfit-maskirna-folija-4x5m",
    name: "Car Fit maskirna folija 4 x 5 m",
    brandSlug: "carfit",
    programSlug: "potrosni-materijal",
    phaseSlug: "priprema",
    shortDescription: "Maskirna folija 4 x 5 m za zaštitu površina tokom pripreme i lakiranja.",
    longDescription:
      "Car Fit maskirna folija 4 x 5 m je potrošni artikal za brzu zaštitu vozila i radne zone tokom pripreme i lakiranja.",
    sku: "CARFIT-FILM-4X5M",
    packages: [{ label: "4 x 5 m" }],
    purpose: "Maskiranje i zaštita površina u pripremnoj fazi",
    badges: ["Maskiranje", "Folija", "Na upit"],
    productImage: productAsset(
      "/products/carfit/carfit-maskirna-folija-4x5m.webp",
      "Car Fit maskirna folija u pakovanju",
    ),
    specifications: [
      { label: "Dimenzija", value: "4 x 5 m" },
      { label: "Tip", value: "Maskirna folija" },
      { label: "Primena", value: "Zaštita vozila i delova" },
      { label: "Faza", value: "Priprema" },
    ],
    relatedProductSlugs: [
      "carsystem-zastitno-odelo",
      "cosmos-lac-ral-cl-330-ral-3000-sjaj-400-ml-500-ml-ral-3000-flame-red",
    ],
  }),
  // Carsystem asortiman iz zvaničnog kataloga i sa carsystem.org
  // (`npm run carsystem:sync`). Zvanični proizvodi koje već vodimo ručno
  // (F.19, F.23, Elastic white…) se NE uvoze ponovo — dobijaju dopunu niže.
  ...getCarsystemCatalogProducts(),
  // C.A.R.FIT asortiman sa carfitrepair.com i iz zvaničnog kataloga
  // (`npm run carfit:sync`). Ručni zapis koji je sync pouzdano prepoznao se NE
  // uvozi ponovo — dobija dopunu niže.
  ...getCarfitCatalogProducts(),
  // BEFAR asortiman sa befar.com.tr i iz zvaničnog digitalnog kataloga
  // (`npm run befar:sync`). Leo, Befar Plus i Turkuaz su linije brenda Befar.
  // Ručni zapisi niže (`befarPadProducts`) ostaju netaknuti.
  ...getBefarCatalogProducts(),
  // R-M asortiman sa info.rmpaint.com i rmpaint.com/en-int (`npm run rm:sync`). Postojećih 59
  // uvezenih zapisa (`rmImportedProducts`) se NE duplira — njih dopunjuje `applyRmCatalogEnrichment`.
  ...getRmCatalogProducts(),
  // R-M CRYSTAL BASE: koncentrovane baze za specijalne efektne pigmente uz DIAMONT, u bočicama od 125 ml
  // (rmpaint.com/gb „Basecoat Lines”). Odluka vlasnika 2026-10-12: vidljive i poručive; redovi su u
  // `data/rm-sync/mixing-bases.json` (lib/rm-mixing-bases.ts).
  createProduct({
    slug: RM_CRYSTAL_BASE_SLUG,
    name: "R-M DIAMONT CRYSTAL BASE",
    brandSlug: "rm",
    programSlug: "boje-i-lakovi",
    phaseSlug: "boja",
    shortDescription: "Koncentrovane baze za specijalne efektne pigmente, za DIAMONT sistem.",
    longDescription:
      "CRYSTAL BASE su R-M koncentrovane baze razvijene isključivo za specijalne efektne pigmente i pakovane u bočice od 125 ml. Koriste se uz DIAMONT bazni sistem; nijansa se meša po formuli.",
    sku: RM_CRYSTAL_BASE_SLUG,
    skuIsInternalOnly: true,
    packages: [{ label: "bočica 125 ml" }],
    purpose: "Specijalni efektni pigmenti u DIAMONT nijansama",
    badges: ["Mešna baza", "DIAMONT", "125 ml"],
    rmMetadata: { system: "crystal-base", series: null, category: "basecoat", technology: "solvent", finish: null },
    specifications: [
      { label: "Sistem", value: "DIAMONT" },
      { label: "Pakovanje", value: "bočica 125 ml" },
    ],
    relatedProductSlugs: ["rm-diamont-bazna-boja"],
    // Ista generička bočica sistema koju prikazuje izbor baze (data/catalog/family-packshots.json,
    // Surventis 30817). Bez nje kartica, brend stranica i prijavljeni prikaz su davali placeholder.
    productImage: {
      src: "/products/rm/system/rm-crystal-base-125ml.webp",
      alt: "R-M DIAMONT CRYSTAL BASE, bočica 125 ml — generička ambalaža sistema bez šifre nijanse",
    },
  }),
  // R-M paste za mešanje iz naše ponude: oznake i pakovanja potvrđeni prema etiketi (odluka vlasnika
  // 2026-10-13). Linija i naziv nijanse nisu potvrđeni zvaničnim izvorom, pa se ne navode. Redovi su u
  // `data/rm-sync/mixing-bases.json`; zamenjuje netačne ručne zapise „R-M Pasta 190 1 L / 5 L”.
  createProduct({
    slug: RM_PASTE_SLUG,
    name: "R-M paste za mešanje",
    brandSlug: "rm",
    programSlug: "boje-i-lakovi",
    phaseSlug: "boja",
    shortDescription: "Paste za mešanje nijansi iz naše ponude, po oznaci sa etikete i potvrđenom pakovanju.",
    longDescription:
      "R-M paste za mešanje koje vodimo u ponudi, navedene po oznaci sa etikete pakovanja (npr. BC 190, SC 403, CB 48V) i potvrđenom pakovanju. Nijansa se meša po formuli. Linija i naziv nijanse nisu potvrđeni zvaničnim izvorom proizvođača, pa se ne navode; za izbor paste obratite se kancelariji.",
    sku: RM_PASTE_SLUG,
    skuIsInternalOnly: true,
    // Jedan opisni zapis: pakovanje zavisi od oznake (red tabele), pa kartica ne sme da istakne jednu zapreminu.
    packages: [{ label: "po oznaci: 0,5 L, 1 L, 4 L ili bočica 125 ml" }],
    purpose: "Mešanje nijansi po formuli",
    badges: ["Mešna pasta", "Po oznaci sa etikete"],
    rmMetadata: { system: null, series: null, category: "basecoat", technology: null, finish: null },
    specifications: [
      { label: "Oznake", value: "po etiketi pakovanja (tabela varijanti)" },
      { label: "Pakovanja", value: "0,5 L, 1 L, 4 L; CB 48V u bočici 125 ml" },
    ],
    relatedProductSlugs: ["rm-diamont-bazna-boja"],
  }),
  // C.A.R.FIT Premium Soft Plus: porodica postoji samo u zvaničnom katalogu 2026 (str. 7), ne i na
  // carfitrepair.com, pa je sync ne uvozi (CATALOGUE_ONLY). Odluka vlasnika 2026-10-13: prodajemo 2-253-1800.
  {
    ...createProduct({
      slug: "carfit-premium-soft-plus-putty",
      // Kategorija izričito (odluka vlasnika 2026-10-15): oznake i program je nisu davali.
      taxonomyCategory: "kitovi",
      name: "Car Fit Premium Soft Plus Putty",
      brandSlug: "carfit",
      programSlug: "priprema-povrsine",
      phaseSlug: "priprema",
      shortDescription: "Kit za popunjavanje i fino kitovanje, sa učvršćivačem; lako se brusi i brzo suši.",
      longDescription:
        "Car Fit Premium Soft Plus je kit za popunjavanje i fino kitovanje koji prijanja na čelični lim, aluminijum, kalajisane površine i stakloplastiku. Kratko vreme sušenja i lako brušenje su njegove dodatne osobine. Na pocinkovanim površinama prijanjanje se razvija tek posle približno jednog sata.",
      sku: "2-253-1800",
      packages: [{ label: "1,8 kg sa učvršćivačem" }, { label: "4,7 kg sa učvršćivačem" }],
      purpose: "Popunjavanje i fino kitovanje",
      badges: ["Kit", "Sa učvršćivačem"],
      specifications: [
        { label: "Tip", value: "Kit za popunjavanje i fino kitovanje" },
        { label: "Podloge", value: "čelični lim, aluminijum, kalajisane površine, stakloplastika" },
        { label: "Boja", value: "bež" },
        { label: "Učvršćivač", value: "2–3 %", detail: "Katalog C.A.R.FIT 2026, str. 7" },
        { label: "Vreme obrade na 20 °C", value: "3–4 min", detail: "Katalog C.A.R.FIT 2026, str. 7" },
        { label: "Sušenje", value: "20 min na 20 °C · 5 min na 60 °C", detail: "Katalog C.A.R.FIT 2026, str. 7" },
      ],
      relatedProductSlugs: ["carfit-multi-soft-putty"],
    }),
    detail: {
      reviewStatus: "confirmed",
      variants: {
        reviewStatus: "confirmed",
        content: {
          title: "Varijante i šifre artikala",
          description: "Svaka varijanta ima zasebnu proizvođačku šifru. Dostupnost na domaćem tržištu proverava se kroz upit.",
          columns: [
            { key: "volume", label: "Pakovanje" },
            { key: "article", label: "Šifra artikla" },
            { key: "pack", label: "Fabričko pakovanje" },
            { key: "status", label: "Javni status" },
          ],
          rows: [
            { id: "2-253-1800", values: { volume: "1,8 kg sa učvršćivačem", article: "2-253-1800", pack: "6 kom.", status: "Na upit" }, reviewStatus: "confirmed" },
            { id: "2-253-4700", values: { volume: "4,7 kg sa učvršćivačem", article: "2-253-4700", pack: "2 kom.", status: "Na upit" }, reviewStatus: "confirmed" },
          ],
          note: "Šifre i fabrička pakovanja: zvanični katalog C.A.R.FIT 2026, str. 7.",
        },
      },
    },
  },
  // C.A.R.FIT nitril rukavice 6 MIL: linija postoji samo u zvaničnom katalogu 2026 (str. 74–75), ne i na
  // carfitrepair.com, pa je sync ne uvozi. Odluka vlasnika 2026-10-13: prodajemo L i XL, kutija 100 rukavica.
  {
    ...createProduct({
      slug: "carfit-nitrile-gloves-6-mil",
      // Kategorija izričito (odluka vlasnika 2026-10-15): oznake i program je nisu davali.
      taxonomyCategory: "zastita",
      name: "Car Fit Nitrile Gloves 6 MIL",
      brandSlug: "carfit",
      programSlug: "potrosni-materijal",
      phaseSlug: "priprema",
      shortDescription: "Profesionalne nitril rukavice debljine 6 MIL, u kutiji od 100 komada.",
      longDescription:
        "Car Fit Nitrile Gloves 6 MIL su profesionalne nitril rukavice za radionicu, u veličinama M, L, XL i XXL. Pakuju se u kutije od 100 rukavica.",
      sku: "3-260-0450",
      packages: [{ label: "kutija 100 rukavica" }],
      purpose: "Zaštita ruku u radionici",
      badges: ["Rukavice", "6 MIL", "100 kom."],
      specifications: [
        { label: "Materijal", value: "nitril" },
        { label: "Debljina", value: "6 MIL", detail: "Katalog C.A.R.FIT 2026, str. 74–75" },
        { label: "Pakovanje", value: "kutija 100 rukavica", detail: "Katalog C.A.R.FIT 2026, str. 74–75" },
      ],
      relatedProductSlugs: ["carfit-professional-nitrile-gloves"],
    }),
    detail: {
      reviewStatus: "confirmed",
      variants: {
        reviewStatus: "confirmed",
        content: {
          title: "Varijante i šifre artikala",
          description: "Svaka veličina ima zasebnu proizvođačku šifru. Dostupnost na domaćem tržištu proverava se kroz upit.",
          columns: [
            { key: "size", label: "Veličina" },
            { key: "article", label: "Šifra artikla" },
            { key: "pack", label: "Pakovanje" },
            { key: "status", label: "Javni status" },
          ],
          rows: [
            { id: "3-260-0350", values: { size: "Veličina M", article: "3-260-0350", pack: "kutija 100 kom.", status: "Na upit" }, reviewStatus: "confirmed" },
            { id: "3-260-0450", values: { size: "Veličina L", article: "3-260-0450", pack: "kutija 100 kom.", status: "Na upit" }, reviewStatus: "confirmed" },
            { id: "3-260-0550", values: { size: "Veličina XL", article: "3-260-0550", pack: "kutija 100 kom.", status: "Na upit" }, reviewStatus: "confirmed" },
            { id: "3-260-0650", values: { size: "Veličina XXL", article: "3-260-0650", pack: "kutija 100 kom.", status: "Na upit" }, reviewStatus: "confirmed" },
          ],
          note: "Šifre i pakovanje: zvanični katalog C.A.R.FIT 2026, str. 74–75.",
        },
      },
    },
  },
  // Yachtcare Epoxy Steelbond 125 g (odluka vlasnika 2026-10-13: identitet potvrđen u magacinu, 1 KOM = 125 g).
  // Podaci samo iz zvaničnog tehničkog lista „YC EPOXY STEELBOND“ (Vosschemie, v.2, 08/2017); bez slike (prava).
  createProduct({
    slug: "yachtcare-epoxy-steelbond-125g",
    // Kitovi (odluka vlasnika 2026-10-15, prema tehničkom listu v.2 08/2017): „Reparatur- und
    // Klebematerial”; prva namena je popunjavanje rupa i pukotina, „wie eine Spachtelmasse”.
    taxonomyCategory: "kitovi",
    name: "Yachtcare Epoxy Steelbond 125 g",
    brandSlug: "yachtcare",
    programSlug: "priprema-povrsine",
    phaseSlug: "priprema",
    shortDescription: "Dvokomponentna epoksi masa bez rastvarača za popravke i lepljenje metala, drveta i drugih materijala.",
    longDescription:
      "Yachtcare Epoxy Steelbond je dvokomponentni materijal za popravke i lepljenje na bazi epoksidne smole, bez rastvarača. Koristi se za popunjavanje rupa i pukotina, spajanje i zaptivanje čelika, aluminijuma, olova, drveta i drugih materijala, za „hladno zavarivanje“, oblikovanje i izolaciju. Komponente se mešaju u celini pakovanja.",
    sku: "YC-EPOXY-STEELBOND-125G",
    packages: [{ label: "pakovanje 125 g" }],
    purpose: "Popravke i lepljenje metala i drugih materijala",
    badges: ["2K epoksi", "125 g"],
    specifications: [
      { label: "Tip", value: "dvokomponentna epoksi masa, bez rastvarača" },
      { label: "Pakovanje", value: "125 g (osnova + učvršćivač)" },
      { label: "Boja", value: "osnova sivo-metalna, učvršćivač crveno-braon" },
      { label: "Vreme obrade na 20 °C", value: "oko 30 min" },
      { label: "Temperaturni opseg", value: "−50 °C do +180 °C" },
      { label: "Obrada posle", value: "oko 2 h na 20 °C (sloj 10 mm)" },
    ],
    relatedProductSlugs: [],
  }),
  // R-M proizvodi koje prodajemo, a nemaju stranicu na info.rmpaint.com (odluka vlasnika 2026-10-13: zasebne
  // kartice). Podaci su samo iz zvaničnih tehničkih listova na techinfo.rmpaint.com; pakovanje je naše prodajno.
  createProduct({
    slug: "rm-sc-850-thinner-medium",
    name: "R-M SC 850 THINNER",
    brandSlug: "rm",
    programSlug: "boje-i-lakovi",
    phaseSlug: "boja",
    shortDescription: "Srednji razređivač za UNO HD 2K pokrivni lak direktnog sjaja.",
    longDescription:
      "SC 850 je R-M razređivač srednje brzine. UNO HD tehnički list ga navodi kao razređivač za pripremu UNO HD pokrivnog laka (100 : 25 : 25 sa H 9000). Za male popravke i niske temperature tehnički list upućuje na brži SC 820, a za temperature iznad 25 °C i velike površine na sporiji SC 880.",
    sku: "SC 850",
    packages: [
      { label: "1 L", detail: "Pakovanje u našoj ponudi; proizvođač ne objavljuje zvanične veličine pakovanja." },
    ],
    purpose: "Razređivanje UNO HD pokrivnog laka i ONYX INTERIOR (A 2610) sistema",
    badges: ["Razređivač", "UNO HD", "1 L"],
    rmMetadata: { system: "uno-hd", series: null, category: "thinner", technology: null, finish: null },
    specifications: [
      { label: "Oznaka", value: "SC 850" },
      { label: "Vrsta", value: "Razređivač, srednji" },
      { label: "Sistem", value: "UNO HD" },
      { label: "Odnos mešanja (UNO HD)", value: "100 : 25 H 9000 : 25 SC 850 (vol.)", detail: "UNO HD TDS 08/2023; alternativa R 2200" },
      { label: "Brži / sporiji razređivač", value: "SC 820 / SC 880", detail: "SC 10 UNO HD TDS 03/2023" },
      { label: "Pakovanje", value: "1 L", detail: "Pakovanje u našoj ponudi; proizvođač ne objavljuje zvanične veličine pakovanja." },
    ],
    documents: [
      { title: "Tehnički list — SC 850 Thinner, medium", kind: "PDF", href: "https://techinfo.rmpaint.com/en_UK/documents/pdf/tech_infos/SC_850_Thinner_medium.pdf", status: "available", note: "Zvanični tehnički list (techinfo.rmpaint.com), verzija 07/2022" },
    ],
    relatedProductSlugs: ["rm-uno-hd", "rm-h-9000-hardener-medium", "rm-sm-09-special-mat-09", "rm-a-2610-onyx-interior"],
  }),
  createProduct({
    slug: "rm-h-9000-hardener-medium",
    name: "R-M H 9000 HARDENER",
    brandSlug: "rm",
    programSlug: "boje-i-lakovi",
    phaseSlug: "boja",
    shortDescription: "Srednji učvršćivač za UNO HD pokrivni lak i STARTOP HS lak; dodatak za DIAMONT.",
    longDescription:
      "H 9000 je R-M učvršćivač srednje brzine. Tehnički listovi ga navode kao učvršćivač za UNO HD pokrivni lak (100 : 25 : 25) i STARTOP HS (C 1450) lak (4 : 1 : 1). DIAMONT tehnički list propisuje dodatak 5 % H 9000 baznoj boji kada je potreban film deblji od 35 µm, a D 121 ULTRA FLASH FLAKE DIAMOND ga navodi među komponentama.",
    sku: "H 9000",
    packages: [
      { label: "1 L", detail: "Pakovanje u našoj ponudi; proizvođač ne objavljuje zvanične veličine pakovanja." },
    ],
    purpose: "Učvršćivanje UNO HD i STARTOP HS; dodatak DIAMONT baznoj boji za deblji film",
    badges: ["Učvršćivač", "UNO HD", "STARTOP HS", "1 L"],
    rmMetadata: { system: null, series: null, category: "hardener", technology: "2k", finish: null },
    specifications: [
      { label: "Oznaka", value: "H 9000" },
      { label: "Vrsta", value: "Učvršćivač, srednji" },
      { label: "UNO HD", value: "100 : 25 H 9000 : 25 SC 850 (vol.)", detail: "UNO HD TDS 08/2023" },
      { label: "STARTOP HS (C 1450)", value: "100 : 25 H 9000 : 25 BC 020/BC 030 (vol.)", detail: "STARTOP HS TDS 12/2022" },
      { label: "DIAMONT", value: "5 % H 9000 kada je film deblji od 35 µm", detail: "DIAMONT TDS 08/2023" },
      { label: "Pakovanje", value: "1 L", detail: "Pakovanje u našoj ponudi; proizvođač ne objavljuje zvanične veličine pakovanja." },
    ],
    documents: [
      { title: "Tehnički list — H 9000 Hardener, medium", kind: "PDF", href: "https://techinfo.rmpaint.com/en_UK/documents/pdf/tech_infos/H_9000_HARDENER.pdf", status: "available", note: "Zvanični tehnički list (techinfo.rmpaint.com), verzija 07/2022" },
    ],
    relatedProductSlugs: ["rm-uno-hd", "rm-c-1450-startop-hs", "rm-diamont-bazna-boja", "rm-d-121-ultra-flash-flake-diamond", "rm-sc-850-thinner-medium"],
  }),
  createProduct({
    slug: "rm-c-1450-startop-hs",
    name: "R-M STARTOP HS",
    brandSlug: "rm",
    programSlug: "boje-i-lakovi",
    phaseSlug: "lak",
    shortDescription: "Višenamenski MS bezbojni lak za DIAMONT i ONYX HD bazne boje, od pojedinačnih delova do celog vozila.",
    longDescription:
      "STARTOP HS (C 1450) je R-M višenamenski bezbojni lak srednjeg sadržaja suve materije (MS), namenjen za popravke od pojedinačnih delova do lakiranja celog vozila. Projektovan je za upotrebu preko DIAMONT i ONYX HD baznih boja. Meša se 4 : 1 : 1 sa učvršćivačem H 9000 i razređivačem BC 020 ili BC 030; vek upotrebe na 20 °C je 3 h.",
    sku: "C 1450",
    packages: [
      { label: "1 L", detail: "Pakovanje u našoj ponudi; proizvođač ne objavljuje zvanične veličine pakovanja." },
    ],
    purpose: "Završni bezbojni lak preko DIAMONT i ONYX HD baznih boja",
    badges: ["Bezbojni lak", "MS", "4:1:1", "1 L"],
    rmMetadata: { system: null, series: null, category: "clearcoat", technology: "2k", finish: "gloss" },
    specifications: [
      { label: "Oznaka", value: "C 1450" },
      { label: "Vrsta", value: "MS bezbojni lak" },
      { label: "Za bazne boje", value: "DIAMONT, ONYX HD" },
      { label: "Odnos mešanja", value: "4 : 1 : 1 — 100 C 1450 : 25 H 9000 : 25 BC 020/BC 030 (vol.)", detail: "po težini 100 : 27 : 22 g" },
      { label: "Vek upotrebe na 20 °C", value: "3 h" },
      { label: "Viskozitet", value: "DIN 4: 15–17 s · ISO 4: 28–34 s" },
      { label: "Suva materija", value: "42 % ± 2" },
      { label: "Mlaznica", value: "1,3 (HVLP) · 1,3–1,4 (kompatibilni)" },
      { label: "Broj slojeva", value: "2" },
      { label: "Debljina filma", value: "50–60 µm" },
      { label: "Sušenje", value: "20 °C: 5 h (bez prašine posle 1 h, potpuno posle 24 h) · 60 °C: 30 min · IR kratki talas: 8 min" },
      { label: "Rok trajanja", value: "36 meseci" },
      { label: "Pakovanje", value: "1 L", detail: "Pakovanje u našoj ponudi; proizvođač ne objavljuje zvanične veličine pakovanja." },
    ],
    documents: [
      { title: "Tehnički list — C 1450 STARTOP HS", kind: "PDF", href: "https://techinfo.rmpaint.com/en_UK/documents/pdf/tech_infos/STARTOP_HS.pdf", status: "available", note: "Zvanični tehnički list (techinfo.rmpaint.com), verzija 12/2022" },
      { title: "Tehnički list — C 1450 STARTOP HS — varijanta SPECIAL MAT 09", kind: "PDF", href: "https://techinfo.rmpaint.com/en_UK/documents/pdf/tech_infos/C_1450_STARTOP_HS_Variant_SPECIAL_MAT_09.pdf", status: "available", note: "Zvanični tehnički list (techinfo.rmpaint.com), verzija 12/2022" },
    ],
    relatedProductSlugs: ["rm-h-9000-hardener-medium", "rm-bc-020-thinner", "rm-bc-030-thinner", "rm-diamont-bazna-boja", "rm-onyx-hd", "rm-sm-09-special-mat-09"],
  }),
  createProduct({
    slug: "rm-sm-09-special-mat-09",
    name: "R-M SPECIAL MAT 09",
    brandSlug: "rm",
    programSlug: "boje-i-lakovi",
    phaseSlug: "lak",
    shortDescription: "Pasta za matiranje R-M pokrivnih lakova za pune boje i bezbojnih lakova.",
    longDescription:
      "SPECIAL MAT 09 (SM 09) je R-M pasta za matiranje kojom se smanjuje stepen sjaja R-M pokrivnih lakova za pune boje i bezbojnih lakova. Dodaje se prema recepturi (moguće u kombinaciji sa MT 900) ili u željenoj meri pri matiranju sjajnog laka; zatim se dodaju učvršćivač i razređivač prema tehničkom listu laka koji se podešava. Ne koristi se u mešačkoj mašini, dobro se promeša pre upotrebe i skraćuje vek upotrebe laka.",
    sku: "SM 09",
    packages: [
      { label: "1 L", detail: "Pakovanje u našoj ponudi; proizvođač ne objavljuje zvanične veličine pakovanja." },
    ],
    purpose: "Smanjenje sjaja pokrivnih i bezbojnih R-M lakova",
    badges: ["Matiranje", "UNO HD", "Bezbojni lakovi", "1 L"],
    rmMetadata: { system: "uno-hd", series: null, category: "additive", technology: null, finish: "matte" },
    specifications: [
      { label: "Oznaka", value: "SM 09" },
      { label: "Vrsta", value: "Pasta za matiranje" },
      { label: "Kompatibilnost", value: "svi R-M bezbojni lakovi; pokrivni lakovi UNO HD, UNO HD CP, UNO HD CP PLUS", detail: "C 1450 STARTOP HS variant SPECIAL MAT 09, 12/2022" },
      { label: "Doziranje", value: "prema recepturi ili do željenog stepena mata; najviše 70 % težinski", detail: "maksimum 70 % iz TDS-a C 1450 variant SPECIAL MAT 09" },
      { label: "Primer predmešavine (STARTOP HS)", value: "50 C 1450 : 50 SM 09 (vol.), zatim 100 : 25 H 9000 : 25 BC 020" },
      { label: "VOC", value: "839 g/l (EU kategorija IIB.e, granica 840 g/l)" },
      { label: "Suva materija", value: "31 % ± 2" },
      { label: "Gustina", value: "0,94–1,04 g/cm³" },
      { label: "Rok trajanja", value: "24 meseca", detail: "SPECIAL MAT 09 TDS 07/2022" },
      { label: "Pakovanje", value: "1 L", detail: "Pakovanje u našoj ponudi; proizvođač ne objavljuje zvanične veličine pakovanja." },
    ],
    documents: [
      { title: "Tehnički list — SM 09 SPECIAL MAT 09", kind: "PDF", href: "https://techinfo.rmpaint.com/en_UK/documents/pdf/tech_infos/SPECIAL_MAT_09.pdf", status: "available", note: "Zvanični tehnički list (techinfo.rmpaint.com), verzija 07/2022" },
      { title: "Tehnički list — SM 09 UNO HD varijanta SPECIAL MAT 09", kind: "PDF", href: "https://techinfo.rmpaint.com/en_UK/documents/pdf/tech_infos/UNO_HD_Variant_SPECIAL_MAT_09.pdf", status: "available", note: "Zvanični tehnički list (techinfo.rmpaint.com), verzija 08/2023" },
    ],
    relatedProductSlugs: ["rm-uno-hd", "rm-c-1450-startop-hs", "rm-h-9000-hardener-medium", "rm-sc-850-thinner-medium"],
  }),
  createProduct({
    slug: "rm-c-1150-basic-clear",
    name: "R-M BASIC CLEAR",
    brandSlug: "rm",
    programSlug: "boje-i-lakovi",
    phaseSlug: "lak",
    shortDescription: "Bezbojni lak za sve procese reparaturnog lakiranja, preko vodenih i rastvaračkih baznih boja.",
    longDescription:
      "BASIC CLEAR (C 1150) je R-M bezbojni lak pogodan za sve procese reparaturnog lakiranja vozila, namenjen za nanošenje preko vodenih i rastvaračkih baznih boja. Meša se 2 : 1 sa učvršćivačem H 1150 BASIC HARDENER; vek upotrebe na 20 °C je 4 h.",
    sku: "C 1150",
    packages: [
      { label: "1 L", detail: "Pakovanje u našoj ponudi; proizvođač ne objavljuje zvanične veličine pakovanja." },
    ],
    purpose: "Završni bezbojni lak preko vodenih i rastvaračkih baznih boja",
    badges: ["Bezbojni lak", "2:1", "1 L"],
    rmMetadata: { system: null, series: null, category: "clearcoat", technology: "2k", finish: "gloss" },
    specifications: [
      { label: "Oznaka", value: "C 1150" },
      { label: "Vrsta", value: "Bezbojni lak" },
      { label: "Za bazne boje", value: "vodene i rastvaračke" },
      { label: "Odnos mešanja", value: "2 : 1 — 100 C 1150 : 50 H 1150 (vol.)" },
      { label: "Vek upotrebe na 20 °C", value: "4 h" },
      { label: "Viskozitet", value: "DIN 4: 14–16 s · ISO 4: 24–26 s" },
      { label: "Suva materija", value: "40 % ± 2" },
      { label: "Mlaznica", value: "1,3 (HVLP) · 1,3–1,4 (kompatibilni)" },
      { label: "Broj slojeva", value: "2" },
      { label: "Debljina filma", value: "50 µm" },
      { label: "Sušenje", value: "60 °C: 30 min · IR kratki talas: 8 min" },
      { label: "Rok trajanja", value: "60 meseci" },
      { label: "Pakovanje", value: "1 L", detail: "Pakovanje u našoj ponudi; proizvođač ne objavljuje zvanične veličine pakovanja." },
    ],
    documents: [
      { title: "Tehnički list — C 1150 BASIC CLEAR", kind: "PDF", href: "https://techinfo.rmpaint.com/en_UK/documents/pdf/tech_infos/BASIC_CLEAR.pdf", status: "available", note: "Zvanični tehnički list (techinfo.rmpaint.com), verzija 12/2022" },
    ],
    relatedProductSlugs: ["rm-h-1150-basic-hardener", "rm-diamont-bazna-boja", "rm-onyx-hd"],
  }),
  createProduct({
    slug: "rm-h-1150-basic-hardener",
    name: "R-M BASIC HARDENER",
    brandSlug: "rm",
    programSlug: "boje-i-lakovi",
    phaseSlug: "lak",
    shortDescription: "Učvršćivač za BASIC CLEAR (C 1150) i BASIC FILLER II CP (P 2130).",
    longDescription:
      "BASIC HARDENER (H 1150) je R-M učvršćivač koji se koristi u bezbojnom laku C 1150 BASIC CLEAR i punilu P 2130 BASIC FILLER II CP. Sa BASIC CLEAR se meša u odnosu 2 : 1 (100 delova laka : 50 delova učvršćivača).",
    sku: "H 1150",
    packages: [
      { label: "0,5 L", detail: "Pakovanje u našoj ponudi; proizvođač ne objavljuje zvanične veličine pakovanja." },
    ],
    purpose: "Učvršćivač za BASIC CLEAR i BASIC FILLER II CP",
    badges: ["Učvršćivač", "BASIC", "0,5 L"],
    rmMetadata: { system: null, series: null, category: "hardener", technology: "2k", finish: null },
    specifications: [
      { label: "Oznaka", value: "H 1150" },
      { label: "Vrsta", value: "Učvršćivač" },
      { label: "Koristi se u", value: "C 1150 BASIC CLEAR, P 2130 BASIC FILLER II CP" },
      { label: "Odnos sa C 1150", value: "100 C 1150 : 50 H 1150 (vol.)", detail: "BASIC CLEAR TDS 12/2022" },
      { label: "Pakovanje", value: "0,5 L", detail: "Pakovanje u našoj ponudi; proizvođač ne objavljuje zvanične veličine pakovanja." },
    ],
    documents: [
      { title: "Tehnički list — H 1150 BASIC HARDENER", kind: "PDF", href: "https://techinfo.rmpaint.com/en_UK/documents/pdf/tech_infos/H_1150_BASIC_HARDENER.pdf", status: "available", note: "Zvanični tehnički list (techinfo.rmpaint.com), verzija 08/2022" },
    ],
    relatedProductSlugs: ["rm-c-1150-basic-clear"],
  }),
  ...befarPadProducts,
  ...cosmosLacProducts,
  archivedProduct("satajet-x-5500"),
  // SATA EMEA REFINISH FAMILY SCOPE sa sata.com (`npm run sata:sync`): jedna zvanična porodica =
  // jedna kartica, brojevi artikala su redovi. `satajet-x-5500` iznad se NE duplira — dopunjuje ga
  // `applySataSyncEnrichment`.
  ...getSataCatalogProducts(),
];

function withCatalogArchitecture(product: CarsystemProduct): CarsystemProduct {
  if (product.family && product.catalogStrategy) return product;

  const catalogStrategy: ProductCatalogStrategy =
    product.brandSlug === "rm" || product.brandSlug === "baslac"
      ? "family-card"
      : product.catalogStrategy ?? "family-card";

  return {
    ...product,
    catalogStrategy,
    family:
      product.family ??
      ({
        id: product.slug,
        label: product.name,
        catalogStrategy,
      } satisfies ProductFamilyIdentity),
  };
}

/**
 * Konačni katalog.
 *
 * Poslednji korak je kontrolisano obogaćivanje generisanih Baslac zapisa
 * (`lib/baslac-enrichment.ts`). Radi se tek ovde jer preporuke pokazuju i na
 * proizvode definisane u ovom fajlu, pa se validnost sluga može proveriti tek
 * kad je ceo skup poznat. Enrichment ne može da promeni identitet — vidi
 * ograničenja tipa `BaslacEnrichment`.
 */
/**
 * Uklonjeno iz customer-facing kataloga (odluka vlasnika, `data/catalog/removed-from-customer-catalog.json`).
 *
 * Filtrira se OVDE, na jednom mestu kroz koje prolaze i ručni zapisi i svi sync adapteri, pa nijedan
 * brend ne mora da nosi sopstvenu logiku uklanjanja. Sync dataseti se ne diraju — zapis ostaje kao
 * istorijski podatak, tačno kao kod Molotow uklanjanja (`REMOVED_FROM_CUSTOMER_CATALOG`).
 */
const removedSlugs = new Set(removedFromCustomerCatalog.records.map((record) => record.slug));

/**
 * Slike koje je dostavio vlasnik (`data/catalog/image-supply/supplied-images.json`).
 *
 * Primenjuju se ovde, uz filtriranje uklonjenih zapisa, jer je ovo jedina tačka kroz koju prolaze i
 * ručni zapisi i svi sync adapteri — pa nijedan brend ne mora da nosi sopstvenu logiku, a generisani
 * dataseti ostaju netaknuti. Zamenjuje se ISKLJUČIVO adresa slike; naziv, šifra, pakovanje i svaki
 * drugi podatak o proizvodu ostaju kakvi jesu.
 *
 * Opseg iz registra bira gde slika ide:
 *   CARD / VARIANT — `productImage` tog zapisa;
 *   ARTICLE        — slika JEDNOG reda u tabeli šifara (ostali redovi se ne diraju);
 *   FAMILY         — jedna slika serije: lice porodice i zapisi koji nose `packshotKind: family`.
 *                    Tako 69 tonera deli jedan fajl umesto da se prave 69 kopija iste slike.
 */
/** Vrednosti porekla definisane u `provenanceModel` registra (proverava `catalog:image-supply:check`). */
export type SuppliedImageSourceBasis =
  | "OWNER_SUPPLIED"
  | "SUPPLIER_BRAND_PORTAL"
  | "DISTRIBUTOR_HOSTED_MANUFACTURER_RENDER"
  | "MANUFACTURER_WEBSITE_IMAGE";

type SuppliedImageEntry = {
  imageId: string;
  brand: string;
  scope: "CARD" | "VARIANT" | "ARTICLE" | "FAMILY";
  slug: string;
  rowId?: string;
  sharedAcrossFamily?: string;
  path: string;
  sourceBasis: SuppliedImageSourceBasis;
  rightsBasis?: string;
  /** Naziv dostavljenog izvora; sufiks „__1l” kaže u kojoj je zapremini fotografisan. */
  sourceFile?: string;
  /** Opis konkretne slike; bez njega ostaje alt zapisa. */
  alt?: string;
};

/*
 * Slika čije pravo objave još nije potvrđeno vidi se lokalno i na Preview-u, ali ne na Production
 * (`lib/supplied-image-rights.mjs`); tamo zapis zadržava svoj placeholder.
 */
const suppliedEntries = (suppliedImages.images as SuppliedImageEntry[]).filter((entry) =>
  suppliedImageAllowed(entry, process.env.VERCEL_ENV),
);
const suppliedByRecord = new Map(suppliedEntries.filter((entry) => !entry.rowId).map((entry) => [entry.slug, entry]));
const suppliedByRow = new Map(suppliedEntries.filter((entry) => entry.rowId).map((entry) => [`${entry.slug} ${entry.rowId}`, entry]));
const suppliedFamilyPackshot = new Map(
  suppliedEntries
    .filter((entry): entry is SuppliedImageEntry & { sharedAcrossFamily: string } => Boolean(entry.sharedAcrossFamily))
    .map((entry) => [entry.sharedAcrossFamily, entry]),
);

/**
 * Veze ka zapisima koje katalog više ne prikazuje.
 *
 * Preporuke i „koristi se zajedno sa” dolaze iz sync dataseta, koji uklonjene proizvode LEGITIMNO
 * i dalje sadrži — provenance se čuva. Zato se veza gasi ovde, na istom mestu gde se zapis i
 * filtrira: dodavanje sluga u registar automatski uklanja i svaki link ka njemu, pa mrtva veza ne
 * može da preživi ni u jednom brendu.
 */
function withoutRemovedReferences(product: CarsystemProduct): CarsystemProduct {
  const related = (product.relatedProductSlugs ?? []).filter((slug) => !removedSlugs.has(slug));
  const sections = Object.entries(product.detail ?? {}).filter(
    ([, section]) =>
      Array.isArray((section as { content?: { items?: { productSlug?: string }[] } })?.content?.items) &&
      (section as { content: { items: { productSlug?: string }[] } }).content.items.some((item) => item.productSlug && removedSlugs.has(item.productSlug)),
  );
  if (related.length === (product.relatedProductSlugs ?? []).length && !sections.length) return product;

  return {
    ...product,
    relatedProductSlugs: related,
    ...(sections.length && product.detail
      ? {
          detail: {
            ...product.detail,
            ...Object.fromEntries(
              sections.map(([key, section]) => {
                const typed = section as { content: { items: { productSlug?: string }[] } };
                return [key, { ...typed, content: { ...typed.content, items: typed.content.items.filter((item) => !item.productSlug || !removedSlugs.has(item.productSlug)) } }];
              }),
            ),
          },
        }
      : {}),
  };
}

/**
 * Porodični packshot koji je fotografisan u jednoj zapremini (naziv izvora „…__1l.png”) ne sme da
 * zameni fotografiju DRUGE zapremine koju zapis već ima (slot sistemske strane, 2026-10-23).
 * Zapis bez slike (placeholder) ga i dalje dobija.
 */
function sharedFitsVolume(shared: { sourceFile?: string }, product: CarsystemProduct): boolean {
  const match = /__(\d+(?:[.,]\d+)?)l\.(?:png|jpe?g|webp)$/i.exec(shared.sourceFile ?? "");
  if (!match) return true;
  if (!product.productImage?.src || /placeholder/i.test(product.productImage.src)) return true;
  const sharedLitres = Number(match[1].replace(",", "."));
  const volume = /([\d.,]+)\s*l\b/i.exec(String(product.catalogMetadata?.volume ?? product.packages?.[0]?.label ?? ""));
  return !volume || Number(volume[1].replace(",", ".")) === sharedLitres;
}

function withSuppliedImage(product: CarsystemProduct): CarsystemProduct {
  const shared = suppliedFamilyPackshot.get(product.catalogMetadata?.baseProductSlug ?? "");
  const own =
    suppliedByRecord.get(product.slug) ??
    // Zapis koji deli porodični packshot dobija sliku serije; zapis sa sopstvenom slikom se ne dira.
    (shared && product.visualIdentity?.packshotKind === "family" && sharedFitsVolume(shared, product) ? shared : undefined);
  const rows = product.detail?.variants?.content.rows ?? [];
  const rowEntries = rows.map((row) => suppliedByRow.get(`${product.slug} ${row.id}`));
  if (!own && !rowEntries.some(Boolean)) return product;

  return {
    ...product,
    ...(own ? { productImage: { src: own.path, alt: own.alt ?? product.productImage?.alt ?? product.name } } : {}),
    ...(rowEntries.some(Boolean) && product.detail
      ? {
          detail: {
            ...product.detail,
            variants: {
              ...product.detail.variants!,
              content: {
                ...product.detail.variants!.content,
                rows: rows.map((row, index) => (rowEntries[index] ? { ...row, image: rowEntries[index]!.path } : row)),
              },
            },
          },
        }
      : {}),
  };
}

/**
 * Ispravke javne kategorije po artiklu (2026-10-20) — data/catalog/category-overrides.json.
 * Svaka ispravka nosi razlog i izvor (kategorija proizvođača); sync podaci ostaju netaknuti.
 */
const categoryOverrideBySlug = new Map(
  (categoryOverrides.records as { slug: string; category: string }[]).map((record) => [
    record.slug,
    record.category,
  ]),
);

function withCategoryOverride(product: CarsystemProduct): CarsystemProduct {
  const category = categoryOverrideBySlug.get(product.slug);
  return category ? { ...product, taxonomyCategory: category } : product;
}

const architecturedProducts = productRecords
  .filter((product) => !removedSlugs.has(product.slug))
  .map(withCatalogArchitecture);
const knownProductSlugs = new Set(architecturedProducts.map((product) => product.slug));

assertBaslacEnrichmentKeys(
  architecturedProducts
    .filter((product) => product.brandSlug === "baslac")
    .map((product) => product.slug),
);

export const products: CarsystemProduct[] = architecturedProducts.map((product) =>
  product.brandSlug === "baslac"
    ? // Dopuna sa zvaničnog izvora ide POSLE dosijea: sync zna aktuelni tehnički list.
      applyBaslacSyncEnrichment(
        applyBaslacEnrichment(product, (slug) => knownProductSlugs.has(slug)),
      )
    : product.brandSlug === "carsystem"
      ? applyCarsystemCatalogEnrichment(product)
      : product.brandSlug === "carfit"
        ? applyCarfitCatalogEnrichment(product)
        : product.brandSlug === "rm"
          ? withRmMixingBases(applyRmCatalogEnrichment(product))
          : product.brandSlug === "norbin"
            ? applyNorbinSyncEnrichment(product)
            : product.brandSlug === "sata"
              ? applySataSyncEnrichment(product)
              : product,

)
  .map(withoutRemovedReferences)
  .map(withCategoryOverride)
  .map(withSuppliedImage)
  // Poslednji korak: decimalni zarez u srpskim opisima mera (samo prikaz, vidi modul).
  .map(withSerbianMeasureDisplay);

export function getAllCarsystemProducts() {
  return [...products];
}

/**
 * Keeps listing routes on the shared Carsystem product model while avoiding
 * serialization of detail-only specifications, documents and relations into
 * client-side catalog bundles.
 */
export function toProductListingProduct(product: CarsystemProduct): CarsystemProduct {
  return {
    slug: product.slug,
    name: product.name,
    brandSlug: product.brandSlug,
    programSlug: product.programSlug,
    phaseSlug: product.phaseSlug,
    ...(product.secondaryPhaseSlugs ? { secondaryPhaseSlugs: product.secondaryPhaseSlugs } : {}),
    ...(product.phaseUnconfirmed ? { phaseUnconfirmed: true as const } : {}),
    shortDescription: product.shortDescription,
    longDescription: product.longDescription,
    sku: product.sku,
    // Pravilo javne šifre (`publicSkuOf`, `publicCode`) mora da važi i u listing prikazima.
    ...(product.skuIsInternalOnly ? { skuIsInternalOnly: true } : {}),
    ...(product.publicCode ? { publicCode: product.publicCode } : {}),
    packages: product.packages,
    purpose: product.purpose,
    badges: product.badges,
    publicStatus: product.publicStatus,
    stockStatus: product.stockStatus,
    stockManaged: product.stockManaged,
    productImage: product.productImage,
    galleryImages: [],
    specifications: [],
    documents: [],
    relatedProductSlugs: [],
    catalogMetadata: product.catalogMetadata,
    rmMetadata: product.rmMetadata,
    taxonomyCategory: product.taxonomyCategory,
    manufacturerColor: product.manufacturerColor,
    visual: product.visual,
    family: product.family,
    catalogStrategy: product.catalogStrategy,
    variantId: product.variantId,
    variantOptions: product.variantOptions,
  };
}

export function getAllCarsystemBrands() {
  return [...brands].sort(
    (first, second) => first.catalogOrder - second.catalogOrder,
  );
}

/**
 * Brendovi koji imaju svoju stranicu i mesto u listama (meni, podnožje, /brendovi, katalog,
 * sitemap). Brend ponuđen u okviru drugog (`offeredWithin`) ostaje dostupan preko
 * `getAllCarsystemBrands()` za oznake proizvođača na proizvodima.
 */
export function getListedCarsystemBrands() {
  return getAllCarsystemBrands().filter((brand) => !brand.offeredWithin);
}

export function getAllPublicProgramGroups() {
  return [...publicProgramGroups];
}

/**
 * Pakovanje koje se prikazuje kupcu za JEDAN proizvod/varijantu.
 *
 * Jedino mesto odluke za oba mesta na kojima PDP ispisuje „Pakovanje" aktivne varijante. Bez
 * `customerPackage` vraća tačno ono što je vraćalo i ranije, pa se nijedan drugi brend ne menja.
 */
export function getProductPackageLabel(product: CarsystemProduct): string | undefined {
  return (
    product.catalogMetadata?.customerPackage ??
    product.catalogMetadata?.volume ??
    product.packages[0]?.label
  );
}

export function getCarsystemProductBySlug(slug: string) {
  return products.find((product) => product.slug === slug);
}

function getPrimaryVariantColumn(columns: ProductVariantColumn[]) {
  const priority = [
    "color",
    "shade",
    "grit",
    "hardness",
    "size",
    "volume",
    "speed",
    "pack",
  ];

  return (
    priority
      .map((key) => columns.find((column) => column.key === key))
      .find((column): column is ProductVariantColumn => Boolean(column)) ?? columns[0]
  );
}

function getVariantSectionTitle(key: string, fallback: string) {
  const titles: Record<string, string> = {
    color: "Dostupne boje",
    shade: "Modeli i nijanse",
    grit: "Granulacije",
    hardness: "Dostupne tvrdoće",
    size: "Dimenzije",
    volume: "Pakovanja",
    pack: "Pakovanja",
  };

  return titles[key] ?? fallback;
}

function getReviewedDetailVariantSelector(
  product: CarsystemProduct,
): ProductVariantSelectorSection | undefined {
  const reviewed = product.detail?.variants;
  if (
    product.detail?.reviewStatus !== "confirmed" ||
    reviewed?.reviewStatus !== "confirmed"
  ) {
    return undefined;
  }

  const rows = reviewed.content.rows.filter(
    (row) => row.reviewStatus === "confirmed",
  );
  const primaryColumn = getPrimaryVariantColumn(reviewed.content.columns);
  if (!primaryColumn || rows.length < 2 || !product.family) return undefined;

  const dimension = product.specifications.find(
    (fact) => fact.label.toLocaleLowerCase("sr-Latn") === "prečnik",
  )?.value;

  return {
    title: getVariantSectionTitle(primaryColumn.key, reviewed.content.title),
    description: reviewed.content.description,
    family: product.family,
    groups: [
      {
        id: primaryColumn.key,
        label: primaryColumn.label,
        kind: primaryColumn.key === "color" ? "color" : "text",
        options: rows.map((row) => ({
          id: row.id,
          label: row.values[primaryColumn.key] || row.id,
          code: row.values.article,
          swatch: row.swatch,
          swatchFinish: row.swatchFinish,
          image: row.image,
        })),
      },
    ],
    variants: rows.map((row) => ({
      id: row.id,
      label: row.values[primaryColumn.key] || row.id,
      optionValueIds: { [primaryColumn.key]: row.id },
      sku: row.values.article ?? row.id,
      package: row.values.pack,
      dimension,
      status: row.values.status,
      slug: row.slug,
      image: row.image,
      reviewStatus: "confirmed",
    })),
    initialVariantId: rows.find((row) => row.isActive)?.id ?? rows[0].id,
    note: reviewed.content.note,
  };
}

/**
 * Statusi pod kojima varijanta sme u selektor.
 *
 * Spisak je eksplicitan, a ne „sve što nije odbijeno": nepotvrđena varijanta u
 * biraču izgleda kao ponuda, a nije. Cosmos i Baslac koriste različite oznake
 * istog značenja, pa su obe navedene — bez provere po brendu.
 */
const SELECTABLE_VARIANT_STATUSES = new Set([
  "verified-official-source",
  "ACTIVE_CONFIRMED",
]);

/**
 * Selektor varijanti za bilo koju porodicu iz `catalogMetadata.baseProductSlug`.
 *
 * Namerno bez ijedne provere po brendu. Porodica je pojam kataloga, ne Cosmosa —
 * Baslac pripremni proizvodi (isti artikal u 1 L i 4 L) su ista struktura i
 * dobijaju isti birač. Identitet porodice se uzima iz proizvoda kada ga ima, a
 * inače se izvodi iz `catalogMetadata`, pa porodica ne mora unapred da nosi
 * `family` blok da bi imala biranje varijante.
 */
function getFamilyVariantSelector(
  product: CarsystemProduct,
): ProductVariantSelectorSection | undefined {
  const metadata = product.catalogMetadata;
  const familyId = metadata?.baseProductSlug;
  if (!familyId) return undefined;

  const familyProducts = products.filter(
    (item) =>
      item.catalogMetadata?.baseProductSlug === familyId &&
      SELECTABLE_VARIANT_STATUSES.has(item.catalogMetadata.verificationStatus),
  );
  if (familyProducts.length < 2) return undefined;

  /*
   * Prava porodica, a ne ona sintetizovana po proizvodu.
   *
   * `withCatalogArchitecture` svakom proizvodu bez porodice dodeli zamenu oblika
   * `{ id: slug, label: name }`. To je identitet JEDNOG proizvoda — kada bi se
   * upotrebio kao oznaka porodice, zaglavlje selektora bi nosilo naziv i
   * pakovanje reprezentativne varijante („… Grey 1 L") i ostalo bi takvo i
   * pošto korisnik izabere 4 L. Zamena se prepoznaje po tome što joj je `id`
   * jednak slugu proizvoda.
   */
  const declaredFamily =
    product.family && product.family.id !== product.slug ? product.family : null;

  const family: ProductFamilyIdentity = declaredFamily ?? {
    id: familyId,
    // `officialName` je naziv bez pakovanja — zajednički svim članovima.
    label: metadata?.officialName ?? metadata?.line ?? product.name,
    catalogStrategy: product.catalogStrategy ?? "hybrid",
  };

  const hasNamedColors = familyProducts.some(
    (item) => item.catalogMetadata?.colorName || item.catalogMetadata?.ralCode,
  );
  const groupId = "variant";

  return {
    title: hasNamedColors ? "Dostupne boje" : "Dostupne varijante",
    description: `${family.label}: sve varijante na jednom mestu.`,
    family,
    groups: [
      {
        id: groupId,
        label: hasNamedColors ? "Boja i završnica" : "Varijanta",
        kind: hasNamedColors ? "color" : "image",
        options: familyProducts.map((item) => {
          const metadata = item.catalogMetadata;
          const finish = metadata?.finish ? ` · ${metadata.finish}` : "";
          return {
            id: item.variantId ?? item.slug,
            label:
              metadata?.colorName ??
              (metadata?.ralCode
                ? `RAL ${metadata.ralCode}`
                : // Porodice koje se razlikuju po pakovanju biraju se po
                  // zapremini; naziv proizvoda je za sve članove isti.
                  (metadata?.volume ?? item.name)),
            code: [
              metadata?.cosmosCode,
              metadata?.ralCode ? `RAL ${metadata.ralCode}` : undefined,
            ]
              .filter(Boolean)
              .join(" · ") + finish,
            swatch: item.visual?.backgroundColor,
            image: item.productImage?.src,
          };
        }),
      },
    ],
    variants: familyProducts.map((item) => ({
      id: item.variantId ?? item.slug,
      label:
        item.catalogMetadata?.colorName ??
        (item.catalogMetadata?.ralCode
          ? `RAL ${item.catalogMetadata.ralCode}`
          : item.catalogMetadata?.cosmosCode ??
            item.catalogMetadata?.volume ??
            item.name),
      optionValueIds: { [groupId]: item.variantId ?? item.slug },
      sku: item.catalogMetadata?.cosmosCode ?? item.publicCode ?? publicSkuOf(item) ?? undefined,
      package: getProductPackageLabel(item),
      status: getProductPublicStatus(item),
      slug: item.slug,
      image: item.productImage?.src,
      reviewStatus: "confirmed",
    })),
    initialVariantId: product.variantId ?? product.slug,
  };
}

function getBefarVariantSelector(
  product: CarsystemProduct,
): ProductVariantSelectorSection | undefined {
  if (product.family?.id !== "befar-polishing-pads") return undefined;

  const familyProducts = products.filter(
    (item) => item.family?.id === product.family?.id && item.variantOptions,
  );
  if (familyProducts.length < 2) return undefined;

  const uniqueBy = (key: "color" | "size") =>
    familyProducts.filter(
      (item, index, all) =>
        all.findIndex(
          (candidate) => candidate.variantOptions?.[key] === item.variantOptions?.[key],
        ) === index,
    );

  return {
    title: "Dostupne boje i dimenzije",
    family: product.family,
    groups: [
      {
        id: "color",
        label: "Boja i namena",
        kind: "color",
        options: uniqueBy("color").map((item) => ({
          id: `color:${item.variantOptions?.color}`,
          label: item.variantOptions?.color ?? "Varijanta",
          detail: item.variantOptions?.role,
          swatch: item.variantOptions?.colorSwatch,
          image: item.productImage?.src,
        })),
      },
      {
        id: "size",
        label: "Dimenzija",
        kind: "text",
        options: uniqueBy("size").map((item) => ({
          id: `size:${item.variantOptions?.size}`,
          label: item.variantOptions?.size ?? "Dimenzija",
        })),
      },
    ],
    variants: familyProducts.map((item) => ({
      id: item.variantId ?? item.slug,
      label: [item.variantOptions?.color, item.variantOptions?.size]
        .filter(Boolean)
        .join(" · "),
      optionValueIds: {
        color: `color:${item.variantOptions?.color}`,
        size: `size:${item.variantOptions?.size}`,
      },
      sku: item.publicCode ?? publicSkuOf(item) ?? undefined,
      package: item.packages[0]?.label,
      dimension: item.variantOptions?.size,
      status: getProductPublicStatus(item),
      slug: item.slug,
      image: item.productImage?.src,
      reviewStatus: "confirmed",
    })),
    initialVariantId: product.variantId ?? product.slug,
  };
}

export function getProductVariantSelector(
  product: CarsystemProduct,
): ProductVariantSelectorSection | undefined {
  return (
    getReviewedDetailVariantSelector(product) ??
    getFamilyVariantSelector(product) ??
    getBefarVariantSelector(product)
  );
}

export function getCarsystemBrandBySlug(slug: string) {
  return brands.find((brand) => brand.slug === slug);
}

export function getProgramGroupBySlug(slug: string) {
  return programGroups.find((program) => program.slug === slug);
}

export function getPublicProgramGroupBySlug(slug: string) {
  return publicProgramGroups.find((program) => program.slug === slug);
}

export function getFutureBrandBySlug(slug: string) {
  return futureBrands.find((brand) => brand.slug === slug);
}

export function getBrandReferenceBySlug(slug: string) {
  const brand = getCarsystemBrandBySlug(slug);
  if (brand) return { ...brand, status: "active" as const } satisfies BrandReference;

  return getFutureBrandBySlug(slug);
}

export function getCarsystemProductsByBrandSlug(brandSlug: string) {
  return products.filter((product) => product.brandSlug === brandSlug);
}

export function getCarsystemProductsByProgramSlugs(programSlugs: string[]) {
  const allowedProgramSlugs = new Set(programSlugs);
  return products.filter((product) => allowedProgramSlugs.has(product.programSlug));
}

export function getCarsystemProductsByPublicProgramSlug(slug: string) {
  const program = getPublicProgramGroupBySlug(slug);
  if (!program) return [];

  return getCarsystemProductsByProgramSlugs(program.internalProgramSlugs);
}

export function getPublicProgramGroupsForBrand(brandSlug: string) {
  const brand = getCarsystemBrandBySlug(brandSlug);
  const brandPrograms = new Set(brand?.programSlugs ?? []);
  const productPrograms = new Set(
    getCarsystemProductsByBrandSlug(brandSlug).map((product) => product.programSlug),
  );

  return publicProgramGroups.filter((program) => {
    if (program.brandSlugs.includes(brandSlug)) return true;

    return program.internalProgramSlugs.some(
      (programSlug) => brandPrograms.has(programSlug) || productPrograms.has(programSlug),
    );
  });
}

export function getRefinishPhaseBySlug(slug: RefinishPhaseSlug) {
  return refinishPhases.find((phase) => phase.slug === slug);
}

export function getRelatedProducts(product: CarsystemProduct, limit = 4) {
  const explicit = product.relatedProductSlugs
    .map((slug) => getCarsystemProductBySlug(slug))
    .filter((item): item is CarsystemProduct => Boolean(item));

  const explicitSlugs = new Set(explicit.map((item) => item.slug));
  const similar = products
    .filter((item) => item.slug !== product.slug && !explicitSlugs.has(item.slug))
    .map((item) => {
      let score = 0;
      if (item.brandSlug === product.brandSlug) score += 3;
      if (item.programSlug === product.programSlug) score += 2;
      if (!item.phaseUnconfirmed && !product.phaseUnconfirmed && item.phaseSlug === product.phaseSlug) score += 2;
      return { item, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item);

  return [...explicit, ...similar]
    .filter((item, index, all) => all.findIndex((candidate) => candidate.slug === item.slug) === index)
    .slice(0, limit);
}

/** Proizvod ima objavljenu fotografiju (ne „Vizuel u pripremi”). */
function hasPublishedImage(item: CarsystemProduct) {
  const src = item.productImage?.src ?? item.galleryImages[0]?.src;
  return Boolean(src) && !src!.includes("placeholder-product");
}

/**
 * „Slični proizvodi” su isključivo ručno pregledane preporuke (bez automatske dopune).
 * Proizvod bez fotografije se ne preporučuje: prazna kartica u preporuci ne pomaže izboru,
 * a ističe nedostatke kataloga.
 */
export function getManualProductRecommendations(
  product: CarsystemProduct,
  limit = 6,
) {
  const reviewed = product.recommendations
    ?.filter(
      (recommendation) =>
        recommendation.status === "confirmed" &&
        recommendation.relationType !== "compatible",
    )
    .sort((first, second) => (first.priority ?? 999) - (second.priority ?? 999))
    .map((recommendation) => recommendation.productId);
  const slugs = reviewed?.length ? reviewed : product.relatedProductSlugs;

  const chosen = slugs
    .map((slug) => getCarsystemProductBySlug(slug))
    .filter((item): item is CarsystemProduct => Boolean(item))
    .filter(hasPublishedImage)
    .filter(
      (item, index, all) =>
        item.slug !== product.slug &&
        all.findIndex((candidate) => candidate.slug === item.slug) === index,
    )
    .slice(0, limit);
  return chosen;
}

function getReviewedRelationshipProducts(
  product: CarsystemProduct,
  relationship: "compatibleProducts" | "alternativeProducts",
  limit: number,
) {
  const section = product.detail?.[relationship];
  if (
    product.detail?.reviewStatus !== "confirmed" ||
    !section ||
    section.reviewStatus !== "confirmed"
  ) {
    return [];
  }

  return section.content.items
    .filter((item) => item.reviewStatus === "confirmed")
    .map((item) => getCarsystemProductBySlug(item.productSlug))
    .filter((item): item is CarsystemProduct => Boolean(item))
    .filter(
      (item, index, all) =>
        all.findIndex((candidate) => candidate.slug === item.slug) === index,
    )
    .slice(0, limit);
}

export function getProductCompatibleProducts(product: CarsystemProduct, limit = 4) {
  return getReviewedRelationshipProducts(product, "compatibleProducts", limit);
}

export function getProductAlternativeProducts(product: CarsystemProduct, limit = 4) {
  return getReviewedRelationshipProducts(product, "alternativeProducts", limit);
}
