/**
 * Prikaz tehničkih podataka kupcu: srpski format brojeva i uklanjanje DUPLIKATA istog podatka.
 *
 * Sync adapteri (R-M, Norbin) spajaju lokalizovane činjenice („Mlaznica (mm): 1–1,2”) i sirove
 * vrednosti iz tehničkog lista („Mlaznica: 1 -1.2 mm”), pa je ista vrednost na stranici stajala
 * dvaput, drugi put u engleskom formatu. Ovaj modul je jedino mesto koje to razrešava — za PDP
 * i za JSON-LD — i NE menja izvorne podatke.
 *
 * Pravilo za duplikat je namerno usko: kasniji red se izostavlja samo kada ima istu oznaku
 * (bez dela u zagradi) i kada su mu SVI brojevi već sadržani u ranijem redu iste oznake, ili
 * kada je tekst isti. Red koji nosi bilo koju drugu brojčanu vrednost ostaje, pa se nijedna
 * različita vrednost ne gubi (npr. dve šifre, dva pakovanja, napomena o česticama uz VOC).
 *
 * Bez runtime zavisnosti (koristi se i na serveru i u klijentskom prikazu varijante).
 */

/** Oznake čije su vrednosti zvanični nazivi ili šifre — njih ne formatiramo. */
const VERBATIM_LABEL = /naziv|šifr|sifr|model|oznak|art\.|artikl|kod\b|code|revizij/i;

function srPlural(count, one, few, many) {
  const n = Math.abs(Math.trunc(count)) % 100;
  const last = n % 10;
  if (n >= 11 && n <= 14) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}

const UNIT_WORDS = [
  [/\b(\d+(?:[.,]\d+)?)\s*months?\b/gi, (n) => srPlural(Number(n.replace(",", ".")), "mesec", "meseca", "meseci")],
  [/\b(\d+(?:[.,]\d+)?)\s*days?\b/gi, (n) => srPlural(Number(n.replace(",", ".")), "dan", "dana", "dana")],
  [/\b(\d+(?:[.,]\d+)?)\s*weeks?\b/gi, (n) => srPlural(Number(n.replace(",", ".")), "nedelja", "nedelje", "nedelja")],
  [/\b(\d+(?:[.,]\d+)?)\s*years?\b/gi, (n) => srPlural(Number(n.replace(",", ".")), "godina", "godine", "godina")],
  [/\b(\d+(?:[.,]\d+)?)\s*hours?\b/gi, () => "h"],
  [/\b(\d+(?:[.,]\d+)?)\s*minutes?\b/gi, () => "min"],
];

/**
 * Srpski zapis tehničke vrednosti: decimalni zarez, crta opsega bez razmaka, „na” umesto „at”,
 * srpske jedinice vremena. Hiljadarske tačke (10.000) i šifre sa tri decimale (152.596) ostaju.
 */
export function formatTechnicalValueSr(label, value) {
  if (typeof value !== "string" || !value) return value;
  if (VERBATIM_LABEL.test(label ?? "")) return value;
  let out = value;
  // „(at 20°C)” / „at 60°C” → „na …”
  out = out.replace(/\(\s*at\s+(-?\d)/gi, "(na $1").replace(/\bat\s+(-?\d+\s*°)/gi, "na $1");
  for (const [pattern, word] of UNIT_WORDS) {
    out = out.replace(pattern, (_match, n) => `${n} ${word(n)}`);
  }
  // Decimalna tačka → zarez (samo 1–2 decimale; 3 cifre posle tačke su hiljade ili šifra).
  out = out.replace(/(\d)\.(\d{1,2})(?!\d)/g, "$1,$2");
  // Opseg sa razmakom oko crte („1,3 -1,4”, „0,5 - 2,4”) → „1,3–1,4”.
  out = out.replace(/(\d)\s+-\s*(?=\d)/g, "$1–").replace(/(\d)\s*-\s+(?=\d)/g, "$1–");
  return out;
}

function baseLabel(label) {
  return String(label ?? "")
    .toLowerCase()
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function numbersOf(text) {
  return (String(text ?? "").match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => Number(n.replace(",", ".")));
}

function normalizedText(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[\s·,;:()–-]+/g, " ")
    .trim();
}

function isCoveredBy(later, earlier) {
  if (normalizedText(later) === normalizedText(earlier)) return true;
  const laterNumbers = numbersOf(later);
  if (laterNumbers.length === 0) return false;
  const earlierNumbers = new Set(numbersOf(earlier));
  return laterNumbers.every((n) => earlierNumbers.has(n));
}

/**
 * @template {{ label: string; value: string; detail?: string }} T
 * @param {T[]} facts
 * @returns {T[]}
 */
export function presentTechnicalFacts(facts) {
  const kept = [];
  for (const fact of facts ?? []) {
    const key = baseLabel(fact.label);
    const earlier = kept.filter((item) => baseLabel(item.label) === key);
    const combined = `${fact.value ?? ""} ${fact.detail ?? ""}`;
    if (earlier.some((item) => isCoveredBy(combined, `${item.value ?? ""} ${item.detail ?? ""}`))) continue;
    kept.push(fact);
  }
  return kept.map((fact) => ({
    ...fact,
    value: formatTechnicalValueSr(fact.label, fact.value),
    ...(fact.detail ? { detail: formatTechnicalValueSr(fact.label, fact.detail) } : {}),
  }));
}
