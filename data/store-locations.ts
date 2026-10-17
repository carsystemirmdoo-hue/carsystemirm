import rawLocations from "./store-locations.json";

export type PublicLocationType =
  | "store"
  | "service"
  | "store_and_service"
  | "partner"
  | "warehouse"
  | "unknown";

export type PublicLocation = {
  id: string;
  name: string;
  address: string;
  city: string;
  latitude?: number;
  longitude?: number;
  type: PublicLocationType;
  /**
   * verified — potvrđeno sa firmom (telefon, radno vreme); reviewed — poslovna
   * lokacija potvrđena javnim izvorima u reviziji i odobrena za prikaz;
   * pending — nije javno.
   */
  verificationStatus: "verified" | "reviewed" | "pending";
  coordinateStatus: "verified" | "geocoded_preview" | "approximate" | "unavailable";
  isPublic: boolean;
  alternativeNames?: string[];
  phone?: string;
  workingHours?: string;
  availableBrands?: string[];
  notes?: string;
};

export const storeLocations = rawLocations as PublicLocation[];
