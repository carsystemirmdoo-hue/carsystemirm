import Image from "next/image";
import Link from "next/link";
import {
  getCarsystemBrandBySlug,
  getProductPublicStatus,
  getProgramGroupBySlug,
  type CarsystemProduct,
} from "@/lib/carsystem-data";
import { getProductMotionStyle } from "@/components/product/productMotion";
import styles from "./ProductDetailPage.module.css";

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
          const image = product.productImage ?? product.galleryImages[0] ?? null;
          const productHref = `/proizvodi/${product.slug}`;
          const inquiryHref = `/kontakt?tema=proizvod&proizvod=${product.slug}`;
          const packageSummary = product.packages.map((item) => item.label).join(" / ");
          const publicStatus = getProductPublicStatus(product);
          const usesStructuredShot =
            !image || image.src.includes("placeholder-product");

          return (
            <article
              className={`${styles.relatedCard} cs-gloss-card`}
              key={product.slug}
              data-cursor="card"
              data-motion-surface
              data-product-card-motion
              style={getProductMotionStyle(product)}
            >
              <Link
                className={`${styles.relatedImageFrame} cs-image-surface`}
                href={productHref}
                data-cursor="image"
                data-motion-surface
                data-product-image-motion
              >
                {usesStructuredShot ? (
                  <span className={styles.relatedShot}>
                    <small>PRODUCT SHOT</small>
                    <strong>{brand?.name ?? "Carsystem"}</strong>
                    <span>{product.name}</span>
                    <em>studio · seamless grey</em>
                  </span>
                ) : image ? (
                  <Image
                    src={image.src}
                    alt={image.alt}
                    fill
                    sizes="(min-width: 1180px) 22vw, (min-width: 768px) 33vw, 88vw"
                    className={styles.relatedImage}
                  />
                ) : (
                  <span className={styles.thumbnailFallback}>Proizvod</span>
                )}
              </Link>
              <div className={styles.relatedBody}>
                <span className={styles.relatedMeta}>
                  {[brand?.name, program?.shortName].filter(Boolean).join(" / ")}
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
                    className={`${styles.relatedPrimaryAction} cs-magnetic-cta`}
                    href={inquiryHref}
                    data-cursor="button"
                    data-motion-surface
                  >
                    Pošalji upit
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
