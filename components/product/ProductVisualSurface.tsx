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
import { getProductVisualPreset, getProductVisualStyle } from "@/components/product/productMotion";
import styles from "./ProductVisualSurface.module.css";

type PaintHoverDirection = "from-top" | "from-bottom";

function pickPaintHoverDirection(): PaintHoverDirection {
  return Math.random() < 0.5 ? "from-top" : "from-bottom";
}

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
  const isPaintTreatment = visual.treatment === "paint";
  const [paintHoverDirection, setPaintHoverDirection] =
    useState<PaintHoverDirection>("from-top");
  const [isPaintHoverActive, setIsPaintHoverActive] = useState(false);
  const [isSurfacePointerActive, setIsSurfacePointerActive] = useState(false);
  const surfaceRef = useRef<HTMLSpanElement | null>(null);
  const paintHoverActiveRef = useRef(false);
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
      paintHoverActiveRef.current = false;
      setIsPaintHoverActive(false);
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

  function activatePaintHover(pointerType: string) {
    if (!isPaintTreatment || pointerType === "touch") return;

    if (!paintHoverActiveRef.current) {
      setPaintHoverDirection(pickPaintHoverDirection());
    }

    paintHoverActiveRef.current = true;
    setIsPaintHoverActive(true);
  }

  function activateSurfacePointer(pointerType: string) {
    if (pointerType === "touch") return;

    setIsSurfacePointerActive(true);
  }

  function handlePointerEnter(event: PointerEvent<HTMLSpanElement>) {
    updatePointerPosition(event);
    activateSurfacePointer(event.pointerType);
    activatePaintHover(event.pointerType);
  }

  function handlePointerMove(event: PointerEvent<HTMLSpanElement>) {
    updatePointerPosition(event);
    activateSurfacePointer(event.pointerType);
    activatePaintHover(event.pointerType);
  }

  function handlePointerLeave() {
    setIsSurfacePointerActive(false);
    paintHoverActiveRef.current = false;
    setIsPaintHoverActive(false);
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
      data-paint-hover-active={isPaintHoverActive ? "true" : undefined}
      data-paint-hover-direction={paintHoverDirection}
      data-product-image-motion
      data-product-visual-real-image={hasProductAsset ? "true" : "false"}
      data-product-visual-pointer-active={isSurfacePointerActive ? "true" : undefined}
      data-product-visual-surface
      data-product-visual-treatment={visual.treatment}
      onPointerCancel={handlePointerLeave}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onPointerMove={handlePointerMove}
      onPointerOut={handlePointerOut}
      onMouseLeave={handleMouseLeave}
      style={getProductVisualStyle(product)}
    >
      <span className={styles.baseLayer} aria-hidden="true" />
      <span className={styles.floodWash} aria-hidden="true" />
      <span className={styles.floodCore} aria-hidden="true" />
      <span className={styles.matteField} aria-hidden="true" />
      <span className={styles.matteGrain} aria-hidden="true" />
      <span className={styles.abrasiveWash} aria-hidden="true" />
      <span className={styles.abrasiveTrace} aria-hidden="true" />
      <span className={styles.polishSheen} aria-hidden="true" />
      <span className={styles.polishSweep} aria-hidden="true" />
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
