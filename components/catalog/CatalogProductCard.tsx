import Link from "next/link";
import {
  type CarsystemBrand,
  type CarsystemProduct,
  type ProgramGroup,
  type RefinishPhase,
} from "@/lib/carsystem-data";
import {
  toCatalogListingEntity,
  type CatalogListingEntity,
} from "@/lib/catalog-listing";
import { ProductVisualSurface } from "@/components/product/ProductVisualSurface";
import type { Ref } from "react";
import styles from "./CatalogPage.module.css";

export function CatalogProductCard({
  brand,
  className,
  contextLabel,
  entity,
  phase,
  preloadRef,
  product,
  program,
  variant = "catalog",
  catalogSystem = false,
}: {
  brand: CarsystemBrand;
  className?: string;
  contextLabel?: string;
  /**
   * Canonical listing entity (catalog browse). When absent the card falls back
   * to deriving one from `product`, which is how the locked surfaces — PDP
   * related row, Cosmos brand page — keep calling it unchanged.
   */
  entity?: CatalogListingEntity;
  phase: RefinishPhase;
  preloadRef?: Ref<HTMLAnchorElement>;
  product?: CarsystemProduct;
  program: ProgramGroup;
  variant?: "catalog" | "joined-row";
  /**
   * Uključuje finalni B-system hijerarhijski jezik kartice (SKU/kod →
   * naziv → sekundarni metapodaci, radius 2). Namerno OPT-IN i odvojen od
   * `variant`: ista kartica se deli sa PDP related-products redom
   * (`variant="joined-row"`) i partnerskim brand stranicama (npr. Cosmos),
   * koje moraju zadržati postojeći izgled. Samo stvarni /katalog pozivaoci
   * (CatalogProductGrid, CatalogSeoContent) prosleđuju `catalogSystem`.
   */
  catalogSystem?: boolean;
}) {
  const listing = entity ?? toCatalogListingEntity(product as CarsystemProduct);
  const isFamily = listing.kind === "family";

  /*
   * Bez B-system rasporeda kartica nema zaseban red za šifru, pa se ona (kad je
   * kratka) uklapa u tehničku liniju — tačno kako je bilo pre uvođenja listing
   * entiteta. Cosmos i PDP related red zavise od tog rasporeda.
   */
  const technicalLine = catalogSystem
    ? listing.technicalLine
    : [listing.shortCode, listing.technicalLine].filter(Boolean).join(" · ");

  const metaItems = listing.line
    ? [brand.name, listing.line]
    : [brand.name, program.shortName, phase.name];

  return (
    <Link
      ref={preloadRef}
      className={`${styles.productCard} cs-product-motion-card ${className ?? ""}`}
      href={listing.href}
      prefetch={false}
      aria-label={
        isFamily
          ? `Pogledaj grupu proizvoda ${listing.name}, ${listing.variantCount} varijanti`
          : `Pogledaj proizvod ${listing.name}`
      }
      data-cursor="card"
      data-infinite-scroll-trigger={preloadRef ? "true" : undefined}
      data-motion-surface
      data-product-card-motion
      data-card-variant={variant}
      data-card-kind={listing.kind}
      data-card-system={catalogSystem ? "b" : undefined}
    >
      <ProductVisualSurface
        brandName={brand.name}
        className={styles.catalogProductVisual}
        presentation={listing.presentation}
        product={product}
        sizes="(min-width: 1180px) 27vw, (min-width: 768px) 42vw, 92vw"
      />

      <span className={styles.productBody}>
        {catalogSystem && <p className={styles.productCode}>{listing.productCode}</p>}

        {!catalogSystem && (
          <p className={styles.productMetaLine}>{metaItems.join(" · ")}</p>
        )}

        <span className={styles.productTitleRow}>
          <h3>{listing.name}</h3>
          <span className={styles.productTitleArrow} aria-hidden="true">
            ↗
          </span>
        </span>

        {/* B-system hijerarhija: SKU/kod → naziv → sekundarni metapodaci. */}
        {catalogSystem && (
          <p className={styles.productMetaLine}>{metaItems.join(" · ")}</p>
        )}

        {(contextLabel || technicalLine) && (
          <p className={styles.productTechnicalLine}>{contextLabel ?? technicalLine}</p>
        )}
      </span>
    </Link>
  );
}
