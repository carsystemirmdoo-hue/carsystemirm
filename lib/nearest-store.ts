import type { PartnerStore } from "@/lib/partner-stores";

export type GeoPoint = {
  lat: number;
  lng: number;
};

export type NearestStoreResult = {
  store: PartnerStore;
  distanceKm: number;
};

const EARTH_RADIUS_KM = 6371;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function haversineDistanceKm(a: GeoPoint, b: GeoPoint) {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * sinLng * sinLng;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(Math.sqrt(h), 1));
}

/**
 * Nearest partner store by real coordinates. Stores without lat/lng are
 * skipped — coordinates are never guessed.
 */
export function findNearestPartnerStore(
  stores: PartnerStore[],
  point: GeoPoint,
): NearestStoreResult | null {
  let nearest: NearestStoreResult | null = null;

  for (const store of stores) {
    if (!store.coordinates) continue;

    const distanceKm = haversineDistanceKm(point, store.coordinates);
    if (!nearest || distanceKm < nearest.distanceKm) {
      nearest = { store, distanceKm };
    }
  }

  return nearest;
}
