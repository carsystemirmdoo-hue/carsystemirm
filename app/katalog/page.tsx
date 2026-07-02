import type { Metadata } from "next";
import { CatalogPage } from "@/components/catalog/CatalogPage";
import {
  brands,
  getAllCarsystemProducts,
  programGroups,
  refinishPhases,
} from "@/lib/carsystem-data";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Katalog proizvoda",
  description:
    "Profesionalni katalog proizvoda za pripremu, bojenje, lakiranje, poliranje i radioničku opremu u Carsystem i R-M programu.",
  path: "/katalog",
});

export default function KatalogPage() {
  return (
    <CatalogPage
      products={getAllCarsystemProducts()}
      brands={brands}
      programs={programGroups}
      phases={refinishPhases}
    />
  );
}
