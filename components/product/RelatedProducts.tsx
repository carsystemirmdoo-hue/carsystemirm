import Link from "next/link";
import {
  getCarsystemBrandBySlug,
  getProductPublicStatus,
  getProgramGroupBySlug,
  getRefinishPhaseBySlug,
  type CarsystemProduct,
} from "@/lib/carsystem-data";
import { ProductVisualSurface } from "@/components/product/ProductVisualSurface";
import styles from "./ProductDetailPage.module.css";
import { productCanonicalHref } from "@/lib/product-families";

export function RelatedProducts({
  products,
}: {
  products: CarsystemProduct[];
}) {
  if (products.length === 0) return null;

  return (
    <section className={styles.relatedSection} aria-labelledby="related-products-title">
      <div className={styles.sectionHeader}>
        <p className={styles.sectionKicker}>Povezani proizvodi</p>
        <h2 id="related-products-title" className={styles.sectionTitle}>
          Sledeći koraci u katalogu
        </h2>
        <p className={styles.sectionText}>
          Predlozi kombinuju isti brend, program ili sličnu fazu refinish procesa.
        </p>
      </div>

      <div className={styles.relatedGrid}>
        {products.map((product) => {
          const brand = getCarsystemBrandBySlug(product.brandSlug);
          const program = getProgramGroupBySlug(product.programSlug);
          const phase = getRefinishPhaseBySlug(product.phaseSlug);
          const image = product.productImage ?? product.galleryImages[0] ?? null;
          const productHref = productCanonicalHref(product);
          const inquiryHref = `/kontakt?tema=proizvod&proizvod=${product.slug}`;
          const packageSummary = product.packages.map((item) => item.label).join(" / ");
          const publicStatus = getProductPublicStatus(product);

          return (
            <article
              className={`${styles.relatedCard} cs-product-motion-card`}
              key={product.slug}
              data-cursor="card"
              data-motion-surface
              data-product-card-motion
            >
              <Link
                className={styles.relatedImageFrame}
                href={productHref}
                aria-label={`Pogledaj proizvod ${product.name}`}
                data-cursor="image"
              >
                <ProductVisualSurface
                  brandName={brand?.name ?? "Carsystem"}
                  image={image}
                  product={product}
                  sizes="(min-width: 1180px) 22vw, (min-width: 768px) 33vw, 88vw"
                />
              </Link>
              <div className={styles.relatedBody}>
                <span className={styles.relatedMeta}>
                  {[brand?.name, program?.shortName, phase?.name].filter(Boolean).join(" / ")}
                </span>
                <h3 className={styles.relatedName}>
                  <Link href={productHref}>{product.name}</Link>
                </h3>
                <p className={styles.relatedText}>{product.shortDescription}</p>
                <div className={styles.relatedDataGrid}>
                  <span>
                    <small>Pakovanje</small>
                    <strong>{packageSummary}</strong>
                  </span>
                  <span>
                    <small>Status</small>
                    <strong>{publicStatus}</strong>
                  </span>
                </div>
                <div className={styles.relatedActions}>
                  <Link
                    className={`${styles.relatedPrimaryAction} cs-magnetic-cta cs-theme-wipe-card`}
                    href={inquiryHref}
                    data-cursor="button"
                    data-motion-surface
                    data-motion="theme-wipe"
                  >
                    <span>Pošalji upit</span>
                  </Link>
                  <Link className={`${styles.relatedDetailLink} cs-link-reveal`} href={productHref} data-cursor="link">
                    Detalji →
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
