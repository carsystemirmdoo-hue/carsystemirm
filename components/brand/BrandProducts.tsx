import Link from "next/link";
import { EntityProductFilters } from "@/components/brand-program/EntityProductFilters";
import type {
  CarsystemBrand,
  CarsystemProduct,
  ProgramGroup,
  RefinishPhase,
} from "@/lib/carsystem-data";
import styles from "@/components/brand-program/BrandProgramPage.module.css";

export function BrandProducts({
  brand,
  brandBySlug,
  phaseBySlug,
  products,
  programBySlug,
}: {
  brand: CarsystemBrand;
  brandBySlug: Map<string, CarsystemBrand>;
  phaseBySlug: Map<string, RefinishPhase>;
  products: CarsystemProduct[];
  programBySlug: Map<string, ProgramGroup>;
}) {
  return (
    <section id="brand-products" className={styles.section} aria-labelledby="brand-products-title">
      <div className={styles.sectionHeader}>
        <p className={styles.sectionKicker}>Proizvodi</p>
        <h2 id="brand-products-title">{brand.name} proizvodi</h2>
        <p>
          Pregled vodi na postojeće stranice proizvoda. Za dostupnost i tehnički izbor
          pošaljite upit timu Carsystem i R-M.
        </p>
      </div>

      <EntityProductFilters
        brands={Array.from(brandBySlug.values())}
        contextLabel={brand.name}
        fixedBrandSlug={brand.slug}
        idPrefix={`brand-${brand.slug}`}
        phases={Array.from(phaseBySlug.values())}
        products={products}
        programs={Array.from(programBySlug.values())}
        showQuickPhaseFilters
      />

      <div className={styles.brandCatalogCta}>
        <Link className={styles.secondaryButton} href={brand.routes.catalog}>
          Pogledajte sve proizvode
        </Link>
      </div>
    </section>
  );
}
