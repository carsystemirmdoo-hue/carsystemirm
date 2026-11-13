import syncDataset from "@/data/cosmos-lac-catalog-products.generated.json";
import generatedRecords from "@/data/cosmos-lac-products.generated.json";
import type {
  CarsystemProduct,
  ProductColorConfidence,
  ProductColorSource,
  ProductPackage,
  ProductSpecification,
  ProductVisualMode,
  ProductVisualType,
  RefinishPhaseSlug,
} from "@/lib/carsystem-data";
import type { ProductSize } from "@/lib/product-scale";
import type { ProductFamilyIdentity } from "@/types/product-detail";

type CosmosLacGeneratedRecord = {
  id: string;
  slug: string;
  baseProductSlug: string;
  variantId: string;
  brand: "Cosmos Lac";
  brandSlug: "cosmos-lac";
  line: string;
  officialName: string;
  displayNameSr: string;
  cosmosCode: string | null;
  ralCode: string | null;
  colorName: string | null;
  finish: string | null;
  volume: string | null;
  programSlug: string;
  primaryCategory: RefinishPhaseSlug;
  technicalCategory: string;
  useCase: string | null;
  image: string;
  imageAlt: string;
  visualMode: ProductVisualMode;
  backgroundColor: string;
  foregroundTone: "light" | "dark";
  colorSource: ProductColorSource;
  colorConfidence: ProductColorConfidence;
  verificationStatus: "verified-official-source" | "OWNER_CONFIRMED";
  sourceReference: string;
  visualTreatment: "paint" | "clearcoat" | "matte";
  shortDescription: string;
  seoTitle: string;
  seoDescription: string;
};

/**
 * Dopuna sa zvaničnog sajta (`npm run cosmos-lac:sync`).
 *
 * 742 zapisa iz zvaničnog Brand Kit-a ostaju kakvi jesu — sa slikama i SHA poreklom. Sync preko njih
 * polaže ono što potvrđuje cosmoslac.com: zvanični identitet i šifre, dokument proizvoda, status
 * pakovanja i grupu (karticu). Hibridni model: linija boja je jedna kartica, a kartica koja je mešala
 * RAZLIČITE proizvode (različit zvanični dokument) podeljena je po zvaničnom proizvodu.
 * Novi zapisi dolaze iz istog dataseta i koriste placeholder sajta — nijedna slika se ne preuzima.
 */
type CosmosSyncPackaging = {
  status: "OFFICIAL_CURRENT" | "LOCAL_EXISTING" | "SOURCE_UNSPECIFIED";
  /** Pakovanje koje vidi kupac: zvanično kada ga izvor navodi, postojeće kada ga ne navodi, `null` kada ga nema. */
  customerFacing: string | null;
  local: string | null;
  official: string | null;
  localDiverges: boolean;
};

type CosmosSyncEntry = {
  status: "CURRENT" | "CURRENT_REGION_SPECIFIC" | "LEGACY_LOCAL_ONLY" | "REMOVED_FROM_CUSTOMER_CATALOG";
  classification: string;
  officialUrl: string | null;
  officialSlug: string | null;
  officialName: string | null;
  officialProduct: string | null;
  officialCodes: string[];
  sourceLocales?: { locale: string; url: string }[];
  baseProductSlug?: string;
  previousBaseProductSlug?: string;
  familyIdentity?: { name: string; slug: string };
  packaging: CosmosSyncPackaging;
  document: { title: string; kind: string; href: string } | null;
};

const syncEnrichments = syncDataset.enrichments as unknown as Record<string, CosmosSyncEntry>;
const syncProducts = syncDataset.products as unknown as (CosmosLacGeneratedRecord & { sync: CosmosSyncEntry })[];

export const cosmosLacSyncMeta = syncDataset.meta;

const syncOf = (record: CosmosLacGeneratedRecord): CosmosSyncEntry | undefined =>
  syncEnrichments[record.slug] ?? (record as { sync?: CosmosSyncEntry }).sync;

/*
 * `REMOVED_FROM_CUSTOMER_CATALOG` (Molotow, 2026-09-21): zapis ostaje u Brand Kit datasetu kao istorijski podatak,
 * ali ne ulazi u runtime — nema kartice, varijante, pretrage ni sitemap adrese. Stare adrese preusmerava sync dataset.
 */
