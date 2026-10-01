import catalogData from "@/data/befar-catalog-products.generated.json";
import type {
  CarsystemProduct,
  ProductVisualType,
  RefinishPhaseSlug,
} from "@/lib/carsystem-data";
import type { ProductCategorySlug } from "@/lib/product-taxonomy";
import type { ProductDetailContent, ProductVariantSection } from "@/types/product-detail";

/**
 * BEFAR proizvodi uvezeni sa befar.com.tr i iz zvaničnog digitalnog kataloga.
 *
 * Isti obrazac kao `lib/carsystem-catalog-products.ts` i `lib/carfit-catalog-products.ts`:
 * skripta (`npm run befar:sync`) piše `data/befar-catalog-products.generated.json`, a
 * ovaj modul ga samo prevodi u `CarsystemProduct`. Ovde nema poslovnih odluka.
 *
 * Proizvođač je Befar; Leo, Befar Plus i Turkuaz su LINIJE (polje `line`), ne zasebni
 * brendovi — `brandSlug` je uvek „befar”.
 *
 * Boja kod Befara znači tvrdoću/namenu sunđera, pa je činjenica VARIJANTE: svaka
 * varijanta nosi uzorak boje, a kada proizvođač ima fotografiju te boje, i svoju sliku.
 *
 * Befar ne objavljuje TDS/SDS ni opise, pa zapis nema dokumente, a tekst je sveden na
 * zvanične činjenice. Cene i zalihe se ne uvoze — „Na upit”.
 */

type CatalogVariant = {
  code: string;
  label: string;
  /** Pun opis varijante za pretragu (i atributi koji ne variraju). */
  searchLabel: string;
  colour: string | null;
  colourSr: string | null;
  swatch: string | null;
  size: string | null;
  holes: string | null;
  hardnessStars: number | null;
  applyWith: string | null;
  boxQuantity: number | null;
  image: string | null;
  onWebsite: boolean;
  inCatalogue: boolean;
  cataloguePage: number | null;
};

type CatalogVariantColumn = { key: string; label: string };

type CatalogProductEntry = {
  slug: string;
  name: string;
  sourceKey: string;
  sourceUrls: string[];
  officialName: string;
  officialNameTr: string | null;
  line: string;
  kind: string;
  isSet: boolean;
  qualifiers: string[];
  officialCategories: string[];
  classification: string;
  taxonomy: {
    category: ProductCategorySlug;
    programSlug: string;
    phaseSlug: RefinishPhaseSlug;
    visualType: ProductVisualType;
  };
  cataloguePages: number[];
  leadCode: string;
  relatedLegacySlugs?: string[];
  variantColumn: CatalogVariantColumn;
  variants: CatalogVariant[];
  image: { src: string; width: number | null; height: number | null; hasAlpha: boolean } | null;
  /** Grupna fotografija koju deli više proizvoda istog bloka (proizvođač nema zasebnu). */
  sharedGroupImages?: boolean;
  /** `MISSING_OFFICIAL_ASSET`: aktivan proizvod bez zvanične slike — koristi se placeholder sajta. */
  missingOfficialAsset?: boolean;
  gallery: { src: string }[];
  content: {
    productType: string;
    subtype: string;
    shortDescription: string;
    longDescription: string;
    purpose: string;
    facts: { label: string; value: string }[];
    applications: string[];
    benefits: { title: string; description: string }[];
    advice: string | null;
    setContents: string[];
  };
  shade: { color: string; token?: string; series: string; source: string } | null;
};

const entries = catalogData.products as CatalogProductEntry[];

export const befarCatalogMeta = catalogData.meta;

const CATEGORY_BADGE: Record<ProductCategorySlug, string> = {
  boje: "Boje i lakovi",
  abrazivi: "Abrazivi",
  kitovi: "Git",
  maskiranje: "Maskiranje",
  sprejevi: "Sprej",
  oprema: "Oprema",
  pribor: "Pribor",
  lepkovi: "Lepkovi",
  ciscenje: "Čišćenje",
  zastita: "Zaštita",
  poliranje: "Poliranje",
  radionica: "Radionica",
};

