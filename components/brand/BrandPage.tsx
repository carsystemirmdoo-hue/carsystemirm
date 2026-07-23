import Link from "next/link";
import type { CSSProperties } from "react";
import { SupportBand } from "@/components/brand-program/SupportBand";
import { BrandHero } from "@/components/brand/BrandHero";
import { ManufacturerRail } from "@/components/brand/ManufacturerRail";
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
  const brandStyle = {
    "--brand-accent": brand.presentation.accentColor,
    "--brand-accent-contrast": brand.presentation.accentContrastColor,
    "--brand-accent-on-dark": brand.presentation.accentOnDarkColor,
    "--brand-accent-on-dark-contrast":
      brand.presentation.accentOnDarkContrastColor,
  } as CSSProperties;
  const brands = Array.from(brandBySlug.values());

  return (
    <div className={styles.pageShell} style={brandStyle}>
      <main className={styles.main}>
        <BrandHero brand={brand} programs={publicPrograms} />
        <BrandOverview brand={brand} products={products} programs={publicPrograms} />
        <div className={styles.manufacturerRailSection}>
          <ManufacturerRail
            brands={brands}
            description="Otvorite stranicu drugog proizvođača bez povratka na indeks brendova."
            id={`brand-${brand.slug}-manufacturers`}
            mode="links"
            selectedSlug={brand.slug}
            title="Pogledajte druge proizvođače"
          />
        </div>
        <BrandProducts
          brand={brand}
          brandBySlug={brandBySlug}
          phaseBySlug={phaseBySlug}
          products={products}
          programBySlug={programBySlug}
        />
        <SupportBand
          body="Pošaljite upit za izbor proizvoda, tehničku smernicu ili najbližu prodavnicu u partnerskoj mreži."
          primaryHref={brand.routes.contact}
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
  const productLines = Array.from(
    new Set(
      products
        .map((product) => product.catalogMetadata?.line)
        .filter((line): line is string => Boolean(line)),
    ),
  ).sort((first, second) => first.localeCompare(second, "sr-Latn"));

  return (
    <section
      className={`${styles.section} ${styles.gatewaySection}`}
      aria-labelledby="brand-overview-title"
    >
      <div className={styles.sectionHeader}>
        <p className={styles.sectionKicker}>Program brenda</p>
        <h2 id="brand-overview-title">Programi i proizvodi brenda {brand.name}</h2>
        <p>
          Pregled stvarnih programskih celina i linija koje su povezane sa javnim
          katalogom.
        </p>
      </div>

      <div className={styles.gatewayGrid}>
        <div className={styles.gatewayPanel}>
          <p>{brand.overview ?? brand.description}</p>

          {productLines.length > 0 && (
            <div className={styles.programPills} aria-label={`Linije brenda ${brand.name}`}>
              {productLines.slice(0, 12).map((line) => (
                <span key={line}>{line}</span>
              ))}
              {productLines.length > 12 && <span>+{productLines.length - 12} linija</span>}
            </div>
          )}

          <Link className={styles.secondaryButton} href={brand.routes.catalog}>
            Pogledajte sve proizvode
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
