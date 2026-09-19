/**
 * Baslac sistemske baze i pripremni proizvodi kao stvarni katalog zapisi.
 *
 * Ne pravi se zasebna PDP stranica po bazi — svi zapisi iste porodice dele
 * `catalogMetadata.baseProductSlug`, pa ih postojeći family sloj
 * (`lib/product-families.ts`) skuplja u jednu canonical `ProductGroup`
 * stranicu sa varijantama.
 *
 * Javno izlaze SAMO `ACTIVE_CONFIRMED` baze. `PHASE_OUT`, `DISCONTINUED`,
 * `UNVERIFIED` i `NOT_IN_OUR_RANGE` ostaju u `lib/baslac-systems.ts` radi
 * evidencije, ali se ovde ne generišu.
 *
 * Stanje i cena se ne upisuju — dolaze iz poslovnog programa preko
 * `inventoryKey`.
 */

import syncData from "@/data/baslac-catalog-products.generated.json";
import type { CarsystemProduct } from "@/lib/carsystem-data";
import {
  baslacAllBases,
  baslacFinishLabels,
  type BaslacBase,
  type BaslacSystemId,
} from "@/lib/baslac-systems";
import type {
  ProductDetailContent,
  ProductDetailDocument,
  ProductRelationship,
  ProductTechnicalFact,
} from "@/types/product-detail";

const PLACEHOLDER = "/images/products/placeholder-product.svg";

export type BaslacFamilyDefinition = {
  system: BaslacSystemId;
  baseProductSlug: string;
  name: string;
  line: string;
  programSlug: string;
  phaseSlug: string;
  seoTitle: string;
  seoDescription: string;
  intro: string;
};

export const baslacSystemFamilies: BaslacFamilyDefinition[] = [
  {
    system: "line-30",
    baseProductSlug: "baslac-line-30",
    name: "Baslac Line 30",
    line: "Line 30",
    programSlug: "boje-i-lakovi",
    phaseSlug: "lak",
    seoTitle: "Baslac Line 30 S baze i završne boje | Carsystem i R-M",
    seoDescription:
      "Baslac Line 30 je 2K sistem završnih boja sa direktnim sjajem. Pregled S baza, pakovanja i tehničke dokumentacije uz upit za dostupnost.",
    intro:
      "Pigmentirani 2K sistem sa direktnim sjajem. Nijansa se meša po formuli iz S baza, bez obaveznog posebnog bezbojnog laka.",
  },
  {
    system: "line-35",
    baseProductSlug: "baslac-line-35",
    name: "Baslac Line 35",
    line: "Line 35",
    programSlug: "boje-i-lakovi",
    phaseSlug: "boja",
    seoTitle: "Baslac Line 35 M bazne boje | Carsystem i R-M",
    seoDescription:
      "Baslac Line 35 je konvencionalni bazni sistem sa solid, transparent, metallic, pearl i Xirallic M komponentama. Pregled baza i pakovanja.",
    intro:
      "Konvencionalni solventni bazni sistem. M komponente se mešaju po formuli u solid, transparent, metallic, pearl i Xirallic nijanse.",
  },
  {
    system: "line-45",
    baseProductSlug: "baslac-line-45",
    name: "Baslac Line 45",
    line: "Line 45",
    programSlug: "boje-i-lakovi",
    phaseSlug: "boja",
    seoTitle: "Baslac Line 45 vodene baze | Carsystem i R-M",
    seoDescription:
      "Baslac Line 45 je vodeni bazni sistem sa W baznim komponentama, reducerom, aditivima i 49-W pearl koncentratima.",
    intro:
      "Vodeni bazni sistem. W komponente pokrivaju solid, transparent, metallic i pearl nijanse, uz reducer, aditive i 49-W koncentrate efekta.",
  },
  {
    system: "line-30-cv",
    baseProductSlug: "baslac-line-30-cv",
    name: "Baslac Line 30 CV",
    line: "Line 30 CV",
    programSlug: "boje-i-lakovi",
    phaseSlug: "lak",
    seoTitle: "Baslac Line 30 CV za komercijalna vozila | Carsystem i R-M",
    seoDescription:
      "Baslac Line 30 CV je direct-gloss program za kamione, autobuse i druge velike transportne površine.",
    intro:
      "Direct-gloss program za velike transportne površine — kamione, autobuse i prikolice.",
  },
];

