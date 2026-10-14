import {
  getProductPublicStatus,
  getRefinishPhaseBySlug,
  type CarsystemBrand,
  type CarsystemProduct,
  type ProgramGroup,
} from "@/lib/carsystem-data";
import { formatMeasureSr } from "@/lib/measure-format.mjs";
import styles from "./ProductDetailPage.module.css";
import { publicSkuOf } from "@/lib/catalog/public-code";

export function ProductReferenceDetails({
  brand,
  product,
  program,
}: {
  brand: CarsystemBrand;
  product: CarsystemProduct;
  program: ProgramGroup;
}) {
  const phase = getRefinishPhaseBySlug(product.phaseSlug);
  const packageSummary = formatMeasureSr(product.packages.map((item) => item.label).join(" / "));
  const rows = [
    ["Brend", brand.name],
    ["Program", program.name],
    ["Faza", phase?.name ?? product.phaseSlug],
    ["Šifra", product.publicCode ?? publicSkuOf(product)],
    ["Pakovanje", packageSummary],
    ["Status", getProductPublicStatus(product)],
  ].filter(([, value]) => Boolean(value));

  return (
    <section className={styles.section} aria-labelledby="product-reference-details-title">
      <div className={styles.sectionHeader}>
        <p className={styles.sectionKicker}>Radna referenca</p>
        <h2 id="product-reference-details-title" className={styles.sectionTitle}>
          Osnovni podaci proizvoda
        </h2>
      </div>

      <div className={styles.referenceDetailGrid}>
        <article className={styles.referenceCopyPanel}>
          {product.purpose ? (
            <>
              <strong>Namena</strong>
              <p>{product.purpose}</p>
            </>
          ) : null}
          {product.longDescription || product.shortDescription ? (
            <>
              <strong>Opis</strong>
              <p>{product.longDescription || product.shortDescription}</p>
            </>
          ) : null}
        </article>

        <dl className={styles.referenceFactPanel}>
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
