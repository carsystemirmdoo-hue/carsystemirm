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
      : { src: PLACEHOLDER_PRODUCT_IMAGE, alt: `${entry.name} — fotografija proizvoda nije dostupna` },
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

/**
 * Varijante iz zvaničnog kataloga koje sync ne prikazuje (nisu na aktuelnom sajtu), a magacin ih je
 * potvrdio etiketom. Podaci su samo iz kataloga; tvrdoća i slika se ne izmišljaju.
 */
const OWNER_CONFIRMED_VARIANTS: Record<string, { after: string; variant: CatalogVariant }[]> = {
  // Etiketa 2026-10-13: običan plavi Befar sunđer 04405 (katalog 2024, str. 6: BLUE 04405 150 x 25 mm, 66 kom.).
  "befar-velcro-polishing-pad": [
    {
      after: "04404",
      variant: {
        code: "04405", label: "Plava · 150 × 25 mm", searchLabel: "Plava · 150 × 25 mm", colour: "Blue", colourSr: "plava",
        swatch: "#2E6CB4", size: "150x25mm", holes: null, hardnessStars: null, applyWith: null, boxQuantity: 66, image: null,
        onWebsite: false, inCatalogue: true, cataloguePage: 6,
      },
    },
  ],
  // Odluka vlasnika 2026-11-13: beli Plus 150 × 25 (BizniSoft 054401; katalog str. 17: WHITE 54401, 66 kom.)
  // i narandžasti Plus 80 × 25 (044808; katalog str. 9 „PLUS VELCRO COMPOUNDING FOAM“: ORANGE 44808, 200 kom.).
  "befar-plus-velcro-polishing-pad": [
    {
      after: "54402",
      variant: {
        code: "54401", label: "Bela · 150 × 25 mm", searchLabel: "Bela · 150 × 25 mm", colour: "White", colourSr: "bela",
        swatch: "#E6E3DD", size: "150x25mm", holes: null, hardnessStars: null, applyWith: null, boxQuantity: 66, image: null,
        onWebsite: false, inCatalogue: true, cataloguePage: 17,
      },
    },
    {
      after: "56407",
      variant: {
        code: "44808", label: "Narandžasta · 80 × 25 mm", searchLabel: "Narandžasta · 80 × 25 mm", colour: "Orange", colourSr: "narandžasta",
        swatch: "#DF7A27", size: "80x25mm", holes: null, hardnessStars: null, applyWith: null, boxQuantity: 200, image: null,
        onWebsite: false, inCatalogue: true, cataloguePage: 9,
      },
    },
    // 2026-11-13: beli Plus 80 × 25 (BizniSoft 044809; katalog str. 9: WHITE 44809, 200 kom.).
    {
      after: "44808",
      variant: {
        code: "44809", label: "Bela · 80 × 25 mm", searchLabel: "Bela · 80 × 25 mm", colour: "White", colourSr: "bela",
        swatch: "#E6E3DD", size: "80x25mm", holes: null, hardnessStars: null, applyWith: null, boxQuantity: 200, image: null,
        onWebsite: false, inCatalogue: true, cataloguePage: 9,
      },
    },
  ],
  // Odluka vlasnika 2026-11-13: međupodloška postoji meka (093007/093015/093062) i tvrda (093107/093115/093162).
  // Katalog str. 24: SOFT 93007/93015/93062 i HARD 93107/93115/93162, „BACKING PAD 150 mm“.
  "befar-backing-pad": [
    { after: "93162", variant: backingPad("93007", "Meka", "7 Holes", "7 rupa") },
    { after: "93007", variant: backingPad("93015", "Meka", "15 Holes", "15 rupa") },
    { after: "93015", variant: backingPad("93062", "Meka", "62 Holes", "62 rupe") },
  ],
};

/** Tvrde izvedbe sa sajta dobijaju oznaku tvrdoće čim kartica ima i meke (katalog str. 24: HARD). */
const OWNER_RELABELS: Record<string, Record<string, string>> = {
  "befar-backing-pad": { "93107": "Tvrda · 150 mm · 7 rupa", "93115": "Tvrda · 150 mm · 15 rupa", "93162": "Tvrda · 150 mm · 62 rupe" },
};

