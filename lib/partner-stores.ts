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
 * Javni lokator prikazuje isključivo proverene lokacije (odluka vlasnika
 * 2026-10-01, docs/CONTENT_GAPS_REQUIRING_OWNER_INPUT.md GAP-003). Zapisi sa
 * statusom `pending` su BEX kontakti za isporuku: ostaju u izvoru radi kasnije
 * provere (docs/locations/UNVERIFIED_LOCATIONS_FOLLOW_UP.md), ali se ne
 * predstavljaju kao prodavnice ni partneri.
 */
export function isPubliclyListedStore(store: PartnerStore) {
  return store.isPublic && store.verificationStatus === "verified";
}

export function getPublicPartnerStores() {
  return partnerStores.filter(isPubliclyListedStore);
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
    partner: "Partnerska lokacija",
    service: "Servis",
    store: "Prodajno mesto",
    store_and_service: "Prodajno mesto i servis",
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