/** Isti placeholder koji `createProduct` u `lib/carsystem-data.ts` daje zapisima bez slike. */
const PLACEHOLDER_PRODUCT_IMAGE = "/images/products/placeholder-product.svg";

const packLabel = (variant: CatalogVariant) => (variant.boxQuantity ? `${variant.boxQuantity} kom. u kutiji` : "Na upit");

function variantSection(entry: CatalogProductEntry): ProductVariantSection {
  const column = entry.variantColumn;
  return {
    title: "Varijante i šifre proizvoda",
    description:
      column.key === "color"
        ? "Kod Befar sunđera boja označava tvrdoću i namenu. Svaka varijanta ima zasebnu proizvođačku šifru; dostupnost se proverava kroz upit."
        : "Svaka varijanta ima zasebnu proizvođačku šifru. Dostupnost na domaćem tržištu proverava se kroz upit.",
    // Kolona sa varijantom je prva i nosi ključ iz liste prioriteta `getPrimaryVariantColumn`.
    columns: [
      column,
      { key: "article", label: "Šifra proizvoda" },
      { key: "pack", label: "Fabričko pakovanje" },
      { key: "status", label: "Javni status" },
    ],
    rows: entry.variants.map((variant) => ({
      id: variant.code,
      values: {
        [column.key]: variant.label,
        article: variant.code,
        pack: packLabel(variant),
        status: "Na upit",
      },
      ...(variant.swatch ? { swatch: variant.swatch } : {}),
      ...(variant.image ? { image: variant.image } : {}),
      reviewStatus: "confirmed" as const,
    })),
    // Usklađivanje sajta i kataloga proizvođača (`inCatalogue`) ostaje u podacima sync-a.
    note: `Šifre: befar.com.tr; fabrička pakovanja: ${befarCatalogMeta.catalogue}.`,
  };
}

function hardnessFact(entry: CatalogProductEntry) {
  const byColour = new Map<string, number>();
  for (const variant of entry.variants) {
    if (variant.colourSr && variant.hardnessStars) byColour.set(variant.colourSr, variant.hardnessStars);
  }
  if (!byColour.size) return [];
  return [
    {
      label: "Tvrdoća po boji",
      value: [...byColour.entries()].map(([colour, stars]) => `${colour} ${stars}/5`).join(", "),
      detail: `Legenda tvrdoće prema katalogu ${befarCatalogMeta.catalogue}.`,
      reviewStatus: "confirmed" as const,
    },
  ];
}

function summarizeVariants(entry: CatalogProductEntry) {
  if (entry.variants.length === 1) return entry.variants[0].label;
  const count = entry.variants.length;
  const mod10 = count % 10;
  const mod100 = count % 100;
  const noun = mod10 === 1 && mod100 !== 11 ? "varijanta" : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? "varijante" : "varijanti";
  return `${count} ${noun}`;
}

