import type { PartnerStore } from "@/lib/partner-stores";
import styles from "./StoresPage.module.css";

function telHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

function mapsHref(store: PartnerStore) {
  const query = [store.name, store.address, store.city, "Srbija"].join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function StoreMap({
  selectedStore,
  stores,
  onSelect,
  visibleOnMobile,
}: {
  selectedStore: PartnerStore;
  stores: PartnerStore[];
  onSelect: (storeId: string) => void;
  visibleOnMobile: boolean;
}) {
  return (
    <aside
      className={`${styles.mapColumn} ${visibleOnMobile ? styles.mapColumnVisible : ""}`}
      data-store-map-column
      aria-label="Mapa partnerskih prodavnica"
    >
      <div className={styles.mapShell} data-coordinate-mode="approximate">
        <div className={styles.mapHeader}>
          <div>
            <p className={styles.sectionKicker}>Tehnička mapa</p>
            <h2>Partneri u Srbiji</h2>
          </div>
          <span>{stores.length} lokacija</span>
        </div>
        <div className={styles.serbiaShape} aria-hidden="true" />
        <div className={styles.mapRail} aria-hidden="true" />
        {stores.map((store) => (
          <button
            aria-label={`Izaberi prodavnicu ${store.name}, ${store.city}`}
            aria-pressed={store.id === selectedStore.id}
            className={`${styles.pinButton} ${
              store.id === selectedStore.id ? styles.pinButtonActive : ""
            }`}
            key={store.id}
            onClick={() => onSelect(store.id)}
            style={{
              left: `${store.mapPosition.x}%`,
              top: `${store.mapPosition.y}%`,
            }}
            data-coordinate-mode="approximate"
            data-map-pin
            data-store-id={store.id}
            type="button"
          >
            {store.city}
          </button>
        ))}
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
