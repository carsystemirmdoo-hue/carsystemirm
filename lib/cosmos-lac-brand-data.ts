import generatedRecords from "@/data/cosmos-lac-products.generated.json";

/**
 * COSMOS LAC brand-page data adapter.
 *
 * Implements the presentation-layer normalisation required by
 * docs/COSMOS_LAC_DESIGN_SPECIFICATION.md §7, §8 and §16.
 *
 * Two normalisations matter and are deliberate:
 *
 * 1. MOLOTOW EXCLUSION — 73 of the 742 imported records carry Molotow's brand
 *    name in `line`/`officialName` and cite Molotow TDS documents as their
 *    source, yet every record in the file is tagged `brandSlug: "cosmos-lac"`.
 *    Molotow is a distinct brand and is NOT presented as a family on Cosmos
 *    Lac's own product line-up. Until that data-model relationship is verified
 *    we must not present those records as Cosmos Lac products, and we must not
 *    include them in any public COSMOS count. They are excluded here, at the
 *    presentation layer only — the source data is left untouched so the
 *    catalogue continues to serve them.
 *
 * 2. FLAME MERGE — FLAME ships as three `line` values (Flame Orange, Flame
 *    Blue, Flame Booster). They are one family and must render as one panel.
 */

type GeneratedRecord = {
  id: string;
  slug: string;
  baseProductSlug: string;
  variantId: string;
  line: string;
  officialName: string;
  displayNameSr: string;
  colorName: string | null;
  ralCode: string | null;
  finish: string | null;
  volume: string | null;
  programSlug: string;
  primaryCategory: string;
  technicalCategory: string;
  image: string;
  imageAlt: string;
  backgroundColor: string;
  foregroundTone: "light" | "dark";
  colorSource: string;
  colorConfidence: "verified" | "derived" | "provisional";
};

const records = generatedRecords as unknown as GeneratedRecord[];

/** A record belongs to a third-party brand and must stay out of COSMOS-facing UI. */
function isThirdPartyBrand(record: GeneratedRecord) {
  return (
    /molotow/i.test(record.line) || /molotow/i.test(record.officialName ?? "")
  );
}

/** Every record we are allowed to present as, and count as, Cosmos Lac. */
const cosmosRecords = records.filter((record) => !isThirdPartyBrand(record));

const excludedRecords = records.filter(isThirdPartyBrand);

// --- colour maths (WCAG 2.1 relative luminance / contrast ratio) -----------

function hexToRgb(hex: string) {
  const value = hex.replace("#", "");
  const full =
    value.length === 3
      ? value
          .split("")
          .map((char) => char + char)
          .join("")
      : value;
  return {
    r: Number.parseInt(full.slice(0, 2), 16),
    g: Number.parseInt(full.slice(2, 4), 16),
    b: Number.parseInt(full.slice(4, 6), 16),
  };
}

