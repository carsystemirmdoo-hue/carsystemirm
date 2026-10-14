/**
 * Male, čiste konstante kataloga koje koriste i klijentske komponente.
 *
 * Namerno bez uvoza iz `lib/carsystem-data.ts`: taj modul nosi ceo katalog, pa bi svaki
 * klijentski uvoz odatle — makar jedne konstante — ubacio podatke o svim proizvodima u
 * JavaScript koji pregledač preuzima na svakoj stranici.
 */
import type { CarsystemProduct, ProductPublicStatus } from "@/lib/carsystem-data";
export const rmSystemSlugs = [
  "agilis",
  "onyx-hd",
  "diamont",
  "uno-hd",
  "crystal-base",
  "graphite-hd",
] as const;

export type RmSystemSlug = (typeof rmSystemSlugs)[number];

export const rmSeriesSlugs = ["pioneer", "advance", "element"] as const;

export type RmSeriesSlug = (typeof rmSeriesSlugs)[number];

export const rmCategorySlugs = [
  "basecoat",
  "clearcoat",
  "primer-filler",
  "bodyfiller",
  "hardener",
  "thinner",
  "additive",
  "cleaner",
  "polishing-compound",
] as const;

export type RmCategorySlug = (typeof rmCategorySlugs)[number];

export function getProductPublicStatus(product: CarsystemProduct): ProductPublicStatus {
  return product.publicStatus ?? "Na upit";
}
