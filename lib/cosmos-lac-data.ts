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
  verificationStatus: "verified-official-source";
  sourceReference: string;
  visualTreatment: "paint" | "clearcoat" | "matte";
  shortDescription: string;
  seoTitle: string;
  seoDescription: string;
};

const records = generatedRecords as CosmosLacGeneratedRecord[];

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
  if (record.volume) specifications.push({ label: "Pakovanje", value: record.volume });
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
  const family: ProductFamilyIdentity = {
    id: record.baseProductSlug,
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
    longDescription: `${record.officialName} je verifikovana varijanta iz zvaničnog Cosmos Lac programa${
      identity ? ` (${identity})` : ""
    }. ${useCase} Dostupnost i izbor proizvoda potvrđuju se kroz upit.`,
    sku: record.id.toUpperCase(),
    packages: packageOptions(record.volume),
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
    documents: [
      {
        title: "Zvanični tehnički podaci",
        kind: "TDS",
        status: "disabled",
        note: "Dokumentaciju i odgovarajuću varijantu potvrđuje tehnička podrška.",
      },
    ],
    relatedProductSlugs: [],
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
    catalogMetadata: {
      id: record.id,
      baseProductSlug: record.baseProductSlug,
      variantId: record.variantId,
      line: record.line,
      officialName: record.officialName,
      displayNameSr: record.displayNameSr,
      cosmosCode: record.cosmosCode,
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
