"use client";

import { useEffect } from "react";

/**
 * Drives a sticky curtain reveal without hiding the footer. If JS is missing,
 * the footer remains a normal block; if reduced motion is requested, the
 * component leaves the DOM untouched.
 */
export function FooterReveal() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;

    const footer = document.querySelector<HTMLElement>(".cs-animated-footer");
    if (!footer) return undefined;

    const footerElement = footer;
    let animationFrame = 0;
    let settleTimer: number | null = null;

    function updateReveal() {
      animationFrame = 0;

      const rect = footerElement.getBoundingClientRect();
      const revealDistance = Math.min(
        Math.max(rect.height * 0.72, 260),
        window.innerHeight * 0.78,
      );
      const visibleDistance = window.innerHeight - rect.top;
      const progress = Math.min(Math.max(visibleDistance / revealDistance, 0), 1);

      footerElement.dataset.revealArmed = "true";
      footerElement.style.setProperty("--cs-footer-reveal", progress.toFixed(3));
      footerElement.dataset.revealed = progress > 0.96 ? "true" : "false";
    }

    function scheduleUpdate() {
      if (animationFrame) return;
      animationFrame = window.requestAnimationFrame(updateReveal);
    }

    scheduleUpdate();
    settleTimer = window.setTimeout(scheduleUpdate, 500);
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);

    return () => {
      if (settleTimer !== null) window.clearTimeout(settleTimer);
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      delete footerElement.dataset.revealArmed;
      delete footerElement.dataset.revealed;
      footerElement.style.removeProperty("--cs-footer-reveal");
    };
  }, []);

  return null;
}
