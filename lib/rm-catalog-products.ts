import catalogData from "@/data/rm-catalog-products.generated.json";
import type {
  CarsystemProduct,
  ProductVisualType,
  RefinishPhaseSlug,
} from "@/lib/carsystem-data";
import type { ProductCategorySlug } from "@/lib/product-taxonomy";
import type {
  ProductDetailContent,
  ProductDetailDocument,
  ProductRelationship,
  ProductTechnicalFact,
} from "@/types/product-detail";

/**
 * R-M proizvodi uvezeni sa zvaničnih izvora (`npm run rm:sync`).
 *
 * Isti obrazac kao `lib/{carsystem,carfit,befar}-catalog-products.ts`: skripta piše
 * `data/rm-catalog-products.generated.json`, a ovaj modul ga prevodi u `CarsystemProduct`.
 * Ovde nema poslovnih odluka.
 *
 * R-M model se razlikuje od prethodnih brendova u tri tačke:
 *   1. Javna zvanična šifra je OZNAKA proizvoda („C 2A64”); brojevi artikala i pakovanja
 *      nisu javno objavljeni, pa pakovanje ostaje „Na upit”.
 *   2. Učvršćivač, razređivač i aditiv su SAMOSTALNI zapisi sa odnosima (`relations`,
 *      `usedBy`), nikad varijante laka — kompatibilnost nije isto što i varijanta.
 *   3. Sistem za nijansiranje (AGILIS, ONYX HD, DIAMONT…) je JEDAN zapis; pojedinačni
 *      toneri se zvanično ne objavljuju, pa se ne prave kao kartice.
 */

type CatalogRelation = { code: string; relation: string; slug: string | null; name: string };
type CatalogDocument = { kind: string; title: string; href: string; language: string | null; version: string | null; note: string };
type CatalogTechnical = {
  revision: string | null;
  mixingRatio: string | null;
  potLife: string | null;
  filmThickness: string | null;
  drying: string[];
  nozzle: string | null;
  voc: { category: string; limit: number; content: number } | null;
};

type CatalogTaxonomy = {
  category: ProductCategorySlug;
  programSlug: string;
  phaseSlug: RefinishPhaseSlug;
  visualType: ProductVisualType;
  rule: string;
};

type CatalogProductEntry = {
  slug: string;
  name: string;
  sourceKey: string;
  code: string | null;
  officialName: string;
  kind: string;
  role: string;
  series: string | null;
  line: string | null;
  technologyTags: string[];
  status: string;
  documentationGap: string | null;
  sourceUrls: string[];
  taxonomy: CatalogTaxonomy;
  systemComponents: { code: string; role: string | null; websitePage: string | null }[];
  lineProducts: { code: string; slug: string | null; name: string }[];
  relations: CatalogRelation[];
  usedBy: CatalogRelation[];
  technical: CatalogTechnical;
  documents: CatalogDocument[];
  image: { src: string; width: number | null; height: number | null; hasAlpha: boolean; processing: string | null } | null;
  missingOfficialAsset: boolean;
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
};

type CatalogEnrichment = Pick<
  CatalogProductEntry,
  "code" | "officialName" | "kind" | "role" | "series" | "line" | "status" | "documentationGap" | "sourceUrls" | "taxonomy" | "relations" | "usedBy" | "technical" | "documents"
> & { systemComponents: { code: string }[] };

const entries = catalogData.products as CatalogProductEntry[];
const enrichments = catalogData.enrichments as Record<string, CatalogEnrichment>;

export const rmCatalogMeta = catalogData.meta;

