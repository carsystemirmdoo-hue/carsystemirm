import type { CarsystemBrand } from "@/lib/carsystem-data";

/**
 * Boja brenda za karticu proizvoda u katalogu (`/katalog`).
 *
 * Jedno centralno pravilo: kartica proizvoda koji nema sopstvenu nijansu
 * (`ProductVisualPresentation.shade === null`) boji svoju obojenu površinu
 * bojom brenda. Sama vrednost NIJE druga tabela heksova — čita se iz već
 * postojećeg `brand.presentation.accentColor` u `lib/carsystem-data.ts`, gde
 * su boje potvrđene prema logotipima i brend stranicama. Ovde se odlučuje samo
 * KOJI brendovi imaju prepoznatljivu boju:
 *
 *   | brend     | vrednost | izvor (proveren 2026-09-10)                              |
 *   |-----------|----------|----------------------------------------------------------|
 *   | carsystem | #E30613  | public/brands/carsystem.svg (fill:#e30613)               |
 *   | baslac    | #21A0D2  | public/brands/baslac.svg (fill="#21A0D2")                |
 *   | rm        | #E3000F  | rmpaint.com CSS `rgba(227,0,15)` / `#e3000f`; logotip je |
 *   |           |          | srebrni gradijent, crvena je akcenat brenda na sajtu      |
 *   | sata      | #E2001A  | public/brands/sata.svg (fill="#E2001A")                  |
 *   | carfit    | #E20613  | public/brands/carfit.svg (fill:#e20613) i                |
 *   |           |          | carfitrepair.com elementor CSS `#E20613`                 |
 *   | norbin    | #0082BB  | public/brands/norbin.svg (fill:#0082BB)                  |
 *
 * NAPOMENA: R-M (#E3000F), C.A.R.FIT (#E20613), Carsystem (#E30613) i SATA
 * (#E2001A) su zvanično gotovo iste crvene (ΔE ispod praga razlikovanja na
 * kartici). To je činjenica o logotipima, ne greška. Jače razlikovanje na
 * karticama bio bi IZBOR DIZAJNA (npr. tamnija R-M crvena), odvojen od
 * zvanične boje — nije primenjen bez odluke korisnika.
 *
 * Cosmos Lac i Befar nemaju prepoznatljivu boju u dostupnim podacima (logotipi
 * su jednobojni, akcenat je neutralni „ink"), pa kartica zadržava postojeći
 * neutralan prikaz.
 *
 * Boja brenda je isključivo vizuelna: ne upisuje se kao nijansa proizvoda i ne
 * ulazi u filter nijansi.
 */
export const BRAND_CARD_COLOR_SLUGS: ReadonlySet<string> = new Set([
  "carsystem",
  "baslac",
  "rm",
  "sata",
  "carfit",
  "norbin",
]);

export function getBrandCardColor(
  brand: Pick<CarsystemBrand, "slug" | "presentation">,
): string | null {
  return BRAND_CARD_COLOR_SLUGS.has(brand.slug) ? brand.presentation.accentColor : null;
}
