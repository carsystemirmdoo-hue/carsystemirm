"use client";

import Image from "next/image";
import { useMemo, useState, type CSSProperties } from "react";
import { ProductHeroSprayBackdrop } from "@/components/product/ProductHeroSprayBackdrop";
import { PuttyMaterialTrace } from "@/components/product/PuttyMaterialTrace";
import {
  getProductVisualPreset,
  getProductVisualStyle,
  shouldRenderProductHeroSpray,
} from "@/components/product/productMotion";
import type {
  ProductStageFormat,
  ProductStageImage,
} from "@/components/product/productStageImages";
import type { CarsystemProduct } from "@/lib/carsystem-data";
import {
  resolveProductVolume,
  resolveQuantityLabel,
  resolveSizeClass,
} from "@/lib/product-scale";
import {
  hasPuttyMaterialTrace,
  PUTTY_MATERIAL_TRACE_OPTICAL_Y,
  PUTTY_MATERIAL_TRACE_PRODUCT_ENVELOPE,
  PUTTY_MATERIAL_TRACE_STAGE_ASPECT,
} from "@/lib/putty-material-trace";
import fit from "./ProductImageFit.generated.module.css";
import styles from "./ProductDetailExperience.module.css";

/**
 * The PDP product stage.
 *
 * Five layers, in a fixed order, each owning exactly one job:
 *
 *   0 surface — a neutral stage plate, so the panel is an object rather than a
 *               hole in the page;
 *   1 art     — decoration, drawn in a tone chosen against the product's
 *               measured lightness (see `contrastMode`);
 *   2 halo    — a soft separation pass, only where the product would otherwise
 *               merge into the art;
 *   3 product — the render itself, fitted by its own content box;
 *   4 ui      — brand mark, quantity, gallery index, zoom.
 *
 * The product layer never depends on the height of the page's right column and
 * never moves when a UI control appears: the stage owns a fixed aspect ratio,
 * and the product is centred inside it by its own silhouette.
 */
