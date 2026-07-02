import Link from "next/link";
import { SupportBand } from "@/components/brand-program/SupportBand";
import { BrandHero } from "@/components/brand/BrandHero";
import { BrandProducts } from "@/components/brand/BrandProducts";
import { Footer } from "@/components/layout/Footer";
import type {
  CarsystemBrand,
  CarsystemProduct,
  ProgramGroup,
  PublicProgramGroup,
  RefinishPhase,
} from "@/lib/carsystem-data";
import styles from "@/components/brand-program/BrandProgramPage.module.css";

export function BrandPage({
  brand,
  brandBySlug,
  phaseBySlug,
  products,
  programBySlug,
  publicPrograms,
}: {
  brand: CarsystemBrand;
  brandBySlug: Map<string, CarsystemBrand>;
  phaseBySlug: Map<string, RefinishPhase>;
  products: CarsystemProduct[];
  programBySlug: Map<string, ProgramGroup>;
  publicPrograms: PublicProgramGroup[];
}) {
  return (
    <div className={styles.pageShell}>
      <main className={styles.main}>
        <BrandHero brand={brand} productCount={products.length} programs={publicPrograms} />
        <BrandOverview brand={brand} products={products} programs={publicPrograms} />
        <BrandProducts
          brand={brand}
          brandBySlug={brandBySlug}
          phaseBySlug={phaseBySlug}
          products={products}
          programBySlug={programBySlug}
        />
        <SupportBand
          body="Pošaljite upit za izbor proizvoda, tehničku smernicu ili najbližu prodavnicu u partnerskoj mreži."
          primaryHref={`/kontakt?tema=proizvod&brand=${brand.slug}`}
          primaryLabel="Pošalji upit"
          title={`Treba vam proizvod iz ${brand.name} programa?`}
        />
      </main>
      <Footer />
    </div>
  );
}

function BrandOverview({
  brand,
  products,
  programs,
}: {
  brand: CarsystemBrand;
  products: CarsystemProduct[];
  programs: PublicProgramGroup[];
}) {
  return (
    <section
      className={`${styles.section} ${styles.gatewaySection}`}
      aria-labelledby="brand-overview-title"
    >
      <div className={styles.sectionHeader}>
        <p className={styles.sectionKicker}>Ulaz u brend</p>
        <h2 id="brand-overview-title">Programi u kojima se koristi {brand.name}</h2>
        <p>
          Pregled programskih celina, put ka katalogu i jasan kontakt za upit.
        </p>
      </div>

      <div className={styles.gatewayGrid}>
        <div className={styles.gatewayPanel}>
          <p>{brand.overview ?? brand.description}</p>

          <div className={styles.overviewFacts} aria-label="Brzi pregled brenda">
            <div className={styles.fact}>
              <span>Programi</span>
              <strong>{programs.length}</strong>
            </div>
            <div className={styles.fact}>
              <span>Proizvodi</span>
              <strong>{products.length}</strong>
            </div>
            <div className={styles.fact}>
              <span>Status</span>
              <strong>Na upit</strong>
            </div>
          </div>

          <Link className={styles.secondaryButton} href={`/katalog?brand=${brand.slug}`}>
            Pogledaj katalog
          </Link>
        </div>

        <div className={`${styles.programCardGrid} ${styles.gatewayProgramGrid}`}>
          {programs.map((program) => (
            <Link
              className={styles.programCard}
              href={`/program/${program.slug}`}
              key={program.slug}
            >
              <p className={styles.cardKicker}>{program.shortName}</p>
              <h3>{program.name}</h3>
              <p>{program.description}</p>
              <div className={styles.programPills}>
                {program.badges.slice(0, 3).map((badge) => (
                  <span key={badge}>{badge}</span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
