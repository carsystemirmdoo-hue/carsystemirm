import importedData from "@/data/rm-imported-products.generated.json";
import type {
  CarsystemProduct,
  ProductDocument,
  ProductSpecification,
  RefinishPhaseSlug,
  RmCategorySlug,
  RmFinishSlug,
  RmSeriesSlug,
  RmSystemSlug,
  RmTechnologySlug,
} from "@/lib/carsystem-data";
import type {
  ContentReviewStatus,
  ProductDetailContent,
  ProductDetailDocument,
  ProductProcessApplication,
  ProductTechnicalFact,
} from "@/types/product-detail";

export type RmImportedProductSource = {
  sourceFolder: string;
  canonicalName: string;
  productCode: string | null;
  imagePath: string | null;
  productPdfPath: string | null;
  technicalPdfPath: string | null;
  isDuplicate: boolean;
  importStatus:
    | "ready"
    | "duplicate"
    | "missing-image"
    | "missing-documentation";
  duplicateOf?: string | null;
};

type ImportedProductEntry = {
  slug: string;
  canonicalName: string;
  productCode: string;
  image: {
    alt: string;
    assetSource: "user-prepared" | "supplied-product-archive";
    originalFilename: string;
    sourceSha256: string;
    src: string;
  };
  documents: {
    productInformation: string;
    technicalDataSheet: string | null;
  };
  taxonomy: {
    category: RmCategorySlug;
    finish: RmFinishSlug | null;
    phaseSlug: RefinishPhaseSlug;
    programSlug: "boje-i-lakovi" | "priprema-povrsine";
    series: RmSeriesSlug | null;
    system: RmSystemSlug | null;
    technology: RmTechnologySlug | null;
  };
  content: {
    benefit: string;
    context: string;
    purpose: string;
    shortDescription: string;
    technicalReviewStatus: ContentReviewStatus;
  };
  contentReview: {
    status: ContentReviewStatus;
    notes: string[];
  };
  source: {
    sourceFolder: string;
    technicalPdfOriginalFilename: string | null;
    productPdfOriginalFilename: string;
  };
};

export type RmImportedProductsAudit = {
  folderCount: number;
  foldersWithDocumentation: number;
  foldersWithImage: number;
  uniqueProductCount: number;
  duplicateFolders: string[];
  duplicateCanonicalSlug: string;
  duplicateImageGroupCount: number;
  duplicatePdfGroupCount: number;
  emptyFolders: string[];
  canonicalProductInformationPdfCount: number;
  canonicalTechnicalPdfCount: number;
  contentReviewCount: number;
};

const entries = importedData.products as ImportedProductEntry[];

export const rmImportedProductsAudit =
  importedData.audit as RmImportedProductsAudit;

export const rmImportedProductSources =
  importedData.sources as RmImportedProductSource[];

export const rmImportedProducts: CarsystemProduct[] = entries.map((entry) =>
  createImportedProduct(entry, entries),
);

function createImportedProduct(
  entry: ImportedProductEntry,
  allEntries: ImportedProductEntry[],
): CarsystemProduct {
  const categoryLabel = getCategoryLabel(entry.taxonomy.category);
  const contextLabel = entry.content.context;
  const relatedProductSlugs = getRelatedSlugs(entry, allEntries);
  const documents = getLegacyDocuments(entry);
  const specifications = getSpecifications(entry);

  return {
    slug: entry.slug,
    name: entry.canonicalName,
    brandSlug: "rm",
    programSlug: entry.taxonomy.programSlug,
    phaseSlug: entry.taxonomy.phaseSlug,
    shortDescription: entry.content.shortDescription,
    longDescription: `${entry.content.shortDescription} Proizvod je povezan sa lokalno sačuvanim R-M product-information materijalom${entry.documents.technicalDataSheet ? " i tehničkim listom" : ""}. Komercijalna dostupnost, pakovanje i uslovi nabavke potvrđuju se kroz upit.`,
    sku: entry.productCode,
    externalSku: entry.productCode,
    packages: [
      {
        label: "Na upit",
        detail: "Pakovanje i lokalna dostupnost nisu potvrđeni dostavljenom ZIP dokumentacijom.",
      },
    ],
    purpose: entry.content.purpose,
    badges: [contextLabel, categoryLabel, "Na upit"],
    publicStatus: "Na upit",
    stockStatus: "unknown",
    stockManaged: false,
    productImage: {
      src: entry.image.src,
      alt: entry.image.alt,
    },
    galleryImages: [],
    specifications,
    documents,
    relatedProductSlugs,
    seoTitle: `${entry.canonicalName} | R-M`,
    seoDescription: entry.content.shortDescription,
    rmMetadata: {
      system: entry.taxonomy.system,
      series: entry.taxonomy.series,
      category: entry.taxonomy.category,
      technology: entry.taxonomy.technology,
      finish: entry.taxonomy.finish,
    },
    recommendations: relatedProductSlugs.map((productId, index) => ({
      productId,
      relationType: "same-brand",
      status: "confirmed",
      priority: index + 1,
      internalReason: "Isti potvrđeni R-M sistem, serija ili produktna kategorija iz dostavljenog ZIP-a.",
    })),
    detail: getProductDetail(entry, categoryLabel, contextLabel),
  };
}

