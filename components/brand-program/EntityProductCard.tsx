import Link from "next/link";
import {
  getProductPublicStatus,
  type CarsystemBrand,
  type CarsystemProduct,
  type ProgramGroup,
  type RefinishPhase,
} from "@/lib/carsystem-data";
import { ProductVisualSurface } from "@/components/product/ProductVisualSurface";
import styles from "./BrandProgramPage.module.css";
import { productCanonicalHref } from "@/lib/product-families";

export function EntityProductCard({
  brand,
  phase,
  product,
  program,
}: {
  brand: CarsystemBrand;
  phase: RefinishPhase;
  product: CarsystemProduct;
  program: ProgramGroup;
}) {
  const image = product.productImage ?? product.galleryImages[0] ?? null;
  const packageSummary = product.packages.map((item) => item.label).join(" / ");
  const publicStatus = getProductPublicStatus(product);
  const productHref = productCanonicalHref(product);
  const inquiryHref = `/kontakt?tema=proizvod&proizvod=${product.slug}`;

  return (
    <article
      className={`${styles.productCard} cs-product-motion-card`}
      data-cursor="card"
      data-motion-surface
      data-product-card-motion
    >
      <Link
        className={styles.productMedia}
        href={productHref}
        aria-label={`Pogledaj proizvod ${product.name}`}
        data-cursor="image"
      >
        <ProductVisualSurface
          brandName={brand.name}
          image={image}
          product={product}
          sizes="(min-width: 1180px) 28vw, (min-width: 768px) 44vw, 92vw"
        />
      </Link>

      <div className={styles.productBody}>
        <p className={styles.productMetaLine}>
          {brand.name} · {program.shortName} · {phase.name}
        </p>

        <Link href={productHref}>
          <h3 className={styles.productTitle}>{product.name}</h3>
        </Link>
        <p className={styles.productPurpose}>{product.purpose}</p>

        <div className={styles.productDataGrid}>
          <span>
            <small>Pakovanje</small>
            <strong>{packageSummary}</strong>
          </span>
          <span>
            <small>Status</small>
            <strong>{publicStatus}</strong>
          </span>
        </div>

        <div className={styles.productActions}>
          <Link
            className={`${styles.primaryButton} cs-magnetic-cta cs-theme-wipe-card`}
            href={inquiryHref}
            aria-label={`Pošalji upit za proizvod: ${product.name}`}
            data-cursor="button"
            data-motion-surface
            data-motion="theme-wipe"
          >
            <span>Pošalji upit</span>
          </Link>
          <Link className={`${styles.detailLink} cs-link-reveal`} href={productHref} data-cursor="link">
            Detalji →
          </Link>
        </div>
      </div>
    </article>
  );
}
