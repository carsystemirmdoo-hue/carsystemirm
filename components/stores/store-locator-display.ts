import {
  getPartnerCityLabel,
  getPartnerCityKey,
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
  void city;
  void stores;
  return undefined;
}

export function getCityBadgeLabel(city: string, enteredCount: number, stores?: PartnerStore[]) {
  return getCityDisplayLabel(city, stores) ?? formatStoreCount(getCityDisplayCount(city, enteredCount));
}

export type CityDisplayEntry = {
  id: string;
  key: string;
  city: string;
  name: string;
  address: string;
  detail: string;
  type: string;
};

/**
 * Per-city display entries derived from the shared partner store data, so
 * surfaces like the home locator card stay consistent with /prodavnice.
 */
export function getCityDisplayEntries(stores: PartnerStore[]): CityDisplayEntry[] {
  const byCity = new Map<
    string,
    {
      labels: Set<string>;
      stores: PartnerStore[];
    }
  >();

  stores.forEach((store) => {
    const key = getPartnerCityKey(store);
    const group = byCity.get(key) ?? { labels: new Set<string>(), stores: [] };
    group.labels.add(getPartnerCityLabel(store).trim().replace(/\s+/g, " "));
    group.stores.push(store);
    byCity.set(key, group);
  });

  return Array.from(byCity.entries())
    .map(([key, group]) => {
      const city = getPreferredCityLabel(group.labels);
      const cityStores = group.stores;
      const representative = cityStores[0];
      const label = getCityDisplayLabel(city, cityStores);

      return {
        id: representative.id,
        key,
        city,
        name: representative.name,
        address: representative.address,
        detail: label
          ? `${label} · ${getPartnerLocationTypeLabel(representative)}`
          : `${getPartnerLocationTypeLabel(representative)} · ${formatStoreCount(cityStores.length)}`,
        type: getPartnerLocationTypeLabel(representative),
      };
    })
    .sort((a, b) => a.city.localeCompare(b.city, "sr-Latn"));
}

function getPreferredCityLabel(labels: Set<string>) {
  const preferred = Array.from(labels).sort((left, right) => {
    const leftDiacritics = left.match(/[čćžšđ]/giu)?.length ?? 0;
    const rightDiacritics = right.match(/[čćžšđ]/giu)?.length ?? 0;
    if (leftDiacritics !== rightDiacritics) return rightDiacritics - leftDiacritics;
    return left.localeCompare(right, "sr-Latn");
  })[0] ?? "";

  return preferred
    .toLocaleLowerCase("sr-Latn")
    .replace(/(^|[\s/-])(\p{L})/gu, (_, separator: string, letter: string) =>
      `${separator}${letter.toLocaleUpperCase("sr-Latn")}`,
    );
}

export function getDisplayNetworkTotal(stores: PartnerStore[]) {
  return stores.length;
}
