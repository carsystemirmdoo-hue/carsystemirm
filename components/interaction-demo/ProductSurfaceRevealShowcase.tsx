"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import type {
  CarsystemBrand,
  CarsystemProduct,
  ProductImageAsset,
} from "@/lib/carsystem-data";
import { ProductVisualSurface } from "@/components/product/ProductVisualSurface";
import catalogStyles from "@/components/catalog/CatalogPage.module.css";
import styles from "./ProductSurfaceRevealShowcase.module.css";

export type ProductSurfaceShowcaseCard = {
  label: string;
  brand: CarsystemBrand;
  product: CarsystemProduct;
  /* Demo-only transparent packshot; overrides the catalog image via the
     production `image` prop, without touching product data. */
  showcaseImage: ProductImageAsset;
};

/*
 * Deterministic recording timeline for ?demo=1. Steps only flip the same
 * data-pointer-active attribute the production MotionSystem writes on
 * .cs-product-motion-card, so the roller reveal always runs through the
 * untouched production CSS pipeline.
 */
const demoLoopDurationMs = 8500;
const demoTimeline: { at: number; selectedIndex: number | null }[] = [
  { at: 0, selectedIndex: null },
  { at: 1000, selectedIndex: 0 },
  { at: 3000, selectedIndex: 1 },
  { at: 5000, selectedIndex: 2 },
  { at: 7000, selectedIndex: null },
];

/* Packshot drift toward the stage center: right for the left card, etc. */
const driftXByIndex = ["18px", "0px", "-18px"];

type RevealDirection = "from-top" | "from-bottom";

/*
 * ?demo=1 activates every card in order: cards 1 and 2 reveal top-to-bottom
 * (the primary behavior), card 3 shows the single bottom-to-top alternate.
 */
const demoRevealDirections: RevealDirection[] = ["from-top", "from-top", "from-bottom"];

const fromBottomChance = 0.2;

/*
 * Flip the production data-reveal-direction attribute only while the card is
 * at rest: with the reveal duration zeroed for one forced reflow, the clipped
 * pane snaps from one hidden side to the other without sweeping across.
 */
function snapSurfaceDirection(card: HTMLElement, direction: RevealDirection) {
  const surface = card.querySelector<HTMLElement>("[data-product-visual-surface]");
  if (!surface || surface.dataset.revealDirection === direction) return;

  surface.style.setProperty("--product-visual-reveal-duration", "0ms");
  surface.dataset.revealDirection = direction;
  void surface.offsetWidth;
  surface.style.removeProperty("--product-visual-reveal-duration");
}

export function ProductSurfaceRevealShowcase({
  cards,
  isDemoMode,
}: {
  cards: ProductSurfaceShowcaseCard[];
  isDemoMode: boolean;
}) {
  const cardRefs = useRef<(HTMLElement | null)[]>([]);

  /*
   * Manual route: like the reference recording, the reveal direction is not
   * tied to a card or product. Each new activation gets a fresh weighted pick
   * (~80% top-to-bottom), re-rolled while the card is back at rest so the
   * pane never flips mid-flight; a bottom-to-top pick is never followed by
   * another bottom-to-top.
   */
  useEffect(() => {
    if (isDemoMode) return undefined;

    const cardElements = cardRefs.current.filter((card): card is HTMLElement => Boolean(card));
    const timers = new Set<number>();
    let lastPickWasBottom = false;

    function pickDirection(): RevealDirection {
      if (lastPickWasBottom) {
        lastPickWasBottom = false;
        return "from-top";
      }

      lastPickWasBottom = Math.random() < fromBottomChance;
      return lastPickWasBottom ? "from-bottom" : "from-top";
    }

    cardElements.forEach((card) => snapSurfaceDirection(card, pickDirection()));

    const cleanups = cardElements.map((card) => {
      function handleDeactivate() {
        const timer = window.setTimeout(() => {
          timers.delete(timer);
          if (card.dataset.pointerActive === "true") return;
          if (card.matches(":hover, :focus-within")) return;

          snapSurfaceDirection(card, pickDirection());
        }, 700);

        timers.add(timer);
      }

      card.addEventListener("pointerleave", handleDeactivate);
      card.addEventListener("pointercancel", handleDeactivate);
      card.addEventListener("focusout", handleDeactivate);

      return () => {
        card.removeEventListener("pointerleave", handleDeactivate);
        card.removeEventListener("pointercancel", handleDeactivate);
        card.removeEventListener("focusout", handleDeactivate);
      };
    });

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [isDemoMode]);

  useEffect(() => {
    if (!isDemoMode) return undefined;

    const timers: number[] = [];
    const cardElements = cardRefs.current;

    cardElements.forEach((card, index) => {
      if (!card) return;
      snapSurfaceDirection(card, demoRevealDirections[index] ?? "from-top");
    });

    function applyStep(step: (typeof demoTimeline)[number]) {
      cardElements.forEach((card, index) => {
        if (!card) return;

        card.dataset.pointerActive = step.selectedIndex === index ? "true" : "false";
      });
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
      cardElements.forEach((card) => {
        if (!card) return;
        card.dataset.pointerActive = "false";
      });
    };
  }, [isDemoMode]);

  return (
    <main className={`${catalogStyles.catalogShell} ${styles.stage}`}>
      <div className={styles.cardRow}>
        {cards.map((card, index) => (
          <article
            key={card.label}
            ref={(element) => {
              cardRefs.current[index] = element;
            }}
            className={`${catalogStyles.productCard} ${styles.card} cs-product-motion-card`}
            data-cursor="card"
            data-motion-surface
            data-product-card-motion
            style={{ "--showcase-drift-x": driftXByIndex[index] ?? "0px" } as CSSProperties}
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
                sizes="(min-width: 900px) 30vw, 92vw"
              />
            </button>
            <span className={styles.cardLabel}>{card.label}</span>
          </article>
        ))}
      </div>
    </main>
  );
}
