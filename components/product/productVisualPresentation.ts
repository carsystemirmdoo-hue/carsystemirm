import type { CSSProperties } from "react";
import {
  getProductShade,
  getProductVisualPreset,
  getProductVisualStyle,
} from "@/components/product/productMotion";
import type { CarsystemProduct, ProductImageAsset } from "@/lib/carsystem-data";
import {
  resolveProductVolume,
  resolveQuantityLabel,
  resolveSizeClass,
  type ProductSizeClass,
  type ProductVolumeStatus,
} from "@/lib/product-scale";

/**
 * Everything `ProductVisualSurface` renders, resolved on the server.
 *
 * The surface used to take the whole `CarsystemProduct` and derive its preset,
 * volume and style at render time. Because the surface is a client component,
 * that meant the entire rich product object was serialised into the RSC payload
 * a second time for every card on screen — 48 extra copies on the first catalog
 * page alone, on top of the 832 already in the explorer's `products` prop.
 *
 * Resolving to this flat shape keeps the visual output byte-identical (the same
 * two helpers produce it) while cutting the per-card payload to the handful of
 * strings the markup actually uses.
 */
export type ProductVisualPresentation = {
  slug: string;
  name: string;
  treatment: string;
  productType: string;
  visualMode: string;
  sizeClass: ProductSizeClass;
  quantityLabel: string | null;
  volumeStatus: ProductVolumeStatus;
  style: CSSProperties;
  image: ProductImageAsset | null;
  /**
   * Stvarna nijansa proizvoda (`getProductShade`) ili `null`. Katalog po njoj
   * odlučuje da li kartica nosi nijansu ili boju brenda; `style` je i dalje
   * ono što površina crta.
   */
  shade: string | null;
  /**
   * V6 fit + shadow model. Postavlja ga ISKLJUČIVO server
   * (`withProductFitModel` u `lib/product-fit-model.ts`), jer odluka traži
   * izmereni manifest koji ne sme u klijentski bundle. Kada polja nema, površina
   * radi po zatečenom (legacy) fitu i zatečenom modelu senki.
   */
  officialShadow?: "strong" | "thin" | "none" | "unknown";
};

export function toProductVisualPresentation(
  product: CarsystemProduct,
  image?: ProductImageAsset | null,
): ProductVisualPresentation {
  const preset = getProductVisualPreset(product);
  const size = resolveProductVolume(product);
  const selectedImage =
    image ?? product.productImage ?? product.galleryImages[0] ?? null;

  return {
    slug: product.slug,
    name: product.name,
    treatment: preset.treatment,
    productType: preset.productType,
    visualMode: preset.visualMode,
    sizeClass: resolveSizeClass(size),
    quantityLabel: resolveQuantityLabel(size),
    volumeStatus: size.volumeStatus,
    style: getProductVisualStyle(product),
    image: selectedImage,
    shade: getProductShade(product),
  };
}
