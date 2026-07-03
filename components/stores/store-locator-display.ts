import type { PartnerStore } from "@/lib/partner-stores";

type CityNetworkMeta = {
  displayCount: number;
  label?: "Centrala" | "Preporučena";
};

// TODO: Replace these UI display totals with real partner store rows once
// addresses, phones, working hours and coordinates are ready for import.
const cityNetworkMeta: Record<string, CityNetworkMeta> = {
  Beograd: { displayCount: 15 },
  "Čačak": { displayCount: 3 },
  "Inđija": { displayCount: 1, label: "Centrala" },
  Kragujevac: { displayCount: 3 },
  Leskovac: { displayCount: 3 },
  "Niš": { displayCount: 5 },
  "Novi Sad": { displayCount: 5 },
  "Pančevo": { displayCount: 3 },
  "Sremska Mitrovica": { displayCount: 2 },
  Subotica: { displayCount: 4 },
  "Užice": { displayCount: 3 },
  Zrenjanin: { displayCount: 4 },
};

export function formatStoreCount(count: number) {
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;
  const noun =
    count === 1
      ? "prodavnica"
      : lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14)
        ? "prodavnice"
        : "prodavnica";

  return `${count} ${noun}`;
}

export function getCityDisplayCount(city: string, enteredCount: number) {
  return Math.max(enteredCount, cityNetworkMeta[city]?.displayCount ?? enteredCount);
}

export function getCityDisplayLabel(city: string) {
  return cityNetworkMeta[city]?.label;
}

export function getCityBadgeLabel(city: string, enteredCount: number) {
  return getCityDisplayLabel(city) ?? formatStoreCount(getCityDisplayCount(city, enteredCount));
}

export function getCityPendingCount(city: string, enteredCount: number) {
  return Math.max(getCityDisplayCount(city, enteredCount) - enteredCount, 0);
}

export type CityDisplayEntry = {
  city: string;
  name: string;
  address: string;
  detail: string;
  region: string;
  featured: boolean;
};

/**
 * Per-city display entries derived from the shared partner store data, so
 * surfaces like the home locator card stay consistent with /prodavnice.
 */
export function getCityDisplayEntries(stores: PartnerStore[]): CityDisplayEntry[] {
  const byCity = new Map<string, PartnerStore[]>();

  stores.forEach((store) => {
    const cityStores = byCity.get(store.city) ?? [];
    cityStores.push(store);
    byCity.set(store.city, cityStores);
  });

  return Array.from(byCity.entries())
    .map(([city, cityStores]) => {
      const representative =
        cityStores.find((store) => store.featured) ?? cityStores[0];
      const isCentral = getCityDisplayLabel(city) === "Centrala";

      return {
        city,
        name: representative.name,
        address: representative.address,
        detail: isCentral
          ? "Centrala · Veleprodaja i tehnička podrška"
          : `Partnerska mreža · ${getCityBadgeLabel(city, cityStores.length)}`,
        region: representative.region,
        featured: Boolean(representative.featured),
      };
    })
    .sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      return a.city.localeCompare(b.city, "sr-Latn");
    });
}

export function getDisplayNetworkTotal(stores: PartnerStore[]) {
  const actualByCity = new Map<string, number>();

  stores.forEach((store) => {
    actualByCity.set(store.city, (actualByCity.get(store.city) ?? 0) + 1);
  });

  return Array.from(actualByCity.entries()).reduce(
    (total, [city, count]) => total + getCityDisplayCount(city, count),
    0,
  );
}
