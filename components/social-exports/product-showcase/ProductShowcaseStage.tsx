"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { ProductHeroSpraySvg } from "@/components/product/ProductHeroSpraySvg";
import {
  sprayRevealFormats,
  type SprayRevealFormat,
  type SprayRevealVariant,
} from "@/components/social-exports/spray-reveal/sprayRevealVariants";
import styles from "./ProductShowcaseStage.module.css";

export type ProductShowcaseTheme = "light" | "dark";

/*
 * Product page showcase: najreprezentativniji hero blok stranice proizvoda —
 * eyebrow pills, naslov, kratka rečenica i vizuelna površina sa spray reveal
 * artworkom iza packshota — složen kao realan Carsystem product page modul,
 * u light i dark temi. Bez galerija, tabela, breadcrumb-ova i ostalog UI šuma.
 *
 * Vremenska linija (~6s): stabilan page kadar -> tekst blago uđe -> spray se
 * iscrta potez po potez -> proizvod diskretno uđe -> finalni hold. Kao i
 * spray-reveal scena, sve su CSS animacije sa delay-ima koji uključuju
 * var(--seek), pa je render potpuno određen vremenom (?render=1&time=MS).
 */
const TOTAL_MS = 6000;
const SPRAY_START_MS = 700;

const sprayTiming = {
  durations: [480, 450, 420, 390, 360, 330],
  starts: [0, 340, 650, 930, 1180, 1400],
  easing: "cubic-bezier(0.32, 0.08, 0.70, 0.50)",
} as const;

const PRELOAD_TIMEOUT_MS = 8000;
const PREVIEW_LOOP_GAP_MS = 900;

type ShowcaseRenderBridge = {
  start: () => void;
  meta: () => {
    ready: boolean;
    durationMs: number;
    width: number;
    height: number;
  };
};

declare global {
  interface Window {
    __showcaseRender?: ShowcaseRenderBridge;
  }
}

export function ProductShowcaseStage({
  format,
  theme,
  variant,
  renderMode = false,
  renderTimeMs = null,
}: {
  format: SprayRevealFormat;
  theme: ProductShowcaseTheme;
  variant: SprayRevealVariant;
  renderMode?: boolean;
  renderTimeMs?: number | null;
}) {
  const { width, height } = sprayRevealFormats[format];
  const isStaticRender = renderMode && renderTimeMs !== null;

  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [loopKey, setLoopKey] = useState(0);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    let cancelled = false;
    const srcs = [
      variant.imageSrc,
      variant.brandLogoSrc,
      "/product-hero-patterns/spray-six-pass.svg",
    ].filter((src): src is string => Boolean(src));

    const imageJobs = srcs.map(
      (src) =>
        new Promise<void>((resolve) => {
          const image = new window.Image();
          image.onload = () => resolve();
          image.onerror = () => resolve();
          image.src = src;
        }),
    );
    const fontJob =
      "fonts" in document ? document.fonts.ready.then(() => undefined) : Promise.resolve();
    const timeout = new Promise<void>((resolve) => {
      window.setTimeout(resolve, PRELOAD_TIMEOUT_MS);
    });

    void Promise.race([
      Promise.all([...imageJobs, fontJob]).then(() => undefined),
      timeout,
    ]).then(() => {
      if (!cancelled) setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [variant]);

  useEffect(() => {
    if (!ready || renderMode) return undefined;

    setPlaying(true);
    const loopTimer = window.setTimeout(() => {
      setPlaying(false);
      setLoopKey((value) => value + 1);
    }, TOTAL_MS + PREVIEW_LOOP_GAP_MS);

    return () => window.clearTimeout(loopTimer);
  }, [ready, renderMode, loopKey]);

  useEffect(() => {
    if (!renderMode) return undefined;

    window.__showcaseRender = {
      start: () => setPlaying(true),
      meta: () => ({ ready, durationMs: TOTAL_MS, width, height }),
    };

    return () => {
      delete window.__showcaseRender;
    };
  }, [renderMode, ready, width, height]);

  useEffect(() => {
    if (renderMode) return undefined;

    function updateScale() {
      setScale(Math.min(window.innerWidth / width, window.innerHeight / height, 1));
    }

    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [renderMode, width, height]);

  const isPlaying = playing || isStaticRender;
  const sprayPhase = isPlaying ? "running" : "idle";

  const stageStyle = useMemo(() => {
    const style: CSSProperties & Record<string, string> = {
      width: `${width}px`,
      height: `${height}px`,
      transform: renderMode ? "translate(-50%, -50%)" : `translate(-50%, -50%) scale(${scale})`,
      "--spray-color": variant.sprayColor,
      "--glow-color": variant.glowColor,
      "--product-visual-background-color": variant.sprayColor,
      "--spray-easing": sprayTiming.easing,
    };

    if (isStaticRender) {
      style["--seek"] = `${-Math.min(Math.max(renderTimeMs, 0), TOTAL_MS)}ms`;
    }

    sprayTiming.durations.forEach((duration, index) => {
      const pass = String(index + 1).padStart(2, "0");
      style[`--spray-duration-${pass}`] = `${duration}ms`;
      style[`--spray-start-${pass}`] =
        `calc(${SPRAY_START_MS + sprayTiming.starts[index]}ms + var(--seek, 0ms))`;
    });

    return style;
  }, [width, height, renderMode, scale, variant, isStaticRender, renderTimeMs]);

  return (
    <div className={styles.viewport} data-theme={theme}>
      <div
        key={loopKey}
        className={styles.stage}
        data-theme={theme}
        data-export-format={format}
        data-export-ready={ready ? "true" : "false"}
        data-play={isPlaying ? "true" : "false"}
        data-render-static={isStaticRender ? "true" : undefined}
        style={stageStyle}
      >
        <div className={styles.pageFrame}>
          <header className={styles.copyBlock}>
            <div className={styles.pillRow}>
              <span className={styles.pill}>{variant.brandName}</span>
              <span className={styles.pill}>{variant.category}</span>
            </div>
            <h1 className={styles.title}>{variant.productName}</h1>
            <p className={styles.lead}>{variant.lead}</p>
          </header>

          <div className={styles.visualSurface}>
            <span className={styles.brandMark}>{variant.brandName}</span>

            <div className={styles.artFrame} aria-hidden="true">
              <ProductHeroSpraySvg phase={sprayPhase} />
            </div>

            {/* Plain img: packshot u nativnoj rezoluciji, bez optimizera. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className={styles.product}
              src={variant.imageSrc}
              alt={variant.imageAlt}
              draggable={false}
            />
          </div>
        </div>

        {!ready ? <p className={styles.loading}>Priprema sadržaja…</p> : null}
      </div>
    </div>
  );
}
