/**
 * Brand document library (catalogs, brochures, technical/process guides).
 *
 * Source PDFs are official Vosschemie/Carsystem material. See
 * docs/CARSYSTEM_DOCUMENT_SOURCE_MAP.md for per-document provenance
 * (source file, pages, extracted claims, destination component).
 *
 * `brands` is an array because a single document (e.g. a future combined
 * catalog) may cover more than one represented brand — do not assume a
 * one-file-one-brand relationship when adding entries.
 */

export type DocumentType =
  | "catalog"
  | "family-brochure"
  | "product-brochure"
  | "technical-guide"
  | "process-guide"
  | "campaign";

export type BrandDocument = {
  id: string;
  title: string;
  brands: string[];
  type: DocumentType;
  year?: number;
  languages?: string[];
  pages?: number;
  file: string;
  cover?: string;
  description?: string;
  categories?: string[];
  systems?: string[];
  productCodes?: string[];
  featured?: boolean;
  public: boolean;
};

export const brandDocuments: BrandDocument[] = [
  {
    id: "carsystem-produktkatalog-2025",
    title: "Carsystem Produktkatalog 2025",
    brands: ["carsystem"],
    type: "catalog",
    year: 2025,
    languages: ["de"],
    pages: 110,
    file: "/documents/carsystem/catalogs/carsystem-produktkatalog-2025.pdf",
    cover: "/brands/carsystem/documents/carsystem-produktkatalog-2025-cover.webp",
    description:
      "Kompletan Carsystem program: brušenje, kitovanje, maskiranje, lakiranje, finiš, lepljenje i zaštita na jednom mestu.",
    categories: [
      "Abrazivi",
      "Kitovi",
      "Maskiranje",
      "Lakiranje",
      "Finiš",
      "Lepkovi",
      "Čišćenje",
      "Zaštita",
      "Lakirerski pribor",
    ],
    featured: true,
    public: true,
  },
  {
    id: "carsystem-polish-x-serie",
    title: "Polish X-Serie",
    brands: ["carsystem"],
    type: "family-brochure",
    year: 2026,
    languages: ["de", "en"],
    pages: 7,
    file: "/documents/carsystem/brochures/carsystem-polish-x-serie.pdf",
    cover: "/brands/carsystem/documents/carsystem-polish-x-serie-cover.webp",
    description:
      "Novi Carsystem sistem poliranja: Compound X1500 i Polish X8000 sa pripadajućim padovima i mikrofiber krpama.",
    systems: ["Polish X-Serie"],
    productCodes: [
      "160.446",
      "160.447",
      "160.448",
      "160.449",
      "160.450",
      "160.451",
      "160.452",
      "160.453",
      "160.457",
    ],
    featured: true,
    public: true,
  },
  {
    id: "carsystem-sanding-blocks",
    title: "Sanding Blocks",
    brands: ["carsystem"],
    type: "family-brochure",
    year: 2026,
    languages: ["de", "en"],
    pages: 5,
    file: "/documents/carsystem/brochures/carsystem-sanding-blocks.pdf",
    cover: "/brands/carsystem/documents/carsystem-sanding-blocks-cover.webp",
    description:
      "Pregled Carsystem ručnih brusnih blokova (100 2.0, 198 2.0, 300, 400 2.0) i pripadajućih brusnih traka.",
    systems: ["Sanding Block 100 2.0", "Sanding Block 198 2.0", "Sanding Block 300", "Sanding Block 400 2.0"],
    featured: true,
    public: true,
  },
  {
    id: "carsystem-schleifmittel",
    title: "Schleifmittel — P.19 / F.19 / V.19",
    brands: ["carsystem"],
    type: "product-brochure",
    year: 2021,
    languages: ["de", "en"],
    pages: 2,
    file: "/documents/carsystem/brochures/carsystem-schleifmittel.pdf",
    cover: "/brands/carsystem/documents/carsystem-schleifmittel-cover.webp",
    description:
      "Osnovni Carsystem abrazivni program: P.19 papirno, F.19 folijsko schleifsredstvo i V.19 schleifvlies, sa T.19 podlogom.",
    systems: ["P.19", "F.19", "V.19", "T.19"],
    public: true,
  },
  {
    id: "carsystem-schleifmittel-new-collection",
    title: "Schleifmittel — New Collection",
    brands: ["carsystem"],
    type: "product-brochure",
    year: 2020,
    languages: ["de"],
    pages: 2,
    file: "/documents/carsystem/brochures/carsystem-schleifmittel-new-collection.pdf",
    cover: "/brands/carsystem/documents/carsystem-schleifmittel-new-collection-cover.webp",
    description:
      "Pro Flex Jupiter i Jupiter H2O softfilm diskovi za finiš i nazubljivanje pre lakiranja.",
    systems: ["Jupiter", "Jupiter H2O"],
    public: true,
  },
  {
    id: "carsystem-multi-changer",
    title: "Multi Changer",
    brands: ["carsystem"],
    type: "campaign",
    year: 2021,
    languages: ["de"],
    pages: 1,
    file: "/documents/carsystem/brochures/carsystem-multi-changer.pdf",
    cover: "/brands/carsystem/documents/carsystem-multi-changer-cover.webp",
    description:
      "Multi Blue Changer i Multi Green Changer — multifunkcionalni kitovi koji menjaju boju tokom očvršćavanja.",
    systems: ["Multi Blue Changer", "Multi Green Changer"],
    productCodes: ["157.622", "157.623"],
    public: true,
  },
  {
    id: "carsystem-cc26-eco-x-15-60",
    title: "2K Clear VOC CC.26 ECO-X 15/60",
    brands: ["carsystem"],
    type: "product-brochure",
    year: 2026,
    languages: ["de", "en"],
    pages: 5,
    file: "/documents/carsystem/brochures/carsystem-cc26-eco-x-15-60.pdf",
    cover: "/brands/carsystem/documents/carsystem-cc26-eco-x-15-60-cover.webp",
    description:
      "2K akrilni bezbojni lak bez razređivača, mešanje 2:1, sušenje 15 min/60°C ili 3–4 h/20°C.",
    systems: ["CC.26 ECO-X 15/60"],
    productCodes: ["160.613", "160.614", "160.615"],
    featured: true,
    public: true,
  },
  {
    id: "carsystem-desinfektionsprozess",
    title: "Desinfektionsprozess",
    brands: ["carsystem"],
    type: "process-guide",
    year: 2020,
    languages: ["de"],
    pages: 3,
    file: "/documents/carsystem/guides/carsystem-desinfektionsprozess.pdf",
    cover: "/brands/carsystem/documents/carsystem-desinfektionsprozess-cover.webp",
    description:
      "Preporučeni proces dezinfekcije vozila prilikom prijema i predaje u radionici.",
    public: true,
  },
  {
    id: "carfit-catalogue-2026",
    title: "C.A.R.FIT Catalogue 2026",
    brands: ["carfit"],
    type: "catalog",
    year: 2026,
    languages: ["en", "de", "fr"],
    pages: 48,
    file: "/documents/carfit/catalogs/carfit-catalogue-2026.pdf",
    cover: "/brands/carfit/documents/carfit-catalogue-2026-cover.webp",
    description:
      "Kompletan C.A.R.FIT program: kitovi, punioci, klar lakovi, aerosoli, razređivači, poliranje, maskiranje, čišćenje i abrazivi.",
    categories: [
      "Putties",
      "Fillers",
      "Clearcoats",
      "Aerosols & Underbody Protection",
      "Thinners, Cleaners, Silicone Remover",
      "Polishing Materials",
      "Masking",
      "Cleaning & Accessories",
      "Abrasives",
    ],
    featured: true,
    public: true,
  },
  {
    id: "cosmos-lac-catalogue-2022",
    title: "Cosmos LAC Product Catalogue",
    brands: ["cosmos-lac"],
    type: "catalog",
    year: 2022,
    languages: ["en"],
    pages: 42,
    file: "/documents/cosmos-lac/catalogs/cosmos-lac-catalogue-2022.pdf",
    cover: "/brands/cosmos-lac/documents/cosmos-lac-catalogue-2022-cover.webp",
    description:
      "Kompletan Cosmos LAC program u boji: RAL, Fast Acrylic, Easy Max, Spray.Bike, Chalk Effect, Flame, kao i specijalni programi (High Heat, primeri, lakovi, cink, automotive, effect, fluorescentni).",
    categories: [
      "RAL",
      "Fast Acrylic",
      "Easy Max",
      "Spray.Bike",
      "Chalk Effect",
      "Flame",
      "High Heat 700°C",
      "Primers",
      "Varnishes",
      "Automotive",
      "Effect / Metallic Effect",
      "Fluorescent / Marking",
    ],
    featured: true,
    public: true,
  },
  {
    id: "baslac-chrome-silver-system",
    title: "System Chrome Silver",
    brands: ["baslac"],
    type: "technical-guide",
    languages: ["en"],
    pages: 1,
    file: "/documents/baslac/guides/baslac-chrome-silver-system.pdf",
    cover: "/brands/baslac/documents/baslac-chrome-silver-system-cover.webp",
    description: "Sistem lakiranja za efekat hroma na naplacima, sa 35 Line.",
    systems: ["Chrome Silver System"],
    featured: true,
    public: true,
  },
  {
    id: "baslac-plastic-repair-system-voc",
    title: "Plastic Repair System (VOC)",
    brands: ["baslac"],
    type: "family-brochure",
    languages: ["en"],
    pages: 3,
    file: "/documents/baslac/guides/baslac-plastic-repair-system-voc.pdf",
    cover: "/brands/baslac/documents/baslac-plastic-repair-system-voc-cover.webp",
    description: "Sistem za popravku plastičnih delova, VOC varijanta.",
    featured: true,
    public: true,
  },
  {
    id: "baslac-plastic-repair-system-non-voc",
    title: "Plastic Repair System (Non-VOC)",
    brands: ["baslac"],
    type: "family-brochure",
    languages: ["en"],
    pages: 3,
    file: "/documents/baslac/guides/baslac-plastic-repair-system-non-voc.pdf",
    cover: "/brands/baslac/documents/baslac-plastic-repair-system-non-voc-cover.webp",
    description: "Sistem za popravku plastičnih delova, Non-VOC varijanta.",
    public: true,
  },
  {
    id: "baslac-plastic-metallic-repair",
    title: "Plastic Metallic Repair",
    brands: ["baslac"],
    type: "technical-guide",
    languages: ["en"],
    pages: 1,
    file: "/documents/baslac/guides/baslac-plastic-metallic-repair.pdf",
    cover: "/brands/baslac/documents/baslac-plastic-metallic-repair-cover.webp",
    description: "Tehnički pregled za popravku metalik plastičnih delova.",
    public: true,
  },
  {
    id: "baslac-carbon-fibre-repair",
    title: "System Carbon Fibre",
    brands: ["baslac"],
    type: "technical-guide",
    languages: ["en"],
    pages: 1,
    file: "/documents/baslac/guides/baslac-carbon-fibre-repair.pdf",
    cover: "/brands/baslac/documents/baslac-carbon-fibre-repair-cover.webp",
    description: "Sistem za popravku delova od karbonskih vlakana.",
    systems: ["Carbon Fibre System"],
    featured: true,
    public: true,
  },
  {
    id: "baslac-gloss-levels",
    title: "Gloss Levels — Mat Finish",
    brands: ["baslac"],
    type: "technical-guide",
    languages: ["en"],
    pages: 2,
    file: "/documents/baslac/guides/baslac-gloss-levels.pdf",
    cover: "/brands/baslac/documents/baslac-gloss-levels-cover.webp",
    description:
      "Proces postizanja ujednačenog sjaja za baslac 40-620, 40-440 i 40-450 mat/VOC klar lakove.",
    public: true,
  },
  {
    id: "baslac-cleaners",
    title: "Cleaners",
    brands: ["baslac"],
    type: "technical-guide",
    languages: ["en"],
    pages: 1,
    file: "/documents/baslac/guides/baslac-cleaners.pdf",
    cover: "/brands/baslac/documents/baslac-cleaners-cover.webp",
    description: "Pregled sredstava za čišćenje i pripremu površine pre lakiranja.",
    public: true,
  },
  {
    id: "baslac-spray-guns",
    title: "Recommended Spray Guns",
    brands: ["baslac"],
    type: "technical-guide",
    languages: ["en"],
    pages: 3,
    file: "/documents/baslac/guides/baslac-spray-guns.pdf",
    cover: "/brands/baslac/documents/baslac-spray-guns-cover.webp",
    description: "Preporučeni pištolji za prskanje (Sata, Iwata, Devilbiss, Walcom) po proizvodu.",
    public: true,
  },
  {
    id: "baslac-temp-chart-voc",
    title: "Temperature Chart — VOC Clears",
    brands: ["baslac"],
    type: "technical-guide",
    languages: ["en"],
    pages: 1,
    file: "/documents/baslac/guides/baslac-temp-chart-voc.pdf",
    cover: "/brands/baslac/documents/baslac-temp-chart-voc-cover.webp",
    description: "Preporuke tvrdilaca i razređivača po temperaturi za baslac VOC klar lakove.",
    public: true,
  },
  {
    id: "baslac-temp-chart-non-voc",
    title: "Temperature Chart — Non-VOC Clears",
    brands: ["baslac"],
    type: "technical-guide",
    languages: ["en"],
    pages: 1,
    file: "/documents/baslac/guides/baslac-temp-chart-non-voc.pdf",
    cover: "/brands/baslac/documents/baslac-temp-chart-non-voc-cover.webp",
    description: "Preporuke tvrdilaca i razređivača po temperaturi za baslac non-VOC klar lakove.",
    public: true,
  },
  {
    id: "baslac-grey-shades-20-24-34-94",
    title: "Grey Shades — 2K Primerfiller 20-24 / -34 / -94",
    brands: ["baslac"],
    type: "technical-guide",
    languages: ["en"],
    pages: 1,
    file: "/documents/baslac/guides/baslac-grey-shades-20-24-34-94.pdf",
    cover: "/brands/baslac/documents/baslac-grey-shades-20-24-34-94-cover.webp",
    description: "Nijanse punioca visokog sadržaja suve materije, brzo sušenje i lako brušenje.",
    productCodes: ["20-24", "20-34", "20-94"],
    public: true,
  },
  {
    id: "baslac-grey-shades-20-35-95",
    title: "Grey Shades — 2K Primerfiller 20-35 / -95",
    brands: ["baslac"],
    type: "technical-guide",
    languages: ["en"],
    pages: 1,
    file: "/documents/baslac/guides/baslac-grey-shades-20-35-95.pdf",
    cover: "/brands/baslac/documents/baslac-grey-shades-20-35-95-cover.webp",
    description: "Nijanse punioca visokog sadržaja suve materije za wet-on-wet nanošenje.",
    productCodes: ["20-35", "20-95"],
    public: true,
  },
  {
    id: "baslac-mazda-51k-standard-process",
    title: "Mazda 51K — Standard Process",
    brands: ["baslac"],
    type: "process-guide",
    languages: ["en"],
    pages: 2,
    file: "/documents/baslac/guides/baslac-mazda-51k-standard-process.pdf",
    cover: "/brands/baslac/documents/baslac-mazda-51k-standard-process-cover.webp",
    description: "Standardni proces nanošenja za Mazda Rhodium White Met, boja 51K.",
    public: true,
  },
  {
    id: "baslac-mazda-51k-blend-in-process-1",
    title: "Mazda 51K — Blend-In Process (1)",
    brands: ["baslac"],
    type: "process-guide",
    languages: ["en"],
    pages: 3,
    file: "/documents/baslac/guides/baslac-mazda-51k-blend-in-process-1.pdf",
    cover: "/brands/baslac/documents/baslac-mazda-51k-blend-in-process-1-cover.webp",
    description: "Postupak uklapanja (blend-in) za Mazda Rhodium White Met, boja 51K — varijanta 1.",
    public: true,
  },
  {
    id: "baslac-mazda-51k-blend-in-process-2",
    title: "Mazda 51K — Blend-In Process (2)",
    brands: ["baslac"],
    type: "process-guide",
    languages: ["en"],
    pages: 2,
    file: "/documents/baslac/guides/baslac-mazda-51k-blend-in-process-2.pdf",
    cover: "/brands/baslac/documents/baslac-mazda-51k-blend-in-process-2-cover.webp",
    description: "Postupak uklapanja (blend-in) za Mazda Rhodium White Met, boja 51K — varijanta 2.",
    public: true,
  },
];

export function getPublicDocuments(): BrandDocument[] {
  return brandDocuments.filter((document) => document.public);
}

export function getDocumentsByBrand(brandSlug: string): BrandDocument[] {
  return getPublicDocuments().filter((document) => document.brands.includes(brandSlug));
}

export function getFeaturedDocuments(brandSlug?: string): BrandDocument[] {
  const documents = brandSlug ? getDocumentsByBrand(brandSlug) : getPublicDocuments();
  return documents.filter((document) => document.featured);
}

export function getDocumentById(id: string): BrandDocument | undefined {
  return brandDocuments.find((document) => document.id === id);
}

export function getDocumentBrandSlugs(): string[] {
  const slugs = new Set<string>();
  for (const document of getPublicDocuments()) {
    for (const brand of document.brands) slugs.add(brand);
  }
  return Array.from(slugs);
}