function getProductDetail(
  entry: ImportedProductEntry,
  categoryLabel: string,
  contextLabel: string,
): ProductDetailContent {
  const process = getProcess(entry.taxonomy.category);
  const technicalFacts = getReviewedTechnicalFacts(entry);
  const documents = getReviewedDocuments(entry);

  return {
    reviewStatus: "confirmed",
    hero: {
      kicker: contextLabel,
      subtype: categoryLabel,
      lead: entry.content.shortDescription,
    },
    quickFacts: {
      reviewStatus: "confirmed",
      content: [
        {
          label: "R-M oznaka",
          value: entry.productCode,
          reviewStatus: "confirmed",
        },
        {
          label: "Sistem / serija",
          value: contextLabel,
          reviewStatus: "confirmed",
        },
        {
          label: "Kategorija",
          value: categoryLabel,
          reviewStatus: "confirmed",
        },
      ],
    },
    benefits: {
      reviewStatus: "confirmed",
      content: {
        title: "Dokumentovana uloga proizvoda",
        description:
          "Sažetak se zasniva na zvaničnim R-M informacijama o proizvodu i, kada postoji, na tehničkom listu.",
        items: [
          {
            title: "Uloga u procesu",
            description: entry.content.benefit,
            reviewStatus: "confirmed",
          },
          {
            title: "Dokumentacija",
            description: entry.documents.technicalDataSheet
              ? "Uz ovaj proizvod su dostupni zvanične informacije o proizvodu i tehnički list."
              : "Uz ovaj proizvod su dostupne zvanične informacije o proizvodu; zaseban tehnički list trenutno nije dostupan.",
            reviewStatus: "confirmed",
          },
        ],
      },
    },
    process: {
      reviewStatus: "confirmed",
      content: process,
    },
    technology: {
      reviewStatus: "confirmed",
      content: {
        kicker: "R-M sistemska arhitektura",
        title: `${contextLabel} · ${categoryLabel}`,
        description:
          "Tehnologija i kompatibilne komponente proveravaju se prema povezanom tehničkom listu. Stranica ne pretpostavlja pakovanje, mešanje ili lokalnu dostupnost.",
      },
    },
    technicalFacts: {
      reviewStatus: entry.content.technicalReviewStatus,
      content: technicalFacts,
      reviewerNote:
        entry.content.technicalReviewStatus === "needs_confirmation"
          ? "Dostavljeni folder nema zaseban tehnički list."
          : undefined,
    },
    documents: {
      reviewStatus: "confirmed",
      content: documents,
    },
    finalCta: {
      title: `Proverite ${entry.canonicalName} za svoj proces.`,
      description:
        "Pošaljite nam podatke o poslu kako bismo proverili lokalnu dostupnost, pakovanje i odgovarajuće sistemske komponente.",
      inquiryLabel: "Pošaljite upit",
      storeLabel: "Pronađite prodavnicu",
    },
  };
}

function getProcess(category: RmCategorySlug): ProductProcessApplication {
  if (category === "bodyfiller") {
    return {
      title: "Mesto u pripremnom procesu",
      description: "Kit se koristi u pripremi i ravnanju površine pre podloge.",
      mode: "multi-phase",
      stages: ["Priprema podloge", "Nanošenje kita", "Obrada prema tehničkom listu"].map(
        (label) => ({ label, reviewStatus: "confirmed" as const }),
      ),
    };
  }
  if (category === "primer-filler") {
    return {
      title: "Mesto u sistemu podloge",
      description: "Prajmer ili punilac priprema stabilnu podlogu pre sistema boje.",
      mode: "multi-phase",
      stages: ["Priprema", "Prajmer / punilac", "Bazna boja"].map((label) => ({
        label,
        reviewStatus: "confirmed" as const,
      })),
    };
  }
  if (category === "basecoat") {
    return {
      title: "Mesto u sistemu boje",
      description: "Bazna komponenta povezuje pripremljenu podlogu i odgovarajuću završnicu.",
      mode: "multi-phase",
      stages: ["Podloga", "Bazna boja", "Završni lak"].map((label) => ({
        label,
        reviewStatus: "confirmed" as const,
      })),
    };
  }
  if (category === "clearcoat") {
    return {
      title: "Mesto u završnom procesu",
      description: "Bezbojni lak je završni sloj odgovarajućeg R-M sistema boje.",
      mode: "multi-phase",
      stages: ["Bazna boja", "Bezbojni lak", "Sušenje prema tehničkom listu"].map(
        (label) => ({ label, reviewStatus: "confirmed" as const }),
      ),
    };
  }
  return {
    title: "Sistemska komponenta",
    description:
      "Proizvod se koristi samo sa kompatibilnim materijalima i parametrima iz tehničkog lista.",
    mode: "supporting-process",
    stages: ["Izbor sistema", "Doziranje prema tehničkom listu", "Primena"].map(
      (label) => ({ label, reviewStatus: "confirmed" as const }),
    ),
  };
}

