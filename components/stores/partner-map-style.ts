import type { PartnerStore } from "@/lib/partner-stores";

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

export function toPartnerFeatureCollection(stores: PartnerStore[]) {
  const features: PartnerFeature[] = stores
    .filter((store) => Boolean(store.coordinates))
    .map((store) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [store.coordinates!.lng, store.coordinates!.lat],
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
    .map((store) => store.coordinates)
    .filter((value): value is NonNullable<PartnerStore["coordinates"]> => Boolean(value));

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