export function ProductStickyStage({
  brandName,
  images,
  product,
  stageFormat,
}: {
  brandName: string;
  images: ProductStageImage[];
  product: CarsystemProduct;
  stageFormat: ProductStageFormat;
}) {
  const visualPreset = useMemo(() => getProductVisualPreset(product), [product]);
  const hasSprayBackdrop = useMemo(
    () => shouldRenderProductHeroSpray(product),
    [product],
  );
  const productSize = useMemo(() => resolveProductVolume(product), [product]);
  const sizeClass = useMemo(() => resolveSizeClass(productSize), [productSize]);
  const quantityLabel = useMemo(
    () => resolveQuantityLabel(productSize),
    [productSize],
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const activeImage = images[activeIndex] ?? null;

  /*
   * Trag kita se prikazuje samo proizvodima sa odobrenom geometrijom — po
   * stabilnom slugu, nikad po nazivu. Kad je uključen, panel drži 4:3 i na
   * mobilnom, a envelope proizvoda se spušta na 39cqw da bi materijal ostao
   * vidljiv sa sve četiri strane limenke.
   */
  const showPuttyTrace = hasPuttyMaterialTrace(product.slug);
  /*
   * Promenljive idu na SPOLJNI wrapper, ne na `.stage`: custom properties se
   * nasleđuju, inline deklaracija tuče i media query koji na mobilnom vraća
   * panel na 1:1, a `.stage` zadržava svoj postojeći `style` izraz netaknut —
   * scena sprejeva i boja se ne dodiruje.
   */
  const puttyStyle: CSSProperties | undefined = showPuttyTrace
    ? ({
        "--product-stage-aspect": PUTTY_MATERIAL_TRACE_STAGE_ASPECT,
        "--product-envelope-w": PUTTY_MATERIAL_TRACE_PRODUCT_ENVELOPE,
        "--product-optical-y": PUTTY_MATERIAL_TRACE_OPTICAL_Y,
      } as CSSProperties)
    : undefined;

  return (
    <div
      className={styles.stickyStage}
      data-product-stage-treatment={visualPreset.treatment}
      data-product-stage-type={visualPreset.productType}
      data-product-stage-spray={hasSprayBackdrop ? "true" : "false"}
      data-product-size-class={sizeClass}
      data-stage-format={stageFormat}
      data-product-has-image={activeImage ? "true" : "false"}
      data-putty-trace={showPuttyTrace ? "true" : undefined}
      style={puttyStyle}
    >
      <div
        className={`${styles.stage} ${fit.fit}`}
        data-product-hero-visual
        data-cursor="image"
        data-product-contrast={activeImage?.contrastMode ?? "balanced"}
        data-product-zoom={isZoomed ? "true" : "false"}
        data-product-fit={activeImage?.src}
        style={getProductVisualStyle(product)}
      >
        <span className={styles.stagePlate} aria-hidden="true" />
        {hasSprayBackdrop ? <ProductHeroSprayBackdrop /> : null}
        {showPuttyTrace ? (
          <PuttyMaterialTrace sizes="(min-width: 1180px) 32vw, (min-width: 896px) 34vw, 94vw" />
        ) : null}
        <span className={styles.stageHalo} aria-hidden="true" />

        <span className={styles.heroProductObject}>
          {activeImage ? (
            <Image
              key={activeImage.src}
              src={activeImage.src}
              alt={activeImage.alt}
              data-route-critical="true"
              fill
              priority
              sizes="(min-width: 1180px) 32vw, (min-width: 896px) 34vw, 94vw"
              className={styles.heroProductImage}
            />
          ) : (
            <span className={styles.heroProductFallback} aria-hidden="true">
              <small>Vizuel u pripremi</small>
              <strong>{brandName}</strong>
              <span>{product.name}</span>
            </span>
          )}
        </span>

        <span className={styles.heroBrandMark}>{brandName}</span>
        {images.length > 1 ? (
          <span className={styles.galleryIndex} aria-hidden="true">
            {`${String(activeIndex + 1).padStart(2, "0")} / ${String(images.length).padStart(2, "0")}`}
          </span>
        ) : null}

        {/* Quantity is shown only when `lib/product-scale.ts` could confirm it
            from real package data — an unknown volume renders no badge at all
            rather than a guessed one. */}
        {quantityLabel ? (
          <span className={styles.quantityBadge} data-status={productSize.volumeStatus}>
            <span className={styles.quantityBadgeRule} aria-hidden="true" />
            {quantityLabel}
          </span>
        ) : null}

        {activeImage ? (
          <button
            className={styles.zoomControl}
            type="button"
            aria-pressed={isZoomed}
            aria-label={
              isZoomed
                ? "Vrati prikaz proizvoda na osnovnu veličinu"
                : "Uvećaj prikaz proizvoda"
            }
            onClick={() => setIsZoomed((zoomed) => !zoomed)}
          >
            <ZoomIcon zoomed={isZoomed} />
          </button>
        ) : null}
      </div>

      {images.length > 1 ? (
        <div className={styles.galleryThumbs} aria-label="Izaberite prikaz proizvoda">
          {images.map((image, index) => {
            const isActive = index === activeIndex;

            return (
              <button
                className={`${styles.galleryThumb} ${fit.fit}`}
                data-active={isActive || undefined}
                data-product-fit={image.src}
                type="button"
                aria-label={`Prikaži sliku ${index + 1}: ${image.alt}`}
                aria-pressed={isActive}
                onClick={() => setActiveIndex(index)}
                key={image.src}
              >
                <Image
                  src={image.src}
                  alt=""
                  fill
                  priority={index === 0}
                  sizes="5rem"
                  className={styles.galleryThumbImage}
                />
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function ZoomIcon({ zoomed }: { zoomed: boolean }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <circle cx="7" cy="7" r="4.6" />
      <path d="M10.4 10.4 14 14" />
      <path d="M4.8 7h4.4" />
      {zoomed ? null : <path d="M7 4.8v4.4" />}
    </svg>
  );
}
