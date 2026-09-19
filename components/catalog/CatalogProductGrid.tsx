import { CatalogProductCard } from "@/components/catalog/CatalogProductCard";
import type { Ref } from "react";
import type {
  CarsystemBrand,
  ProgramGroup,
  RefinishPhase,
  RefinishPhaseSlug,
} from "@/lib/carsystem-data";
import type { CatalogListingEntity } from "@/lib/catalog-listing";
import styles from "./CatalogPage.module.css";

export function CatalogProductGrid({
  brandBySlug,
  emptyStateNote,
  gridRef,
  onReset,
  onSortChange,
  phaseBySlug,
  onSearchIndexRetry,
  preloadTriggerIndex,
  preloadTriggerRef,
  loadSentinelRef,
  entities,
  searchIndexState = "idle",
  programBySlug,
  resultCount,
  shownCount,
  sortOptions,
  sortSlug,
}: {
  brandBySlug: Map<string, CarsystemBrand>;
  /**
   * Rečenica koja objašnjava ZAŠTO je rezultat prazan, kada se to zna. Prazna
   * kategorija sa generičkom porukom „promenite filtere" izgleda kao kvar;
   * kategorija u koju nijedan artikal još nije klasifikovan to mora reći.
   */
  emptyStateNote?: string;
  gridRef: Ref<HTMLDivElement>;
  onReset: () => void;
  onSortChange: (value: string) => void;
  phaseBySlug: Map<RefinishPhaseSlug, RefinishPhase>;
  onSearchIndexRetry?: () => void;
  preloadTriggerIndex: number;
  preloadTriggerRef: Ref<HTMLAnchorElement>;
  /**
   * Nevidljivi element ODMAH ISPOD poslednje kartice. Okidač na kartici (tri
   * reda pre kraja) pokriva mirno skrolovanje; sentinel pokriva skok na dno
   * (End, prevlačenje skrol-trake, brz wheel), gde okidač prođe kroz viewport
   * između dva frejma i IntersectionObserver ga nikad ne vidi.
   */
  loadSentinelRef?: Ref<HTMLDivElement>;
  entities: CatalogListingEntity[];
  /**
   * Stanje lenjo učitanog variant search indexa. Bez ovoga bi katalog, dok se
   * index preuzima, tvrdio „nema rezultata" — što je netačno, a ne samo ružno.
   */
  searchIndexState?: "idle" | "loading" | "ready" | "error" | "too-short";
  programBySlug: Map<string, ProgramGroup>;
  resultCount: number;
  shownCount: number;
  sortOptions: readonly { slug: string; label: string }[];
  sortSlug: string;
}) {
  const resultLabel =
    shownCount === resultCount
      ? `Prikazano ${resultCount} proizvoda`
      : `Prikazano ${shownCount} od ${resultCount} proizvoda`;

  return (
    <div className={styles.results}>
      <div className={styles.resultBar}>
        <p className={styles.resultCount} role="status" aria-atomic="true" aria-live="polite">
          {resultLabel}
        </p>

        <div className={styles.sortRail} role="group" aria-label="Sortiranje">
          {sortOptions.map((option) => {
            const isActive = option.slug === sortSlug;
            return (
              <button
                className={`${styles.sortTab} ${isActive ? styles.sortTabActive : ""}`}
                key={option.slug || "default"}
                type="button"
                aria-pressed={isActive}
                data-cursor="button"
                onClick={() => onSortChange(option.slug)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {entities.length > 0 ? (
        <div className={styles.productGrid} ref={gridRef}>
          {entities.map((entity, index) => {
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
                preloadRef={index === preloadTriggerIndex ? preloadTriggerRef : undefined}
                program={program}
              />
            );
          })}
          {loadSentinelRef ? (
            <div
              aria-hidden="true"
              className={styles.loadSentinel}
              data-catalog-load-sentinel
              ref={loadSentinelRef}
            />
          ) : null}
        </div>
      ) : searchIndexState === "too-short" ? (
        /*
         * `?q=c` nije prazan rezultat nego upit koji se ne pokreće: jedan znak
         * bi poklopio skoro ceo katalog. „Nema rezultata" bi ovde bila netačna
         * poruka i navela korisnika da traži nepostojeći proizvod.
         */
        <div className={styles.emptyState}>
          <p className={styles.kicker}>Pretraga</p>
          <h3>Unesite najmanje 2 znaka za pretragu.</h3>
          <p className={styles.emptyStateHint}>
            Jedan znak bi vratio skoro ceo katalog. Dodajte još jedno slovo ili
            cifru, ili pregledajte katalog po kategorijama i brendovima.
          </p>
        </div>
      ) : searchIndexState === "loading" ? (
        <div className={styles.emptyState} aria-busy="true">
          <p className={styles.kicker}>Pretraga</p>
          <h3>Učitavamo pretragu po varijantama…</h3>
          <p className={styles.emptyStateHint}>
            Konkretne nijanse, šifre i pakovanja učitavaju se pri prvoj pretrazi.
          </p>
        </div>
      ) : searchIndexState === "error" ? (
        <div className={styles.emptyState}>
          <p className={styles.kicker}>Pretraga nije učitana</p>
          <h3>Pretraga po varijantama trenutno nije dostupna.</h3>
          <p className={styles.emptyStateHint}>
            Pregled po kategorijama, brendovima i fazama radi normalno.
          </p>
          <button
            className={`${styles.primaryButton} cs-magnetic-cta cs-theme-wipe-card`}
            type="button"
            data-cursor="button"
            data-motion-surface
            data-motion="theme-wipe"
            onClick={onSearchIndexRetry}
          >
            <span>Pokušaj ponovo</span>
          </button>
        </div>
      ) : (
        <div className={styles.emptyState}>
          <p className={styles.kicker}>Nema rezultata</p>
          <h3>
            {emptyStateNote ?? "Za izabranu kombinaciju filtera trenutno nema proizvoda."}
          </h3>
          <p className={styles.emptyStateHint}>
            Promenite filtere ili pošaljite upit našem timu za materijal koji vam treba.
          </p>
          <button
            className={`${styles.primaryButton} cs-magnetic-cta cs-theme-wipe-card`}
            type="button"
            data-cursor="button"
            data-motion-surface
            data-motion="theme-wipe"
            onClick={onReset}
          >
            <span>Resetuj filtere</span>
          </button>
        </div>
      )}
    </div>
  );
}
