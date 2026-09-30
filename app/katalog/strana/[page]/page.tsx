import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Footer } from "@/components/layout/Footer";
import {
  CatalogHero,
  CatalogPaginationNav,
  CatalogStaticProductGrid,
} from "@/components/catalog/CatalogSeoContent";
import { CATALOG_BATCH_SIZE } from "@/components/catalog/catalogInfiniteScroll.mjs";
import { SeoBreadcrumbs } from "@/components/seo/SeoBreadcrumbs";
import {
  getAllCarsystemBrands,
  programGroups,
  refinishPhases,
} from "@/lib/carsystem-data";
import { getCatalogListingData } from "@/lib/catalog-listing";
import { withProductFitModel } from "@/lib/product-fit-model";
import {
  breadcrumbJsonLd,
  collectionPageJsonLd,
  jsonLd,
  pageMetadata,
} from "@/lib/seo";
import styles from "@/components/catalog/CatalogPage.module.css";

type CatalogPaginationRouteProps = {
  params: Promise<{ page: string }>;
};

/*
 * Paginacija hoda kanonskim entitetima — porodicama i samostalnim proizvodima —
 * istim onim skupom koji `/katalog` već koristi za prvu stranu.
 *
 * Ranije je hodala sirovim `getAllCarsystemProducts()`, pa je svaka varijanta
 * `variant-pdp` porodice dobijala sopstvenu pločicu čiji link 307-uje na grupu.
 * Posledica je bila merljiva: 808 internih linkova na adresu koja preusmerava i
 * 31 od 48 ProductGroup stranica bez ijednog direktnog linka, iako su upravo one
 * kanonski entitet u sitemapu i canonical oznakama.
 *
 * Kanonski skup je istovremeno tačno univerzum koji sitemap objavljuje
 * (754 samostalna proizvoda + 48 porodica), pa puzanje i sitemap opisuju isti
 * entitet.
 */
function getCanonicalEntities() {
  return getCatalogListingData().canonical;
}

function getTotalPages() {
  return Math.ceil(getCanonicalEntities().length / CATALOG_BATCH_SIZE);
}

function parsePage(value: string) {
  const page = Number.parseInt(value, 10);
  return Number.isInteger(page) && page >= 2 && page <= getTotalPages()
    ? page
    : null;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return Array.from({ length: Math.max(0, getTotalPages() - 1) }, (_, index) => ({
    page: String(index + 2),
  }));
}

export async function generateMetadata({
  params,
}: CatalogPaginationRouteProps): Promise<Metadata> {
  const { page: rawPage } = await params;
  const page = parsePage(rawPage);
  if (!page) return {};

  return pageMetadata({
    title: `Katalog proizvoda, strana ${page}`,
    description: `Crawlable pregled Carsystem i R-M kataloga, strana ${page} od ${getTotalPages()}. Otvorite proizvode i pošaljite upit za dostupnost.`,
    path: `/katalog/strana/${page}`,
    imageAlt: `Katalog Carsystem i R-M proizvoda, strana ${page}`,
  });
}

export default async function CatalogPaginationRoute({
  params,
}: CatalogPaginationRouteProps) {
  const { page: rawPage } = await params;
  const page = parsePage(rawPage);
  if (!page) notFound();

  const allEntities = getCanonicalEntities();
  const totalPages = getTotalPages();
  const start = (page - 1) * CATALOG_BATCH_SIZE;
  const products = withProductFitModel(
    allEntities.slice(start, start + CATALOG_BATCH_SIZE),
  );
  const brands = getAllCarsystemBrands();
  const route = `/katalog/strana/${page}`;
  const breadcrumbs = [
    { name: "Početna", path: "/" },
    { name: "Katalog", path: "/katalog" },
    { name: `Strana ${page}`, path: route },
  ];

  return (
    <div className={styles.catalogShell}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(breadcrumbJsonLd(breadcrumbs))}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(
          collectionPageJsonLd({
            name: `Katalog proizvoda, strana ${page}`,
            description: `Proizvodi ${start + 1}–${start + products.length} u Carsystem i R-M katalogu.`,
            path: route,
            itemUrls: products.map((product) => product.href),
          }),
        )}
      />
      <main className={styles.main}>
        <SeoBreadcrumbs items={breadcrumbs} />
        <CatalogHero
          brandCount={brands.length}
          programCount={programGroups.length}
          showSearch={false}
        />
        <CatalogStaticProductGrid
          brands={brands}
          phases={refinishPhases}
          entities={products}
          programs={programGroups}
        />
        <CatalogPaginationNav currentPage={page} totalPages={totalPages} />
      </main>
      <Footer />
    </div>
  );
}
