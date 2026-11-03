"use client";

import { useCallback, useState } from "react";
import {
  createSettlementIndex,
  resolvePlaceName,
  searchSettlements,
  settlementLabel,
  type GeoPoint,
  type Settlement,
  type SettlementDataset,
  type SettlementIndex,
} from "@/lib/places/serbian-places";

/** Spisak naselja (≈ 90 KB gzip) se učitava tek kada korisnik krene da bira mesto. */
const DATASET_URL = "/podaci/naselja-srbije.json";
export const PLACE_VALUE_PREFIX = "mesto:";

let pending: Promise<SettlementIndex> | null = null;

export function loadSettlementIndex() {
  pending ??= fetch(DATASET_URL)
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json() as Promise<SettlementDataset>;
    })
    .then(createSettlementIndex)
    .catch((error: unknown) => {
      pending = null;
      throw error;
    });
  return pending;
}

/** Izabrano polazno mesto: tačka i oznaka za poruke i mapu. */
export type ChosenPlace = {
  /** Vrednost birača: `mesto:<RZS broj>` ili ključ grada iz liste partnera. */
  value: string;
  /** RZS matični broj naselja (za vezu `/prodavnice?mesto=`). */
  ref: string;
  label: string;
  point: GeoPoint;
};

export function placeFromSettlement(settlement: Settlement): ChosenPlace {
  return {
    value: `${PLACE_VALUE_PREFIX}${settlement.ref}`,
    ref: settlement.ref,
    label: settlementLabel(settlement),
    point: { lat: settlement.lat, lng: settlement.lng },
  };
}

export function useSettlementIndex() {
  const [index, setIndex] = useState<SettlementIndex | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    return loadSettlementIndex().then(
      (loaded) => {
        setIndex(loaded);
        return loaded;
      },
      () => {
        setFailed(true);
        return null;
      },
    );
  }, []);

  /** Opcije za birač: null dok se spisak učitava (birač tada kaže da učitava). */
  const searchOptions = useCallback(
    (query: string) =>
      index
        ? searchSettlements(index, query).map((settlement) => ({
            label: settlementLabel(settlement),
            value: `${PLACE_VALUE_PREFIX}${settlement.ref}`,
          }))
        : null,
    [index],
  );

  /** Mesto iz vrednosti birača: `mesto:<RZS broj>` ili naziv grada iz liste partnera. */
  const resolve = useCallback(
    async (value: string, fallbackName?: string, near?: GeoPoint | null): Promise<ChosenPlace | null> => {
      const loaded = index ?? (await load());
      if (!loaded) return null;
      if (value.startsWith(PLACE_VALUE_PREFIX)) {
        const settlement = loaded.byRef.get(value.slice(PLACE_VALUE_PREFIX.length));
        return settlement ? placeFromSettlement(settlement) : null;
      }
      const settlement = fallbackName ? resolvePlaceName(loaded, fallbackName, near) : null;
      return settlement ? { ...placeFromSettlement(settlement), value } : null;
    },
    [index, load],
  );

  return { failed, index, load, resolve, searchOptions };
}