function getReviewedTechnicalFacts(
  entry: ImportedProductEntry,
): ProductTechnicalFact[] {
  const baseFacts: ProductTechnicalFact[] = [
    {
      label: "R-M oznaka",
      value: entry.productCode,
      reviewStatus: "confirmed",
    },
    {
      label: "Sistem / serija",
      value: entry.content.context,
      reviewStatus: "confirmed",
    },
    {
      label: "Kategorija",
      value: getCategoryLabel(entry.taxonomy.category),
      reviewStatus: "confirmed",
    },
  ];

  if (entry.slug !== "c-2p42-race-finish-r") return baseFacts;

  return [
    ...baseFacts,
    {
      label: "Odnos mešanja",
      value: "3:1:1",
      detail: "Prema dostavljenom tehničkom listu C 2P42, strana 1.",
      reviewStatus: "confirmed",
    },
    {
      label: "Viskozitet nanošenja",
      value: "DIN 4: 17–19 s pri 20 °C",
      reviewStatus: "confirmed",
    },
    {
      label: "Pot life",
      value: "30 min pri 20 °C",
      reviewStatus: "confirmed",
    },
  ];
}

function getReviewedDocuments(
  entry: ImportedProductEntry,
): ProductDetailDocument[] {
  const documents: ProductDetailDocument[] = [
    {
      id: `${entry.slug}-product-information`,
      title: "Informacije o proizvodu",
      kind: "other",
      availability: "available",
      href: entry.documents.productInformation,
      note: "Zvanične R-M informacije o proizvodu.",
      reviewStatus: "confirmed",
    },
  ];

  if (entry.documents.technicalDataSheet) {
    documents.unshift({
      id: `${entry.slug}-technical-data-sheet`,
      title: "Tehnički list",
      kind: "tds",
      availability: "available",
      href: entry.documents.technicalDataSheet,
      note: entry.source.technicalPdfOriginalFilename ?? undefined,
      reviewStatus: "confirmed",
    });
  }

  return documents;
}

function getLegacyDocuments(entry: ImportedProductEntry): ProductDocument[] {
  const documents: ProductDocument[] = [
    {
      title: "Informacije o proizvodu",
      kind: "PDF",
      href: entry.documents.productInformation,
      status: "available",
      note: "Dostavljeno u potvrđenom R-M proizvodnom folderu.",
    },
  ];
  if (entry.documents.technicalDataSheet) {
    documents.unshift({
      title: "Tehnički list",
      kind: "PDF",
      href: entry.documents.technicalDataSheet,
      status: "available",
      note: "Dostavljeno uz konkretan R-M proizvod.",
    });
  }
  return documents;
}

function getSpecifications(entry: ImportedProductEntry): ProductSpecification[] {
  return [
    { label: "R-M oznaka", value: entry.productCode },
    { label: "Sistem / serija", value: entry.content.context },
    { label: "Kategorija", value: getCategoryLabel(entry.taxonomy.category) },
    {
      label: "Lokalna dostupnost",
      value: "Na upit",
      detail: "ZIP ne potvrđuje lager, cenu ni komercijalno pakovanje.",
    },
  ];
}

function getRelatedSlugs(
  entry: ImportedProductEntry,
  allEntries: ImportedProductEntry[],
) {
  const scored = allEntries
    .filter((candidate) => candidate.slug !== entry.slug)
    .map((candidate) => {
      let score = 0;
      if (entry.taxonomy.system && candidate.taxonomy.system === entry.taxonomy.system) {
        score += 6;
      }
      if (entry.taxonomy.series && candidate.taxonomy.series === entry.taxonomy.series) {
        score += 4;
      }
      if (candidate.taxonomy.category === entry.taxonomy.category) score += 2;
      return { candidate, score };
    })
    .filter(({ score }) => score > 0)
    .sort(
      (first, second) =>
        second.score - first.score ||
        first.candidate.slug.localeCompare(second.candidate.slug, "en"),
    );

  return scored.slice(0, 6).map(({ candidate }) => candidate.slug);
}

function getCategoryLabel(category: RmCategorySlug) {
  const labels: Record<RmCategorySlug, string> = {
    additive: "Aditiv",
    basecoat: "Bazna boja",
    bodyfiller: "Kit",
    cleaner: "Čistač",
    clearcoat: "Bezbojni lak",
    hardener: "Učvršćivač",
    "polishing-compound": "Pasta za poliranje",
    "primer-filler": "Prajmer i punilac",
    thinner: "Razređivač",
  };
  return labels[category];
}