/*
 * Generator je za liniju „RAL” nazivu dodao prefiks linije ispred oznake „RAL 3002”, pa je pet
 * zapisa glasilo „Cosmos Lac RAL RAL 3002 …”. Ispravlja se samo PRIKAZ (naziv, alt, SEO);
 * slug, id i `?varijanta=` ključ ostaju, da se adrese ne pomere.
 */
const withoutDoubledRal = (text: string) => text.replace(/\bRAL RAL\b/g, "RAL");

/*
 * Odluka vlasnika 2026-11-13: „032 je sa konverterom, a 030 bez konvertera — svaki ima svoju karticu, a sa
 * jedne se brzo prelazi na drugu“. Prefilled 032 nije na cosmoslac.com ni u Brand Kit-u, pa nosi samo naš
 * naziv (BizniSoft 020032) i pakovanje.
 */
const ownerConfirmedRecords: CosmosLacGeneratedRecord[] = [
  {
    id: "cl-automotive-032-400-ml-prefilled-032-konverter",
    slug: "cosmos-lac-automotive-032-400-ml-prefilled-032-konverter",
    // Sopstvena kartica (ne ista porodica): birač bi obe izvedbe nazvao „400 ml“; prelaz 030 ↔ 032 nose povezani proizvodi.
    baseProductSlug: "cosmos-lac-automotive-prefilled-032-konverter",
    variantId: "automotive-032-400-ml-prefilled-032-konverter",
    brand: "Cosmos Lac",
    brandSlug: "cosmos-lac",
    line: "Automotive",
    officialName: "Cosmos Lac Prefilled Spray 032 sa konverterom",
    displayNameSr: "Cosmos Lac Prefilled Spray 032 sa konverterom",
    cosmosCode: "032",
    ralCode: null,
    colorName: null,
    finish: null,
    volume: "400 ml",
    programSlug: "aerosoli",
    primaryCategory: "boja",
    technicalCategory: "automotive-paint",
    useCase: "Sprej za punjenje bojom, izvedba sa konverterom (030 je izvedba bez konvertera).",
    image: "/images/products/placeholder-product.svg",
    imageAlt: "Cosmos Lac Prefilled Spray 032 sa konverterom",
    visualMode: "neutral",
    backgroundColor: "#E7EAEE",
    foregroundTone: "dark",
    colorSource: "manual-estimate",
    colorConfidence: "provisional",
    verificationStatus: "OWNER_CONFIRMED",
    sourceReference: "Odluka vlasnika 2026-11-13 (BizniSoft 020032 „COS.SPREJ PREFIL 032 KONVERTER 400ML“); nije na cosmoslac.com.",
    visualTreatment: "paint",
    shortDescription: "Cosmos Lac Prefilled 032, izvedba sa konverterom, 400 ml. Izvedba bez konvertera je Prefilled 030.",
    seoTitle: "Cosmos Lac Prefilled Spray 032 sa konverterom | Carsystem i R-M",
    seoDescription: "Cosmos Lac Prefilled 032 sa konverterom, 400 ml. Pošaljite upit Carsystem i R-M timu.",
  },
  // Odluka vlasnika 2026-11-13: BizniSoft 633001 „COS.ERGONOMSKA RUČICA ZA SPREJ“ — pribor, sopstvena kartica.
  {
    id: "cl-pribor-ergonomska-rucica-za-sprej",
    slug: "cosmos-lac-ergonomska-rucica-za-sprej",
    baseProductSlug: "cosmos-lac-ergonomska-rucica-za-sprej",
    variantId: "pribor-ergonomska-rucica-za-sprej",
    brand: "Cosmos Lac",
    brandSlug: "cosmos-lac",
    line: "Pribor",
    officialName: "Cosmos Lac ergonomska ručica za sprej",
    displayNameSr: "Cosmos Lac ergonomska ručica za sprej",
    cosmosCode: null,
    ralCode: null,
    colorName: null,
    finish: null,
    volume: null,
    programSlug: "aerosoli",
    primaryCategory: "boja",
    technicalCategory: "automotive-maintenance",
    useCase: "Ručica koja se natakne na sprej limenku za lakše i ravnomernije prskanje.",
    image: "/images/products/placeholder-product.svg",
    imageAlt: "Cosmos Lac ergonomska ručica za sprej",
    visualMode: "neutral",
    backgroundColor: "#E7EAEE",
    foregroundTone: "dark",
    colorSource: "manual-estimate",
    colorConfidence: "provisional",
    verificationStatus: "OWNER_CONFIRMED",
    sourceReference: "Odluka vlasnika 2026-11-13 (BizniSoft 633001).",
    visualTreatment: "paint",
    shortDescription: "Ergonomska ručica za sprej limenke iz Cosmos Lac ponude.",
    seoTitle: "Cosmos Lac ergonomska ručica za sprej | Carsystem i R-M",
    seoDescription: "Cosmos Lac ergonomska ručica za sprej limenke. Pošaljite upit Carsystem i R-M timu.",
  },
];

