/**
 * Strukturisani atributi iz zvaničnog teksta specifikacije i podnaslova.
 *
 * Čita se samo ono što proizvođač doslovno piše („P 80”, „150 mm”,
 * „1.0 kg tin incl. hardener”). Što se ne prepozna ostaje sirova
 * `specification` — atribut se nikad ne izvodi iz naziva ni iz sličnog artikla.
 */

const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

const NUMBER = "(\\d+(?:[.,]\\d+)?)";

const COLOR_WORDS = [
  "white", "black", "grey", "gray", "red", "blue", "green", "yellow", "orange", "gold", "beige",
  "brown", "pink", "purple", "violet", "anthracite", "transparent", "silver", "navy", "camouflage",
];

const SIZE_TOKEN = /(?:^|[\s/(,-])((?:[2-5]?X{1,3}L|XXS|XS|S|M|L|XL)|(?:size\s*)?\d{1,2}(?:\s*[-–/]\s*\d{1,2})?)(?=$|[\s/),-])/i;

/**
 * @param {string|null} specification
 * @returns {Record<string, string>}
 */
export function parseSpecification(specification) {
  const spec = clean(specification);
  /** @type {Record<string, string>} */
  const out = {};
  if (!spec) return out;

  const grit = /^(?:P|Grit|K)\s?(\d{2,5})\b/i.exec(spec);
  if (grit) out.grit = /^grit/i.test(spec) ? `Grit ${grit[1]}` : `P${grit[1]}`;

  const dimensions = new RegExp(`${NUMBER}\\s?(mm|cm|m)?\\s?[x×]\\s?${NUMBER}\\s?(mm|cm|m)(?:\\s?[x×]\\s?${NUMBER}\\s?(mm|cm|m))?`, "i").exec(spec);
  if (dimensions) out.dimensions = clean(dimensions[0]).replace(/\s?[x×]\s?/g, " × ");

  if (!dimensions) {
    const diameter = new RegExp(`(?:Ø\\s?)?${NUMBER}\\s?mm\\b`, "i").exec(spec);
    if (diameter) out.diameter = `${diameter[1].replace(",", ".")} mm`;
  }

  const volume = new RegExp(`${NUMBER}\\s?(ml|l|L|ltr|litre|liter)\\b`).exec(spec);
  if (volume) out.volume = `${volume[1].replace(",", ".")} ${/^m/i.test(volume[2]) ? "ml" : "L"}`;

  const weight = new RegExp(`${NUMBER}\\s?(kg|g)\\b`).exec(spec);
  if (weight) out.weight = `${weight[1].replace(",", ".")} ${weight[2]}`;

  const micron = new RegExp(`${NUMBER}\\s?(?:µ|µm|my)\\b`, "i").exec(spec);
  if (micron) out.fineness = `${micron[1]} µ`;

  const color = COLOR_WORDS.find((word) => new RegExp(`\\b${word}\\b`, "i").test(spec));
  if (color) out.color = color === "gray" ? "grey" : color;

  // Konfekcijska veličina ima smisla samo kada red nije mera (mm/kg/ml…).
  if (!grit && !dimensions && !out.diameter && !volume && !weight) {
    const size = SIZE_TOKEN.exec(spec);
    if (size && /^(?:[2-5]?X{0,3}[SML]|XXS|XS)$/i.test(size[1])) out.size = size[1].toUpperCase();
  }

  const container = /\b(tin|cartridge|can|bottle|canister|spray|aerosol|tube|bag|box|roll|bucket|drum|sachet)\b/i.exec(spec);
  if (container) out.container = container[1].toLowerCase();

  if (/incl(?:\.|uding)?\s+hardener/i.test(spec)) out.includes = "hardener";

  return out;
}

/** Atributi koji važe za ceo proizvod, iz zvaničnog podnaslova („Film abrasive – 150 mm – 25 holes”). */
export function parseSubtitle(subtitle) {
  const text = clean(subtitle);
  /** @type {Record<string, string>} */
  const out = {};
  if (!text) return out;

  const dimensions = new RegExp(`${NUMBER}\\s?(mm|cm|m)?\\s?[x×]\\s?${NUMBER}\\s?(mm|cm|m)`, "i").exec(text);
  if (dimensions) out.dimensions = clean(dimensions[0]).replace(/\s?[x×]\s?/g, " × ");
  else {
    const diameter = new RegExp(`(?:Ø\\s?)?${NUMBER}\\s?mm\\b`, "i").exec(text);
    if (diameter) out.diameter = `${diameter[1]} mm`;
  }

  const holes = /(\d+)\s?holes?\b/i.exec(text) ?? /\b(multi\s?-?hole)\b/i.exec(text);
  if (holes) out.holePattern = /multi/i.test(holes[1]) ? "multihole" : `${holes[1]} holes`;

  const parts = text.split(/\s[-–]\s/).map(clean).filter(Boolean);
  if (parts.length) out.productType = parts[0];
  if (/\broll\b/i.test(text)) out.form = "roll";

  return out;
}

/** Ključ poređenja specifikacija između sajta i PDF-a („P 80” ≡ „P80”, „x” ≡ „×”). */
export const specKey = (value) =>
  clean(value)
    .toLowerCase()
    .replace(/[×x]/g, "x")
    .replace(/[^a-z0-9µ]+/g, "");

export const nameKey = (value) =>
  clean(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "");
