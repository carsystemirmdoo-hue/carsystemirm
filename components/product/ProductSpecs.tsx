import type { CarsystemProduct } from "@/lib/carsystem-data";
import styles from "./ProductDetailPage.module.css";

export function ProductSpecs({ product }: { product: CarsystemProduct }) {
  const rows = product.specifications.filter((spec) => spec.label && spec.value);

  if (rows.length === 0) return null;

  return (
    <section className={styles.section} aria-labelledby="product-specs-title">
      <div className={styles.sectionHeader}>
        <p className={styles.sectionKicker}>Tehnički podaci</p>
        <h2 id="product-specs-title" className={styles.sectionTitle}>
          Specifikacije za rad u radionici
        </h2>
        <p className={styles.sectionText}>
          Prikazuju se samo parametri koji postoje u podatku proizvoda. Zvanične
          vrednosti se kasnije povezuju kroz tehnički list.
        </p>
      </div>

      <dl className={styles.specTable}>
        {rows.map((spec) => (
          <div className={styles.specRow} key={`${spec.label}-${spec.value}`}>
            <dt>{spec.label}</dt>
            <dd>
              <strong>{spec.value}</strong>
              {spec.detail && <span>{spec.detail}</span>}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
