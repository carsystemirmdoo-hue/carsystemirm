"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  ProductHeroSpraySvg,
  type ProductHeroSprayPhase,
} from "./ProductHeroSpraySvg";
import styles from "./ProductHeroSprayBackdrop.module.css";

const sprayAnimationConfig = {
  initialDelay: 300,
  overlap: 140,
  durations: [480, 450, 420, 390, 360, 330],
  starts: [0, 340, 650, 930, 1180, 1400],
  easing: "cubic-bezier(0.32, 0.08, 0.70, 0.50)",
} as const;

const totalSequenceDuration =
  sprayAnimationConfig.starts[sprayAnimationConfig.starts.length - 1] +
  sprayAnimationConfig.durations[sprayAnimationConfig.durations.length - 1];

const sprayAnimationStyle = {
  "--spray-duration-01": `${sprayAnimationConfig.durations[0]}ms`,
  "--spray-duration-02": `${sprayAnimationConfig.durations[1]}ms`,
  "--spray-duration-03": `${sprayAnimationConfig.durations[2]}ms`,
  "--spray-duration-04": `${sprayAnimationConfig.durations[3]}ms`,
  "--spray-duration-05": `${sprayAnimationConfig.durations[4]}ms`,
  "--spray-duration-06": `${sprayAnimationConfig.durations[5]}ms`,
  "--spray-start-01": `${sprayAnimationConfig.starts[0]}ms`,
  "--spray-start-02": `${sprayAnimationConfig.starts[1]}ms`,
  "--spray-start-03": `${sprayAnimationConfig.starts[2]}ms`,
  "--spray-start-04": `${sprayAnimationConfig.starts[3]}ms`,
  "--spray-start-05": `${sprayAnimationConfig.starts[4]}ms`,
  "--spray-start-06": `${sprayAnimationConfig.starts[5]}ms`,
  "--spray-easing": sprayAnimationConfig.easing,
} as CSSProperties;

export function ProductHeroSprayBackdrop() {
  const backdropRef = useRef<HTMLSpanElement | null>(null);
  const [phase, setPhase] = useState<ProductHeroSprayPhase>("idle");

  useEffect(() => {
    const backdrop = backdropRef.current;
    const productImage = backdrop
      ?.closest<HTMLElement>("[data-product-hero-visual]")
      ?.querySelector<HTMLImageElement>("img");
    const reducedMotionQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    let initialDelayTimer = 0;
    let completionTimer = 0;
    let hasStarted = false;

    function startOnce() {
      if (hasStarted) return;
      hasStarted = true;

      if (reducedMotionQuery.matches) {
        setPhase("static");
        return;
      }

      initialDelayTimer = window.setTimeout(() => {
        setPhase("running");
        completionTimer = window.setTimeout(
          () => setPhase("complete"),
          totalSequenceDuration,
        );
      }, sprayAnimationConfig.initialDelay);
    }

    function showStaticForReducedMotion(event: MediaQueryListEvent) {
      if (!event.matches) return;
      hasStarted = true;
      window.clearTimeout(initialDelayTimer);
      window.clearTimeout(completionTimer);
      setPhase("static");
    }

    reducedMotionQuery.addEventListener("change", showStaticForReducedMotion);

    if (!productImage || productImage.complete) {
      startOnce();
    } else {
      productImage.addEventListener("load", startOnce, { once: true });
      productImage.addEventListener("error", startOnce, { once: true });
    }

    return () => {
      window.clearTimeout(initialDelayTimer);
      window.clearTimeout(completionTimer);
      reducedMotionQuery.removeEventListener(
        "change",
        showStaticForReducedMotion,
      );
      productImage?.removeEventListener("load", startOnce);
      productImage?.removeEventListener("error", startOnce);
    };
  }, []);

  return (
    <span
      ref={backdropRef}
      className={styles.backdrop}
      style={sprayAnimationStyle}
      aria-hidden="true"
      data-product-hero-spray
      data-phase={phase}
    >
      <span className={styles.patternFrame}>
        <ProductHeroSpraySvg phase={phase} />
      </span>
    </span>
  );
}
