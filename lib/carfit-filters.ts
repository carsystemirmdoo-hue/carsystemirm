import type { RefinishPhaseSlug } from "@/lib/carsystem-data";

/**
 * Filteri Car Fit liste. Poseban modul jer ga uvozi klijentska komponenta: uvoz iz
 * `lib/carfit-brand-data.ts` bi u pregledač uvukao ceo katalog.
 */
export const carfitProductFilters = [
  { id: "sve", label: "Sve", phaseSlugs: null },
  { id: "priprema", label: "Priprema", phaseSlugs: ["priprema"] as RefinishPhaseSlug[] },
  { id: "podloga", label: "Podloga", phaseSlugs: ["podloga"] as RefinishPhaseSlug[] },
  { id: "lakiranje", label: "Lakiranje", phaseSlugs: ["boja", "lak"] as RefinishPhaseSlug[] },
  { id: "finish", label: "Završna obrada", phaseSlugs: ["poliranje"] as RefinishPhaseSlug[] },
];
