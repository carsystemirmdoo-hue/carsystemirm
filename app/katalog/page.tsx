import type { Metadata } from "next";
import { CatalogPage } from "@/components/catalog/CatalogPage";
import {
  getAllCarsystemBrands,
  programGroups,
  refinishPhases,
} from "@/lib/carsystem-data";
import { getCatalogListingData } from "@/lib/catalog-listing";
import { collectionPageJsonLd, jsonLd, pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Katalog proizvoda za autolakirnice",
  description:
    "Profesionalni katalog proizvoda za pripremu, bojenje, lakiranje, poliranje i radioničku opremu u Carsystem i R-M programu.",
  path: "/katalog",
  imageAlt: "Katalog proizvoda za profesionalne autolakirnice",
});

export default function KatalogPage() {
  const { canonical } = getCatalogListingData();
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(
          collectionPageJsonLd({
            name: "Katalog proizvoda za autolakirnice",
            description:
              "Profesionalni proizvodi za pripremu, bojenje, lakiranje, poliranje i radioničku opremu.",
            path: "/katalog",
          }),
        )}
      />
      <CatalogPage
        canonical={canonical}
        brands={getAllCarsystemBrands()}
        programs={programGroups}
        phases={refinishPhases}
      />
    </>
  );
}
