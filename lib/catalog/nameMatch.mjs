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
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/×/g, "X");

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
  // „150MMP150“: granulacija zalepljena za prečnik.
  // R-M šifre nijansi („CB 38L“, „BC 1815“) nisu zapremina.
  const t = norm(text)
    .replace(/(\d)\s*MM\s*P(\d)/g, "$1MM P$2")
    .replace(/\b(CB|BC|SC|HB|MB)\s?\d+[A-Z]?\b/g, " ");
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
  // Dimenzija sunđera/bloka („150X50“, „180 × 35 mm“): manji×veći, da 150×50 i 50×150 budu isto.
  for (const m of t.matchAll(/\b(\d{2,3})\s*X\s*(\d{2,3})\b/g)) {
    const [a, b] = [Number(m[1]), Number(m[2])].sort((x, y) => x - y);
    out.add(`D${a}X${b}`);
  }
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

/**
 * Brojčana šifra sa crticom („21-10“) u nazivu artikla, i kada je zalepljena za reč („21-10PLASTIC“) ili
 * za zapreminu („40-4401L“ = 40-440 + 1L). Ispred ne sme biti slovo ni cifra; iza ne sme biti cifra,
 * osim kada ostatak čita kao zapremina/masa.
 */
export function dashedCodeInName(/** @type {string} */ digits, /** @type {string} */ name) {
  const n = norm(name).replace(/(\d)[-.](?=\d)/g, "$1");
  let i = n.indexOf(digits);
  while (i >= 0) {
    const prev = n[i - 1] ?? " ";
    const rest = n.slice(i + digits.length);
    if (!/[A-Z0-9]/.test(prev) && (!/^\d/.test(rest) || /^\d+(\.\d+)?\s?(L|ML|LIT|LT|KG|G|GR)\b/.test(rest))) return true;
    i = n.indexOf(digits, i + 1);
  }
  return false;
}

/**
 * Boje iz naziva (srpski, engleski, nemački) svedene na jedan ključ. Nazivi linija koji nose boju
 * („Flame Orange“, „Flame Blue“ kod Cosmosa) ne računaju se kao boja proizvoda.
 */
const COLOUR_WORDS = [
  [/^(BEL[IAO]|BELU|WHITE|WEISS|WEIß|BIANCO)$/, "WHITE"],
  [/^(CRN[IAO]|CRNU|BLACK|SCHWARZ|NERO)$/, "BLACK"],
  [/^(PLAV[IAO]|PLAVU|BLUE|BLAU)$/, "BLUE"],
  [/^(ORANZ|ORANŽ|NARANDZAST[IAO]|NARANDZ|NARAN|ORANGE)$/, "ORANGE"],
  [/^(ZUT[IAO]|ZUTU|YELLOW|YELOW|GELB)$/, "YELLOW"],
  [/^(CRVEN[IAO]|CRVENU|RED|ROT)$/, "RED"],
  [/^(SIV[IAO]|SIVU|GREY|GRAY|GRAU)$/, "GREY"],
  [/^(ZELEN[IAO]|ZELENU|GREEN|GRUN)$/, "GREEN"],
  [/^(VISNJA|BORDO|BURGUNDY|MAROON)$/, "BORDO"],
  [/^(BRAON|BROWN|BRAUN)$/, "BROWN"],
  [/^(LJUBICAST[IAO]|VIOLET|VIOLA|PURPLE|LILA)$/, "VIOLET"],
  [/^(PROVIDN[IAO]|TRANSPARENT|TRANSP|BEZBOJN[IAO])$/, "CLEAR"],
  [/^(SREBRN[IAO]|SILVER)$/, "SILVER"],
  [/^(ZLATN[IAO]|GOLD)$/, "GOLD"],
];
export function colours(/** @type {string} */ text) {
  const t = norm(text).replace(/\bFLAME\s+(ORANGE|BLUE)\b/g, "FLAME");
  const out = new Set();
  for (const w of t.split(/[^A-Z]+/)) {
    for (const [re, c] of COLOUR_WORDS) if (/** @type {RegExp} */ (re).test(w)) out.add(/** @type {string} */ (c));
  }
  return out;
}

