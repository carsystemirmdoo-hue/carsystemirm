"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PartnerMap } from "@/components/stores/PartnerMap";
import { findNearestPartnerStore } from "@/lib/nearest-store";
import {
  getLocationTypeOptions,
  getPartnerLocationStats,
  getPartnerLocationTypeLabel,
  hasPartnerCoordinates,
  hasPartnerLocationType,
  type PartnerLocationType,
  type PartnerStore,
} from "@/lib/partner-stores";
import styles from "./StoresPage.module.css";

function normalize(value: string) {
  return value
    .toLocaleLowerCase("sr-Latn")
    .replaceAll("đ", "dj")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function telHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

function routeHref(store: PartnerStore) {
  if (!hasPartnerCoordinates(store)) return null;
  return `https://www.openstreetmap.org/?mlat=${store.latitude}&mlon=${store.longitude}#map=15/${store.latitude}/${store.longitude}`;
}

function locationNotice(store: PartnerStore) {
  if (store.coordinateStatus === "approximate") {
    return "Približna lokacija — tačna pozicija još nije potvrđena.";
  }
  if (store.coordinateStatus === "unavailable") {
    return "Lokacija je dostupna u listi, ali pozicija na mapi još nije određena.";
  }
  return null;
}

function formatMarkerCount(count: number) {
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;
  if (lastDigit === 1 && lastTwoDigits !== 11) return `${count} javni marker`;
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14)) {
    return `${count} javna markera`;
  }
  return `${count} javnih markera`;
}

function listOnlyCountLabel(count: number) {
  if (count === 1) return "Još 1 lokacija je dostupna samo u listi.";
  if (count >= 2 && count <= 4) {
    return `Još ${count} lokacije su dostupne samo u listi.`;
  }
  return `Još ${count} lokacija je dostupno samo u listi.`;
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
  const mappableStores = useMemo(() => stores.filter(hasPartnerCoordinates), [stores]);

  const filteredStores = useMemo(() => {
    const normalizedQuery = normalize(query.trim());

    return stores.filter((store) => {
      if (typeFilter && !hasPartnerLocationType(store, typeFilter)) return false;
      if (!normalizedQuery) return true;

      return [
        store.name,
        store.city,
        store.address,
        ...(store.alternativeNames ?? []),
      ].some((field) =>
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

  const filteredMarkerCount = filteredStores.filter(hasPartnerCoordinates).length;
  const filteredListOnlyCount = filteredStores.length - filteredMarkerCount;
  const markerResultLabel =
    filteredMarkerCount === mappableStores.length
      ? `Prikazano svih ${formatMarkerCount(mappableStores.length)}.`
      : `Prikazano ${formatMarkerCount(filteredMarkerCount)} od ${formatMarkerCount(mappableStores.length)}.`;
  const resultCountLabel =
    filteredListOnlyCount > 0
      ? `${markerResultLabel} ${listOnlyCountLabel(filteredListOnlyCount)}`
      : markerResultLabel;

  const showMap = mappableStores.length > 0 && !mapFailed;

  return (
    <main className={styles.main}>
      <section className={styles.hero} aria-labelledby="stores-title">
        <p className={`${styles.kicker} ${styles.heroEyebrow}`}>Lokator mreže</p>
        <div className={styles.heroGrid}>
          <h1 className={`${styles.title} ${styles.titleReveal}`} id="stores-title">
            Prodajna i partnerska mreža
          </h1>
          <p className={`${styles.subtitle} ${styles.subtitleReveal}`}>
            {hasPublicStores
              ? `${stats.locationCount} javnih markera u ${stats.cityCount} gradova u internom preview prikazu. Poslovni kontakti bez preciznijeg tipa označeni su kao partnerske lokacije.`
              : "Lokator trenutno nema poslovnih lokacija spremnih za interni preview prikaz."}
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
            placeholder="Pretraži grad, naziv ili adresu..."
            ref={searchRef}
            type="search"
            value={query}
          />
        </div>

        {typeOptions.length > 1 ? (
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
                  setTypeFilter((current) =>
                    current === option.value ? "" : option.value,
                  )
                }
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : null}

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
                  {locationNotice(selectedStore) ? (
                    <span className={styles.resultNote}>{locationNotice(selectedStore)}</span>
                  ) : null}
                  <div className={styles.summaryActions}>
                    {selectedStore.phone ? (
                      <a className={styles.summaryCall} href={telHref(selectedStore.phone)}>
                        Pozovi
                      </a>
                    ) : null}
                    {routeHref(selectedStore) ? (
                      <a
                        className={styles.summaryRoute}
                        href={routeHref(selectedStore) ?? undefined}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Ruta →
                      </a>
                    ) : null}
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
                  ? "Lista poslovnih lokacija ostaje dostupna. Lokacije bez pouzdanih koordinata nemaju marker ni navigaciju."
                  : "Lokacije za interni preview još nisu pripremljene."}
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
                  id={store.id}
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
                    {locationNotice(store) ? (
                      <span className={styles.resultNote}>{locationNotice(store)}</span>
                    ) : null}
                  </button>

                  {isSelected ? (
                    <div className={styles.resultActions}>
                      {store.phone ? (
                        <a
                          className={`${styles.primaryButton} cs-magnetic-cta cs-theme-wipe-card`}
                          data-cursor="button"
                          data-motion-surface
                          data-motion="theme-wipe"
                          href={telHref(store.phone)}
                        >
                          <span>Pozovi</span>
                        </a>
                      ) : null}
                      {routeHref(store) ? (
                        <a
                          className={styles.secondaryButton}
                          href={routeHref(store) ?? undefined}
                          rel="noreferrer"
                          target="_blank"
                        >
                          Ruta →
                        </a>
                      ) : null}
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
                  : "Neodobreni kandidati su zadržani samo u internom review fajlu."}
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