/** Brz prelaz između izvedbi istog proizvoda koje nisu varijante jedne porodice (vlasnik 2026-11-13). */
const OWNER_SIBLINGS: Record<string, string[]> = {
  "cosmos-lac-automotive-030-400-ml-prefilled-030-1k": ["cosmos-lac-automotive-032-400-ml-prefilled-032-konverter"],
  "cosmos-lac-automotive-032-400-ml-prefilled-032-konverter": ["cosmos-lac-automotive-030-400-ml-prefilled-030-1k"],
};

const records = [...(generatedRecords as CosmosLacGeneratedRecord[]), ...syncProducts, ...ownerConfirmedRecords]
  .filter((record) => syncOf(record)?.status !== "REMOVED_FROM_CUSTOMER_CATALOG")
  .map((record) => ({
    ...record,
    officialName: withoutDoubledRal(record.officialName),
    displayNameSr: withoutDoubledRal(record.displayNameSr),
    imageAlt: withoutDoubledRal(record.imageAlt),
    seoTitle: withoutDoubledRal(record.seoTitle),
    seoDescription: withoutDoubledRal(record.seoDescription),
  }));

const technicalCategoryLabels: Record<string, string> = {
  cleaner: "Čistač",
  "filler-primer": "Filer-prajmer",
  primer: "Prajmer",
  "plastic-primer": "Prajmer za plastiku",
  antichip: "Antigravel",
  "bumper-paint": "Boja za branike",
  "brake-caliper-paint": "Boja za kočione čeljusti",
  "automotive-paint": "Automotive",
  "automotive-maintenance": "Servisni proizvod",
  "wheel-rim": "Felne",
  "high-heat": "Visoka temperatura",
  zinc: "Cink",
  clearcoat: "Bezbojni lak",
  varnish: "Lak",
  sealer: "Zaptivanje",
  fluorescent: "Fluorescentna boja",
  marking: "Obeležavanje",
  metallic: "Metalik",
  effect: "Efekat",
  lubricant: "Mazivo",
  "home-paint": "Kućna primena",
  adhesive: "Lepak",
  "wood-care": "Nega drveta",
  putty: "Kit",
  "art-and-graffiti": "Art i graffiti",
  "bicycle-paint": "Boja za bicikle",
  "chalk-effect": "Chalk efekat",
  "acrylic-spray": "Akrilni sprej",
  "ral-spray": "RAL sprej",
};

/**
 * Technical categories whose variants genuinely differ by colour.
 *
 * Exported because `variesBy` on the family ProductGroup must not infer
 * "colour" from the presence of a `colorName`: the generator also uses that
 * field as a generic variant label, so lubricants and cleaners carry one too.
 */
export const cosmosColorCategories = new Set([
  "acrylic-spray",
  "art-and-graffiti",
  "automotive-paint",
  "bicycle-paint",
  "brake-caliper-paint",
  "bumper-paint",
  "chalk-effect",
  "effect",
  "fluorescent",
  "high-heat",
  "home-paint",
  "marking",
  "metallic",
  "ral-spray",
  "wheel-rim",
]);

function getCosmosProductVisualType(
  record: CosmosLacGeneratedRecord,
): ProductVisualType {
  if (
    record.technicalCategory === "primer" ||
    record.technicalCategory === "filler-primer" ||
    record.technicalCategory === "plastic-primer"
  ) {
    return "primer";
  }

  if (record.technicalCategory === "putty") return "filler";
  if (
    record.technicalCategory === "clearcoat" ||
    record.technicalCategory === "varnish"
  ) {
    return "clearcoat";
  }

  if (cosmosColorCategories.has(record.technicalCategory)) return "color";
  if (
    record.technicalCategory === "antichip" ||
    record.technicalCategory === "zinc"
  ) {
    return "spray";
  }

  return "neutral";
}