/** Stepen sjaja: sjaj / polusjaj / mat (Cosmos Classic ima isti RAL u sva tri). */
export function finishes(/** @type {string} */ text) {
  const out = new Set();
  for (const w of norm(text).split(/[^A-Z]+/)) {
    if (/^(POLUSJAJ|POLUMAT|SEMIGLOSS|SATEN|SATIN)$/.test(w)) out.add("SEMI");
    else if (/^(SJAJ|SJAJNA|SJAJNI|GLOSS|GLOSSY|HOCHGLANZ)$/.test(w)) out.add("GLOSS");
    else if (/^(MAT|MATT|MATNA|MATNI|MATTE)$/.test(w)) out.add("MATT");
  }
  return out;
}

/** RAL brojevi („RAL9005“, „RAL 9005“). */
export function rals(/** @type {string} */ text) {
  return new Set([...norm(text).matchAll(/\bRAL\s?(\d{4})\b/g)].map((m) => m[1]));
}

/** Brojčane šifre sa crticom (Baslac „60-10“, „50-415“): samo cifre, bez crtice. */
export function dashedCodes(/** @type {string} */ text) {
  return new Set([...norm(text).matchAll(/(?<![A-Z0-9])(\d{2})-(\d{2,3})(?!\d{2})/g)].map((m) => `${m[1]}${m[2]}`));
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
    return {
      ...t,
      ws,
      ms: measures(t.text),
      col: colours(t.text),
      ral: rals(t.text),
      fin: finishes(t.text),
      cs: new Set([...t.codes.map((c) => norm(c).replace(/[.\s-]/g, "")), ...codesIn(t.text)]),
      // Brojčane šifre sa crticom ili tačkom („21-10“, „40-440“, „156.901“): dovoljno su posebne da važe i bez slova.
      dashed: [
        ...new Set([
          ...t.codes.map((c) => norm(c).trim()).filter((c) => /^\d{2,3}[-.]\d{2,4}$/.test(c)).map((c) => c.replace(/[-.]/g, "")),
          // i iz naziva/šifre kartice („BASLAC-60-20-5L“ → 6020)
          ...dashedCodes(t.text),
        ]),
      ],
    };
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
  const acol = colours(article.name);
  const aral = rals(article.name);
  const adash = dashedCodes(article.name);
  const afin = finishes(article.name);
  // Cosmos: „N462“ u nazivu artikla = broj boje 462 u katalogu.
  const cosmosNo = brand === "cosmos-lac" ? [...norm(article.name).matchAll(/\bN[O0]?\s?(\d{3,4})\b/g)].map((m) => m[1]) : [];
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
    // Ista šifra kao kataloška (Carsystem: naša šifra = njihova, u katalogu sa tačkom „156.901“).
    const exact = [...t.cs].some((c) => c.replace(/^0+/, "") === code);
    const codeHit =
      exact ||
      t.dashed.some((d) => dashedCodeInName(d, article.name)) ||
      [...t.cs].some((c) => codeInName(c, an)) ||
      [...ac].some((c) => t.cs.has(c)) ||
      // Broj boje mora biti broj u Classic/RAL liniji („CL 303“), ne broj druge linije („FO-303“, „FB-303“).
      (cosmosNo.length > 0 && cosmosNo.some((n) => t.cs.has(n) || t.ws.has(n) || new RegExp(`(^|[^0-9a-z])(cl-|n|r)?${n}([^0-9]|$)`).test(t.key.replace(/\b(fo|fb)-\d+/g, ""))));
    if (codeHit) score += 1;
    // Mera: varijanta koja nosi meru mora da se slaže; proizvod bez mere je neutralan.
    const tm = [...t.ms];
    if (am.size && tm.length) {
      const ok = [...am].some((m) => t.ms.has(m));
      score += ok ? 0.35 : -0.6;
    }
    if (exact) score += 1;
    // Razlike koje predlog ne sme da pređe ćutke (2026-11-13, vlasnik): boja, RAL i šifra proizvoda.
    /** @type {string[]} */
    const doubts = [];
    if (acol.size && t.col.size && ![...acol].some((c) => t.col.has(c))) {
      score -= 0.6;
      doubts.push("boja se razlikuje");
    } else if (acol.size && !t.col.size) doubts.push("boja nije navedena na sajtu");
    if (aral.size && t.ral.size) {
      if ([...aral].some((r) => t.ral.has(r))) score += 0.5;
      else {
        score -= 1;
        doubts.push("RAL se razlikuje");
      }
    }
    if (afin.size && t.fin.size && ![...afin].some((f) => t.fin.has(f))) {
      score -= 0.6;
      doubts.push("sjaj/mat se razlikuje");
    }
    if (!exact && adash.size && t.dashed.length && !t.dashed.some((d) => adash.has(d) || dashedCodeInName(d, article.name))) {
      score -= 1;
      doubts.push("šifra proizvoda se razlikuje");
    }
    if (score > 0.2) ranked.push({ key: t.key, slug: t.slug, variant: t.variant, label: t.label, score: Math.round(score * 1000) / 1000, codeHit, exact, doubts });
  }
  ranked.sort((a, b) => b.score - a.score);
  return { brand, ranked: ranked.slice(0, 3) };
}

