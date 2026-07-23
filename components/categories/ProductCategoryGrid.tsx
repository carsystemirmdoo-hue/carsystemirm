"use client";

/* eslint-disable @next/next/no-img-element -- Category artwork is supplied as approved SVG files. */
import Link from "next/link";
import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type TransitionEvent as ReactTransitionEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ProductCategoryLink } from "@/components/layout/navigation-data";
import { nextRevealDirection } from "@/components/product/productRevealDirection.mjs";
import styles from "./ProductCategoryGrid.module.css";

type ProductRevealPhase = "idle" | "active" | "exiting";

const PRODUCT_REVEAL_EXIT_FALLBACK_MS = 420;

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function ProductCategoryGrid({
  categories,
  layout = "menu",
  onNavigate,
}: {
  categories: ProductCategoryLink[];
  layout?: "menu" | "homepage";
  onNavigate?: () => void;
}) {
  return (
    <ul
      className={styles.grid}
      data-layout={layout}
      aria-label="Kategorije proizvoda"
    >
      {categories.map((category) => (
        <li key={category.slug}>
          <ProductCategoryCard category={category} onNavigate={onNavigate} />
        </li>
      ))}
    </ul>
  );
}

function ProductCategoryCard({
  category,
  onNavigate,
}: {
  category: ProductCategoryLink;
  onNavigate?: () => void;
}) {
  const [revealPhase, setRevealPhase] = useState<ProductRevealPhase>("idle");
  const [revealDirection, setRevealDirection] = useState<"top" | "bottom">(
    "bottom",
  );
  const revealPhaseRef = useRef<ProductRevealPhase>("idle");
  const pointerSessionRef = useRef(false);
  const focusSessionRef = useRef(false);
  const exitTimerRef = useRef<number | null>(null);

  function clearExitTimer() {
    if (exitTimerRef.current === null) return;
    window.clearTimeout(exitTimerRef.current);
    exitTimerRef.current = null;
  }

  function completeExit() {
    clearExitTimer();
    revealPhaseRef.current = "idle";
    setRevealPhase("idle");
  }

  function activateReveal(direction: "top" | "bottom") {
    clearExitTimer();
    if (revealPhaseRef.current === "idle") setRevealDirection(direction);
    revealPhaseRef.current = "active";
    setRevealPhase("active");
  }

  function beginExit() {
    if (
      revealPhaseRef.current === "idle" ||
      revealPhaseRef.current === "exiting"
    ) {
      return;
    }

    revealPhaseRef.current = "exiting";
    setRevealPhase("exiting");

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      completeExit();
      return;
    }

    clearExitTimer();
    exitTimerRef.current = window.setTimeout(
      completeExit,
      PRODUCT_REVEAL_EXIT_FALLBACK_MS,
    );
  }

  function handlePointerEnter(event: ReactPointerEvent<HTMLAnchorElement>) {
    if (
      event.pointerType === "touch" ||
      !window.matchMedia("(hover: hover) and (pointer: fine)").matches
    ) {
      return;
    }
    pointerSessionRef.current = true;
    activateReveal(nextRevealDirection(category.slug));
  }

  function handlePointerLeave() {
    pointerSessionRef.current = false;
    if (!focusSessionRef.current) beginExit();
  }

  function handleFocus() {
    focusSessionRef.current = true;
    activateReveal("bottom");
  }

  function handleBlur() {
    focusSessionRef.current = false;
    if (!pointerSessionRef.current) beginExit();
  }

  function handleRevealTransitionEnd(
    event: ReactTransitionEvent<HTMLSpanElement>,
  ) {
    if (
      event.target === event.currentTarget &&
      event.propertyName === "transform" &&
      revealPhaseRef.current === "exiting"
    ) {
      completeExit();
    }
  }

  useEffect(
    () => () => {
      if (exitTimerRef.current !== null) {
        window.clearTimeout(exitTimerRef.current);
      }
    },
    [],
  );

  return (
    <Link
      href={category.href}
      className={cx(styles.card, "cs-interactive-surface")}
      data-cursor="card"
      data-motion-surface
      data-reveal-direction={`from-${revealDirection}`}
      data-reveal-state={revealPhase}
      onClick={onNavigate}
      onBlur={handleBlur}
      onFocus={handleFocus}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
    >
      <ProductCategoryContent category={category} />
      <span
        className={styles.revealPane}
        aria-hidden="true"
        onTransitionEnd={handleRevealTransitionEnd}
      >
        <span className={styles.revealInner}>
          <ProductCategoryContent category={category} />
        </span>
      </span>
      <span className={styles.rollerEdge} aria-hidden="true" />
    </Link>
  );
}

function ProductCategoryContent({
  category,
}: {
  category: ProductCategoryLink;
}) {
  return (
    <span className={styles.content}>
      <span className={styles.iconZone} aria-hidden="true">
        {category.icon ? (
          <img
            src={category.icon}
            alt=""
            className={styles.icon}
            decoding="async"
            draggable="false"
            style={
              {
                "--category-icon-scale": category.iconScale ?? 1,
                "--category-icon-origin": category.iconOrigin ?? "center",
                "--category-icon-offset-x": `${category.iconOffsetX ?? 0}px`,
                "--category-icon-offset-y": `${category.iconOffsetY ?? 0}px`,
              } as CSSProperties
            }
            data-preserve-white-details={
              category.preserveWhiteDetails || undefined
            }
          />
        ) : null}
      </span>
      <strong className={styles.label}>{category.label}</strong>
    </span>
  );
}
