import type { ComponentProps } from "react";
import { CatalogProductCard } from "@/components/catalog/CatalogProductCard";
import type { CarsystemProduct } from "@/lib/carsystem-data";
import { toCatalogListingEntity } from "@/lib/catalog-listing";

/**
 * Serverska varijanta kartice za pozivaoce koji imaju samo proizvod (srodni proizvodi na
 * stranici proizvoda, Cosmos brend stranica). Podatak za karticu se izvodi ovde, na serveru,
 * pa pregledač ne dobija modul kataloga.
 */
export function CatalogProductCardFromProduct({
  product,
  ...props
}: Omit<ComponentProps<typeof CatalogProductCard>, "entity" | "product"> & {
  product: CarsystemProduct;
}) {
  return <CatalogProductCard {...props} entity={toCatalogListingEntity(product)} product={product} />;
}
