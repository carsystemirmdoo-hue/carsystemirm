import Image from "next/image";
import Link from "next/link";
import { countOf } from "@/lib/ordering/plural.mjs";
import { BrandLogoMark } from "@/components/brand/BrandLogoMark";
import type { CarsystemBrand, CarsystemProduct, PublicProgramGroup } from "@/lib/carsystem-data";
import { toDisplayImageSrc } from "@/lib/productImageDisplay";
import styles from "@/components/brand-program/BrandProgramPage.module.css";

const PROGRAM = ["program", "programa", "programa"] as const;

const PLACEHOLDER_IMAGE = "/images/products/placeholder-product.svg";

/**
 * Do četiri proizvoda sa fotografijom iz kataloga za zaglavlje: prvo oni čiji naziv
 * pominje uvod brenda (redom pominjanja), zatim po jedan iz svakog programa, pa redom
 * kataloga — zaglavlje pokazuje stvarnu ponudu umesto ploče sa nazivom brenda.
 */
function heroProducts(products: CarsystemProduct[], brandName: string, lead: string) {
  const pictured = products.filter(
    (product) => product.productImage?.src && product.productImage.src !== PLACEHOLDER_IMAGE,
  );
  const picked: CarsystemProduct[] = [];
  const add = (product: CarsystemProduct | undefined) => {
    if (product && picked.length < 4 && !picked.includes(product)) picked.push(product);
  };
  const tokens = lead.match(/\b(?=\w*[A-Z0-9])\w{4,}\b/g) ?? [];
  for (const token of tokens) {
    if (token.toLowerCase() === brandName.toLowerCase()) continue;
    add(pictured.find((product) => new RegExp(`\\b${token}\\b`, "i").test(product.name)));
  }
  const programs = new Set(picked.map((product) => product.programSlug));
  for (const product of pictured) {
    if (!programs.has(product.programSlug)) {
      add(product);
      programs.add(product.programSlug);
    }
  }
  for (const product of pictured) add(product);
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
  const positioning = brand.overview ?? brand.description;
  const showcase = heroProducts(products, brand.name, positioning);
  // Bez logotipa i bez fotografija ploča bi nosila samo naziv brenda — tada je zaglavlje samo tekst.
  const textOnly = showcase.length < 2 && !brand.logo;

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

      <section
        className={`${styles.hero} ${styles.brandHero}`}
        aria-labelledby="brand-title"
        data-text-only={textOnly || undefined}
      >
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>{brand.presentation.heroKicker}</p>
          <h1 id="brand-title" className={styles.title}>
            {brand.name}
          </h1>
          <p className={styles.heroLead}>{positioning}</p>
          <p className={styles.subtitle}>{brand.description}</p>

          <div className={styles.badgeRow} aria-label="Pregled brenda">
            <span className={styles.badge}>{countOf(programs.length, PROGRAM)}</span>
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

        {textOnly ? null : (
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
        )}
      </section>
    </>
  );
}
