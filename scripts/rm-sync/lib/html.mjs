/** Mali HTML pomoćnici za Drupal stranice R-M izvora (bez DOM biblioteke). */

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", reg: "®", trade: "™", deg: "°", ndash: "–", mdash: "—", uuml: "ü", ouml: "ö", auml: "ä", eacute: "é" };

export const decode = (text) =>
  String(text ?? "")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (match, name) => ENTITIES[name.toLowerCase()] ?? match);

export const clean = (htmlText) => decode(String(htmlText ?? "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

/** Paragrafi bloka: `<p>`, `<li>`, `<br>` prelomi postaju zasebni redovi. */
export function paragraphs(htmlText) {
  return decode(String(htmlText ?? "").replace(/<\/(p|li|div|h\d)>|<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " "))
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/** Sadržaj Drupal polja `field--name-<name>` (prvi pogodak), ili null. */
export function field(htmlText, name) {
  const start = htmlText.indexOf(`field--name-${name} `);
  if (start < 0) return null;
  const open = htmlText.lastIndexOf("<div", start);
  // Polje se završava pre sledećeg polja istog nivoa ili kraja članka.
  const rest = htmlText.slice(open);
  const next = rest.slice(10).search(/<div class="[^"]*\bfield field--name-|<\/article>/);
  return next < 0 ? rest : rest.slice(0, next + 10);
}
