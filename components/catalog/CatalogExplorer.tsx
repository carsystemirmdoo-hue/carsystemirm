"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ManufacturerRail } from "@/components/brand/ManufacturerRail";
import { CatalogFilters } from "@/components/catalog/CatalogFilters";
import { CatalogPaginationNav } from "@/components/catalog/CatalogSeoContent";
import {
  CATALOG_BATCH_SIZE,
  getCatalogGridColumnCount,
  getCatalogNextVisibleCount,
  getCatalogPreloadTriggerIndex,
} from "@/components/catalog/catalogInfiniteScroll.mjs";
import { CatalogProductGrid } from "@/components/catalog/CatalogProductGrid";
import { CatalogSupportCta } from "@/components/catalog/CatalogSupportCta";
import {
  rmCategorySlugs,
  rmSeriesSlugs,
  rmSystemSlugs,
  type RmCategorySlug,
  type RmSeriesSlug,
  type RmSystemSlug,
  type CarsystemBrand,
  type CarsystemProduct,
  type ProgramGroup,
  type RefinishPhase,
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
  rmCategory: string;
  rmSeries: string;
  rmSystem: string;
  status: string;
};

const rmSystemLabels: Record<RmSystemSlug, string> = {
  agilis: "AGILIS",
  "onyx-hd": "ONYX HD",
  diamont: "DIAMONT",
  "uno-hd": "UNO HD",
  "crystal-base": "CRYSTAL BASE",
  "graphite-hd": "GRAPHITE HD",
};

const rmSeriesLabels: Record<RmSeriesSlug, string> = {
  pioneer: "Pioneer Series",
  advance: "Advance Series",
  element: "Element Series",
};

const rmCategoryLabels: Record<RmCategorySlug, string> = {
  basecoat: "Bazne boje",
  clearcoat: "Bezbojni lakovi",
  "primer-filler": "Prajmeri i punioci",
  bodyfiller: "Kitovi",
  hardener: "Učvršćivači",
  thinner: "Razređivači",
  additive: "Aditivi",
  cleaner: "Čistači",
  "polishing-compound": "Paste za poliranje",
};

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
    first.rmCategory === second.rmCategory &&
    first.rmSeries === second.rmSeries &&
    first.rmSystem === second.rmSystem &&
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
  const brandParam =
    firstParam(searchParams, "brend") || firstParam(searchParams, "brand");
  const programParam = firstParam(searchParams, "program");
  const phaseParam = firstParam(searchParams, "faza");
  const statusParam = firstParam(searchParams, "dostupnost");
  const queryParam = firstParam(searchParams, "q").slice(0, 80);
  const rmSystemParam = firstParam(searchParams, "sistem");
  const rmSeriesParam = firstParam(searchParams, "serija");
  const rmCategoryParam = firstParam(searchParams, "rm-kategorija");
  const catalogModule = catalogModules.find((item) => item.slug === programParam);

  return {
    activeModule: catalogModule ? catalogModule.key : "",
    brandSlug: brandSlugs.has(brandParam) ? brandParam : "",
    phaseSlug: phaseSlugs.has(phaseParam) ? phaseParam : "",
    programSlug: !catalogModule && programSlugs.has(programParam) ? programParam : "",
    query: queryParam,
    rmCategory: rmCategorySlugs.includes(rmCategoryParam as RmCategorySlug)
      ? rmCategoryParam
      : "",
    rmSeries: rmSeriesSlugs.includes(rmSeriesParam as RmSeriesSlug)
      ? rmSeriesParam
      : "",
    rmSystem: rmSystemSlugs.includes(rmSystemParam as RmSystemSlug)
      ? rmSystemParam
      : "",
    status: statusParam === "na-upit" ? statusParam : "",
  };
}

