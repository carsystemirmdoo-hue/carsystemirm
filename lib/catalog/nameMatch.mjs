/**
 * Predlog veze BizniSoft artikal → kataloški proizvod PO NAZIVU (2026-11-11, zahtev vlasnika).
 *
 * Samo PREDLOG: potvrda ostaje čovekova (status `suggested` nije poručiv). Ocena:
 *   - isti brend (prva reč naziva: CS, RM, BASLAC, COS…), inače kandidat ne postoji;
 *   - šifra iz naziva ili BizniSoft šifra jednaka šifri varijante → najjači dokaz;
 *   - reči naziva sa težinom retkosti (reč koja se javlja u malo proizvoda vredi više);
 *   - zapremina/masa/granulacija u nazivu artikla mora da se slaže sa varijantom kada je varijanta nosi.
 */

const STRIP = /[̀-ͯ]/g;
export const norm = (/** @type {string} */ s) =>
  String(s ?? "")
    .toUpperCase()
    .replace(/Đ/g, "DJ")
    .normalize("NFD")
    .replace(STRIP, "")
    .replace(/(\d),(\d)/g, "$1.$2");

/** Brend iz prve reči naziva (isti dogovor kao Nabavka). */
const BRANDS = [
  [/^(CS|CARSYSTEM|RUPES)\b/, "carsystem"],
  [/^(COS\.?|COSMOS)/, "cosmos-lac"],
  [/^(RM|R-M)\b/, "r-m"],
  [/^BASLAC\b/, "baslac"],
  [/^(BEFAR|LEO|TURQUAZ|TURKUAZ)\b/, "befar"],
  [/^(CF|C\.A\.R\.FIT|CARFIT)\b/, "carfit"],
  [/^NORBIN\b/, "norbin"],
  [/^SATA\b/, "sata"],
];
export function brandOfName(/** @type {string} */ name) {
  const n = norm(name).trim();
  for (const [re, b] of BRANDS) if (/** @type {RegExp} */ (re).test(n)) return /** @type {string} */ (b);
  return null;
}

/** Katalog: brendSlug iz kataloga → isti ključ kao `brandOfName`. */
export function brandKey(/** @type {string} */ brandSlug) {
  const s = String(brandSlug ?? "").toLowerCase();
  if (s.includes("cosmos")) return "cosmos-lac";
  if (s === "rm" || s.includes("r-m") || s === "rmpaint") return "r-m";
  if (s.includes("carfit") || s.includes("car-fit") || s.includes("c-a-r-fit")) return "carfit";
  if (s.includes("rupes")) return "carsystem";
  return s;
}

const STOP = new Set(["CS", "RM", "R", "M", "COS", "BASLAC", "BEFAR", "LEO", "CF", "NORBIN", "SATA", "I", "SA", "ZA", "OD", "DO", "NA", "U", "X", "KOM", "SET", "THE", "AND", "OF", "WITH", "BEZ"]);

/** Mere iz naziva: zapremina (L), masa (KG), granulacija (P…), mm. */
export function measures(/** @type {string} */ text) {
  const t = norm(text);
  const out = new Set();
  for (const m of t.matchAll(/(\d+(?:\.\d+)?)\s*(ML|L|LIT|LT|KG|G|GR)\b/g)) {
    const v = Number(m[1]);
    const u = m[2];
    if (u === "ML") out.add(`L${+(v / 1000).toFixed(4)}`);
    else if (u === "G" || u === "GR") out.add(`KG${+(v / 1000).toFixed(4)}`);
    else if (u === "KG") out.add(`KG${v}`);
    else out.add(`L${v}`);
  }
  for (const m of t.matchAll(/\bP\s?(\d{2,4})\b/g)) out.add(`P${m[1]}`);
  for (const m of t.matchAll(/\b(\d{2,3})\s*MM\b/g)) out.add(`MM${m[1]}`);
  return out;
}

/** Šifre u tekstu: kombinacije slova i cifara (N376, 35-M214, 2K-500…) i duži brojevi. */
export function codesIn(/** @type {string} */ text) {
  const t = norm(text);
  const out = new Set();
  for (const m of t.matchAll(/\b([A-Z]{0,4}[-.]?\d{2,}[A-Z0-9.-]*)\b/g)) {
    const c = m[1].replace(/[.-]/g, "");
    if (c.length >= 3 && !isMeasureToken(c)) out.add(c);
  }
  return out;
}

/** Granulacija, mera i dimenzija nisu šifra proizvoda (P240 nosi svaki brusni disk). */
const isMeasureToken = (/** @type {string} */ c) =>
  /^P\d{2,4}$/.test(c) || /^\d+(\.\d+)?(ML|L|LIT|LT|KG|G|GR|MM|CM|M|MY|MIC)?$/.test(c) || /^\d+X\d+/.test(c) || /^\d+\/\d+$/.test(c);

