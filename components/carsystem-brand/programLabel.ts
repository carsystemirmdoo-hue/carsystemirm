/**
 * Javni naziv internog programa za klijentske kartice Carsystem strane.
 * Isti nazivi kao `programGroups` u `lib/carsystem-data.ts`; ovde su prepisani da klijentski
 * paket ne uvozi ceo katalog. Nepoznat slug se prikazuje bez crtica, kao i ranije.
 */
const PROGRAM_LABELS: Record<string, string> = {
  "boje-i-lakovi": "Boje i lakovi",
  "priprema-povrsine": "Priprema površine",
  abrazivi: "Abrazivi",
  oprema: "Oprema za lakirnice",
  aerosoli: "Aerosol program",
  poliranje: "Poliranje",
  "potrosni-materijal": "Potrošni materijal",
};

export function programLabel(slug: string): string {
  return PROGRAM_LABELS[slug] ?? slug.replaceAll("-", " ");
}
