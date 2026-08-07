import type { CarfitCatalogTarget, CarfitMediaSlot } from "@/lib/carfit-brand-data";
import type { RefinishPhaseSlug } from "@/lib/carsystem-data";

/**
 * Serijalizovani oblici koje server razreši iz centralnog kataloga i prosledi
 * klijentskim komponentama. Klijent nikada ne drži kopiju product podataka —
 * samo ono što mu treba za prikaz.
 */

export type CarfitProductView = {
  slug: string;
  name: string;
  purpose: string;
  shortDescription: string;
  phaseSlug: RefinishPhaseSlug;
  phaseName: string;
  programName: string;
  status: string;
  sku: string;
  packageLabel: string;
  image: { src: string; alt: string } | null;
  href: string;
};

export type CarfitTaskCategoryView = {
  id: string;
  name: string;
  href: string | null;
};

export type CarfitTaskView = {
  id: string;
  code: string;
  label: string;
  marker: string;
  lead: string;
  body: string;
  workflow: { code: string; title: string; note: string }[];
  categories: CarfitTaskCategoryView[];
  products: CarfitProductView[];
  scopeNote: { title: string; body: string } | null;
  catalogTarget: CarfitCatalogTarget | null;
  media: CarfitMediaSlot;
};
