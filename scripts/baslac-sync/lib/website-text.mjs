/**
 * Čitanje teksta sa baslac stranica kategorija.
 *
 * Izdvojeno iz koraka preuzimanja da bi se pravila mogla testirati bez mreže: obe greške
 * koje su ovde nastale (naziv kome je otkinut prvi znak i slika vezana za pogrešnu šifru)
 * vidljive su samo na stvarnim nizovima sa sajta.
 */

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", reg: "®", deg: "°", ndash: "–", mdash: "—", "#8217": "'", "#8211": "–" };

export const decode = (text) =>
  String(text ?? "")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (match, name) => ENTITIES[name.toLowerCase()] ?? match);

/** Sajt meša običnu crticu, non-breaking hyphen (‑) i zero-width space. */
export const plain = (html) =>
  decode(String(html).replace(/<[^>]+>/g, " "))
    .replace(/[‑–]/g, "-")
    .replace(/[​­]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** Šifre u jednom nizu, uz „/-NN" nastavak koji nasleđuje prefiks prethodne pune šifre. */
export function codesIn(text) {
  const out = [];
  let prefix = null;
  for (const match of String(text).matchAll(/(?:\b(\d{2})-([A-Z]?\d{2,3})\b|\/\s*-(\d{2,3})\b)/g)) {
    if (match[1]) {
      prefix = match[1];
      out.push(`${match[1]}-${match[2]}`);
    } else if (prefix) out.push(`${prefix}-${match[3]}`);
  }
  return [...new Set(out)];
}

/**
 * Vodeće šifre i razdvajači se skidaju kao CELI tokeni — nikad znak po znak.
 *
 * Raniji oblik je brisao svaki vodeći broj, pa je „12-20 2K Universal Bodyfiller" postajao
 * „K Universal Bodyfiller": cifra iz „2K" je nestala zajedno sa šifrom.
 */
export const stripLeadingCodes = (text) => String(text).replace(/^(?:\s*(?:\d{2}-[A-Z]?\d{2,3}|\/?\s*-\d{2,3})\s*,?)+/, "").trim();
