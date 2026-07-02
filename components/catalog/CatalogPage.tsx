import { Suspense } from "react";
import { CatalogExplorer } from "@/components/catalog/CatalogExplorer";
import { CatalogSkeletonGrid } from "@/components/catalog/CatalogSkeletonGrid";
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
  return (
    <div className={styles.catalogShell}>
      <Suspense
        fallback={
          <main className={styles.main} aria-label="Učitavanje kataloga">
            <CatalogSkeletonGrid />
          </main>
        }
      >
        <CatalogExplorer
          products={products}
          brands={brands}
          programs={programs}
          phases={phases}
        />
      </Suspense>
      <Footer />
    </div>
  );
}
