import type { ReactNode } from "react";
import type {
  CarsystemBrand,
  ProgramGroup,
  RefinishPhase,
} from "@/lib/carsystem-data";
import styles from "./CatalogPage.module.css";

export function CatalogFilters({
  activeModuleLabel,
  brands,
  brandSlug,
  filtersOpen,
  hasActiveFilters,
  onDesktopCollapseChange,
  onBrandChange,
  onClear,
  onPhaseChange,
  onProgramChange,
  onStatusChange,
  onTypeChange,
  phases,
  phaseSlug,
  programs,
  programSlug,
  status,
  typeOptions,
  typeTag,
}: {
  activeModuleLabel: string;
  brands: CarsystemBrand[];
  brandSlug: string;
  filtersOpen: boolean;
  hasActiveFilters: boolean;
  onDesktopCollapseChange: (collapsed: boolean) => void;
  onBrandChange: (value: string) => void;
  onClear: () => void;
  onPhaseChange: (value: string) => void;
  onProgramChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onTypeChange: (value: string) => void;
  phases: RefinishPhase[];
  phaseSlug: string;
  programs: ProgramGroup[];
  programSlug: string;
  status: string;
  typeOptions: string[];
  typeTag: string;
}) {
  return (
    <aside
      id="catalog-filters"
      className={`${styles.filters} ${filtersOpen ? styles.filtersOpen : ""}`}
      aria-label="Filteri kataloga"
    >
      <div className={styles.filtersHeader}>
        <div>
          <p className={styles.kicker}>Filteri</p>
          <h2>Preciziraj katalog</h2>
        </div>
        <div className={styles.filtersHeaderActions}>
          {hasActiveFilters && (
            <button
              className={`${styles.clearButton} cs-interactive-surface`}
              type="button"
              data-cursor="button"
              data-motion-surface
              onClick={onClear}
            >
              Resetuj filtere
            </button>
          )}
          <button
            className={`${styles.desktopFilterCollapse} cs-interactive-surface`}
            type="button"
            aria-label="Sakrij filtere"
            aria-controls="catalog-filters"
            data-cursor="button"
            data-motion-surface
            onClick={() => onDesktopCollapseChange(true)}
          >
            <span aria-hidden="true">«</span>
          </button>
        </div>
      </div>

      {activeModuleLabel && (
        <div className={styles.activeModule}>
          <span>Program</span>
          <strong>{activeModuleLabel}</strong>
        </div>
      )}

      <FilterField label="Brend" htmlFor="brand-filter">
        <select
          id="brand-filter"
          value={brandSlug}
          onChange={(event) => onBrandChange(event.target.value)}
        >
          <option value="">Svi brendovi</option>
          {brands.map((brand) => (
            <option key={brand.slug} value={brand.slug}>
              {brand.name}
            </option>
          ))}
        </select>
      </FilterField>

      <FilterField label="Program" htmlFor="program-filter">
        <select
          id="program-filter"
          value={programSlug}
          onChange={(event) => onProgramChange(event.target.value)}
        >
          <option value="">Svi programi</option>
          {programs.map((program) => (
            <option key={program.slug} value={program.slug}>
              {program.name}
            </option>
          ))}
        </select>
      </FilterField>

      <FilterField label="Faza procesa" htmlFor="phase-filter">
        <select
          id="phase-filter"
          value={phaseSlug}
          onChange={(event) => onPhaseChange(event.target.value)}
        >
          <option value="">Sve faze</option>
          {phases.map((phase) => (
            <option key={phase.slug} value={phase.slug}>
              {phase.name}
            </option>
          ))}
        </select>
      </FilterField>

      <FilterField label="Dostupnost" htmlFor="status-filter">
        <select
          id="status-filter"
          value={status}
          onChange={(event) => onStatusChange(event.target.value)}
        >
          <option value="">Svi statusi</option>
          <option value="na-upit">Na upit</option>
        </select>
      </FilterField>

      <FilterField label="Namena / tip" htmlFor="type-filter">
        <select
          id="type-filter"
          value={typeTag}
          onChange={(event) => onTypeChange(event.target.value)}
        >
          <option value="">Svi tipovi</option>
          {typeOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </FilterField>
    </aside>
  );
}

function FilterField({
  children,
  htmlFor,
  label,
}: {
  children: ReactNode;
  htmlFor: string;
  label: string;
}) {
  return (
    <div className={styles.filterField}>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
    </div>
  );
}
