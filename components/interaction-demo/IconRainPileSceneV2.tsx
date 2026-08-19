"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  CategoryGlyph,
  glyphsForCategory,
  type GlyphId,
} from "@/components/interaction-demo/categoryGlyphs";
import { planSceneV2, totalDurationV2 } from "@/components/interaction-demo/iconRainPileV2.mjs";
import styles from "./IconRainPileSceneV2.module.css";

/**
 * Icon rain → pile, V2 — INTERNAL lab scene. No public route imports this.
 *
 * V1 (`IconRainPileScene.tsx`) is untouched and still mounted by the lab; this
 * is a parallel component so the two can be compared and V2 can be removed by
 * deleting its own three files.
 *
 * What changed against V1, in behaviour rather than looks
 * ------------------------------------------------------
 *   a real `complete` phase — V1 stayed in `playing` forever, which left
 *     `will-change: transform` on every glyph and pinned two dozen compositor
 *     layers for the life of the page. V2 flips to `complete` when the last
 *     piece lands and drops the hint.
 *   timers are owned — a single timer, cleared on unmount and on replay, so a
 *     scene that is scrolled past mid-fall does not set state after teardown.
 *   the halo is conditional — driven by the product's measured lightness, so a
 *     mid-tone product gets no glow at all.
 *
 * Unchanged from V1: geometry is pure and seeded, so the server and the browser
 * agree; idle is the finished pile; reduced motion never schedules anything.
 */

export type IconRainV2Variant = "cascade" | "precise";
export type IconRainV2Phase = "idle" | "playing" | "complete";

type ScenePlan = ReturnType<typeof planSceneV2>;
type GlyphPlan = ScenePlan["glyphs"][number];

/** Small buffer so the phase flips after the last frame, not on top of it. */
const COMPLETE_BUFFER_MS = 90;

function glyphStyle(glyph: GlyphPlan): CSSProperties {
  return {
    "--g-size": `${glyph.size}cqw`,
    "--g-weight": glyph.weight,
    "--g-delay": `${glyph.delay}ms`,
    "--g-duration": `${glyph.duration}ms`,
    "--g-release-x": `${glyph.release.x}cqw`,
    "--g-release-y": `${glyph.release.y}cqh`,
    "--g-release-r": `${glyph.release.r}deg`,
    "--g-contact-x": `${glyph.contact.x}cqw`,
    "--g-contact-y": `${glyph.contact.y}cqh`,
    "--g-contact-r": `${glyph.contact.r}deg`,
    "--g-bounce-x": `${glyph.bounce.x}cqw`,
    "--g-bounce-y": `${glyph.bounce.y}cqh`,
    "--g-bounce-r": `${glyph.bounce.r}deg`,
    "--g-rest-x": `${glyph.rest.x}cqw`,
    "--g-rest-y": `${glyph.rest.y}cqh`,
    "--g-rest-r": `${glyph.rest.r}deg`,
  } as CSSProperties;
}

