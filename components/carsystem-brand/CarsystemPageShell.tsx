"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePrefersReducedMotion } from "@/components/motion/usePrefersReducedMotion";
import styles from "./CarsystemBrandPage.module.css";

export function CarsystemPageShell({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const revealItems = Array.from(
      root.querySelectorAll<HTMLElement>("[data-cs-reveal]"),
    );

    if (reducedMotion || !("IntersectionObserver" in window)) {
      revealItems.forEach((item) => {
        item.dataset.csVisible = "true";
      });
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          (entry.target as HTMLElement).dataset.csVisible = "true";
          observer.unobserve(entry.target);
        });
      },
      {
        rootMargin: "0px 0px -12% 0px",
        threshold: 0.08,
      },
    );

    revealItems.forEach((item) => observer.observe(item));

    return () => observer.disconnect();
  }, [reducedMotion]);

  return (
    <div
      ref={rootRef}
      className={styles.carsystemPage}
      data-brand-page
      data-carsystem-page
      data-reduced-motion={reducedMotion || undefined}
    >
      {children}
    </div>
  );
}
