import type { CarsystemProduct } from "@/lib/carsystem-data";
import { ProcessRail } from "@/components/product/ProcessRail";
import styles from "./ProductDetailPage.module.css";

export function ProductProcessPhase({ product }: { product: CarsystemProduct }) {
  return (
    <section className={styles.section} aria-labelledby="product-process-title">
      <div className={styles.sectionHeader}>
        <p className={styles.sectionKicker}>Refinish proces</p>
        <h2 id="product-process-title" className={styles.sectionTitle}>
          Pozicija u procesu lakiranja
        </h2>
        <p className={styles.sectionText}>
          Aktivna faza je označena Carsystem crvenom bojom, ostale faze ostaju
          prigušene radi lakšeg skeniranja procesa.
        </p>
      </div>

      <ProcessRail activePhaseSlug={product.phaseSlug} />
    </section>
  );
}
