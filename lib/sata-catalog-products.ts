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

/**
 * FAZA 2 — samostalan i vezan SATA pribor.
 *
 * Višečlana kartica je `LOCAL_CATALOG_GROUPING`: kataloška grupa SAJTA, sklopljena iz zvaničnih naziva artikala
 * (`scripts/sata-sync/lib/phase2-grouping.mjs`). NIJE zvanična SATA porodica i tako se nigde ne predstavlja; svaki
 * red čuva svoj zvanični naziv i broj artikla. Redovi koriste istu tabelu kao faza 1 (bez novog birača).
 */
type Phase2Variant = {
  articleNumber: string;
  label: string;
  officialName: string;
  values: Record<string, string>;
  compat: string | null;
  soldByMeter: boolean;
  notice: string | null;
};

type Phase2Entry = {
  slug: string;
  name: string;
  nameSource: "LOCALIZED" | "OFFICIAL_NAME_FALLBACK";
  officialName: string | null;
  grouping: "LOCAL_CATALOG_GROUPING" | "SINGLE_OFFICIAL_ARTICLE";
  groupingTier: number | null;
  classification: string;
  duplicateOfficialNames: string | null;
  functionalClass: string;
  productType: string;
  taxonomy: SyncEntry["taxonomy"];
  axes: { key: string; label: string }[];
  relatedFamilySlugs: string[];
  variants: Phase2Variant[];
  imageStatus: string;
  sourceHash: string;
};

const entries = catalogData.products as SyncEntry[];
// Opciono: plan učitava runtime iz PRETHODNOG dataseta, koji (pre prvog apply-a faze 2) nema ovaj ključ.
const phase2Data = (catalogData as { phase2?: { products: Phase2Entry[]; links: Record<string, string[]> } }).phase2;
const phase2Entries = phase2Data?.products ?? [];
const phase2Links = phase2Data?.links ?? {};
const phase2BySlug = new Map(phase2Entries.map((entry) => [entry.slug, entry]));
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

/** Pribor faze 2 vezan za ovu porodicu — postojeći odeljak PDP-a „Koristi se zajedno sa”. Veće grupe idu prve. */
function accessoryLinks(familySlug: string): ProductDetailContent["compatibleProducts"] | undefined {
  const slugs = [...(phase2Links[familySlug] ?? [])].sort(
    (a, b) => (phase2BySlug.get(b)?.variants.length ?? 0) - (phase2BySlug.get(a)?.variants.length ?? 0) || a.localeCompare(b),
  );
  if (!slugs.length) return undefined;
  return {
    reviewStatus: "confirmed",
    content: {
      title: "Koristi se zajedno sa",
      description: "Zvaničan SATA pribor koji proizvođač u nazivu artikla navodi za ovu porodicu.",
      items: slugs.map((productSlug) => ({ productSlug, reviewStatus: "confirmed" as const })),
    },
  };
}

function detailOf(entry: SyncEntry): ProductDetailContent {
  const accessories = accessoryLinks(entry.slug);
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
    ...(accessories ? { compatibleProducts: accessories } : {}),
  };
}

/* ── Faza 2 ─────────────────────────────────────────────────────────────────────────────────── */

const pluralIzvedba = (count: number) => {
  const mod10 = count % 10;
  const mod100 = count % 100;
  return mod10 === 1 && mod100 !== 11 ? "izvedba" : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? "izvedbe" : "izvedbi";
};

function phase2Description(entry: Phase2Entry) {
  const count = entry.variants.length;
  const first = entry.variants[0];
  if (count === 1) {
    return [
      `${entry.name}. Zvanični SATA naziv: „${first.officialName.replace(/,?\s*(?:net\s+)?price\s+(?:net\s+)?per\s+met(?:er|re)/gi, "").replace(/\s*(?:Please observe|Important):.*$/i, "")}”.`,
      first.soldByMeter ? "Prodaje se na metar." : null,
      first.notice ? `Napomena proizvođača: ${first.notice}.` : null,
      `SATA broj artikla ${first.articleNumber}. Dostupnost se potvrđuje kroz upit.`,
    ].filter(Boolean).join(" ");
  }
  return `${entry.name}: ${count} ${pluralIzvedba(count)}, svaka sa svojim zvaničnim SATA nazivom i brojem artikla. Izvedbe su u katalogu sajta prikazane zajedno radi preglednosti. Tačna izvedba i dostupnost potvrđuju se kroz upit.`;
}

