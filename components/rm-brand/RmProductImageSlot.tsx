import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import type { CarsystemProduct, ProductImageAsset } from "@/lib/carsystem-data";
import {
  resolveProductVolume,
  resolveQuantityLabel,
  resolveSizeClass,
} from "@/lib/product-scale";
import styles from "./RmBrandPage.module.css";

const PLACEHOLDER_ASSET = "/images/products/placeholder-product.svg";

export function RmProductImageSlot({
  altText,
  aspectRatio = "4 / 5",
  asset,
  group,
  href,
  feature,
  priority = false,
  product,
  productName,
  role,
  sizes = "(min-width: 70rem) 26vw, (min-width: 48rem) 42vw, 82vw",
  system,
}: {
  altText?: string;
  aspectRatio?: string;
  asset?: ProductImageAsset | null;
  feature?: string;
  group: string;
  href?: string;
  priority?: boolean;
  product?: CarsystemProduct;
  productName: string;
  role?: string;
  sizes?: string;
  system: string;
}) {
  const hasApprovedAsset = Boolean(
    asset?.src && asset.src !== PLACEHOLDER_ASSET,
  );
  const productSize = product ? resolveProductVolume(product) : undefined;
  const sizeClass = resolveSizeClass(productSize);
  const quantityLabel = hasApprovedAsset
    ? resolveQuantityLabel(productSize)
    : null;

  return (
    <figure
      className={styles.productImageSlot}
      data-has-asset={hasApprovedAsset || undefined}
      style={{ "--rm-slot-ratio": aspectRatio } as CSSProperties}
    >
      <div
        className={styles.productImageSlotMedia}
        data-product-size-class={hasApprovedAsset ? sizeClass : undefined}
        data-has-quantity-badge={quantityLabel ? "true" : undefined}
      >
        {hasApprovedAsset && asset ? (
          <Image
            src={asset.src}
            alt={altText || asset.alt}
            fill
            priority={priority}
            sizes={sizes}
          />
        ) : (
          <div
            className={styles.productImagePlaceholder}
            role="img"
            aria-label={`Fotografija proizvoda za ${productName} još nije dostupna`}
          >
            <span className={styles.productSlotGrid} aria-hidden="true" />
            <span className={styles.productSlotMark} aria-hidden="true">
              R-M
            </span>
            <div>
              <small>Fotografija proizvoda</small>
              <strong>{productName}</strong>
            </div>
          </div>
        )}

        {quantityLabel ? (
          <span
            className={styles.productSlotQuantityBadge}
            data-status={productSize?.volumeStatus}
          >
            <span
              className={styles.productSlotQuantityBadgeRule}
              aria-hidden="true"
            />
            {quantityLabel}
          </span>
        ) : null}
      </div>
      <figcaption>
        <span>{system}</span>
        <strong>{productName}</strong>
        <small>{group}</small>
        {(role || feature) && (
          <div className={styles.productSlotDetails}>
            {role && <span>Uloga: {role}</span>}
            {feature && <span>Osobina: {feature}</span>}
          </div>
        )}
        {href && (
          <Link className={styles.productSlotLink} href={href}>
            Otvorite proizvod ili grupu
            <span aria-hidden="true">↗</span>
          </Link>
        )}
      </figcaption>
    </figure>
  );
}
