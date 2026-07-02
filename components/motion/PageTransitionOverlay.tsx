"use client";

import type { CSSProperties } from "react";

export type PageTransitionPhase = "idle" | "leaving" | "revealing";
export type PageTransitionVariant = "paint" | "gloss" | "blur" | "glossveil";

export function PageTransitionOverlay({
  origin,
  phase,
  variant,
}: {
  origin: { x: number; y: number };
  phase: PageTransitionPhase;
  variant: PageTransitionVariant;
}) {
  return (
    <div
      aria-hidden="true"
      className="cs-page-transition"
      data-phase={phase}
      data-variant={variant}
      style={
        {
          "--tx": `${origin.x}px`,
          "--ty": `${origin.y}px`,
        } as CSSProperties
      }
    >
      <span className="cs-page-transition-blur" />
      <span className="cs-page-transition-veil" />
      <span className="cs-page-transition-curtain cs-page-transition-curtain-top" />
      <span className="cs-page-transition-curtain cs-page-transition-curtain-bottom" />
      <span className="cs-page-transition-edge" />
      <span className="cs-page-transition-gloss" />
    </div>
  );
}
