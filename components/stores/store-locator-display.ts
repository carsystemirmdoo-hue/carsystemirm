import {
  getPartnerCityLabel,
  getPartnerLocationTypeLabel,
  type PartnerStore,
} from "@/lib/partner-stores";

export function formatStoreCount(count: number) {
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;
  const noun =
    count === 1
      ? "lokacija"
      : lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14)
        ? "lokacije"
        : "lokacija";

  return `${count} ${noun}`;
}

export function getCityDisplayCount(city: string, enteredCount: number) {
  void city;
  return enteredCount;
}

export function getCityDisplayLabel(city: string, stores?: PartnerStore[]) {
  return stores?.some((store) => getPartnerCityLabel(store) === city && store.featured)
    ? "Centrala"
    : undefined;
}

export function getCityBadgeLabel(city: string, enteredCount: number, stores?: PartnerStore[]) {
  return getCityDisplayLabel(city, stores) ?? formatStoreCount(getCityDisplayCount(city, enteredCount));
}

export type CityDisplayEntry = {
  id: string;
  city: string;
  name: string;
  address: string;
  detail: string;
  region: string;
  type: string;
  featured: boolean;
};

/**
 * Per-city display entries derived from the shared partner store data, so
 * surfaces like the home locator card stay consistent with /prodavnice.
 */
export function getCityDisplayEntries(stores: PartnerStore[]): CityDisplayEntry[] {
  const byCity = new Map<string, PartnerStore[]>();

  stores.forEach((store) => {
    const city = getPartnerCityLabel(store);
    const cityStores = byCity.get(city) ?? [];
    cityStores.push(store);
    byCity.set(city, cityStores);
  });

  return Array.from(byCity.entries())
    .map(([city, cityStores]) => {
      const representative =
        cityStores.find((store) => store.featured) ?? cityStores[0];
      const label = getCityDisplayLabel(city, cityStores);

      return {
        id: representative.id,
        city,
        name: representative.name,
        address: representative.address,
        detail: label
          ? `${label} · ${getPartnerLocationTypeLabel(representative)}`
          : `${getPartnerLocationTypeLabel(representative)} · ${formatStoreCount(cityStores.length)}`,
        region: representative.region,
        type: getPartnerLocationTypeLabel(representative),
        featured: Boolean(representative.featured),
      };
    })
    .sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      return a.city.localeCompare(b.city, "sr-Latn");
    });
}

export function getDisplayNetworkTotal(stores: PartnerStore[]) {
  return stores.length;
}
