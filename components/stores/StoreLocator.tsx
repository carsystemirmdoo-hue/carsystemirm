"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { StoreCard } from "@/components/stores/StoreCard";
import { StoreFilters } from "@/components/stores/StoreFilters";
import { StoreMap } from "@/components/stores/StoreMap";
import type { PartnerStore } from "@/lib/partner-stores";
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

export function StoreLocator({ stores }: { stores: PartnerStore[] }) {
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("");
  const [city, setCity] = useState("");
  const [brandProgram, setBrandProgram] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mapVisible, setMapVisible] = useState(false);
  const [selectedStoreId, setSelectedStoreId] = useState(
    stores.find((store) => store.featured)?.id ?? stores[0]?.id ?? "",
  );
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

  const visibleStores = filteredStores.length > 0 ? filteredStores : stores;
  const selectedStore =
    visibleStores.find((store) => store.id === selectedStoreId) ??
    visibleStores.find((store) => store.featured) ??
    visibleStores[0];

  useEffect(() => {
    if (!selectedStore) return;
    if (!visibleStores.some((store) => store.id === selectedStoreId)) {
      setSelectedStoreId(selectedStore.id);
    }
  }, [selectedStore, selectedStoreId, visibleStores]);

  function clearFilters() {
    setQuery("");
    setRegion("");
    setCity("");
    setBrandProgram("");
    setFiltersOpen(false);
    setLocatorStatus("Filteri su resetovani. Prikazana je početna partnerska mreža.");
  }

  function handleLocationRequest() {
    const featured = stores.find((store) => store.featured) ?? stores[0];
    if (!featured) return;

    setSelectedStoreId(featured.id);
    setCity(featured.city);
    setRegion("");
    setQuery("");
    setBrandProgram("");
    setLocatorStatus(
      "Prikazana je preporučena lokacija. Tačno rutiranje se potvrđuje kroz kontakt sa timom.",
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
      const cityStore = stores.find((store) => store.city === value);
      if (cityStore) setSelectedStoreId(cityStore.id);
      setLocatorStatus(`Prikazane su prodavnice za grad ${value}.`);
    }
  }

  function handleSelectStore(storeId: string) {
    setSelectedStoreId(storeId);
    const store = stores.find((item) => item.id === storeId);
    if (store) setLocatorStatus(`Izabrana lokacija: ${store.city}.`);
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
            <button className={styles.primaryButton} type="button" onClick={handleLocationRequest}>
              Dozvoli lokaciju
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
            <span>{stores.length} lokacija</span>
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
              Prikazano {filteredStores.length} od {stores.length}
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
                  <p className={styles.cardLabel}>Najbliža prodavnica</p>
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
              {filteredStores.map((store) => (
                <StoreCard
                  isActive={store.id === selectedStore?.id}
                  key={store.id}
                  onSelect={handleSelectStore}
                  store={store}
                />
              ))}
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
            onSelect={handleSelectStore}
            selectedStore={selectedStore}
            stores={visibleStores}
            visibleOnMobile={mapVisible}
          />
        ) : null}
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
          <a className={styles.primaryButton} href="#store-locator-list">
            Pronađi prodavnicu
          </a>
        </div>
      ) : null}
    </main>
  );
}
