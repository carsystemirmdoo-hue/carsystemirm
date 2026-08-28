import "server-only";

import type { CSSProperties } from "react";
import { canonicalVariantKey } from "@/lib/catalog/variant-key";
import {
  getProductStageImages,
  type ProductStageImage,
} from "@/components/product/productStageImages";
import {
  getProductVisualPreset,
  getProductVisualStyle,
  shouldRenderProductHeroSpray,
} from "@/components/product/productMotion";
import {
  getProductPublicStatus,
  type CarsystemProduct,
} from "@/lib/carsystem-data";
import {
  resolveProductVolume,
  resolveQuantityLabel,
  resolveSizeClass,
  type ProductSizeClass,
  type ProductVolumeStatus,
} from "@/lib/product-scale";
import {
  getPuttyMaterialTrace,
  type PuttyMaterialTraceConfig,
} from "@/lib/putty-material-trace";

/**
 * Sve što potrošači PDP-a prikazuju za JEDNU varijantu, razrešeno na serveru.
 *
 * Isti razlog zbog kog postoji `ProductVisualPresentation`: identitet, scena i
 * grafit su klijentske komponente, a podaci koji ih opisuju sede iza
 * `server-only` modula — manifest metrika slika je ~300 KB i ne sme u klijentski
 * bundle. Zato se ovde, na serveru, svaka varijanta spljošti u nekoliko
 * stringova koje markup zaista koristi.
 *
 * Ovo je i jedini razlog zašto izbor varijante može biti trenutan: sve slike,
 * boje i mere su već u klijentu kada korisnik klikne, pa promena ne traži ni
 * mrežni zahtev ni RSC navigaciju.
 */
export type ProductVariantView = {
  /** Ključ iz `?varijanta=` — poslovna šifra kad postoji. */
  key: string;
  /** Identitet varijante u selektoru (`ProductCommercialVariant.id`). */
  id: string;
  slug: string;
  name: string;
  sku: string | null;
  /** Oznaka nijanse: naziv boje, RAL ili šifra — već formatirana za prikaz. */
  shadeLabel: string | null;
  ralLabel: string | null;
  shortDescription: string;
  status: string;
  /** Pakovanje kako ga izvor navodi. */
  volume: string | null;
  brandSlug: string;
  familySlug: string | null;
  inventoryKey: string | null;

  /** Slike scene, sa izmerenim kontrastom. Prva je glavna. */
  images: ProductStageImage[];
  /** Boja pozadine/grafita i akcenti — kao CSS custom properties. */
  style: CSSProperties;
  treatment: string;
  productType: string;
  hasSprayBackdrop: boolean;
  sizeClass: ProductSizeClass;
  quantityLabel: string | null;
  volumeStatus: ProductVolumeStatus;
  puttyTrace: PuttyMaterialTraceConfig | null;
};

/**
 * Stabilan ključ varijante.
 *
 * Sama formula živi u `lib/catalog/variant-key.ts` i deli je sa
 * `variantRedirectTarget`. Ovde je samo prosleđivanje, da PDP potrošači imaju
 * jedan uvoz — kopija formule bi se pre ili kasnije razišla, što se već
 * jednom dogodilo.
 */
export function productVariantKey(product: CarsystemProduct): string {
  return canonicalVariantKey(product);
}

/**
 * Oznaka nijanse za prikaz, bez pogađanja.
 *
 * Redosled je od najkonkretnijeg ka najopštijem. Kada izvor nema nijednu od
 * ovih vrednosti vraća se `null` i interfejs jednostavno ne prikazuje red —
 * umesto da izmisli oznaku koje u katalogu nema.
 */
function resolveShadeLabel(product: CarsystemProduct): string | null {
  const metadata = product.catalogMetadata;
  if (!metadata) return null;
  if (metadata.colorName) return metadata.colorName;
  if (metadata.ralCode) return `RAL ${metadata.ralCode}`;
  if (metadata.finish) return metadata.finish;
  return null;
}

function resolveRalLabel(product: CarsystemProduct): string | null {
  const ral = product.catalogMetadata?.ralCode;
  return ral ? `RAL ${ral}` : null;
}

/**
 * Jedna varijanta, spremna za klijent.
 *
 * @param product varijanta iz kataloga
 * @param familySlug canonical porodica, radi cart payload-a
 */
export function toProductVariantView(
  product: CarsystemProduct,
  familySlug: string | null = null,
): ProductVariantView {
  const preset = getProductVisualPreset(product);
  const size = resolveProductVolume(product);

  return {
    key: productVariantKey(product),
    id: product.variantId ?? product.slug,
    slug: product.slug,
    name: product.name,
    sku: product.catalogMetadata?.cosmosCode ?? product.sku ?? null,
    shadeLabel: resolveShadeLabel(product),
    ralLabel: resolveRalLabel(product),
    shortDescription: product.shortDescription,
    status: getProductPublicStatus(product),
    volume: product.catalogMetadata?.volume ?? product.packages[0]?.label ?? null,
    brandSlug: product.brandSlug,
    familySlug,
    // Dostupnost ne postoji u katalogu; `inventoryKey` je mesto na koje se
    // kasnije kači poslovni izvor. Do tada je `null`, ne izmišljena vrednost.
    inventoryKey: null,

    images: getProductStageImages(product),
    style: getProductVisualStyle(product),
    treatment: preset.treatment,
    productType: preset.productType,
    hasSprayBackdrop: shouldRenderProductHeroSpray(product),
    sizeClass: resolveSizeClass(size),
    quantityLabel: resolveQuantityLabel(size),
    volumeStatus: size.volumeStatus,
    puttyTrace: getPuttyMaterialTrace(product.slug) ?? null,
  };
}

/**
 * View model za ceo skup varijanti jedne porodice.
 *
 * Redosled se čuva iz kataloga — selektor i kontekst moraju videti isti niz u
 * istom redosledu, inače „prva varijanta" kao rezerva ne bi značila isto na dva
 * mesta.
 */
export function toProductVariantViews(
  products: readonly CarsystemProduct[],
  familySlug: string | null = null,
): ProductVariantView[] {
  return products.map((product) => toProductVariantView(product, familySlug));
}
