import Image from "next/image";
import Link from "next/link";
import { BrandLogoMark } from "@/components/brand/BrandLogoMark";
import type { CarsystemBrand, CarsystemProduct, PublicProgramGroup } from "@/lib/carsystem-data";
import { toDisplayImageSrc } from "@/lib/productImageDisplay";
import styles from "@/components/brand-program/BrandProgramPage.module.css";

const PLACEHOLDER_IMAGE = "/images/products/placeholder-product.svg";

/**
 * Do četiri proizvoda sa fotografijom iz kataloga, po jedan iz svakog programa pa
 * redom kataloga — zaglavlje pokazuje stvarnu ponudu umesto ploče sa nazivom brenda.
 */
function heroProducts(products: CarsystemProduct[]) {
  const pictured = products.filter(
    (product) => product.productImage?.src && product.productImage.src !== PLACEHOLDER_IMAGE,
  );
  const picked: CarsystemProduct[] = [];
  const programs = new Set<string>();
  for (const product of pictured) {
    if (picked.length < 4 && !programs.has(product.programSlug)) {
      picked.push(product);
      programs.add(product.programSlug);
    }
  }
  for (const product of pictured) {
    if (picked.length < 4 && !picked.includes(product)) picked.push(product);
  }
  return picked;
}

export function BrandHero({
  brand,
  programs,
  products = [],
}: {
  brand: CarsystemBrand;
  programs: PublicProgramGroup[];
  products?: CarsystemProduct[];
}) {
  const showcase = heroProducts(products);
  const positioning = brand.overview ?? brand.description;

  return (
    <>
      <nav className={styles.breadcrumb} aria-label="Putanja">
        <ol>
          <li>
            <Link href="/">Početna</Link>
            <span className={styles.breadcrumbSeparator} aria-hidden="true">
              /
            </span>
          </li>
          <li>
            <Link href="/brendovi">Brendovi</Link>
            <span className={styles.breadcrumbSeparator} aria-hidden="true">
              /
            </span>
          </li>
          <li className={styles.breadcrumbCurrent} aria-current="page">
            {brand.name}
          </li>
        </ol>
      </nav>

      <section className={`${styles.hero} ${styles.brandHero}`} aria-labelledby="brand-title">
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>{brand.presentation.heroKicker}</p>
          <h1 id="brand-title" className={styles.title}>
            {brand.name}
          </h1>
          <p className={styles.heroLead}>{positioning}</p>
          <p className={styles.subtitle}>{brand.description}</p>

          <div className={styles.badgeRow} aria-label="Pregled brenda">
            <span className={styles.badge}>{programs.length} programa</span>
            <span className={styles.availabilityChip}>Dostupnost na upit</span>
          </div>

          <div className={styles.heroActions}>
            <Link
              className={styles.primaryButton}
              href="#brand-products"
            >
              {brand.presentation.productsCtaLabel}
            </Link>
            <Link className={styles.secondaryButton} href={brand.routes.contact}>
              {brand.presentation.contactCtaLabel}
            </Link>
            <Link className={styles.ghostButton} href="/prodavnice">
              Pronađite prodavnicu
            </Link>
          </div>
        </div>

        <div className={styles.heroVisual}>
          {showcase.length >= 2 ? (
            <div className={styles.productStage} data-count={showcase.length}>
              {showcase.map((product) => (
                <Link href={`/proizvodi/${product.slug}`} key={product.slug}>
                  <Image
                    src={toDisplayImageSrc(product.productImage!.src)}
                    alt={product.productImage!.alt || product.name}
                    fill
                    sizes="(min-width: 64rem) 16vw, 44vw"
                    priority
                  />
                  <span>{product.name}</span>
                </Link>
              ))}
              <p className={styles.productStageMeta}>{brand.name} u ponudi Carsystem i R-M</p>
            </div>
          ) : (
          <div className={styles.logoStage}>
            <div className={styles.logoChip}>
              <BrandLogoMark
                brand={brand}
                alt={`Logo brenda ${brand.name}`}
                routeCritical
                tone="onLight"
                width={320}
                height={190}
                className={styles.logoImage}
                priority
              />
            </div>
            <p className={styles.logoStageMeta}>Brend u ponudi Carsystem i R-M</p>
          </div>
          )}
        </div>
      </section>
    </>
  );
}
