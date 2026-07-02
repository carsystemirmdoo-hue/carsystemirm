import type { CarsystemProduct } from "@/lib/carsystem-data";
import { refinishPhases } from "@/lib/carsystem-data";
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

      <div className={styles.processTrack} aria-label="Faze refinish procesa">
        {refinishPhases.map((phase) => {
          const isActive = phase.slug === product.phaseSlug;
          return (
            <div
              className={`${styles.phaseItem} ${isActive ? styles.phaseActive : ""}`}
              aria-current={isActive ? "step" : undefined}
              key={phase.slug}
            >
              <span className={styles.phaseIndex}>{phase.step}</span>
              <span className={styles.phaseName}>{phase.name}</span>
              <p className={styles.phaseDescription}>{phase.description}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
