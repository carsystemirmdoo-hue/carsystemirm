"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CatalogFilters } from "@/components/catalog/CatalogFilters";
import { CatalogProductGrid } from "@/components/catalog/CatalogProductGrid";
import { CatalogSupportCta } from "@/components/catalog/CatalogSupportCta";
import type {
  CarsystemBrand,
  CarsystemProduct,
  ProgramGroup,
  RefinishPhase,
} from "@/lib/carsystem-data";
import styles from "./CatalogPage.module.css";

type CatalogModule = {
  key: string;
  label: string;
  detail: string;
  slug: string;
  programSlugs: string[];
};

type CatalogUrlFilters = {
  activeModule: string;
  brandSlug: string;
  phaseSlug: string;
  programSlug: string;
  query: string;
  status: string;
};

const CATALOG_PAGE_SIZE = 48;

const catalogModules: CatalogModule[] = [
  {
    key: "boje",
    label: "Boje i lakovi",
    detail: "Bazni sloj i završni lak",
    slug: "boje-i-lakovi",
    programSlugs: ["boje-i-lakovi"],
  },
  {
    key: "priprema",
    label: "Priprema i abrazivi",
    detail: "Kitovi, prajmeri, brušenje",
    slug: "priprema-i-abrazivi",
    programSlugs: ["priprema-povrsine", "abrazivi"],
  },
  {
    key: "oprema",
    label: "Pištolji i oprema",
    detail: "Nanošenje materijala",
    slug: "pistolji-i-oprema",
    programSlugs: ["oprema"],
  },
  {
    key: "poliranje",
    label: "Poliranje",
    detail: "Završna korekcija",
    slug: "poliranje",
    programSlugs: ["poliranje"],
  },
  {
    key: "potrosni",
    label: "Potrošni materijal",
    detail: "Maskiranje i radionica",
    slug: "potrosni-materijal",
    programSlugs: ["potrosni-materijal"],
  },
];

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function firstParam(searchParams: URLSearchParams, key: string) {
  return searchParams.get(key)?.trim() ?? "";
}

function filtersEqual(first: CatalogUrlFilters, second: CatalogUrlFilters) {
  return (
    first.activeModule === second.activeModule &&
    first.brandSlug === second.brandSlug &&
    first.phaseSlug === second.phaseSlug &&
    first.programSlug === second.programSlug &&
    first.query === second.query &&
    first.status === second.status
  );
}

function parseCatalogUrlFilters({
  brandSlugs,
  phaseSlugs,
  programSlugs,
  searchParams,
}: {
  brandSlugs: Set<string>;
  phaseSlugs: Set<string>;
  programSlugs: Set<string>;
  searchParams: URLSearchParams;
}): CatalogUrlFilters {
  const brandParam = firstParam(searchParams, "brand");
  const programParam = firstParam(searchParams, "program");
  const phaseParam = firstParam(searchParams, "faza");
  const statusParam = firstParam(searchParams, "dostupnost");
  const queryParam = firstParam(searchParams, "q").slice(0, 80);
  const catalogModule = catalogModules.find((item) => item.slug === programParam);

  return {
    activeModule: catalogModule ? catalogModule.key : "",
    brandSlug: brandSlugs.has(brandParam) ? brandParam : "",
    phaseSlug: phaseSlugs.has(phaseParam) ? phaseParam : "",
    programSlug: !catalogModule && programSlugs.has(programParam) ? programParam : "",
    query: queryParam,
    status: statusParam === "na-upit" ? statusParam : "",
  };
}

function buildCatalogSearch(filters: CatalogUrlFilters) {
  const params = new URLSearchParams();
  const activeCatalogModule = catalogModules.find(
    (catalogModule) => catalogModule.key === filters.activeModule,
  );

  if (filters.brandSlug) params.set("brand", filters.brandSlug);
  if (activeCatalogModule) params.set("program", activeCatalogModule.slug);
  else if (filters.programSlug) params.set("program", filters.programSlug);
  if (filters.phaseSlug) params.set("faza", filters.phaseSlug);
  if (filters.status) params.set("dostupnost", filters.status);
  if (filters.query.trim()) params.set("q", filters.query.trim());

  return params.toString();
}

