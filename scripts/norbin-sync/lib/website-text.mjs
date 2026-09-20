/**
 * Čitanje teksta sa Norbin stranica opsega.
 *
 * Izdvojeno iz koraka preuzimanja da bi se pravila mogla testirati bez mreže — i da uvoz
 * modula u testu ne bi pokrenuo samo preuzimanje.
 */

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", reg: "®", deg: "°", ndash: "–", mdash: "—" };

export const decode = (text) =>
  String(text ?? "")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (match, name) => ENTITIES[name.toLowerCase()] ?? match);

export const plain = (html) => decode(String(html).replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

/**
 * Zvanična šifra: `N15-020`, `N15-V20`, `N55-121`.
 *
 * `\b` NE važi iza donje crte (oba su znakovi reči), pa bi `SDS_N15-120_1L_TR.PDF` ostao bez
 * šifre — zato se razdvajači najpre normalizuju u razmak. Golo numeričko poklapanje se ne
 * prihvata: traži se ceo oblik `N##-###`.
 */
const CODE = /(?<![A-Z0-9])N\d{2}-[A-Z]?\d{2,3}(?![A-Z0-9])/g;
export const codesIn = (text) => [...new Set([...String(text).replace(/[_.]/g, " ").toUpperCase().matchAll(CODE)].map((match) => match[0]))];
