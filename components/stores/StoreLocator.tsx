"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PartnerMap } from "@/components/stores/PartnerMap";
import { getCityDisplayEntries } from "@/components/stores/store-locator-display";
import { SearchableCombobox } from "@/components/ui/SearchableCombobox";
import { toTelHref } from "@/lib/company-contact";
import { findNearestPartnerStore, type GeoPoint } from "@/lib/nearest-store";
import { PLACE_VALUE_PREFIX, type ChosenPlace, useSettlementIndex } from "@/lib/places/useSettlementIndex";
import {
  distanceKindLabel,
  formatDistanceKm,
  navigationHref,
  rankStoresByDistance,
  splitRankedStores,
} from "@/lib/store-distance";
import {
  getLocationCategoryLabel,
  getLocationCategoryOptions,
  getPartnerCityKey,
  getPartnerCityLabel,
  getPartnerLocationStats,
  getPartnerLocationTypeLabel,
  getPrimaryLocationCategory,
  getPurchaseLocations,
  hasLocationCategory,
  hasPartnerCoordinates,
  type PartnerStore,
  type PublicLocationCategory,
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
  return toTelHref(phone) ?? undefined;
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
  if (lastDigit === 1 && lastTwoDigits !== 11) return `${count} lokacija`;
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14)) {
    return `${count} lokacije`;
  }
  return `${count} lokacija`;
}

function listOnlyCountLabel(count: number) {
  if (count === 1) return "Još 1 lokacija je dostupna samo u listi.";
  if (count >= 2 && count <= 4) {
    return `Još ${count} lokacije su dostupne samo u listi.`;
  }
  return `Još ${count} lokacija je dostupno samo u listi.`;
}

/** „grad" u broju: 1 grad, 2–4 grada, 5+ gradova (21 grad, 11 gradova). */
function cityWord(count: number) {
  const lastTwo = count % 100;
  const last = count % 10;
  if (last === 1 && lastTwo !== 11) return "grad";
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return "grada";
  return "gradova";
}

