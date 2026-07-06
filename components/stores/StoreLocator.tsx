"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PartnerMap } from "@/components/stores/PartnerMap";
import { findNearestPartnerStore } from "@/lib/nearest-store";
import {
  getLocationTypeOptions,
  getPartnerLocationStats,
  getPartnerLocationTypeLabel,
  hasPartnerLocationType,
  type PartnerLocationType,
  type PartnerStore,
} from "@/lib/partner-stores";
import styles from "./StoresPage.module.css";

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function telHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

function routeHref(store: PartnerStore) {
  if (store.coordinates) {
    return `https://www.openstreetmap.org/?mlat=${store.coordinates.lat}&mlon=${store.coordinates.lng}#map=15/${store.coordinates.lat}/${store.coordinates.lng}`;
  }

  const countryHint = store.region.includes("BiH") ? "Bosna i Hercegovina" : "Srbija";
  const query = [store.name, store.address, store.city, countryHint].join(", ");
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(query)}`;
}

export function StoreLocator({ stores }: { stores: PartnerStore[] }) {
  const searchRef = useRef<HTMLInputElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const resultRefs = useRef<Map<string, HTMLElement>>(new Map());
  const hasPublicStores = stores.length > 0;

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<PartnerLocationType | "">("");
  const [selectedId, setSelectedId] = useState("");
  const [hoveredId, setHoveredId] = useState("");
  const [mapFailed, setMapFailed] = useState(false);
  const [locatorStatus, setLocatorStatus] = useState("");

  const typeOptions = useMemo(() => getLocationTypeOptions(stores), [stores]);
  const stats = useMemo(() => getPartnerLocationStats(stores), [stores]);

  const filteredStores = useMemo(() => {
    const normalizedQuery = normalize(query.trim());

    return stores.filter((store) => {
      if (typeFilter && !hasPartnerLocationType(store, typeFilter)) return false;
      if (!normalizedQuery) return true;

      return [store.name, store.city, store.address].some((field) =>
        normalize(field).includes(normalizedQuery),
      );
    });
  }, [query, stores, typeFilter]);

  const visibleIds = useMemo(
    () => new Set(filteredStores.map((store) => store.id)),
    [filteredStores],
  );
  const selectedStore = stores.find((store) => store.id === selectedId) ?? null;

  // Map and list must always agree: a selection excluded by the current
  // search/filter state is cleared instead of lingering as a stale marker.
  useEffect(() => {
    if (selectedId && !visibleIds.has(selectedId)) {
      setSelectedId("");
    }
  }, [selectedId, visibleIds]);

  function scrollResultIntoView(storeId: string) {
    const rail = railRef.current;
    const item = resultRefs.current.get(storeId);
    if (!rail || !item) return;

    // Manual scrollTop keeps the page itself from jumping, unlike
    // scrollIntoView on nested scroll containers.
    const railRect = rail.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    const target = rail.scrollTop + itemRect.top - railRect.top - 12;
    rail.scrollTo({
      top: Math.max(0, target),
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }

  function handleSelectFromList(storeId: string) {
    setSelectedId(storeId);
  }

  function handleSelectFromMap(storeId: string) {
    setSelectedId(storeId);
    scrollResultIntoView(storeId);
  }

  function handleLocationRequest() {
    if (!hasPublicStores) {
      setLocatorStatus("Nema potvrđenih javnih lokacija za poređenje udaljenosti.");
      return;
    }

    if (!("geolocation" in navigator)) {
      setLocatorStatus("Geolokacija nije podržana u ovom pregledaču. Koristite pretragu.");
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
          setLocatorStatus("Koordinate trenutno nisu dostupne za poređenje. Koristite pretragu.");
          return;
        }

        setQuery("");
        setTypeFilter("");
        setSelectedId(nearest.store.id);
        scrollResultIntoView(nearest.store.id);
        setLocatorStatus(
          `Najbliža dostupna lokacija: ${nearest.store.name}, ${nearest.store.city} — oko ${Math.max(1, Math.round(nearest.distanceKm))} km.`,
        );
      },
      () => {
        setLocatorStatus("Lokacija nije odobrena. Unesite grad u pretragu.");
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  }

  const resultCountLabel =
    filteredStores.length === stores.length
      ? `Prikazano svih ${stores.length} lokacija.`
      : `Prikazano ${filteredStores.length} od ${stores.length} lokacija.`;

  const showMap = hasPublicStores && !mapFailed;

  return (
    <main className={styles.main}>
      <section className={styles.hero} aria-labelledby="stores-title">
        <p className={`${styles.kicker} ${styles.heroEyebrow}`}>Partnerska mreža</p>
        <div className={styles.heroGrid}>
          <h1 className={`${styles.title} ${styles.titleReveal}`} id="stores-title">
            Pronađite najbliže prodajno mesto
          </h1>
          <p className={`${styles.subtitle} ${styles.subtitleReveal}`}>
            {hasPublicStores
              ? `${stats.locationCount} partnerskih lokacija u ${stats.cityCount} gradova — potvrđena prodajna mesta, servisi i podrška programa.`
              : "Lokator prikazuje samo potvrđene javne prodajne lokacije, bez demo adresa."}
          </p>
        </div>
      </section>

      <section className={`${styles.controls} ${styles.controlsReveal}`} aria-label="Pretraga i filteri">
        <div className={styles.searchBox}>
          <label className="sr-only" htmlFor="store-search">
            Pretraga lokacija
          </label>
          <input
            className={styles.searchInput}
            id="store-search"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Pretraži grad ili naziv..."
            ref={searchRef}
            type="search"
            value={query}
          />
        </div>

        <div className={styles.typeChips} role="group" aria-label="Tip lokacije">
          <button
            aria-pressed={typeFilter === ""}
            className={`${styles.typeChip} ${typeFilter === "" ? styles.typeChipActive : ""}`}
            onClick={() => setTypeFilter("")}
            type="button"
          >
            Sve
          </button>
          {typeOptions.map((option) => (
            <button
              aria-pressed={typeFilter === option.value}
              className={`${styles.typeChip} ${
                typeFilter === option.value ? styles.typeChipActive : ""
              }`}
              key={option.value}
              onClick={() =>
                setTypeFilter((current) => (current === option.value ? "" : option.value))
              }
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>

        <button className={styles.locateButton} onClick={handleLocationRequest} type="button">
          Koristi moju lokaciju
        </button>
      </section>

      <div className={styles.resultsMeta}>
        <span>{resultCountLabel}</span>
        <span aria-live="polite">{locatorStatus}</span>
      </div>

      <section className={styles.locatorShell} aria-label="Mapa i rezultati">
        <div className={styles.mapColumn}>
          {showMap ? (
            <>
              <PartnerMap
                hoveredId={hoveredId}
                onError={() => setMapFailed(true)}
                onReady={() => setMapFailed(false)}
                onSelect={handleSelectFromMap}
                selectedId={selectedId}
                stores={stores}
                visibleIds={visibleIds}
              />
              {selectedStore ? (
                <div className={styles.selectedSummary} data-selected-summary>
                  <p className={styles.summaryKicker}>
                    {getPartnerLocationTypeLabel(selectedStore)} · {selectedStore.city}
                  </p>
                  <strong>{selectedStore.name}</strong>
                  <span>{selectedStore.address}</span>
                  <div className={styles.summaryActions}>
                    <a className={styles.summaryCall} href={telHref(selectedStore.phone)}>
                      Pozovi
                    </a>
                    <a
                      className={styles.summaryRoute}
                      href={routeHref(selectedStore)}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Ruta →
                    </a>
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <div className={styles.mapFallback}>
              <strong>
                {hasPublicStores
                  ? "Mapa trenutno nije dostupna."
                  : "Mapa čeka potvrđene javne lokacije."}
              </strong>
              <p>
                {hasPublicStores
                  ? "Lista partnerskih lokacija ispod ostaje potpuna — izaberite lokaciju i pozovite direktno."
                  : "Demo i nepotpuni zapisi se ne prikazuju javno."}
              </p>
            </div>
          )}
        </div>

        <div className={styles.resultsRail} ref={railRef}>
          {filteredStores.length > 0 ? (
            filteredStores.map((store) => {
              const isSelected = store.id === selectedId;

              return (
                <article
                  className={`${styles.resultItem} ${
                    isSelected ? styles.resultItemSelected : ""
                  } cs-interactive-surface`}
                  data-motion-surface
                  key={store.id}
                  onBlur={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget)) {
                      setHoveredId((current) => (current === store.id ? "" : current));
                    }
                  }}
                  onFocus={() => setHoveredId(store.id)}
                  onMouseEnter={() => setHoveredId(store.id)}
                  onMouseLeave={() =>
                    setHoveredId((current) => (current === store.id ? "" : current))
                  }
                  ref={(node) => {
                    if (node) {
                      resultRefs.current.set(store.id, node);
                    } else {
                      resultRefs.current.delete(store.id);
                    }
                  }}
                >
                  <button
                    aria-pressed={isSelected}
                    className={styles.resultButton}
                    onClick={() => handleSelectFromList(store.id)}
                    type="button"
                  >
                    <span className={styles.resultKicker}>
                      <span>
                        {getPartnerLocationTypeLabel(store)} · {store.city}
                      </span>
                      <i aria-hidden="true" />
                    </span>
                    <strong>{store.name}</strong>
                    <span className={styles.resultAddress}>{store.address}</span>
                    {!store.coordinates ? (
                      <span className={styles.resultNote}>
                        Koordinate još nisu dostupne — lokacija je vidljiva samo u listi.
                      </span>
                    ) : null}
                  </button>

                  {isSelected ? (
                    <div className={styles.resultActions}>
                      <a
                        className={`${styles.primaryButton} cs-magnetic-cta cs-theme-wipe-card`}
                        data-cursor="button"
                        data-motion-surface
                        data-motion="theme-wipe"
                        href={telHref(store.phone)}
                      >
                        <span>Pozovi</span>
                      </a>
                      <a
                        className={styles.secondaryButton}
                        href={routeHref(store)}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Ruta →
                      </a>
                      <a className={styles.ghostAction} href={`/kontakt?tema=prodavnica&prodavnica=${store.id}`}>
                        Pošalji upit
                      </a>
                    </div>
                  ) : null}
                </article>
              );
            })
          ) : (
            <div className={styles.emptyState}>
              <strong>
                {hasPublicStores
                  ? "Nema lokacija za izabranu pretragu."
                  : "Nema potvrđenih javnih lokacija."}
              </strong>
              <p>
                {hasPublicStores
                  ? "Proverite unos ili resetujte filter tipa lokacije."
                  : "Demo i nepotpuni zapisi su zadržani u data source-u, ali se ne prikazuju javno."}
              </p>
              <button
                className={styles.secondaryButton}
                onClick={() => {
                  setQuery("");
                  setTypeFilter("");
                  searchRef.current?.focus();
                }}
                type="button"
              >
                Resetuj pretragu
              </button>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