export function IconRainPileSceneV2({
  categorySlug,
  children,
  className,
  contrastMode = "balanced",
  glyphIds,
  seed,
  showReplay = false,
  style,
  theme,
  variant = "cascade",
}: {
  categorySlug?: string;
  /** The product layer. Rendered above the decoration and never moved by it. */
  children?: ReactNode;
  className?: string;
  /** From measured pixels (`lib/product-image-metrics.ts`), not from a token. */
  contrastMode?: "dark-product" | "light-product" | "balanced";
  glyphIds?: GlyphId[];
  seed: number;
  /** Lab-only affordance. No production surface passes this. */
  showReplay?: boolean;
  style?: CSSProperties;
  /** Forces the palette when the lab renders a dark block on a light page. */
  theme?: "light" | "dark";
  variant?: IconRainV2Variant;
}) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const hasPlayedRef = useRef(false);
  const completeTimerRef = useRef<number | null>(null);
  const [phase, setPhase] = useState<IconRainV2Phase>("idle");
  const [runId, setRunId] = useState(0);

  const resolvedGlyphs = useMemo(
    () => glyphIds ?? glyphsForCategory(categorySlug),
    [categorySlug, glyphIds],
  );

  const plan: ScenePlan = useMemo(
    () => planSceneV2({ seed, variant, glyphIds: resolvedGlyphs }),
    [resolvedGlyphs, seed, variant],
  );

  const clearCompleteTimer = useCallback(() => {
    if (completeTimerRef.current === null) return;
    window.clearTimeout(completeTimerRef.current);
    completeTimerRef.current = null;
  }, []);

  const play = useCallback(() => {
    if (hasPlayedRef.current) return;
    hasPlayedRef.current = true;
    setPhase("playing");

    /*
     * One timer rather than counting `animationend` across two dozen elements.
     * `animationend` would need every glyph to fire, and a glyph whose element
     * is recycled mid-flight simply never does — the phase would then stick on
     * `playing` and the `will-change` cleanup would never run, which is the bug
     * this phase exists to fix.
     */
    clearCompleteTimer();
    completeTimerRef.current = window.setTimeout(() => {
      completeTimerRef.current = null;
      setPhase("complete");
    }, plan.totalDuration + COMPLETE_BUFFER_MS);
  }, [clearCompleteTimer, plan.totalDuration]);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return undefined;

    // Reduced motion keeps the pile it already has, and nothing is scheduled,
    // so the animation cannot start later either.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return undefined;
    }

    // Already on screen: start before paint, so the settled pile is never seen
    // snapping back up to fall.
    const rect = frame.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      play();
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          play();
          observer.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    observer.observe(frame);
    return () => observer.disconnect();
  }, [play]);

  // Timers must not outlive the component.
  useEffect(() => clearCompleteTimer, [clearCompleteTimer]);

  const replay = useCallback(() => {
    clearCompleteTimer();
    hasPlayedRef.current = false;
    setPhase("idle");
    // A new `runId` remounts the glyph layer, which is what restarts a CSS
    // animation; toggling a class only restarts it after a forced reflow.
    setRunId((id) => id + 1);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => play());
    });
  }, [clearCompleteTimer, play]);

  const footprint = plan.footprint;

  return (
    <div
      ref={frameRef}
      className={[styles.frame, className].filter(Boolean).join(" ")}
      data-phase={phase}
      data-rain-variant={variant}
      data-rain-version="v2"
      data-product-contrast={contrastMode}
      data-scene-theme={theme}
      style={
        {
          ...style,
          "--rain-total": `${plan.totalDuration}ms`,
          "--pile-center-x": `${footprint.centerX}cqw`,
          "--pile-width": `${footprint.width}cqw`,
          "--pile-core-width": `${footprint.coreWidth}cqw`,
          "--pile-floor-y": `${footprint.y}cqh`,
          /*
           * The product's baseline is the pile's own top edge, minus a couple
           * of units so the heap stops just short of the packaging rather than
           * climbing over its face. The gap is a consequence of the pile, not a
           * guessed offset — V1 left a visible band of empty plate here.
           */
          "--product-bottom-y": `${plan.pileTopY - 3}cqh`,
        } as CSSProperties
      }
    >
      <div className={styles.field} aria-hidden="true" key={runId}>
        {plan.glyphs.map((glyph: GlyphPlan, index: number) => (
          <span
            className={styles.glyph}
            style={glyphStyle(glyph)}
            key={`${runId}-${index}`}
          >
            <CategoryGlyph id={glyph.glyphId as GlyphId} />
          </span>
        ))}
      </div>

      <span className={styles.floorSpread} aria-hidden="true" key={`spread-${runId}`} />
      <span className={styles.floorCore} aria-hidden="true" key={`core-${runId}`} />
      <span className={styles.halo} aria-hidden="true" />

      {children ? <div className={styles.product}>{children}</div> : null}

      {showReplay ? (
        <button className={styles.replay} type="button" onClick={replay}>
          Replay
        </button>
      ) : null}
    </div>
  );
}

export { totalDurationV2 as iconRainV2TotalDuration };
