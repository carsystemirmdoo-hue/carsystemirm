"use client";

import Image from "next/image";
import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent,
} from "react";
import type { CarsystemProduct, ProductImageAsset } from "@/lib/carsystem-data";
import {
  getProductRevealDirection,
  getProductVisualPreset,
  getProductVisualStyle,
} from "@/components/product/productMotion";
import styles from "./ProductVisualSurface.module.css";

export function ProductVisualSurface({
  brandName,
  className,
  image,
  priority = false,
  product,
  sizes,
}: {
  brandName: string;
  className?: string;
  image?: ProductImageAsset | null;
  priority?: boolean;
  product: CarsystemProduct;
  sizes: string;
}) {
  const selectedImage = image ?? product.productImage ?? product.galleryImages[0] ?? null;
  const hasProductAsset = Boolean(
    selectedImage && !selectedImage.src.includes("placeholder-product"),
  );
  const visual = getProductVisualPreset(product);
  const revealDirection = getProductRevealDirection(product);
  const [isSurfacePointerActive, setIsSurfacePointerActive] = useState(false);
  const surfaceRef = useRef<HTMLSpanElement | null>(null);
  const surfaceClassName = [styles.surface, className].filter(Boolean).join(" ");

  useEffect(() => {
    if (!isSurfacePointerActive) return undefined;

    function handleDocumentPointerMove(event: globalThis.PointerEvent) {
      const surface = surfaceRef.current;
      if (!surface) return;

      const target = event.target;
      if (target instanceof Node && surface.contains(target)) return;

      const rect = surface.getBoundingClientRect();
      const isInside =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;

      if (isInside) return;

      setIsSurfacePointerActive(false);
    }

    document.addEventListener("pointermove", handleDocumentPointerMove, { passive: true });

    return () => {
      document.removeEventListener("pointermove", handleDocumentPointerMove);
    };
  }, [isSurfacePointerActive]);

  function updatePointerPosition(event: PointerEvent<HTMLSpanElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const x = Math.min(Math.max(((event.clientX - rect.left) / rect.width) * 100, 0), 100);
    const y = Math.min(Math.max(((event.clientY - rect.top) / rect.height) * 100, 0), 100);

    event.currentTarget.style.setProperty("--product-visual-pointer-x", `${x.toFixed(2)}%`);
    event.currentTarget.style.setProperty("--product-visual-pointer-y", `${y.toFixed(2)}%`);
  }

  function activateSurfacePointer(pointerType: string) {
    if (pointerType === "touch") return;

    setIsSurfacePointerActive(true);
  }

  function handlePointerEnter(event: PointerEvent<HTMLSpanElement>) {
    updatePointerPosition(event);
    activateSurfacePointer(event.pointerType);
  }

  function handlePointerMove(event: PointerEvent<HTMLSpanElement>) {
    updatePointerPosition(event);
    activateSurfacePointer(event.pointerType);
  }

  function handlePointerLeave() {
    setIsSurfacePointerActive(false);
  }

  function handlePointerOut(event: PointerEvent<HTMLSpanElement>) {
    if (
      event.relatedTarget instanceof Node &&
      event.currentTarget.contains(event.relatedTarget)
    ) {
      return;
    }

    handlePointerLeave();
  }

  function handleMouseLeave(event: ReactMouseEvent<HTMLSpanElement>) {
    if (
      event.relatedTarget instanceof Node &&
      event.currentTarget.contains(event.relatedTarget)
    ) {
      return;
    }

    handlePointerLeave();
  }

  return (
    <span
      ref={surfaceRef}
      className={surfaceClassName}
      data-product-image-motion
      data-product-visual-real-image={hasProductAsset ? "true" : "false"}
      data-product-visual-pointer-active={isSurfacePointerActive ? "true" : undefined}
      data-product-visual-surface
      data-product-visual-treatment={visual.treatment}
      data-reveal-direction={revealDirection}
      onPointerCancel={handlePointerLeave}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onPointerMove={handlePointerMove}
      onPointerOut={handlePointerOut}
      onMouseLeave={handleMouseLeave}
      style={getProductVisualStyle(product)}
    >
      <span className={styles.baseLayer} aria-hidden="true" />
      <span className={styles.effectStack} aria-hidden="true">
        <span className={styles.effectPane}>
          <span className={styles.effectInner}>
            <span className={styles.floodWash} />
            <span className={styles.floodCore} />
            <span className={styles.matteField} />
            <span className={styles.matteGrain} />
            <span className={styles.abrasiveWash} />
            <span className={styles.abrasiveTrace} />
            <span className={styles.polishSheen} />
            <span className={styles.polishSweep} />
          </span>
        </span>
        <span className={styles.rollerEdge} />
      </span>
      <span className={styles.contactShadow} aria-hidden="true" />

      <span className={styles.brandMark}>{brandName}</span>

      <span className={styles.objectWrap}>
        {hasProductAsset && selectedImage ? (
          <Image
            src={selectedImage.src}
            alt={selectedImage.alt}
            fill
            sizes={sizes}
            className={styles.productImage}
            priority={priority}
          />
        ) : (
          <span className={styles.placeholderVisual} aria-hidden="true">
            <span className={styles.placeholderMark} />
            <small>Vizuel u pripremi</small>
            <strong>{brandName}</strong>
            <span>{product.name}</span>
          </span>
        )}
      </span>
      <span className={styles.pointerLens} aria-hidden="true" />
    </span>
  );
}
