import Image from "next/image";
import Link from "next/link";
import {
  getProductPublicStatus,
  type CarsystemBrand,
  type CarsystemProduct,
  type ProgramGroup,
  type RefinishPhase,
} from "@/lib/carsystem-data";
import { getProductMotionStyle } from "@/components/product/productMotion";
import styles from "./BrandProgramPage.module.css";

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
  const usesStructuredShot = !image || image.src.includes("placeholder-product");
  const packageSummary = product.packages.map((item) => item.label).join(" / ");
  const publicStatus = getProductPublicStatus(product);
  const productHref = `/proizvodi/${product.slug}`;
  const inquiryHref = `/kontakt?tema=proizvod&proizvod=${product.slug}`;

  return (
    <article
      className={`${styles.productCard} cs-gloss-card cs-product-motion-card`}
      data-cursor="card"
      data-motion-surface
      data-product-card-motion
      style={getProductMotionStyle(product)}
    >
      <Link
        className={`${styles.productMedia} cs-image-surface`}
        href={productHref}
        aria-label={`Pogledaj proizvod ${product.name}`}
        data-cursor="image"
        data-motion-surface
        data-product-image-motion
      >
        <span className={styles.productBrand}>{brand.name}</span>
        {!usesStructuredShot && image ? (
          <Image
            src={image.src}
            alt={image.alt}
            fill
            sizes="(min-width: 1180px) 28vw, (min-width: 768px) 44vw, 92vw"
            className={styles.productImage}
          />
        ) : (
          <span className={styles.productShotPlaceholder}>
            <small>PRODUCT SHOT</small>
            <strong>{brand.name}</strong>
            <span>{product.name}</span>
            <em>studio · seamless grey</em>
          </span>
        )}
      </Link>

      <div className={styles.productBody}>
        <p className={styles.productMetaLine}>
          {program.shortName} · {phase.name}
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