const CATEGORY_BADGE: Record<ProductCategorySlug, string> = {
  boje: "Boje i lakovi",
  abrazivi: "Abrazivi",
  kitovi: "Kit",
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

const RELATION_LABEL: Record<string, string> = {
  USES_HARDENER: "Učvršćivač po tehničkom listu",
  USES_REDUCER: "Razređivač po tehničkom listu",
  USES_ADDITIVE: "Aditiv naveden u tehničkom listu",
  USED_BY: "Koristi se uz ovaj proizvod",
};

function technicalFacts(entry: Pick<CatalogProductEntry, "technical" | "code" | "series" | "line" | "documentationGap"> & { facts?: { label: string; value: string }[] }): ProductTechnicalFact[] {
  const { technical } = entry;
  return [
    ...(entry.code ? [{ label: "R-M oznaka", value: entry.code, reviewStatus: "confirmed" as const }] : []),
    ...(entry.series ? [{ label: "Serija", value: entry.series, reviewStatus: "confirmed" as const }] : []),
    ...(entry.line ? [{ label: "Linija", value: entry.line, reviewStatus: "confirmed" as const }] : []),
    ...(entry.facts ?? []).map((fact) => ({ ...fact, reviewStatus: "confirmed" as const })),
    ...(technical.mixingRatio ? [{ label: "Odnos mešanja", value: technical.mixingRatio, reviewStatus: "confirmed" as const }] : []),
    ...(technical.potLife ? [{ label: "Vreme upotrebe smeše", value: technical.potLife.replace(/^at /, "na "), reviewStatus: "confirmed" as const }] : []),
    ...(technical.filmThickness ? [{ label: "Debljina filma", value: technical.filmThickness, reviewStatus: "confirmed" as const }] : []),
    ...(technical.drying.length ? [{ label: "Sušenje", value: technical.drying.map((line) => line.replace(/^Drying at /, "").replace(/°C /, "°C: ")).join(" · "), reviewStatus: "confirmed" as const }] : []),
    ...(technical.nozzle ? [{ label: "Mlaznica", value: `${technical.nozzle} mm`, reviewStatus: "confirmed" as const }] : []),
    ...(technical.voc ? [{ label: "VOC", value: `${technical.voc.content} g/l`, detail: `EU granica za kategoriju ${technical.voc.category}: ${technical.voc.limit} g/l`, reviewStatus: "confirmed" as const }] : []),
    ...(technical.revision ? [{ label: "Revizija tehničkog lista", value: technical.revision.replace(/^(\d{4})-(\d{2})$/, "$2/$1"), reviewStatus: "confirmed" as const }] : []),
    ...(entry.documentationGap ? [{ label: "Napomena o dokumentaciji", value: entry.documentationGap, reviewStatus: "needs_confirmation" as const }] : []),
  ];
}

function detailDocuments(slug: string, documents: CatalogDocument[]): ProductDetailDocument[] {
  return [
    ...documents.map((document, index) => ({
      id: `${slug}-tds-${index}`,
      title: document.title,
      kind: "tds" as const,
      availability: "available" as const,
      href: document.href,
      language: document.language ?? undefined,
      version: document.version ?? undefined,
      note: document.note,
      reviewStatus: "confirmed" as const,
    })),
    {
      id: `${slug}-sds`,
      title: "Bezbednosni list",
      kind: "sds" as const,
      availability: "preparing" as const,
      note: "R-M bezbednosne listove izdaje lokalni predstavnik — dostupno na upit.",
      reviewStatus: "confirmed" as const,
    },
  ];
}

function relationshipItems(relations: CatalogRelation[]): ProductRelationship[] {
  return relations
    .filter((relation) => relation.slug)
    .map((relation) => ({
      productSlug: relation.slug as string,
      note: `${RELATION_LABEL[relation.relation] ?? relation.relation} · ${relation.code}`,
      reviewStatus: "confirmed" as const,
    }));
}

/**
 * Pojmovi pretrage: oznaka je ono što kupac zaista kuca („C 2A64”, „c2a64”).
 *
 * `+` u nazivu (`GlossTOP+`, `SANDING Fill-R+`) tokenizator odbacuje, pa bi takav proizvod
 * bio nerazlučiv od svog parnjaka bez plusa; zato se dodaje i izgovorni oblik („GlossTOP plus”).
 */
function searchTermsFor(entry: { code: string | null; officialName: string; series: string | null; line: string | null; content?: { productType: string } }) {
  return [
    ...new Set(
      [
        entry.code,
        entry.code?.replace(/\s+/g, ""),
        entry.officialName,
        entry.officialName.includes("+") ? entry.officialName.replace(/\+/g, " plus") : null,
        entry.series,
        entry.line,
        entry.content?.productType,
      ].filter((value): value is string => Boolean(value)),
    ),
  ];
}

function createCatalogProduct(entry: CatalogProductEntry): CarsystemProduct {
  const { content } = entry;
  const imageAlt = `${entry.name}, ${content.productType.toLocaleLowerCase("sr-Latn")}`;
  const badges = [content.productType, ...(entry.series ? [entry.series] : []), ...(entry.line && entry.line !== entry.series ? [entry.line] : []), "Na upit"];

  const detail: ProductDetailContent = {
    reviewStatus: "confirmed",
    hero: {
      kicker: `R-M${entry.series ? ` · ${entry.series}` : ""} · ${CATEGORY_BADGE[entry.taxonomy.category]}`,
      subtype: content.subtype,
      lead: content.shortDescription,
    },
    quickFacts: {
      reviewStatus: "confirmed",
      content: [
        ...(entry.code ? [{ label: "R-M oznaka", value: entry.code, reviewStatus: "confirmed" as const }] : []),
        { label: "Tip proizvoda", value: content.productType, reviewStatus: "confirmed" as const },
        { label: "Dostupnost", value: "Na upit", reviewStatus: "confirmed" as const },
      ],
    },
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
        ...technicalFacts({ ...entry, facts: content.facts }),
        ...(content.advice && !content.applications.length ? [{ label: "Napomena proizvođača", value: content.advice, reviewStatus: "confirmed" as const }] : []),
      ],
    },
    ...(entry.relations.length || entry.usedBy.length
      ? {
          compatibleProducts: {
            reviewStatus: "confirmed",
            content: {
              title: entry.kind === "component" ? "Proizvodi uz koje se koristi" : "Komponente sistema",
              description:
                entry.kind === "component"
                  ? "Zvanični tehnički listovi R-M proizvoda navode ovu komponentu; dostupnost se proverava kroz upit."
                  : "Učvršćivači, razređivači i aditivi koje tehnički list navodi uz ovaj proizvod.",
              items: relationshipItems([...entry.relations, ...entry.usedBy]),
            },
          },
        }
      : {}),
    documents: {
      reviewStatus: "confirmed",
      content: detailDocuments(entry.slug, entry.documents),
    },
  };

  return {
    slug: entry.slug,
    name: entry.name,
    brandSlug: "rm",
    programSlug: entry.taxonomy.programSlug,
    phaseSlug: entry.taxonomy.phaseSlug,
    shortDescription: content.shortDescription,
    longDescription: content.longDescription,
    // Zvanična R-M oznaka — nije izmišljen placeholder.
    sku: entry.code ?? entry.slug,
    externalSku: entry.code ?? undefined,
    manufacturerCode: entry.code,
    packages: [{ label: "Na upit", detail: "Pakovanja R-M ne objavljuje javno; potvrđuju se kroz upit." }],
    purpose: content.purpose,
    badges,
    publicStatus: "Na upit",
    stockStatus: "unknown",
    stockManaged: false,
    productImage: entry.image
      ? { src: entry.image.src, alt: imageAlt }
      : { src: PLACEHOLDER_PRODUCT_IMAGE, alt: `${entry.name}, ilustrativni prikaz proizvoda` },
    galleryImages: [],
    specifications: [
      { label: "Tip proizvoda", value: content.productType },
      ...(entry.code ? [{ label: "R-M oznaka", value: entry.code }] : []),
      ...(entry.series ? [{ label: "Serija", value: entry.series }] : []),
      ...(entry.line ? [{ label: "Linija", value: entry.line }] : []),
      ...content.facts,
    ],
    documents: [
      ...entry.documents.map((document) => ({ title: "Tehnički list", kind: "PDF", href: document.href, status: "available" as const, note: document.note })),
      { title: "Bezbednosni list", kind: "PDF", status: "placeholder" as const, note: "Izdaje lokalni predstavnik — dostupno na upit." },
    ],
    relatedProductSlugs: [...entry.relations, ...entry.usedBy].map((relation) => relation.slug).filter((slug): slug is string => Boolean(slug)).slice(0, 6),
    seoTitle: `${entry.name} | R-M`,
    seoDescription: content.shortDescription,
    taxonomyCategory: entry.taxonomy.category,
    manufacturerColor: entry.shade ?? undefined,
    searchTerms: searchTermsFor(entry),
    detail,
  };
}

