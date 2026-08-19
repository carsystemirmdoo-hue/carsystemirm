/**
 * Statični trag kita iza proizvoda (Faza 2G).
 *
 * Namerno je vezan za eksplicitnu listu slugova, ne za kategoriju `kitovi`:
 * geometrija je odobrena za jedan konkretan proizvod, a ostali kitovi još
 * nemaju ni potvrđenu boju ni potvrđenu geometriju (vidi Fazu 1). Kategorijska
 * provera bi ih sve uključila i tvrdila nešto što nije potvrđeno.
 *
 * Asseti su fotografski master iz Faze 2E/2F, razdvojen na dva sloja:
 * materijal nosi svoju boju, senka je čista crna sa alfom (množenje), pa
 * ostaje neutralna nezavisno od podloge panela.
 */

/** Proizvodi kojima je odobren trag kita. Slug je stabilan ključ kataloga. */
const PUTTY_MATERIAL_TRACE_SLUGS = new Set<string>([
  "carsystem-git-elastic-weiss",
]);

export function hasPuttyMaterialTrace(slug: string): boolean {
  return PUTTY_MATERIAL_TRACE_SLUGS.has(slug);
}

/** Slojevi se nižu senka → materijal; oba dele isti canvas i poravnanje. */
export const PUTTY_MATERIAL_TRACE_ASSETS = {
  shadow: "/products/carsystem/putty-smear-fine-shadow.png",
  material: "/products/carsystem/putty-smear-fine-material-v2.png",
} as const;

/** Canvas oba asseta: 1413 × 1086 px. Sloj zadržava taj odnos. */
export const PUTTY_MATERIAL_TRACE_ASPECT = "1413 / 1086";

/** Širina canvas-a traga u odnosu na panel. */
export const PUTTY_MATERIAL_TRACE_WIDTH = "78%";

/**
 * Envelope proizvoda za panel sa tragom kita.
 *
 * `--product-envelope-w` ograničava VIDLJIVI, neprovidni sadržaj proizvoda
 * (`.heroProductObject` deli širinu elementa sa `--product-content-fill-x`),
 * pa je 39cqw tačno 39 % širine panela mereno po silueti, a ne po PNG canvasu
 * koji oko limenke nosi providnu marginu.
 */
export const PUTTY_MATERIAL_TRACE_PRODUCT_ENVELOPE = "39cqw";

/** Panel zadržava 4:3 i na mobilnom, gde je podrazumevani format 1:1. */
export const PUTTY_MATERIAL_TRACE_STAGE_ASPECT = "4 / 3";

/**
 * Optička vertikala proizvoda za panel sa tragom kita.
 *
 * Panel podrazumevano diže proizvod na 48 %, što je dobro kad iza njega nema
 * ničega. Trag je centriran na 50 %, pa bi ta razlika pojela gornju marginu
 * materijala (mereno: 3,0 % iznad naspram 6,7 % ispod). Izjednačavanje vraća
 * odobrenu kompoziciju u kojoj je materijal vidljiv sa sve četiri strane.
 */
export const PUTTY_MATERIAL_TRACE_OPTICAL_Y = "50%";
