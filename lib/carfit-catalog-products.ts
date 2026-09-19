import catalogData from "@/data/carfit-catalog-products.generated.json";
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
 * C.A.R.FIT proizvodi uvezeni sa carfitrepair.com i iz zvaničnog kataloga.
 *
 * Isti obrazac kao `lib/carsystem-catalog-products.ts`: skripta
 * (`npm run carfit:sync`) piše `data/carfit-catalog-products.generated.json`, a
 * ovaj modul ga samo prevodi u `CarsystemProduct`. Ovde nema poslovnih odluka —
 * matching, taksonomija, boja i SR tekst nastaju u syncu.
 *
 * Model varijanti: jedna zvanična stranica = jedan proizvod; šifre artikala
 * (granulacije, pakovanja, dimenzije, komponente) su redovi `detail.variants`.
 * Učvršćivač naveden na stranici svog laka/filera ostaje red tog proizvoda, sa
 * oznakom komponente — pravilo je u `scripts/carfit-sync/lib/components.mjs`.
 *
 * Cene i zalihe se ne uvoze: katalog proizvođača nije naš cenovnik. Svaki zapis
 * nosi postojeće pravilo sajta — „Na upit”.
 */

type CatalogVariant = {
  articleNumber: string;
  label: string;
  component: string | null;
  componentRole: string;
  componentLabel: string | null;
  officialDescriptor: string | null;
  pieces: string | null;
  pcsPerPack: number | null;
  onWebsite: boolean;
  inCatalogue: boolean;
  shorthandOf: string | null;
  /**
   * Drugi zvanični zapis ISTE varijante (sajt 4-304-3600 ↔ katalog 4-204-3600,
   * verovatna slovna razlika kod proizvođača). Nije zasebna varijanta: ne dobija
   * red u tabeli, ali se po njemu proizvod nalazi u pretrazi.
   */
  alternateArticleNumbers?: { articleNumber: string; source: string }[];
};

type CatalogVariantColumn = { key: string; label: string };

type CatalogDocument = {
  kind: "tds" | "sds" | "other";
  component: string | null;
  href: string;
  fileName: string;
  language: string | null;
};

type CatalogProductEntry = {
  slug: string;
  name: string;
  sourceKey: string;
  sourceUrl: string;
  officialName: string;
  officialCategory: string;
  classification: string;
  taxonomy: {
    category: ProductCategorySlug;
    programSlug: string;
    phaseSlug: RefinishPhaseSlug;
    visualType: ProductVisualType;
  };
  inCatalogue: boolean;
  cataloguePages: number[];
  leadArticleNumber: string;
  articleNumberSource?: string | null;
  relatedLegacySlug?: string | null;
  variantColumn: CatalogVariantColumn;
  variants: CatalogVariant[];
  sharedArticles?: { articleNumber: string; ownerSlug: string | null }[];
  aliasPages?: { officialName: string; url: string; articleNumbers: string[] }[];
  image: { src: string; width: number | null; height: number | null; hasAlpha: boolean } | null;
  /** `MISSING_OFFICIAL_ASSET`: aktivan proizvod bez zvanične slike — koristi se placeholder sajta. */
  missingOfficialAsset?: boolean;
  gallery: { src: string }[];
  documents: CatalogDocument[];
  content: {
    productType: string;
    subtype: string;
    shortDescription: string;
    longDescription: string;
    purpose: string;
    facts: { label: string; value: string }[];
    applications: string[];
    benefits: { title: string; description: string }[];
    substrates: string[];
    advice: string | null;
  };
  shade: { color: string; token?: string; series: string; source: string } | null;
};

type CatalogEnrichment = {
  sourceKey: string;
  sourceUrl: string;
  officialName: string;
  classification: string;
  variantColumn: CatalogVariantColumn;
  variants: CatalogVariant[];
  documents: CatalogDocument[];
  /**
   * Zvanični naziv i opis PORODICE za ručni zapis čiji naziv opisuje samo jednu
   * varijantu — samo uz ručnu odluku (`manual-decisions.json`). Slug ostaje.
   */
  presentation?: {
    name: string;
    officialName: string;
    leadArticleNumber: string;
    productType: string;
    shortDescription: string;
    longDescription: string;
    purpose: string;
    facts: { label: string; value: string }[];
  } | null;
};