export function getRmCatalogProducts(): CarsystemProduct[] {
  return entries.map(createCatalogProduct);
}

/**
 * Dopuna zapisa koje već vodimo (59 iz dostavljene arhive + ručni DIAMONT/Body Filler).
 *
 * Slug, slika i lokalno hostovani PDF-ovi OSTAJU njihovi — menja se samo ono što zvanični
 * izvor sada potvrđuje: taksonomija (ranije prazna), serija/linija, tehničke činjenice iz
 * aktuelnog TDS-a, odnosi sa komponentama i pojmovi pretrage.
 */
export function applyRmCatalogEnrichment(record: CarsystemProduct): CarsystemProduct {
  const enrichment = enrichments[record.slug];
  if (!enrichment) return record;

  const existingDocuments = record.documents ?? [];
  /*
   * Zapisi uvezeni iz dostavljene arhive već imaju lokalno hostovan tehnički list ISTOG
   * proizvoda; referenca na portal bi bila drugi red za isti dokument. Zato se dodaje samo
   * onima koji ga nemaju. (URL zvaničnog lista ostaje u `data/rm-catalog-products.generated.json`
   * kao trag porekla.)
   */
  const hasTds = existingDocuments.some((document) => document.status === "available" && /tehni[čc]ki list/i.test(document.title));
  const detail = record.detail;

  return {
    ...record,
    manufacturerCode: enrichment.code,
    taxonomyCategory: enrichment.taxonomy.category,
    programSlug: enrichment.taxonomy.programSlug,
    phaseSlug: enrichment.taxonomy.phaseSlug,
    searchTerms: [...new Set([...(record.searchTerms ?? []), ...searchTermsFor(enrichment)])],
    documents: hasTds
      ? existingDocuments
      : [...existingDocuments, ...enrichment.documents.map((document) => ({ title: "Tehnički list", kind: "PDF", href: document.href, status: "available" as const, note: document.note }))],
    ...(detail
      ? {
          detail: {
            ...detail,
            technicalFacts: {
              reviewStatus: "confirmed",
              content: [
                ...(detail.technicalFacts?.content ?? []),
                ...technicalFacts(enrichment).filter((fact) => !(detail.technicalFacts?.content ?? []).some((existing) => existing.label === fact.label)),
              ],
            },
            ...(enrichment.relations.length || enrichment.usedBy.length
              ? {
                  compatibleProducts: {
                    reviewStatus: "confirmed" as const,
                    content: {
                      title: enrichment.kind === "component" ? "Proizvodi uz koje se koristi" : "Komponente sistema",
                      description: "Odnosi su preuzeti iz aktuelnog zvaničnog tehničkog lista.",
                      items: relationshipItems([...enrichment.relations, ...enrichment.usedBy]),
                    },
                  },
                }
              : {}),
          },
        }
      : {}),
  };
}
