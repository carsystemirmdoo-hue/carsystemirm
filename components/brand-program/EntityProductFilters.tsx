"use client";

import { useEffect, useMemo, useState } from "react";
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
  showQuickPhaseFilters?: boolean;
};

const ENTITY_PAGE_SIZE = 48;

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
  showQuickPhaseFilters = false,
}: EntityProductFiltersProps) {
  const [query, setQuery] = useState("");
  const [brandSlug, setBrandSlug] = useState("");
  const [programSlug, setProgramSlug] = useState("");
  const [phaseSlug, setPhaseSlug] = useState("");
  const [typeTag, setTypeTag] = useState("");
  const [productLine, setProductLine] = useState("");
  const [technicalCategory, setTechnicalCategory] = useState("");
  const [finish, setFinish] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [visibleCount, setVisibleCount] = useState(ENTITY_PAGE_SIZE);

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
  const productLineOptions = useMemo(
    () =>
      uniqueSorted(
        products
          .map((product) => product.catalogMetadata?.line)
          .filter((value): value is string => Boolean(value)),
      ),
    [products],
  );
  const technicalCategoryOptions = useMemo(
    () =>
      uniqueSorted(
        products
          .map((product) => product.catalogMetadata?.technicalCategory)
          .filter((value): value is string => Boolean(value)),
      ),
    [products],
  );
  const finishOptions = useMemo(
    () =>
      uniqueSorted(
        products
          .map((product) => product.catalogMetadata?.finish)
          .filter((value): value is string => Boolean(value)),
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
      if (productLine && product.catalogMetadata?.line !== productLine) return false;
      if (
        technicalCategory &&
        product.catalogMetadata?.technicalCategory !== technicalCategory
      ) {
        return false;
      }
      if (finish && product.catalogMetadata?.finish !== finish) return false;

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
          product.catalogMetadata?.officialName ?? "",
          product.catalogMetadata?.displayNameSr ?? "",
          product.catalogMetadata?.cosmosCode ?? "",
          product.catalogMetadata?.ralCode ?? "",
          product.catalogMetadata?.colorName ?? "",
          product.catalogMetadata?.line ?? "",
          product.catalogMetadata?.technicalCategory ?? "",
          product.catalogMetadata?.finish ?? "",
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
    productLine,
    technicalCategory,
    finish,
  ]);

  useEffect(() => {
    setVisibleCount(ENTITY_PAGE_SIZE);
  }, [brandSlug, finish, phaseSlug, productLine, programSlug, query, technicalCategory, typeTag]);

  const visibleProducts = useMemo(
    () => filteredProducts.slice(0, visibleCount),
    [filteredProducts, visibleCount],
  );

  function clearFilters() {
    setQuery("");
    setBrandSlug("");
    setProgramSlug("");
    setPhaseSlug("");
    setTypeTag("");
    setProductLine("");
    setTechnicalCategory("");
    setFinish("");
    setFiltersOpen(false);
  }

  const hasActiveFilters =
    Boolean(query.trim()) || Boolean(brandSlug) || Boolean(programSlug) ||
    Boolean(phaseSlug) || Boolean(typeTag) || Boolean(productLine) ||
    Boolean(technicalCategory) || Boolean(finish);
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
      {showQuickPhaseFilters ? (
        <div className={styles.quickPhaseFilters}>
          <span id={`${idPrefix}-quick-phases-label`}>Brzi filter po fazi</span>
          <div
            className={styles.quickPhaseList}
            role="group"
            aria-labelledby={`${idPrefix}-quick-phases-label`}
          >
            <button
              type="button"
              aria-pressed={!phaseSlug}
              data-active={!phaseSlug || undefined}
              onClick={() => setPhaseSlug("")}
            >
              Sve faze
            </button>
            {[...visiblePhaseOptions]
              .sort((first, second) => first.step - second.step)
              .map((phase) => (
                <button
                  type="button"
                  aria-pressed={phaseSlug === phase.slug}
                  data-active={phaseSlug === phase.slug || undefined}
                  key={phase.slug}
                  onClick={() => setPhaseSlug(phase.slug)}
                >
                  {phase.name}
                </button>
              ))}
          </div>
        </div>
      ) : null}

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
                    Resetujte
                  </button>
                ) : null}
                <button
                  type="button"
                  aria-label="Sakrijte filtere"
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

            {!showQuickPhaseFilters ? (
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
            ) : null}

            {productLineOptions.length > 0 && (
              <div className={styles.entityField}>
                <span>Linija proizvoda</span>
                <SearchableCombobox
                  ariaLabel="Linija proizvoda"
                  emptyMessage="Nema linija koje odgovaraju pretrazi."
                  id={`${idPrefix}-line`}
                  onChange={setProductLine}
                  options={[
                    { label: "Sve linije", value: "" },
                    ...productLineOptions.map((option) => ({
                      label: option,
                      value: option,
                    })),
                  ]}
                  placeholder="Sve linije"
                  searchPlaceholder="Pretražite liniju"
                  sheetTitle="Izaberite liniju proizvoda"
                  value={productLine}
                />
              </div>
            )}

            {technicalCategoryOptions.length > 0 && (
              <div className={styles.entityField}>
                <span>Tehnička kategorija</span>
                <SearchableCombobox
                  ariaLabel="Tehnička kategorija"
                  emptyMessage="Nema kategorija koje odgovaraju pretrazi."
                  id={`${idPrefix}-technical-category`}
                  onChange={setTechnicalCategory}
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
              </div>
            )}

            {finishOptions.length > 0 && (
              <div className={styles.entityField}>
                <span>Završnica</span>
                <SearchableCombobox
                  ariaLabel="Završnica"
                  emptyMessage="Nema završnica koje odgovaraju pretrazi."
                  id={`${idPrefix}-finish`}
                  onChange={setFinish}
                  options={[
                    { label: "Sve završnice", value: "" },
                    ...finishOptions.map((option) => ({
                      label: option,
                      value: option,
                    })),
                  ]}
                  placeholder="Sve završnice"
                  searchPlaceholder="Pretražite završnicu"
                  sheetTitle="Izaberite završnicu"
                  value={finish}
                />
              </div>
            )}

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
            aria-label="Prikažite filtere"
            aria-controls={filtersId}
            onClick={() => setDesktopCollapsed(false)}
          >
            <span aria-hidden="true">»</span>
            <small>Filteri</small>
          </button>
        </div>

        <div className={styles.entityResults}>
          <p className="sr-only" role="status" aria-atomic="true" aria-live="polite">
            Prikazano {visibleProducts.length} od {filteredProducts.length} proizvoda
          </p>

          {filteredProducts.length > 0 ? (
            <>
              <div className={styles.productGrid}>
              {visibleProducts.map((product) => {
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
              {visibleProducts.length < filteredProducts.length && (
                <div className={styles.entityLoadMore}>
                  <button
                    className={styles.primaryButton}
                    type="button"
                    onClick={() =>
                      setVisibleCount((count) =>
                        Math.min(count + ENTITY_PAGE_SIZE, filteredProducts.length),
                      )
                    }
                  >
                    Prikažite još proizvoda
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className={styles.emptyState}>
              <strong>Nema proizvoda za izabrane filtere.</strong>
              <p>Resetujte filtere ili pošaljite upit za tehničku preporuku.</p>
              <button className={styles.primaryButton} type="button" onClick={clearFilters}>
                Resetujte filtere
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function formatTechnicalCategory(value: string) {
  return value
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
