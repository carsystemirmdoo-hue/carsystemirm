import catalogData from "@/data/sata-catalog-products.generated.json";
import type {
  CarsystemProduct,
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
 * SATA porodice uvezene sa sata.com/en (`npm run sata:sync`).
 *
 * Isti obrazac kao ostali sync adapteri: skripta piše
 * `data/sata-catalog-products.generated.json`, a ovaj modul ga samo prevodi u
 * `CarsystemProduct`. Ovde nema poslovnih odluka.
 *
 * OPSEG je „SATA EMEA REFINISH FAMILY SCOPE” — odobrene aktuelne porodice za
 * auto-reparaturu, NE ceo SATA katalog. SATA sama vodi brojeve artikala kao
 * konfiguracije jedne porodice, pa je ovde porodica = kartica, a broj artikla = red
 * tabele varijanti.
 *
 * Slike: pravo korišćenja SATA fotografija nije potvrđeno. Dataset zato ne sadrži
 * nijednu adresu slike, a svaka kartica koristi placeholder sajta — i kada proizvođač
 * sliku ima (`OFFICIAL_IMAGE_AVAILABLE_NOT_APPROVED_FOR_RUNTIME`) i kada je nema
 * (`OFFICIAL_IMAGE_NOT_PUBLISHED`).
 *
 * Cene i zalihe se ne uvoze — „Na upit”.
 */

type SyncDocument = {
  kind: "manual" | "declaration" | "brochure";
  title: string;
  href: string;
  language: string | null;
};

type SyncVariant = {
  articleNumber: string;
  config: string;
  officialName: string;
  values: Record<string, string>;
};

type SyncEntry = {
  slug: string;
  name: string;
  officialName: string;
  familyId: string;
  sourceAliases: string[];
  sourceUrl: string;
  sataCategory: string;
  taxonomy: {
    category: ProductCategorySlug;
    programSlug: string;
    phaseSlug: RefinishPhaseSlug;
    visualType: ProductVisualType;
  };
  content: {
    productType: string;
    shortDescription: string;
    longDescription: string;
    purpose: string;
  };
  facts: { label: string; value: string }[];
  variantColumns: { key: string; label: string }[];
  variants: SyncVariant[];
  /** Opciono: plan učitava runtime iz PRETHODNOG dataseta, koji ovo polje još nema. */
  sourceAxisTerms?: string[];
  documents: SyncDocument[];
  imageStatus: string;
  sourceHash: string;
};

const entries = catalogData.products as SyncEntry[];
const enrichments = catalogData.enrichments as Record<string, SyncEntry>;

export const sataCatalogMeta = catalogData.meta;

const CATEGORY_BADGE: Partial<Record<ProductCategorySlug, string>> = {
  oprema: "Oprema",
  pribor: "Pribor",
  zastita: "Zaštita",
  radionica: "Radionica",
};

/** Isti placeholder koji `createProduct` u `lib/carsystem-data.ts` daje zapisima bez slike. */
const PLACEHOLDER_PRODUCT_IMAGE = "/images/products/placeholder-product.svg";

const LANGUAGE_LABEL: Record<string, string> = { multilingual: "višejezično", en: "engleski" };

function variantSection(entry: SyncEntry): ProductVariantSection {
  return {
    title: "Konfiguracije i brojevi artikala",
    description:
      "Svaka konfiguracija ima zaseban zvanični SATA broj artikla. Tačna konfiguracija i dostupnost potvrđuju se kroz upit.",
    columns: entry.variantColumns,
    rows: entry.variants.map((variant) => ({
      id: variant.articleNumber,
      values: {
        ...variant.values,
        config: variant.config,
        article: variant.articleNumber,
        status: "Na upit",
      },
      reviewStatus: "confirmed" as const,
    })),
    note: "Brojevi artikala i konfiguracije: sata.com.",
  };
}

function detailDocuments(entry: SyncEntry): ProductDetailDocument[] {
  return entry.documents.map((document, index) => ({
    id: `${entry.slug}-${document.kind}-${index}`,
    title: document.title,
    kind: document.kind === "manual" ? ("instructions" as const) : document.kind === "brochure" ? ("flyer" as const) : ("other" as const),
    availability: "available" as const,
    href: document.href,
    language: document.language ? LANGUAGE_LABEL[document.language] : undefined,
    reviewStatus: "confirmed" as const,
  }));
}

function summarizeVariants(entry: SyncEntry) {
  const count = entry.variants.length;
  if (count === 1) return `Art. ${entry.variants[0].articleNumber}`;
  const mod10 = count % 10;
  const mod100 = count % 100;
  const noun = mod10 === 1 && mod100 !== 11 ? "konfiguracija" : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? "konfiguracije" : "konfiguracija";
  return `${count} ${noun}`;
}

function detailOf(entry: SyncEntry): ProductDetailContent {
  return {
    reviewStatus: "confirmed",
    hero: {
      kicker: `SATA · ${CATEGORY_BADGE[entry.taxonomy.category] ?? "Oprema"}`,
      subtype: entry.content.productType,
      lead: entry.content.shortDescription,
    },
    ...(entry.variants.length > 1 ? { variants: { reviewStatus: "confirmed", content: variantSection(entry) } } : {}),
    technicalFacts: {
      reviewStatus: "confirmed",
      content: [
        { label: "Tip proizvoda", value: entry.content.productType, reviewStatus: "confirmed" },
        ...entry.facts.map((fact) => ({ ...fact, reviewStatus: "confirmed" as const })),
        ...(entry.variants.length === 1
          ? [{ label: "Broj artikla", value: entry.variants[0].articleNumber, reviewStatus: "confirmed" as const }]
          : []),
      ],
    },
    ...(entry.documents.length ? { documents: { reviewStatus: "confirmed", content: detailDocuments(entry) } } : {}),
  };
}

/** Kupac traži „1061697”, „jet X RP 1,3” ili „Luftmikrometer”: brojevi artikala i zvanični nazivi su pojmovi pretrage. */
function searchTermsOf(entry: SyncEntry) {
  return [
    ...new Set([
      entry.officialName,
      entry.familyId,
      ...entry.sourceAliases,
      ...entry.variants.map((variant) => variant.articleNumber),
      ...entry.variants.map((variant) => variant.config),
      // zvanične (neprevedene) vrednosti osa: „Druckbecher BVD 0,7 l”, „with swivel joint”…
      ...(entry.sourceAxisTerms ?? []),
    ]),
  ];
}

function documentsOf(entry: SyncEntry) {
  return entry.documents.map((document) => ({
    title: document.title,
    kind: "PDF",
    href: document.href,
    status: "available" as const,
    note: document.language ? LANGUAGE_LABEL[document.language] : undefined,
  }));
}

function createCatalogProduct(entry: SyncEntry): CarsystemProduct {
  const variantSummary = summarizeVariants(entry);
  const single = entry.variants.length === 1 ? entry.variants[0].articleNumber : null;

  return {
    slug: entry.slug,
    name: entry.name,
    brandSlug: "sata",
    programSlug: entry.taxonomy.programSlug,
    phaseSlug: entry.taxonomy.phaseSlug,
    shortDescription: entry.content.shortDescription,
    longDescription: entry.content.longDescription,
    // Zvanični identifikator porodice na sata.com — NIJE broj artikla; brojevi artikala su u redovima.
    sku: entry.familyId,
    externalSku: single ?? entry.familyId,
    manufacturerCode: single,
    packages: [{ label: variantSummary, detail: "Konfiguracija po upitu" }],
    purpose: entry.content.purpose,
    badges: [entry.content.productType, ...(entry.variants.length > 1 ? [variantSummary] : []), "Na upit"],
    publicStatus: "Na upit",
    stockStatus: "unknown",
    stockManaged: false,
    productImage: { src: PLACEHOLDER_PRODUCT_IMAGE, alt: `${entry.name} — vizuel u pripremi` },
    galleryImages: [],
    specifications: [{ label: "Tip proizvoda", value: entry.content.productType }, ...entry.facts],
    documents: documentsOf(entry),
    relatedProductSlugs: [],
    seoTitle: `${entry.name} | SATA`,
    seoDescription: entry.content.shortDescription,
    taxonomyCategory: entry.taxonomy.category,
    searchTerms: searchTermsOf(entry),
    detail: detailOf(entry),
  };
}

export function getSataCatalogProducts(): CarsystemProduct[] {
  return entries.map(createCatalogProduct);
}

/**
 * Dopuna ručnog zapisa koji je sync prepoznao kao zvaničnu porodicu (`satajet-x-5500`).
 *
 * Slug, adresa, ime, opisi, interna oznaka i preporuke OSTAJU njegovi. Dodaje se ono što
 * zvanični izvor potvrđuje: tabela konfiguracija sa brojevima artikala, tehničke činjenice,
 * dokumenti, taksonomija i pojmovi pretrage.
 *
 * `sku` (`SATA-X5500`) se NE menja: to je interni ključ iz koga nastaju `?varijanta=` adrese i
 * ostaje pretraživ kao stara lokalna oznaka. Javno se prikazuje zvanični identifikator porodice
 * (`publicCode` / `manufacturerCode` = `CF1931072`), isto kao kod ostalih 65 SATA kartica.
 */
export function applySataSyncEnrichment(record: CarsystemProduct): CarsystemProduct {
  const entry = enrichments[record.slug];
  if (!entry) return record;

  const synced = detailOf(entry);
  const knownLabels = new Set((record.specifications ?? []).map((fact) => fact.label));

  return {
    ...record,
    publicCode: entry.familyId,
    manufacturerCode: entry.familyId,
    externalSku: entry.familyId,
    taxonomyCategory: entry.taxonomy.category,
    programSlug: entry.taxonomy.programSlug,
    packages: [{ label: summarizeVariants(entry), detail: "RP ili HVLP, mlaz I ili O" }],
    // Zvanični dokumenti zamenjuju raniji „dokumentacija je na sata.com” placeholder.
    documents: documentsOf(entry).length ? documentsOf(entry) : record.documents,
    specifications: [...(record.specifications ?? []), ...entry.facts.filter((fact) => !knownLabels.has(fact.label))],
    // Stara lokalna oznaka ostaje pojam pretrage i kada je više niko ne vidi na kartici.
    searchTerms: [...new Set([...(record.searchTerms ?? []), record.sku, ...searchTermsOf(entry)])],
    detail: {
      ...synced,
      ...(record.detail ?? {}),
      reviewStatus: "confirmed",
      hero: record.detail?.hero ?? {
        kicker: synced.hero?.kicker ?? "SATA · Oprema",
        subtype: entry.content.productType,
        lead: record.shortDescription,
      },
      variants: synced.variants,
      technicalFacts: {
        reviewStatus: "confirmed",
        content: [
          ...(record.specifications ?? []).filter((fact) => fact.label && fact.value).map((fact) => ({ ...fact, reviewStatus: "confirmed" as const })),
          ...entry.facts.filter((fact) => !knownLabels.has(fact.label)).map((fact) => ({ ...fact, reviewStatus: "confirmed" as const })),
        ],
      },
      documents: synced.documents,
    },
  };
}
