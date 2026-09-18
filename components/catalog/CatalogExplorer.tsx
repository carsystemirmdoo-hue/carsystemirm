"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
  getProductCategory,
  isProductCategorySlug,
} from "@/lib/product-taxonomy";
import {
  expandVariant,
  type CatalogListingEntity,
  type CatalogVariantEntity,
} from "@/lib/catalog-listing";
import { useProductSearch } from "@/components/search/useProductSearch";
import type { ProductSearchRecord } from "@/lib/search/buildSearchIndex";
import {
  rmCategorySlugs,
  rmSeriesSlugs,
  rmSystemSlugs,
  type RmCategorySlug,
  type RmSeriesSlug,
  type RmSystemSlug,
  type CarsystemBrand,
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
  categorySlug: string;
  phaseSlug: string;
  programSlug: string;
  query: string;
  rmCategory: string;
  rmSeries: string;
  rmSystem: string;
  sortSlug: string;
  status: string;
};

/**
 * Preporučeno = prirodan (kurirani) redosled iz podataka, ne izmišljena
 * "popularnost". Najprodavanije/Novo nisu ovde jer ne postoji pouzdan izvor
 * podataka (prodajni rang ni datum dodavanja proizvoda se trenutno ne vode) —
 * dodaju se tek kad taj podatak postoji, ne kao dugme koje lažno radi.
 */
const catalogSortOptions = [
  { slug: "", label: "Preporučeno" },
  { slug: "naziv-az", label: "Naziv A–Z" },
] as const;
const catalogSortSlugs: Set<string> = new Set(
  catalogSortOptions.map((option) => option.slug),
);

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

/**
 * Session-level (ne account-level) persistencija za collapsed state sidebar-a.
 * Bez ovoga se collapse gubi na svaki povratak sa PDP-a (novi route mount),
 * pa se korisnik "bori" sa sidebarom u toku obične sesije kupovine.
 */
const FILTERS_COLLAPSED_STORAGE_KEY = "carsystem:catalog:filters-collapsed";

/**
 * Gornja granica rezultata koje katalog uzima od engine-a.
 *
 * Katalog je destinacija za KOMPLETNE rezultate, pa je granica namerno iznad
 * ukupnog broja zapisa u indeksu — ne krati stvarni rezultat, nego postoji da
 * jedan izuzetno širok upit ne bi materijalizovao neograničen niz entiteta.
 */
const CATALOG_SEARCH_LIMIT = 5000;

function readStoredFiltersCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(FILTERS_COLLAPSED_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

/**
 * Back-navigacija sa PDP-a na katalog: Next.js Router Cache (staleTime 0 za
 * dinamičke rute) ovde ne čuva stari render, pa CatalogExplorer radi potpuni
 * remount na "Back" — filteri/search/sort prežive jer žive u URL-u, ali
 * učitani broj proizvoda (visibleCount) i scroll pozicija su čisto
 * komponentno/browser stanje i gube se. Ovaj session-storage zapis nosi baš
 * ta dva podatka, ključana po paginationKey da se ne primeni na drugačiju
 * kombinaciju filtera/sort-a.
 */
const CATALOG_SESSION_STORAGE_KEY = "carsystem:catalog:session-state";

type StoredCatalogSession = {
  paginationKey: string;
  visibleCount: number;
  scrollY: number;
};

function readStoredCatalogSession(): StoredCatalogSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(CATALOG_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredCatalogSession>;
    if (
      typeof parsed.paginationKey !== "string" ||
      typeof parsed.visibleCount !== "number" ||
      typeof parsed.scrollY !== "number"
    ) {
      return null;
    }
    return parsed as StoredCatalogSession;
  } catch {
    return null;
  }
}

