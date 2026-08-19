import { Suspense } from "react";
import { CatalogExplorer } from "@/components/catalog/CatalogExplorer";
import {
  CatalogCategoryLinks,
  CatalogHero,
  CatalogPaginationNav,
  CatalogStaticProductGrid,
} from "@/components/catalog/CatalogSeoContent";
import { CATALOG_BATCH_SIZE } from "@/components/catalog/catalogInfiniteScroll.mjs";
import { Footer } from "@/components/layout/Footer";
import type {
  CarsystemBrand,
  ProgramGroup,
  RefinishPhase,
} from "@/lib/carsystem-data";
import type { CatalogListingEntity } from "@/lib/catalog-listing";
import styles from "./CatalogPage.module.css";

export function CatalogPage({
  canonical,
  brands,
  programs,
  phases,
}: {
  canonical: CatalogListingEntity[];
  brands: CarsystemBrand[];
  programs: ProgramGroup[];
  phases: RefinishPhase[];
}) {
  const firstPageProducts = canonical.slice(0, CATALOG_BATCH_SIZE);
  const totalPages = Math.ceil(canonical.length / CATALOG_BATCH_SIZE);

  return (
    <div className={styles.catalogShell}>
      <main className={styles.main}>
        <CatalogHero brandCount={brands.length} programCount={programs.length} />
        <CatalogCategoryLinks />
        <Suspense
          fallback={
            <>
              <CatalogStaticProductGrid
                brands={brands}
                entities={firstPageProducts}
                phases={phases}
                programs={programs}
              />
              <CatalogPaginationNav currentPage={1} totalPages={totalPages} />
            </>
          }
        >
          <CatalogExplorer
            canonical={canonical}
            brands={brands}
            programs={programs}
            phases={phases}
          />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
