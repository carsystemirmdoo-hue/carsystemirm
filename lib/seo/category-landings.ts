import type { CarsystemProduct, RmCategorySlug } from "@/lib/carsystem-data";
import { getAllCarsystemProducts } from "@/lib/carsystem-data";

export type SeoCategoryLanding = {
  slug: string;
  name: string;
  singularName: string;
  title: string;
  description: string;
  intro: string;
  rmCategories: RmCategorySlug[];
};

export const seoCategoryLandings: SeoCategoryLanding[] = [
  {
    slug: "bezbojni-lakovi",
    name: "Bezbojni lakovi",
    singularName: "bezbojni lak",
    title: "Bezbojni lakovi za automobile",
    description:
      "Pregled R-M bezbojnih lakova za završni sloj, sjaj i zaštitu u profesionalnom procesu lakiranja. Dokumentacija i dostupnost proveravaju se kroz upit.",
    intro:
      "Bezbojni lak zatvara sistem boje i određuje završni izgled i zaštitu površine. Ovde su objedinjeni potvrđeni R-M proizvodi sa direktnim pristupom tehničkoj dokumentaciji.",
    rmCategories: ["clearcoat"],
  },
  {
    slug: "prajmeri-i-punioci",
    name: "Prajmeri i punioci",
    singularName: "prajmer i punilac",
    title: "Prajmeri i punioci za auto lakiranje",
    description:
      "R-M prajmeri i punioci za pripremu stabilne podloge pre sistema boje, sa tehničkim listovima i upitom za lokalnu dostupnost.",
    intro:
      "Pravilno izabrana podloga povezuje pripremu površine i sistem boje. Lista obuhvata R-M prajmere i punioce sa potvrđenom namenom i lokalnom dokumentacijom.",
    rmCategories: ["primer-filler"],
  },
  {
    slug: "bazne-boje",
    name: "Bazne boje",
    singularName: "bazna boja",
    title: "Bazne boje za automobile",
    description:
      "R-M bazne komponente za usklađivanje nijanse i rad u sistemu boje. Pogledajte namenu, dokumentaciju i pošaljite upit za dostupnost.",
    intro:
      "Bazne komponente koriste se unutar definisanog R-M sistema i povezuju pripremljenu podlogu sa odgovarajućim završnim lakom.",
    rmCategories: ["basecoat"],
  },
  {
    slug: "ucvrscivaci-i-razredjivaci",
    name: "Učvršćivači i razređivači",
    singularName: "sistemska komponenta",
    title: "Učvršćivači i razređivači za auto lakove",
    description:
      "R-M učvršćivači i razređivači za potvrđene refinish sisteme. Kompatibilnost i odnos primene proverite u tehničkoj dokumentaciji.",
    intro:
      "Učvršćivači i razređivači su sistemske komponente. Izbor mora pratiti konkretan proizvod, uslove rada i parametre iz odgovarajućeg tehničkog lista.",
    rmCategories: ["hardener", "thinner"],
  },
];

export function getSeoCategoryLanding(slug: string) {
  return seoCategoryLandings.find((category) => category.slug === slug);
}

export function getSeoCategoryProducts(category: SeoCategoryLanding) {
  const allowedCategories = new Set(category.rmCategories);
  return getAllCarsystemProducts().filter(
    (product) =>
      product.brandSlug === "rm" &&
      product.rmMetadata &&
      allowedCategories.has(product.rmMetadata.category),
  );
}

export function getSeoCategoryForProduct(product: CarsystemProduct) {
  if (product.brandSlug !== "rm" || !product.rmMetadata) return undefined;
  return seoCategoryLandings.find((category) =>
    category.rmCategories.includes(product.rmMetadata?.category as RmCategorySlug),
  );
}

export function getRmCategorySingularName(category: RmCategorySlug) {
  const labels: Record<RmCategorySlug, string> = {
    additive: "aditiv",
    basecoat: "bazna boja",
    bodyfiller: "kit",
    cleaner: "čistač",
    clearcoat: "bezbojni lak",
    hardener: "učvršćivač",
    "polishing-compound": "pasta za poliranje",
    "primer-filler": "prajmer i punilac",
    thinner: "razređivač",
  };
  return labels[category];
}