function buildCatalogSearch(filters: CatalogUrlFilters, currentSearch = "") {
  const params = new URLSearchParams(currentSearch);
  const activeCatalogModule = catalogModules.find(
    (catalogModule) => catalogModule.key === filters.activeModule,
  );

  params.delete("brand");
  params.delete("brend");
  params.delete("program");
  params.delete("faza");
  params.delete("dostupnost");
  params.delete("q");
  params.delete("sistem");
  params.delete("serija");
  params.delete("rm-kategorija");

  if (filters.brandSlug) params.set("brend", filters.brandSlug);
  if (activeCatalogModule) params.set("program", activeCatalogModule.slug);
  else if (filters.programSlug) params.set("program", filters.programSlug);
  if (filters.phaseSlug) params.set("faza", filters.phaseSlug);
  if (filters.status) params.set("dostupnost", filters.status);
  if (filters.query.trim()) params.set("q", filters.query.trim());
  if (filters.rmSystem) params.set("sistem", filters.rmSystem);
  if (filters.rmSeries) params.set("serija", filters.rmSeries);
  if (filters.rmCategory) params.set("rm-kategorija", filters.rmCategory);

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
  const [rmSystem, setRmSystem] = useState(urlFilters.rmSystem);
  const [rmSeries, setRmSeries] = useState(urlFilters.rmSeries);
  const [rmCategory, setRmCategory] = useState(urlFilters.rmCategory);
  const [typeTag, setTypeTag] = useState("");
  const [productLine, setProductLine] = useState("");
  const [technicalCategory, setTechnicalCategory] = useState("");
  const [finish, setFinish] = useState("");
  const [activeModule, setActiveModule] = useState(urlFilters.activeModule);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [desktopFiltersCollapsed, setDesktopFiltersCollapsed] = useState(false);
  const paginationKey = [
    query.trim(),
    brandSlug,
    programSlug,
    phaseSlug,
    status,
    rmSystem,
    rmSeries,
    rmCategory,
    typeTag,
    productLine,
    technicalCategory,
    finish,
    activeModule,
  ].join("\u001f");
  const [pagination, setPagination] = useState({
    key: paginationKey,
    count: CATALOG_BATCH_SIZE,
  });
  const [productGridElement, setProductGridElement] = useState<HTMLDivElement | null>(
    null,
  );
  const [preloadTriggerElement, setPreloadTriggerElement] =
    useState<HTMLAnchorElement | null>(null);
  const [gridColumnCount, setGridColumnCount] = useState(1);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadingNextBatchRef = useRef(false);
  const paginationKeyRef = useRef(paginationKey);
  const filteredProductsLengthRef = useRef(products.length);

  const currentUrlFilters = useMemo(
    () => ({
      activeModule,
      brandSlug,
      phaseSlug,
      programSlug,
      query,
      rmCategory,
      rmSeries,
      rmSystem,
      status,
    }),
    [
      activeModule,
      brandSlug,
      phaseSlug,
      programSlug,
      query,
      rmCategory,
      rmSeries,
      rmSystem,
      status,
    ],
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
  const productLineOptions = useMemo(
    () =>
      Array.from(
        new Set(
          products
            .map((product) => product.catalogMetadata?.line)
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((first, second) => first.localeCompare(second, "sr-Latn")),
    [products],
  );
  const technicalCategoryOptions = useMemo(
    () =>
      Array.from(
        new Set(
          products
            .map((product) => product.catalogMetadata?.technicalCategory)
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((first, second) => first.localeCompare(second, "sr-Latn")),
    [products],
  );
  const finishOptions = useMemo(
    () =>
      Array.from(
        new Set(
          products
            .map((product) => product.catalogMetadata?.finish)
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((first, second) => first.localeCompare(second, "sr-Latn")),
    [products],
  );
  const rmSystemOptions = useMemo(
    () =>
      rmSystemSlugs.map((value) => ({
        label: rmSystemLabels[value],
        value,
      })),
    [],
  );
  const rmSeriesOptions = useMemo(
    () =>
      rmSeriesSlugs.map((value) => ({
        label: rmSeriesLabels[value],
        value,
      })),
    [],
  );
  const rmCategoryOptions = useMemo(
    () =>
      rmCategorySlugs.map((value) => ({
        label: rmCategoryLabels[value],
        value,
      })),
    [],
  );

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
    setRmSystem(urlFilters.rmSystem);
    setRmSeries(urlFilters.rmSeries);
    setRmCategory(urlFilters.rmCategory);
    setActiveModule(urlFilters.activeModule);
    setTypeTag("");
    setProductLine("");
    setTechnicalCategory("");
    setFinish("");
    setFiltersOpen(false);
  }, [searchParamsKey, urlFilters]);

  useEffect(() => {
    if (applyingUrlRef.current) {
      applyingUrlRef.current = false;
      return;
    }

    const nextSearch = buildCatalogSearch(currentUrlFilters, searchParamsKey);
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
      if (rmSystem && product.rmMetadata?.system !== rmSystem) return false;
      if (rmSeries && product.rmMetadata?.series !== rmSeries) return false;
      if (rmCategory && product.rmMetadata?.category !== rmCategory) return false;
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
    activeModuleConfig,
    brandBySlug,
    brandSlug,
    phaseBySlug,
    phaseSlug,
    products,
    programBySlug,
    programSlug,
    query,
    rmCategory,
    rmSeries,
    rmSystem,
    status,
    typeTag,
    productLine,
    technicalCategory,
    finish,
  ]);

  paginationKeyRef.current = paginationKey;
  filteredProductsLengthRef.current = filteredProducts.length;

  useEffect(() => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    loadingNextBatchRef.current = false;
    setPagination((current) =>
      current.key === paginationKey && current.count === CATALOG_BATCH_SIZE
        ? current
        : { key: paginationKey, count: CATALOG_BATCH_SIZE },
    );
  }, [paginationKey]);

  useEffect(() => {
    const grid = productGridElement;
    if (!grid) return undefined;
    const activeGrid = grid;

    function updateGridColumnCount() {
      const nextColumnCount = getCatalogGridColumnCount(
        window.getComputedStyle(activeGrid).gridTemplateColumns,
      );
      setGridColumnCount((current) =>
        current === nextColumnCount ? current : nextColumnCount,
      );
    }

    updateGridColumnCount();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateGridColumnCount);
      return () => window.removeEventListener("resize", updateGridColumnCount);
    }

    const resizeObserver = new ResizeObserver(updateGridColumnCount);
    resizeObserver.observe(activeGrid);
    return () => resizeObserver.disconnect();
  }, [productGridElement]);

  const visibleCount =
    pagination.key === paginationKey ? pagination.count : CATALOG_BATCH_SIZE;

  const visibleProducts = useMemo(
    () => filteredProducts.slice(0, visibleCount),
    [filteredProducts, visibleCount],
  );

  const hasMoreProducts = visibleProducts.length < filteredProducts.length;
  const preloadTriggerIndex = hasMoreProducts
    ? getCatalogPreloadTriggerIndex(visibleProducts.length, gridColumnCount)
    : -1;

  useEffect(() => {
    observerRef.current?.disconnect();
    observerRef.current = null;

    if (!hasMoreProducts || !preloadTriggerElement) return undefined;

    const observedPaginationKey = paginationKey;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (
          !entry?.isIntersecting ||
          loadingNextBatchRef.current ||
          paginationKeyRef.current !== observedPaginationKey
        ) {
          return;
        }

        observer.disconnect();
        loadingNextBatchRef.current = true;

        setPagination((current) => {
          if (paginationKeyRef.current !== observedPaginationKey) return current;

          const currentCount =
            current.key === observedPaginationKey ? current.count : CATALOG_BATCH_SIZE;
          const nextCount = getCatalogNextVisibleCount(
            currentCount,
            filteredProductsLengthRef.current,
          );

          if (nextCount <= currentCount) return current;
          return { key: observedPaginationKey, count: nextCount };
        });

        loadingNextBatchRef.current = false;
      },
      { threshold: 0.01 },
    );

    observerRef.current = observer;
    observer.observe(preloadTriggerElement);

    return () => {
      observer.disconnect();
      if (observerRef.current === observer) observerRef.current = null;
    };
  }, [hasMoreProducts, paginationKey, preloadTriggerElement]);

  function clearFilters() {
    setQuery("");
    setBrandSlug("");
    setProgramSlug("");
    setPhaseSlug("");
    setStatus("");
    setRmSystem("");
    setRmSeries("");
    setRmCategory("");
    setTypeTag("");
    setProductLine("");
    setTechnicalCategory("");
    setFinish("");
    setActiveModule("");
  }

  function selectPhaseTab(nextPhaseSlug: string) {
    setPhaseSlug(nextPhaseSlug);
    setActiveModule("");
    setFiltersOpen(false);
  }

  function selectBrand(nextBrandSlug: string) {
    setBrandSlug(nextBrandSlug);

    if (nextBrandSlug !== "rm") {
      setRmSystem("");
      setRmSeries("");
      setRmCategory("");
    }
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
    Boolean(rmSystem) ||
    Boolean(rmSeries) ||
    Boolean(rmCategory) ||
    Boolean(typeTag) ||
    Boolean(productLine) ||
    Boolean(technicalCategory) ||
    Boolean(finish) ||
    Boolean(activeModule);

  return (
    <>
      <div className={styles.manufacturerRail}>
        <ManufacturerRail
          brands={brands}
          description="Izbor proizvođača zadržava aktivnu fazu, kategoriju, pretragu i ostale kompatibilne filtere."
          id="catalog-manufacturers"
          mode="filter"
          selectedSlug={brandSlug}
          title="Izaberite proizvođača"
          onSelect={selectBrand}
        />
      </div>

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
            onBrandChange={selectBrand}
            onClear={clearFilters}
            onDesktopCollapseChange={setDesktopFiltersCollapsed}
            onMobileClose={() => setFiltersOpen(false)}
            onPhaseChange={(value) => updateScopedFilter(setPhaseSlug, value)}
            onProgramChange={(value) => {
              setProgramSlug(value);
              setActiveModule("");
            }}
            onRmCategoryChange={(value) => updateScopedFilter(setRmCategory, value)}
            onRmSeriesChange={(value) => updateScopedFilter(setRmSeries, value)}
            onRmSystemChange={(value) => updateScopedFilter(setRmSystem, value)}
            onStatusChange={(value) => updateScopedFilter(setStatus, value)}
            onTypeChange={(value) => updateScopedFilter(setTypeTag, value)}
            onProductLineChange={(value) => updateScopedFilter(setProductLine, value)}
            onTechnicalCategoryChange={(value) =>
              updateScopedFilter(setTechnicalCategory, value)
            }
            onFinishChange={(value) => updateScopedFilter(setFinish, value)}
            phases={phases}
            phaseSlug={phaseSlug}
            programs={programs}
            programSlug={programSlug}
            rmCategory={rmCategory}
            rmCategoryOptions={rmCategoryOptions}
            rmSeries={rmSeries}
            rmSeriesOptions={rmSeriesOptions}
            rmSystem={rmSystem}
            rmSystemOptions={rmSystemOptions}
            status={status}
            typeOptions={typeOptions}
            typeTag={typeTag}
            productLine={productLine}
            productLineOptions={productLineOptions}
            technicalCategory={technicalCategory}
            technicalCategoryOptions={technicalCategoryOptions}
            finish={finish}
            finishOptions={finishOptions}
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
          gridRef={setProductGridElement}
          onReset={clearFilters}
          phaseBySlug={phaseBySlug}
          preloadTriggerIndex={preloadTriggerIndex}
          preloadTriggerRef={setPreloadTriggerElement}
          products={visibleProducts}
          programBySlug={programBySlug}
          resultCount={filteredProducts.length}
          shownCount={visibleProducts.length}
        />
      </section>

      <CatalogPaginationNav
        currentPage={1}
        totalPages={Math.ceil(products.length / CATALOG_BATCH_SIZE)}
      />
      <CatalogSupportCta />
    </>
  );
}
