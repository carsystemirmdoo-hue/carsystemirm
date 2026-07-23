import Image from "next/image";
import Link from "next/link";
import type { BrandReference, CarsystemBrand, PublicProgramGroup } from "@/lib/carsystem-data";
import styles from "@/components/brand-program/BrandProgramPage.module.css";

export function ProgramBrands({
  brands,
  program,
}: {
  brands: BrandReference[];
  program: PublicProgramGroup;
}) {
  const activeBrands = brands.filter(
    (brand): brand is CarsystemBrand & { status: "active" } => brand.status === "active",
  );

  return (
    <section className={styles.section} aria-labelledby="program-brands-title">
      <div className={styles.sectionHeader}>
        <p className={styles.sectionKicker}>Brendovi</p>
        <h2 id="program-brands-title">Brendovi povezani sa programom</h2>
        <p>
          Aktivni brendovi vode na javne stranice sa programima, proizvodima i
          upitom za tehnički izbor.
        </p>
      </div>

      <div className={styles.brandGrid} aria-label={`Brendovi za ${program.name}`}>
        {activeBrands.map((brand) => (
          <Link
            className={`${styles.brandCard} ${styles.brandCardActive}`}
            href={brand.routes.landing}
            key={brand.slug}
          >
            <BrandCardContent brand={brand} />
            <div className={styles.brandCardFooter}>
              <span>Otvori brend</span>
              <span aria-hidden="true">→</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function BrandCardContent({ brand }: { brand: CarsystemBrand & { status: "active" } }) {
  return (
    <>
      <div className={styles.brandLogoFrame}>
        <Image
          src={brand.logo}
          alt={`${brand.name} logo`}
          width={220}
          height={120}
          className={styles.brandLogo}
        />
      </div>
      <div>
        <h3>{brand.name}</h3>
        <p>{brand.description}</p>
      </div>
    </>
  );
}
