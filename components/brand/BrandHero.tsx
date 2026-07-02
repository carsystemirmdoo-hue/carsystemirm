import Image from "next/image";
import Link from "next/link";
import type { CarsystemBrand, PublicProgramGroup } from "@/lib/carsystem-data";
import styles from "@/components/brand-program/BrandProgramPage.module.css";

export function BrandHero({
  brand,
  productCount,
  programs,
}: {
  brand: CarsystemBrand;
  productCount: number;
  programs: PublicProgramGroup[];
}) {
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
          <p className={styles.kicker}>Brend program</p>
          <h1 id="brand-title" className={styles.title}>
            {brand.name}
          </h1>
          <p className={styles.heroLead}>{positioning}</p>
          <p className={styles.subtitle}>{brand.description}</p>

          <div className={styles.badgeRow} aria-label="Pregled brenda">
            <span className={styles.badge}>{programs.length} programa</span>
            <span className={styles.badge}>{productCount} proizvoda</span>
            <span className={styles.availabilityChip}>Na upit</span>
          </div>

          <div className={styles.heroActions}>
            <Link
              className={styles.primaryButton}
              href={`/kontakt?tema=proizvod&brand=${brand.slug}`}
            >
              Pošalji upit
            </Link>
            <Link className={styles.secondaryButton} href={`/katalog?brand=${brand.slug}`}>
              Pogledaj proizvode
            </Link>
            <Link className={styles.ghostButton} href="/prodavnice">
              Pronađi prodavnicu
            </Link>
          </div>
        </div>

        <div className={styles.heroVisual}>
          <div className={styles.logoStage}>
            <div className={styles.logoChip}>
              <Image
                src={brand.logo}
                alt={`${brand.name} logo`}
                width={320}
                height={190}
                className={styles.logoImage}
                priority
              />
            </div>
            <p className={styles.logoStageMeta}>Aktivan brend u Carsystem i R-M programu</p>
          </div>
        </div>
      </section>
    </>
  );
}