function backingPad(code: string, hardness: "Meka", holes: string, holesSr: string): CatalogVariant {
  const label = `${hardness} · 150 mm · ${holesSr}`;
  return {
    code, label, searchLabel: label, colour: null, colourSr: null, swatch: null, size: "150mm", holes, hardnessStars: null,
    applyWith: null, boxQuantity: null, image: null, onWebsite: false, inCatalogue: true, cataloguePage: 24,
  };
}

/** Tekst kartice koji mora da prati vlasnikom dodate varijante (inače zvanični tekst nabraja manje dimenzija i boja). */
const OWNER_CONTENT: Record<string, (content: CatalogProductEntry["content"]) => CatalogProductEntry["content"]> = {
  "befar-plus-velcro-polishing-pad": (c) => ({
    ...c,
    subtype: "sunđer za poliranje · čičak · 3 dimenzije · 5 boja",
    shortDescription:
      "Sunđer za poliranje sa čičkom iz linije Befar Plus, u dimenzijama 80 × 25 mm, 150 × 25 mm i 180 × 35 mm, u pet boja.",
    longDescription: c.longDescription.replace("u dimenzijama 150 × 25 mm i 180 × 35 mm", "u dimenzijama 80 × 25 mm, 150 × 25 mm i 180 × 35 mm"),
    facts: c.facts.map((f) =>
      f.label === "Dimenzije" ? { ...f, value: "80 × 25 mm, 150 × 25 mm, 180 × 35 mm" } : f.label === "Boje" ? { ...f, value: "bela, narandžasta, plava, krem, bordo" } : f,
    ),
  }),
};

function withOwnerConfirmedVariants(entry: CatalogProductEntry): CatalogProductEntry {
  const patch = OWNER_CONTENT[entry.slug];
  if (patch) entry = { ...entry, content: patch(entry.content) };
  const extra = OWNER_CONFIRMED_VARIANTS[entry.slug];
  if (!extra) return entry;
  const relabel = OWNER_RELABELS[entry.slug] ?? {};
  const variants = entry.variants.map((v) => (relabel[v.code] ? { ...v, label: relabel[v.code], searchLabel: relabel[v.code] } : v));
  for (const { after, variant } of extra) {
    if (variants.some((v) => v.code === variant.code)) continue;
    const at = variants.findIndex((v) => v.code === after);
    variants.splice(at < 0 ? variants.length : at + 1, 0, variant);
  }
  return { ...entry, variants };
}

/**
 * Proizvodi samo iz zvaničnog kataloga (nisu na aktuelnom befar.com.tr), objavljeni na odluku vlasnika.
 * Sync ih drži kao `CATALOGUE_ONLY_NOT_ON_CURRENT_WEBSITE`; podaci su prepisani sa strane kataloga, bez dopune.
 */
type FoamColour = [code: string, colour: string, colourSr: string, swatch: string, size: "150x50mm" | "150x45mm", stars: number, applyWith: string, img: string];

/** Pet boja iz kataloga (str. 4 i 5, ista legenda tvrdoće); `prefix` = početak šifre (024 M14, 034 čičak). */
const foamColours = (prefix: string): FoamColour[] => [
  [`${prefix}01`, "White", "bela", "#E6E3DD", "150x50mm", 3, "tečna ili krem polir pasta", "bela"],
  [`${prefix}02`, "Orange", "narandžasta", "#DF7A27", "150x50mm", 5, "tečna ili krem polir pasta", "narandzasta"],
  [`${prefix}03`, "Black", "crna", "#1B1E22", "150x45mm", 1, "polir ili zaštita laka", "crna"],
  [`${prefix}04`, "Yellow", "žuta", "#E3BD1F", "150x50mm", 3, "tečna ili krem polir pasta", "zuta"],
  [`${prefix}05`, "Blue", "plava", "#2E6CB4", "150x50mm", 2, "tečna ili krem polir pasta", "plava"],
];

