import { CatalogProductCard } from "@/components/catalog/CatalogProductCard";
import type {
  CarsystemBrand,
  CarsystemProduct,
  ProgramGroup,
  RefinishPhase,
  RefinishPhaseSlug,
} from "@/lib/carsystem-data";
import styles from "./CatalogPage.module.css";

export function CatalogProductGrid({
  brandBySlug,
  onReset,
  phaseBySlug,
  products,
  programBySlug,
  resultCount,
  shownCount,
  totalCount,
}: {
  brandBySlug: Map<string, CarsystemBrand>;
  onReset: () => void;
  phaseBySlug: Map<RefinishPhaseSlug, RefinishPhase>;
  products: CarsystemProduct[];
  programBySlug: Map<string, ProgramGroup>;
  resultCount: number;
  shownCount: number;
  totalCount: number;
}) {
  const resultLabel =
    shownCount === resultCount
      ? `Prikazano ${resultCount} proizvoda`
      : `Prikazano ${shownCount} od ${resultCount} proizvoda`;

  return (
    <div className={styles.results}>
      <div className={styles.resultsHeader}>
        <div>
          <p className={styles.kicker}>Rezultati</p>
          <h2>{resultLabel}</h2>
        </div>
        <span>{totalCount} ukupno u katalogu</span>
      </div>

      {products.length > 0 ? (
        <div className={styles.productGrid}>
          {products.map((product) => {
            const brand = brandBySlug.get(product.brandSlug);
            const program = programBySlug.get(product.programSlug);
            const phase = phaseBySlug.get(product.phaseSlug);

            if (!brand || !program || !phase) return null;

            return (
              <CatalogProductCard
                brand={brand}
                key={product.slug}
                phase={phase}
                product={product}
                program={program}
              />
            );
          })}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <p className={styles.kicker}>Nema rezultata</p>
          <h3>Nema proizvoda za izabrane filtere.</h3>
          <button
            className={`${styles.primaryButton} cs-magnetic-cta cs-theme-wipe-card`}
            type="button"
            data-cursor="button"
            data-motion-surface
            data-motion="theme-wipe"
            onClick={onReset}
          >
            <span>Resetuj filtere</span>
          </button>
        </div>
      )}
    </div>
  );
}
