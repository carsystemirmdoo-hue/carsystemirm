"use client";

import { useEffect } from "react";

/**
 * Drives the footer reveal via IntersectionObserver. The footer is only
 * "armed" (hidden) after JS confirms it is below the viewport, so a
 * missing/failed script can never leave the footer invisible. Arming is
 * retried once shortly after mount because content-heavy pages can still
 * be laying out when the effect first runs. A CSS view() timeline is
 * intentionally avoided: it breaks when the footer is nested in an
 * overflow-clipped wrapper (e.g. the catalog shell).
 */
export function FooterReveal() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;

    const footer = document.querySelector<HTMLElement>(".cs-animated-footer");
    if (!footer) return undefined;

    let observer: IntersectionObserver | null = null;
    let retryTimer: number | null = null;

    function arm() {
      if (!footer) return false;
      if (footer.getBoundingClientRect().top < window.innerHeight) return false;

      footer.dataset.revealArmed = "true";

      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            footer.dataset.revealed = "true";
            observer?.disconnect();
          }
        },
        { threshold: 0.08 },
      );

      observer.observe(footer);
      return true;
    }

    if (!arm()) {
      retryTimer = window.setTimeout(arm, 700);
    }

    return () => {
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      observer?.disconnect();
      delete footer.dataset.revealArmed;
      delete footer.dataset.revealed;
    };
  }, []);

  return null;
}
