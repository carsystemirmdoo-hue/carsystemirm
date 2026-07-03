import type { PartnerStore } from "@/lib/partner-stores";
import styles from "./StoresPage.module.css";

function telHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

function mapsHref(store: PartnerStore) {
  const query = [store.name, store.address, store.city, "Srbija"].join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function StoreCard({
  isActive,
  onSelect,
  store,
}: {
  isActive: boolean;
  onSelect: (storeId: string) => void;
  store: PartnerStore;
}) {
  return (
    <article
      className={`${styles.storeCard} ${isActive ? styles.storeCardActive : ""}`}
      data-store-card
    >
      <div className={styles.storeHeader}>
        <div>
          <p className={styles.cardLabel}>{store.region}</p>
          <h3>{store.name}</h3>
        </div>
        <span className={styles.storeHeaderBadges}>
          {store.featured ? <span className={styles.centralBadge}>Centrala</span> : null}
          <button
            className={styles.nearestCity}
            type="button"
            onClick={() => onSelect(store.id)}
            aria-pressed={isActive}
          >
            {store.city}
          </button>
        </span>
      </div>

      <p className={styles.storeDescription}>{store.description}</p>

      <div className={styles.storeMeta}>
        <span>
          <strong>Adresa:</strong> {store.address}
        </span>
        <span>
          <strong>Telefon:</strong> {store.phone}
        </span>
        <span>
          <strong>Radno vreme:</strong> {store.workingHours}
        </span>
      </div>

      <div className={styles.storeTags} aria-label="Dostupni programi i brendovi">
        {[...store.brands.slice(0, 3), ...store.programs.slice(0, 2)].map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>

      <div className={styles.storeActions}>
        <a
          className={`${styles.primaryButton} cs-magnetic-cta cs-theme-wipe-card`}
          href={telHref(store.phone)}
          data-cursor="button"
          data-motion-surface
          data-motion="theme-wipe"
        >
          <span>Pozovi</span>
        </a>
        <a
          className={styles.secondaryButton}
          href={mapsHref(store)}
          target="_blank"
          rel="noreferrer"
        >
          Prikaži rutu
        </a>
        <a
          className={`${styles.ghostButton} cs-magnetic-cta cs-theme-wipe-card`}
          href={`/kontakt?tema=prodavnica&prodavnica=${store.id}`}
          data-cursor="button"
          data-motion-surface
          data-motion="theme-wipe"
        >
          <span>Pošalji upit</span>
        </a>
      </div>
    </article>
  );
}
