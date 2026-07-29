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
  CarsystemProduct,
  ProgramGroup,
  RefinishPhase,
} from "@/lib/carsystem-data";
import styles from "./CatalogPage.module.css";

export function CatalogPage({
  products,
  brands,
  programs,
  phases,
}: {
  products: CarsystemProduct[];
  brands: CarsystemBrand[];
  programs: ProgramGroup[];
  phases: RefinishPhase[];
}) {
  const firstPageProducts = products.slice(0, CATALOG_BATCH_SIZE);
  const totalPages = Math.ceil(products.length / CATALOG_BATCH_SIZE);

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
                phases={phases}
                products={firstPageProducts}
                programs={programs}
              />
              <CatalogPaginationNav currentPage={1} totalPages={totalPages} />
            </>
          }
        >
          <CatalogExplorer
            products={products}
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