const foamVariant = ([code, colour, colourSr, swatch, size, stars, applyWith, img]: FoamColour, o: { mount: string; box: number; page: number; imageBase: string }): CatalogVariant => {
  const dim = size === "150x50mm" ? "150 × 50 mm" : "150 × 45 mm";
  const label = `${colourSr[0].toLocaleUpperCase("sr-Latn")}${colourSr.slice(1)} · ${dim}`;
  return {
    code, label, searchLabel: `${label} · ${o.mount}`, colour, colourSr, swatch, size, holes: null, hardnessStars: stars, applyWith, boxQuantity: o.box,
    image: `/products/befar/catalog/${o.imageBase}-${img}.webp`, onWebsite: false, inCatalogue: true, cataloguePage: o.page,
  };
};

const m14 = (c: FoamColour) => foamVariant(c, { mount: "M14", box: 24, page: 4, imageBase: "befar-m14-sunder-za-poliranje" });
const velcroFoam = (c: FoamColour) => foamVariant(c, { mount: "čičak", box: 36, page: 5, imageBase: "befar-cicak-sunder-150x50" });

const OWNER_PROMOTED_ENTRIES: CatalogProductEntry[] = [
  // Odluka vlasnika 2026-11-13: sunđeri na M14 nosaču (BizniSoft 002401–002405) dobijaju svoju karticu.
  // Izvor: BEFAR Product Catalog, str. 4 „COMPOUNDING FOAM“ (kutija: „Aplikatörlü Polisaj Süngeri“).
  {
    slug: "befar-compounding-foam-m14",
    name: "Befar sunđer za poliranje M14",
    sourceKey: "catalogue-p4-compounding-foam",
    sourceUrls: [befarCatalogMeta.catalogueUrl],
    officialName: "Compounding Foam",
    officialNameTr: "Aplikatörlü Polisaj Süngeri",
    line: "Befar",
    kind: "family",
    isSet: false,
    qualifiers: ["M14"],
    officialCategories: ["Compounding Foam"],
    classification: "CATALOGUE_ONLY_OWNER_PROMOTED",
    taxonomy: { category: "poliranje", programSlug: "poliranje", phaseSlug: "poliranje", visualType: "foam" },
    cataloguePages: [4],
    leadCode: "02401",
    relatedLegacySlugs: [],
    variantColumn: { key: "color", label: "Boja i dimenzija" },
    variants: foamColours("024").map(m14),
    image: { src: "/products/befar/catalog/befar-m14-sunder-za-poliranje.webp", width: 1200, height: 745, hasAlpha: true },
    sharedGroupImages: false,
    missingOfficialAsset: false,
    gallery: [],
    content: {
      productType: "Sunđer za poliranje na M14 nosaču",
      subtype: "sunđer za poliranje · M14 nosač sa navojem · 150 × 50 mm · 5 boja",
      shortDescription:
        "Befar sunđer za poliranje na plastičnom nosaču sa navojem M14, za direktnu montažu na polirku. Prečnik 150 mm, u 5 boja.",
      longDescription:
        "Sunđer za poliranje sa krutim nosačem i navojem M14 (Befar „Compounding Foam“, na kutiji „Aplikatörlü Polisaj Süngeri“). Montira se direktno na vreteno polirke, bez čičak podloge. Dimenzija je 150 × 50 mm (crna 150 × 45 mm). Boja označava tvrdoću prema legendi proizvođača: narandžasta 5/5, bela 3/5, žuta 3/5, plava 2/5, crna 1/5. Za belu, narandžastu, žutu i plavu katalog preporučuje tečnu ili krem polir pastu, a za crnu polir ili zaštitu laka.",
      purpose: "Mašinsko poliranje lakiranih površina, polirka sa vretenom M14",
      facts: [
        { label: "Linija", value: "Befar" },
        { label: "Prihvat", value: "Nosač sa navojem M14" },
        { label: "Dimenzije", value: "150 × 50 mm (crna 150 × 45 mm)" },
        { label: "Boje", value: "bela, narandžasta, crna, žuta, plava" },
        { label: "Tvrdoća po boji", value: "narandžasta 5/5, bela 3/5, žuta 3/5, plava 2/5, crna 1/5" },
        { label: "Preporučeno sredstvo", value: "bela, narandžasta, žuta i plava: tečna ili krem polir pasta; crna: polir ili zaštita laka" },
        { label: "Fabričko pakovanje", value: "24 kom. u kutiji" },
      ],
      applications: ["Korekcija laka tečnom ili krem polir pastom", "Završno poliranje i zaštita laka (crna)"],
      benefits: [],
      advice: null,
      setContents: [],
    },
    shade: null,
  },
  // Odluka vlasnika 2026-11-13: čičak sunđeri 150 × 50 mm (BizniSoft 003401–003405) dobijaju karticu sa šiframa.
  // Izvor: BEFAR Product Catalog, str. 5 „VELCRO COMPOUNDING FOAM“; slike su isečci iz kataloga.
  {
    slug: "befar-velcro-compounding-foam-150x50",
    name: "Befar čičak sunđer za poliranje 150 × 50 mm",
    sourceKey: "catalogue-p5-velcro-compounding-foam",
    sourceUrls: [befarCatalogMeta.catalogueUrl],
    officialName: "Velcro Compounding Foam",
    officialNameTr: null,
    line: "Befar",
    kind: "family",
    isSet: false,
    qualifiers: ["150 × 50"],
    officialCategories: ["Velcro Compounding Foam"],
    classification: "CATALOGUE_ONLY_OWNER_PROMOTED",
    taxonomy: { category: "poliranje", programSlug: "poliranje", phaseSlug: "poliranje", visualType: "foam" },
    cataloguePages: [5],
    leadCode: "03401",
    relatedLegacySlugs: [],
    variantColumn: { key: "color", label: "Boja i dimenzija" },
    variants: foamColours("034").map(velcroFoam),
    image: { src: "/products/befar/catalog/befar-cicak-sunder-150x50.webp", width: 340, height: 300, hasAlpha: true },
    sharedGroupImages: false,
    missingOfficialAsset: false,
    gallery: [],
    content: {
      productType: "Čičak sunđer za poliranje",
      subtype: "sunđer za poliranje · čičak · 150 × 50 mm · 5 boja",
      shortDescription: "Befar sunđer za poliranje sa čičak poleđinom, prečnika 150 mm i visine 50 mm, u 5 boja.",
      longDescription:
        "Sunđer za poliranje sa čičak poleđinom (Befar „Velcro Compounding Foam“). Kači se na čičak podlošku polirke. Dimenzija je 150 × 50 mm (crna 150 × 45 mm). Boja označava tvrdoću prema legendi proizvođača: narandžasta 5/5, bela 3/5, žuta 3/5, plava 2/5, crna 1/5. Za belu, narandžastu, žutu i plavu katalog preporučuje tečnu ili krem polir pastu, a za crnu polir ili zaštitu laka.",
      purpose: "Mašinsko poliranje lakiranih površina, polirka sa čičak podloškom",
      facts: [
        { label: "Linija", value: "Befar" },
        { label: "Prihvat", value: "Čičak" },
        { label: "Dimenzije", value: "150 × 50 mm (crna 150 × 45 mm)" },
        { label: "Boje", value: "bela, narandžasta, crna, žuta, plava" },
        { label: "Tvrdoća po boji", value: "narandžasta 5/5, bela 3/5, žuta 3/5, plava 2/5, crna 1/5" },
        { label: "Preporučeno sredstvo", value: "bela, narandžasta, žuta i plava: tečna ili krem polir pasta; crna: polir ili zaštita laka" },
        { label: "Fabričko pakovanje", value: "36 kom. u kutiji" },
      ],
      applications: ["Korekcija laka tečnom ili krem polir pastom", "Završno poliranje i zaštita laka (crna)"],
      benefits: [],
      advice: null,
      setContents: [],
    },
    shade: null,
  },
  // Odluka vlasnika 2026-11-13: Leo magični sunđer (BizniSoft 081011). Katalog str. 41 „LEO PLUS MAGIC SPONGE“,
  // 81011L, 70 × 100 × 30 mm, 230 kom. u kutiji; slika je isečak kutije iz kataloga („Magic Sponge Hand Applicator“).
  {
    slug: "befar-leo-magic-sponge",
    name: "Befar Leo magični sunđer",
    sourceKey: "catalogue-p41-leo-plus-magic-sponge",
    sourceUrls: [befarCatalogMeta.catalogueUrl],
    officialName: "Leo Plus Magic Sponge",
    officialNameTr: null,
    line: "Leo",
    kind: "family",
    isSet: false,
    qualifiers: [],
    officialCategories: ["Leo"],
    classification: "CATALOGUE_ONLY_OWNER_PROMOTED",
    taxonomy: { category: "pribor", programSlug: "poliranje", phaseSlug: "poliranje", visualType: "neutral" },
    cataloguePages: [41],
    leadCode: "81011L",
    relatedLegacySlugs: [],
    variantColumn: { key: "size", label: "Dimenzija" },
    variants: [
      {
        code: "81011L", label: "70 × 100 × 30 mm", searchLabel: "70 × 100 × 30 mm · magični sunđer", colour: null, colourSr: null, swatch: null,
        size: "70x100x30mm", holes: null, hardnessStars: null, applyWith: null, boxQuantity: 230,
        image: null, onWebsite: false, inCatalogue: true, cataloguePage: 41,
      },
    ],
    image: { src: "/products/befar/catalog/befar-leo-magicni-sunder.webp", width: 684, height: 514, hasAlpha: true },
    sharedGroupImages: false,
    missingOfficialAsset: false,
    gallery: [],
    content: {
      productType: "Magični sunđer, ručni aplikator",
      subtype: "magični sunđer · ručni aplikator · 70 × 100 × 30 mm",
      shortDescription: "Leo magični sunđer iz Befar programa, ručni aplikator dimenzija 70 × 100 × 30 mm.",
      longDescription:
        "Leo Plus Magic Sponge je magični sunđer iz Befar Leo programa, na kutiji označen kao ručni aplikator (Magic Sponge Hand Applicator). Dimenzije su 70 × 100 × 30 mm. Način upotrebe i preporučena sredstva potvrđujemo na upit.",
      purpose: "Ručni rad u nezi i detailingu vozila",
      facts: [
        { label: "Linija", value: "Leo" },
        { label: "Dimenzije", value: "70 × 100 × 30 mm" },
        { label: "Fabričko pakovanje", value: "230 kom. u kutiji" },
      ],
      applications: [],
      benefits: [],
      advice: null,
      setContents: [],
    },
    shade: null,
  },
  // Odluka vlasnika 2026-11-13: zaštita podloške (BizniSoft 093262) je poseban proizvod, ne međupodloška.
  // Katalog str. 24 „PAD PROTECTOR 150 mm“: 93207 (7 rupa), 93215 (15 rupa), 93262 (62 rupe), 300 kom. u kutiji.
  {
    slug: "befar-pad-protector",
    name: "Befar zaštita podloške 150 mm",
    sourceKey: "catalogue-p24-pad-protector",
    sourceUrls: [befarCatalogMeta.catalogueUrl],
    officialName: "Pad Protector",
    officialNameTr: null,
    line: "Befar",
    kind: "family",
    isSet: false,
    qualifiers: [],
    officialCategories: ["Sanding Pad Group"],
    classification: "CATALOGUE_ONLY_OWNER_PROMOTED",
    taxonomy: { category: "pribor", programSlug: "abrazivi", phaseSlug: "priprema", visualType: "neutral" },
    cataloguePages: [24],
    leadCode: "93262",
    relatedLegacySlugs: [],
    variantColumn: { key: "size", label: "Broj rupa" },
    variants: (
      [["93207", "7 Holes", "7 rupa"], ["93215", "15 Holes", "15 rupa"], ["93262", "62 Holes", "62 rupe"]] as const
    ).map(([code, holes, holesSr]) => ({
      code, label: `150 mm · ${holesSr}`, searchLabel: `150 mm · ${holesSr} · zaštita podloške`, colour: null, colourSr: null, swatch: null,
      size: "150mm", holes, hardnessStars: null, applyWith: null, boxQuantity: 300, image: null, onWebsite: false, inCatalogue: true, cataloguePage: 24,
    })),
    image: null,
    sharedGroupImages: false,
    missingOfficialAsset: true,
    gallery: [],
    content: {
      productType: "Zaštita podloške",
      subtype: "zaštita podloške · 150 mm · 7, 15 ili 62 rupe",
      shortDescription: "Befar zaštita podloške (Pad Protector), prečnika 150 mm, u izvedbama sa 7, 15 i 62 rupe.",
      longDescription:
        "Pad Protector je Befar zaštita podloške brusilice iz grupe podloški za brušenje. Prečnik je 150 mm, u izvedbama sa 7, 15 ili 62 rupe; u kutiji je 300 komada. Postavljanje i kompatibilnost sa podloškom potvrđujemo na upit.",
      purpose: "Zaštita podloške brusilice",
      facts: [
        { label: "Linija", value: "Befar" },
        { label: "Dimenzije", value: "150 mm" },
        { label: "Broj rupa", value: "7, 15, 62" },
        { label: "Fabričko pakovanje", value: "300 kom. u kutiji" },
      ],
      applications: [],
      benefits: [],
      advice: null,
      setContents: [],
    },
    shade: null,
  },
  // Odluka vlasnika 2026-11-13: Befar ručni sunđer meki/tvrdi (BizniSoft 095001/095002). Katalog str. 29
  // „HAND PAD SOFT / HAND PAD HARD“: 95001 SOFT, 95002 HARD, „no holes“; slika je isečak fotografije sa te strane.
  {
    slug: "befar-hand-pad",
    name: "Befar ručni sunđer meki i tvrdi",
    sourceKey: "catalogue-p29-hand-pad-soft-hard",
    sourceUrls: [befarCatalogMeta.catalogueUrl],
    officialName: "Hand Pad Soft / Hand Pad Hard",
    officialNameTr: null,
    line: "Befar",
    kind: "family",
    isSet: false,
    qualifiers: [],
    officialCategories: ["Sanding Block"],
    classification: "CATALOGUE_ONLY_OWNER_PROMOTED",
    taxonomy: { category: "abrazivi", programSlug: "abrazivi", phaseSlug: "priprema", visualType: "neutral" },
    cataloguePages: [29],
    leadCode: "95001",
    relatedLegacySlugs: [],
    variantColumn: { key: "size", label: "Tvrdoća" },
    variants: (
      [["95001", "Soft", "Meki"], ["95002", "Hard", "Tvrdi"]] as const
    ).map(([code, hardness, hardnessSr]) => ({
      code, label: `${hardnessSr} · bez rupa`, searchLabel: `${hardnessSr} · ručni sunđer · bez rupa`, colour: null, colourSr: null, swatch: null,
      size: hardness, holes: "No holes", hardnessStars: null, applyWith: null, boxQuantity: null, image: null, onWebsite: false, inCatalogue: true, cataloguePage: 29,
    })),
    image: { src: "/products/befar/catalog/befar-rucni-sunder-meki-tvrdi.webp", width: 1305, height: 696, hasAlpha: false },
    sharedGroupImages: false,
    missingOfficialAsset: false,
    gallery: [],
    content: {
      productType: "Ručni sunđer",
      subtype: "ručni sunđer · meki ili tvrdi · bez rupa",
      shortDescription: "Befar ručni sunđer u mekoj i tvrdoj izvedbi, bez rupa.",
      longDescription:
        "Befar Hand Pad je ručni sunđer iz Befar programa, u mekoj (Soft) i tvrdoj (Hard) izvedbi, bez rupa. Namenu i preporučeni abraziv potvrđujemo na upit.",
      purpose: "Ručni rad pri pripremi površine",
      facts: [
        { label: "Linija", value: "Befar" },
        { label: "Izvedbe", value: "Meki (95001), tvrdi (95002)" },
        { label: "Rupe", value: "Bez rupa" },
      ],
      applications: [],
      benefits: [],
      advice: null,
      setContents: [],
    },
    shade: null,
  },
];

export function getBefarCatalogProducts(): CarsystemProduct[] {
  return [...entries, ...OWNER_PROMOTED_ENTRIES].map((entry) => createCatalogProduct(withOwnerConfirmedVariants(entry)));
}