function phase2VariantSection(entry: Phase2Entry): ProductVariantSection {
  return {
    title: "Izvedbe i brojevi artikala",
    description:
      "Svaka izvedba je zaseban zvanični SATA artikal sa svojim brojem. Izvedbe su grupisane u katalogu sajta radi preglednosti; tačna izvedba i dostupnost potvrđuju se kroz upit.",
    columns: [
      { key: "config", label: "Izvedba" },
      ...entry.axes.map((axis) => ({ key: `axis-${axis.key}`, label: axis.label })),
      { key: "article", label: "Broj artikla" },
      { key: "status", label: "Javni status" },
    ],
    rows: entry.variants.map((variant) => ({
      id: variant.articleNumber,
      values: {
        ...Object.fromEntries(Object.entries(variant.values).map(([key, value]) => [`axis-${key}`, value])),
        config: variant.label,
        article: variant.articleNumber,
        status: variant.soldByMeter ? "Na upit · prodaje se na metar" : "Na upit",
      },
      reviewStatus: "confirmed" as const,
    })),
    note: entry.duplicateOfficialNames
      ? "Proizvođač ovaj proizvod trenutno vodi pod dva broja artikla sa istim nazivom; oba su navedena. Brojevi artikala: sata.com."
      : "Brojevi artikala i zvanični nazivi: sata.com.",
  };
}

function createPhase2Product(entry: Phase2Entry): CarsystemProduct {
  const count = entry.variants.length;
  const single = count === 1 ? entry.variants[0] : null;
  const description = phase2Description(entry);
  const summary = single ? `Art. ${single.articleNumber}` : `${count} ${pluralIzvedba(count)}`;
  const related = entry.relatedFamilySlugs;
  const facts = [
    { label: "Tip proizvoda", value: entry.productType },
    ...(single
      ? [
          { label: "Broj artikla", value: single.articleNumber },
          { label: "Zvanični SATA naziv", value: single.officialName.replace(/,?\s*(?:net\s+)?price\s+(?:net\s+)?per\s+met(?:er|re)/gi, "") },
          ...(single.soldByMeter ? [{ label: "Prodaja", value: "Prodaje se na metar" }] : []),
          ...(single.notice ? [{ label: "Napomena proizvođača", value: single.notice }] : []),
        ]
      : []),
  ];

  return {
    slug: entry.slug,
    name: entry.name,
    brandSlug: "sata",
    programSlug: entry.taxonomy.programSlug,
    phaseSlug: entry.taxonomy.phaseSlug,
    shortDescription: description,
    longDescription: description,
    // Interni ključ kartice; brojevi artikala su u redovima (kao u fazi 1).
    sku: single ? single.articleNumber : entry.slug.toUpperCase(),
    externalSku: single ? single.articleNumber : entry.slug,
    manufacturerCode: single ? single.articleNumber : null,
    ...(single ? {} : { publicCode: summary }),
    packages: [{ label: summary, detail: "Izvedba po upitu" }],
    purpose: entry.productType,
    badges: [entry.productType, ...(single ? [] : [summary]), "Na upit"],
    publicStatus: "Na upit",
    stockStatus: "unknown",
    stockManaged: false,
    productImage: { src: PLACEHOLDER_PRODUCT_IMAGE, alt: `${entry.name} — vizuel u pripremi` },
    galleryImages: [],
    specifications: facts,
    documents: [],
    relatedProductSlugs: related,
    seoTitle: `${entry.name} | SATA`,
    seoDescription: description.slice(0, 300),
    taxonomyCategory: entry.taxonomy.category,
    // Pretraga: zvanični naziv svakog reda, broj artikla, oznaka reda (atributi) i klauzula kompatibilnosti.
    searchTerms: [
      ...new Set(
        entry.variants.flatMap((variant) => [variant.articleNumber, variant.officialName, variant.label, ...(variant.compat ? [variant.compat] : [])]),
      ),
    ],
    detail: {
      reviewStatus: "confirmed",
      hero: {
        kicker: `SATA · ${CATEGORY_BADGE[entry.taxonomy.category] ?? "Pribor"}`,
        subtype: entry.productType,
        lead: description,
      },
      ...(single ? {} : { variants: { reviewStatus: "confirmed", content: phase2VariantSection(entry) } }),
      technicalFacts: { reviewStatus: "confirmed", content: facts.map((fact) => ({ ...fact, reviewStatus: "confirmed" as const })) },
      ...(related.length
        ? {
            compatibleProducts: {
              reviewStatus: "confirmed",
              content: {
                title: "Koristi se zajedno sa",
                description: "SATA proizvod koji proizvođač navodi u zvaničnom nazivu ovog pribora.",
                items: related.map((productSlug) => ({ productSlug, reviewStatus: "confirmed" as const })),
              },
            },
          }
        : {}),
    },
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
  return [...entries.map(createCatalogProduct), ...phase2Entries.map(createPhase2Product)];
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