function writeStoredCatalogSession(session: StoredCatalogSession) {
  try {
    window.sessionStorage.setItem(CATALOG_SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // sessionStorage nedostupan — nema restauracije, ali stranica i dalje radi.
  }
}

/**
 * Zapis iz search indeksa u „mršav" listing oblik koji katalog crta.
 *
 * Katalog i pretraga dele JEDAN asset (`/katalog/search-index.json`). Ranije je
 * postojao poseban `/katalog/variant-index.json` samo za katalog; sa panelom
 * pretrage u Headeru to bi značilo dva fajla sa istim podacima i dva modela
 * rangiranja. `card` polja u indeksu postoje baš zato da ova konverzija bude
 * preslikavanje, a ne ponovno izvođenje prezentacije.
 *
 * Keš i dalje živi na nivou modula, ali sada u `lib/search/productSearchClient`:
 * Back sa PDP-a radi pun remount ovog komponenta (vidi belešku uz
 * `CATALOG_SESSION_STORAGE_KEY`), pa indeks vezan za state komponente ne bi
 * preživeo povratak.
 */
function toVariantEntity(record: ProductSearchRecord): CatalogVariantEntity | null {
  if (record.kind !== "variant" || !record.familySlug || !record.card) return null;

  return {
    id: record.id,
    name: record.name,
    familySlug: record.familySlug,
    productCode: record.productCode ?? "",
    technicalLine: record.technicalLine ?? "",
    finish: record.card.finish,
    /*
     * Prednormalizovani haystack više ne postoji u assetu: poklapanje radi
     * engine nad inverznim indeksom, a katalog prikazuje ono što je engine već
     * rangirao. Polje ostaje deo tipa zbog entiteta iz početnog payload-a.
     */
    search: "",
    accent: record.card.accent,
    shade: record.card.shade ?? null,
    imageSrc: record.imageSrc ?? null,
    imageAlt: record.card.imageAlt,
    sizeClass: record.card.sizeClass,
    quantityLabel: record.quantityLabel ?? null,
    volumeStatus: record.card.volumeStatus,
  };
}

function firstParam(searchParams: URLSearchParams, key: string) {
  return searchParams.get(key)?.trim() ?? "";
}

function filtersEqual(first: CatalogUrlFilters, second: CatalogUrlFilters) {
  return (
    first.activeModule === second.activeModule &&
    first.brandSlug === second.brandSlug &&
    first.categorySlug === second.categorySlug &&
    first.phaseSlug === second.phaseSlug &&
    first.programSlug === second.programSlug &&
    first.query === second.query &&
    first.rmCategory === second.rmCategory &&
    first.rmSeries === second.rmSeries &&
    first.rmSystem === second.rmSystem &&
    first.sortSlug === second.sortSlug &&
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
  const categoryParam = firstParam(searchParams, "kategorija");
  const programParam = firstParam(searchParams, "program");
  const phaseParam = firstParam(searchParams, "faza");
  const statusParam = firstParam(searchParams, "dostupnost");
  const queryParam = firstParam(searchParams, "q").slice(0, 80);
  const rmSystemParam = firstParam(searchParams, "sistem");
  const rmSeriesParam = firstParam(searchParams, "serija");
  const rmCategoryParam = firstParam(searchParams, "rm-kategorija");
  const sortParam = firstParam(searchParams, "sortiranje");
  const catalogModule = catalogModules.find((item) => item.slug === programParam);

  return {
    activeModule: catalogModule ? catalogModule.key : "",
    brandSlug: brandSlugs.has(brandParam) ? brandParam : "",
    // An unknown category is dropped rather than kept: keeping it would show a
    // filter chip for something that filters nothing. `?kategorija=izmisljeno`
    // therefore behaves exactly like no category at all — see the unknown-slug
    // branch in the results header for what the visitor is told.
    categorySlug: isProductCategorySlug(categoryParam) ? categoryParam : "",
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
    sortSlug: catalogSortSlugs.has(sortParam) ? sortParam : "",
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
  params.delete("kategorija");
  params.delete("program");
  params.delete("faza");
  params.delete("dostupnost");
  params.delete("q");
  params.delete("sistem");
  params.delete("serija");
  params.delete("rm-kategorija");
  params.delete("sortiranje");

  if (filters.brandSlug) params.set("brend", filters.brandSlug);
  if (filters.categorySlug) params.set("kategorija", filters.categorySlug);
  if (activeCatalogModule) params.set("program", activeCatalogModule.slug);
  else if (filters.programSlug) params.set("program", filters.programSlug);
  if (filters.phaseSlug) params.set("faza", filters.phaseSlug);
  if (filters.status) params.set("dostupnost", filters.status);
  if (filters.query.trim()) params.set("q", filters.query.trim());
  if (filters.rmSystem) params.set("sistem", filters.rmSystem);
  if (filters.rmSeries) params.set("serija", filters.rmSeries);
  if (filters.rmCategory) params.set("rm-kategorija", filters.rmCategory);
  if (filters.sortSlug) params.set("sortiranje", filters.sortSlug);

  return params.toString();
}

export function CatalogExplorer({
  canonical,
  brands,
  programs,
  phases,
}: {
  /** Family + standalone entities — what browse lists. */
  canonical: CatalogListingEntity[];
  brands: CarsystemBrand[];
  programs: ProgramGroup[];
  phases: RefinishPhase[];
}) {
  /** Facets are derived from the browse population, not from every variant. */
  const facetSource = canonical;
  const familyById = useMemo(
    () => new Map(canonical.filter((e) => e.kind === "family").map((e) => [e.id, e])),
    [canonical],
  );
  const canonicalById = useMemo(
    () => new Map(canonical.map((entity) => [entity.id, entity])),
    [canonical],
  );

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
  const [categorySlug, setCategorySlug] = useState(urlFilters.categorySlug);
  const [programSlug, setProgramSlug] = useState(urlFilters.programSlug);
  const [phaseSlug, setPhaseSlug] = useState(urlFilters.phaseSlug);
  const [status, setStatus] = useState(urlFilters.status);
  const [rmSystem, setRmSystem] = useState(urlFilters.rmSystem);
  const [rmSeries, setRmSeries] = useState(urlFilters.rmSeries);
  const [rmCategory, setRmCategory] = useState(urlFilters.rmCategory);
  const [sortSlug, setSortSlug] = useState(urlFilters.sortSlug);
  const [typeTag, setTypeTag] = useState("");
  const [productLine, setProductLine] = useState("");
  const [technicalCategory, setTechnicalCategory] = useState("");
  const [finish, setFinish] = useState("");
  const [activeModule, setActiveModule] = useState(urlFilters.activeModule);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [desktopFiltersCollapsed, setDesktopFiltersCollapsedState] = useState(false);

  useLayoutEffect(() => {
    if (readStoredFiltersCollapsed()) setDesktopFiltersCollapsedState(true);
  }, []);

  function setDesktopFiltersCollapsed(collapsed: boolean) {
    setDesktopFiltersCollapsedState(collapsed);
    try {
      window.sessionStorage.setItem(FILTERS_COLLAPSED_STORAGE_KEY, String(collapsed));
    } catch {
      // sessionStorage nedostupan (privatni režim i sl.) — state i dalje radi u sesiji.
    }
  }
  const paginationKey = [
    query.trim(),
    brandSlug,
    categorySlug,
    programSlug,
    phaseSlug,
    status,
    rmSystem,
    rmSeries,
    rmCategory,
    sortSlug,
    typeTag,
    productLine,
    technicalCategory,
    finish,
    activeModule,
  ].join("\u001f");
  const [pagination, setPagination] = useState(() => {
    const stored = readStoredCatalogSession();
    if (stored && stored.paginationKey === paginationKey && stored.visibleCount > CATALOG_BATCH_SIZE) {
      return { key: paginationKey, count: stored.visibleCount };
    }
    return { key: paginationKey, count: CATALOG_BATCH_SIZE };
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
  const filteredProductsLengthRef = useRef(canonical.length);
  const paginationCountRef = useRef(pagination.count);
  const mountPaginationKeyRef = useRef(paginationKey);
  const scrollYRef = useRef(0);

  const currentUrlFilters = useMemo(
    () => ({
      activeModule,
      brandSlug,
      categorySlug,
      phaseSlug,
      programSlug,
      query,
      rmCategory,
      rmSeries,
      rmSystem,
      sortSlug,
      status,
    }),
    [
      activeModule,
      brandSlug,
      categorySlug,
      phaseSlug,
      programSlug,
      query,
      rmCategory,
      rmSeries,
      rmSystem,
      sortSlug,
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
    facetSource.forEach((product) => {
      product.badges
        .filter((badge: string) => badge !== "Na upit")
        .forEach((badge: string) => tags.add(badge));
    });
    return Array.from(tags).sort((a, b) => a.localeCompare(b, "sr-Latn"));
  }, [facetSource]);
  const productLineOptions = useMemo(
    () =>
      Array.from(
        new Set(
          facetSource
            .map((product) => product.line)
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((first, second) => first.localeCompare(second, "sr-Latn")),
    [facetSource],
  );
  const technicalCategoryOptions = useMemo(
    () =>
      Array.from(
        new Set(
          facetSource
            .map((product) => product.technicalCategory)
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((first, second) => first.localeCompare(second, "sr-Latn")),
    [facetSource],
  );
  const finishOptions = useMemo(
    () =>
      Array.from(
        new Set(
          facetSource
            .map((product) => product.finish)
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((first, second) => first.localeCompare(second, "sr-Latn")),
    [facetSource],
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
  const activeCategory = categorySlug ? getProductCategory(categorySlug) : undefined;
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

  /*
   * Pretraga kataloga je ISTI engine koji koristi panel u Headeru, preko istog
   * modul-level keša (`lib/search/productSearchClient`). Katalog zato ne drži
   * sopstveni fetch, sopstveni keš ni sopstveni algoritam poklapanja: dobija
   * rangiranu listu zapisa i mapira je na entitete koje već ume da nacrta.
   *
   * Asset se ne dodiruje dok `q` ne postoji — browse, kategorije, brend,
   * program, faza i sortiranje rade bez ijednog dodatnog zahteva.
   */
  const searchEnabled = Boolean(query.trim());
  const {
    status: searchStatus,
    result: searchResult,
    retry: retrySearchIndex,
  } = useProductSearch(query, { enabled: searchEnabled, limit: CATALOG_SEARCH_LIMIT });

  /**
   * Stanje koje mreža kartica razume.
   *
   * `searching` (stiže nov upit nad već učitanim indeksom) se prikazuje kao
   * `ready`: prethodni rezultat ostaje na ekranu do novog, pa nema treptanja
   * praznog stanja na svaki pritisak tastera.
   */
  const searchIndexState: "idle" | "loading" | "ready" | "error" | "too-short" =
    searchStatus === "error"
      ? "error"
      : searchStatus === "too-short"
        ? "too-short"
        : searchStatus === "loading" || searchStatus === "slow"
          ? "loading"
          : searchResult
            ? "ready"
            : "loading";

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
    setCategorySlug(urlFilters.categorySlug);
    setProgramSlug(urlFilters.programSlug);
    setPhaseSlug(urlFilters.phaseSlug);
    setStatus(urlFilters.status);
    setRmSystem(urlFilters.rmSystem);
    setRmSeries(urlFilters.rmSeries);
    setRmCategory(urlFilters.rmCategory);
    setSortSlug(urlFilters.sortSlug);
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
    /*
     * Bez upita katalog prikazuje canonical entitete: 41 porodicu i 117
     * samostalnih proizvoda, u kuriranom redosledu.
     *
     * Sa upitom, redosled dolazi iz engine-a — rangiranje je „Preporučeno" kada
     * postoji pretraga. Varijante tada ulaze u listu, pa konkretan SKU, nijansa
     * ili pakovanje i dalje vode na svoju stranicu, dok browse i dalje ne
     * prikazuje istu porodicu desetinama puta.
     */
    const pool = searchEnabled
      ? (searchResult?.records ?? [])
          .map((record) => {
            if (record.kind === "variant") {
              const family = familyById.get(`family:${record.familySlug}`);
              const variant = toVariantEntity(record);
              return family && variant ? expandVariant(variant, family) : null;
            }
            return canonicalById.get(record.id) ?? null;
          })
          .filter((entity): entity is CatalogListingEntity => entity !== null)
      : canonical;

    return pool.filter((product) => {
      if (brandSlug && product.brandSlug !== brandSlug) return false;
      if (categorySlug && !product.categorySlugs.includes(categorySlug)) return false;
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
      if (productLine && product.line !== productLine) return false;
      if (technicalCategory && product.technicalCategory !== technicalCategory) {
        return false;
      }
      if (finish && product.finish !== finish) return false;

      return true;
    });
  }, [
    activeModuleConfig,
    brandSlug,
    canonical,
    canonicalById,
    categorySlug,
    familyById,
    phaseSlug,
    programSlug,
    rmCategory,
    rmSeries,
    rmSystem,
    searchEnabled,
    searchResult,
    status,
    typeTag,
    productLine,
    technicalCategory,
    finish,
  ]);

  const sortedProducts = useMemo(() => {
    if (sortSlug === "naziv-az") {
      return [...filteredProducts].sort((first, second) =>
        first.name.localeCompare(second.name, "sr-Latn"),
      );
    }
    /*
     * "" (Preporučeno) = kurirani redosled iz podataka pri pregledu, odnosno
     * relevantnost pri pretrazi. Oba stižu već poređana (podaci, pa engine), pa
     * se ovde namerno ne re-sortira — svako dodatno sortiranje bi upravo
     * poništilo rangiranje zbog kog pretraga i postoji.
     */
    return filteredProducts;
  }, [filteredProducts, sortSlug]);

  paginationKeyRef.current = paginationKey;
  filteredProductsLengthRef.current = sortedProducts.length;
  paginationCountRef.current = pagination.count;

  useEffect(() => {
    /*
     * Ovaj efekat resetuje pagination kad se filter/sort STVARNO promeni —
     * ne na mount-u, gde bi pregazio Back-restauraciju (initial count ume da
     * bude veći od CATALOG_BATCH_SIZE kad je vraćen iz session-a). Provera
     * je namerno "još uvek isti key kao na mount-u", ne jednokratni
     * boolean flag: React Strict Mode u dev modu duplo pokreće efekat
     * (mount → cleanup → mount) PRE bilo koje stvarne izmene filtera, a
     * jednokratni flag bi preživeo samo prvi od ta dva poziva i drugi bi
     * pogrešno protumačio kao "filter se promenio".
     */
    if (paginationKey === mountPaginationKeyRef.current) return;
    observerRef.current?.disconnect();
    observerRef.current = null;
    loadingNextBatchRef.current = false;
    setPagination({ key: paginationKey, count: CATALOG_BATCH_SIZE });
  }, [paginationKey]);

  useLayoutEffect(() => {
    /*
     * Mount-only: pagination.count je već restauriran (lazy initializer
     * gore), pa je DOM u ovom trenutku već pun broj kartica — scrollTo ovde
     * pogađa pravu poziciju umesto da se klampuje na kraći, prazan layout.
     */
    const stored = readStoredCatalogSession();
    if (stored && stored.paginationKey === paginationKeyRef.current && stored.scrollY > 0) {
      /*
       * `html { scroll-behavior: smooth }` (globals.css) hvata i JS scrollTo
       * pozive — bez eksplicitnog "instant" override-a, restauracija bi se
       * animirala umesto skoka, i (gore) StrictMode dev-mode dupli
       * mount/cleanup bi uhvatio scrollY usred te animacije i presnimio ga.
       */
      window.scrollTo({ top: stored.scrollY, left: 0, behavior: "instant" });
    }

    function trackScroll() {
      scrollYRef.current = window.scrollY;
    }
    window.addEventListener("scroll", trackScroll, { passive: true });
    trackScroll();

    function saveSessionNow() {
      writeStoredCatalogSession({
        paginationKey: paginationKeyRef.current,
        visibleCount: paginationCountRef.current,
        scrollY: window.scrollY,
      });
    }

    /*
     * Next Link resetuje scroll na vrh ČIM navigacija krene (default
     * `scroll: true`), pre nego što ovaj komponent stigne da se unmount-uje
     * — dok unmount cleanup dođe na red, window.scrollY je već 0, pa bi
     * snimio pogrešnu poziciju. Capture-phase klik hvata trenutak PRE nego
     * što Next-ov router uopšte reaguje na klik, dok je scrollY još stvaran.
     */
    let savedOnClick = false;
    function handleCaptureClick(event: MouseEvent) {
      const target = event.target;
      if (target instanceof Element && target.closest("a")) {
        saveSessionNow();
        savedOnClick = true;
      }
    }
    document.addEventListener("click", handleCaptureClick, true);

    return () => {
      window.removeEventListener("scroll", trackScroll);
      document.removeEventListener("click", handleCaptureClick, true);
      if (!savedOnClick) saveSessionNow();
    };
  }, []);

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
    () => sortedProducts.slice(0, visibleCount),
    [sortedProducts, visibleCount],
  );

  const hasMoreProducts = visibleProducts.length < sortedProducts.length;
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
    setCategorySlug("");
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

  /**
   * Prazan rezultat je „kategorija je prazna" samo ako ništa drugo ne sužava
   * listu; inače je prazna kombinacija filtera i generička poruka je tačna.
   */
  const hasOtherActiveFilters =
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

  const hasActiveFilters =
    Boolean(query.trim()) ||
    Boolean(brandSlug) ||
    Boolean(categorySlug) ||
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

      {/*
        Kategorija stiže isključivo iz URL-a (Header i Homepage linkovi), pa
        mora biti vidljiva u filter state-u — inače korisnik gleda filtriran
        katalog bez ijedne naznake šta ga filtrira. Chip je i jedini način da
        se filter ukloni bez ručnog čišćenja URL-a.
      */}
      {activeCategory ? (
        <section className={styles.activeCategoryBar} aria-label="Aktivna kategorija">
          <button
            className={`${styles.activeCategoryChip} cs-interactive-surface`}
            type="button"
            data-cursor="button"
            data-motion-surface
            onClick={() => setCategorySlug("")}
          >
            <span>Kategorija: {activeCategory.label}</span>
            <span aria-hidden="true">×</span>
            <span className="sr-only">Ukloni filter kategorije</span>
          </button>
          <p className={styles.activeCategoryHint}>{activeCategory.description}</p>
        </section>
      ) : null}

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
          /*
           * „Nema rezultata" se ne sme prikazati dok indeks stiže — dok traje
           * učitavanje, prazan skup nije odgovor nego još neodgovoreno pitanje.
           */
          searchIndexState={searchEnabled ? searchIndexState : "idle"}
          onSearchIndexRetry={retrySearchIndex}
          emptyStateNote={
            activeCategory && !hasOtherActiveFilters
              ? `Nijedan proizvod iz trenutnog kataloga nije klasifikovan u kategoriju „${activeCategory.label}".`
              : undefined
          }
          gridRef={setProductGridElement}
          onReset={clearFilters}
          onSortChange={setSortSlug}
          phaseBySlug={phaseBySlug}
          preloadTriggerIndex={preloadTriggerIndex}
          preloadTriggerRef={setPreloadTriggerElement}
          entities={visibleProducts}
          programBySlug={programBySlug}
          resultCount={sortedProducts.length}
          shownCount={visibleProducts.length}
          sortOptions={catalogSortOptions}
          sortSlug={sortSlug}
        />
      </section>

      <CatalogPaginationNav
        currentPage={1}
        totalPages={Math.ceil(canonical.length / CATALOG_BATCH_SIZE)}
      />
      <CatalogSupportCta />
    </>
  );
}
