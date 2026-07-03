"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { StoreCard } from "@/components/stores/StoreCard";
import { StoreFilters } from "@/components/stores/StoreFilters";
import { StoreMap } from "@/components/stores/StoreMap";
import { usePrefersReducedMotion } from "@/components/motion/usePrefersReducedMotion";
import { findNearestPartnerStore } from "@/lib/nearest-store";
import type { PartnerStore } from "@/lib/partner-stores";
import {
  formatStoreCount,
  getCityBadgeLabel,
  getCityDisplayCount,
  getCityDisplayLabel,
  getCityPendingCount,
  getDisplayNetworkTotal,
} from "./store-locator-display";
import styles from "./StoresPage.module.css";

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b, "sr-Latn"));
}

function getCityGroups(stores: PartnerStore[]) {
  const groups = new Map<string, PartnerStore[]>();

  stores.forEach((store) => {
    const cityStores = groups.get(store.city) ?? [];
    cityStores.push(store);
    groups.set(store.city, cityStores);
  });

  return Array.from(groups.entries())
    .map(([groupCity, cityStores]) => {
      const regions = uniqueSorted(cityStores.map((store) => store.region));
      const displayCount = getCityDisplayCount(groupCity, cityStores.length);
      const pendingCount = getCityPendingCount(groupCity, cityStores.length);

      return {
        badgeLabel: getCityBadgeLabel(groupCity, cityStores.length),
        city: groupCity,
        displayCount,
        label: getCityDisplayLabel(groupCity),
        pendingCount,
        representative: cityStores.find((store) => store.featured) ?? cityStores[0],
        regions,
        stores: cityStores,
      };
    })
    .sort((a, b) => a.city.localeCompare(b.city, "sr-Latn"));
}

