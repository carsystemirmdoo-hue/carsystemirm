import { haversineDistanceKm, type GeoPoint } from "@/lib/nearest-store";
import { hasPartnerCoordinates, type PartnerStore } from "@/lib/partner-stores";

/**
 * Udaljenost lokacija od korisnika (2026-10-18).
 *
 * Projekat nema servis za računanje putanja, pa je jedina poštena mera
 * udaljenost VAZDUŠNOM LINIJOM između sačuvanih koordinata. Ona se nikad ne
 * prikazuje kao kilometraža putem: oznaka `kind` putuje uz svaku vrednost.
 * Kilometraža putem traži servis za rutiranje (npr. sopstveni OSRM ili
 * OpenRouteService sa ključem); tada bi `kind` bio "road".
 */
export type DistanceKind = "air";

export type RankedStore = {
  store: PartnerStore;
  /** null kada lokacija nema koordinate — ostaje na kraju liste, bez udaljenosti. */
  distanceKm: number | null;
  kind: DistanceKind;
};

export function rankStoresByDistance(stores: PartnerStore[], origin: GeoPoint): RankedStore[] {
  return stores
    .map((store) => ({
      store,
      distanceKm: hasPartnerCoordinates(store)
        ? haversineDistanceKm(origin, { lat: store.latitude, lng: store.longitude })
        : null,
      kind: "air" as const,
    }))
    .sort((left, right) => {
      if (left.distanceKm === null && right.distanceKm === null) return 0;
      if (left.distanceKm === null) return 1;
      if (right.distanceKm === null) return -1;
      return left.distanceKm - right.distanceKm;
    });
}

export function formatDistanceKm(distanceKm: number) {
  if (distanceKm < 1) return "< 1 km";
  if (distanceKm < 10) return `${distanceKm.toFixed(1).replace(".", ",")} km`;
  return `${Math.round(distanceKm)} km`;
}

/** Oznaka vrste udaljenosti, uvek uz broj. */
export function distanceKindLabel(kind: DistanceKind) {
  return kind === "air" ? "vazdušnom linijom" : "putem";
}
