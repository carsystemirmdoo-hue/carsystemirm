/**
 * Srpske oznake varijanti iz STRUKTURISANIH zvaničnih podataka (boja, dimenzija, rupe).
 *
 * Befar varijanta nije slobodan tekst nego tri kolone tabele, pa se oznaka gradi
 * deterministički — bez prevodioca i bez nagađanja. Nepoznata vrednost ostaje
 * kakvu je proizvođač napisao.
 */

const COLOURS = {
  white: "bela", beyaz: "bela", orange: "narandžasta", black: "crna", yellow: "žuta", blue: "plava", cream: "krem",
  burgundy: "bordo", "claret red": "bordo", cherry: "bordo", red: "crvena", grey: "siva", gray: "siva", green: "zelena",
  turquoise: "tirkizna", "yellow-black": "žuto-crna",
};

const SIZE_WORDS = { standard: "standardna", standart: "standardna", middle: "srednja", big: "velika", soft: "meka", extra: "ekstra" };

export function colourSr(colour) {
  if (!colour) return null;
  const key = String(colour).trim().toLowerCase();
  return COLOURS[key] ?? colour;
}

/** „150x25mm” → „150 × 25 mm”, „4x5m²” → „4 × 5 m²”, „75/125/145mm” → „75 / 125 / 145 mm”, „1000 gr.” → „1000 g”. */
export function sizeSr(size) {
  if (!size) return null;
  const text = String(size).trim().replace(/\.$/, "");
  const word = SIZE_WORDS[text.toLowerCase()];
  if (word) return word;
  const pieces = /^(\d+)\s?pieces?$/i.exec(text);
  if (pieces) return `${pieces[1]} delova`;
  return text
    .replace(/,/g, ".")
    .replace(/(\d)\s?x\s?(\d)/gi, "$1 × $2")
    .replace(/(\d)\s?\/\s?(?=\d)/g, "$1 / ")
    .replace(/\/\s?no hole/i, " · bez rupa")
    .replace(/\/\s?(\d+)\s?holes?/i, " · $1 rupa")
    .replace(/(\d)\s?(mm|cm|ml|m²|m)\b/g, "$1 $2")
    .replace(/(\d)\s?gr\b/gi, "$1 g")
    .replace(/(\d)\.(\d)/g, "$1,$2");
}

export function holesSr(holes) {
  const count = /(\d+)/.exec(String(holes ?? ""))?.[1];
  return count ? `${count} rupa` : null;
}

/**
 * Oznaka varijante. `varyingKeys` su atributi koji se U PORODICI razlikuju: ako svi
 * sunđeri imaju istu dimenziju, dimenzija ne nosi informaciju u oznaci, ali ostaje
 * u njoj kada je jedini atribut.
 */
export function variantLabel(variant, varyingKeys) {
  const parts = [];
  if (variant.colour && (varyingKeys.has("colour") || !variant.size)) parts.push(capitalize(colourSr(variant.colour)));
  if (variant.size && (varyingKeys.has("size") || !parts.length || !varyingKeys.size)) parts.push(sizeSr(variant.size));
  if (variant.holes && (varyingKeys.has("holes") || !parts.length)) parts.push(holesSr(variant.holes));
  if (!parts.length) parts.push(sizeSr(variant.size) ?? capitalize(colourSr(variant.colour)) ?? "Standardno pakovanje");
  return parts.filter(Boolean).join(" · ");
}

export function varyingKeysOf(variants) {
  const keys = new Set();
  for (const key of ["colour", "size", "holes"]) if (new Set(variants.map((variant) => String(variant[key] ?? "").toLowerCase())).size > 1) keys.add(key);
  return keys;
}

const capitalize = (text) => (text ? text.charAt(0).toUpperCase() + text.slice(1) : text);
