"use client";

import { useEffect, type RefObject } from "react";

type Options = {
  /** Property written on the element, e.g. "--rail-progress". */
  cssVariable: string;
  /**
   * Maps the element's position to 0..1.
   * "through" — 0 when the element's top hits the viewport top, 1 when its
   *   bottom reaches the viewport bottom. Used for pinned scrubbing.
   * "exit" — 0 at the element's natural position, 1 once it has scrolled a
   *   full viewport height away. Used for hero parallax.
   */
  mode: "through" | "exit";
};

/**
 * Drives a scroll-linked CSS custom property.
 *
 * Deliberately writes straight to the element's style rather than through React
 * state: this runs at frame rate, and a setState per frame would re-render the
 * whole scene. The rAF loop only runs while the element is on screen, so an
 * off-screen rail costs nothing.
 */
export function useScrollProgress(
  ref: RefObject<HTMLElement | null>,
  { cssVariable, mode }: Options,
) {
  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced.matches) {
      element.style.setProperty(cssVariable, "0");
      return undefined;
    }

    let frame = 0;
    let running = false;
    let last = -1;

    const measure = () => {
      const rect = element.getBoundingClientRect();
      const viewport = window.innerHeight;

      let progress: number;
      if (mode === "through") {
        const distance = rect.height - viewport;
        progress = distance <= 0 ? 0 : -rect.top / distance;
      } else {
        progress = -rect.top / viewport;
      }

      progress = Math.min(1, Math.max(0, progress));
      if (Math.abs(progress - last) > 0.0005) {
        last = progress;
        element.style.setProperty(cssVariable, progress.toFixed(4));
      }
      if (running) frame = requestAnimationFrame(measure);
    };

    const start = () => {
      if (running) return;
      running = true;
      frame = requestAnimationFrame(measure);
    };

    const stop = () => {
      running = false;
      cancelAnimationFrame(frame);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) start();
        else stop();
      },
      { rootMargin: "100px 0px" },
    );

    observer.observe(element);
    measure();

    return () => {
      observer.disconnect();
      stop();
    };
  }, [ref, cssVariable, mode]);
}

/**
 * Publishes the element's measured content width as `--rail-width`.
 *
 * The rail's panel width and travel distance are both derived from this. Using
 * a measured pixel width rather than `100vw` keeps the track exactly as wide as
 * the visible area, so the page can never gain a horizontal scrollbar from the
 * classic `100vw`-includes-the-scrollbar bug.
 */
export function useMeasuredWidth(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;

    const apply = () => {
      element.style.setProperty(
        "--rail-width",
        `${Math.round(element.clientWidth)}px`,
      );
    };

    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
}