export function StoreLocator({ stores }: { stores: PartnerStore[] }) {
  const searchRef = useRef<HTMLInputElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const resultRefs = useRef<Map<string, HTMLElement>>(new Map());
  const hasPublicStores = stores.length > 0;

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<PublicLocationCategory | "">("");
  const [selectedId, setSelectedId] = useState("");
  const [hoveredId, setHoveredId] = useState("");
  const [mapFailed, setMapFailed] = useState(false);
  const [locatorStatus, setLocatorStatus] = useState("");
  // Tačan filter po gradu iz `?grad=<ključ>` (veza „Sve lokacije (N)” sa početne): isti ključ
  // grada kao na početnoj, pa broj na vezi odgovara broju lokacija ovde.
  const [cityFilter, setCityFilter] = useState("");
  // Polazna tačka: izabrano mesto (bilo koje naselje Srbije) ili lokacija korisnika.
  // Ne filtrira listu — sve lokacije ostaju, poređane od najbliže.
  const [place, setPlace] = useState<ChosenPlace | null>(null);
  const [origin, setOrigin] = useState<GeoPoint | null>(null);
  const [originLabel, setOriginLabel] = useState("");
  const places = useSettlementIndex();
  const { resolve: resolvePlace } = places;
  const cityOptions = useMemo(
    () => getCityDisplayEntries(stores).map((entry) => ({ label: entry.city, value: entry.key })),
    [stores],
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const key = params.get("grad");
    if (key && stores.some((store) => getPartnerCityKey(store) === key)) setCityFilter(key);
    // `?mesto=<RZS broj>` (veza sa početne ili podeljena adresa): lista od tog mesta.
    const ref = params.get("mesto");
    if (ref && /^\d+$/.test(ref)) {
      void resolvePlace(`${PLACE_VALUE_PREFIX}${ref}`).then((chosen) => {
        if (chosen) applyPlace(chosen, false);
      });
    }
    // Adresa se čita samo pri prvom prikazu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stores]);

  function setPlaceInUrl(ref: string | null) {
    const url = new URL(window.location.href);
    if (ref) url.searchParams.set("mesto", ref);
    else url.searchParams.delete("mesto");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }

  function applyPlace(chosen: ChosenPlace, updateUrl = true) {
    setPlace(chosen);
    setOrigin(chosen.point);
    setOriginLabel(chosen.label);
    setSelectedId("");
    if (updateUrl) setPlaceInUrl(chosen.ref);
    const ranked = rankStoresByDistance(stores, chosen.point);
    const nearest = ranked.find((item) => item.distanceKm !== null);
    setLocatorStatus(
      nearest && nearest.distanceKm !== null
        ? `Lokacije su poređane od mesta ${chosen.label}, približno ${distanceKindLabel("air")}. Najbliža: ${nearest.store.name}, ${nearest.store.city} — oko ${formatDistanceKm(nearest.distanceKm)}.`
        : `Za mesto ${chosen.label} nije moguće izračunati udaljenost: lokacije nemaju koordinate.`,
    );
    railRef.current?.scrollTo({ top: 0 });
  }

  async function handlePlaceChange(value: string) {
    const cityStore = stores.find((store) => getPartnerCityKey(store) === value);
    setLocatorStatus("Tražimo izabrano mesto…");
    const chosen = await resolvePlace(
      value,
      cityStore ? getPartnerCityLabel(cityStore) : undefined,
      cityStore && hasPartnerCoordinates(cityStore)
        ? { lat: cityStore.latitude, lng: cityStore.longitude }
        : null,
    );
    if (!chosen) {
      setLocatorStatus("Spisak mesta trenutno nije dostupan. Koristite svoju lokaciju ili pretragu po nazivu.");
      return;
    }
    applyPlace(chosen);
  }

  function clearPlace() {
    setPlace(null);
    setOrigin(null);
    setOriginLabel("");
    setPlaceInUrl(null);
    setLocatorStatus("");
  }

  const cityFilterLabel = useMemo(() => {
    const store = cityFilter ? stores.find((item) => getPartnerCityKey(item) === cityFilter) : undefined;
    return store ? getPartnerCityLabel(store) : "";
  }, [cityFilter, stores]);

  function clearCityFilter() {
    setCityFilter("");
    const url = new URL(window.location.href);
    url.searchParams.delete("grad");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }

  const typeOptions = useMemo(() => getLocationCategoryOptions(stores), [stores]);
  const stats = useMemo(() => getPartnerLocationStats(stores), [stores]);
  const mappableStores = useMemo(() => stores.filter(hasPartnerCoordinates), [stores]);

  const filteredStores = useMemo(() => {
    const normalizedQuery = normalize(query.trim());

    return stores.filter((store) => {
      if (cityFilter && getPartnerCityKey(store) !== cityFilter) return false;
      if (typeFilter && !hasLocationCategory(store, typeFilter)) return false;
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
  }, [cityFilter, query, stores, typeFilter]);

  // Sa polaznom tačkom: od najbliže, a lokacije bez koordinata kao posebna grupa na kraju.
  const rankedList = useMemo(
    () =>
      origin
        ? rankStoresByDistance(filteredStores, origin)
        : filteredStores.map((store) => ({ store, distanceKm: null, kind: "air" as const })),
    [filteredStores, origin],
  );
  const { withDistance, withoutDistance } = useMemo(
    () => (origin ? splitRankedStores(rankedList) : { withDistance: rankedList, withoutDistance: [] }),
    [origin, rankedList],
  );

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
        // „Najbliža prodavnica“ se traži među lokacijama „Gde kupiti“; ostale
        // grupe samo ako prodavnica sa koordinatama ne postoji.
        const origin = { lat: position.coords.latitude, lng: position.coords.longitude };
        const nearest =
          findNearestPartnerStore(getPurchaseLocations(stores), origin) ??
          findNearestPartnerStore(stores, origin);

        if (!nearest) {
          setLocatorStatus("Koordinate trenutno nisu dostupne za poređenje. Koristite pretragu.");
          return;
        }

        setQuery("");
        setTypeFilter("");
        clearCityFilter();
        setPlace(null);
        setPlaceInUrl(null);
        setOrigin(origin);
        setOriginLabel("Vaša lokacija");
        setSelectedId(nearest.store.id);
        scrollResultIntoView(nearest.store.id);
        setLocatorStatus(
          `Najbliža dostupna lokacija: ${nearest.store.name}, ${nearest.store.city} — oko ${formatDistanceKm(nearest.distanceKm)} ${distanceKindLabel("air")}. Ostale lokacije su poređane od najbliže.`,
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
      ? `Na mapi je svih ${formatMarkerCount(mappableStores.length)}.`
      : `Na mapi: ${formatMarkerCount(filteredMarkerCount)} od ${mappableStores.length}.`;
  const resultCountLabel =
    filteredListOnlyCount > 0
      ? `${markerResultLabel} ${listOnlyCountLabel(filteredListOnlyCount)}`
      : markerResultLabel;

  const showMap = mappableStores.length > 0 && !mapFailed;

  function renderStore(store: PartnerStore, distanceKm: number | null) {
    const isSelected = store.id === selectedId;

    return (
      <article
        id={store.id}
        className={`${styles.resultItem} ${
          isSelected ? styles.resultItemSelected : ""
        } cs-interactive-surface`}
        data-category={getPrimaryLocationCategory(store)}
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
          <span className={styles.resultCategory} data-category={getPrimaryLocationCategory(store)}>
            <i aria-hidden="true" className={styles.categoryMark} data-category={getPrimaryLocationCategory(store)} />
            {getLocationCategoryLabel(getPrimaryLocationCategory(store))}
          </span>
          <span className={styles.resultKicker}>
            <span>
              {getPartnerLocationTypeLabel(store)} · {store.city}
            </span>
            <i aria-hidden="true" />
          </span>
          <strong>{store.name}</strong>
          <span className={styles.resultAddress}>{store.address}</span>
          {/* Telefon je vidljiv u svakoj kartici, ne tek posle izbora prodavnice. */}
          {store.phone ? (
            <span className={styles.resultAddress}>Tel. {store.phone}</span>
          ) : null}
          {locationNotice(store) ? (
            <span className={styles.resultNote}>{locationNotice(store)}</span>
          ) : null}
          {distanceKm !== null ? (
            <span className={styles.resultDistance}>
              ≈ {formatDistanceKm(distanceKm)}{" "}
              <small>
                {distanceKindLabel("air")} od: {originLabel}
              </small>
            </span>
          ) : null}
        </button>

        {/* Navigacija je vidljiva u svakoj kartici posle izbora mesta, ne tek posle izbora lokacije. */}
        {origin && !isSelected && navigationHref(store, origin) ? (
          <a
            className={styles.resultNavLink}
            href={navigationHref(store, origin) ?? undefined}
            rel="noreferrer"
            target="_blank"
          >
            Navigacija →
          </a>
        ) : null}

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
                <span>Pozovite</span>
              </a>
            ) : null}
            {navigationHref(store, origin) ? (
              <a
                className={styles.secondaryButton}
                href={navigationHref(store, origin) ?? undefined}
                rel="noreferrer"
                target="_blank"
              >
                Navigacija →
              </a>
            ) : null}
            <a className={styles.ghostAction} href={`/kontakt?tema=prodavnica&prodavnica=${store.id}`}>
              Pošaljite upit
            </a>
          </div>
        ) : null}
      </article>
    );
  }

  return (
    <main className={styles.main}>
      <section className={styles.hero} aria-labelledby="stores-title">
        <p className={`${styles.kicker} ${styles.heroEyebrow}`}>Lokator mreže</p>
        <div className={styles.heroGrid}>
          <h1 className={`${styles.title} ${styles.titleReveal}`} id="stores-title">
            Gde kupiti i servisi
          </h1>
          <p className={`${styles.subtitle} ${styles.subtitleReveal}`}>
            {hasPublicStores
              ? `${stats.locationCount} lokacija na mapi u ${stats.cityCount} ${cityWord(stats.cityCount)}. Prodavnice za kupovinu i servisi sa lakirnicama označeni su posebno.`
              : "Lokator trenutno nema objavljenih poslovnih lokacija."}
          </p>
        </div>
      </section>

      <section className={`${styles.controls} ${styles.controlsReveal}`} aria-label="Pretraga i filteri">
        <div className={styles.placeBox}>
          <SearchableCombobox
            ariaLabel="Vaše mesto"
            disabled={!hasPublicStores}
            emptyMessage="Nema mesta koje odgovara unosu. Proverite naziv."
            id="store-place"
            loadingMessage="Učitavamo spisak mesta…"
            onChange={(value) => void handlePlaceChange(value)}
            onOpen={places.load}
            options={cityOptions}
            placeholder="Vaše mesto — od najbliže lokacije"
            searchOptions={places.searchOptions}
            searchPlaceholder="Upišite mesto (npr. Čačak, Чачак)"
            sheetTitle="Izaberite mesto"
            value={place?.value ?? ""}
            valueLabel={place?.label}
          />
        </div>
        <div className={styles.searchBox}>
          <label className="sr-only" htmlFor="store-search">
            Pretraga lokacija
          </label>
          <input
            className={styles.searchInput}
            id="store-search"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filtrirajte po nazivu, gradu ili adresi..."
            ref={searchRef}
            type="search"
            value={query}
          />
        </div>

        {typeOptions.length > 1 ? (
          <div className={styles.typeChips} role="group" aria-label="Vrsta lokacije">
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
                data-category={option.value}
                key={option.value}
                onClick={() =>
                  setTypeFilter((current) =>
                    current === option.value ? "" : option.value,
                  )
                }
                type="button"
              >
                <i aria-hidden="true" className={styles.categoryMark} data-category={option.value} />
                {option.label}
                <span className={styles.typeChipCount}>{option.count}</span>
              </button>
            ))}
          </div>
        ) : null}

        {cityFilter ? (
          <button
            aria-label={`Uklonite filter grada: ${cityFilterLabel}`}
            className={`${styles.typeChip} ${styles.typeChipActive}`}
            onClick={clearCityFilter}
            type="button"
          >
            Grad: {cityFilterLabel} <span aria-hidden="true">×</span>
          </button>
        ) : null}

        {place ? (
          <button
            aria-label={`Uklonite polazno mesto: ${place.label}`}
            className={`${styles.typeChip} ${styles.typeChipActive}`}
            onClick={clearPlace}
            type="button"
          >
            Od mesta: {place.label} <span aria-hidden="true">×</span>
          </button>
        ) : null}

        <button className={styles.locateButton} onClick={handleLocationRequest} type="button">
          Koristite svoju lokaciju
        </button>
      </section>

      <div className={styles.resultsMeta}>
        <span>{resultCountLabel}</span>
        <span aria-live="polite">{locatorStatus}</span>
        {origin ? (
          <span className={styles.distanceNote}>
            Udaljenost je približna: vazdušnom linijom od centra mesta, ne kilometraža vožnje.
            Spisak mesta: © OpenStreetMap saradnici (ODbL).
          </span>
        ) : null}
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
                origin={origin}
                originLabel={originLabel || undefined}
                selectedId={selectedId}
                stores={stores}
                visibleIds={visibleIds}
              />
              {typeOptions.length > 1 ? (
                <ul className={styles.mapLegend} aria-label="Oznake na mapi">
                  {typeOptions.map((option) => (
                    <li key={option.value}>
                      <i aria-hidden="true" className={styles.categoryMark} data-category={option.value} />
                      {option.label}
                    </li>
                  ))}
                </ul>
              ) : null}
              {selectedStore ? (
                <div className={styles.selectedSummary} data-selected-summary>
                  <p className={styles.summaryKicker}>
                    {getLocationCategoryLabel(getPrimaryLocationCategory(selectedStore))} ·{" "}
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
                        Pozovite
                      </a>
                    ) : null}
                    {navigationHref(selectedStore, origin) ? (
                      <a
                        className={styles.summaryRoute}
                        href={navigationHref(selectedStore, origin) ?? undefined}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Navigacija →
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
                  : "Lokacije još nisu objavljene."}
              </p>
            </div>
          )}
        </div>

        <div className={styles.resultsRail} ref={railRef}>
          {rankedList.length > 0 ? (
            <>
              {withDistance.map((item) => renderStore(item.store, item.distanceKm))}
              {origin && withoutDistance.length > 0 ? (
                <p className={styles.resultGroupLabel}>
                  Bez tačne pozicije na mapi — udaljenost nije izračunata
                </p>
              ) : null}
              {withoutDistance.map((item) => renderStore(item.store, null))}
            </>
          ) : (
            <div className={styles.emptyState}>
              <strong>
                {hasPublicStores
                  ? "Nema lokacija za izabranu pretragu."
                  : "Lokacije trenutno nisu dostupne."}
              </strong>
              <p>
                {hasPublicStores
                  ? "Proverite unos ili resetujte filter vrste lokacije."
                  : "Za najbliže prodajno mesto kontaktirajte nas."}
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
                Resetujte pretragu
              </button>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