/** Pouzdanost predloga iz ocene i razmaka do drugog kandidata. */
export function confidenceOf(/** @type {{ score: number, codeHit: boolean, exact?: boolean, doubts?: string[] }[]} */ ranked) {
  if (!ranked.length) return "nema";
  const [a, b] = ranked;
  // Svaka sumnja (boja, RAL, šifra) zahteva pogled čoveka — nikad „sigurno“.
  if (a.doubts?.length) return a.score >= 0.6 ? "verovatno" : "nejasno";
  // Šifra artikla jednaka šifri kataloške varijante je dokaz sam po sebi (ako nije i kod drugog kandidata).
  if (a.exact && !b?.exact) return "sigurno";
  const gap = a.score - (b?.score ?? 0);
  if ((a.codeHit && gap >= 0.3) || (a.score >= 0.85 && gap >= 0.25)) return "sigurno";
  if (a.score >= 0.6 && gap >= 0.1) return "verovatno";
  return "nejasno";
}

/**
 * Dva ili više artikala sa ISTOM merom/bojom koji dobijaju istu metu ne mogu svi biti tačni
 * (npr. dva „FO-396 VIOLET 400ML“ sa različitim šiframa): svi takvi idu u „nejasno“.
 * Različite litraže istog proizvoda (Baslac 50-15 0,5 / 1 / 2,5 L) su ispravne i ostaju.
 * @template {{ name: string, confidence: string, candidates: { slug: string, variant: string | null }[] }} P
 * @param {P[]} list
 * @returns {P[]}
 */
export function markSharedTargets(list) {
  const seen = new Map();
  const keyOf = (/** @type {P} */ p) => {
    const c = p.candidates[0];
    return c ? `${c.slug}#${c.variant ?? ""}|${[...measures(p.name)].sort().join(",")}|${[...colours(p.name)].sort().join(",")}` : null;
  };
  for (const p of list) {
    const k = keyOf(p);
    if (k && p.confidence === "sigurno") seen.set(k, (seen.get(k) ?? 0) + 1);
  }
  return list.map((p) => {
    const k = keyOf(p);
    return k && p.confidence === "sigurno" && seen.get(k) > 1 ? { ...p, confidence: "nejasno", shared: true } : p;
  });
}

/** Mera iz naziva za prikaz („0,5 L“, „150 mm · P240“), da se pakovanje vidi pre potvrde. */
export function measureLabel(/** @type {string} */ text) {
  const out = [];
  for (const m of measures(text)) {
    if (m.startsWith("L")) {
      const v = Number(m.slice(1));
      out.push(v < 1 ? `${String(Math.round(v * 1000))} ml` : `${String(v).replace(".", ",")} L`);
    } else if (m.startsWith("KG")) {
      const v = Number(m.slice(2));
      out.push(v < 1 ? `${String(Math.round(v * 1000))} g` : `${String(v).replace(".", ",")} kg`);
    } else if (m.startsWith("MM")) out.push(`${m.slice(2)} mm`);
    else if (m.startsWith("D")) out.push(m.slice(1).replace("X", " × "));
    else out.push(m);
  }
  return out.join(" · ");
}
