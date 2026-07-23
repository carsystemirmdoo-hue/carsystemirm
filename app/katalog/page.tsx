import type { Metadata } from "next";
import { CatalogPage } from "@/components/catalog/CatalogPage";
import {
  getAllCarsystemBrands,
  getAllCarsystemProducts,
  programGroups,
  refinishPhases,
  toProductListingProduct,
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
      products={getAllCarsystemProducts().map(toProductListingProduct)}
      brands={getAllCarsystemBrands()}
      programs={programGroups}
      phases={refinishPhases}
    />
  );
}
