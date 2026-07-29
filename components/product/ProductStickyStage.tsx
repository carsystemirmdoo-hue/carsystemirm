"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { ProductHeroSprayBackdrop } from "@/components/product/ProductHeroSprayBackdrop";
import {
  getProductVisualPreset,
  getProductVisualStyle,
  shouldRenderProductHeroSpray,
} from "@/components/product/productMotion";
import type { CarsystemProduct, ProductImageAsset } from "@/lib/carsystem-data";
import styles from "./ProductDetailExperience.module.css";

function getUniqueImages(product: CarsystemProduct) {
  const candidates = [product.productImage, ...product.galleryImages].filter(
    (image): image is ProductImageAsset =>
      image !== null && !image.src.includes("placeholder-product"),
  );

  return candidates.filter(
    (image, index, all) =>
      all.findIndex((candidate) => candidate.src === image.src) === index,
  );
}

export function ProductStickyStage({
  brandName,
  product,
}: {
  brandName: string;
  product: CarsystemProduct;
}) {
  const images = useMemo(() => getUniqueImages(product), [product]);
  const visualPreset = useMemo(() => getProductVisualPreset(product), [product]);
  const hasSprayBackdrop = useMemo(
    () => shouldRenderProductHeroSpray(product),
    [product],
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const activeImage = images[activeIndex] ?? null;

  return (
    <div
      className={styles.stickyStage}
      data-product-stage-treatment={visualPreset.treatment}
      data-product-stage-type={visualPreset.productType}
      data-product-stage-spray={hasSprayBackdrop ? "true" : "false"}
    >
      <div className={styles.stage}>
        <div
          className={styles.heroVisualSurface}
          data-product-hero-visual
          data-cursor="image"
          style={getProductVisualStyle(product)}
        >
          {hasSprayBackdrop ? <ProductHeroSprayBackdrop /> : null}
          <span className={styles.heroBrandMark}>{brandName}</span>
          {images.length > 1 ? (
            <span className={styles.galleryIndex} aria-hidden="true">
              {`${String(activeIndex + 1).padStart(2, "0")} / ${String(images.length).padStart(2, "0")}`}
            </span>
          ) : null}
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
        </div>
      </div>

      {images.length > 1 ? (
        <div className={styles.galleryThumbs} aria-label="Izaberite prikaz proizvoda">
          {images.map((image, index) => {
            const isActive = index === activeIndex;

            return (
              <button
                className={styles.galleryThumb}
                data-active={isActive || undefined}
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
