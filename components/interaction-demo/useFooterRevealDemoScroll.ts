"use client";

import { useEffect } from "react";

/*
 * Deterministic Reels/TikTok loop for ?demo=1, shared by the footer reveal
 * showcase stages. The timeline only moves window scroll position via one
 * requestAnimationFrame loop keyed to performance.now(); the untouched
 * production FooterReveal listens to that scroll and drives the roller
 * reveal itself, so timing, easing and exposure are exactly the production
 * behavior.
 *
 * 0.0s  page rests shortly before the reveal threshold
 * 0.8s  eased scroll toward the page end starts
 * ~1.3s roller reveal becomes visible
 * ~2.5s reveal strongly visible
 * ~3.5s page end reached (production progress = 1 shortly before)
 * 5.2s  instant reset to the pre-footer position (loop boundary)
 * 6.0s  next cycle
 */
const demoLoopDurationMs = 6000;
const demoScrollStartMs = 800;
const demoScrollEndMs = 3500;
const demoResetMs = 5200;
/* Scroll runway above the reveal threshold so motion is readable before the
   roller edge enters the frame. */
const demoPreRevealLeadPx = 150;

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

export function useFooterRevealDemoScroll(isDemoMode: boolean) {
  useEffect(() => {
    if (!isDemoMode) return undefined;

    let cancelled = false;
    let animationFrame = 0;
    let originMs = 0;
    let startY = 0;
    let endY = 0;

    function measure() {
      const roller = document.querySelector<HTMLElement>(".footerRevealRoller");
      const viewportHeight = window.innerHeight;
      const maxScrollY = Math.max(
        document.documentElement.scrollHeight - viewportHeight,
        0,
      );
      const rollerDocumentTop = roller
        ? roller.getBoundingClientRect().top + window.scrollY
        : maxScrollY;

      startY = Math.min(
        Math.max(rollerDocumentTop - viewportHeight - demoPreRevealLeadPx, 0),
        maxScrollY,
      );
      endY = maxScrollY;
    }

    function positionAt(elapsedMs: number) {
      const t = elapsedMs % demoLoopDurationMs;
      if (t < demoScrollStartMs) return startY;
      if (t <= demoScrollEndMs) {
        const progress = easeInOutCubic(
          (t - demoScrollStartMs) / (demoScrollEndMs - demoScrollStartMs),
        );
        return startY + (endY - startY) * progress;
      }
      if (t < demoResetMs) return endY;
      return startY;
    }

    function frame(now: number) {
      if (cancelled) return;
      window.scrollTo({ top: positionAt(now - originMs), behavior: "instant" });
      animationFrame = window.requestAnimationFrame(frame);
    }

    /* Fonts settle the page height, so measure and start only after they are
       ready; the recording then only ever sees fully deterministic cycles. */
    document.fonts.ready.then(() => {
      if (cancelled) return;
      measure();
      originMs = performance.now();
      animationFrame = window.requestAnimationFrame(frame);
    });

    return () => {
      cancelled = true;
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
    };
  }, [isDemoMode]);
}