function relativeLuminance(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const channel = (raw: number) => {
    const srgb = raw / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(foreground: string, background: string) {
  const first = relativeLuminance(foreground);
  const second = relativeLuminance(background);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

/** 0..1 — how saturated a colour is, used to prefer real colour over neutrals. */
function chroma(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  return (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
}

/** 0..360 — hue angle, used to keep family accents visually distinguishable. */
function hue(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  if (delta === 0) return 0;
  let value: number;
  if (max === rn) value = ((gn - bn) / delta) % 6;
  else if (max === gn) value = (bn - rn) / delta + 2;
  else value = (rn - gn) / delta + 4;
  return (value * 60 + 360) % 360;
}

/** Smallest angle between two hues, 0..180. */
function hueDistance(first: string, second: string) {
  const diff = Math.abs(hue(first) - hue(second)) % 360;
  return diff > 180 ? 360 - diff : diff;
}

/** Smallest angle between a colour's hue and a target angle, 0..180. */
function hueDistanceToAngle(hex: string, angle: number) {
  const diff = Math.abs(hue(hex) - angle) % 360;
  return diff > 180 ? 360 - diff : diff;
}

export const COSMOS_INK = "#0B0B0C";
export const COSMOS_CHALK = "#F4F7F2";
const COSMOS_VOID = "#08090A";
/** Text on the accent must clear WCAG AA. */
const MIN_CONTRAST = 4.5;
/**
 * The accent must also be clearly visible *against the page*. Without this a
 * dark navy or near-black product colour technically passes the text test but
 * the panel fill is invisible on a black page, so the interaction reads as
 * nothing happening.
 */
const MIN_ACCENT_VS_PAGE = 3;

// --- family model ----------------------------------------------------------

export type CosmosFamily = {
  slug: string;
  name: string;
  eyebrow: string;
  lines: string[];
  variantCount: number;
  productGroupCount: number;
  signatureVariantSlug: string;
  signatureImage: string;
  signatureImageAlt: string;
  signatureColorName: string | null;
  accent: string;
  accentTextColor: string;
  accentContrast: number;
  catalogueHref: string;
};

type FamilyDefinition = {
  slug: string;
  name: string;
  eyebrow: string;
  lines: string[];
  /** Free-text catalogue query; the catalogue `q` haystack includes `line`. */
  query: string;
  /**
   * Hue this family aims for, so the seven accents span the wheel. The colour
   * itself is still taken from a real can — this only decides which one.
   */
  targetHue: number;
};

/**
 * The seven families Cosmos Lac itself leads with. Order is narrative, not
 * variant count. Every `lines` value is verified present in the dataset.
 */
const FAMILY_DEFINITIONS: FamilyDefinition[] = [
  {
    slug: "ral",
    name: "RAL",
    eyebrow: "RAL STANDARD U SPREJU",
    lines: ["RAL"],
    query: "cosmos lac ral",
    targetHue: 257,
  },
  {
    slug: "easy-max",
    name: "EASY MAX",
    eyebrow: "MAKSIMALNA POKRIVNOST",
    lines: ["Easy Max"],
    query: "cosmos lac easy max",
    targetHue: 103,
  },
  {
    slug: "chalk-effect",
    name: "CHALK EFFECT",
    eyebrow: "DUBOKI MAT ZA DEKOR",
    lines: ["Chalk Effect"],
    query: "cosmos lac chalk effect",
    targetHue: 206,
  },
  {
    slug: "fast-acrylic",
    name: "FAST ACRYLIC",
    eyebrow: "BRZO SUŠENJE, PUN SJAJ",
    lines: ["Fast Acrylic"],
    query: "cosmos lac fast acrylic",
    targetHue: 0,
  },
  {
    slug: "spray-bike",
    name: "SPRAY.BIKE",
    eyebrow: "PROGRAM ZA BICIKLE",
    lines: ["Spray.Bike"],
    query: "cosmos lac spray.bike",
    targetHue: 154,
  },
  {
    slug: "flame",
    name: "FLAME",
    eyebrow: "GRAFIT I STREET ART",
    // One family, three source lines — merged per specification §7.
    lines: ["Flame Orange", "Flame Blue", "Flame Booster"],
    query: "cosmos lac flame",
    targetHue: 309,
  },
  {
    slug: "master-mechanic",
    name: "MASTER MECHANIC",
    eyebrow: "SERVIS I ODRŽAVANJE",
    lines: ["Master Mechanic"],
    query: "cosmos lac master mechanic",
    targetHue: 51,
  },
];

export const COSMOS_CATALOGUE_HREF = "/katalog?brend=cosmos-lac";

function catalogueQueryHref(query: string) {
  return `/katalog?brend=cosmos-lac&q=${encodeURIComponent(query)}`;
}

const SOURCE_RANK: Record<string, number> = {
  "official-chart": 0,
  ral: 1,
  "cap-sample": 2,
  "name-derived": 3,
  "manual-estimate": 4,
};

/**
 * Ranked accent candidates for one family (specification §8).
 *
 * The family accent is never invented: it is the verified `backgroundColor` of
 * one real can from that family. A candidate must clear the 4.5:1 contrast
 * threshold against its best text pairing, and must carry real colour rather
 * than being a neutral, or the family reads as grey.
 */
function accentCandidates(familyRecords: GeneratedRecord[]) {
  return familyRecords
    .filter((record) => record.colorConfidence !== "provisional")
    .map((record) => {
      const onInk = contrastRatio(COSMOS_INK, record.backgroundColor);
      const onChalk = contrastRatio(COSMOS_CHALK, record.backgroundColor);
      return {
        record,
        accentTextColor: onInk >= onChalk ? COSMOS_INK : COSMOS_CHALK,
        accentContrast: Math.max(onInk, onChalk),
        chroma: chroma(record.backgroundColor),
      };
    })
    .filter(
      (candidate) =>
        candidate.accentContrast >= MIN_CONTRAST &&
        contrastRatio(candidate.record.backgroundColor, COSMOS_VOID) >=
          MIN_ACCENT_VS_PAGE,
    )
    .sort((left, right) => {
      const source =
        (SOURCE_RANK[left.record.colorSource] ?? 9) -
        (SOURCE_RANK[right.record.colorSource] ?? 9);
      if (source !== 0) return source;
      return right.chroma - left.chroma;
    });
}

/**
 * Builds the seven family accents as a designed *palette*, not seven
 * independent picks.
 *
 * Two failure modes drove this approach, both observed in the rendered page:
 * ranking purely by chroma made every family land on the same yellow-orange
 * (the highest-chroma hues in this dataset), and a purely greedy hue-separation
 * pass left whichever family picked last with a muted leftover.
 *
 * So each family is given a target hue that spreads the wheel, and then takes
 * the most chromatic *real* can it owns near that target. We are choosing which
 * verified product colour represents a family — never inventing a colour.
 */
function buildFamilyPalette() {
  const pools = FAMILY_DEFINITIONS.map((definition) => {
    const familyRecords = cosmosRecords.filter((record) =>
      definition.lines.includes(record.line),
    );
    const colourful = accentCandidates(familyRecords).filter(
      (candidate) => candidate.chroma >= 0.18,
    );
    return { definition, familyRecords, candidates: colourful };
  });

  const assigned = new Map<string, ReturnType<typeof accentCandidates>[number]>();
  const taken: string[] = [];

  // Two families must never ship the same or a near-identical accent, even if
  // both lines happen to contain the same colour near their target hue.
  const distinct = (hex: string) =>
    taken.every((used) => used !== hex && hueDistance(used, hex) >= 20);

  for (const pool of pools) {
    const target = pool.definition.targetHue;
    const near = (tolerance: number) =>
      pool.candidates
        .filter(
          (candidate) =>
            hueDistanceToAngle(candidate.record.backgroundColor, target) <= tolerance &&
            distinct(candidate.record.backgroundColor),
        )
        .sort((left, right) => right.chroma - left.chroma)[0];

    // Prefer a vivid colour close to the target hue; widen before giving up,
    // then fall back to the nearest distinct hue, then to any safe record.
    let choice = near(28) ?? near(52) ?? near(90);
    choice ??= [...pool.candidates]
      .filter((candidate) => distinct(candidate.record.backgroundColor))
      .sort(
        (left, right) =>
          hueDistanceToAngle(left.record.backgroundColor, target) -
          hueDistanceToAngle(right.record.backgroundColor, target),
      )[0];
    choice ??= accentCandidates(pool.familyRecords)[0];

    if (choice) {
      assigned.set(pool.definition.slug, choice);
      taken.push(choice.record.backgroundColor);
    }
  }

  return { pools, assigned };
}

const { pools: familyPools, assigned: familyAccents } = buildFamilyPalette();

function buildFamily(definition: FamilyDefinition): CosmosFamily {
  const pool = familyPools.find((item) => item.definition.slug === definition.slug)!;
  const chosen = familyAccents.get(definition.slug);

  // Absolute fallback: keep the family usable rather than crashing or shipping
  // unreadable text if the dataset ever loses all colour data for a line.
  const record = chosen?.record ?? pool.familyRecords[0];
  const accentTextColor = chosen?.accentTextColor ?? COSMOS_CHALK;
  const accentContrast =
    chosen?.accentContrast ?? contrastRatio(COSMOS_CHALK, record.backgroundColor);

  return {
    slug: definition.slug,
    name: definition.name,
    eyebrow: definition.eyebrow,
    lines: definition.lines,
    variantCount: pool.familyRecords.length,
    productGroupCount: new Set(pool.familyRecords.map((r) => r.baseProductSlug)).size,
    signatureVariantSlug: record.slug,
    signatureImage: record.image,
    signatureImageAlt: record.imageAlt,
    signatureColorName: record.colorName,
    accent: record.backgroundColor,
    accentTextColor,
    accentContrast: Number(accentContrast.toFixed(2)),
    catalogueHref: catalogueQueryHref(definition.query),
  };
}

export const cosmosFamilies: CosmosFamily[] =
  FAMILY_DEFINITIONS.map(buildFamily);

// --- verified public counts ------------------------------------------------

const familyLines = new Set(FAMILY_DEFINITIONS.flatMap((f) => f.lines));

/**
 * Every number rendered publicly is computed here, never hard-coded, so the
 * page cannot drift when the dataset is regenerated.
 */
export const cosmosCounts = {
  /** Records in the imported dataset, including third-party-branded rows. */
  importedRecords: records.length,
  /** Excluded because they carry a third-party brand name (Molotow). */
  excludedThirdPartyRecords: excludedRecords.length,
  /** The only figure safe to present publicly as Cosmos Lac. */
  variants: cosmosRecords.length,
  productGroups: new Set(cosmosRecords.map((r) => r.baseProductSlug)).size,
  lines: new Set(cosmosRecords.map((r) => r.line)).size,
  colourVariants: cosmosRecords.filter((r) => r.primaryCategory === "boja")
    .length,
  featuredFamilies: FAMILY_DEFINITIONS.length,
  /** Variants covered by the seven featured families. */
  featuredVariants: cosmosRecords.filter((r) => familyLines.has(r.line)).length,
  /** COSMOS variants outside the seven featured families. */
  otherVariants: cosmosRecords.filter((r) => !familyLines.has(r.line)).length,
  otherLines: new Set(
    cosmosRecords.filter((r) => !familyLines.has(r.line)).map((r) => r.line),
  ).size,
} as const;

// --- hero composition ------------------------------------------------------

export type CosmosHeroCan = {
  slug: string;
  image: string;
  alt: string;
  accent: string;
};

/**
 * Hero arc (specification §5). One dominant can plus supporting cans at
 * decreasing scale. Chosen for colour spread across families; every entry is a
 * real packshot from the dataset.
 *
 * Source packshots are 800x800 with a ~201x628 can alpha box, so the lead can
 * is capped in CSS at a size that keeps upscaling under ~1.4x.
 */
/**
 * Target hues for the arc, spread around the wheel so the opening frame reads
 * as "this brand is colour" rather than six cans of the same orange. Each pick
 * is still a real can — we choose which real can, never the colour itself.
 */
const HERO_PICKS: { line: string; targetHue: number }[] = [
  { line: "Fast Acrylic", targetHue: 8 }, // lead — red
  { line: "Flame Orange", targetHue: 210 }, // blue
  { line: "Chalk Effect", targetHue: 120 }, // green
  { line: "RAL", targetHue: 50 }, // yellow
  { line: "Easy Max", targetHue: 285 }, // violet
  { line: "Spray.Bike", targetHue: 170 }, // teal
];

export const cosmosHeroCans: CosmosHeroCan[] = HERO_PICKS.map((pick) => {
  const pool = cosmosRecords.filter(
    (record) =>
      record.line === pick.line &&
      record.colorConfidence !== "provisional" &&
      chroma(record.backgroundColor) > 0.2,
  );
  const target = `#${((): string => {
    // Build a reference hex for the target hue at full chroma.
    const c = 1;
    const x = 1 - Math.abs(((pick.targetHue / 60) % 2) - 1);
    const [r, g, b] =
      pick.targetHue < 60
        ? [c, x, 0]
        : pick.targetHue < 120
          ? [x, c, 0]
          : pick.targetHue < 180
            ? [0, c, x]
            : pick.targetHue < 240
              ? [0, x, c]
              : pick.targetHue < 300
                ? [x, 0, c]
                : [c, 0, x];
    return [r, g, b]
      .map((v) => Math.round(v * 255).toString(16).padStart(2, "0"))
      .join("");
  })()}`;

  const chosen =
    [...pool].sort(
      (left, right) =>
        hueDistance(target, left.backgroundColor) -
        hueDistance(target, right.backgroundColor),
    )[0] ?? cosmosRecords.find((record) => record.line === pick.line);

  return {
    slug: chosen!.slug,
    image: chosen!.image,
    alt: chosen!.imageAlt,
    accent: chosen!.backgroundColor,
  };
});

// --- application finder ----------------------------------------------------

export type CosmosApplication = {
  slug: string;
  label: string;
  summary: string;
  familySlugs: string[];
  productSlugs: string[];
  catalogueHref: string;
};

type ApplicationDefinition = {
  slug: string;
  label: string;
  summary: string;
  familySlugs: string[];
  lines: string[];
  query: string;
};

const APPLICATION_DEFINITIONS: ApplicationDefinition[] = [
  {
    slug: "auto",
    label: "AUTO",
    summary: "Popravke laka, felne i detalji na vozilu.",
    familySlugs: ["ral", "fast-acrylic", "master-mechanic"],
    lines: ["Automotive", "Fast Acrylic", "Wheel Rim", "RAL"],
    query: "automotive",
  },
  {
    slug: "metal",
    label: "METAL",
    summary: "Zaštita i bojenje metalnih površina, uključujući visoke temperature.",
    familySlugs: ["ral", "easy-max"],
    lines: ["RAL", "Easy Max", "High Heat 700°C", "Zinc", "Primers"],
    query: "ral",
  },
  {
    slug: "drvo",
    label: "DRVO",
    summary: "Nega, punjenje i mat obrada drvenih površina.",
    familySlugs: ["chalk-effect"],
    lines: ["W Wood Care", "Wood Putties", "Chalk Effect"],
    query: "wood",
  },
  {
    slug: "bicikl",
    label: "BICIKL",
    summary: "Namenski program za ramove i delove bicikla.",
    familySlugs: ["spray-bike"],
    lines: ["Spray.Bike"],
    query: "spray.bike",
  },
  {
    slug: "dekor",
    label: "DEKOR",
    summary: "Mat, metalik i efekt završnice za enterijer i dekoraciju.",
    familySlugs: ["chalk-effect"],
    lines: ["Chalk Effect", "Metallic", "Effect", "Home"],
    query: "chalk effect",
  },
  {
    slug: "art",
    label: "ART / GRAFITI",
    summary: "Visok pritisak, pokrivnost i paleta za umetnički rad.",
    familySlugs: ["flame"],
    lines: ["Flame Orange", "Flame Blue", "Flame Booster", "Fluorescent & Marking"],
    query: "flame",
  },
  {
    slug: "radionica",
    label: "RADIONICA",
    summary: "Održavanje, čišćenje i pomoćni materijal u servisu.",
    familySlugs: ["master-mechanic"],
    lines: ["Master Mechanic", "Cleaners", "Lubricants", "Putties", "Sealer"],
    query: "master mechanic",
  },
];

export const cosmosApplications: CosmosApplication[] =
  APPLICATION_DEFINITIONS.map((definition) => {
    const pool = cosmosRecords.filter((record) =>
      definition.lines.includes(record.line),
    );
    // Three representative products, each from a different base product group
    // where possible, preferring records with confident colour data.
    const seen = new Set<string>();
    const picks: GeneratedRecord[] = [];
    for (const record of [...pool].sort((left, right) => {
      const rank = (value: string) => (value === "verified" ? 0 : value === "derived" ? 1 : 2);
      return rank(left.colorConfidence) - rank(right.colorConfidence);
    })) {
      if (seen.has(record.baseProductSlug)) continue;
      seen.add(record.baseProductSlug);
      picks.push(record);
      if (picks.length === 3) break;
    }
    while (picks.length < 3 && pool.length > picks.length) {
      const next = pool[picks.length];
      if (next) picks.push(next);
      else break;
    }

    return {
      slug: definition.slug,
      label: definition.label,
      summary: definition.summary,
      familySlugs: definition.familySlugs,
      productSlugs: picks.map((record) => record.slug),
      catalogueHref: catalogueQueryHref(definition.query),
    };
  });

/**
 * A rank of real cans for the range scene, spread across as many different
 * lines as possible so the row genuinely represents the breadth it claims.
 */
export const cosmosRangeSilhouettes: CosmosHeroCan[] = (() => {
  const byLine = new Map<string, GeneratedRecord>();
  for (const record of cosmosRecords) {
    if (record.colorConfidence === "provisional") continue;
    const current = byLine.get(record.line);
    if (!current || chroma(record.backgroundColor) > chroma(current.backgroundColor)) {
      byLine.set(record.line, record);
    }
  }
  return [...byLine.values()]
    .sort((left, right) => hue(left.backgroundColor) - hue(right.backgroundColor))
    .slice(0, 14)
    .map((record) => ({
      slug: record.slug,
      image: record.image,
      alt: record.imageAlt,
      accent: record.backgroundColor,
    }));
})();

export function getCosmosProductBySlug(slug: string) {
  return cosmosRecords.find((record) => record.slug === slug);
}

/** Curated products for the commercial scene — one per featured family. */
export const cosmosCuratedSlugs: string[] = cosmosFamilies.map(
  (family) => family.signatureVariantSlug,
);
