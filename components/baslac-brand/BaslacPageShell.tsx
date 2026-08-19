"use client";

import type { ReactNode } from "react";
import { usePrefersReducedMotion } from "@/components/motion/usePrefersReducedMotion";
import styles from "./BaslacBrandPage.module.css";

export function BaslacPageShell({ children }: { children: ReactNode }) {
  const reducedMotion = usePrefersReducedMotion();

  return (
    <div
      className={styles.baslacPage}
      data-brand-page
      data-baslac-page
      data-reduced-motion={reducedMotion || undefined}
    >
      {children}
    </div>
  );
}
