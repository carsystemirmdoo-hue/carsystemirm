import type { PartnerStore } from "@/lib/partner-stores";
import {
  formatStoreCount,
  getCityBadgeLabel,
  getCityDisplayCount,
  getCityDisplayLabel,
} from "./store-locator-display";
import styles from "./StoresPage.module.css";

// TODO: Zameniti custom projekciju Leaflet + OpenStreetMap mapom kada budu
// spremne realne adrese i koordinate svih partnera u mreži.
const SERBIA_BOUNDS = {
  maxLat: 46.25,
  maxLng: 23.05,
  minLat: 42.15,
  minLng: 18.8,
} as const;

function telHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

function mapsHref(store: PartnerStore) {
  const query = [store.name, store.address, store.city, "Srbija"].join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getProjectedMapPosition(store: PartnerStore) {
  if (!store.coordinates) {
    return { ...store.mapPosition, mode: "approximate" as const };
  }

  const x =
    ((store.coordinates.lng - SERBIA_BOUNDS.minLng) /
      (SERBIA_BOUNDS.maxLng - SERBIA_BOUNDS.minLng)) *
    100;
  const y =
    ((SERBIA_BOUNDS.maxLat - store.coordinates.lat) /
      (SERBIA_BOUNDS.maxLat - SERBIA_BOUNDS.minLat)) *
    100;

  return {
    mode: "coordinates" as const,
    x: clamp(x, 7, 93),
    y: clamp(y, 7, 93),
  };
}

function getCityGroups(stores: PartnerStore[], selectedStore: PartnerStore) {
  const groups = new Map<string, PartnerStore[]>();

  stores.forEach((store) => {
    const cityStores = groups.get(store.city) ?? [];
    cityStores.push(store);
    groups.set(store.city, cityStores);
  });

  return Array.from(groups.entries())
    .map(([city, cityStores]) => {
      const representative =
        cityStores.find((store) => store.id === selectedStore.id) ??
        cityStores.find((store) => store.featured) ??
        cityStores[0];

      return {
        badgeLabel: getCityBadgeLabel(city, cityStores.length),
        city,
        displayCount: getCityDisplayCount(city, cityStores.length),
        label: getCityDisplayLabel(city),
        position: getProjectedMapPosition(representative),
        representative,
        stores: cityStores,
      };
    })
    .sort((a, b) => a.city.localeCompare(b.city, "sr-Latn"));
}

export function StoreMap({
  selectedStore,
  storeDisplayCount,
  stores,
  onSelect,
  visibleOnMobile,
}: {
  selectedStore: PartnerStore;
  storeDisplayCount: number;
  stores: PartnerStore[];
  onSelect: (storeId: string) => void;
  visibleOnMobile: boolean;
}) {
  const cityGroups = getCityGroups(stores, selectedStore);
  const hasCoordinatePins = cityGroups.some((group) => group.position.mode === "coordinates");

  return (
    <aside
      className={`${styles.mapColumn} ${visibleOnMobile ? styles.mapColumnVisible : ""}`}
      data-store-map-column
      aria-label="Mapa partnerskih prodavnica"
    >
      <div
        className={styles.mapShell}
        data-coordinate-mode={hasCoordinatePins ? "coordinates" : "approximate"}
      >
        <div className={styles.mapHeader}>
          <div>
            <p className={styles.sectionKicker}>Tehnička mapa</p>
            <h2>Partneri u Srbiji</h2>
          </div>
          <span>
            {formatStoreCount(storeDisplayCount)} u mreži · {cityGroups.length} gradova
          </span>
        </div>
        <div className={styles.serbiaShape} aria-hidden="true" />
        <div className={styles.mapRail} aria-hidden="true" />
        {cityGroups.map((group) => {
          const isActiveCity = group.city === selectedStore.city;

          return (
            <button
              aria-label={`Izaberi grad ${group.city}, ${group.badgeLabel}`}
              aria-pressed={isActiveCity}
              className={`${styles.pinButton} ${isActiveCity ? styles.pinButtonActive : ""}`}
              key={group.city}
              onClick={() => onSelect(group.representative.id)}
              style={{
                left: `${group.position.x}%`,
                top: `${group.position.y}%`,
              }}
              data-coordinate-mode={group.position.mode}
              data-map-pin
              data-store-id={group.representative.id}
              type="button"
            >
              <span className={styles.pinCount}>
                {group.label === "Centrala" ? "C" : group.displayCount}
              </span>
              <span className={styles.pinCity}>
                {group.city}
                {group.label ? ` · ${group.label}` : ""}
              </span>
            </button>
          );
        })}
      </div>

      <section className={styles.selectedPanel} aria-labelledby="selected-store-title">
        <p className={styles.sectionKicker}>Izabrana lokacija</p>
        <h2 id="selected-store-title">{selectedStore.name}</h2>
        <p>{selectedStore.description}</p>
        <dl>
          <div>
            <dt>Grad</dt>
            <dd>{selectedStore.city}</dd>
          </div>
          <div>
            <dt>Adresa</dt>
            <dd>{selectedStore.address}</dd>
          </div>
          <div>
            <dt>Radno vreme</dt>
            <dd>{selectedStore.workingHours}</dd>
          </div>
        </dl>
        <div className={styles.storeActions}>
          <a className={styles.primaryButton} href={telHref(selectedStore.phone)}>
            Pozovi
          </a>
          <a
            className={styles.secondaryButton}
            href={mapsHref(selectedStore)}
            target="_blank"
            rel="noreferrer"
          >
            Prikaži rutu
          </a>
        </div>
      </section>
    </aside>
  );
}
