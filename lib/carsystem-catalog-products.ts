import catalogData from "@/data/carsystem-catalog-products.generated.json";
import type {
  CarsystemProduct,
  ProductDocument,
  ProductVisualType,
  RefinishPhaseSlug,
} from "@/lib/carsystem-data";
import type { ProductCategorySlug } from "@/lib/product-taxonomy";
import type {
  ProductDetailContent,
  ProductDetailDocument,
  ProductVariantSection,
} from "@/types/product-detail";

/**
 * Carsystem proizvodi uvezeni iz zvaničnog kataloga i sa carsystem.org.
 *
 * Isti obrazac kao `lib/rm-imported-products.ts` i `lib/baslac-catalog-products.ts`:
 * skripta (`npm run carsystem:sync`) piše `data/carsystem-catalog-products.generated.json`,
 * a ovaj modul ga samo prevodi u `CarsystemProduct`. Ovde nema poslovnih
 * odluka — matching, taksonomija, boja serije i SR tekst nastaju u syncu i
 * mogu se ponoviti bez diranja ovog fajla.
 *
 * Model varijanti je onaj koji već koristi ručno uređen F.23: jedna zvanična
 * stranica = jedan proizvod, a šifre artikala (granulacije, pakovanja,
 * dimenzije) su redovi `detail.variants`, ne zasebne kartice.
 *
 * Cene i zalihe se ne uvoze: katalog proizvođača nije naš cenovnik. Svaki zapis
 * nosi postojeće pravilo sajta — „Na upit”.
 */

type CatalogVariant = {
  articleNumber: string;
  label: string;
  /** Napomena o dostupnosti koju je proizvođač upisao u specifikaciju artikla. */
  manufacturerNote?: string | null;
  officialSpecification: string | null;
  salesPack: string | null;
  packagingUnit: string | null;
  inCatalogue: boolean;
  onWebsite: boolean;
  hasSds: boolean;
};

type CatalogVariantColumn = { key: string; label: string };

type CatalogTds = { href: string; fileName: string; sha256: string; language: string } | null;

type CatalogProductEntry = {
  slug: string;
  name: string;
  sourceKey: string;
  sourceUrl: string;
  officialName: string;
  officialSubtitle: string | null;
  officialCategory: string | null;
  taxonomy: {
    category: ProductCategorySlug;
    programSlug: string;
    phaseSlug: RefinishPhaseSlug;
    visualType: ProductVisualType;
  };
  isNew: boolean;
  inCatalogue: boolean;
  cataloguePages: number[];
  leadArticleNumber: string;
  /** Opciono: dataset iz starijeg synca nema ovo polje. */
  legacyArticleNumbers?: { articleNumber: string; specification: string | null; source: string }[];
  relatedLegacySlug?: string | null;
  variantColumn: CatalogVariantColumn;
  variants: CatalogVariant[];
  image: { src: string; width: number | null; height: number | null; hasAlpha: boolean } | null;
  /** `MISSING_OFFICIAL_ASSET`: aktivan proizvod bez zvanične slike — koristi se placeholder sajta. */
  missingOfficialAsset?: boolean;
  gallery: { src: string }[];
  tds: CatalogTds;
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
  };
  shade: { color: string; token?: string; series: string; source: string } | null;
  recommendedSlugs: string[];
  /**
   * Samo za proizvode DRUGIH proizvođača koje Carsystem vodi u svom katalogu (RUPES). Zapis ostaje
   * Carsystem-ov po izvoru i šifri artikla; ovo polje menja brend koji vidi kupac i dodaje modelsku šifru.
   */
  manufacturer?: CatalogManufacturer;
};

type CatalogManufacturer = {
  brandSlug: string;
  name: string;
  scope: string;
  coverageGroup: string;
  classification: string;
  manufacturerStatus:
    | "CURRENT_ON_OFFICIAL_SITE"
    | "DISCONTINUED_BY_RUPES_BUT_CARSYSTEM_LISTED"
    | "CARSYSTEM_LISTED_RUPES_IDENTITY_OFFICIAL_PAGE_UNCONFIRMED";
  officialName: string | null;
  officialUrls: string[];
  /** Šifra proizvođača kartice; postoji samo kada je potvrđena na zvaničnom sajtu proizvođača. */
  modelCode: string | null;
  articleModelCodes: Record<string, { modelCode: string; evidence: string; aliases: string[] }>;
  searchTerms: string[];
  imageRights: string;
  note: string | null;
};