/** Family packshot po sistemu i zapremini; `null` znači kontrolisan placeholder. */
const FAMILY_PACKSHOTS: Record<string, string | null> = {
  "line-30:3.5": "/products/baslac/baslac--line-30-3.5l-family-packshot.webp",
  "line-30:1": null,
  "line-30-cv:3.5": "/products/baslac/baslac--line-30-3.5l-family-packshot.webp",
  "line-35:3.5": "/products/baslac/baslac--line-35-3.5l-family-packshot.webp",
  "line-35:1": null,
  "line-35:0.5": null,
  "line-45:5": null,
  "line-45:1": null,
  "line-45:0.5": null,
  "line-45:0.1": null,
};

function packshotFor(base: BaslacBase): string | null {
  const key = `${base.system}:${base.volumeL ?? "na"}`;
  return FAMILY_PACKSHOTS[key] ?? null;
}

function volumeLabel(volumeL: number | null): string {
  if (volumeL === null) return "Na upit";
  if (volumeL < 1) return `${String(volumeL).replace(".", ",")} L`;
  return `${String(volumeL).replace(".", ",")} L`;
}

function variantSlug(base: BaslacBase): string {
  return `baslac-${base.code.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function toCatalogProduct(
  base: BaslacBase,
  family: BaslacFamilyDefinition,
): CarsystemProduct {
  const packshot = packshotFor(base);
  const finishLabel = baslacFinishLabels[base.finish];
  const fullName = `Baslac ${base.code} ${base.name}`;
  const volume = volumeLabel(base.volumeL);

  return {
    slug: variantSlug(base),
    name: fullName,
    brandSlug: "baslac",
    programSlug: family.programSlug,
    phaseSlug: family.phaseSlug,
    shortDescription: `${family.line} komponenta ${base.code} — ${base.name}, ${finishLabel.toLowerCase()}, pakovanje ${volume}.`,
    longDescription: `${fullName} je komponenta sistema ${family.line}. ${family.intro} Odnos mešanja, izbor učvršćivača i razređivača i uslovi nanošenja potvrđuju se prema važećem tehničkom listu. Dostupnost i pakovanje potvrđujemo kroz upit.`,
    sku: base.code,
    externalSku: base.supplierArticle,
    packages: [{ label: volume }],
    purpose: `Izrada nijanse u sistemu ${family.line}`,
    badges: [family.line, finishLabel, volume, "Na upit"],
    productImage: {
      src: packshot ?? PLACEHOLDER,
      alt: packshot
        ? `Baslac ${family.line} ambalaža ${volume}`
        : `${fullName} — fotografija u pripremi`,
    },
    galleryImages: [],
    visualIdentity: {
      packshotKind: "family",
      visualFamily: `baslac-${base.system}`,
      swatch: base.swatch,
      finishType:
        base.finish === "converter" ||
        base.finish === "additive" ||
        base.finish === "technical"
          ? undefined
          : base.finish,
      imageConfidence: packshot ? "family-only" : "unverified",
      imageSource: base.statusSource,
    },
    specifications: [
      { label: "Sistem", value: family.line },
      { label: "Šifra", value: base.code },
      { label: "Završnica", value: finishLabel },
      { label: "Pakovanje", value: volume },
      { label: "Primena", value: "Mešanje po formuli prema tehničkom listu" },
    ],
    documents: [],
    relatedProductSlugs: [],
    variantId: base.code,
    variantOptions: {
      variant: base.code,
      color: base.name,
      finish: finishLabel,
      volume,
    },
    seoTitle: `${fullName} — ${volume} | Carsystem i R-M`,
    seoDescription: `${fullName}, ${finishLabel.toLowerCase()} komponenta sistema ${family.line} u pakovanju ${volume}. Dostupnost potvrđujemo kroz upit.`,
    catalogMetadata: {
      id: `baslac-${base.code.toLowerCase()}`,
      baseProductSlug: family.baseProductSlug,
      variantId: base.code,
      line: family.line,
      officialName: `${base.code} ${base.name}`,
      displayNameSr: fullName,
      cosmosCode: null,
      ralCode: null,
      colorName: base.name,
      finish: finishLabel,
      volume,
      technicalCategory: family.line,
      verificationStatus: base.productionStatus,
      sourceReference: base.statusSource,
      colorSource: "name-derived",
      colorConfidence: "provisional",
    },
  } as CarsystemProduct;
}

/** Samo javno aktivne baze ulaze u katalog, pretragu, sitemap i Quick Add. */
export const baslacSystemVariants: CarsystemProduct[] = baslacSystemFamilies
  .flatMap((family) =>
    baslacAllBases
      .filter(
        (base) =>
          base.system === family.system &&
          base.productionStatus === "ACTIVE_CONFIRMED",
      )
      .map((base) => toCatalogProduct(base, family)),
  );

/** Broj javno aktivnih varijanti po sistemu — koristi se u testovima. */
export function baslacActiveVariantCounts(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const family of baslacSystemFamilies) {
    counts[family.system] = baslacAllBases.filter(
      (base) =>
        base.system === family.system &&
        base.productionStatus === "ACTIVE_CONFIRMED",
    ).length;
  }
  return counts;
}


/* -------------------------------------------------------------------------
 * Pripremni proizvodi (primer/filler, plastika, washprimer).
 * Porodice sa više pakovanja koriste isti `baseProductSlug`.
 * ---------------------------------------------------------------------- */

type PrimerVariant = {
  code: string;
  name: string;
  volume: string;
  volumeKey: string;
  image: string | null;
  family: string;
  familyName: string;
  phaseSlug: string;
  purpose: string;
};

const PRIMER_VARIANTS: PrimerVariant[] = [
  ["20-24", "2K Primerfiller Grey", "1 L", "1l", "/products/baslac/baslac--20-24-2k-primerfiller-grey-1l-packshot.webp", "baslac-20-24-2k-primerfiller-grey", "Baslac 20-24 2K Primerfiller Grey", "priprema", "Punjenje i ravnanje podloge pre boje"],
  ["20-24", "2K Primerfiller Grey", "4 L", "4l", null, "baslac-20-24-2k-primerfiller-grey", "Baslac 20-24 2K Primerfiller Grey", "priprema", "Punjenje i ravnanje podloge pre boje"],
  ["20-34", "2K Primerfiller White", "1 L", "1l", null, "baslac-20-34-2k-primerfiller-white", "Baslac 20-34 2K Primerfiller White", "priprema", "Svetla podloga za nijanse koje traže belu bazu"],
  ["20-34", "2K Primerfiller White", "4 L", "4l", "/products/baslac/baslac--20-34-2k-primerfiller-white-4l-packshot.webp", "baslac-20-34-2k-primerfiller-white", "Baslac 20-34 2K Primerfiller White", "priprema", "Svetla podloga za nijanse koje traže belu bazu"],
  ["20-35", "2K Primerfiller Wet-on-Wet White", "3 L", "3l", "/products/baslac/baslac--20-35-2k-primerfiller-wet-on-wet-white-3l-packshot.webp", "baslac-20-35-2k-primerfiller-wet-on-wet-white", "Baslac 20-35 2K Primerfiller Wet-on-Wet White", "priprema", "Wet-on-wet podloga bez međubrušenja"],
  // 1 L packshot je NEEDS_ASSET; varijanta ipak postoji kao kupovna stavka.
  ["20-94", "2K Primerfiller Black", "1 L", "1l", null, "baslac-20-94-2k-primerfiller-black", "Baslac 20-94 2K Primerfiller Black", "priprema", "Tamna podloga za duboke nijanse"],
  ["20-94", "2K Primerfiller Black", "4 L", "4l", "/products/baslac/baslac--20-94-2k-primerfiller-black-4l-packshot.webp", "baslac-20-94-2k-primerfiller-black", "Baslac 20-94 2K Primerfiller Black", "priprema", "Tamna podloga za duboke nijanse"],
  ["20-95", "2K Primerfiller Wet-on-Wet Black", "3 L", "3l", "/products/baslac/baslac--20-95-2k-primerfiller-wet-on-wet-black-3l-packshot.webp", "baslac-20-95-2k-primerfiller-wet-on-wet-black", "Baslac 20-95 2K Primerfiller Wet-on-Wet Black", "priprema", "Tamna wet-on-wet podloga"],
  ["21-20", "Plastic Primer", "400 ml", "400ml", null, "baslac-21-20-plastic-primer", "Baslac 21-20 Plastic Primer", "priprema", "Adhezioni sloj na pripremljenoj plastici"],
  ["21-11", "2K Plastic Primer VOC", "1 L", "1l", null, "baslac-21-11-2k-plastic-primer-voc", "Baslac 21-11 2K Plastic Primer VOC", "priprema", "2K adhezioni prajmer za plastiku"],
  ["25-30", "2K Primerfiller EP", "4 L", "4l", "/products/baslac/baslac--25-30-2k-ep-primerfiller-4l-packshot.webp", "baslac-25-30-2k-primerfiller-ep", "Baslac 25-30 2K Primerfiller EP", "priprema", "Epoxy zaštita i izolacija podloge"],
  ["27-10", "2K Washprimer", "1 L", "1l", null, "baslac-27-10-2k-washprimer", "Baslac 27-10 2K Washprimer", "priprema", "Adhezioni korak na metalnim podlogama"],
  ["27-10", "2K Washprimer", "4 L", "4l", "/products/baslac/baslac--27-10-2k-washprimer-4l-packshot.webp", "baslac-27-10-2k-washprimer", "Baslac 27-10 2K Washprimer", "priprema", "Adhezioni korak na metalnim podlogama"],
].map(([code, name, volume, volumeKey, image, family, familyName, phaseSlug, purpose]) => ({
  code: code as string,
  name: name as string,
  volume: volume as string,
  volumeKey: volumeKey as string,
  image: image as string | null,
  family: family as string,
  familyName: familyName as string,
  phaseSlug: phaseSlug as string,
  purpose: purpose as string,
}));

function toPrimerProduct(variant: PrimerVariant): CarsystemProduct {
  const fullName = `Baslac ${variant.code} ${variant.name}`;
  return {
    slug: `${variant.family}-${variant.volumeKey}`,
    name: `${fullName} ${variant.volume}`,
    brandSlug: "baslac",
    programSlug: "boje-i-lakovi",
    phaseSlug: variant.phaseSlug,
    shortDescription: `${variant.purpose}. Pakovanje ${variant.volume}.`,
    longDescription: `${fullName} u pakovanju ${variant.volume}. ${variant.purpose}. Odnos mešanja, izbor učvršćivača i vreme sušenja potvrđuju se prema važećem tehničkom listu. Dostupnost potvrđujemo kroz upit.`,
    sku: `${variant.code}-${variant.volumeKey.toUpperCase()}`,
    packages: [{ label: variant.volume }],
    purpose: variant.purpose,
    badges: [variant.code, variant.volume, "Na upit"],
    productImage: {
      src: variant.image ?? PLACEHOLDER,
      alt: variant.image
        ? `${fullName}, pakovanje ${variant.volume}`
        : `${fullName} ${variant.volume} — fotografija u pripremi`,
    },
    galleryImages: [],
    visualIdentity: {
      packshotKind: "specific",
      imageConfidence: variant.image ? "confirmed" : "unverified",
    },
    specifications: [
      { label: "Šifra", value: variant.code },
      { label: "Pakovanje", value: variant.volume },
      { label: "Namena", value: variant.purpose },
    ],
    documents: [],
    relatedProductSlugs: [],
    variantId: `${variant.code}-${variant.volumeKey}`,
    variantOptions: { variant: `${variant.code}-${variant.volumeKey}`, volume: variant.volume },
    seoTitle: `${fullName} ${variant.volume} | Carsystem i R-M`,
    seoDescription: `${fullName} u pakovanju ${variant.volume}. ${variant.purpose}. Dostupnost potvrđujemo kroz upit.`,
    catalogMetadata: {
      id: `baslac-${variant.code.toLowerCase()}-${variant.volumeKey}`,
      baseProductSlug: variant.family,
      variantId: `${variant.code}-${variant.volumeKey}`,
      line: variant.code,
      officialName: `${variant.code} ${variant.name}`,
      displayNameSr: `${fullName} ${variant.volume}`,
      cosmosCode: null,
      ralCode: null,
      colorName: null,
      finish: null,
      volume: variant.volume,
      technicalCategory: "Priprema podloge",
      verificationStatus: "ACTIVE_CONFIRMED",
      sourceReference: "Interni katalog + dostavljeni packshotovi",
      colorSource: "manual-estimate",
      colorConfidence: "provisional",
    },
  } as CarsystemProduct;
}

export const baslacPrimerVariants: CarsystemProduct[] =
  PRIMER_VARIANTS.map(toPrimerProduct);


/**
 * Stari slug → canonical slug, izveden iz `BaslacBase.catalogSlug`.
 *
 * `catalogSlug` je nekada značio „ovaj artikal već ima ručno pisanu stranicu".
 * To je bio uzrok duplikata: ručni zapis je nastavio da postoji uporedo sa
 * generisanim, jednom pod istim slugom (`baslac-35-m214`), jednom pod drugim
 * (`baslac-35-m331-pasta`). Sada je značenje jednoznačno:
 *
 *   generisani zapis je JEDINI vlasnik artikla;
 *   `catalogSlug` je samo ADRESA koju je artikal ranije imao.
 *
 * Kada se te dve adrese poklapaju, nema šta da se preusmerava. Kada se
 * razlikuju, stari slug ulazi ovde i dobija trajno preusmerenje.
 *
 * Baza koja ne proizvodi kataloški zapis (npr. `30-S510`, `UNVERIFIED`) ne
 * ulazi — njen `catalogSlug` i dalje pokazuje na živ, ručno pisan proizvod koji
 * ova sanacija ne dira.
 */
export const BASLAC_LEGACY_SLUGS: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(
    baslacAllBases
      .filter((base) => base.productionStatus === "ACTIVE_CONFIRMED" && base.catalogSlug)
      .map((base) => [base.catalogSlug as string, variantSlug(base)] as const)
      .filter(([legacy, canonical]) => legacy !== canonical),
  ),
);


/**
 * Stari/variant URL Baslac sistemske baze vodi na canonical family PDP sa
 * preselektovanom varijantom. Konkretni proizvodi (20-24, 27-10 …) zadržavaju
 * svoje stranice.
 */
export function baslacVariantRedirect(slug: string): string | null {
  const variant = baslacSystemVariants.find((product) => product.slug === slug);
  if (!variant) return null;
  const familySlug = variant.catalogMetadata?.baseProductSlug;
  const code = variant.variantId;
  if (!familySlug || !code) return null;
  return `/proizvodi/grupa/${familySlug}?varijanta=${encodeURIComponent(code)}`;
}

/* -------------------------------------------------------------------------
 * Zvanični baslac asortiman iz `npm run baslac:sync`.
 *
 * Isti obrazac kao `lib/{carsystem,carfit,befar,rm}-catalog-products.ts`: skripta piše
 * `data/baslac-catalog-products.generated.json`, a ovaj deo ga prevodi u `CarsystemProduct`.
 * Ovde nema poslovnih odluka.
 *
 * Tri stvari su specifične za baslac:
 *   1. SISTEM ZA NIJANSIRANJE je jedan zapis koji nosi javni identitet svoje porodice
 *      (`catalogMetadata.familyIdentity`). Toneri ostaju varijante te porodice i nemaju
 *      svoje kartice; mixing komponenta (30-S00, 30-S01, 35-M00, 45-W00) je ugnježdena
 *      činjenica sistema, ne kartica.
 *   2. Javna zvanična šifra je oznaka proizvoda („40-40”, „50-415”). Brojevi artikala
 *      postoje samo u imenima zvaničnih slika i ne objavljuju se.
 *   3. `45-R45` i `45-W10` imaju sopstveni zvanični identitet, pa napuštaju porodicu 45
 *      i postaju samostalne kartice — pod svojom postojećom adresom.
 * ---------------------------------------------------------------------- */

type SyncTechnical = {
  revision: string | null;
  mixingRatio: string | null;
  sprayViscosity: string | null;
  potLife: string | null;
  nozzle: string | null;
  sprayCoats: string | null;
  filmThickness: string | null;
  flashOff: string | null;
  sanding: string | null;
  drying: string[];
  voc: { content: number; limit: number | null; category: string | null } | null;
};

type SyncRelation = { code: string; relation: string; slug: string | null; name: string };
type SyncDocument = { kind: string; title: string; href: string; language: string | null; version: string | null; note: string };

type SyncEntry = {
  slug: string;
  name: string;
  sourceKey: string;
  code: string | null;
  officialName: string;
  displayName: string | null;
  kind: "product" | "system";
  role: string;
  line: string | null;
  status: string;
  promotedFromLine: boolean;
  family: { baseProductSlug: string; identity: { name: string; slug: string } } | null;
  sourceUrls: string[];
  taxonomy: { category: string; programSlug: string; phaseSlug: string; visualType: string; rule: string };
  systemComponents: { code: string; officialName: string | null; tds: string | null; technical: SyncTechnical }[];
  relations: SyncRelation[];
  usedBy: SyncRelation[];
  technical: SyncTechnical;
  documents: SyncDocument[];
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
};

type SyncEnrichment = {
  code: string;
  officialName: string;
  /** Zvanično ime za zapis koji je postao samostalna kartica; `null` kada ime ostaje. */
  displayName: string | null;
  role: string;
  status: string;
  promotedFromLine: boolean;
  detachFromFamily: boolean;
  sourceUrls: string[];
  taxonomy: SyncEntry["taxonomy"];
  relations: SyncRelation[];
  usedBy: SyncRelation[];
  technical: SyncTechnical;
  documents: SyncDocument[];
};

const syncEntries = syncData.products as SyncEntry[];
const syncEnrichments = syncData.enrichments as Record<string, SyncEnrichment>;

export const baslacSyncMeta = syncData.meta;

/**
 * Postojeći family packshot ostaje slika sistema.
 *
 * Zvanični sajt nema packshot sistema (na stranici sistema su ilustracije programa), a
 * ove slike su već na sajtu kao slika te porodice — zapis sistema ih preuzima da kartica
 * porodice ne bi nazadovala na placeholder.
 */
const SYSTEM_PACKSHOTS: Record<string, string | null> = {
  "line-30": FAMILY_PACKSHOTS["line-30:3.5"],
  "line-30-cv": FAMILY_PACKSHOTS["line-30-cv:3.5"],
  "line-35": FAMILY_PACKSHOTS["line-35:3.5"],
  "line-45": FAMILY_PACKSHOTS["line-45:5"],
};

const CATEGORY_BADGE: Record<string, string> = {
  boje: "Boje i lakovi",
  kitovi: "Kit",
  sprejevi: "Sprej",
  ciscenje: "Čišćenje",
};

const RELATION_LABEL: Record<string, string> = {
  USES_HARDENER: "Učvršćivač po tehničkom listu",
  USES_REDUCER: "Razređivač po tehničkom listu",
  USES_ADDITIVE: "Aditiv naveden u tehničkom listu",
  USED_BY: "Koristi se uz ovaj proizvod",
};

const DRYING_LABELS: [RegExp, string][] = [
  [/^Drying at /i, ""],
  [/^Infrared \(short wave\)/i, "IC kratkotalasno"],
  [/^Infrared \(medium wave\)/i, "IC srednjetalasno"],
];

function dryingText(drying: string[]): string {
  return drying
    .map((line) => {
      const [label, value] = line.split(": ");
      const translated = DRYING_LABELS.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), label).trim();
      return `${translated || label}: ${value}`;
    })
    .join(" · ");
}

/** Tehničke činjenice iz zvaničnog lista — vrednosti se prenose doslovno. */
function syncTechnicalFacts(technical: SyncTechnical, code: string | null): ProductTechnicalFact[] {
  const fact = (label: string, value: string | null | undefined) =>
    value ? [{ label, value, reviewStatus: "confirmed" as const }] : [];
  return [
    ...(code ? [{ label: "baslac oznaka", value: code, reviewStatus: "confirmed" as const }] : []),
    ...fact("Odnos mešanja", technical.mixingRatio),
    ...fact("Viskozitet prskanja", technical.sprayViscosity),
    ...fact("Vreme upotrebe smeše", technical.potLife),
    ...fact("Mlaznica", technical.nozzle),
    ...fact("Broj slojeva", technical.sprayCoats),
    ...fact("Debljina filma", technical.filmThickness),
    ...fact("Razmak između slojeva", technical.flashOff),
    ...fact("Brušenje", technical.sanding),
    ...(technical.drying.length ? [{ label: "Sušenje", value: dryingText(technical.drying), reviewStatus: "confirmed" as const }] : []),
    ...(technical.voc
      ? [{
          label: "VOC",
          value: `${technical.voc.content} g/l`,
          ...(technical.voc.limit ? { detail: `EU granica za ovaj proizvod: ${technical.voc.limit} g/l` } : {}),
          reviewStatus: "confirmed" as const,
        }]
      : []),
    ...fact("Revizija tehničkog lista", technical.revision?.replace(/^(\d{2})\/(\d{4})$/, "$1/$2")),
  ];
}

function syncDocuments(slug: string, documents: SyncDocument[]): ProductDetailDocument[] {
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
      note: "baslac bezbednosne listove izdaje lokalni predstavnik — dostupno na upit.",
      reviewStatus: "confirmed" as const,
    },
  ];
}

function syncRelationships(relations: SyncRelation[]): ProductRelationship[] {
  return relations
    .filter((relation) => relation.slug)
    .map((relation) => ({
      productSlug: relation.slug as string,
      note: `${RELATION_LABEL[relation.relation] ?? relation.relation} · ${relation.code}`,
      reviewStatus: "confirmed" as const,
    }));
}

/** Pojmovi pretrage: oznaka je ono što kupac zaista kuca („40-40”, „4040”). */
function syncSearchTerms(entry: { code: string | null; officialName: string; displayName?: string | null; content?: { productType: string } }) {
  return [
    ...new Set(
      [entry.code, entry.code?.replace(/[^0-9A-Za-z]/g, ""), entry.officialName, entry.displayName ?? null, entry.content?.productType].filter(
        (value): value is string => Boolean(value),
      ),
    ),
  ];
}

function toSyncCatalogProduct(entry: SyncEntry): CarsystemProduct {
  const { content } = entry;
  const image = entry.image?.src ?? (entry.kind === "system" ? SYSTEM_PACKSHOTS[entry.sourceKey] ?? null : null);
  const badges = [content.productType, ...(entry.code ? [entry.code] : []), "Na upit"];
  const components = entry.systemComponents;

  const detail: ProductDetailContent = {
    reviewStatus: "confirmed",
    hero: {
      kicker: `baslac · ${CATEGORY_BADGE[entry.taxonomy.category] ?? "Program"}`,
      subtype: content.subtype,
      lead: content.shortDescription,
    },
    quickFacts: {
      reviewStatus: "confirmed",
      content: [
        ...(entry.code ? [{ label: "baslac oznaka", value: entry.code, reviewStatus: "confirmed" as const }] : []),
        { label: "Tip proizvoda", value: content.productType, reviewStatus: "confirmed" as const },
        { label: "Dostupnost", value: "Na upit", reviewStatus: "confirmed" as const },
      ],
    },
    ...(content.benefits.length
      ? {
          benefits: {
            reviewStatus: "confirmed" as const,
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
        ...syncTechnicalFacts(entry.technical, entry.code),
        ...content.facts
          .filter((fact) => !syncTechnicalFacts(entry.technical, entry.code).some((existing) => existing.label === fact.label))
          .map((fact) => ({ ...fact, reviewStatus: "confirmed" as const })),
        ...(components.length
          ? [{
              label: "Komponenta za mešanje",
              value: components.map((component) => component.officialName ?? component.code).join(" · "),
              detail: "Mixing baza sistema; ne koristi se samostalno i nema zasebnu karticu.",
              reviewStatus: "confirmed" as const,
            }]
          : []),
        ...(content.advice && !content.applications.length ? [{ label: "Napomena proizvođača", value: content.advice, reviewStatus: "confirmed" as const }] : []),
      ],
    },
    ...(entry.relations.length || entry.usedBy.length
      ? {
          compatibleProducts: {
            reviewStatus: "confirmed" as const,
            content: {
              title: ["hardener", "reducer", "additive"].includes(entry.role) ? "Proizvodi uz koje se koristi" : "Komponente po tehničkom listu",
              description: ["hardener", "reducer", "additive"].includes(entry.role)
                ? "Zvanični tehnički listovi baslac proizvoda navode ovu komponentu; dostupnost se proverava kroz upit."
                : "Učvršćivači, razređivači i aditivi koje tehnički list navodi uz ovaj proizvod.",
              items: syncRelationships([...entry.relations, ...entry.usedBy]),
            },
          },
        }
      : {}),
    documents: {
      reviewStatus: "confirmed",
      content: syncDocuments(entry.slug, entry.documents),
    },
  };

  return {
    slug: entry.slug,
    name: entry.name,
    brandSlug: "baslac",
    programSlug: entry.taxonomy.programSlug,
    phaseSlug: entry.taxonomy.phaseSlug as CarsystemProduct["phaseSlug"],
    shortDescription: content.shortDescription,
    longDescription: content.longDescription,
    sku: entry.code ?? entry.slug,
    externalSku: entry.code ?? undefined,
    manufacturerCode: entry.code,
    packages: [{ label: "Na upit", detail: "Pakovanja baslac ne objavljuje javno; potvrđuju se kroz upit." }],
    purpose: content.purpose,
    badges,
    publicStatus: "Na upit",
    stockStatus: "unknown",
    stockManaged: false,
    productImage: image
      ? { src: image, alt: `${entry.name}, ${content.productType.toLocaleLowerCase("sr-Latn")}` }
      : { src: PLACEHOLDER, alt: `${entry.name}, ilustrativni prikaz proizvoda` },
    galleryImages: [],
    specifications: [
      { label: "Tip proizvoda", value: content.productType },
      ...(entry.code ? [{ label: "baslac oznaka", value: entry.code }] : []),
      ...content.facts,
    ],
    documents: [
      ...entry.documents.map((document) => ({ title: "Tehnički list", kind: "PDF", href: document.href, status: "available" as const, note: document.note })),
      { title: "Bezbednosni list", kind: "PDF", status: "placeholder" as const, note: "Izdaje lokalni predstavnik — dostupno na upit." },
    ],
    relatedProductSlugs: [...entry.relations, ...entry.usedBy].map((relation) => relation.slug).filter((slug): slug is string => Boolean(slug)).slice(0, 6),
    seoTitle: `${entry.name} | Carsystem i R-M`,
    seoDescription: content.shortDescription,
    taxonomyCategory: entry.taxonomy.category as CarsystemProduct["taxonomyCategory"],
    searchTerms: syncSearchTerms(entry),
    detail,
    ...(entry.family
      ? {
          catalogMetadata: {
            id: `baslac-${entry.sourceKey}`,
            baseProductSlug: entry.family.baseProductSlug,
            variantId: entry.sourceKey,
            line: entry.line ?? entry.officialName,
            officialName: entry.officialName,
            displayNameSr: entry.name,
            cosmosCode: null,
            ralCode: null,
            colorName: null,
            finish: null,
            volume: "Na upit",
            technicalCategory: entry.officialName,
            verificationStatus: "ACTIVE_CONFIRMED",
            sourceReference: entry.sourceUrls[0] ?? null,
            colorSource: "name-derived" as const,
            colorConfidence: "provisional" as const,
            familyIdentity: entry.family.identity,
          },
        }
      : {}),
  } as CarsystemProduct;
}

export function getBaslacSyncProducts(): CarsystemProduct[] {
  return syncEntries.map(toSyncCatalogProduct);
}

/**
 * Dopuna zapisa koje već vodimo (pripremni proizvodi i dosije baza).
 *
 * Slug, ime, slika i pakovanja OSTAJU njihovi — menja se samo ono što zvanični izvor sada
 * potvrđuje: taksonomija, tehničke činjenice iz aktuelnog lista, odnosi i pojmovi pretrage.
 * Za `45-R45` i `45-W10` dodatno otpada pripadnost porodici 45: oni imaju sopstveni
 * zvanični identitet, pa njihova postojeća adresa od sada renderuje svoj PDP.
 */
export function applyBaslacSyncEnrichment(record: CarsystemProduct): CarsystemProduct {
  const enrichment = syncEnrichments[record.slug];
  if (!enrichment) return record;

  const detail = record.detail;
  const facts = syncTechnicalFacts(enrichment.technical, enrichment.code);
  /*
   * Ime se menja samo kada zvanični izvor to traži (promovisan zapis). Slug, adresa,
   * šifra proizvođača, odnosi i dokumenti ostaju isti, a staro ime ostaje u pojmovima
   * pretrage — kupac koji ga zna i dalje nalazi proizvod.
   */
  const renamed = enrichment.displayName && enrichment.displayName !== record.name;
  return {
    ...record,
    ...(renamed
      ? {
          name: enrichment.displayName as string,
          seoTitle: `${enrichment.displayName} | Carsystem i R-M`,
          catalogMetadata: record.catalogMetadata
            ? { ...record.catalogMetadata, officialName: enrichment.officialName, displayNameSr: enrichment.displayName as string }
            : record.catalogMetadata,
        }
      : {}),
    manufacturerCode: enrichment.code,
    taxonomyCategory: enrichment.taxonomy.category as CarsystemProduct["taxonomyCategory"],
    programSlug: enrichment.taxonomy.programSlug,
    phaseSlug: enrichment.taxonomy.phaseSlug as CarsystemProduct["phaseSlug"],
    searchTerms: [...new Set([...(record.searchTerms ?? []), ...syncSearchTerms(enrichment), ...(renamed ? [record.name] : [])])],
    documents: [
      ...(record.documents ?? []),
      ...enrichment.documents.map((document) => ({ title: "Tehnički list", kind: "PDF", href: document.href, status: "available" as const, note: document.note })),
    ],
    specifications: [
      ...(record.specifications ?? []),
      ...facts.filter((fact) => !(record.specifications ?? []).some((existing) => existing.label === fact.label)).map((fact) => ({ label: fact.label, value: fact.value })),
    ],
    ...(enrichment.detachFromFamily && record.catalogMetadata
      ? {
          catalogMetadata: {
            ...record.catalogMetadata,
            ...(renamed ? { officialName: enrichment.officialName, displayNameSr: enrichment.displayName as string } : {}),
            // Promovisan zapis napušta porodicu: sam sebi je osnova, pa nema varijanti.
            baseProductSlug: record.slug,
          },
        }
      : {}),
    ...(detail
      ? {
          detail: {
            ...detail,
            technicalFacts: {
              reviewStatus: "confirmed" as const,
              content: [
                ...(detail.technicalFacts?.content ?? []),
                ...facts.filter((fact) => !(detail.technicalFacts?.content ?? []).some((existing) => existing.label === fact.label)),
              ],
            },
            ...(enrichment.relations.length || enrichment.usedBy.length
              ? {
                  compatibleProducts: {
                    reviewStatus: "confirmed" as const,
                    content: {
                      title: ["hardener", "reducer", "additive"].includes(enrichment.role) ? "Proizvodi uz koje se koristi" : "Komponente po tehničkom listu",
                      description: "Odnosi su preuzeti iz aktuelnog zvaničnog tehničkog lista.",
                      items: syncRelationships([...enrichment.relations, ...enrichment.usedBy]),
                    },
                  },
                }
              : {}),
          },
        }
      : {}),
  };
}

/**
 * Sve što Baslac dodaje u glavni katalog.
 *
 * Zapisi sinhronizacije idu PRVI: sistem nosi javni identitet svoje porodice, pa je
 * prirodno da stoji ispred svojih mixing baza.
 */
export const baslacCatalogProducts: CarsystemProduct[] = [
  ...getBaslacSyncProducts(),
  ...baslacSystemVariants,
  ...baslacPrimerVariants,
];
