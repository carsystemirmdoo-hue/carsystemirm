/**
 * Boja roletne na /katalog kartici za abrazive i trake (2026-10-30).
 *
 * Opšte pravilo kartice (CatalogProductCard) boji roletnu nijansom samog proizvoda.
 * Kod farbe to je smisao roletne, ali kod diska, podloška ili trake proizvod je
 * iste boje kao roletna i nestaje u njoj (smeđi F19 disk na smeđem, plavi F23 na
 * plavom, crni podložak na crnom). Vlasnik je za ove dve kategorije tražio „boju
 * brenda ili boju koja je kontrast proizvodu".
 *
 *   1. Boja brenda, kada proizvod nema veću površinu (≥ 12 %) bliske boje.
 *      Carsystem i C.A.R.FIT su crveni, a mnogi njihovi podlošci i trake imaju
 *      crvene delove; tada bi crveni proizvod ponovo stajao na crvenom.
 *   2. Inače kontrastna neutralna: svetla uz taman proizvod, grafit uz svetao.
 *
 * Boja proizvoda se čita iz izmerene grube palete slike (`coarse`, 3 bita po
 * kanalu) i iz potvrđene nijanse (`shade`), ne iz naziva.
 */

/** Kategorije u kojima roletna ne sme da ponovi boju proizvoda. */
export const ROLLER_CONTRAST_CATEGORIES = new Set(["abrazivi", "maskiranje"]);

export const ROLLER_LIGHT = "#E8EAED";
export const ROLLER_DARK = "#2A2E35";

/** Udeo površine bliske boje brenda od kog se brend ne koristi. */
export const BRAND_CLASH_SHARE = 0.12;
/** Oklab rastojanje ispod kog se dve boje na kartici ne razlikuju dovoljno. */
export const CLASH_DISTANCE = 0.16;

function hexToLinear(hex) {
  const value = hex.replace("#", "");
  return [0, 2, 4].map((index) => {
    const channel = parseInt(value.slice(index, index + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
}

/** sRGB hex → Oklab [L, a, b]. */
export function hexToOklab(hex) {
  const [r, g, b] = hexToLinear(hex);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

export function oklabDistance(left, right) {
  const a = hexToOklab(left);
  const b = hexToOklab(right);
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

const isHex = (value) => typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);

/**
 * @param {{
 *   categorySlugs: readonly string[],
 *   brandColor: string | null | undefined,
 *   shade?: string | null,
 *   coarse?: readonly { hex: string, share: number }[] | null,
 *   luminance?: number | null,
 * }} input
 * @returns {string | undefined} boja roletne, ili `undefined` kada pravilo ne važi
 */
export function catalogRollerColor({ categorySlugs, brandColor, shade, coarse, luminance }) {
  if (!categorySlugs.some((slug) => ROLLER_CONTRAST_CATEGORIES.has(slug))) return undefined;

  const areas = (coarse ?? []).filter((entry) => isHex(entry.hex));
  const shadeHex = isHex(shade) ? shade : null;

  if (isHex(brandColor)) {
    const clashShare = areas
      .filter((entry) => oklabDistance(entry.hex, brandColor) < CLASH_DISTANCE)
      .reduce((sum, entry) => sum + entry.share, 0);
    const shadeClashes = shadeHex !== null && oklabDistance(shadeHex, brandColor) < CLASH_DISTANCE;
    if (clashShare < BRAND_CLASH_SHARE && !shadeClashes) return brandColor;
  }

  // Kontrast prema izmerenoj medijani svetline proizvoda (relativna luminansa → Oklab L ≈ ∛Y);
  // bez merenja prema najvećoj površini, pa prema nijansi.
  const dominant = areas[0]?.hex ?? shadeHex;
  const lightness =
    typeof luminance === "number"
      ? Math.cbrt(luminance)
      : dominant
        ? hexToOklab(dominant)[0]
        : 0.5;
  return lightness < 0.62 ? ROLLER_LIGHT : ROLLER_DARK;
}