type CatalogEnrichment = {
  sourceKey: string;
  sourceUrl: string;
  officialName: string;
  classification: string;
  inCatalogue: boolean;
  variantColumn: CatalogVariantColumn;
  variants: CatalogVariant[];
  /** Ručno upisana pakovanja kojih nema ni u jednom zvaničnom izvoru. */
  legacyPackages?: string[];
  /**
   * Zvanični packshot koji zamenjuje sliku ručnog zapisa — samo uz dokumentovanu
   * odluku u `manual-decisions.json` (slika zapisa prikazuje drugi proizvod).
   */
  image?: { src: string; width: number | null; height: number | null; hasAlpha: boolean; replaces: string | null } | null;
  tds: CatalogTds;
  recommendedSlugs: string[];
};

const entries = catalogData.products as CatalogProductEntry[];
const enrichments = catalogData.enrichments as Record<string, CatalogEnrichment>;

export const carsystemCatalogMeta = catalogData.meta;

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

const packLabel = (variant: CatalogVariant) => (variant.salesPack ? `${variant.salesPack} kom.` : "Na upit");

function variantSection(
  column: CatalogVariantColumn,
  variants: CatalogVariant[],
  legacyPackages: string[] = [],
  manufacturer?: CatalogManufacturer,
): ProductVariantSection {
  return {
    title: "Varijante i šifre artikala",
    // Kod proizvoda drugog proizvođača broj artikla je Carsystem-ov, a ne proizvođačev.
    description: manufacturer
      ? `Svaka varijanta ima zaseban Carsystem broj artikla; ${manufacturer.name} oznaka modela je deo naziva varijante kada je Carsystem navodi. Dostupnost na domaćem tržištu proverava se kroz upit.`
      : "Svaka varijanta ima zasebnu proizvođačku šifru. Dostupnost na domaćem tržištu proverava se kroz upit.",
    // Kolona sa varijantom je prva: `getPrimaryVariantColumn` za ključ van svoje
    // liste prioriteta bira prvu kolonu, a to mora biti varijanta, ne šifra.
    columns: [
      column,
      { key: "article", label: manufacturer ? "Carsystem br. artikla" : "Šifra artikla" },
      { key: "pack", label: "Fabričko pakovanje" },
      { key: "status", label: "Javni status" },
    ],
    rows: variants.map((variant) => ({
      id: variant.articleNumber,
      values: {
        [column.key]: variant.label,
        article: variant.articleNumber,
        pack: packLabel(variant),
        status: variant.manufacturerNote ?? "Na upit",
      },
      reviewStatus: "confirmed" as const,
    })),
    note: [
      `Šifre i fabrička pakovanja: ${carsystemCatalogMeta.catalogue} i carsystem.org.`,
      legacyPackages.length
        ? `Pakovanje ${legacyPackages.join(" / ")} iz ranijeg lokalnog zapisa nije među aktuelnim šiframa proizvođača.`
        : null,
    ]
      .filter(Boolean)
      .join(" "),
  };
}

function tdsDocument(slug: string, tds: NonNullable<CatalogTds>): ProductDetailDocument {
  return {
    id: `${slug}-tds`,
    title: "Tehnički list proizvođača",
    kind: "tds",
    availability: "available",
    href: tds.href,
    language: tds.language,
    note: "Zvanični dokument na carsystem.org",
    reviewStatus: "confirmed",
  };
}