const entries = catalogData.products as CatalogProductEntry[];
const enrichments = catalogData.enrichments as Record<string, CatalogEnrichment>;

export const carfitCatalogMeta = catalogData.meta;

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

/** Broj komada: sa zvanične stranice („50 pcs.”) ili iz kolone „Pcs./pack” kataloga. */
const alternateCodes = (variants: CatalogVariant[]) =>
  variants.flatMap((variant) => (variant.alternateArticleNumbers ?? []).map((alternate) => alternate.articleNumber));

const packLabel = (variant: CatalogVariant) =>
  variant.pieces ? `${variant.pieces} kom.` : variant.pcsPerPack ? `${variant.pcsPerPack} kom.` : "Na upit";

function variantSection(column: CatalogVariantColumn, variants: CatalogVariant[]): ProductVariantSection {
  const catalogueOnly = variants.filter((variant) => !variant.onWebsite).map((variant) => variant.articleNumber);
  return {
    title: "Varijante i šifre artikala",
    description:
      "Svaka varijanta ima zasebnu proizvođačku šifru. Dostupnost na domaćem tržištu proverava se kroz upit.",
    // Kolona sa varijantom je prva: `getPrimaryVariantColumn` za ključ van svoje
    // liste prioriteta bira prvu kolonu, a to mora biti varijanta, ne šifra.
    columns: [
      column,
      { key: "article", label: "Šifra artikla" },
      { key: "pack", label: "Fabričko pakovanje" },
      { key: "status", label: "Javni status" },
    ],
    rows: variants.map((variant) => ({
      id: variant.articleNumber,
      values: {
        [column.key]: variant.label,
        article: variant.articleNumber,
        pack: packLabel(variant),
        status: "Na upit",
      },
      reviewStatus: "confirmed" as const,
    })),
    note: [
      `Šifre i fabrička pakovanja: carfitrepair.com i ${carfitCatalogMeta.catalogue}.`,
      catalogueOnly.length
        ? `Šifre ${catalogueOnly.join(", ")} navodi katalog proizvođača; na stranici proizvoda trenutno nisu upisane.`
        : null,
      ...variants.flatMap((variant) =>
        (variant.alternateArticleNumbers ?? []).map(
          (alternate) =>
            `Šifra ${variant.articleNumber} je sa stranice proizvođača; ${alternate.source} istu varijantu vodi kao ${alternate.articleNumber} (verovatna slovna razlika kod proizvođača).`,
        ),
      ),
    ]
      .filter(Boolean)
      .join(" "),
  };
}

const COMPONENT_SUFFIX: Record<string, string> = {
  hardener: "učvršćivač",
  activator: "aktivator",
  mat: "mat",
  glossy: "sjaj",
};

function documentTitle(document: CatalogDocument) {
  const base = document.kind === "tds" ? "Tehnički list proizvođača" : "Bezbednosni list proizvođača";
  const component = document.component ? COMPONENT_SUFFIX[document.component.toLowerCase()] ?? document.component : null;
  return component ? `${base} (${component})` : base;
}

function detailDocuments(slug: string, documents: CatalogDocument[]): ProductDetailDocument[] {
  return documents
    .filter((document) => document.kind === "tds" || document.kind === "sds")
    .map((document, index) => ({
      id: `${slug}-${document.kind}-${index}`,
      title: documentTitle(document),
      kind: document.kind === "tds" ? ("tds" as const) : ("sds" as const),
      availability: "available" as const,
      href: document.href,
      language: document.language ?? undefined,
      note: "Zvanični dokument na carfitrepair.com",
      reviewStatus: "confirmed" as const,
    }));
}

