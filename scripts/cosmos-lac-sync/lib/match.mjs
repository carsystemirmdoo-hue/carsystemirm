/**
 * Pomirenje lokalnog Cosmos Lac kataloga sa zvaničnim izvorom — DETERMINISTIČKI.
 *
 * Ključevi, po snazi dokaza:
 *   1. naziv fajla u zvaničnom Brand Kit-u = zvanična adresa (`ral-9003-signal-white-v2.png` →
 *      `/ral-9003-signal-white/`). To je proizvođačev sopstveni ključ i jači je od naslova stranice:
 *      kada naslov greši (`SOURCE_TITLE_INCONSISTENCY`), adresa i Brand Kit i dalje pokazuju isto.
 *   2. šifra (ili RAL) u adresi, unutar linije koju naša linija imenuje; istu šifru u dva završna
 *      sloja razdvaja zvanična reč za završni sloj (gloss / matt / semigloss).
 *   3. naziv nijanse u adresi — samo kada zapis NEMA šifru.
 *   4. ista šifra u istoj liniji na DRUGOM jeziku zvaničnog sajta (`CURRENT_REGION_SPECIFIC`).
 * Sličnost naziva se ne koristi.
 */

/** Naša linija → segment zvanične adrese. Molotow nije Cosmos Lac linija na zvaničnom sajtu. */
export const LINE_TO_FAMILY = {
  Automotive: ["automotive"], "Chalk Effect": ["chalk-effect"], Cleaners: ["cleaners", "automotive"], "Easy Max": ["easy-max"], Effect: ["effect"],
  "Fast Acrylic": ["fast-acrylic"], "Flame Blue": ["flame-blue"], "Flame Booster": ["flame"], "Flame Orange": ["flame-orange"],
  "Fluorescent & Marking": ["fluo-marking"], "High Heat 700°C": ["high-heat"], Home: ["home"], Lubricants: ["lubricants"],
  "Master Mechanic": ["master-mechanic"], Metallic: ["metallic"], "Molotow Burner": [], "Molotow Premium": [], Primers: ["primer"],
  Putties: ["putties"], RAL: ["ral"], Sealer: ["sealer"], "Spray.Bike": ["spray-bike"], Varnishes: ["varnish"], "W Wood Care": ["wood-varnish-w"],
  "Wheel Rim": ["wheel-rim"], "Wood Putties": ["wood-putties"], Zinc: ["zinc"],
};

/** Naša oznaka završnog sloja → reč u zvaničnoj adresi. */
const FINISH_TOKENS = { mat: ["matt", "matte"], sjaj: ["gloss"], polusjaj: ["semigloss", "satin"], providna: ["transparent"] };

