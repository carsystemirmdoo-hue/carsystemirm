"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { ProductHeroSpraySvg } from "@/components/product/ProductHeroSpraySvg";
import {
  sprayRevealFormats,
  type SprayRevealFormat,
  type SprayRevealVariant,
} from "./sprayRevealVariants";
import styles from "./SprayRevealStage.module.css";

/*
 * Vremenska linija klipa (~5.6s ukupno):
 *   0        - 400ms   miran uvodni kadar
 *   400      - 2130ms  spray reveal, potez po potez (originalni stagger i
 *                       easing iz product hero spray sistema)
 *   1250     - 1970ms  diskretan ulazak proizvoda (fade + rise + scale)
 *   3600ms   -         minimalan caption (logo + naziv proizvoda)
 *   do 5600ms          finalni hero hold, čist kraj bez fade-outa
 *
 * Sve animacije su CSS animacije sa apsolutnim delay-ima od starta scene, pa
 * je klip potpuno određen vremenom: u render režimu (?render=1) scena čeka
 * window.__sprayRender.start() i dalje je vozi isključivo virtuelni sat
 * render skripte; ?render=1&time=MS pauzira sve animacije na tačnom trenutku
 * preko negativnog --seek pomaka.
 */
const HOLD_MS = 400;
const TOTAL_MS = 5600;

/* Originalni tajming spray poteza (ProductHeroSprayBackdrop). */
const sprayTiming = {
  durations: [480, 450, 420, 390, 360, 330],
  starts: [0, 340, 650, 930, 1180, 1400],
  easing: "cubic-bezier(0.32, 0.08, 0.70, 0.50)",
} as const;

const PRELOAD_TIMEOUT_MS = 8000;
const PREVIEW_LOOP_GAP_MS = 900;

type SprayRenderBridge = {
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
    __sprayRender?: SprayRenderBridge;
  }
}

export function SprayRevealStage({
  format,
  variant,
  renderMode = false,
  renderTimeMs = null,
}: {
  format: SprayRevealFormat;
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

  // Preload packshota, logotipa, spray artworka i fontova pre prvog frame-a.
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

  // Preview: autoplay posle preloada + čist loop kroz remount scene.
  useEffect(() => {
    if (!ready || renderMode) return undefined;

    setPlaying(true);
    const loopTimer = window.setTimeout(() => {
      setPlaying(false);
      setLoopKey((value) => value + 1);
    }, TOTAL_MS + PREVIEW_LOOP_GAP_MS);

    return () => window.clearTimeout(loopTimer);
  }, [ready, renderMode, loopKey]);

  // Render most: skripta poziva start() tek pošto uključi virtual time.
  useEffect(() => {
    if (!renderMode) return undefined;

    window.__sprayRender = {
      start: () => setPlaying(true),
      meta: () => ({ ready, durationMs: TOTAL_MS, width, height }),
    };

    return () => {
      delete window.__sprayRender;
    };
  }, [renderMode, ready, width, height]);

  // Skaliranje na viewport u preview-u; u renderu je viewport tačno kadar.
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
        `calc(${HOLD_MS + sprayTiming.starts[index]}ms + var(--seek, 0ms))`;
    });

    return style;
  }, [width, height, renderMode, scale, variant, isStaticRender, renderTimeMs]);

  return (
    <div className={styles.viewport}>
      <div
        key={loopKey}
        className={styles.stage}
        data-export-format={format}
        data-export-ready={ready ? "true" : "false"}
        data-play={isPlaying ? "true" : "false"}
        data-render-static={isStaticRender ? "true" : undefined}
        style={stageStyle}
      >
        <span className={styles.glow} aria-hidden="true" />

        <div className={styles.composition}>
          <div className={styles.artFrame} aria-hidden="true">
            <ProductHeroSpraySvg phase={sprayPhase} />
          </div>

          <span className={styles.floorShadow} aria-hidden="true" />

          {/* Plain img: packshot u nativnoj rezoluciji, bez optimizer varijacija. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className={styles.product}
            src={variant.imageSrc}
            alt={variant.imageAlt}
            draggable={false}
          />
        </div>

        <footer className={styles.caption}>
          {variant.brandLogoSrc ? (
            <span className={styles.captionLogo}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={variant.brandLogoSrc} alt={variant.brandName} draggable={false} />
            </span>
          ) : null}
          <strong>{variant.productName}</strong>
        </footer>

        {!ready ? <p className={styles.loading}>Priprema sadržaja…</p> : null}
      </div>
    </div>
  );
}
