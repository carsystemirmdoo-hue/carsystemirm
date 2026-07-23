import Link from "next/link";
import {
  type CarsystemBrand,
  type CarsystemProduct,
  type ProgramGroup,
  type RefinishPhase,
} from "@/lib/carsystem-data";
import { ProductVisualSurface } from "@/components/product/ProductVisualSurface";
import type { Ref } from "react";
import styles from "./CatalogPage.module.css";

function getProductTechnicalLine(product: CarsystemProduct) {
  const metadata = product.catalogMetadata;
  const code =
    metadata?.cosmosCode ??
    (metadata?.ralCode ? `RAL ${metadata.ralCode}` : null) ??
    (product.sku.length <= 24 ? product.sku : null);
  const packageSummary =
    metadata?.volume ??
    product.packages
      .map((item) => item.label)
      .filter((label) => !label.toLocaleLowerCase("sr-Latn").includes("upit"))
      .slice(0, 2)
      .join(" / ");
  const parts = [code, packageSummary, metadata?.finish]
    .filter((value): value is string => Boolean(value))
    .filter((value, index, values) => values.indexOf(value) === index);

  return parts.slice(0, 3).join(" · ");
}

export function CatalogProductCard({
  brand,
  className,
  contextLabel,
  phase,
  preloadRef,
  product,
  program,
  variant = "catalog",
}: {
  brand: CarsystemBrand;
  className?: string;
  contextLabel?: string;
  phase: RefinishPhase;
  preloadRef?: Ref<HTMLAnchorElement>;
  product: CarsystemProduct;
  program: ProgramGroup;
  variant?: "catalog" | "joined-row";
}) {
  const image = product.productImage ?? product.galleryImages[0] ?? null;
  const productHref = `/proizvodi/${product.slug}`;
  const metaItems = product.catalogMetadata?.line
    ? [brand.name, product.catalogMetadata.line]
    : [brand.name, program.shortName, phase.name];
  const technicalLine = getProductTechnicalLine(product);

  return (
    <Link
      ref={preloadRef}
      className={`${styles.productCard} cs-product-motion-card ${className ?? ""}`}
      href={productHref}
      aria-label={`Pogledaj proizvod ${product.name}`}
      data-cursor="card"
      data-infinite-scroll-trigger={preloadRef ? "true" : undefined}
      data-motion-surface
      data-product-card-motion
      data-card-variant={variant}
    >
      <ProductVisualSurface
        brandName={brand.name}
        className={styles.catalogProductVisual}
        image={image}
        product={product}
        sizes="(min-width: 1180px) 27vw, (min-width: 768px) 42vw, 92vw"
      />

      <span className={styles.productBody}>
        <p className={styles.productMetaLine}>
          {metaItems.join(" · ")}
        </p>

        <span className={styles.productTitleRow}>
          <h3>{product.name}</h3>
          <span className={styles.productTitleArrow} aria-hidden="true">
            ↗
          </span>
        </span>

        {(contextLabel || technicalLine) && (
          <p className={styles.productTechnicalLine}>{contextLabel ?? technicalLine}</p>
        )}
      </span>
    </Link>
  );
}