export function CatalogExplorer({
  products,
  brands,
  programs,
  phases,
}: {
  products: CarsystemProduct[];
  brands: CarsystemBrand[];
  programs: ProgramGroup[];
  phases: RefinishPhase[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchParamsKey = searchParams.toString();
  const applyingUrlRef = useRef(false);
  const lastWrittenSearchRef = useRef<string | null>(null);
  const syncedSearchParamsRef = useRef(searchParamsKey);

  const brandSlugs = useMemo(() => new Set(brands.map((brand) => brand.slug)), [brands]);
  const programSlugs = useMemo(
    () => new Set(programs.map((program) => program.slug)),
    [programs],
  );
  const phaseSlugs = useMemo(() => new Set(phases.map((phase) => phase.slug)), [phases]);

  const urlFilters = useMemo(
    () =>
      parseCatalogUrlFilters({
        brandSlugs,
        phaseSlugs,
        programSlugs,
        searchParams: new URLSearchParams(searchParamsKey),
      }),
    [brandSlugs, phaseSlugs, programSlugs, searchParamsKey],
  );

  const [query, setQuery] = useState(urlFilters.query);
  const [brandSlug, setBrandSlug] = useState(urlFilters.brandSlug);
  const [programSlug, setProgramSlug] = useState(urlFilters.programSlug);
  const [phaseSlug, setPhaseSlug] = useState(urlFilters.phaseSlug);
  const [status, setStatus] = useState(urlFilters.status);
  const [typeTag, setTypeTag] = useState("");
  const [activeModule, setActiveModule] = useState(urlFilters.activeModule);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [desktopFiltersCollapsed, setDesktopFiltersCollapsed] = useState(false);
  const [visibleCount, setVisibleCount] = useState(CATALOG_PAGE_SIZE);

  const currentUrlFilters = useMemo(
    () => ({
      activeModule,
      brandSlug,
      phaseSlug,
      programSlug,
      query,
      status,
    }),
    [activeModule, brandSlug, phaseSlug, programSlug, query, status],
  );
  const currentUrlFiltersRef = useRef(currentUrlFilters);

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

  const typeOptions = useMemo(() => {
    const tags = new Set<string>();
    products.forEach((product) => {
      product.badges
        .filter((badge) => badge !== "Na upit")
        .forEach((badge) => tags.add(badge));
    });
    return Array.from(tags).sort((a, b) => a.localeCompare(b, "sr-Latn"));
  }, [products]);

  const activeModuleConfig = catalogModules.find(
    (catalogModule) => catalogModule.key === activeModule,
  );
  const phaseTabs = useMemo(
    () => [
      { label: "Svi proizvodi", slug: "" },
      ...[...phases]
        .sort((first, second) => first.step - second.step)
        .map((phase) => ({ label: phase.name, slug: phase.slug })),
    ],
    [phases],
  );

  useEffect(() => {
    currentUrlFiltersRef.current = currentUrlFilters;
  }, [currentUrlFilters]);

  useEffect(() => {
    if (syncedSearchParamsRef.current === searchParamsKey) return;
    syncedSearchParamsRef.current = searchParamsKey;

    if (lastWrittenSearchRef.current === searchParamsKey) {
      lastWrittenSearchRef.current = null;
      return;
    }

    if (filtersEqual(currentUrlFiltersRef.current, urlFilters)) return;

    applyingUrlRef.current = true;
    setQuery(urlFilters.query);
    setBrandSlug(urlFilters.brandSlug);
    setProgramSlug(urlFilters.programSlug);
    setPhaseSlug(urlFilters.phaseSlug);
    setStatus(urlFilters.status);
    setActiveModule(urlFilters.activeModule);
    setTypeTag("");
    setFiltersOpen(false);
  }, [searchParamsKey, urlFilters]);

  useEffect(() => {
    if (applyingUrlRef.current) {
      applyingUrlRef.current = false;
      return;
    }

    const nextSearch = buildCatalogSearch(currentUrlFilters);
    if (nextSearch === searchParamsKey) return;

    lastWrittenSearchRef.current = nextSearch;
    router.replace(nextSearch ? `${pathname}?${nextSearch}` : pathname, { scroll: false });
  }, [currentUrlFilters, pathname, router, searchParamsKey]);

  const filteredProducts = useMemo(() => {
    const normalizedQuery = normalize(query.trim());

    return products.filter((product) => {
      const brand = brandBySlug.get(product.brandSlug);
      const program = programBySlug.get(product.programSlug);
      const phase = phaseBySlug.get(product.phaseSlug);

      if (brandSlug && product.brandSlug !== brandSlug) return false;
      if (programSlug && product.programSlug !== programSlug) return false;
      if (
        activeModuleConfig &&
        !programSlug &&
        !activeModuleConfig.programSlugs.includes(product.programSlug)
      ) {
        return false;
      }
      if (phaseSlug && product.phaseSlug !== phaseSlug) return false;
      if (status === "na-upit" && !product.badges.includes("Na upit")) return false;
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
    activeModuleConfig,
    brandBySlug,
    brandSlug,
    phaseBySlug,
    phaseSlug,
    products,
    programBySlug,
    programSlug,
    query,
    status,
    typeTag,
  ]);

  useEffect(() => {
    setVisibleCount(CATALOG_PAGE_SIZE);
  }, [currentUrlFilters, typeTag]);

  const visibleProducts = useMemo(
    () => filteredProducts.slice(0, visibleCount),
    [filteredProducts, visibleCount],
  );

  const hasMoreProducts = visibleProducts.length < filteredProducts.length;

  function clearFilters() {
    setQuery("");
    setBrandSlug("");
    setProgramSlug("");
    setPhaseSlug("");
    setStatus("");
    setTypeTag("");
    setActiveModule("");
  }

  function selectPhaseTab(nextPhaseSlug: string) {
    setPhaseSlug(nextPhaseSlug);
    setActiveModule("");
    setFiltersOpen(false);
  }

  function updateScopedFilter(setter: (value: string) => void, value: string) {
    setter(value);
    setActiveModule("");
  }

  const hasActiveFilters =
    Boolean(query.trim()) ||
    Boolean(brandSlug) ||
    Boolean(programSlug) ||
    Boolean(phaseSlug) ||
    Boolean(status) ||
    Boolean(typeTag) ||
    Boolean(activeModule);

  return (
    <main className={styles.main}>
      <section className={styles.hero} aria-labelledby="catalog-title">
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>Katalog, Carsystem i R-M</p>
          <h1 id="catalog-title" className={styles.title}>
            Katalog proizvoda
          </h1>
          <p className={styles.subtitle}>
            Pregled programa za pripremu, bojenje, lakiranje i završnu obradu vozila.
            Izaberite kategoriju, uporedite proizvode i pošaljite upit za materijal koji
            odgovara vašem poslu.
          </p>
        </div>

        <div className={styles.heroTools}>
          <label className={styles.searchLabel} htmlFor="catalog-search">
            Pretraga
          </label>
          <input
            id="catalog-search"
            className={styles.searchInput}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value.slice(0, 80))}
            placeholder="Pretraži proizvode..."
          />

          <div className={styles.quickStats} aria-label="Brzi pregled kataloga">
            <span>{brands.length} brendova</span>
            <span>{programs.length} programa</span>
            <span>Tehnička podrška</span>
            <span>Na upit</span>
          </div>
        </div>
      </section>

      <section className={styles.phaseRail} aria-label="Faze refinish procesa">
        <div className={styles.phaseTabs}>
          {phaseTabs.map((phaseTab) => {
            const isActive = phaseSlug === phaseTab.slug;

            return (
              <button
                className={`${styles.phaseTab} ${isActive ? styles.phaseTabActive : ""}`}
                key={phaseTab.slug || "all"}
                type="button"
                aria-pressed={isActive}
                data-cursor="button"
                data-motion-surface
                onClick={() => selectPhaseTab(phaseTab.slug)}
              >
                {phaseTab.label}
                <span aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </section>

      <div className={styles.mobileFilterBar}>
        <button
          className={`${styles.filterToggle} cs-interactive-surface`}
          type="button"
          aria-expanded={filtersOpen}
          aria-controls="catalog-filters"
          data-cursor="button"
          data-motion-surface
          onClick={() => setFiltersOpen((open) => !open)}
        >
          Filteri
        </button>
        <p>{filteredProducts.length} proizvoda</p>
      </div>

      <section
        className={`${styles.catalogLayout} ${
          desktopFiltersCollapsed ? styles.catalogLayoutCollapsed : ""
        }`}
        aria-label="Katalog proizvoda"
      >
        <div className={styles.filtersSlot}>
          <CatalogFilters
            activeModuleLabel={activeModuleConfig?.label ?? ""}
            brands={brands}
            brandSlug={brandSlug}
            filtersOpen={filtersOpen}
            hasActiveFilters={hasActiveFilters}
            onBrandChange={(value) => updateScopedFilter(setBrandSlug, value)}
            onClear={clearFilters}
            onDesktopCollapseChange={setDesktopFiltersCollapsed}
            onMobileClose={() => setFiltersOpen(false)}
            onPhaseChange={(value) => updateScopedFilter(setPhaseSlug, value)}
            onProgramChange={(value) => {
              setProgramSlug(value);
              setActiveModule("");
            }}
            onStatusChange={(value) => updateScopedFilter(setStatus, value)}
            onTypeChange={(value) => updateScopedFilter(setTypeTag, value)}
            phases={phases}
            phaseSlug={phaseSlug}
            programs={programs}
            programSlug={programSlug}
            status={status}
            typeOptions={typeOptions}
            typeTag={typeTag}
          />
          <button
            className={`${styles.filtersExpandTab} cs-interactive-surface`}
            type="button"
            aria-label="Prikaži filtere"
            aria-controls="catalog-filters"
            data-cursor="button"
            data-motion-surface
            onClick={() => setDesktopFiltersCollapsed(false)}
          >
            <span aria-hidden="true">»</span>
            <small>Filteri</small>
          </button>
        </div>

        <CatalogProductGrid
          brandBySlug={brandBySlug}
          onReset={clearFilters}
          phaseBySlug={phaseBySlug}
          products={visibleProducts}
          programBySlug={programBySlug}
          resultCount={filteredProducts.length}
          shownCount={visibleProducts.length}
          totalCount={products.length}
        />

        {hasMoreProducts && (
          <div className={styles.loadMoreWrap}>
            <button
              className={`${styles.loadMoreButton} cs-magnetic-cta cs-theme-wipe-card`}
              type="button"
              data-cursor="button"
              data-motion-surface
              data-motion="theme-wipe"
              onClick={() =>
                setVisibleCount((count) =>
                  Math.min(count + CATALOG_PAGE_SIZE, filteredProducts.length),
                )
              }
            >
              <span>Prikaži još proizvoda</span>
            </button>
            <p className={styles.loadMoreMeta}>
              Prikazano {visibleProducts.length} od {filteredProducts.length}
            </p>
          </div>
        )}
      </section>

      <CatalogSupportCta />
    </main>
  );
}
