/**
 * Zamenska sličica R-M portala („Image missing”) nije slika proizvoda.
 *
 * Dva nezavisna dokaza, dovoljan je bilo koji:
 *   1. SADRŽAJ — isti bajtovi na ≥ 3 zapisa (`placeholder` iz acquire-images);
 *   2. IZVORNI FAJL — portal ga imenuje `Image missing[_N].png`. Varijanta `_1`
 *      postoji na jednom jedinom zapisu (H 2RM2), pa pravilo po sadržaju nije
 *      moglo da je uhvati i sajt je prikazivao natpis „Image missing” kao proizvod.
 *
 * Pravilo je čista funkcija nad zapisom manifesta, pa ga plan i apply primenjuju
 * na već preuzet manifest bez ponovnog preuzimanja i bez ručne izmene fajla.
 */
const PORTAL_PLACEHOLDER_FILE = /^image missing(?:_\d+)?\.(?:png|jpe?g|webp)$/i;

export function portalPlaceholderFileName(url) {
  try {
    return decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "");
  } catch {
    return "";
  }
}

export function isPortalPlaceholder(image) {
  return Boolean(image?.placeholder) || PORTAL_PLACEHOLDER_FILE.test(portalPlaceholderFileName(image?.url ?? ""));
}