/** Ceo naziv bez razmaka, tačaka i crtica — za šifre napisane sa razmakom („BC 800“, „CB 58M“). */
export const compact = (/** @type {string} */ text) => norm(text).replace(/([A-Z])[\s.\-]+(?=\d)/g, "$1");

/**
 * Šifra mete (sa bar jednim slovom i cifrom, npr. BC800, CB58M, N376) javlja se u nazivu artikla,
 * a odmah iza nje nije cifra (BC 100 ≠ BC 1000).
 */
export function codeInName(/** @type {string} */ code, /** @type {string} */ nameCompact) {
  if (code.length < 3 || !/[A-Z]/.test(code) || !/\d/.test(code) || isMeasureToken(code)) return false;
  let i = nameCompact.indexOf(code);
  while (i >= 0) {
    const next = nameCompact[i + code.length] ?? "";
    const prev = nameCompact[i - 1] ?? " ";
    // Šifra koja se završava slovom (CB 58M) sme da bude zalepljena za zapreminu (58M0,125L).
    if (!/[A-Z0-9]/.test(prev) && (!/\d/.test(next) || /[A-Z]$/.test(code))) return true;
    i = nameCompact.indexOf(code, i + 1);
  }
  return false;
}

export const words = (/** @type {string} */ text) =>
  norm(text)
    .split(/[^A-Z0-9.]+/)
    .map((w) => w.replace(/^\.+|\.+$/g, ""))
    .filter((w) => w.length >= 2 && !STOP.has(w) && !/^\d+(\.\d+)?$/.test(w));

/**
 * @typedef {{ key: string, slug: string, variant: string | null, brand: string, text: string, codes: string[], label: string }} Target
 * @param {Target[]} targets
 */
export function buildIndex(targets) {
  const df = new Map();
  const prepared = targets.map((t) => {
    const ws = new Set(words(t.text));
    for (const w of ws) df.set(w, (df.get(w) ?? 0) + 1);
    return { ...t, ws, ms: measures(t.text), cs: new Set([...t.codes.map((c) => norm(c).replace(/[.\s-]/g, "")), ...codesIn(t.text)]) };
  });
  const n = prepared.length || 1;
  const idf = (/** @type {string} */ w) => Math.log(1 + n / (df.get(w) ?? 0.5));
  return { prepared, idf };
}

/**
 * Najbolji kandidati za jedan artikal.
 * @param {{ code: string, name: string }} article
 * @param {ReturnType<typeof buildIndex>} index
 */
export function rankTargets(article, index) {
  const brand = brandOfName(article.name);
  if (!brand) return { brand, ranked: [] };
  const aw = new Set(words(article.name));
  const am = measures(article.name);
  const ac = codesIn(article.name);
  const an = compact(article.name);
  // Cosmos: „N462“ u nazivu artikla = broj boje 462 u katalogu.
  const cosmosNo = brand === "cosmos-lac" ? [...norm(article.name).matchAll(/\bN\s?(\d{3,4})\b/g)].map((m) => m[1]) : [];
  const code = norm(article.code).replace(/^0+/, "");
  const ranked = [];
  for (const t of index.prepared) {
    if (t.brand !== brand) continue;
    let common = 0;
    let total = 0;
    for (const w of aw) {
      const s = index.idf(w);
      total += s;
      if (t.ws.has(w)) common += s;
    }
    let score = total ? common / total : 0;
    const codeHit =
      [...t.cs].some((c) => c.replace(/^0+/, "") === code || codeInName(c, an)) ||
      [...ac].some((c) => t.cs.has(c)) ||
      (cosmosNo.length > 0 && cosmosNo.some((n) => t.cs.has(n) || t.ws.has(n) || new RegExp(`(^|[^0-9])${n}([^0-9]|$)`).test(t.key)));
    if (codeHit) score += 1;
    // Mera: varijanta koja nosi meru mora da se slaže; proizvod bez mere je neutralan.
    const tm = [...t.ms];
    if (am.size && tm.length) {
      const ok = [...am].some((m) => t.ms.has(m));
      score += ok ? 0.35 : -0.6;
    }
    if (score > 0.2) ranked.push({ key: t.key, slug: t.slug, variant: t.variant, label: t.label, score: Math.round(score * 1000) / 1000, codeHit });
  }
  ranked.sort((a, b) => b.score - a.score);
  return { brand, ranked: ranked.slice(0, 3) };
}

/** Pouzdanost predloga iz ocene i razmaka do drugog kandidata. */
export function confidenceOf(/** @type {{ score: number, codeHit: boolean }[]} */ ranked) {
  if (!ranked.length) return "nema";
  const [a, b] = ranked;
  const gap = a.score - (b?.score ?? 0);
  if ((a.codeHit && gap >= 0.3) || (a.score >= 0.85 && gap >= 0.25)) return "sigurno";
  if (a.score >= 0.6 && gap >= 0.1) return "verovatno";
  return "nejasno";
}
