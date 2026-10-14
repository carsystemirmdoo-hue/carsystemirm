import { EntityProductFilters } from "@/components/brand-program/EntityProductFilters";
import { withListingHref } from "@/lib/listing-href";
import type {
  CarsystemBrand,
  CarsystemProduct,
  ProgramGroup,
  RefinishPhase,
} from "@/lib/carsystem-data";
import styles from "@/components/brand-program/BrandProgramPage.module.css";

export function ProgramProducts({
  brandBySlug,
  phaseBySlug,
  products,
  programBySlug,
}: {
  brandBySlug: Map<string, CarsystemBrand>;
  phaseBySlug: Map<string, RefinishPhase>;
  products: CarsystemProduct[];
  programBySlug: Map<string, ProgramGroup>;
}) {
  return (
    <section
      id="products-list"
      className={styles.section}
      aria-labelledby="program-products-title"
    >
      <div className={styles.sectionHeader}>
        <p className={styles.sectionKicker}>Proizvodi</p>
        <h2 id="program-products-title">Tehnički proizvodi u programu</h2>
        <p>
          Svaki proizvod vodi na stranicu sa namenom, dokumentacijom i upitom.
        </p>
      </div>

      <EntityProductFilters
        brands={Array.from(brandBySlug.values())}
        contextLabel="Program"
        idPrefix="program-products"
        phases={Array.from(phaseBySlug.values())}
        products={withListingHref(products)}
        programs={Array.from(programBySlug.values())}
      />
    </section>
  );
}