export const slugify = (text) => String(text ?? "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/&/g, " ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const has = (slug, part) => Boolean(part) && `-${slug}-`.includes(`-${part}-`);

export function codeKeys(record) {
  const keys = new Set();
  if (record.ralCode) keys.add(`ral-${record.ralCode}`);
  if (record.cosmosCode) {
    const code = slugify(record.cosmosCode);
    keys.add(code);
    // „CL-N01” → „n01”, „CL-800” → „800”: prefiks „CL” je naša oznaka brenda, ne deo zvanične šifre.
    if (code.startsWith("cl-")) keys.add(code.slice(3));
  }
  // Šifra koju lokalni zapis nosi samo u nazivu nijanse („Brass R310”).
  for (const found of String(record.colorName ?? "").matchAll(/\b([A-Z]{1,2}-?\d{2,4}|\d{3,4})\b/g)) keys.add(slugify(found[1]));
  return [...keys];
}
const shadeKey = (record) => slugify(String(record.colorName ?? "").replace(/\b([A-Z]{1,2}-?\d{2,4}|\d{3,4})\b/g, " "));
/** Naziv fajla iz Brand Kit-a, bez ekstenzije i bez oznake revizije (`-v2`). */
export const assetKeyOf = (record) => slugify(String(record.sourceOriginalPath ?? "").split("/").pop().replace(/\.[a-z]+$/i, "")).replace(/-v\d+$/, "");

export function createMatcher(source, sitemap) {
  const bySlug = new Map(source.products.map((product) => [product.slug, product]));

  /*
   * Drugi jezici istog sajta. Segment linije je preveden („automobil”, „spray-bike-serie”), pa se
   * linija na drugom jeziku prepoznaje po preklapanju šifara — priznaje se tek kada se poklapa većina.
   */
  const codeSegments = (slug) => new Set(slug.split("-").filter((part) => /\d/.test(part)));
  const localeFamily = {};
  for (const [locale, paths] of Object.entries(sitemap?.localePaths ?? {})) {
    const bySegment = new Map();
    for (const entry of paths) {
      const [category, segment, slug] = entry.split("/");
      if (!bySegment.has(segment)) bySegment.set(segment, { codes: new Set(), entries: [] });
      bySegment.get(segment).entries.push({ slug, path: `${locale}/products/${category}/${segment}/${slug}/` });
      for (const code of codeSegments(slug)) bySegment.get(segment).codes.add(code);
    }
    localeFamily[locale] = {};
    for (const family of new Set(source.products.map((product) => product.family))) {
      const codes = new Set(source.products.filter((product) => product.family === family).flatMap((product) => [...codeSegments(product.slug)]));
      let best = null;
      for (const [segment, info] of bySegment) {
        const overlap = [...codes].filter((code) => info.codes.has(code)).length;
        if (overlap && (!best || overlap > best.overlap)) best = { segment, overlap, entries: info.entries };
      }
      if (best && best.overlap >= Math.max(2, Math.ceil(codes.size * 0.6))) localeFamily[locale][family] = best.entries;
    }
  }
  function otherLocales(record) {
    const codes = codeKeys(record).map((code) => code.replace(/^ral-/, ""));
    if (!codes.length) return [];
    const hits = [];
    for (const locale of Object.keys(localeFamily).sort()) {
      for (const family of LINE_TO_FAMILY[record.line] ?? []) {
        const entry = (localeFamily[locale][family] ?? []).find((candidate) => codes.some((code) => has(candidate.slug, code)));
        if (entry) { hits.push({ locale, url: `https://cosmoslac.com/${entry.path}` }); break; }
      }
    }
    return hits;
  }

  return function match(record) {
    const assetKey = assetKeyOf(record);
    if (assetKey && bySlug.has(assetKey)) return { classification: "EXACT_MATCH", by: "official-asset-filename", official: bySlug.get(assetKey) };

    const families = LINE_TO_FAMILY[record.line] ?? [];
    if (!families.length) return { classification: "LEGACY_LOCAL_ONLY", reason: "LINE_NOT_ON_MANUFACTURER_SITE" };
    const codes = codeKeys(record);
    const shade = shadeKey(record);
    const pick = (pool) => {
      const byCode = codes.length ? pool.filter((product) => codes.some((code) => has(product.slug, code))) : [];
      if (byCode.length === 1) return { hit: byCode[0], by: "code" };
      if (byCode.length > 1) {
        const narrowed = shade ? byCode.filter((product) => has(product.slug, shade)) : [];
        if (narrowed.length === 1) return { hit: narrowed[0], by: "code+shade" };
        const finishTokens = FINISH_TOKENS[record.finish] ?? [];
        const byFinish = (narrowed.length ? narrowed : byCode).filter((product) => finishTokens.some((token) => has(product.slug, token)));
        if (byFinish.length === 1) return { hit: byFinish[0], by: "code+finish" };
        // „Container” je zaseban zvanični proizvod (limenka, ne sprej); sprej je onaj bez te oznake.
        const sprays = byCode.filter((product) => !product.isContainer);
        if (sprays.length === 1) return { hit: sprays[0], by: "code(spray)" };
        return { ambiguous: byCode.map((product) => product.slug) };
      }
      // Naziv nijanse presuđuje samo kada zapis NEMA šifru.
      if (shade && !codes.length) {
        const byShade = pool.filter((product) => has(product.slug, shade));
        if (byShade.length === 1) return { hit: byShade[0], by: "shade" };
        if (byShade.length > 1) return { ambiguous: byShade.map((product) => product.slug) };
      }
      return {};
    };

    const own = pick(source.products.filter((product) => families.includes(product.family)));
    if (own.hit) return { classification: own.by.startsWith("code") ? "EXACT_MATCH" : "HIGH_CONFIDENCE", by: own.by, official: own.hit };
    if (own.ambiguous) return { classification: "UNKNOWN", reason: "AMBIGUOUS_IN_LINE", candidates: own.ambiguous };
    const locales = otherLocales(record);
    if (locales.length) return { classification: "HIGH_CONFIDENCE", by: "code (drugi jezici zvaničnog sajta)", reason: "CURRENT_REGION_SPECIFIC_NOT_ON_ENGLISH_SITE", locales };
    return { classification: "LEGACY_LOCAL_ONLY", reason: "NO_CURRENT_OFFICIAL_PAGE" };
  };
}