/**
 * Pakovanje za prikaz kupcu. Bez sync dopune (ili bez njenog zaključka) važi postojeći `volume`.
 * Lokalni podatak koji se razlikuje od zvaničnog se ne prikazuje uporedo — ostaje u datasetu synca.
 */
function customerPackageOf(record: CosmosLacGeneratedRecord): string | null {
  const packaging = syncOf(record)?.packaging;
  return packaging ? packaging.customerFacing : record.volume;
}

/**
 * Oznaka količine na ambalaži čita `volume`. Kada je potvrđeno pakovanje JEDNA mera koja se razlikuje
 * od `volume` (Sealer: katalog 400 ml, proizvođač 500 ml), oznaka bi protivrečila redu „Pakovanje" —
 * zato tada dobija potvrđenu meru. Više mera ili isto pakovanje: ništa se ne menja.
 */
function verifiedSizeOf(record: CosmosLacGeneratedRecord): ProductSize | undefined {
  const customerPackage = customerPackageOf(record);
  const match = customerPackage?.trim().match(/^(\d+(?:[.,]\d+)?)\s*(ml|l|kg|g)$/i);
  if (!match || customerPackage === record.volume) return undefined;
  return {
    volumeValue: Number.parseFloat(match[1].replace(",", ".")),
    volumeUnit: match[2].toLowerCase() as ProductSize["volumeUnit"],
    volumeStatus: "verified",
  };
}

function packageOptions(volume: string | null): ProductPackage[] {
  if (!volume) return [{ label: "Na upit", detail: "Pakovanje se potvrđuje kroz upit" }];
  return volume.split("/").map((option) => ({ label: option.trim() }));
}

function compactSpecifications(record: CosmosLacGeneratedRecord): ProductSpecification[] {
  const specifications: ProductSpecification[] = [
    { label: "Linija", value: record.line },
    {
      label: "Tehnička grupa",
      value: technicalCategoryLabels[record.technicalCategory] ?? record.technicalCategory,
    },
  ];
  if (record.cosmosCode) specifications.push({ label: "Cosmos Lac šifra", value: record.cosmosCode });
  if (record.ralCode) {
    specifications.push({
      label: "RAL",
      value: `RAL ${record.ralCode}`,
      detail: "Ekranski prikaz je digitalna aproksimacija; fizički uzorak je merodavan.",
    });
  }
  if (record.colorName) specifications.push({ label: "Nijansa", value: record.colorName });
  if (record.finish) specifications.push({ label: "Završnica", value: record.finish });
  const customerPackage = customerPackageOf(record);
  if (customerPackage) specifications.push({ label: "Pakovanje", value: customerPackage });
  return specifications;
}

function badgesFor(record: CosmosLacGeneratedRecord) {
  return [
    record.line,
    technicalCategoryLabels[record.technicalCategory] ?? record.technicalCategory,
    record.ralCode ? `RAL ${record.ralCode}` : record.finish,
    "Na upit",
  ].filter((badge): badge is string => Boolean(badge));
}

/*
 * Cosmos šifra koju proizvođač deli između više varijanti iste kartice (Master Mechanic „10”:
 * pet RAL nijansi; „CL-304”: mat, polusjaj, sjaj). Takva šifra ne može biti `?varijanta=` ključ,
 * pa varijanta tada nosi svoju jedinstvenu katalošku šifru (vidi lib/catalog/variant-key.ts).
 */
