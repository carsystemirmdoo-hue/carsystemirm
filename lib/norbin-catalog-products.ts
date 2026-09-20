import catalogData from "@/data/norbin-catalog-products.generated.json";
import type {
  CarsystemProduct,
  ProductPublicStatus,
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
 * Norbin proizvodi uvezeni sa zvaničnog izvora (`npm run norbin:sync`).
 *
 * Isti obrazac kao `lib/{carsystem,carfit,befar,rm,baslac}-catalog-products.ts`: skripta piše
 * `data/norbin-catalog-products.generated.json`, a ovaj modul ga prevodi u `CarsystemProduct`.
 * Ovde nema poslovnih odluka.
 *
 * Četiri stvari su specifične za Norbin:
 *   1. Izvor NEMA stranice proizvoda ni fotografije — 0 zvaničnih slika za svih 13 proizvoda.
 *      Zapis sa lokalnom, kupčevom fotografijom je izuzetak i NIJE dokaz packshota proizvođača.
 *   2. Brojeva artikala nema nigde na izvoru; zvanična šifra (`N15-020`) je identitet, a
 *      pakovanje je varijanta.
 *   3. Dostupnost dolazi iz dokaza o aktivnosti artikla, ali javni status je UVEK „Na upit" —
 *      ni za jedan zapis se ne tvrdi da je na stanju.
 *   4. Pet proizvoda (učvršćivači, razređivač) nema objavljen tehnički list; imaju samo
 *      bezbednosne listove po pakovanju. To je njihovo stvarno stanje, ne praznina uvoza.
 */

type SyncClaim = { field: string; sourceLabel: string | null; value: string; unit: string | null; condition: string | null; equipment: string | null; page: number | null };
type SyncRelation = { code: string; relation: string; ratio: string | null; slug: string | null; name: string; officialIdentity: boolean };
type SyncDocument = { kind: string; title: string; href: string; language: string | null; note: string; pack?: string | null; tokenizedUrl?: boolean };

type SyncEntry = {
  slug: string;
  name: string;
  sourceKey: string;
  code: string;
  officialName: string;
  officialNameSource: string;
  role: string;
  status: string;
  availability: { status: string; articles: { articleId: string; pack: string | null; status: string }[]; publicStatus: string };
  packs: string[];
  sourceUrls: string[];
  taxonomy: { category: string; programSlug: string; phaseSlug: string; visualType: string; rule: string };
  relations: SyncRelation[];
  usedBy: SyncRelation[];
  technical: { documentFileName: string; documentSha256: string; claims: SyncClaim[] } | null;
  documents: SyncDocument[];
  image: null;
  missingOfficialAsset: boolean;
  family: { baseProductSlug: string; variantId: string; pack: string | null; identity: { name: string; slug: string } | null } | null;
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
};

type SyncEnrichment = Omit<SyncEntry, "slug" | "name" | "content">;

const entries = catalogData.products as SyncEntry[];
const enrichments = catalogData.enrichments as Record<string, SyncEnrichment>;

export const norbinCatalogMeta = catalogData.meta;

const PLACEHOLDER_PRODUCT_IMAGE = "/images/products/placeholder-product.svg";

const CATEGORY_BADGE: Record<string, string> = {
  boje: "Boje i lakovi",
  kitovi: "Kit",
  ciscenje: "Čišćenje",
};

const RELATION_LABEL: Record<string, string> = {
  USES_HARDENER: "Učvršćivač po tehničkom listu",
  USES_REDUCER: "Razređivač po tehničkom listu",
  USES_ADDITIVE: "Aditiv naveden u tehničkom listu",
  COMPATIBLE_WITH: "Kompatibilno po tehničkom listu",
  USED_BY: "Koristi se uz ovaj proizvod",
};

/** Etikete tvrdnji iz zvaničnog lista; polje koje nije ovde se ne prikazuje kao činjenica. */
const CLAIM_LABEL: Record<string, string> = {
  mixingRatio: "Odnos mešanja",
  sprayViscosity: "Viskozitet prskanja",
  potLife: "Vreme upotrebe smeše",
  nozzleSize: "Mlaznica",
  sprayCoats: "Broj slojeva",
  filmThickness: "Debljina filma",
  flashOffTime: "Razmak između slojeva",
  dryingTime: "Sušenje",
  storageTemperature: "Temperatura skladištenja",
  shelfLife: "Rok upotrebe",
  voc: "VOC",
  sprayPressure: "Pritisak prskanja",
  nozzlePressure: "Pritisak na mlaznici",
  hardness: "Tvrdoća",
  sandability: "Brušenje",
};

function packagesOf(entry: Pick<SyncEntry, "packs" | "family">) {
  if (entry.family?.pack) return [{ label: entry.family.pack }];
  if (entry.packs.length) return entry.packs.map((pack) => ({ label: pack }));
  return [{ label: "Na upit", detail: "Pakovanje se potvrđuje kroz upit." }];
}

/**
 * Tehničke činjenice: SR tekst piše čovek, ali se ovde dodaje i doslovan zapis iz lista,
 * sa uslovom i tipom pištolja gde ih dokument navodi — bez tihog primenjivanja na oba.
 */
function technicalFacts(entry: Pick<SyncEntry, "technical" | "code" | "packs">, srFacts: { label: string; value: string }[]): ProductTechnicalFact[] {
  const fromClaims = (entry.technical?.claims ?? [])
    .filter((claim) => CLAIM_LABEL[claim.field])
    .map((claim) => ({
      label: CLAIM_LABEL[claim.field],
      value: [claim.value, claim.condition ? `(${claim.condition})` : null, claim.equipment ? `· ${claim.equipment}` : null].filter(Boolean).join(" "),
      reviewStatus: "confirmed" as const,
    }));
  const seen = new Set<string>();
  return [
    { label: "Norbin oznaka", value: entry.code, reviewStatus: "confirmed" as const },
    ...srFacts.map((fact) => ({ ...fact, reviewStatus: "confirmed" as const })),
    ...fromClaims.filter((fact) => {
      const key = `${fact.label}|${fact.value}`;
      if (seen.has(key) || srFacts.some((existing) => existing.label === fact.label && existing.value === fact.value)) return false;
      seen.add(key);
      return true;
    }),
  ];
}

function detailDocuments(slug: string, documents: SyncDocument[]): ProductDetailDocument[] {
  const listed = documents.map((document, index) => ({
    id: `${slug}-${document.kind}-${index}`,
    title: document.title,
    kind: document.kind === "tds" ? ("tds" as const) : ("sds" as const),
    availability: "available" as const,
    href: document.href,
    language: document.language ?? undefined,
    note: document.note,
    reviewStatus: "confirmed" as const,
  }));
  // Tehnički list postoji samo za 8 od 13 proizvoda; gde ga proizvođač nema, to se i kaže.
  return listed.some((document) => document.kind === "tds")
    ? listed
    : [
        ...listed,
        {
          id: `${slug}-tds`,
          title: "Tehnički list",
          kind: "tds" as const,
          availability: "preparing" as const,
          note: "Proizvođač za ovaj proizvod ne objavljuje tehnički list.",
          reviewStatus: "confirmed" as const,
        },
      ];
}

function relationshipItems(relations: SyncRelation[]): ProductRelationship[] {
  return relations
    .filter((relation) => relation.slug)
    .map((relation) => ({
      productSlug: relation.slug as string,
      note: [RELATION_LABEL[relation.relation] ?? relation.relation, relation.code, relation.ratio].filter(Boolean).join(" · "),
      reviewStatus: "confirmed" as const,
    }));
}

/** Pojmovi pretrage: oznaka je ono što kupac kuca — „N15-020" i „n15020". */
function searchTermsFor(entry: { code: string; officialName: string; content?: { productType: string } }) {
  return [...new Set([entry.code, entry.code.replace(/-/g, ""), entry.officialName, entry.content?.productType].filter((value): value is string => Boolean(value)))];
}

function createCatalogProduct(entry: SyncEntry): CarsystemProduct {
  const { content } = entry;
  const detail: ProductDetailContent = {
    reviewStatus: "confirmed",
    hero: {
      kicker: `Norbin · ${CATEGORY_BADGE[entry.taxonomy.category] ?? "Program"}`,
      subtype: content.subtype,
      lead: content.shortDescription,
    },
    quickFacts: {
      reviewStatus: "confirmed",
      content: [
        { label: "Norbin oznaka", value: entry.code, reviewStatus: "confirmed" },
        { label: "Tip proizvoda", value: content.productType, reviewStatus: "confirmed" },
        { label: "Dostupnost", value: entry.availability.publicStatus, reviewStatus: "confirmed" },
      ],
    },
    ...(content.benefits.length
      ? {
          benefits: {
            reviewStatus: "confirmed" as const,
            content: { title: `Karakteristike — ${entry.officialName}`, items: content.benefits.map((benefit) => ({ ...benefit, reviewStatus: "confirmed" as const })) },
          },
        }
      : {}),
    ...(content.applications.length
      ? {
          process: {
            reviewStatus: "confirmed" as const,
            content: {
              title: "Oblast primene",
              description: content.advice ?? content.purpose,
              mode: "supporting-process" as const,
              stages: content.applications.map((label) => ({ label, reviewStatus: "confirmed" as const })),
            },
          },
        }
      : {}),
    technicalFacts: {
      reviewStatus: "confirmed",
      content: [
        { label: "Tip proizvoda", value: content.productType, reviewStatus: "confirmed" },
        ...technicalFacts(entry, content.facts),
        ...(content.advice && !content.applications.length ? [{ label: "Napomena proizvođača", value: content.advice, reviewStatus: "confirmed" as const }] : []),
      ],
    },
    ...(entry.relations.length || entry.usedBy.length
      ? {
          compatibleProducts: {
            reviewStatus: "confirmed" as const,
            content: {
              title: ["hardener", "reducer"].includes(entry.role) ? "Proizvodi uz koje se koristi" : "Komponente po tehničkom listu",
              description: "Odnosi i razmere dolaze iz zvaničnog tehničkog lista proizvođača.",
              items: relationshipItems([...entry.relations, ...entry.usedBy]),
            },
          },
        }
      : {}),
    documents: { reviewStatus: "confirmed", content: detailDocuments(entry.slug, entry.documents) },
  };

  return {
    slug: entry.slug,
    name: entry.name,
    brandSlug: "norbin",
    programSlug: entry.taxonomy.programSlug,
    phaseSlug: entry.taxonomy.phaseSlug as RefinishPhaseSlug,
    shortDescription: content.shortDescription,
    longDescription: content.longDescription,
    sku: entry.code,
    externalSku: entry.code,
    manufacturerCode: entry.code,
    packages: packagesOf(entry),
    purpose: content.purpose,
    badges: [content.productType, entry.code, entry.availability.publicStatus],
    publicStatus: entry.availability.publicStatus as ProductPublicStatus,
    stockStatus: "unknown",
    stockManaged: false,
    // Proizvođač ne objavljuje nijednu fotografiju proizvoda — placeholder je pošten prikaz.
    productImage: { src: PLACEHOLDER_PRODUCT_IMAGE, alt: `${entry.name}, ilustrativni prikaz proizvoda` },
    galleryImages: [],
    specifications: [
      { label: "Tip proizvoda", value: content.productType },
      { label: "Norbin oznaka", value: entry.code },
      ...(entry.packs.length ? [{ label: "Pakovanje", value: entry.packs.join(" · ") }] : []),
      ...content.facts,
    ],
    documents: [
      ...entry.documents.map((document) => ({
        title: document.kind === "tds" ? "Tehnički list" : document.pack ? `Bezbednosni list — ${document.pack}` : "Bezbednosni list",
        kind: "PDF",
        href: document.href,
        status: "available" as const,
        note: document.note,
      })),
    ],
    relatedProductSlugs: [...entry.relations, ...entry.usedBy].map((relation) => relation.slug).filter((slug): slug is string => Boolean(slug)).slice(0, 6),
    seoTitle: `${entry.name} | Carsystem i R-M`,
    seoDescription: content.shortDescription,
    taxonomyCategory: entry.taxonomy.category as ProductCategorySlug,
    searchTerms: searchTermsFor(entry),
    detail,
  } as CarsystemProduct;
}

export function getNorbinCatalogProducts(): CarsystemProduct[] {
  return entries.map(createCatalogProduct);
}

/**
 * Dopuna dva zapisa koje već vodimo (`N15-020` u 1 L i 5 L).
 *
 * Slug, ime, kupčeva fotografija i pakovanje OSTAJU njihovi — dodaje se ono što zvanični izvor
 * potvrđuje: oznaka proizvođača, taksonomija, odnosi, dokumenti, tehničke činjenice i
 * pripadnost porodici, pa se dva pakovanja prikazuju kao JEDNA kartica sa izborom pakovanja.
 */
export function applyNorbinSyncEnrichment(record: CarsystemProduct): CarsystemProduct {
  const enrichment = enrichments[record.slug];
  if (!enrichment) return record;

  const detail = record.detail;
  const facts = technicalFacts(enrichment, []);
  const family = enrichment.family;

  return {
    ...record,
    manufacturerCode: enrichment.code,
    externalSku: enrichment.code,
    taxonomyCategory: enrichment.taxonomy.category as ProductCategorySlug,
    programSlug: enrichment.taxonomy.programSlug,
    phaseSlug: enrichment.taxonomy.phaseSlug as RefinishPhaseSlug,
    publicStatus: enrichment.availability.publicStatus as ProductPublicStatus,
    searchTerms: [...new Set([...(record.searchTerms ?? []), ...searchTermsFor(enrichment)])],
    documents: [
      ...(record.documents ?? []).filter((document) => document.status === "available"),
      ...enrichment.documents.map((document) => ({
        title: document.kind === "tds" ? "Tehnički list" : document.pack ? `Bezbednosni list — ${document.pack}` : "Bezbednosni list",
        kind: "PDF",
        href: document.href,
        status: "available" as const,
        note: document.note,
      })),
    ],
    specifications: [
      ...(record.specifications ?? []),
      ...facts.filter((fact) => !(record.specifications ?? []).some((existing) => existing.label === fact.label)).map((fact) => ({ label: fact.label, value: fact.value })),
    ],
    ...(family
      ? {
          catalogMetadata: {
            id: `norbin-${enrichment.sourceKey}-${family.variantId}`,
            baseProductSlug: family.baseProductSlug,
            variantId: family.variantId,
            line: enrichment.code,
            officialName: enrichment.officialName,
            displayNameSr: record.name,
            cosmosCode: null,
            ralCode: null,
            colorName: null,
            finish: null,
            volume: family.pack,
            technicalCategory: enrichment.officialName,
            verificationStatus: "ACTIVE_CONFIRMED",
            sourceReference: enrichment.sourceUrls[0] ?? null,
            colorSource: "name-derived" as const,
            colorConfidence: "provisional" as const,
            ...(family.identity ? { familyIdentity: family.identity } : {}),
          },
        }
      : {}),
    ...(detail
      ? {
          detail: {
            ...detail,
            technicalFacts: {
              reviewStatus: "confirmed" as const,
              content: [...(detail.technicalFacts?.content ?? []), ...facts.filter((fact) => !(detail.technicalFacts?.content ?? []).some((existing) => existing.label === fact.label))],
            },
          },
        }
      : {}),
  };
}