function createCatalogProduct(entry: CatalogProductEntry): CarsystemProduct {
  const { content } = entry;
  const variantSummary = summarizeVariants(entry);
  const imageAlt = `${entry.name}, ${content.productType.toLocaleLowerCase("sr-Latn")}`;
  const lineBadge = entry.line === "Befar" ? null : entry.line;

  const detail: ProductDetailContent = {
    reviewStatus: "confirmed",
    hero: {
      kicker: `Befar${lineBadge ? ` · ${lineBadge}` : ""} · ${CATEGORY_BADGE[entry.taxonomy.category]}`,
      subtype: content.subtype,
      lead: content.shortDescription,
    },
    ...(entry.variants.length > 1 ? { variants: { reviewStatus: "confirmed", content: variantSection(entry) } } : {}),
    ...(content.benefits.length
      ? {
          benefits: {
            reviewStatus: "confirmed",
            content: {
              title: `Karakteristike — ${entry.officialName}`,
              items: content.benefits.map((benefit) => ({ ...benefit, reviewStatus: "confirmed" as const })),
            },
          },
        }
      : {}),
    ...(content.applications.length
      ? {
          process: {
            reviewStatus: "confirmed",
            content: {
              title: "Oblast primene",
              description: content.advice ?? content.purpose,
              mode: "supporting-process",
              stages: content.applications.map((label) => ({ label, reviewStatus: "confirmed" as const })),
            },
          },
        }
      : {}),
    technicalFacts: {
      reviewStatus: "confirmed",
      content: [
        { label: "Tip proizvoda", value: content.productType, reviewStatus: "confirmed" },
        { label: "Linija", value: entry.line, reviewStatus: "confirmed" },
        ...content.facts
          .filter((fact) => fact.label !== "Linija" && fact.label !== "Tvrdoća po boji")
          .map((fact) => ({ ...fact, reviewStatus: "confirmed" as const })),
        ...hardnessFact(entry),
        ...(content.setContents.length
          ? [{ label: "Sadržaj seta", value: content.setContents.join(", "), reviewStatus: "confirmed" as const }]
          : []),
        ...(content.advice && !content.applications.length
          ? [{ label: "Napomena proizvođača", value: content.advice, reviewStatus: "confirmed" as const }]
          : []),
        ...(entry.variants.length === 1
          ? [
              { label: "Šifra proizvoda", value: entry.leadCode, reviewStatus: "confirmed" as const },
              { label: "Pakovanje", value: entry.variants[0].label, reviewStatus: "confirmed" as const },
            ]
          : []),
      ],
    },
  };

  return {
    slug: entry.slug,
    name: entry.name,
    brandSlug: "befar",
    programSlug: entry.taxonomy.programSlug,
    phaseSlug: entry.taxonomy.phaseSlug,
    shortDescription: content.shortDescription,
    longDescription: content.longDescription,
    // Vodeća zvanična Befar šifra — nije izmišljen placeholder.
    sku: entry.leadCode,
    externalSku: entry.leadCode,
    manufacturerCode: entry.variants.length === 1 ? entry.leadCode : null,
    packages: [{ label: variantSummary, detail: entry.variantColumn.label }],
    purpose: content.purpose,
    badges: [content.productType, ...(lineBadge ? [lineBadge] : []), ...(entry.variants.length > 1 ? [variantSummary] : []), "Na upit"],
    publicStatus: "Na upit",
    stockStatus: "unknown",
    stockManaged: false,
    productImage: entry.image
      ? { src: entry.image.src, alt: imageAlt }
      : { src: PLACEHOLDER_PRODUCT_IMAGE, alt: `${entry.name}, ilustrativni prikaz proizvoda` },
    galleryImages: entry.gallery.map((image, index) => ({
      src: image.src,
      alt: `${entry.name}, dodatni prikaz ${index + 1}`,
    })),
    specifications: [
      { label: "Tip proizvoda", value: content.productType },
      { label: "Linija", value: entry.line },
      ...content.facts.filter((fact) => fact.label !== "Linija"),
      { label: entry.variantColumn.label, value: entry.variants.map((variant) => variant.label).join(", ") },
    ],
    // Befar ne objavljuje tehničke ni bezbednosne listove.
    documents: [
      { title: "Tehnički list", kind: "PDF", status: "placeholder", note: `Dostupno na upit za ${entry.name}.` },
      { title: "Bezbednosni list", kind: "PDF", status: "placeholder", note: "Dostavlja se kada je primenljivo za potvrđen artikal." },
    ],
    relatedProductSlugs: [],
    seoTitle: `${entry.name} | Befar`,
    seoDescription: content.shortDescription,
    taxonomyCategory: entry.taxonomy.category,
    manufacturerColor: entry.shade ?? undefined,
    // Kupac traži „befar narandžasti 150” ili „leo 180 mm”: oznake varijanti, linija i turski naziv su pojmovi pretrage.
    searchTerms: [
      ...new Set([
        ...entry.variants.map((variant) => variant.label),
        ...entry.variants.map((variant) => variant.searchLabel),
        entry.line,
        entry.officialName,
        ...(entry.officialNameTr ? [entry.officialNameTr] : []),
      ]),
    ],
    detail,
  };
}

export function getBefarCatalogProducts(): CarsystemProduct[] {
  return entries.map(createCatalogProduct);
}
