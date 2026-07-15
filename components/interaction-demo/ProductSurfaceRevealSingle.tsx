"use client";

import { useEffect, useRef } from "react";
import type {
  CarsystemBrand,
  CarsystemProduct,
  ProductImageAsset,
} from "@/lib/carsystem-data";
import { ProductVisualSurface } from "@/components/product/ProductVisualSurface";
import catalogStyles from "@/components/catalog/CatalogPage.module.css";
import styles from "./ProductSurfaceRevealSingle.module.css";

export type ProductSurfaceSingleCard = {
  label: string;
  brand: CarsystemBrand;
  product: CarsystemProduct;
  /* Demo-only transparent packshot; overrides the catalog image via the
     production `image` prop, without touching product data. */
  showcaseImage: ProductImageAsset;
};

/*
 * Deterministic Reels/TikTok loop for ?demo=1. Steps only flip the same
 * data-pointer-active attribute the production MotionSystem writes on
 * .cs-product-motion-card, so the roller reveal always runs through the
 * untouched production CSS pipeline.
 */
const demoLoopDurationMs = 4500;
const demoTimeline: { at: number; active: boolean }[] = [
  { at: 0, active: false },
  { at: 800, active: true },
  { at: 3200, active: false },
];

/*
 * This vertical stage is always top-to-bottom: the single centered product
 * shows the primary reveal, in demo mode and under manual hover alike.
 */
const singleRevealDirection = "from-top";

/*
 * Flip the production data-reveal-direction attribute only while the card is
 * at rest: with the reveal duration zeroed for one forced reflow, the clipped
 * pane snaps from one hidden side to the other without sweeping across.
 */
function snapSurfaceDirection(card: HTMLElement, direction: string) {
  const surface = card.querySelector<HTMLElement>("[data-product-visual-surface]");
  if (!surface || surface.dataset.revealDirection === direction) return;

  surface.style.setProperty("--product-visual-reveal-duration", "0ms");
  surface.dataset.revealDirection = direction;
  void surface.offsetWidth;
  surface.style.removeProperty("--product-visual-reveal-duration");
}

export function ProductSurfaceRevealSingle({
  card,
  isDemoMode,
}: {
  card: ProductSurfaceSingleCard;
  isDemoMode: boolean;
}) {
  const cardRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const cardElement = cardRef.current;
    if (!cardElement) return undefined;

    snapSurfaceDirection(cardElement, singleRevealDirection);

    if (!isDemoMode) return undefined;

    const timers: number[] = [];

    function applyStep(step: (typeof demoTimeline)[number]) {
      if (!cardElement) return;
      cardElement.dataset.pointerActive = step.active ? "true" : "false";
    }

    function scheduleLoop() {
      timers.length = 0;

      for (const step of demoTimeline) {
        timers.push(window.setTimeout(() => applyStep(step), step.at));
      }

      timers.push(window.setTimeout(scheduleLoop, demoLoopDurationMs));
    }

    scheduleLoop();

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      cardElement.dataset.pointerActive = "false";
    };
  }, [isDemoMode]);

  return (
    <main className={`${catalogStyles.catalogShell} ${styles.stage}`}>
      <div className={styles.cardColumn}>
        <article
          ref={cardRef}
          className={`${catalogStyles.productCard} ${styles.card} cs-product-motion-card`}
          data-cursor="card"
          data-motion-surface
          data-product-card-motion
        >
          <button
            type="button"
            className={`${catalogStyles.productImageLink} ${styles.surfaceTrigger}`}
            aria-label={`Prikaz interakcije: ${card.label}`}
          >
            <ProductVisualSurface
              brandName={card.brand.name}
              image={card.showcaseImage}
              product={card.product}
              priority
              sizes="(min-width: 600px) 920px, 88vw"
            />
          </button>
          <span className={styles.cardLabel}>{card.label}</span>
        </article>
      </div>
    </main>
  );
}