function legacyDocuments(productName: string, documents: CatalogDocument[]): ProductDocument[] {
  const tds = documents.find((document) => document.kind === "tds");
  const sds = documents.find((document) => document.kind === "sds" && !document.component);
  return [
    tds
      ? { title: "Tehnički list", kind: "PDF", href: tds.href, status: "available", note: "Zvanični tehnički list proizvođača." }
      : { title: "Tehnički list", kind: "PDF", status: "placeholder", note: `Dostupno na upit za ${productName}.` },
    sds
      ? { title: "Bezbednosni list", kind: "PDF", href: sds.href, status: "available", note: "Zvanični bezbednosni list proizvođača." }
      : { title: "Bezbednosni list", kind: "PDF", status: "placeholder", note: "Dostavlja se kada je primenljivo za potvrđen artikal." },
  ];
}

function summarizeVariants(entry: CatalogProductEntry) {
  const labels = entry.variants.map((variant) => variant.label);
  if (labels.length === 1) return labels[0];
  return `${labels.length} varijanti`;
}

function createCatalogProduct(entry: CatalogProductEntry, knownSlugs: Set<string>): CarsystemProduct {
  const { content } = entry;
  const variantSummary = summarizeVariants(entry);
  const imageAlt = `${entry.name}, ${content.productType.toLocaleLowerCase("sr-Latn")}`;
  const related = [
    ...new Set(
      (entry.sharedArticles ?? [])
        .map((shared) => shared.ownerSlug)
        .filter((slug): slug is string => Boolean(slug) && knownSlugs.has(slug as string)),
    ),
  ];
  const documents = detailDocuments(entry.slug, entry.documents);

  const detail: ProductDetailContent = {
    reviewStatus: "confirmed",
    hero: {
      kicker: `Car Fit · ${CATEGORY_BADGE[entry.taxonomy.category]}`,
      subtype: content.subtype,
      lead: content.shortDescription,
    },
    ...(entry.variants.length > 1
      ? { variants: { reviewStatus: "confirmed", content: variantSection(entry.variantColumn, entry.variants) } }
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
        ...content.facts.map((fact) => ({ ...fact, reviewStatus: "confirmed" as const })),
        ...(content.substrates.length
          ? [{ label: "Podloge", value: content.substrates.join(", "), reviewStatus: "confirmed" as const }]
          : []),
        ...(entry.variants.length === 1
          ? [
              { label: "Šifra artikla", value: entry.leadArticleNumber, reviewStatus: "confirmed" as const },
              { label: "Pakovanje", value: entry.variants[0].label, reviewStatus: "confirmed" as const },
            ]
          : []),
        ...(entry.sharedArticles ?? []).map((shared) => ({
          label: "Šifra u sistemu",
          value: shared.articleNumber,
          detail: "Proizvođač ovu šifru navodi i na stranici drugog proizvoda, uz koji se vodi u katalogu.",
          reviewStatus: "confirmed" as const,
        })),
        ...(entry.aliasPages ?? []).map((alias) => ({
          label: "Isti artikal na sajtu proizvođača",
          value: `${alias.officialName} (${alias.articleNumbers.join(", ")})`,
          reviewStatus: "confirmed" as const,
        })),
      ],
    },
    ...(documents.length ? { documents: { reviewStatus: "confirmed", content: documents } } : {}),
    ...(related.length
      ? {
          compatibleProducts: {
            reviewStatus: "confirmed",
            content: {
              title: "Koristi se zajedno sa",
              description: "Proizvod uz koji proizvođač navodi zajedničku šifru artikla.",
              items: related.map((productSlug) => ({ productSlug, reviewStatus: "confirmed" as const })),
            },
          },
        }
      : {}),
  };

  return {
    slug: entry.slug,
    name: entry.name,
    brandSlug: "carfit",
    programSlug: entry.taxonomy.programSlug,
    phaseSlug: entry.taxonomy.phaseSlug,
    shortDescription: content.shortDescription,
    longDescription: content.longDescription,
    // Vodeća zvanična šifra artikla — nije izmišljen placeholder.
    sku: entry.leadArticleNumber,
    externalSku: entry.leadArticleNumber,
    manufacturerCode: entry.variants.length === 1 ? entry.leadArticleNumber : null,
    // Alternativni zvanični zapis šifre: pretraživ (exact-code), nije varijanta.
    legacyManufacturerCodes: alternateCodes(entry.variants),
    packages: [{ label: variantSummary, detail: entry.variantColumn.label }],
    purpose: content.purpose,
    badges: [content.productType, ...(entry.variants.length > 1 ? [variantSummary] : []), "Na upit"],
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
    documents: legacyDocuments(entry.name, entry.documents),
    relatedProductSlugs: related,
    seoTitle: `${entry.name} | Car Fit`,
    seoDescription: content.shortDescription,
    // Kupac traži „gold paper P80” ili „lak 2,5 l”: oznake varijanti su pojmovi pretrage.
    searchTerms: [...new Set(entry.variants.map((variant) => variant.label))],
    taxonomyCategory: entry.taxonomy.category,
    manufacturerColor: entry.shade ?? undefined,
    detail,
  };
}