export function StoreLocator({ stores }: { stores: PartnerStore[] }) {
  const searchRef = useRef<HTMLInputElement>(null);
  const cityGroupRefs = useRef<Map<string, HTMLElement>>(new Map());
  const prefersReducedMotion = usePrefersReducedMotion();
  const initialStore = stores.find((store) => store.featured) ?? stores[0];
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("");
  const [city, setCity] = useState("");
  const [brandProgram, setBrandProgram] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mapVisible, setMapVisible] = useState(false);
  const [expandedCity, setExpandedCity] = useState(initialStore?.city ?? "");
  const [selectedStoreId, setSelectedStoreId] = useState(initialStore?.id ?? "");
  const [locatorStatus, setLocatorStatus] = useState(
    "Možete dozvoliti lokaciju ili ručno izabrati grad iz liste partnera.",
  );

  const regionOptions = useMemo(
    () => uniqueSorted(stores.map((store) => store.region)),
    [stores],
  );
  const cityOptions = useMemo(
    () => uniqueSorted(stores.map((store) => store.city)),
    [stores],
  );
  const brandProgramOptions = useMemo(
    () =>
      uniqueSorted(
        stores.flatMap((store) => [...store.brands, ...store.programs]),
      ),
    [stores],
  );

  const filteredStores = useMemo(() => {
    const normalizedQuery = normalize(query.trim());

    return stores.filter((store) => {
      if (region && store.region !== region) return false;
      if (city && store.city !== city) return false;
      if (
        brandProgram &&
        !store.brands.includes(brandProgram) &&
        !store.programs.includes(brandProgram)
      ) {
        return false;
      }

      if (!normalizedQuery) return true;

      const haystack = normalize(
        [
          store.name,
          store.city,
          store.region,
          store.address,
          store.description,
          store.brands.join(" "),
          store.programs.join(" "),
        ].join(" "),
      );

      return haystack.includes(normalizedQuery);
    });
  }, [brandProgram, city, query, region, stores]);

  const cityGroups = useMemo(() => getCityGroups(filteredStores), [filteredStores]);
  const enteredStoreCount = stores.length;
  const networkStoreCount = useMemo(() => getDisplayNetworkTotal(stores), [stores]);
  const visibleNetworkStoreCount = useMemo(
    () => cityGroups.reduce((total, group) => total + group.displayCount, 0),
    [cityGroups],
  );
  const selectedStore =
    filteredStores.find((store) => store.id === selectedStoreId) ??
    filteredStores.find((store) => store.featured) ??
    filteredStores[0];

  useEffect(() => {
    if (!selectedStore) return;
    if (!filteredStores.some((store) => store.id === selectedStoreId)) {
      setSelectedStoreId(selectedStore.id);
    }
  }, [filteredStores, selectedStore, selectedStoreId]);

  useEffect(() => {
    if (!selectedStore) return;
    if (expandedCity === selectedStore.city) return;

    setExpandedCity(selectedStore.city);
  }, [expandedCity, selectedStore]);

  function clearFilters() {
    setQuery("");
    setRegion("");
    setCity("");
    setBrandProgram("");
    setExpandedCity(initialStore?.city ?? "");
    setFiltersOpen(false);
    setLocatorStatus("Filteri su resetovani. Prikazana je početna partnerska mreža.");
  }

  function scrollListToCity(groupCity: string) {
    cityGroupRefs.current.get(groupCity)?.scrollIntoView({
      behavior: prefersReducedMotion ? "instant" : "smooth",
      block: "nearest",
    });
  }

  function scrollMapIntoViewIfStacked() {
    // Only on stacked layouts (map below the list); the desktop map is sticky.
    if (!window.matchMedia("(max-width: 1023px)").matches) return;

    const mapColumn = document.querySelector("[data-store-map-column]");
    if (mapColumn instanceof HTMLElement && mapColumn.offsetParent !== null) {
      mapColumn.scrollIntoView({
        behavior: prefersReducedMotion ? "instant" : "smooth",
        block: "nearest",
      });
    }
  }

  function formatDistanceKm(distanceKm: number) {
    return `${Math.max(1, Math.round(distanceKm))} km`;
  }

  function handleLocationRequest() {
    if (!("geolocation" in navigator)) {
      setLocatorStatus(
        "Geolokacija nije podržana u ovom pregledaču. Izaberite grad ručno iz liste.",
      );
      return;
    }

    setLocatorStatus("Tražimo najbližu dostupnu lokaciju u mreži...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nearest = findNearestPartnerStore(stores, {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });

        if (!nearest) {
          setLocatorStatus(
            "Lokacije sa koordinatama trenutno nisu dostupne za poređenje. Izaberite grad ručno.",
          );
          return;
        }

        setSelectedStoreId(nearest.store.id);
        setExpandedCity(nearest.store.city);
        setCity(nearest.store.city);
        setRegion("");
        setQuery("");
        setBrandProgram("");
        setLocatorStatus(
          `Najbliža dostupna lokacija u mreži: ${nearest.store.city}, oko ${formatDistanceKm(nearest.distanceKm)}. Tačno rutiranje se potvrđuje kroz kontakt sa timom.`,
        );
        scrollListToCity(nearest.store.city);
      },
      () => {
        setLocatorStatus(
          "Lokacija nije odobrena. Izaberite grad ručno ili koristite pretragu.",
        );
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  }

  function handleManualCity() {
    setFiltersOpen(true);
    setLocatorStatus("Izaberite grad ili unesite naziv prodavnice u polje za pretragu.");
    window.setTimeout(() => searchRef.current?.focus(), 0);
  }

  function handleCityChange(value: string) {
    setCity(value);
    setRegion("");
    setQuery("");
    if (value) {
      const cityStore =
        stores.find((store) => store.city === value && store.featured) ??
        stores.find((store) => store.city === value);
      if (cityStore) {
        setSelectedStoreId(cityStore.id);
        setExpandedCity(cityStore.city);
      }
      setLocatorStatus(`Prikazane su prodavnice za grad ${value}.`);
    } else {
      setExpandedCity(selectedStore?.city ?? initialStore?.city ?? "");
    }
  }

  function handleSelectStore(storeId: string) {
    setSelectedStoreId(storeId);
    const store = stores.find((item) => item.id === storeId);
    if (store) {
      setExpandedCity(store.city);
      setLocatorStatus(`Izabrana lokacija: ${store.city}.`);
    }
  }

  function handleSelectFromMap(storeId: string) {
    handleSelectStore(storeId);
    const store = stores.find((item) => item.id === storeId);
    if (store) {
      scrollListToCity(store.city);
    }
  }

  function handleCityGroupSelect(groupCity: string, representative: PartnerStore, count: number) {
    setExpandedCity(groupCity);
    setSelectedStoreId(representative.id);
    setLocatorStatus(`${groupCity}: ${formatStoreCount(count)} u mreži.`);
    scrollMapIntoViewIfStacked();
  }

  const hasActiveFilters =
    Boolean(query.trim()) || Boolean(region) || Boolean(city) || Boolean(brandProgram);

  return (
    <main className={styles.main}>
      <section className={styles.hero} aria-labelledby="stores-title">
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>Partnerska mreža</p>
          <h1 id="stores-title" className={styles.title}>
            Pronađite najbližu prodavnicu
          </h1>
          <p className={styles.subtitle}>
            Carsystem i R-M program dostupan je kroz mrežu partnera širom Srbije.
          </p>
          <div className={styles.heroActions}>
            <button
              className={`${styles.primaryButton} cs-magnetic-cta cs-theme-wipe-card`}
              type="button"
              onClick={handleLocationRequest}
              data-cursor="button"
              data-motion-surface
              data-motion="theme-wipe"
            >
              <span>Dozvoli lokaciju</span>
            </button>
            <button className={styles.secondaryButton} type="button" onClick={handleManualCity}>
              Ručno izaberi grad
            </button>
          </div>
        </div>

        <aside className={styles.statusPanel} aria-label="Status lokatora">
          <p className={styles.sectionKicker}>Lokator</p>
          <strong>{selectedStore?.city ?? "Srbija"}</strong>
          <p>{locatorStatus}</p>
          <div className={styles.quickStats}>
            <span>{formatStoreCount(networkStoreCount)} u mreži</span>
            <span>{regionOptions.length} regiona</span>
            <span>Tehnička mapa</span>
          </div>
        </aside>
      </section>

      <StoreFilters
        brandProgram={brandProgram}
        brandProgramOptions={brandProgramOptions}
        city={city}
        cityOptions={cityOptions}
        filtersOpen={filtersOpen}
        hasActiveFilters={hasActiveFilters}
        onBrandProgramChange={setBrandProgram}
        onCityChange={handleCityChange}
        onClear={clearFilters}
        onFiltersToggle={() => setFiltersOpen((open) => !open)}
        onQueryChange={setQuery}
        onRegionChange={(value) => {
          setRegion(value);
          setCity("");
          setExpandedCity(selectedStore?.city ?? initialStore?.city ?? "");
        }}
        query={query}
        region={region}
        regionOptions={regionOptions}
        searchInputRef={searchRef}
      />

      <section className={styles.locatorLayout} aria-label="Rezultati lokatora">
        <div className={styles.listColumn} id="store-locator-list">
          <div className={styles.resultHeader}>
            <strong>Prodavnice</strong>
            <span>
              {formatStoreCount(visibleNetworkStoreCount)} u mreži · {enteredStoreCount} sa
              dostupnim detaljima
            </span>
            <button
              className={styles.mobileMapToggle}
              type="button"
              onClick={() => setMapVisible((visible) => !visible)}
              aria-expanded={mapVisible}
            >
              {mapVisible ? "Sakrij mapu" : "Prikaži mapu"}
            </button>
          </div>

          {selectedStore ? (
            <section className={styles.nearestCard} aria-labelledby="nearest-store-title">
              <div className={styles.nearestHeader}>
                <div>
                  <p className={styles.cardLabel}>Izdvojena lokacija</p>
                  <h2 id="nearest-store-title">{selectedStore.name}</h2>
                </div>
                <span className={styles.nearestCity}>{selectedStore.city}</span>
              </div>
              <p className={styles.storeDescription}>{selectedStore.description}</p>
              <div className={styles.storeTags}>
                {selectedStore.programs.slice(0, 4).map((program) => (
                  <span key={program}>{program}</span>
                ))}
              </div>
            </section>
          ) : null}

          {filteredStores.length > 0 ? (
            <div className={styles.storeList}>
              {cityGroups.map((group) => {
                const isExpanded = expandedCity === group.city;
                const groupId = `store-city-${normalize(group.city).replace(/\s+/g, "-")}`;
                const regionSummary = [
                  group.regions.join(" / "),
                  group.pendingCount > 0
                    ? `${group.stores.length} sa detaljima · ${group.pendingCount} u dopuni`
                    : group.label,
                ]
                  .filter(Boolean)
                  .join(" · ");

                return (
                  <section
                    className={styles.cityGroup}
                    key={group.city}
                    ref={(node) => {
                      if (node) {
                        cityGroupRefs.current.set(group.city, node);
                      } else {
                        cityGroupRefs.current.delete(group.city);
                      }
                    }}
                  >
                    <button
                      type="button"
                      className={styles.cityGroupHeader}
                      onClick={() =>
                        handleCityGroupSelect(group.city, group.representative, group.displayCount)
                      }
                      aria-expanded={isExpanded}
                      aria-controls={groupId}
                    >
                      <span>
                        <strong>{group.city}</strong>
                        <small>{regionSummary}</small>
                      </span>
                      <b>{group.label ? group.badgeLabel : `${group.badgeLabel} u mreži`}</b>
                    </button>
                    {isExpanded ? (
                      <div className={styles.cityStoreList} id={groupId}>
                        {group.stores.map((store) => (
                          <StoreCard
                            isActive={store.id === selectedStore?.id}
                            key={store.id}
                            onSelect={handleSelectStore}
                            store={store}
                          />
                        ))}
                        {group.pendingCount > 0 ? (
                          <div className={styles.cityPendingNotice}>
                            <strong>
                              Još {formatStoreCount(group.pendingCount)} u mreži za grad{" "}
                              {group.city}.
                            </strong>
                            <p>
                              Detalji za pojedinačne partnere se dopunjuju. Za tačno
                              rutiranje pošaljite upit ili pozovite centralu u Inđiji.
                            </p>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </section>
                );
              })}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <strong>Nema prodavnica za izabrane filtere.</strong>
              <p>Resetujte filtere ili pošaljite upit za rutiranje preko centrale.</p>
              <button className={styles.clearButton} type="button" onClick={clearFilters}>
                Resetuj filtere
              </button>
            </div>
          )}
        </div>

        {selectedStore ? (
          <StoreMap
            onSelect={handleSelectFromMap}
            selectedStore={selectedStore}
            storeDisplayCount={visibleNetworkStoreCount}
            stores={filteredStores}
            visibleOnMobile={mapVisible}
          />
        ) : (
          <aside
            className={`${styles.mapColumn} ${mapVisible ? styles.mapColumnVisible : ""}`}
            data-store-map-column
            aria-label="Mapa partnerskih prodavnica"
          >
            <div className={styles.emptyState}>
              <strong>Mapa nema pinove za izabrane filtere.</strong>
              <p>Resetujte filtere da biste ponovo videli celu partnersku mrežu.</p>
              <button className={styles.clearButton} type="button" onClick={clearFilters}>
                Resetuj filtere
              </button>
            </div>
          </aside>
        )}
      </section>

      {selectedStore ? (
        <div
          className={styles.mobileStickyCta}
          data-mobile-sticky-cta
          aria-label="Brzi pristup prodavnici"
        >
          <span>
            <strong>{selectedStore.city}</strong>
            <small>{selectedStore.region}</small>
          </span>
          <a
            className={`${styles.primaryButton} cs-magnetic-cta cs-theme-wipe-card`}
            href="#store-locator-list"
            data-cursor="button"
            data-motion-surface
            data-motion="theme-wipe"
          >
            <span>Pronađi prodavnicu</span>
          </a>
        </div>
      ) : null}
    </main>
  );
}
