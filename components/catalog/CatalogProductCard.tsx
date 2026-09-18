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
import { getBrandCardColor } from "@/lib/brand-card-colors";
import type { CSSProperties, Ref } from "react";
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

  /*
   * Roletna kartice na /katalog (`catalogSystem`) — dva pravila, jedno mesto:
   *
   *   1. Roletna POSTOJI na svakoj kartici, i za proizvode koji nisu boje.
   *      Obojeni sloj (`colorReveal`) se u `ProductVisualSurface` crta samo u
   *      `visualMode: "color-on-hover"`; za `neutral` je `display: none`, pa je
   *      klarlak, abraziv ili kit dobijao samo bledi wash i tanku ivicu, dok je
   *      susedna farba dobijala punu roletnu. Katalog zato uvek traži reveal.
   *   2. Boja roletne: nijansa proizvoda/varijante (`presentation.shade`:
   *      merena, izvedena ili orijentacioni prikaz potvrđene imenovane boje —
   *      vidi `getProductShadeSource`), inače boja brenda
   *      (`lib/brand-card-colors.ts`), inače postojeći akcenat preseta.
   *
   * Nijansa se ovde upisuje u CSS promenljive kartice zato što `style` iz
   * prezentacije nosi PDP akcente (brend/faza), a PDP je zaključan — kartica
   * je jedino mesto koje sme da primeni orijentacionu nijansu.
   * PDP grafit je drugo pravilo (`lib/productPaintRule.mjs`) i ne zavisi od ovoga.
   * Ostali potrošači kartice (PDP related red, Cosmos/SATA brend stranice)
   * zadržavaju netaknutu prezentaciju.
   */
  const cardColor = catalogSystem
    ? (listing.presentation.shade ?? getBrandCardColor(brand))
    : null;
  const presentation = catalogSystem
    ? {
        ...listing.presentation,
        visualMode: "color-on-hover",
        style: cardColor
          ? ({
              ...listing.presentation.style,
              "--product-visual-accent": cardColor,
              "--product-visual-background-color": cardColor,
              "--product-active-color": cardColor,
            } as CSSProperties)
          : listing.presentation.style,
      }
    : listing.presentation;

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
        presentation={presentation}
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
