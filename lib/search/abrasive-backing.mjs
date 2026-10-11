/**
 * Podloga abraziva prema ZVANIČNOM podnaslovu proizvođača (carsystem.org `officialSubtitle`:
 * „Paper abrasive - 150 mm…”, „Film abrasive…”, „Net abrasive…”, „Foam abrasive…”, „Sanding Fleece…”).
 *
 * Kupac traži „brusni papir”, a zvanični naziv kaže samo „Sanding Disc P.19”. Pojam se izvodi
 * isključivo iz vrste koju je proizvođač naveo — film, mreža i sunđer NISU papir, pa ne dobijaju
 * „papir” samo zato što su brusni diskovi.
 */
const BACKINGS = [
  [/^paper abrasive\b/i, ["papir", "papirni"]],
  [/^film abrasive\b/i, ["film", "filmski"]],
  [/^net (?:abrasive|sanding)\b/i, ["mreza", "mrezasti"]],
  [/^foam abrasive\b/i, ["sundjer"]],
  [/^sanding fleece\b/i, ["flis"]],
];

/** @param {string | null | undefined} officialSubtitle */
export function abrasiveBackingTerms(officialSubtitle) {
  if (!officialSubtitle) return [];
  const match = BACKINGS.find(([pattern]) => pattern.test(officialSubtitle.trim()));
  return match ? [...match[1]] : [];
}
