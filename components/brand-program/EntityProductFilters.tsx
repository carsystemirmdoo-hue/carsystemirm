"use client";

import { useMemo, useState } from "react";
import { EntityProductCard } from "@/components/brand-program/EntityProductCard";
import { SearchableCombobox } from "@/components/ui/SearchableCombobox";
import type {
  CarsystemBrand,
  CarsystemProduct,
  ProgramGroup,
  RefinishPhase,
} from "@/lib/carsystem-data";
import styles from "./BrandProgramPage.module.css";

type EntityProductFiltersProps = {
  brands: CarsystemBrand[];
  contextLabel: string;
  fixedBrandSlug?: string;
  fixedProgramSlug?: string;
  idPrefix: string;
  phases: RefinishPhase[];
  products: CarsystemProduct[];
  programs: ProgramGroup[];
};

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, "sr-Latn"),
  );
}

export function EntityProductFilters({
  brands,
  contextLabel,
  fixedBrandSlug = "",
  fixedProgramSlug = "",
  idPrefix,
  phases,
  products,
  programs,
}: EntityProductFiltersProps) {
  const [query, setQuery] = useState("");
  const [brandSlug, setBrandSlug] = useState("");
  const [programSlug, setProgramSlug] = useState("");
  const [phaseSlug, setPhaseSlug] = useState("");
  const [typeTag, setTypeTag] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);

  const brandBySlug = useMemo(
    () => new Map(brands.map((brand) => [brand.slug, brand])),
    [brands],
  );
  const programBySlug = useMemo(
    () => new Map(programs.map((program) => [program.slug, program])),
    [programs],
  );
  const phaseBySlug = useMemo(
    () => new Map(phases.map((phase) => [phase.slug, phase])),
    [phases],
  );

  const visibleBrandOptions = useMemo(() => {
    const slugs = new Set(products.map((product) => product.brandSlug));
    return brands.filter((brand) => slugs.has(brand.slug));
  }, [brands, products]);

  const visibleProgramOptions = useMemo(() => {
    const slugs = new Set(products.map((product) => product.programSlug));
    return programs.filter((program) => slugs.has(program.slug));
  }, [products, programs]);

  const visiblePhaseOptions = useMemo(() => {
    const slugs = new Set(products.map((product) => product.phaseSlug));
    return phases.filter((phase) => slugs.has(phase.slug));
  }, [phases, products]);

  const typeOptions = useMemo(
    () =>
      uniqueSorted(
        products.flatMap((product) =>
          product.badges.filter((badge) => badge !== "Na upit"),
        ),
      ),
    [products],
  );

  const filteredProducts = useMemo(() => {
    const normalizedQuery = normalize(query.trim());

    return products.filter((product) => {
      const effectiveBrand = fixedBrandSlug || brandSlug;
      const effectiveProgram = fixedProgramSlug || programSlug;
      const brand = brandBySlug.get(product.brandSlug);
      const program = programBySlug.get(product.programSlug);
      const phase = phaseBySlug.get(product.phaseSlug);

      if (effectiveBrand && product.brandSlug !== effectiveBrand) return false;
      if (effectiveProgram && product.programSlug !== effectiveProgram) return false;
      if (phaseSlug && product.phaseSlug !== phaseSlug) return false;
      if (typeTag && !product.badges.includes(typeTag)) return false;

      if (!normalizedQuery) return true;

      const haystack = normalize(
        [
          product.name,
          product.shortDescription,
          product.longDescription,
          product.purpose,
          product.sku,
          brand?.name ?? "",
          program?.name ?? "",
          phase?.name ?? "",
          product.badges.join(" "),
        ].join(" "),
      );

      return haystack.includes(normalizedQuery);
    });
  }, [
    brandBySlug,
    brandSlug,
    fixedBrandSlug,
    fixedProgramSlug,
    phaseBySlug,
    phaseSlug,
    products,
    programBySlug,
    programSlug,
    query,
    typeTag,
  ]);

  function clearFilters() {
    setQuery("");
    setBrandSlug("");
    setProgramSlug("");
    setPhaseSlug("");
    setTypeTag("");
    setFiltersOpen(false);
  }

  const hasActiveFilters =
    Boolean(query.trim()) || Boolean(brandSlug) || Boolean(programSlug) ||
    Boolean(phaseSlug) || Boolean(typeTag);
  const filtersId = `${idPrefix}-filters`;

  if (products.length === 0) {
    return (
      <div className={styles.emptyState}>
        <strong>Proizvodi se povezuju sa katalogom.</strong>
        <p>
          Ova sekcija je spremna za povezivanje sa artiklima iz kataloga. Upit
          može da ide direktno timu za tehničku podršku.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className={styles.entityMobileFilterBar}>
        <button
          className={styles.entityFilterToggle}
          type="button"
          aria-expanded={filtersOpen}
          aria-controls={filtersId}
          onClick={() => setFiltersOpen((open) => !open)}
        >
          Filteri
        </button>
        <span>{filteredProducts.length} proizvoda</span>
      </div>

      <div
        className={`${styles.entityProductLayout} ${
          desktopCollapsed ? styles.entityProductLayoutCollapsed : ""
        }`}
      >
        <div className={styles.entityFiltersSlot}>
          <aside
            id={filtersId}
            className={`${styles.entityFilters} ${filtersOpen ? styles.entityFiltersOpen : ""}`}
            aria-label={`Filteri za ${contextLabel}`}
          >
            <div className={styles.entityFiltersHeader}>
              <div>
                <p className={styles.sectionKicker}>Filteri</p>
                <h3>{contextLabel}</h3>
              </div>
              <div className={styles.entityFilterActions}>
                {hasActiveFilters ? (
                  <button type="button" onClick={clearFilters}>
                    Resetuj
                  </button>
                ) : null}
                <button
                  type="button"
                  aria-label="Sakrij filtere"
                  aria-controls={filtersId}
                  onClick={() => setDesktopCollapsed(true)}
                >
                  <span aria-hidden="true">«</span>
                </button>
              </div>
            </div>

            <label className={styles.entityField} htmlFor={`${idPrefix}-query`}>
              <span>Pretraga</span>
              <input
                id={`${idPrefix}-query`}
                value={query}
                onChange={(event) => setQuery(event.target.value.slice(0, 80))}
                placeholder="Naziv, šifra ili namena..."
                type="search"
              />
            </label>

            {!fixedBrandSlug && (
              <div className={styles.entityField}>
                <span>Brend</span>
                <SearchableCombobox
                  ariaLabel="Brend"
                  emptyMessage="Nema brendova koji odgovaraju pretrazi."
                  id={`${idPrefix}-brand`}
                  onChange={setBrandSlug}
                  options={[
                    { label: "Svi brendovi", value: "" },
                    ...visibleBrandOptions.map((brand) => ({
                      label: brand.name,
                      value: brand.slug,
                    })),
                  ]}
                  placeholder="Svi brendovi"
                  searchPlaceholder="Pretražite brend"
                  sheetTitle="Izaberite brend"
                  value={brandSlug}
                />
              </div>
            )}

            {!fixedProgramSlug && (
              <div className={styles.entityField}>
                <span>Program</span>
                <SearchableCombobox
                  ariaLabel="Program"
                  emptyMessage="Nema programa koji odgovaraju pretrazi."
                  id={`${idPrefix}-program`}
                  onChange={setProgramSlug}
                  options={[
                    { label: "Svi programi", value: "" },
                    ...visibleProgramOptions.map((program) => ({
                      label: program.name,
                      value: program.slug,
                    })),
                  ]}
                  placeholder="Svi programi"
                  searchPlaceholder="Pretražite program"
                  sheetTitle="Izaberite program"
                  value={programSlug}
                />
              </div>
            )}

            <div className={styles.entityField}>
              <span>Faza</span>
              <SearchableCombobox
                ariaLabel="Faza"
                emptyMessage="Nema faza koje odgovaraju pretrazi."
                id={`${idPrefix}-phase`}
                onChange={setPhaseSlug}
                options={[
                  { label: "Sve faze", value: "" },
                  ...visiblePhaseOptions.map((phase) => ({
                    label: phase.name,
                    value: phase.slug,
                  })),
                ]}
                placeholder="Sve faze"
                searchPlaceholder="Pretražite fazu"
                sheetTitle="Izaberite fazu"
                value={phaseSlug}
              />
            </div>

            <div className={styles.entityField}>
              <span>Namena / tip</span>
              <SearchableCombobox
                ariaLabel="Namena ili tip"
                emptyMessage="Nema tipova koji odgovaraju pretrazi."
                id={`${idPrefix}-type`}
                onChange={setTypeTag}
                options={[
                  { label: "Svi tipovi", value: "" },
                  ...typeOptions.map((option) => ({ label: option, value: option })),
                ]}
                placeholder="Svi tipovi"
                searchPlaceholder="Pretražite tip"
                sheetTitle="Izaberite namenu ili tip"
                value={typeTag}
              />
            </div>
          </aside>

          <button
            className={styles.entityFiltersExpand}
            type="button"
            aria-label="Prikaži filtere"
            aria-controls={filtersId}
            onClick={() => setDesktopCollapsed(false)}
          >
            <span aria-hidden="true">»</span>
            <small>Filteri</small>
          </button>
        </div>

        <div className={styles.entityResults}>
          <div className={styles.entityResultsHeader}>
            <strong>{filteredProducts.length} proizvoda</strong>
            <span>{products.length} ukupno</span>
          </div>

          {filteredProducts.length > 0 ? (
            <div className={styles.productGrid}>
              {filteredProducts.map((product) => {
                const brand = brandBySlug.get(product.brandSlug);
                const program = programBySlug.get(product.programSlug);
                const phase = phaseBySlug.get(product.phaseSlug);
                if (!brand || !program || !phase) return null;

                return (
                  <EntityProductCard
                    brand={brand}
                    key={product.slug}
                    phase={phase}
                    product={product}
                    program={program}
                  />
                );
              })}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <strong>Nema proizvoda za izabrane filtere.</strong>
              <p>Resetujte filtere ili pošaljite upit za tehničku preporuku.</p>
              <button className={styles.primaryButton} type="button" onClick={clearFilters}>
                Resetuj filtere
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