const sharedCosmosCodes = (() => {
  const counts = new Map<string, number>();
  for (const record of records) {
    if (!record.cosmosCode) continue;
    const key = `${syncOf(record)?.baseProductSlug ?? record.baseProductSlug}|${record.cosmosCode}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return new Set([...counts].filter(([, count]) => count > 1).map(([key]) => key));
})();

function toCarsystemProduct(record: CosmosLacGeneratedRecord): CarsystemProduct {
  const useCase =
    record.useCase ?? "Primena se potvrđuje prema zvaničnom tehničkom listu i konkretnoj podlozi.";
  const identity = [
    record.cosmosCode ? `šifra ${record.cosmosCode}` : "",
    record.ralCode ? `RAL ${record.ralCode}` : "",
    record.colorName ?? "",
    record.finish ?? "",
  ]
    .filter(Boolean)
    .join(", ");
  const sync = syncOf(record);
  // Kartica kojoj zapis pripada: sync je menja samo tamo gde je stara kartica mešala različite proizvode.
  const baseProductSlug = sync?.baseProductSlug ?? record.baseProductSlug;
  const family: ProductFamilyIdentity = {
    id: baseProductSlug,
    label: `Cosmos Lac ${record.line}`,
    catalogStrategy: "hybrid",
  };

  return {
    slug: record.slug,
    name: record.displayNameSr,
    brandSlug: "cosmos-lac",
    programSlug: record.programSlug,
    phaseSlug: record.primaryCategory,
    shortDescription: record.shortDescription,
    longDescription:
      record.verificationStatus === "OWNER_CONFIRMED"
        ? `${record.officialName}. ${useCase} Tehnički list i dostupnost potvrđujemo na upit.`
        : `${record.officialName} je verifikovana varijanta iz zvaničnog Cosmos Lac programa${
            identity ? ` (${identity})` : ""
          }. ${useCase} Dostupnost i izbor proizvoda potvrđuju se kroz upit.`,
    sku: record.id.toUpperCase(),
    packages: packageOptions(customerPackageOf(record)),
    ...(verifiedSizeOf(record) ? { size: verifiedSizeOf(record) } : {}),
    purpose: useCase,
    badges: badgesFor(record),
    publicStatus: "Na upit",
    stockStatus: "unknown",
    stockManaged: false,
    productImage: {
      src: record.image,
      alt: record.imageAlt,
    },
    galleryImages: [],
    specifications: compactSpecifications(record),
    // Zvanični dokument pripada PROIZVODU, pa ga dele sve njegove nijanse. SDS proizvođač ne objavljuje.
    documents: sync?.document
      ? [
          {
            title: sync.document.title,
            kind: "PDF",
            href: sync.document.href,
            status: "available",
            note: "Zvanični dokument proizvođača (cosmoslac.com), na engleskom.",
          },
        ]
      : [
          {
            title: "Zvanični tehnički podaci",
            kind: "TDS",
            status: "disabled",
            note: "Dokumentaciju i odgovarajuću varijantu potvrđuje tehnička podrška.",
          },
        ],
    relatedProductSlugs: OWNER_SIBLINGS[record.slug] ?? [],
    family,
    catalogStrategy: family.catalogStrategy,
    variantId: record.variantId,
    variantOptions: {
      variant: record.variantId,
      ...(record.colorName ? { color: record.colorName } : {}),
      ...(record.ralCode ? { ral: record.ralCode } : {}),
      ...(record.finish ? { finish: record.finish } : {}),
      ...(record.volume ? { volume: record.volume } : {}),
    },
    seoTitle: record.seoTitle,
    seoDescription: record.seoDescription,
    // Kupac traži zvaničnu šifru („FO-314”, „RAL 9003”), zvanični naziv ili adresu sa sajta proizvođača.
    searchTerms: sync
      ? [
          ...new Set(
            [sync.officialName, sync.officialSlug, sync.officialSlug?.replace(/-/g, " "), ...sync.officialCodes].filter(
              (term): term is string => Boolean(term),
            ),
          ),
        ]
      : undefined,
    catalogMetadata: {
      id: record.id,
      baseProductSlug,
      ...(sync?.familyIdentity ? { familyIdentity: sync.familyIdentity } : {}),
      // `volume` ostaje podatak kataloga (razmera, ose varijanti, pretraga); kupac vidi potvrđeno pakovanje.
      ...(sync?.packaging ? { customerPackage: sync.packaging.customerFacing } : {}),
      variantId: record.variantId,
      line: record.line,
      officialName: record.officialName,
      displayNameSr: record.displayNameSr,
      cosmosCode: record.cosmosCode,
      ...(record.cosmosCode && sharedCosmosCodes.has(`${baseProductSlug}|${record.cosmosCode}`)
        ? { cosmosCodeShared: true }
        : {}),
      ralCode: record.ralCode,
      colorName: record.colorName,
      finish: record.finish,
      volume: record.volume,
      technicalCategory: record.technicalCategory,
      verificationStatus: record.verificationStatus,
      sourceReference: record.sourceReference,
      colorSource: record.colorSource,
      colorConfidence: record.colorConfidence,
    },
    visual: {
      treatment: record.visualTreatment,
      productType: getCosmosProductVisualType(record),
      visualMode: record.visualMode,
      backgroundColor: record.backgroundColor,
      foregroundTone: record.foregroundTone,
      colorSource: record.colorSource,
    },
  };
}

export const cosmosLacProducts: CarsystemProduct[] = records.map(toCarsystemProduct);