const knownSlugs = new Set([...entries.map((entry) => entry.slug), ...Object.keys(enrichments)]);

export function getCarfitCatalogProducts(): CarsystemProduct[] {
  return entries.map((entry) => createCatalogProduct(entry, knownSlugs));
}

/**
 * Ručni zapis „… 4 x 5 m” je dokazano cela zvanična porodica sa više dimenzija:
 * naziv, opis, sažetak pakovanja i prikazana šifra više ne smeju da sugerišu jednu
 * dimenziju. Menja se samo PRIKAZ — slug, slika, dokumenti i veze zapisa ostaju.
 */
function withOfficialPresentation(product: CarsystemProduct, enrichment: CatalogEnrichment): CarsystemProduct {
  const presentation = enrichment.presentation;
  if (!presentation) return product;
  const labels = enrichment.variants.map((variant) => variant.label);
  const summary = `${labels.length} varijante`;
  return {
    ...product,
    name: presentation.name,
    shortDescription: presentation.shortDescription,
    longDescription: presentation.longDescription,
    purpose: presentation.purpose,
    // Zvanična šifra potvrđene varijante umesto placeholder oznake „…-4X5M”.
    sku: presentation.leadArticleNumber,
    externalSku: presentation.leadArticleNumber,
    manufacturerCode: null,
    packages: [{ label: summary, detail: enrichment.variantColumn.label }],
    specifications: [
      { label: "Tip proizvoda", value: presentation.productType },
      ...presentation.facts,
      { label: enrichment.variantColumn.label, value: labels.join(", ") },
    ],
    seoTitle: `${presentation.name} | Car Fit`,
    seoDescription: presentation.shortDescription,
  };
}

/**
 * Dopuna RUČNOG C.A.R.FIT zapisa zvaničnim šiframa artikala.
 *
 * Dodaje samo ono što zapisu nedostaje: tabelu varijanti (ili redove koji u njoj
 * fale). Naziv, slug, opisi, slike, dokumenti i `sku` ostaju kakvi jesu.
 *
 * Zapis bez `detail` bloka PDP čita iz `specifications`/`documents`. Čim `detail`
 * postoji, PDP čita samo njega, pa se postojeće specifikacije i dokumenti prenose
 * u `detail` istim pravilom koje PDP koristi za stare zapise.
 */
export function applyCarfitCatalogEnrichment(record: CarsystemProduct): CarsystemProduct {
  const enrichment = enrichments[record.slug];
  if (!enrichment) return record;
  const product = withOfficialPresentation(record, enrichment);

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
                values: { [column.key]: variant.label, article: variant.articleNumber, pack: packLabel(variant), status: "Na upit" },
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
      variants: { reviewStatus: "confirmed", content: variantSection(enrichment.variantColumn, enrichment.variants) },
    },
  };
}
