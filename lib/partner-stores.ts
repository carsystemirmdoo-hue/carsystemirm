import {
  storeLocations,
  type PublicLocation,
  type PublicLocationType,
} from "@/data/store-locations";

export type PartnerLocationType = PublicLocationType;
export type PartnerStore = PublicLocation;
export type MappablePartnerStore = PartnerStore & {
  latitude: number;
  longitude: number;
};

export const partnerStores: PartnerStore[] = storeLocations;

export function getAllPartnerStores() {
  return [...partnerStores];
}

/**
 * Javni lokator prikazuje potvrđene (`verified`) i revidirane (`reviewed`)
 * lokacije. GAP-003 (2026-10-01) je ograničio prikaz na 9 potvrđenih; revizija
 * 2026-10-17 (data/public-location-decisions.json) vraća poslovne lokacije iz
 * BEX adresara za koje postoji javni dokaz. Zapisi `pending` ostaju u izvoru,
 * ali se ne prikazuju.
 */
export function isPubliclyListedStore(store: PartnerStore) {
  return (
    store.isPublic &&
    (store.verificationStatus === "verified" || store.verificationStatus === "reviewed")
  );
}

/**
 * Javne grupe lokatora:
 *  - `kupovina` — „Gde kupiti“: prodavnice dostupne krajnjim kupcima;
 *  - `servis` — „Servisi i lakirnice“: poslovne lokacije koje pružaju usluge;
 *  - `partner` — ostali poslovni partneri koje firma odluči da javno prikaže.
 * Prodavnica sa servisom pripada i kupovini i servisima.
 */
export type PublicLocationCategory = "kupovina" | "servis" | "partner";

export const PUBLIC_LOCATION_CATEGORIES: PublicLocationCategory[] = [
  "kupovina",
  "servis",
  "partner",
];

export function getPublicLocationCategories(store: PartnerStore): PublicLocationCategory[] {
  switch (store.type) {
    case "store":
      return ["kupovina"];
    case "service":
      return ["servis"];
    case "store_and_service":
      return ["kupovina", "servis"];
    default:
      return ["partner"];
  }
}

/** Glavna grupa (za oblik markera i oznaku kartice). */
export function getPrimaryLocationCategory(store: PartnerStore): PublicLocationCategory {
  return getPublicLocationCategories(store)[0];
}

export function getLocationCategoryLabel(category: PublicLocationCategory) {
  const labels: Record<PublicLocationCategory, string> = {
    kupovina: "Gde kupiti",
    partner: "Ostali poslovni partneri",
    servis: "Servisi i lakirnice",
  };
  return labels[category];
}

export function hasLocationCategory(store: PartnerStore, category: PublicLocationCategory) {
  return getPublicLocationCategories(store).includes(category);
}

export function getLocationCategoryOptions(stores: PartnerStore[]) {
  return PUBLIC_LOCATION_CATEGORIES.map((category) => ({
    count: stores.filter((store) => hasLocationCategory(store, category)).length,
    label: getLocationCategoryLabel(category),
    value: category,
  })).filter((option) => option.count > 0);
}

/** Lokacije gde krajnji kupac može da kupi; najbliža prodavnica se traži među njima. */
export function getPurchaseLocations(stores: PartnerStore[]) {
  return stores.filter((store) => hasLocationCategory(store, "kupovina"));
}

export function getPublicPartnerStores() {
  return partnerStores.filter(isPubliclyListedStore);
}

/**
 * Broj zapisa koji čekaju poslovnu potvrdu (`pending`). Nisu javni; početna
 * prikazuje samo broj, da bude jasno da javna mreža nije konačna.
 */
export function getPendingPartnerStoreCount() {
  return partnerStores.filter((store) => store.verificationStatus === "pending").length;
}

export function hasPartnerCoordinates(
  store: PartnerStore,
): store is MappablePartnerStore {
  return Number.isFinite(store.latitude) && Number.isFinite(store.longitude);
}

export function normalizePartnerCity(city: string) {
  return city
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("sr-Latn")
    .replaceAll("đ", "dj")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function getPartnerCityLabel(store: PartnerStore) {
  return store.city;
}

export function getPartnerCityKey(store: PartnerStore) {
  return normalizePartnerCity(getPartnerCityLabel(store));
}

export function getLocationTypeLabel(type: PartnerLocationType) {
  const labels: Record<PartnerLocationType, string> = {
    partner: "Poslovni partner",
    service: "Servis i lakirnica",
    store: "Prodavnica",
    store_and_service: "Prodavnica i servis",
    unknown: "Lokacija",
    warehouse: "Magacin",
  };

  return labels[type];
}

export function getPartnerLocationTypes(store: PartnerStore): PartnerLocationType[] {
  return store.type === "store_and_service" ? ["store", "service"] : [store.type];
}

export function hasPartnerLocationType(
  store: PartnerStore,
  type: PartnerLocationType,
) {
  return getPartnerLocationTypes(store).includes(type);
}

export function getPartnerLocationTypeLabel(store: PartnerStore) {
  return getLocationTypeLabel(store.type);
}

export function getLocationTypeOptions(stores: PartnerStore[]) {
  return Array.from(new Set(stores.flatMap((store) => getPartnerLocationTypes(store))))
    .sort((left, right) =>
      getLocationTypeLabel(left).localeCompare(getLocationTypeLabel(right), "sr-Latn"),
    )
    .map((type) => ({
      label: getLocationTypeLabel(type),
      value: type,
    }));
}

export function getPartnerLocationStats(stores: PartnerStore[]) {
  const mappableStores = stores.filter(hasPartnerCoordinates);
  return {
    cityCount: new Set(mappableStores.map((store) => getPartnerCityKey(store))).size,
    listedLocationCount: stores.length,
    locationCount: mappableStores.length,
    prodajnoMestoCount: stores.filter((store) => hasPartnerLocationType(store, "store"))
      .length,
  };
}
