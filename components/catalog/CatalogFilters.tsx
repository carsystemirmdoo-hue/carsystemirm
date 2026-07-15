import type { ReactNode } from "react";
import type {
  CarsystemBrand,
  ProgramGroup,
  RefinishPhase,
} from "@/lib/carsystem-data";
import { SearchableCombobox } from "@/components/ui/SearchableCombobox";
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
  onMobileClose,
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
  onMobileClose: () => void;
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
          <button
            className={`${styles.mobileFilterClose} cs-interactive-surface`}
            type="button"
            aria-label="Zatvori filtere"
            aria-controls="catalog-filters"
            data-cursor="button"
            data-motion-surface
            onClick={onMobileClose}
          >
            <span aria-hidden="true">×</span>
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
        <SearchableCombobox
          ariaLabel="Brend"
          emptyMessage="Nema brendova koji odgovaraju pretrazi."
          id="brand-filter"
          onChange={onBrandChange}
          options={[
            { label: "Svi brendovi", value: "" },
            ...brands.map((brand) => ({ label: brand.name, value: brand.slug })),
          ]}
          placeholder="Svi brendovi"
          searchPlaceholder="Pretražite brend"
          sheetTitle="Izaberite brend"
          value={brandSlug}
        />
      </FilterField>

      <FilterField label="Program" htmlFor="program-filter">
        <SearchableCombobox
          ariaLabel="Program"
          emptyMessage="Nema programa koji odgovaraju pretrazi."
          id="program-filter"
          onChange={onProgramChange}
          options={[
            { label: "Svi programi", value: "" },
            ...programs.map((program) => ({ label: program.name, value: program.slug })),
          ]}
          placeholder="Svi programi"
          searchPlaceholder="Pretražite program"
          sheetTitle="Izaberite program"
          value={programSlug}
        />
      </FilterField>

      <FilterField label="Faza procesa" htmlFor="phase-filter">
        <SearchableCombobox
          ariaLabel="Faza procesa"
          emptyMessage="Nema faza koje odgovaraju pretrazi."
          id="phase-filter"
          onChange={onPhaseChange}
          options={[
            { label: "Sve faze", value: "" },
            ...phases.map((phase) => ({ label: phase.name, value: phase.slug })),
          ]}
          placeholder="Sve faze"
          searchPlaceholder="Pretražite fazu"
          sheetTitle="Izaberite fazu"
          value={phaseSlug}
        />
      </FilterField>

      <FilterField label="Dostupnost" htmlFor="status-filter">
        <SearchableCombobox
          ariaLabel="Dostupnost"
          emptyMessage="Nema statusa koji odgovaraju pretrazi."
          id="status-filter"
          onChange={onStatusChange}
          options={[
            { label: "Svi statusi", value: "" },
            { label: "Na upit", value: "na-upit" },
          ]}
          placeholder="Svi statusi"
          searchPlaceholder="Pretražite status"
          sheetTitle="Izaberite dostupnost"
          value={status}
        />
      </FilterField>

      <FilterField label="Namena / tip" htmlFor="type-filter">
        <SearchableCombobox
          ariaLabel="Namena ili tip"
          emptyMessage="Nema tipova koji odgovaraju pretrazi."
          id="type-filter"
          onChange={onTypeChange}
          options={[
            { label: "Svi tipovi", value: "" },
            ...typeOptions.map((option) => ({ label: option, value: option })),
          ]}
          placeholder="Svi tipovi"
          searchPlaceholder="Pretražite tip"
          sheetTitle="Izaberite namenu ili tip"
          value={typeTag}
        />
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
