import { CatalogProductCard } from "@/components/catalog/CatalogProductCard";
import type { Ref } from "react";
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
  gridRef,
  onReset,
  phaseBySlug,
  preloadTriggerIndex,
  preloadTriggerRef,
  products,
  programBySlug,
  resultCount,
  shownCount,
}: {
  brandBySlug: Map<string, CarsystemBrand>;
  gridRef: Ref<HTMLDivElement>;
  onReset: () => void;
  phaseBySlug: Map<RefinishPhaseSlug, RefinishPhase>;
  preloadTriggerIndex: number;
  preloadTriggerRef: Ref<HTMLAnchorElement>;
  products: CarsystemProduct[];
  programBySlug: Map<string, ProgramGroup>;
  resultCount: number;
  shownCount: number;
}) {
  const resultLabel =
    shownCount === resultCount
      ? `Prikazano ${resultCount} proizvoda`
      : `Prikazano ${shownCount} od ${resultCount} proizvoda`;

  return (
    <div className={styles.results}>
      <p className="sr-only" role="status" aria-atomic="true" aria-live="polite">
        {resultLabel}
      </p>

      {products.length > 0 ? (
        <div className={styles.productGrid} ref={gridRef}>
          {products.map((product, index) => {
            const brand = brandBySlug.get(product.brandSlug);
            const program = programBySlug.get(product.programSlug);
            const phase = phaseBySlug.get(product.phaseSlug);

            if (!brand || !program || !phase) return null;

            return (
              <CatalogProductCard
                brand={brand}
                key={product.slug}
                phase={phase}
                preloadRef={index === preloadTriggerIndex ? preloadTriggerRef : undefined}
                product={product}
                program={program}
              />
            );
          })}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <p className={styles.kicker}>Nema rezultata</p>
          <h3>Za izabranu kombinaciju filtera trenutno nema proizvoda.</h3>
          <p className={styles.emptyStateHint}>
            Promenite filtere ili pošaljite upit našem timu za materijal koji vam treba.
          </p>
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
