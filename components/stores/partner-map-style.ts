import {
  hasPartnerCoordinates,
  type PartnerStore,
} from "@/lib/partner-stores";

/**
 * Locator-only map data helpers. The shared Carsystem MapLibre style/theme
 * foundation lives in components/map/carsystem-map-style.ts.
 */

type PartnerFeature = {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: {
    city: string;
    id: string;
    name: string;
  };
};

export function getPartnerMarkerCoordinateMap(stores: PartnerStore[]) {
  const groups = new Map<string, PartnerStore[]>();
  stores.filter(hasPartnerCoordinates).forEach((store) => {
    const key = `${store.latitude.toFixed(6)},${store.longitude.toFixed(6)}`;
    const group = groups.get(key) ?? [];
    group.push(store);
    groups.set(key, group);
  });

  const coordinates = new Map<string, [number, number]>();
  for (const group of groups.values()) {
    const sorted = [...group].sort((left, right) => left.id.localeCompare(right.id));
    if (sorted.length === 1) {
      const store = sorted[0];
      if (hasPartnerCoordinates(store)) {
        coordinates.set(store.id, [store.longitude, store.latitude]);
      }
      continue;
    }

    sorted.forEach((store, index) => {
      if (!hasPartnerCoordinates(store)) return;
      const ring = Math.floor(index / 10) + 1;
      const angle = (index / Math.min(sorted.length, 10)) * Math.PI * 2;
      const latitudeOffset = Math.sin(angle) * 0.00014 * ring;
      const longitudeScale = Math.max(Math.cos((store.latitude * Math.PI) / 180), 0.35);
      const longitudeOffset = (Math.cos(angle) * 0.00014 * ring) / longitudeScale;
      coordinates.set(store.id, [
        store.longitude + longitudeOffset,
        store.latitude + latitudeOffset,
      ]);
    });
  }

  return coordinates;
}

export function toPartnerFeatureCollection(
  stores: PartnerStore[],
  referenceStores: PartnerStore[] = stores,
) {
  const markerCoordinates = getPartnerMarkerCoordinateMap(referenceStores);
  const features: PartnerFeature[] = stores
    .filter(hasPartnerCoordinates)
    .map((store) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: markerCoordinates.get(store.id) ?? [store.longitude, store.latitude],
      },
      properties: {
        city: store.city,
        id: store.id,
        name: store.name,
      },
    }));

  return { type: "FeatureCollection", features } as const;
}

export function getPartnerBounds(stores: PartnerStore[]) {
  const coords = stores
    .filter(hasPartnerCoordinates)
    .map((store) => ({ lat: store.latitude, lng: store.longitude }));

  if (coords.length === 0) return null;

  let minLat = coords[0].lat;
  let maxLat = coords[0].lat;
  let minLng = coords[0].lng;
  let maxLng = coords[0].lng;

  coords.forEach(({ lat, lng }) => {
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
  });

  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ] as [[number, number], [number, number]];
}
