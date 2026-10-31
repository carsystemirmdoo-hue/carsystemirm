import "server-only";

import { getAllCarsystemProducts, getCarsystemBrandBySlug } from "@/lib/carsystem-data";
import { getPublicDocuments, type BrandDocument } from "@/lib/documents";

/**
 * Biblioteka „Katalog i tehnički listovi“ (2026-10-30).
 *
 * Jedan izvor za brojače, filtere i rezultate: dokumenti proizvoda iz kataloga (isti zapisi
 * kao na stranici proizvoda) i dokumenti brendova sa /katalozi. Jedan fajl = jedna stavka,
 * bez obzira na to uz koliko proizvoda stoji; veze ka proizvodima su posebno polje.
 */

export type LibraryDocType = "tds" | "sds" | "informacije" | "uputstvo" | "izjava" | "katalog" | "ostalo";

export const LIBRARY_TYPE_LABELS: Record<LibraryDocType, string> = {
  tds: "Tehnički list",
  sds: "Bezbednosni list",
  informacije: "Informacije o proizvodu",
  uputstvo: "Uputstvo",
  izjava: "Izjava ili sertifikat",
  katalog: "Katalog ili brošura",
  ostalo: "Drugi dokument",
};

export type LibraryItem = {
  id: string;
  type: LibraryDocType;
  title: string;
  href: string;
  /** Fajl je na sajtu proizvođača, ne na našem sajtu. */
  external: boolean;
  /**
   * Veza vodi na stranicu proizvoda kod proizvođača, a ne direktno na fajl: SATA menja adrese
   * fajlova (`/media/…?ts=`), pa sačuvana adresa posle nekog vremena vraća 404 (2026-10-31: 66/66).
   */
  viaProductPage?: boolean;
  brands: { slug: string; name: string }[];
  /** Prvih nekoliko proizvoda uz dokument. */
  products: { name: string; href: string }[];
  productCount: number;
  /** Tekst za pretragu (naziv, šifre, proizvodi), mala slova. */
  search: string;
};

export type LibraryData = {
  items: LibraryItem[];
  /** Proizvodi iz kataloga bez ijednog dokumenta dostupnog na sajtu. */
  productsWithoutDocument: number;
  productCount: number;
};

function classify(title: string, href: string): LibraryDocType {
  const text = `${title} ${href}`.toLowerCase();
  if (/bezbednosn|safety|\bsds\b|msds|sicherheits/.test(text)) return "sds";
  if (/tehni[čc]k|technical|\btds\b|technische/.test(text)) return "tds";
  if (/uputstv|manual|instruction|anleitung|bedienungs/.test(text)) return "uputstvo";
  if (/izjav|declaration|certif|sertif|konformit/.test(text)) return "izjava";
  if (/informacij|product information|produktinformation/.test(text)) return "informacije";
  if (/katalog|catalog|bro[šs]ur|brochure/.test(text)) return "katalog";
  return "ostalo";
}

function brandDocumentType(document: BrandDocument): LibraryDocType {
  if (document.type === "catalog" || document.type === "family-brochure" || document.type === "product-brochure" || document.type === "campaign") return "katalog";
  return "uputstvo";
}

const PRODUCTS_SHOWN = 4;

/** Reči za pretragu bez ponavljanja (varijante istog proizvoda dele većinu reči). */
function searchText(parts: string[]): string {
  return [...new Set(parts.join(" ").toLowerCase().split(/\s+/).filter(Boolean))].join(" ");
}
let cached: LibraryData | undefined;

export function getDocumentLibrary(): LibraryData {
  if (cached) return cached;
  const byHref = new Map<string, LibraryItem & { productNames: string[] }>();
  const products = getAllCarsystemProducts();
  let productsWithoutDocument = 0;

  for (const product of products) {
    const available = (product.documents ?? []).filter((document) => document.status === "available" && document.href);
    if (available.length === 0) productsWithoutDocument += 1;
    const brand = getCarsystemBrandBySlug(product.brandSlug);
    for (const document of available) {
      const href = document.href as string;
      // Kada `href` vodi na stranicu proizvoda (SATA), isti fajl više proizvoda spaja `documentKey`.
      const key = document.documentKey ?? href;
      let item = byHref.get(key);
      if (!item) {
        item = {
          id: key,
          type: classify(document.title, document.documentKey ?? href),
          title: document.title,
          href,
          external: !href.startsWith("/"),
          ...(document.viaProductPage ? { viaProductPage: true } : {}),
          brands: [],
          products: [],
          productCount: 0,
          search: "",
          productNames: [],
        };
        byHref.set(key, item);
      }
      if (brand && !item.brands.some((entry) => entry.slug === brand.slug)) item.brands.push({ slug: brand.slug, name: brand.name });
      item.productCount += 1;
      item.productNames.push(product.name, product.manufacturerCode ?? "", product.sku ?? "");
      if (item.products.length < PRODUCTS_SHOWN) item.products.push({ name: product.name, href: `/proizvodi/${product.slug}` });
    }
  }

  const items: LibraryItem[] = [...byHref.values()].map(({ productNames, ...item }) => ({
    ...item,
    // Naziv dokumenta je opšti („Tehnički list“), pa stavku imenuje prvi proizvod uz nju.
    title: item.products[0] ? `${item.title} — ${item.products[0].name}` : item.title,
    search: searchText([item.title, ...productNames, ...item.brands.map((brand) => brand.name)]),
  }));

  for (const document of getPublicDocuments()) {
    if (byHref.has(document.file)) continue;
    const brands = document.brands
      .map((slug) => getCarsystemBrandBySlug(slug))
      .filter((brand): brand is NonNullable<typeof brand> => Boolean(brand))
      .map((brand) => ({ slug: brand.slug, name: brand.name }));
    items.push({
      id: document.file,
      type: brandDocumentType(document),
      title: document.title,
      href: document.file,
      external: !document.file.startsWith("/"),
      brands,
      products: [],
      productCount: 0,
      search: searchText([document.title, ...(document.productCodes ?? []), ...brands.map((brand) => brand.name)]),
    });
  }

  const typeOrder: LibraryDocType[] = ["tds", "sds", "informacije", "uputstvo", "izjava", "katalog", "ostalo"];
  items.sort(
    (first, second) =>
      typeOrder.indexOf(first.type) - typeOrder.indexOf(second.type) ||
      (first.brands[0]?.name ?? "").localeCompare(second.brands[0]?.name ?? "", "sr") ||
      first.title.localeCompare(second.title, "sr"),
  );

  cached = { items, productsWithoutDocument, productCount: products.length };
  return cached;
}
