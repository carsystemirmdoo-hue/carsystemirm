/**
 * Product size / scale — foundation model (Phase 1).
 *
 * `resolveProductVolume` ne izmišlja podatke. Čita isključivo eksplicitna,
 * već postojeća polja (`size`, `catalogMetadata.volume`, `packages[].label`)
 * i prihvata vrednost kao `verified` samo kad tekst strogo odgovara obliku
 * "broj + jedinica" (npr. "1 L", "400 ml"). `catalogMetadata.volume` ume da
 * sadrži opisni tekst koji nije zapremina (npr. "Pakovanja") — takav tekst
 * se odbacuje, ne tretira se kao verified.
 *
 * `inferred` ostaje validan status u modelu za buduću uređivačku kuraciju
 * (npr. „ovo je sprej na osnovu tipa pakovanja"), ali ovaj resolver ga nikad
 * sam ne dodeljuje — to zahteva ljudsku potvrdu, ne heuristiku iz naziva.
 */

export type ProductVolumeUnit = "ml" | "l" | "kg" | "g";
export type ProductVolumeStatus = "verified" | "inferred" | "unknown";
export type ProductSizeClass = "S" | "M" | "L" | "XL";

export type ProductSize = {
  volumeValue?: number | null;
  volumeUnit?: ProductVolumeUnit | null;
  volumeStatus: ProductVolumeStatus;
  /** Uređivački override. Kad nije postavljeno, izvodi se iz volumeValue/Unit. */
  sizeClass?: ProductSizeClass | null;
};

export const UNKNOWN_PRODUCT_SIZE: ProductSize = {
  volumeValue: null,
  volumeUnit: null,
  volumeStatus: "unknown",
};

/** Stabilan default kad klasa ne može da se odredi. Sredina lestvice — ne
 * daje ekstremnu skalu ni u jednom smeru. */
export const DEFAULT_SIZE_CLASS: ProductSizeClass = "M";

type VolumeSource = {
  size?: ProductSize | null;
  catalogMetadata?: { volume?: string | null } | null;
  packages?: { label: string }[] | null;
};

const VOLUME_LABEL_PATTERN = /^(\d+(?:[.,]\d+)?)\s*(ml|l|kg|g)$/i;

function parseVolumeLabel(
  label: string,
): { value: number; unit: ProductVolumeUnit } | null {
  const match = label.trim().match(VOLUME_LABEL_PATTERN);
  if (!match) return null;
  const value = Number.parseFloat(match[1].replace(",", "."));
  if (!Number.isFinite(value) || value <= 0) return null;
  return { value, unit: match[2].toLowerCase() as ProductVolumeUnit };
}

/**
 * Izvodi ProductSize iz postojećih podataka o proizvodu. Redosled prioriteta:
 * 1. Eksplicitno postavljen `size` (uređivački unos) ako nije "unknown".
 * 2. `catalogMetadata.volume`, samo ako je striktan broj+jedinica.
 * 3. Prvi `packages[].label` koji je striktan broj+jedinica.
 * 4. `unknown` — bez pokušaja pogađanja iz naziva ili slike.
 */
export function resolveProductVolume(source: VolumeSource): ProductSize {
  if (source.size && source.size.volumeStatus !== "unknown") {
    return source.size;
  }

  const fromMetadata = source.catalogMetadata?.volume
    ? parseVolumeLabel(source.catalogMetadata.volume)
    : null;
  if (fromMetadata) {
    return {
      volumeValue: fromMetadata.value,
      volumeUnit: fromMetadata.unit,
      volumeStatus: "verified",
    };
  }

  const fromPackage = (source.packages ?? [])
    .map((pack) => parseVolumeLabel(pack.label))
    .find((parsed): parsed is NonNullable<typeof parsed> => parsed !== null);
  if (fromPackage) {
    return {
      volumeValue: fromPackage.value,
      volumeUnit: fromPackage.unit,
      volumeStatus: "verified",
    };
  }

  return UNKNOWN_PRODUCT_SIZE;
}

function toMilliliters(value: number, unit: ProductVolumeUnit): number {
  // "l" i "kg" se tretiraju kao ~1000 baznih jedinica — dokumentovana
  // aproksimacija za klasifikaciju, ne za prikaz (prikaz čuva izvornu jedinicu).
  if (unit === "ml" || unit === "g") return value;
  return value * 1000;
}

/**
 * S ≤500ml · M ≤1200ml (~1L) · L ≤3800ml (~3.5L) · XL >3800ml (~5L).
 * Nepoznata ili nedostajuća zapremina → stabilan default (M), nikad izuzetak
 * u renderu — komponenta ne grana logiku na "unknown" klasu.
 */
export function resolveSizeClass(
  size: ProductSize | null | undefined,
): ProductSizeClass {
  if (size?.sizeClass) return size.sizeClass;
  if (!size || size.volumeValue == null || !size.volumeUnit) {
    return DEFAULT_SIZE_CLASS;
  }
  const ml = toMilliliters(size.volumeValue, size.volumeUnit);
  if (ml <= 500) return "S";
  if (ml <= 1200) return "M";
  if (ml <= 3800) return "L";
  return "XL";
}

const VOLUME_UNIT_LABEL: Record<ProductVolumeUnit, string> = {
  ml: "ml",
  l: "L",
  kg: "kg",
  g: "g",
};

/**
 * Label za quantity badge — SAMO kad je podatak pouzdan (verified/inferred
 * sa vrednošću). Za "unknown" vraća null, i UI mora tada da izostavi badge
 * u potpunosti umesto da prikaže praznu ili izmišljenu vrednost.
 */
export function resolveQuantityLabel(
  size: ProductSize | null | undefined,
): string | null {
  if (!size || size.volumeStatus === "unknown") return null;
  if (size.volumeValue == null || !size.volumeUnit) return null;
  const formattedValue = Number.isInteger(size.volumeValue)
    ? String(size.volumeValue)
    : String(size.volumeValue).replace(".", ",");
  return `${formattedValue} ${VOLUME_UNIT_LABEL[size.volumeUnit]}`;
}
