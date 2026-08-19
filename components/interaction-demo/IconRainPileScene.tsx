"use client";

import {
  useCallback,
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
import { planIconRain, totalDuration } from "@/components/interaction-demo/iconRainPile.mjs";
import styles from "./IconRainPileScene.module.css";

/**
 * Icon rain → pile — INTERNAL lab scene. No public route imports this.
 *
 * How it actually animates
 * ------------------------
 * `iconRainPile.mjs` turns a seed into a full plan: for every glyph, four
 * waypoints (release above the frame, first contact overshooting the resting
 * line, rebound, rest), a size, a delay and a duration. Those become custom
 * properties on each glyph, and one CSS `@keyframes` interpolates between them.
 *
 * So: no physics library, no per-frame JavaScript, no `requestAnimationFrame`
 * loop. JavaScript's only job is deciding *when* to start.
 *
 * Lifecycle
 * ---------
 *   idle    — the finished pile. This is what the server renders, what a reader
 *             with `prefers-reduced-motion` keeps, and what survives if the
 *             script never runs.
 *   playing — set once, when the frame first enters the viewport.
 *
 * Because idle already equals the end state, starting the animation cannot
 * shift layout and cannot change what the page means. The phase is set in
 * `useLayoutEffect`, before paint, so a frame that is already on screen never
 * flashes its end state first.
 */

export type IconRainVariant = "precise" | "spill" | "cascade";

type GlyphPlan = ReturnType<typeof planIconRain>[number];

/**
 * Waypoints are in container-query units of the frame, so the composition holds
 * its shape from 390 px to 1920 px instead of being pinned to pixel offsets.
 */
function glyphStyle(glyph: GlyphPlan): CSSProperties {
  return {
    "--g-size": `${glyph.size}cqw`,
    "--g-opacity": glyph.opacity,
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

export function IconRainPileScene({
  categorySlug,
  children,
  className,
  glyphIds,
  seed,
  showReplay = false,
  style,
  variant = "precise",
}: {
  categorySlug?: string;
  /** The product layer. Rendered above the decoration and never moved by it. */
  children?: ReactNode;
  className?: string;
  /** Overrides the category glyph set; the lab uses it to force a group. */
  glyphIds?: GlyphId[];
  seed: number;
  /** Lab-only affordance. No production surface passes this. */
  showReplay?: boolean;
  style?: CSSProperties;
  variant?: IconRainVariant;
}) {
  const frameRef = useRef<HTMLDivElement | null>(null);
  const hasPlayedRef = useRef(false);
  const [phase, setPhase] = useState<"idle" | "playing">("idle");
  const [runId, setRunId] = useState(0);

  const resolvedGlyphs = useMemo(
    () => glyphIds ?? glyphsForCategory(categorySlug),
    [categorySlug, glyphIds],
  );

  const plan = useMemo(
    () => planIconRain({ seed, variant, glyphIds: resolvedGlyphs }),
    [resolvedGlyphs, seed, variant],
  );

  const play = useCallback(() => {
    if (hasPlayedRef.current) return;
    hasPlayedRef.current = true;
    setPhase("playing");
  }, []);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return undefined;

    // Reduced motion keeps the pile it already has. Nothing is scheduled, so
    // the animation cannot start later either.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return undefined;
    }

    // Already on screen: start before the browser paints, so the reader never
    // sees the settled pile snap back up to start falling.
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

  const replay = useCallback(() => {
    hasPlayedRef.current = false;
    setPhase("idle");
    // A new `runId` remounts the glyph layer, which is what restarts a CSS
    // animation; toggling a class would only restart it after a reflow.
    setRunId((id) => id + 1);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        hasPlayedRef.current = true;
        setPhase("playing");
      });
    });
  }, []);

  return (
    <div
      ref={frameRef}
      className={[styles.frame, className].filter(Boolean).join(" ")}
      data-phase={phase}
      data-rain-variant={variant}
      style={{ ...style, "--rain-total": `${totalDuration()}ms` } as CSSProperties}
    >
      <div className={styles.field} aria-hidden="true" key={runId}>
        {plan.map((glyph, index) => (
          <span
            className={styles.glyph}
            style={glyphStyle(glyph)}
            key={`${runId}-${index}`}
          >
            <CategoryGlyph id={glyph.glyphId as GlyphId} />
          </span>
        ))}
      </div>

      <span className={styles.floor} aria-hidden="true" key={`floor-${runId}`} />

      {children ? <div className={styles.product}>{children}</div> : null}

      {showReplay ? (
        <button className={styles.replay} type="button" onClick={replay}>
          Replay
        </button>
      ) : null}
    </div>
  );
}

export { totalDuration as iconRainTotalDuration };
