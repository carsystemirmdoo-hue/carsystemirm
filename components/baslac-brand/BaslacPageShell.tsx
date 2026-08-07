"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePrefersReducedMotion } from "@/components/motion/usePrefersReducedMotion";
import styles from "./BaslacBrandPage.module.css";

type BaslacPageTheme = "default" | "process";

export function BaslacPageShell({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const themeRef = useRef<BaslacPageTheme>("default");
  const [theme, setTheme] = useState<BaslacPageTheme>("default");
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const root = rootRef.current;
    const processZone = root?.querySelector<HTMLElement>(
      '[data-baslac-theme-zone="process"]',
    );

    if (!root || !processZone) return;

    let animationFrame = 0;

    const syncTheme = () => {
      animationFrame = 0;
      const rect = processZone.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const currentTheme = themeRef.current;
      const shouldEnter =
        rect.top <= viewportHeight * 0.58 &&
        rect.bottom >= viewportHeight * 0.34;
      const shouldExit =
        rect.bottom < viewportHeight * 0.22 ||
        rect.top > viewportHeight * 0.74;
      const nextTheme: BaslacPageTheme =
        currentTheme === "default"
          ? shouldEnter
            ? "process"
            : "default"
          : shouldExit
            ? "default"
            : "process";

      if (nextTheme !== currentTheme) {
        themeRef.current = nextTheme;
        setTheme(nextTheme);
      }
    };

    const scheduleSync = () => {
      if (!animationFrame) {
        animationFrame = window.requestAnimationFrame(syncTheme);
      }
    };

    const observer = new ResizeObserver(scheduleSync);
    observer.observe(processZone);
    window.addEventListener("scroll", scheduleSync, { passive: true });
    window.addEventListener("resize", scheduleSync);
    window.addEventListener("pageshow", scheduleSync);
    scheduleSync();

    return () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      observer.disconnect();
      window.removeEventListener("scroll", scheduleSync);
      window.removeEventListener("resize", scheduleSync);
      window.removeEventListener("pageshow", scheduleSync);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={styles.baslacPage}
      data-brand-page
      data-baslac-page
      data-baslac-theme={theme}
      data-reduced-motion={reducedMotion || undefined}
    >
      {children}
    </div>
  );
}
