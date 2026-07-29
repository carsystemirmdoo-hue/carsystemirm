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
  onRmCategoryChange,
  onRmSeriesChange,
  onRmSystemChange,
  onStatusChange,
  onTypeChange,
  onProductLineChange,
  onTechnicalCategoryChange,
  onFinishChange,
  phases,
  phaseSlug,
  programs,
  programSlug,
  rmCategory,
  rmCategoryOptions,
  rmSeries,
  rmSeriesOptions,
  rmSystem,
  rmSystemOptions,
  status,
  typeOptions,
  typeTag,
  productLine,
  productLineOptions,
  technicalCategory,
  technicalCategoryOptions,
  finish,
  finishOptions,
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
  onRmCategoryChange: (value: string) => void;
  onRmSeriesChange: (value: string) => void;
  onRmSystemChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onTypeChange: (value: string) => void;
  onProductLineChange: (value: string) => void;
  onTechnicalCategoryChange: (value: string) => void;
  onFinishChange: (value: string) => void;
  phases: RefinishPhase[];
  phaseSlug: string;
  programs: ProgramGroup[];
  programSlug: string;
  rmCategory: string;
  rmCategoryOptions: { label: string; value: string }[];
  rmSeries: string;
  rmSeriesOptions: { label: string; value: string }[];
  rmSystem: string;
  rmSystemOptions: { label: string; value: string }[];
  status: string;
  typeOptions: string[];
  typeTag: string;
  productLine: string;
  productLineOptions: string[];
  technicalCategory: string;
  technicalCategoryOptions: string[];
  finish: string;
  finishOptions: string[];
}) {
  function clearAndRestoreFocus() {
    onClear();
    window.requestAnimationFrame(() => {
      document.getElementById("brand-filter")?.focus();
    });
  }

  return (
    <aside
      id="catalog-filters"
      className={`${styles.filters} ${filtersOpen ? styles.filtersOpen : ""}`}
      aria-label="Filteri kataloga"
    >
      <div className={styles.filtersStickyHeader}>
        <div className={styles.filtersHeader}>
          <div className={styles.filtersHeaderCopy}>
            <p className={styles.kicker}>Filteri</p>
            <h2>Preciziraj katalog</h2>
          </div>
          <div className={styles.filtersHeaderActions}>
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

        <div className={styles.filtersResetSlot}>
          {hasActiveFilters && (
            <button
              className={styles.clearButton}
              type="button"
              data-cursor="button"
              onClick={clearAndRestoreFocus}
            >
              <span aria-hidden="true">×</span>
              Resetuj filtere
            </button>
          )}
        </div>
      </div>

      <div
        className={styles.filtersScrollableBody}
        data-catalog-filter-scroll-body
        data-combobox-scroll-container
      >
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

        {(brandSlug === "rm" || rmSystem || rmSeries || rmCategory) && (
          <>
            <FilterField label="R-M sistem" htmlFor="rm-system-filter">
              <SearchableCombobox
                ariaLabel="R-M sistem"
                emptyMessage="Nema R-M sistema koji odgovaraju pretrazi."
                id="rm-system-filter"
                onChange={onRmSystemChange}
                options={[
                  { label: "Svi R-M sistemi", value: "" },
                  ...rmSystemOptions,
                ]}
                placeholder="Svi R-M sistemi"
                searchPlaceholder="Pretražite R-M sistem"
                sheetTitle="Izaberite R-M sistem"
                value={rmSystem}
              />
            </FilterField>

            <FilterField label="R-M serija" htmlFor="rm-series-filter">
              <SearchableCombobox
                ariaLabel="R-M serija"
                emptyMessage="Nema R-M serija koje odgovaraju pretrazi."
                id="rm-series-filter"
                onChange={onRmSeriesChange}
                options={[
                  { label: "Sve R-M serije", value: "" },
                  ...rmSeriesOptions,
                ]}
                placeholder="Sve R-M serije"
                searchPlaceholder="Pretražite R-M seriju"
                sheetTitle="Izaberite R-M seriju"
                value={rmSeries}
              />
            </FilterField>

            <FilterField label="R-M grupa proizvoda" htmlFor="rm-category-filter">
              <SearchableCombobox
                ariaLabel="R-M grupa proizvoda"
                emptyMessage="Nema R-M grupa koje odgovaraju pretrazi."
                id="rm-category-filter"
                onChange={onRmCategoryChange}
                options={[
                  { label: "Sve R-M grupe", value: "" },
                  ...rmCategoryOptions,
                ]}
                placeholder="Sve R-M grupe"
                searchPlaceholder="Pretražite R-M grupu"
                sheetTitle="Izaberite R-M grupu proizvoda"
                value={rmCategory}
              />
            </FilterField>
          </>
        )}

        {productLineOptions.length > 0 && (
          <FilterField label="Linija proizvoda" htmlFor="product-line-filter">
            <SearchableCombobox
              ariaLabel="Linija proizvoda"
              emptyMessage="Nema linija koje odgovaraju pretrazi."
              id="product-line-filter"
              onChange={onProductLineChange}
              options={[
                { label: "Sve linije", value: "" },
                ...productLineOptions.map((option) => ({ label: option, value: option })),
              ]}
              placeholder="Sve linije"
              searchPlaceholder="Pretražite liniju"
              sheetTitle="Izaberite liniju proizvoda"
              value={productLine}
            />
          </FilterField>
        )}

        {technicalCategoryOptions.length > 0 && (
          <FilterField label="Tehnička kategorija" htmlFor="technical-category-filter">
            <SearchableCombobox
              ariaLabel="Tehnička kategorija"
              emptyMessage="Nema kategorija koje odgovaraju pretrazi."
              id="technical-category-filter"
              onChange={onTechnicalCategoryChange}
              options={[
                { label: "Sve tehničke kategorije", value: "" },
                ...technicalCategoryOptions.map((option) => ({
                  label: formatTechnicalCategory(option),
                  value: option,
                })),
              ]}
              placeholder="Sve kategorije"
              searchPlaceholder="Pretražite kategoriju"
              sheetTitle="Izaberite tehničku kategoriju"
              value={technicalCategory}
            />
          </FilterField>
        )}

        {finishOptions.length > 0 && (
          <FilterField label="Završnica" htmlFor="finish-filter">
            <SearchableCombobox
              ariaLabel="Završnica"
              emptyMessage="Nema završnica koje odgovaraju pretrazi."
              id="finish-filter"
              onChange={onFinishChange}
              options={[
                { label: "Sve završnice", value: "" },
                ...finishOptions.map((option) => ({ label: option, value: option })),
              ]}
              placeholder="Sve završnice"
              searchPlaceholder="Pretražite završnicu"
              sheetTitle="Izaberite završnicu"
              value={finish}
            />
          </FilterField>
        )}

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
      </div>
    </aside>
  );
}

function formatTechnicalCategory(value: string) {
  return value
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
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
