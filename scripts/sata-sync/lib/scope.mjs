/**
 * OPSEG — jedino mesto koje odlučuje šta ulazi u „SATA EMEA REFINISH FAMILY SCOPE”.
 *
 *   porodica u opsegu  = aktuelna u Evropi + `taxonomy-map.json` je ne isključuje + nije industrijski
 *                        program, reklamni artikal ni porodica rezervnih delova
 *   artikal u opsegu   = evropski član porodice u opsegu (isti Shopware parent)
 *
 * Sve ostalo što je aktuelno kod proizvođača ostaje evidentirano (`CURRENT_OUT_OF_SCOPE…`) i
 * NIJE „discontinued”, „missing” ni „historical”.
 *
 * Samostalni artikli (bez parenta) dobijaju međusobno isključivu grupu. Uloga dolazi iz ZVANIČNE
 * kategorije artikla i iz onoga što zvanični naziv doslovno kaže; pravila se čitaju REDOM.
 */

const OUT_SCOPES = new Set(["SPARE_PART", "MERCHANDISE", "COMPLETE_DEVICE_INDUSTRIAL"]);

export function mapOf(taxonomy, family) {
  return {
    ...(taxonomy.categories[family.primaryCategory] ?? { scope: false, reason: "porodica nije listirana ni u jednoj zvaničnoj kategoriji" }),
    ...(taxonomy.families[family.id] ?? {}),
  };
}

export function splitFamilies(source, taxonomy) {
  const current = source.families.filter((family) => family.variantCountEurope > 0);
  const inScope = current.filter((family) => {
    const map = mapOf(taxonomy, family);
    if (OUT_SCOPES.has(family.scope)) return false;
    return family.scope === "COMPLETE_DEVICE" ? map.scope !== false : map.scope === true;
  });
  const outOfScope = current.filter((family) => !inScope.includes(family));
  return { current, inScope, outOfScope };
}

export const europeVariants = (family) => family.variants.filter((variant) => variant.region === "CURRENT");

const INDUSTRIAL = /\b(ROB|LAB|LP ?90|LP-S|automatic|Robotic|FIRA|SATAjet (?:1000|3000) A|SATAminijet (?:1000|3000) A|SATAjet A|SATAjet 1800 M)\b/;
const CONSUMABLE = /\b(cartridge|filter mat|activated charcoal|prefilter|pre-filter|visor foil|sieve|strainer\b(?! holder)|cleaner \(packing|wet & dry cleaner|spray pattern blocks?|grease|cleaning brush|cleaning needles|air cap protector|lids?\b|liner)\b/i;

export const STANDALONE_BUCKETS = [
  "SPARE_PART",
  "ACCESSORY_TIED_TO_APPROVED_FAMILY",
  "CONSUMABLE_TIED_TO_APPROVED_FAMILY",
  "INDUSTRIAL_ROBOTIC_LAB",
  "MERCHANDISING",
  "REGION_ONLY",
  "DUPLICATE_ALIAS",
  "UNIDENTIFIED_NO_OFFICIAL_NAME",
  "STANDALONE_CUSTOMER_FACING_PHASE_2",
];

/** Grupe koje su aktuelni SATA proizvodi, samo nisu deo prvog, porodičnog synca. */
export const PHASE_2_BUCKETS = new Set(["STANDALONE_CUSTOMER_FACING_PHASE_2", "ACCESSORY_TIED_TO_APPROVED_FAMILY"]);

export function partitionStandalone(source, inScope) {
  const tokens = inScope
    .flatMap((family) => {
      const name = family.officialName;
      const bare = name.replace(/^SATA\s+/i, "").replace(/\s+-\s+the\s+\w+$/i, "");
      // „SATA filter 500 series” se u nazivima pribora piše i „SATA filter series 500”.
      const series = /filter (?:series )?(\d{3})/i.exec(name)?.[1];
      return [name, bare, ...(series ? [`filter series ${series}`, `filter ${series}`] : [])].map((token) => ({ family: family.id, token: token.toLowerCase() }));
    })
    .filter((entry) => entry.token.length >= 3)
    .sort((a, b) => b.token.length - a.token.length || a.family.localeCompare(b.family));
  const tiedFamily = (name) => {
    const text = ` ${String(name).toLowerCase()} `;
    return tokens.find((entry) => new RegExp(`[^a-z0-9]${entry.token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^a-z0-9]`).test(text))?.family ?? null;
  };

  const classify = (article) => {
    const category = (article.officialCategory ?? []).join(" › ");
    const name = article.name ?? "";
    if (article.region !== "CURRENT") return ["REGION_ONLY", null];
    if (!name) return ["UNIDENTIFIED_NO_OFFICIAL_NAME", null];
    if (/Merchandising/i.test(category)) return ["MERCHANDISING", null];
    if (INDUSTRIAL.test(name)) return ["INDUSTRIAL_ROBOTIC_LAB", null];
    if (category === "Spare parts") return ["SPARE_PART", null];
    const family = tiedFamily(name);
    if (family && CONSUMABLE.test(name)) return ["CONSUMABLE_TIED_TO_APPROVED_FAMILY", family];
    if (family) return ["ACCESSORY_TIED_TO_APPROVED_FAMILY", family];
    return ["STANDALONE_CUSTOMER_FACING_PHASE_2", null];
  };

  const rows = source.standalone.map((article) => {
    const [bucket, family] = classify(article);
    return {
      articleNumber: article.articleNumber,
      name: article.name,
      officialCategory: article.officialCategory ?? [],
      bucket,
      status: PHASE_2_BUCKETS.has(bucket) ? "CURRENT_OUT_OF_SCOPE_PHASE_2" : bucket === "REGION_ONLY" ? "CURRENT_REGION_SPECIFIC" : bucket === "UNIDENTIFIED_NO_OFFICIAL_NAME" ? "UNCERTAIN" : "CURRENT_OUT_OF_SCOPE",
      tiedFamily: family,
    };
  });
  const partition = Object.fromEntries(STANDALONE_BUCKETS.map((bucket) => [bucket, rows.filter((row) => row.bucket === bucket).length]));
  return { rows, partition, consumableLikeWithinSpareParts: rows.filter((row) => row.bucket === "SPARE_PART" && CONSUMABLE.test(row.name ?? "")).length };
}
