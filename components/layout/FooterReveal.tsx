"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useRef } from "react";

type FooterRevealStyle = CSSProperties & {
  "--footer-reveal-progress": string;
  "--footer-reveal-opacity": string;
  "--footer-reveal-y": string;
  "--footer-mask-y": string;
};

const initialFooterRevealStyle: FooterRevealStyle = {
  "--footer-reveal-progress": "1",
  "--footer-reveal-opacity": "1",
  "--footer-reveal-y": "0px",
  "--footer-mask-y": "-100%",
};

export function FooterReveal({ children }: { children: ReactNode }) {
  const rollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const rollerElement = rollerRef.current;
    if (!rollerElement) return undefined;
    const roller = rollerElement;

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let animationFrame = 0;
    let settleTimer: number | null = null;
    const interactiveElements = Array.from(
      roller.querySelectorAll<HTMLElement>(
        'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    );
    const originalInertState = new Map(
      interactiveElements.map((element) => [element, element.inert]),
    );

    function syncCoveredInteractions(progress: number) {
      const rollerRect = roller.getBoundingClientRect();
      const coveredBottom = rollerRect.top + rollerRect.height * (1 - progress);

      interactiveElements.forEach((element) => {
        if (originalInertState.get(element)) return;

        const elementRect = element.getBoundingClientRect();
        const isCovered =
          progress < 1 &&
          elementRect.bottom > rollerRect.top &&
          elementRect.top < coveredBottom;

        element.inert = isCovered;
        element.toggleAttribute("data-footer-covered", isCovered);
      });
    }

    function setProgress(progress: number) {
      const clampedProgress = Math.min(Math.max(progress, 0), 1);
      const opacity = Math.min(Math.max((clampedProgress - 0.08) * 2.4, 0), 1);

      roller.style.setProperty("--footer-reveal-progress", clampedProgress.toFixed(3));
      roller.style.setProperty("--footer-reveal-opacity", opacity.toFixed(3));
      roller.style.setProperty(
        "--footer-reveal-y",
        `${((1 - clampedProgress) * 18).toFixed(2)}px`,
      );
      roller.style.setProperty("--footer-mask-y", `${(clampedProgress * -100).toFixed(2)}%`);
      syncCoveredInteractions(clampedProgress);
    }

    function updateReveal() {
      animationFrame = 0;

      if (reducedMotionQuery.matches) {
        setProgress(1);
        return;
      }

      const rect = roller.getBoundingClientRect();
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const revealDistance = Math.min(Math.max(rect.height, 260), viewportHeight * 0.92);
      const visibleDistance = viewportHeight - rect.top;

      setProgress(visibleDistance / revealDistance);
    }

    function scheduleUpdate() {
      if (animationFrame) return;
      animationFrame = window.requestAnimationFrame(updateReveal);
    }

    updateReveal();
    roller.dataset.footerRevealReady = "true";
    settleTimer = window.setTimeout(scheduleUpdate, 300);

    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    reducedMotionQuery.addEventListener("change", scheduleUpdate);

    return () => {
      if (settleTimer !== null) window.clearTimeout(settleTimer);
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      reducedMotionQuery.removeEventListener("change", scheduleUpdate);
      delete roller.dataset.footerRevealReady;
      roller.style.removeProperty("--footer-reveal-progress");
      roller.style.removeProperty("--footer-reveal-opacity");
      roller.style.removeProperty("--footer-reveal-y");
      roller.style.removeProperty("--footer-mask-y");
      originalInertState.forEach((wasInert, element) => {
        element.inert = wasInert;
        element.removeAttribute("data-footer-covered");
      });
    };
  }, []);

  return (
    <div
      ref={rollerRef}
      className="footerRevealRoller mt-auto"
      style={initialFooterRevealStyle}
    >
      <div className="footerRevealRoller__footer">{children}</div>
      <span
        className="footerRevealRoller__mask"
        data-footer-interaction-blocker
        aria-hidden="true"
      />
    </div>
  );
}
