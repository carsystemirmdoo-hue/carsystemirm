import Link from "next/link";
import { Suspense } from "react";
import { CatalogHeroSearch } from "@/components/catalog/CatalogHeroSearch";
import { CatalogProductCard } from "@/components/catalog/CatalogProductCard";
import type {
  CarsystemBrand,
  ProgramGroup,
  RefinishPhase,
} from "@/lib/carsystem-data";
import type { CatalogListingEntity } from "@/lib/catalog-listing";
import { seoCategoryLandings } from "@/lib/seo/category-landings";
import styles from "./CatalogPage.module.css";

export function CatalogHero({
  brandCount,
  programCount,
  showSearch = true,
}: {
  brandCount: number;
  programCount: number;
  showSearch?: boolean;
}) {
  return (
    <section className={styles.hero} aria-labelledby="catalog-title">
      <div className={styles.heroCopy}>
        <p className={styles.kicker}>Katalog, Carsystem i R-M</p>
        <h1 id="catalog-title" className={styles.title}>
          Katalog proizvoda
        </h1>
        <p className={styles.subtitle}>
          Pregled programa za pripremu, bojenje, lakiranje i završnu obradu
          vozila. Izaberite kategoriju, uporedite proizvode i pošaljite upit za
          materijal koji odgovara Vašem poslu.
        </p>
      </div>

      <div className={styles.heroTools}>
        {showSearch ? (
          <Suspense
            fallback={
              <>
                <label className={styles.searchLabel} htmlFor="catalog-search-fallback">
                  Pretraga
                </label>
                <input
                  id="catalog-search-fallback"
                  className={styles.searchInput}
                  type="search"
                  placeholder="Pretražite proizvode..."
                  disabled
                />
              </>
            }
          >
            <CatalogHeroSearch />
          </Suspense>
        ) : (
          <p className={styles.searchLabel}>Pregled kataloga</p>
        )}
        <div className={styles.quickStats} aria-label="Brzi pregled kataloga">
          <span>{brandCount} brendova</span>
          <span>{programCount} programa</span>
          <span>Tehnička podrška</span>
          <span>Na upit</span>
        </div>
      </div>
    </section>
  );
}

export function CatalogStaticProductGrid({
  brands,
  phases,
  entities,
  programs,
}: {
  brands: CarsystemBrand[];
  phases: RefinishPhase[];
  entities: CatalogListingEntity[];
  programs: ProgramGroup[];
}) {
  const brandBySlug = new Map(brands.map((brand) => [brand.slug, brand]));
  const programBySlug = new Map(programs.map((program) => [program.slug, program]));
  const phaseBySlug = new Map(phases.map((phase) => [phase.slug, phase]));

  return (
    <section className={styles.staticCatalogSection} aria-labelledby="catalog-products-title">
      <div className={styles.sectionHeader}>
        <div>
          <p className={styles.kicker}>Proizvodi</p>
          <h2 id="catalog-products-title">Početak kataloga</h2>
        </div>
        <p>
          Prvih {entities.length} proizvoda dostupno je i bez JavaScript-a.
          Sledeće stranice kataloga povezane su ispod liste.
        </p>
      </div>
      <div className={styles.productGrid}>
        {entities.map((entity) => {
          const brand = brandBySlug.get(entity.brandSlug);
          const program = programBySlug.get(entity.programSlug);
          const phase = phaseBySlug.get(entity.phaseSlug);
          if (!brand || !program || !phase) return null;
          return (
            <CatalogProductCard
              brand={brand}
              catalogSystem
              entity={entity}
              key={entity.id}
              phase={phase}
              program={program}
            />
          );
        })}
      </div>
    </section>
  );
}

export function CatalogCategoryLinks() {
  return (
    <section
      className={styles.categoryLandingRail}
      aria-labelledby="catalog-categories-title"
    >
      <div>
        <p className={styles.kicker}>Glavne kategorije</p>
        <h2 id="catalog-categories-title">Pregled po tehničkoj nameni</h2>
      </div>
      <nav aria-label="Glavne kategorije proizvoda">
        {seoCategoryLandings.map((category) => (
          <Link href={`/kategorije/${category.slug}`} key={category.slug}>
            {category.name}
            <span aria-hidden="true">↗</span>
          </Link>
        ))}
      </nav>
    </section>
  );
}

export function CatalogPaginationNav({
  currentPage,
  totalPages,
}: {
  currentPage: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;

  const previousHref =
    currentPage <= 2 ? "/katalog" : `/katalog/strana/${currentPage - 1}`;
  const nextHref =
    currentPage < totalPages ? `/katalog/strana/${currentPage + 1}` : null;

  return (
    <nav className={styles.catalogPagination} aria-label="Stranice kataloga">
      <p>
        Strana <strong>{currentPage}</strong> od <strong>{totalPages}</strong>
      </p>
      <div>
        {currentPage > 1 ? <Link href={previousHref}>← Prethodna</Link> : null}
        <Link href="/katalog">Početak kataloga</Link>
        {nextHref ? <Link href={nextHref}>Sledeća →</Link> : null}
      </div>
    </nav>
  );
}
