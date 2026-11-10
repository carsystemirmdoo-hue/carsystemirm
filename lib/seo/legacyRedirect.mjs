/**
 * Adrese starog sajta (WooCommerce) → nove stranice (2026-11-10).
 *
 * Google još pamti `/proizvod/<naziv>` i `/proizvodi-kategorije/<brend>/...`. Umesto stranice
 * „nije pronađeno“, posetilac ide trajnim preusmerenjem (308) na:
 *   1. isti proizvod u novom katalogu, ali SAMO kada je poklapanje jednoznačno (šifra iz naziva,
 *      npr. `m1360`, nalazi tačno jedan zapis, ili se gotovo sve reči naziva poklapaju);
 *   2. inače na stranicu brenda prepoznatog iz početka naziva (`rm-…`, `baslac-…`, `cs-…`);
 *   3. inače na katalog.
 * Pogrešan proizvod je gori od stranice brenda, pa nesigurno poklapanje ide na brend.
 */

/** Početak starog naziva ili segment kategorije → stranica brenda (null = van programa → katalog). */
const BRAND_PREFIX = {
  rm: "rm",
  "r-m": "rm",
  baslac: "baslac",
  carsystem: "carsystem",
  cs: "carsystem",
  cf: "carfit",
  carfit: "carfit",
  "car-fit": "carfit",
  cos: "cosmos-lac",
  cosmos: "cosmos-lac",
  "cosmos-lac": "cosmos-lac",
  sata: "sata",
  befar: "befar",
  norbin: "norbin",
  yachtcare: "yachtcare",
  "3m": null,
};

/** Reči koje ništa ne govore o proizvodu (pakovanje, boje, opšti nazivi). */
const GENERIC = new Set([
  "l", "ml", "kg", "g", "kom", "set", "za", "i", "sa", "od", "u", "na",
  "1l", "05l", "0", "5l", "4l", "2kg", "400ml", "250ml", "125l", "2", "3", "1",
  "siva", "sivi", "crna", "crni", "bela", "beli", "crvena", "plava", "zelena", "zuta", "oranz",
  "sprej", "spray", "basecoat", "pasta",
]);

const fold = (/** @type {string} */ s) =>
  s
    .toLowerCase()
    .replace(/đ/g, "dj")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/** Reči zapisa: naziv, šifra, termini, id i href; „35-M1360“ daje i „35m1360“. */
function recordTokens(/** @type {Record<string, unknown>} */ r) {
  const text = [r.name, r.productCode, r.id, r.href, ...(Array.isArray(r.terms) ? r.terms : [])].filter(Boolean).join(" ");
  const words = fold(String(text)).split(/[^a-z0-9]+/).filter(Boolean);
  const set = new Set(words);
  for (let i = 1; i < words.length; i += 1) set.add(words[i - 1] + words[i]);
  return set;
}

/** Mera ili pakovanje (85l, 400ml, 2kg, 40x35cm) — nije šifra proizvoda. */
const isMeasure = (/** @type {string} */ t) => /^\d+(l|ml|kg|g|k|m|cm|mm|x\d+(cm|mm)?)$/.test(t);

/**
 * Šifra = reč sa slovom i cifrom (m1360, n342). Sam broj (125, 881) NIJE šifra — često je mera
 * ili deo pakovanja; broj važi samo spojen sa prethodnom reči (bc881, 35m1360).
 */
const isCode = (/** @type {string} */ t) => !GENERIC.has(t) && !isMeasure(t) && /[a-z]/.test(t) && /\d/.test(t) && t.length >= 3;
/** Spoj dve reči koji liči na šifru: slova+broj (bc881) ili broj+slovo+broj (35m1360). */
const isPairCode = (/** @type {string} */ t) => /^([a-z]{1,3}\d{2,}|\d{2}[a-z]\d{3,})$/.test(t);

/** @param {string} slug */
export function brandOfSlug(slug) {
  const s = fold(slug);
  for (const key of Object.keys(BRAND_PREFIX).sort((a, b) => b.length - a.length)) {
    if (s === key || s.startsWith(`${key}-`)) return { known: true, brand: BRAND_PREFIX[/** @type {keyof typeof BRAND_PREFIX} */ (key)] };
  }
  return { known: false, brand: null };
}

const brandPage = (/** @type {string | null} */ brand) => (brand ? `/brendovi/${brand}` : "/katalog");

/**
 * @param {string} oldSlug  deo adrese posle `/proizvod/` (bez kose crte)
 * @param {{ href: string, kind: string, brandSlug?: string, familySlug?: string, name: string }[]} records  indeks pretrage kataloga
 * @returns {{ destination: string, reason: "proizvod" | "brend" | "katalog" }}
 */
export function legacyProductTarget(oldSlug, records) {
  const slug = fold(decodeURIComponent(oldSlug)).replace(/\/+$/, "");
  const { known, brand } = brandOfSlug(slug);
  const words = slug.split(/[^a-z0-9]+/).filter(Boolean);
  const pairs = [];
  for (let i = 1; i < words.length; i += 1) if (!isMeasure(words[i]) && !isMeasure(words[i - 1])) pairs.push(words[i - 1] + words[i]);
  const codes = [...new Set([...words.filter(isCode), ...pairs.filter(isPairCode)])];
  const indexed = records.map((r) => ({ r, tokens: recordTokens(r) }));
  const inBrand = (/** @type {{ r: { brandSlug?: string } }[]} */ list) => (brand ? list.filter((x) => x.r.brandSlug === brand) : list);

  // 1a. Šifra: svi zapisi koji sadrže SVE šifre iz starog naziva.
  if (codes.length) {
    let hits = indexed.filter((x) => codes.every((c) => x.tokens.has(c)));
    if (hits.length > 1) hits = inBrand(hits);
    const hrefs = [...new Set(hits.map((x) => x.r.href))];
    if (hrefs.length === 1) return { destination: hrefs[0], reason: "proizvod" };
  }

  // 1b. Bez šifre: gotovo sve značajne reči naziva u jednom zapisu istog brenda.
  const meaningful = words.filter((w) => !GENERIC.has(w) && !isMeasure(w) && w.length >= 2 && !/^\d+$/.test(w) && !(known && BRAND_PREFIX[/** @type {keyof typeof BRAND_PREFIX} */ (w)] !== undefined));
  if (meaningful.length >= 2) {
    const scored = inBrand(indexed)
      .map((x) => ({ x, n: meaningful.filter((w) => x.tokens.has(w)).length }))
      .filter((s) => s.n / meaningful.length >= 0.8)
      .sort((a, b) => b.n - a.n);
    if (scored.length && (scored.length === 1 || scored[0].n > scored[1].n)) return { destination: scored[0].x.r.href, reason: "proizvod" };
  }

  // 2–3. Brend ili katalog.
  return known ? { destination: brandPage(brand), reason: brand ? "brend" : "katalog" } : { destination: "/katalog", reason: "katalog" };
}

/**
 * `/proizvodi-kategorije/<brend>/<...>` → stranica brenda; nepoznat brend → katalog.
 * @param {string[]} segments
 */
export function legacyCategoryTarget(segments) {
  const first = fold(decodeURIComponent(segments[0] ?? ""));
  if (first in BRAND_PREFIX) return brandPage(BRAND_PREFIX[/** @type {keyof typeof BRAND_PREFIX} */ (first)]);
  return "/katalog";
}
