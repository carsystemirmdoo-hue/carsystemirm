import Link from "next/link";
import {
  getProductPublicStatus,
  getRefinishPhaseBySlug,
  type CarsystemBrand,
  type CarsystemProduct,
  type ProgramGroup,
} from "@/lib/carsystem-data";
import { ProductGallery } from "@/components/product/ProductGallery";
import { ProductInquiryCard } from "@/components/product/ProductInquiryCard";
import { SplitContactCta } from "@/components/ui/SplitContactCta";
import styles from "./ProductDetailPage.module.css";

export function ProductHero({
  product,
  brand,
  program,
}: {
  product: CarsystemProduct;
  brand: CarsystemBrand;
  program: ProgramGroup;
}) {
  const packageSummary = product.packages.map((item) => item.label).join(" / ");
  const phase = getRefinishPhaseBySlug(product.phaseSlug);
  const publicStatus = getProductPublicStatus(product);
  const factRows = [
    ["Program", program.name],
    ["Faza", phase?.name ?? product.phaseSlug],
    ["Šifra", product.sku],
    ["Pakovanje", packageSummary],
    ["Namena", product.purpose],
    ["Brend", brand.name],
  ].filter(([, value]) => Boolean(value));

  return (
    <section className={styles.heroSection} aria-labelledby="product-title">
      <div className={styles.heroGrid}>
        <ProductGallery product={product} brand={brand} />

        <div className={styles.heroPanel}>
          <div className={styles.eyebrowRow}>
            <span className={styles.pill}>{brand.name}</span>
            <span className={styles.pill}>{program.shortName}</span>
            <span className={styles.pill}>{phase?.name ?? product.phaseSlug}</span>
            {product.badges
              .filter((badge) => badge !== "Na upit")
              .slice(0, 1)
              .map((badge) => (
                <span className={styles.pill} key={badge}>
                  {badge}
                </span>
              ))}
          </div>

          <h1 id="product-title" className={styles.title} data-cursor="headline">
            {product.name}
          </h1>
          <p className={styles.brandLine}>
            Brend:{" "}
            <Link href={brand.routes.landing}>
              <strong>{brand.name}</strong>
            </Link>
          </p>
          <p className={styles.shortDescription} data-cursor="text">{product.shortDescription}</p>

          <div className={styles.statusLine} aria-label="Status proizvoda">
            <span>Status</span>
            <strong>{publicStatus}</strong>
          </div>

          <dl className={styles.metaGrid}>
            {factRows.map(([label, value]) => (
              <div className={styles.metaItem} key={label}>
                <dt className={styles.metaLabel}>{label}</dt>
                <dd className={styles.metaValue}>{value}</dd>
              </div>
            ))}
          </dl>

          <div className={styles.ctaRow}>
            <SplitContactCta inquiryHref={`/kontakt?tema=proizvod&proizvod=${product.slug}`} />
            <Link
              className={`${styles.secondaryAction} cs-interactive-surface`}
              href="/prodavnice"
              data-cursor="button"
              data-motion-surface
            >
              Pronađite prodavnicu
            </Link>
            <Link
              className={`${styles.tertiaryAction} cs-interactive-surface`}
              href="/kontakt?tema=tehnicka-podrska"
              data-cursor="button"
              data-motion-surface
            >
              Tehnička podrška
            </Link>
          </div>
        </div>

        <div className={styles.heroInquiry}>
          <ProductInquiryCard product={product} />
        </div>
      </div>
    </section>
  );
}
