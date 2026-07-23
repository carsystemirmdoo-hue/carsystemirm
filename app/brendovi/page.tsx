import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { Footer } from "@/components/layout/Footer";
import styles from "@/components/brand-program/BrandProgramPage.module.css";
import { getAllCarsystemBrands, getPublicProgramGroupsForBrand } from "@/lib/carsystem-data";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Brendovi",
  description:
    "Pregled aktivnih refinish brendova u Carsystem i R-M programu za Srbiju.",
  path: "/brendovi",
});

export default function BrandsIndexPage() {
  const brands = getAllCarsystemBrands();

  return (
    <div className={styles.pageShell}>
      <main className={styles.main}>
        <section className={styles.indexIntro} aria-labelledby="brands-title">
          <div className={styles.indexIntroCopy}>
            <p className={styles.sectionKicker}>Brendovi</p>
            <h1 id="brands-title" className={styles.title}>
              Brendovi
            </h1>
            <p>
              Aktivni refinish brendovi u Carsystem i R-M sistemu, povezani sa
              programima, proizvodima i upitom za tehnički izbor.
            </p>
          </div>
          <div className={styles.indexIntroMeta} aria-label="Pregled brendova">
            <span>{brands.length} aktivnih brendova</span>
            <span>Javne stranice</span>
            <span>Na upit</span>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="brands-grid-title">
          <div className={styles.sectionHeader}>
            <p className={styles.sectionKicker}>Aktivni program</p>
            <h2 id="brands-grid-title">Ulaz u brendove</h2>
            <p>
              Svaka stranica brenda vodi ka povezanim programima, proizvodima i
              kontaktu za najbližu prodavnicu.
            </p>
          </div>
          <div className={styles.brandGrid}>
            {brands.map((brand) => {
              const programs = getPublicProgramGroupsForBrand(brand.slug);

              return (
                <Link
                  className={`${styles.brandCard} ${styles.brandCardActive}`}
                  href={brand.routes.landing}
                  key={brand.slug}
                >
                  <span className={styles.brandLogoFrame}>
                    <Image
                      src={brand.logo}
                      alt={`${brand.name} logo`}
                      width={190}
                      height={88}
                      className={styles.brandLogo}
                    />
                  </span>
                  <span>
                    <p className={styles.cardKicker}>{programs.length} programa</p>
                    <h2>{brand.name}</h2>
                  </span>
                  <p>{brand.description}</p>
                  <span className={styles.brandCardFooter}>
                    Pogledaj brend
                    <span aria-hidden="true">→</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
