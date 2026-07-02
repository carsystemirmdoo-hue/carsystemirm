import type { RefObject } from "react";
import styles from "./StoresPage.module.css";

export function StoreFilters({
  brandProgram,
  brandProgramOptions,
  city,
  cityOptions,
  filtersOpen,
  hasActiveFilters,
  onBrandProgramChange,
  onCityChange,
  onClear,
  onFiltersToggle,
  onQueryChange,
  onRegionChange,
  query,
  region,
  regionOptions,
  searchInputRef,
}: {
  brandProgram: string;
  brandProgramOptions: string[];
  city: string;
  cityOptions: string[];
  filtersOpen: boolean;
  hasActiveFilters: boolean;
  onBrandProgramChange: (value: string) => void;
  onCityChange: (value: string) => void;
  onClear: () => void;
  onFiltersToggle: () => void;
  onQueryChange: (value: string) => void;
  onRegionChange: (value: string) => void;
  query: string;
  region: string;
  regionOptions: string[];
  searchInputRef?: RefObject<HTMLInputElement>;
}) {
  return (
    <section className={styles.filterShell} aria-label="Pretraga i filteri prodavnica">
      <div className={styles.searchRow}>
        <label className={styles.searchGroup} htmlFor="store-search">
          <span className={styles.fieldLabel}>Pretraga</span>
          <input
            aria-label="Pretraga prodavnica"
            className={styles.searchInput}
            id="store-search"
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Unesite grad ili naziv prodavnice..."
            ref={searchInputRef}
            type="search"
            value={query}
          />
        </label>
        <button
          aria-controls="store-filters"
          aria-expanded={filtersOpen}
          className={styles.filterToggle}
          onClick={onFiltersToggle}
          type="button"
        >
          Filteri
        </button>
      </div>

      <div
        className={`${styles.filters} ${filtersOpen ? styles.filtersOpen : ""}`}
        id="store-filters"
      >
        <label className={styles.field} htmlFor="region-filter">
          <span className={styles.fieldLabel}>Region</span>
          <select
            aria-label="Region"
            className={styles.select}
            id="region-filter"
            onChange={(event) => onRegionChange(event.target.value)}
            value={region}
          >
            <option value="">Svi regioni</option>
            {regionOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field} htmlFor="city-filter">
          <span className={styles.fieldLabel}>Grad</span>
          <select
            aria-label="Grad"
            className={styles.select}
            id="city-filter"
            onChange={(event) => onCityChange(event.target.value)}
            value={city}
          >
            <option value="">Svi gradovi</option>
            {cityOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field} htmlFor="program-filter">
          <span className={styles.fieldLabel}>Brend / program</span>
          <select
            aria-label="Brend ili program"
            className={styles.select}
            id="program-filter"
            onChange={(event) => onBrandProgramChange(event.target.value)}
            value={brandProgram}
          >
            <option value="">Svi programi</option>
            {brandProgramOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <button
          className={styles.clearButton}
          disabled={!hasActiveFilters}
          onClick={onClear}
          type="button"
        >
          Resetuj filtere
        </button>
      </div>
    </section>
  );
}