function legacyDocuments(slug: string, productName: string, tds: CatalogTds): ProductDocument[] {
  return [
    tds
      ? {
          title: "Tehnički list",
          kind: "PDF",
          href: tds.href,
          status: "available",
          note: "Zvanični tehnički list proizvođača (engleski).",
        }
      : {
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

/** Status kod proizvođača koji kupac mora da vidi; aktuelan proizvod ne dobija dodatni red. */
const MANUFACTURER_STATUS_FACT: Partial<Record<CatalogManufacturer["manufacturerStatus"], { value: string; detail: string }>> = {
  DISCONTINUED_BY_RUPES_BUT_CARSYSTEM_LISTED: {
    value: "Proizvođač je model povukao iz aktuelnog programa",
    detail: "Na zvaničnom sajtu proizvođača model je označen kao „discontinued”. Carsystem ga i dalje navodi u svom programu — dostupnost proverite upitom.",
  },
  CARSYSTEM_LISTED_RUPES_IDENTITY_OFFICIAL_PAGE_UNCONFIRMED: {
    value: "Naveden u Carsystem programu",
    detail: "Proizvod kao RUPES artikal navodi Carsystem; zasebna stranica na zvaničnom sajtu proizvođača nije pronađena.",
  },
};

/**
 * Identitet proizvođača u tehničkim podacima. Carsystem ostaje izvor i sloj distribucije; ne tvrdi se
 * nikakav status distribucije — samo odakle podatak dolazi.
 */
function manufacturerFacts(entry: CatalogProductEntry, manufacturer: CatalogManufacturer) {
  const status = MANUFACTURER_STATUS_FACT[manufacturer.manufacturerStatus];
  return [
    { label: "Proizvođač", value: manufacturer.name, reviewStatus: "confirmed" as const },
    ...(manufacturer.modelCode
      ? [{ label: `${manufacturer.name} oznaka modela`, value: manufacturer.modelCode, reviewStatus: "confirmed" as const }]
      : []),
    ...(status ? [{ label: "Status kod proizvođača", ...status, reviewStatus: "confirmed" as const }] : []),
    {
      label: "Program",
      value: `${manufacturer.name} proizvodi iz Carsystem programa`,
      detail: entry.inCatalogue
        ? `Proizvod vodi ${carsystemCatalogMeta.catalogue}.`
        : "Proizvod vodi carsystem.org; nije u štampanom katalogu 2026/27.",
      reviewStatus: "confirmed" as const,
    },
  ];
}

/** Pojmovi po kojima kupac traži alat: modelske oznake (i osnovni model), Carsystem brojevi artikala, porodica. */
function manufacturerSearchTerms(entry: CatalogProductEntry, manufacturer: CatalogManufacturer) {
  return [
    ...new Set([
      manufacturer.name,
      ...Object.values(manufacturer.articleModelCodes).flatMap((model) => [model.modelCode, ...model.aliases]),
      ...entry.variants.map((variant) => variant.articleNumber),
      ...manufacturer.searchTerms,
    ]),
  ];
}

function summarizeVariants(entry: CatalogProductEntry) {
  const labels = entry.variants.map((variant) => variant.label);
  if (labels.length === 1) return labels[0];
  if (entry.variantColumn.key === "grit") return `${labels[0]}–${labels[labels.length - 1]}`;
  return `${labels.length} varijanti`;
}

function createCatalogProduct(entry: CatalogProductEntry, knownSlugs: Set<string>): CarsystemProduct {
  const { content } = entry;
  const related = entry.recommendedSlugs.filter((slug) => knownSlugs.has(slug));
  const variantSummary = summarizeVariants(entry);
  const imageAlt = `${entry.name}, ${content.productType.toLocaleLowerCase("sr-Latn")}`;
  const { manufacturer } = entry;
  const brandName = manufacturer?.name ?? "Carsystem";
  const articleLabel = manufacturer ? "Carsystem br. artikla" : "Šifra artikla";

  const detail: ProductDetailContent = {
    reviewStatus: "confirmed",
    hero: {
      kicker: `${brandName} · ${CATEGORY_BADGE[entry.taxonomy.category]}`,
      subtype: content.subtype,
      lead: content.shortDescription,
    },
    ...(entry.variants.length > 1
      ? { variants: { reviewStatus: "confirmed", content: variantSection(entry.variantColumn, entry.variants, [], manufacturer) } }
      : {}),
    ...(content.benefits.length
      ? {
          benefits: {
            reviewStatus: "confirmed",
            content: {
              title: `Prednosti — ${entry.officialName}`,
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
        ...(manufacturer ? manufacturerFacts(entry, manufacturer) : []),
        ...content.facts.map((fact) => ({ ...fact, reviewStatus: "confirmed" as const })),
        ...(entry.variants.length === 1
          ? [
              { label: articleLabel, value: entry.leadArticleNumber, reviewStatus: "confirmed" as const },
              { label: "Pakovanje", value: entry.variants[0].label, reviewStatus: "confirmed" as const },
            ]
          : []),
        ...(entry.legacyArticleNumbers ?? []).map((legacy) => ({
          label: "Prethodna šifra artikla",
          value: legacy.articleNumber,
          detail: `Pod ovom šifrom proizvod se vodi u izvoru: ${legacy.source}.`,
          reviewStatus: "confirmed" as const,
        })),
      ],
    },
    ...(entry.tds
      ? { documents: { reviewStatus: "confirmed", content: [tdsDocument(entry.slug, entry.tds)] } }
      : {}),
    ...(related.length
      ? {
          compatibleProducts: {
            reviewStatus: "confirmed",
            content: {
              title: "Koristi se zajedno sa",
              description: "Pribor koji proizvođač preporučuje uz ovaj proizvod.",
              items: related.map((productSlug) => ({ productSlug, reviewStatus: "confirmed" as const })),
            },
          },
        }
      : {}),
  };

  return {
    slug: entry.slug,
    name: entry.name,
    brandSlug: manufacturer?.brandSlug ?? "carsystem",
    programSlug: entry.taxonomy.programSlug,
    phaseSlug: entry.taxonomy.phaseSlug,
    shortDescription: content.shortDescription,
    longDescription: content.longDescription,
    // Vodeća šifra artikla — isto što i `itemprop="sku"` na zvaničnoj stranici.
    // Ostaje interni ključ i kod proizvoda drugog proizvođača: iz nje nastaju `?varijanta=` adrese.
    sku: entry.leadArticleNumber,
    externalSku: entry.leadArticleNumber,
    // Carsystem broj artikla NIJE šifra drugog proizvođača: tamo važi samo potvrđena oznaka modela.
    manufacturerCode: manufacturer
      ? manufacturer.modelCode
      : entry.variants.length === 1
        ? entry.leadArticleNumber
        : null,
    ...(manufacturer?.modelCode ? { publicCode: manufacturer.modelCode } : {}),
    ...(manufacturer
      ? {
          searchTerms: manufacturerSearchTerms(entry, manufacturer),
          variantManufacturerCodes: [
            ...new Set(Object.values(manufacturer.articleModelCodes).flatMap((model) => [model.modelCode, ...model.aliases])),
          ],
        }
      : {}),
    legacyManufacturerCodes: (entry.legacyArticleNumbers ?? []).map((legacy) => legacy.articleNumber),
    packages: [{ label: variantSummary, detail: entry.variantColumn.label }],
    purpose: content.purpose,
    badges: [
      content.productType,
      ...(entry.variants.length > 1 ? [variantSummary] : []),
      ...(entry.isNew ? ["Novo"] : []),
      "Na upit",
    ],
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
      ...content.facts,
      { label: entry.variantColumn.label, value: entry.variants.map((variant) => variant.label).join(", ") },
    ],
    documents: legacyDocuments(entry.slug, entry.name, entry.tds),
    relatedProductSlugs: related,
    seoTitle: `${entry.name} | ${brandName}`,
    seoDescription: content.shortDescription,
    taxonomyCategory: entry.taxonomy.category,
    manufacturerColor: entry.shade ?? undefined,
    detail,
  };
}

/**
 * Zvanična preporuka („We recommend”) sme da pokazuje samo na proizvod koji na
 * sajtu postoji: uvezen, ili ručni zapis koji je sync pouzdano prepoznao.
 */
const knownSlugs = new Set([...entries.map((entry) => entry.slug), ...Object.keys(enrichments)]);

export function getCarsystemCatalogProducts(): CarsystemProduct[] {
  return entries.map((entry) => createCatalogProduct(entry, knownSlugs));
}

/**
 * Dopuna RUČNOG Carsystem zapisa zvaničnim šiframa artikala.
 *
 * Dodaje samo ono što zapisu nedostaje: tabelu varijanti (ili redove koji u njoj
 * fale). Naziv, slug, opisi, slike, dokumenti i `sku` ostaju kakvi jesu — ručno
 * uređen sadržaj ima prednost nad uvezenim.
 *
 * Zapis bez `detail` bloka PDP čita iz `specifications`/`documents`. Čim
 * `detail` postoji, PDP čita samo njega, pa se postojeće specifikacije i
 * dokumenti prenose u `detail` istim pravilom koje PDP koristi za stare zapise —
 * inače bi dopuna varijanti sakrila tehničke podatke koji su do juče bili vidljivi.
 */
export function applyCarsystemCatalogEnrichment(product: CarsystemProduct): CarsystemProduct {
  const enrichment = enrichments[product.slug];
  if (!enrichment) return product;
  return enrichVariants(withOfficialImage(product, enrichment), enrichment);
}

/** Menja samo `src`; alt tekst i galerija ručnog zapisa ostaju. */
function withOfficialImage(product: CarsystemProduct, enrichment: CatalogEnrichment): CarsystemProduct {
  if (!enrichment.image || !product.productImage) return product;
  return { ...product, productImage: { ...product.productImage, src: enrichment.image.src } };
}

function enrichVariants(product: CarsystemProduct, enrichment: CatalogEnrichment): CarsystemProduct {
  const existingRows = product.detail?.variants?.content.rows ?? [];
  const knownIds = new Set(existingRows.map((row) => row.id));
  const missing = enrichment.variants.filter((variant) => !knownIds.has(variant.articleNumber));
  if (!missing.length) return product;

  if (product.detail?.variants) {
    const section = product.detail.variants.content;
    const column = section.columns.find((item) => item.key === enrichment.variantColumn.key) ?? section.columns[0];
    return {
      ...product,
      detail: {
        ...product.detail,
        variants: {
          ...product.detail.variants,
          content: {
            ...section,
            rows: [
              ...section.rows,
              ...missing.map((variant) => ({
                id: variant.articleNumber,
                values: {
                  [column.key]: variant.label,
                  article: variant.articleNumber,
                  pack: packLabel(variant),
                  status: "Na upit",
                },
                reviewStatus: "confirmed" as const,
              })),
            ],
          },
        },
      },
    };
  }

  const carriedDetail: ProductDetailContent = product.detail ?? {
    reviewStatus: "confirmed",
    technicalFacts: {
      reviewStatus: "confirmed",
      content: product.specifications
        .filter((fact) => fact.label && fact.value)
        .map((fact) => ({ ...fact, reviewStatus: "confirmed" as const })),
    },
    documents: {
      reviewStatus: "confirmed",
      content: product.documents.flatMap((document, index): ProductDetailDocument[] => {
        if (document.status === "placeholder") return [];
        if (document.status === "available" && !document.href) return [];
        const title = document.title.toLocaleLowerCase("sr-Latn");
        return [
          {
            id: `${product.slug}-${index}`,
            title: document.title,
            kind: title.includes("tehnički")
              ? "tds"
              : title.includes("bezbednosni")
                ? "sds"
                : title.includes("uputstvo")
                  ? "instructions"
                  : "other",
            availability: document.status === "available" ? "available" : "preparing",
            href: document.status === "available" ? document.href : undefined,
            note: document.note,
            reviewStatus: "confirmed",
          },
        ];
      }),
    },
  };

  return {
    ...product,
    detail: {
      ...carriedDetail,
      variants: {
        reviewStatus: "confirmed",
        content: variantSection(enrichment.variantColumn, enrichment.variants, enrichment.legacyPackages),
      },
    },
  };
}
